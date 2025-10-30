"""
Cloud Functions for Ekklesia Members Service

Handles manual OAuth flow with Kenni.is including PKCE token exchange.
"""

import os
import json
import requests
import jwt
from datetime import datetime, timedelta, timezone
import uuid
from typing import Optional

import firebase_admin
from firebase_admin import initialize_app, auth, firestore
from firebase_functions import https_fn, options
from google.cloud import firestore as gcf

# Local utilities (no firebase_admin side-effects)
from utils_logging import log_json, sanitize_fields
from util_jwks import get_jwks_client_cached_ttl, get_jwks_cache_stats

# Audit logging (Epic #116, Issue #119)
# NOTE: Firebase Functions Python SDK requires decorated functions to be
# directly defined in main.py or explicitly re-exported at module level.
# We import and re-export to make the function discoverable.
from audit_members import auditmemberchanges

# Django API token access (Epic #116, Issue #137)
from get_django_token import get_django_token

# Re-export at module level so Firebase discovers it
__all__ = ['auditmemberchanges', 'get_django_token']

# --- SETUP ---
if not firebase_admin._apps:
    initialize_app()

options.set_global_options(region="europe-west2")

# --- CONSTANTS ---
DEFAULT_ALLOWED_ORIGINS = [
    'https://ekklesia-prod-10-2025.web.app',
    'https://ekklesia-prod-10-2025.firebaseapp.com',
    'http://localhost:3000'
]


def _parse_allowed_origins() -> list[str]:
    allowlist_env = os.getenv('CORS_ALLOWED_ORIGINS', '').strip()
    if not allowlist_env:
        return DEFAULT_ALLOWED_ORIGINS
    if allowlist_env == '*':
        return ['*']
    normalized = allowlist_env.replace(';', ',')
    allowed = [origin.strip() for origin in normalized.split(',') if origin.strip()]
    return allowed if allowed else DEFAULT_ALLOWED_ORIGINS


def _get_allowed_origin(req_origin: Optional[str]) -> str:
    allowed = _parse_allowed_origins()
    if '*' in allowed:
        return '*'
    if req_origin and req_origin in allowed:
        return req_origin
    # Default to first allowed origin for preflight when origin is absent or not allowed
    return allowed[0]


def _cors_headers_for_origin(origin: str) -> dict:
    return {
        'Access-Control-Allow-Origin': origin,
        'Vary': 'Origin',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Firebase-AppCheck, X-Request-ID, X-Correlation-ID',
        'Access-Control-Expose-Headers': 'X-Correlation-ID',
        'Access-Control-Max-Age': '3600',
    }

# --- HELPER FUNCTIONS ---

def get_kenni_is_jwks_client(issuer_url: str):
    """TTL-based cached JWKS client (see utils: util_jwks). TTL configurable via JWKS_CACHE_TTL_SECONDS."""
    return get_jwks_client_cached_ttl(issuer_url)

def normalize_kennitala(kennitala: str) -> str:
    """Normalize kennitala format to DDMMYY-XXXX"""
    if not kennitala:
        return None

    # Remove any whitespace
    kennitala = kennitala.strip()

    # Already has hyphen
    if '-' in kennitala:
        return kennitala

    # Add hyphen if missing (assumes 10 digits)
    if len(kennitala) == 10 and kennitala.isdigit():
        return f"{kennitala[:6]}-{kennitala[6:]}"

    return kennitala

def validate_kennitala(kennitala: str) -> bool:
    """Validate kennitala format (DDMMYY-XXXX or DDMMYYXXXX)"""
    import re
    pattern = r'^\d{6}-?\d{4}$'
    return bool(re.match(pattern, kennitala))

def _rate_limit_bucket_id(ip_address: str, now: datetime, window_minutes: int) -> str:
    """Create a stable document id for the (ip, window) bucket.

    Documents naturally age out: each doc id encodes the time bucket and window size.
    As time advances into a new bucket, the previous bucket is never read again, so
    old docs become orphaned without needing an explicit cleanup job.
    """
    window_seconds = window_minutes * 60
    bucket = int(now.timestamp()) // window_seconds
    return f"{ip_address}:{bucket}:{window_minutes}m"


def check_rate_limit(ip_address: Optional[str], max_attempts: int = 5, window_minutes: int = 10) -> bool:
    """
    Transactional IP-based rate limit: 5 attempts / 10 minutes (configurable).

    Uses a Firestore transaction to check-and-increment a counter in a time-bucketed document,
    minimizing lost updates under concurrency.

    Returns True if allowed; False if limited.
    """
    if not ip_address:
        # If we can't determine IP, err on the safe side but log it.
        log_json("warn", "Missing IP address for rate limiting; allowing request")
        return True

    db = firestore.client()
    now = datetime.now(timezone.utc)
    doc_id = _rate_limit_bucket_id(ip_address, now, window_minutes)
    ref = db.collection('rate_limits').document(doc_id)
    expires_at = now + timedelta(minutes=window_minutes)

    @gcf.transactional
    def _attempt(transaction) -> bool:
        snapshot = ref.get(transaction=transaction)
        if snapshot.exists:
            data = snapshot.to_dict() or {}
            count = int(data.get('count', 0))
            if count >= max_attempts:
                return False
            transaction.update(ref, {
                'count': count + 1,
                'updatedAt': firestore.SERVER_TIMESTAMP,
                'expiresAt': expires_at,
                'ip': ip_address,
            })
            return True
        else:
            transaction.set(ref, {
                'count': 1,
                'createdAt': firestore.SERVER_TIMESTAMP,
                'updatedAt': firestore.SERVER_TIMESTAMP,
                'windowMinutes': window_minutes,
                'expiresAt': expires_at,
                'ip': ip_address,
            })
            return True

    allowed = _attempt(db.transaction())
    if not allowed:
        log_json("warn", "Rate limit exceeded", ip=ip_address, windowMinutes=window_minutes, maxAttempts=max_attempts)
    return allowed

def validate_auth_input(kenni_auth_code: str, pkce_code_verifier: str) -> bool:
    """
    Validate authentication input parameters.

    Prevents DoS attacks via oversized payloads.

    Args:
        kenni_auth_code: OAuth authorization code from Kenni.is
        pkce_code_verifier: PKCE code verifier

    Raises:
        ValueError: If input validation fails

    Returns:
        True if validation passes

    Issue #64: Add input validation for auth code and PKCE verifier
    """
    # Check if fields are present
    if not kenni_auth_code:
        raise ValueError("Auth code required")
    if not pkce_code_verifier:
        raise ValueError("PKCE verifier required")

    # Validate lengths (OAuth 2.0 reasonable limits)
    if len(kenni_auth_code) > 500:
        raise ValueError("Auth code too long (max 500 characters)")
    if len(pkce_code_verifier) > 200:
        raise ValueError("PKCE verifier too long (max 200 characters)")

    return True

# --- CLOUD FUNCTIONS ---

@https_fn.on_request()
def healthz(req: https_fn.Request) -> https_fn.Response:
    """Basic health and config sanity endpoint.

    Returns presence (not values) of required env vars and JWKS cache stats.
    Always includes X-Correlation-ID and proper CORS.
    """
    correlation_id = req.headers.get('X-Correlation-ID') or req.headers.get('X-Request-ID') or str(uuid.uuid4())
    origin = _get_allowed_origin(req.headers.get('Origin'))

    if req.method == 'OPTIONS':
        return https_fn.Response("", status=204, headers={**_cors_headers_for_origin(origin), 'X-Correlation-ID': correlation_id})

    # Only allow GET for health checks
    if req.method != 'GET':
        return https_fn.Response(
            json.dumps({"error": "METHOD_NOT_ALLOWED", "message": "Use GET", "correlationId": correlation_id}),
            status=405,
            mimetype="application/json",
            headers={**_cors_headers_for_origin(origin), 'X-Correlation-ID': correlation_id},
        )

    env_keys = [
        "KENNI_IS_ISSUER_URL",
        "KENNI_IS_CLIENT_ID",
        "KENNI_IS_CLIENT_SECRET",
        "KENNI_IS_REDIRECT_URI",
    ]
    env_status = {k: bool(os.environ.get(k)) for k in env_keys}

    # Include JWKS cache stats (no secrets)
    issuer_url = os.environ.get("KENNI_IS_ISSUER_URL", "")
    cache_stats = get_jwks_cache_stats()

    body = {
        "ok": True,
        "env": env_status,
        "jwks": cache_stats,
        "issuerConfigured": bool(issuer_url),
        "correlationId": correlation_id,
    }

    return https_fn.Response(
        json.dumps(body),
        status=200,
        mimetype="application/json",
        headers={**_cors_headers_for_origin(origin), 'X-Correlation-ID': correlation_id},
    )

@https_fn.on_request()
def handleKenniAuth(req: https_fn.Request) -> https_fn.Response:
    """
    Handle Kenni.is OAuth code exchange with PKCE

    This function:
    1. Receives authorization code + PKCE verifier from frontend
    2. Exchanges code for tokens with Kenni.is (sends code_verifier)
    3. Verifies the ID token from Kenni.is
    4. Creates or updates user in Firestore
    5. Creates Firebase custom token
    6. Returns custom token to frontend for sign-in
    """

    # Extract correlation id for structured logs
    correlation_id = req.headers.get('X-Correlation-ID') or req.headers.get('X-Request-ID') or str(uuid.uuid4())

    # Handle CORS preflight requests
    if req.method == 'OPTIONS':
        origin = _get_allowed_origin(req.headers.get('Origin'))
        return https_fn.Response("", status=204, headers={**_cors_headers_for_origin(origin), 'X-Correlation-ID': correlation_id})

    # Ensure the method is POST
    if req.method != "POST":
        origin = _get_allowed_origin(req.headers.get('Origin'))
        return https_fn.Response(json.dumps({"error": "METHOD_NOT_ALLOWED", "message": "Invalid request method.", "correlationId": correlation_id}),
                                  status=405,
                                  mimetype="application/json",
                                  headers={**_cors_headers_for_origin(origin), 'X-Correlation-ID': correlation_id})

    # Rate limiting check (Issue #62)
    # Get client IP (Cloud Run provides real IP in X-Forwarded-For)
    ip_address = req.headers.get('X-Forwarded-For', req.remote_addr)
    if ip_address:
        ip_address = ip_address.split(',')[0].strip()

    if not check_rate_limit(ip_address):
        log_json("warn", "Auth rate limited", ip=ip_address, correlationId=correlation_id)
        origin = _get_allowed_origin(req.headers.get('Origin'))
        return https_fn.Response(json.dumps({"error": "RATE_LIMITED", "message": "Too many authentication attempts. Please try again in 10 minutes.", "correlationId": correlation_id}),
                                  status=429,
                                  mimetype="application/json",
                                  headers={**_cors_headers_for_origin(origin), 'Retry-After': '600', 'X-Correlation-ID': correlation_id})

    # Validate incoming data
    try:
        data = req.get_json()
        kenni_auth_code = data.get('kenniAuthCode')
        pkce_code_verifier = data.get('pkceCodeVerifier')

        # Input validation (Issue #64)
        validate_auth_input(kenni_auth_code, pkce_code_verifier)

    except ValueError as e:
        # Input validation failed
        log_json("info", "Auth input validation failed", error=str(e), correlationId=correlation_id)
        origin = _get_allowed_origin(req.headers.get('Origin'))
        return https_fn.Response(
            json.dumps({"error": "INVALID_INPUT", "message": str(e), "correlationId": correlation_id}),
            status=400,
            mimetype="application/json",
            headers={**_cors_headers_for_origin(origin), 'X-Correlation-ID': correlation_id},
        )
    except Exception as e:
        # JSON parsing or unexpected input shape
        log_json("info", "Invalid JSON payload", error=str(e), correlationId=correlation_id)
        origin = _get_allowed_origin(req.headers.get('Origin'))
        return https_fn.Response(
            json.dumps({"error": "INVALID_JSON", "message": "Invalid JSON", "correlationId": correlation_id}),
            status=400,
            mimetype="application/json",
            headers={**_cors_headers_for_origin(origin), 'X-Correlation-ID': correlation_id},
        )

    # Main OAuth flow
    try:
        # Get Kenni.is configuration from environment
        issuer_url = os.environ.get("KENNI_IS_ISSUER_URL")
        client_id = os.environ.get("KENNI_IS_CLIENT_ID")
        client_secret = os.environ.get("KENNI_IS_CLIENT_SECRET")
        redirect_uri = os.environ.get("KENNI_IS_REDIRECT_URI")

        missing = [
            name for name, val in [
                ("KENNI_IS_ISSUER_URL", issuer_url),
                ("KENNI_IS_CLIENT_ID", client_id),
                ("KENNI_IS_CLIENT_SECRET", client_secret),
                ("KENNI_IS_REDIRECT_URI", redirect_uri),
            ] if not val
        ]
        if missing:
            raise Exception(f"Missing environment variables: {', '.join(missing)}")

        token_url = f"{issuer_url}/oidc/token"

        # Step 1: Exchange authorization code for tokens (with PKCE verifier!)
        payload = {
            'grant_type': 'authorization_code',
            'code': kenni_auth_code,
            'redirect_uri': redirect_uri,
            'client_id': client_id,
            'client_secret': client_secret,
            'code_verifier': pkce_code_verifier  # ← Critical for PKCE!
        }

        log_json("info", "Exchanging authorization code for tokens", correlationId=correlation_id)
        token_response = requests.post(
            token_url,
            data=payload,
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        token_response.raise_for_status()
        kenni_is_id_token = token_response.json().get("id_token")

        if not kenni_is_id_token:
            raise Exception("No id_token in response from Kenni.is")

        # Step 2: Verify and decode the ID token from Kenni.is
        log_json("info", "Verifying ID token from Kenni.is", correlationId=correlation_id)
        jwks_client = get_kenni_is_jwks_client(issuer_url)

        # Log cache statistics (Issue #63)
        cache_stats = get_jwks_cache_stats()
        log_json("debug", "JWKS cache stats", correlationId=correlation_id, **cache_stats)

        signing_key = jwks_client.get_signing_key_from_jwt(kenni_is_id_token)
        decoded_kenni_token = jwt.decode(
            kenni_is_id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=client_id,
            issuer=issuer_url
        )

        # Step 3: Extract user information
        national_id = decoded_kenni_token.get("national_id")
        full_name = decoded_kenni_token.get("name")
        email = decoded_kenni_token.get("email")
        phone_number = decoded_kenni_token.get("phone_number")

        if not national_id:
            raise Exception("No national_id in Kenni.is token")

        # Validate and normalize kennitala
        if not validate_kennitala(national_id):
            raise Exception(f"Invalid kennitala format: {national_id}")

        normalized_kennitala = normalize_kennitala(national_id)

        log_json("info", "Verified Kenni.is token", userName=full_name, kennitala=f"{normalized_kennitala[:7]}****", correlationId=correlation_id)

        # Step 4: Create or get existing user from Firestore
        db = firestore.client()
        users_ref = db.collection('users')
        query = users_ref.where('kennitala', '==', normalized_kennitala).limit(1)
        existing_users = list(query.stream())

        auth_uid = None
        if existing_users:
            # User already exists
            user_doc = existing_users[0]
            auth_uid = user_doc.id
            log_json("info", "User profile exists", uid=auth_uid, kennitala=f"{normalized_kennitala[:7]}****", correlationId=correlation_id)

            # Update last login and sync email/phone from Kenni.is
            update_data = {
                'lastLogin': firestore.SERVER_TIMESTAMP
            }
            if email:
                update_data['email'] = email
            if phone_number:
                update_data['phoneNumber'] = phone_number
            if full_name:
                update_data['fullName'] = full_name

            users_ref.document(auth_uid).update(update_data)
        else:
            # Create new user (with race condition handling)
            log_json("info", "Creating new user", kennitala=f"{normalized_kennitala[:7]}****", correlationId=correlation_id)

            try:
                new_user = auth.create_user(display_name=full_name)
                auth_uid = new_user.uid
                log_json("info", "Created Firebase Auth user", uid=auth_uid, correlationId=correlation_id)

                # Create user profile in Firestore
                user_profile_data = {
                    'fullName': full_name,
                    'kennitala': normalized_kennitala,
                    'email': email,
                    'phoneNumber': phone_number,
                    'photoURL': None,
                    'isMember': False,  # Will be verified separately
                    'createdAt': firestore.SERVER_TIMESTAMP,
                    'lastLogin': firestore.SERVER_TIMESTAMP
                }
                db.collection('users').document(auth_uid).set(user_profile_data)
                log_json("info", "Created Firestore user profile", path=f"/users/{auth_uid}", correlationId=correlation_id)

            except Exception as e:
                # Handle race condition: user created by concurrent request
                error_message = str(e)
                if 'already exists' in error_message.lower() or 'uid_already_exists' in error_message.lower():
                    log_json("warn", "User already exists; race condition; retrying", kennitala=f"{normalized_kennitala[:7]}****", correlationId=correlation_id)
                    # Retry query to find the user created by concurrent request
                    query = users_ref.where('kennitala', '==', normalized_kennitala).limit(1)
                    existing_users = list(query.stream())
                    if existing_users:
                        auth_uid = existing_users[0].id
                        log_json("info", "Found existing user after race condition", uid=auth_uid, correlationId=correlation_id)
                    else:
                        # This shouldn't happen, but handle it gracefully
                        log_json("error", "Race condition unresolved - user exists but not found in Firestore", correlationId=correlation_id)
                        raise Exception("User creation race condition could not be resolved")
                else:
                    # Re-raise if it's a different error
                    raise

        # Step 5: Read roles from Firestore /users/ collection (set by Django sync)
        # Epic #116: Roles are synced from Django User model (is_staff → admin, is_superuser → superuser)
        user_doc_ref = db.collection('users').document(auth_uid)
        user_doc = user_doc_ref.get()

        roles = ['member']  # Default role for all members
        if user_doc.exists:
            user_data = user_doc.to_dict()
            roles = user_data.get('roles', ['member'])
            log_json("info", "Read roles from Firestore /users/",
                     uid=auth_uid, roles=roles, correlationId=correlation_id)
        else:
            log_json("warn", "No /users/ document found, using default roles",
                     uid=auth_uid, correlationId=correlation_id)

        # Step 6: Create Firebase custom token with claims
        custom_claims = {
            'kennitala': normalized_kennitala,
            'roles': roles  # Roles from Firestore (synced from Django)
        }
        if email:
            custom_claims['email'] = email
        if phone_number:
            custom_claims['phoneNumber'] = phone_number

        # Persist merged claims back to Firebase Auth (ensures roles survive future logins)
        try:
            auth.set_custom_user_claims(auth_uid, custom_claims)
            log_json("debug", "Persisted custom claims to Firebase Auth", uid=auth_uid, claims=sanitize_fields(custom_claims))
        except Exception as e:
            log_json("error", "Failed to persist custom claims to Firebase Auth", error=str(e), uid=auth_uid)
            # Continue anyway - custom token will still work for this session

        log_json("debug", "Creating custom token with claims", uid=auth_uid, claims=sanitize_fields(custom_claims))
        custom_token = auth.create_custom_token(auth_uid, developer_claims=custom_claims)

        # Step 6: Return custom token to frontend
        response_data = {
            "customToken": custom_token.decode("utf-8"),
            "uid": auth_uid
        }

        log_json("info", "Created custom token", uid=auth_uid, correlationId=correlation_id)
        origin = _get_allowed_origin(req.headers.get('Origin'))
        # Ensure token-bearing responses are not cached by browsers or intermediaries
        headers = {**_cors_headers_for_origin(origin), 'X-Correlation-ID': correlation_id, 'Cache-Control': 'no-store, no-cache, must-revalidate, private, max-age=0'}
        return https_fn.Response(
            json.dumps(response_data),
            status=200,
            mimetype="application/json",
            headers=headers,
        )

    except requests.exceptions.HTTPError as e:
        body = e.response.text if getattr(e, 'response', None) else 'No response'
        log_json("error", "HTTP error during token exchange", error=str(e), responseBody=sanitize_fields({'body': body})['body'], correlationId=correlation_id)
        origin = _get_allowed_origin(req.headers.get('Origin'))
        headers = {**_cors_headers_for_origin(origin), 'X-Correlation-ID': correlation_id, 'Cache-Control': 'no-store, no-cache, must-revalidate, private, max-age=0'}
        return https_fn.Response(
            json.dumps({"error": "TOKEN_EXCHANGE_FAILED", "message": "Token exchange failed", "correlationId": correlation_id}),
            status=502,
            mimetype="application/json",
            headers=headers
        )
    except Exception as e:
        # Detect configuration error and surface missing env vars explicitly
        msg = str(e)
        origin = _get_allowed_origin(req.headers.get('Origin'))
        headers = {**_cors_headers_for_origin(origin), 'X-Correlation-ID': correlation_id, 'Cache-Control': 'no-store, no-cache, must-revalidate, private, max-age=0'}
        if msg.startswith("Missing environment variables:"):
            log_json("error", "Configuration error in handleKenniAuth", error=msg, correlationId=correlation_id)
            return https_fn.Response(
                json.dumps({
                    "error": "CONFIG_MISSING",
                    "message": msg,
                    "correlationId": correlation_id
                }),
                status=500,
                mimetype="application/json",
                headers=headers
            )
        log_json("error", "Unhandled error in handleKenniAuth", error=str(e), correlationId=correlation_id)
        return https_fn.Response(
            json.dumps({"error": "INTERNAL", "message": "An internal error occurred", "correlationId": correlation_id}),
            status=500,
            mimetype="application/json",
            headers=headers
        )


@https_fn.on_call()
def verifyMembership(req: https_fn.CallableRequest) -> dict:
    """
    Verify user membership status

    Callable function to check if a user's kennitala is in the membership list.
    """
    # Verify authentication
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="User must be authenticated"
        )

    kennitala = req.auth.token.get('kennitala')

    if not kennitala:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="No kennitala found for user"
        )

    try:
        # Epic #43: Read membership status from Firestore (synced from Django)
        db = firestore.client()

        # Normalize kennitala (remove hyphen if present)
        kennitala_normalized = kennitala.replace('-', '')

        # Query members collection by document ID (kennitala without hyphen)
        member_doc_ref = db.collection('members').document(kennitala_normalized)
        member_doc = member_doc_ref.get()

        # Check if member exists and has active membership status
        is_member = False
        if member_doc.exists:
            member_data = member_doc.to_dict()
            membership = member_data.get('membership', {})
            membership_status = membership.get('status', '')
            is_member = membership_status == 'active'

            log_json("info", "Member lookup successful",
                     kennitala=f"{kennitala[:7]}****",
                     status=membership_status,
                     isMember=is_member,
                     uid=req.auth.uid)
        else:
            log_json("info", "Member not found in Firestore",
                     kennitala=f"{kennitala[:7]}****",
                     uid=req.auth.uid)

        # Update user profile in Firestore
        db.collection('users').document(req.auth.uid).update({
            'isMember': is_member,
            'membershipVerifiedAt': firestore.SERVER_TIMESTAMP
        })

        # Update custom claims while preserving roles and other attributes
        try:
            existing_custom_claims = auth.get_user(req.auth.uid).custom_claims or {}
        except Exception as e:
            log_json("warn", "Could not read existing custom claims during membership verification", error=str(e), uid=req.auth.uid)
            existing_custom_claims = {}

        merged_claims = {**existing_custom_claims, 'kennitala': kennitala, 'isMember': is_member}

        try:
            auth.set_custom_user_claims(req.auth.uid, merged_claims)
            log_json("debug", "Persisted merged custom claims after membership verification", uid=req.auth.uid, claims=sanitize_fields(merged_claims))
        except Exception as e:
            log_json("error", "Failed to persist custom claims during membership verification", error=str(e), uid=req.auth.uid)

        return {
            'isMember': is_member,
            'verified': True,
            'kennitala': kennitala[:7] + '****'  # Masked for security
        }

    except Exception as e:
        log_json("error", "Error verifying membership", error=str(e))
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Failed to verify membership"
        )


# ============================================================================
# Epic #43: Member Sync from Django
# ============================================================================

from sync_members import sync_all_members, create_sync_log


@https_fn.on_call(timeout_sec=540, memory=512)
def syncmembers(req: https_fn.CallableRequest):
    """
    Epic #43: Manual trigger to sync all members from Django to Firestore.

    Requires authentication and 'admin' or 'superuser' role.

    Returns:
        Dict with sync statistics
    """
    # Verify authentication
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Authentication required"
        )

    # Verify admin or superuser role
    roles = req.auth.token.get('roles', [])
    has_access = 'admin' in roles or 'superuser' in roles
    if not has_access:
        log_json("warn", "Unauthorized sync attempt", uid=req.auth.uid, roles=roles)
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message="Admin or superuser role required"
        )

    log_json("info", "Member sync initiated", uid=req.auth.uid)

    try:
        # Run sync
        stats = sync_all_members()

        # Create sync log
        db = firestore.Client()
        log_id = create_sync_log(db, stats)

        log_json("info", "Member sync completed successfully",
                 uid=req.auth.uid,
                 stats=stats,
                 log_id=log_id)

        return {
            'success': True,
            'stats': stats,
            'log_id': log_id
        }

    except Exception as e:
        log_json("error", "Member sync failed", error=str(e), uid=req.auth.uid)
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Sync failed: {str(e)}"
        )


@https_fn.on_call(timeout_sec=30, memory=256)
def updatememberprofile(req: https_fn.CallableRequest):
    """
    Update member profile from Kenni.is data to Django backend.

    This function is called when a user confirms profile updates from Þjóðskrá.
    It updates the Django backend via the ComradeFullViewSet PATCH endpoint.

    Requires authentication and must be the member themselves.

    Args:
        req.data: {
            'kennitala': str,
            'updates': {
                'name': str (optional),
                'email': str (optional),
                'phone': str (optional)
            }
        }

    Returns:
        Dict with success status and updated member data
    """
    # Verify authentication
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Authentication required"
        )

    # Get request data
    kennitala = req.data.get('kennitala')
    updates = req.data.get('updates', {})

    if not kennitala:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="kennitala is required"
        )

    # Verify user is updating their own profile
    user_kennitala = req.auth.token.get('kennitala', '').replace('-', '')
    if user_kennitala != kennitala:
        log_json("warn", "Unauthorized profile update attempt",
                 uid=req.auth.uid,
                 requested_kennitala=f"{kennitala[:6]}****",
                 user_kennitala=f"{user_kennitala[:6]}****")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message="You can only update your own profile"
        )

    log_json("info", "Profile update initiated",
             uid=req.auth.uid,
             kennitala=f"{kennitala[:6]}****",
             fields=list(updates.keys()))

    try:
        # Import Django API client
        from sync_members import get_django_member_by_kennitala, update_django_member

        # Get Django member ID
        django_member = get_django_member_by_kennitala(kennitala)
        if not django_member:
            raise Exception(f"Member not found in Django: {kennitala[:6]}****")

        django_id = django_member.get('id')

        # Build Django update payload
        django_updates = {}
        if 'name' in updates:
            django_updates['name'] = updates['name']
        if 'email' in updates:
            # Email is in contact_info nested object
            django_updates['contact_info'] = {'email': updates['email']}
        if 'phone' in updates:
            # Phone is in contact_info nested object
            if 'contact_info' not in django_updates:
                django_updates['contact_info'] = {}
            django_updates['contact_info']['phone'] = updates['phone']

        # Update Django via API
        updated_member = update_django_member(django_id, django_updates)

        log_json("info", "Profile updated successfully",
                 uid=req.auth.uid,
                 django_id=django_id,
                 kennitala=f"{kennitala[:6]}****")

        return {
            'success': True,
            'django_id': django_id,
            'updated_fields': list(updates.keys())
        }

    except Exception as e:
        log_json("error", "Profile update failed",
                 uid=req.auth.uid,
                 kennitala=f"{kennitala[:6]}****",
                 error=str(e))
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Profile update failed: {str(e)}"
        )
