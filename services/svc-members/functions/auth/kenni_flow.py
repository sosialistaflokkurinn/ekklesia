"""
Kenni.is OAuth authentication flow for Ekklesia Members Service

Handles manual OAuth flow with Kenni.is including PKCE token exchange.
"""

import os
import json
import requests
import jwt
import uuid
from jwt import PyJWKClient
from typing import Optional

from firebase_admin import auth, firestore
from firebase_functions import https_fn
from util_logging import log_json, sanitize_fields
from util_jwks import get_jwks_client_cached_ttl, get_jwks_cache_stats
from shared.cors import get_allowed_origin, cors_headers_for_origin
from shared.validators import normalize_kennitala, validate_kennitala, normalize_phone
from shared.rate_limit import check_rate_limit


def get_kenni_is_jwks_client(issuer_url: str) -> PyJWKClient:
    """
    TTL-based cached JWKS client (see utils: util_jwks).
    TTL configurable via JWKS_CACHE_TTL_SECONDS.

    Args:
        issuer_url: Kenni.is issuer URL

    Returns:
        Cached JWKS client
    """
    return get_jwks_client_cached_ttl(issuer_url)


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


def healthz_handler(req: https_fn.Request) -> https_fn.Response:
    """
    Basic health and config sanity endpoint.

    Returns presence (not values) of required env vars and JWKS cache stats.
    Always includes X-Correlation-ID and proper CORS.
    """
    correlation_id = req.headers.get('X-Correlation-ID') or req.headers.get('X-Request-ID') or str(uuid.uuid4())
    origin = get_allowed_origin(req.headers.get('Origin'))

    if req.method == 'OPTIONS':
        return https_fn.Response("", status=204, headers={**cors_headers_for_origin(origin), 'X-Correlation-ID': correlation_id})

    # Only allow GET for health checks
    if req.method != 'GET':
        return https_fn.Response(
            json.dumps({"error": "METHOD_NOT_ALLOWED", "message": "Use GET", "correlationId": correlation_id}),
            status=405,
            mimetype="application/json",
            headers={**cors_headers_for_origin(origin), 'X-Correlation-ID': correlation_id},
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
        headers={**cors_headers_for_origin(origin), 'X-Correlation-ID': correlation_id},
    )


def handleKenniAuth_handler(req: https_fn.Request) -> https_fn.Response:
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
        origin = get_allowed_origin(req.headers.get('Origin'))
        return https_fn.Response("", status=204, headers={**cors_headers_for_origin(origin), 'X-Correlation-ID': correlation_id})

    # Ensure the method is POST
    if req.method != "POST":
        origin = get_allowed_origin(req.headers.get('Origin'))
        return https_fn.Response(json.dumps({"error": "METHOD_NOT_ALLOWED", "message": "Invalid request method.", "correlationId": correlation_id}),
                                  status=405,
                                  mimetype="application/json",
                                  headers={**cors_headers_for_origin(origin), 'X-Correlation-ID': correlation_id})

    # Rate limiting check (Issue #62)
    # Get client IP (Cloud Run provides real IP in X-Forwarded-For)
    ip_address = req.headers.get('X-Forwarded-For', req.remote_addr)
    if ip_address:
        ip_address = ip_address.split(',')[0].strip()

    if not check_rate_limit(ip_address):
        log_json("warn", "Auth rate limited", ip=ip_address, correlationId=correlation_id)
        origin = get_allowed_origin(req.headers.get('Origin'))
        return https_fn.Response(json.dumps({"error": "RATE_LIMITED", "message": "Too many authentication attempts. Please try again in 10 minutes.", "correlationId": correlation_id}),
                                  status=429,
                                  mimetype="application/json",
                                  headers={**cors_headers_for_origin(origin), 'Retry-After': '600', 'X-Correlation-ID': correlation_id})

    # Validate incoming data
    try:
        data = req.get_json()
        kenni_auth_code = data.get('kenniAuthCode')
        pkce_code_verifier = data.get('pkceCodeVerifier')

        # Input validation (Issue #64)
        validate_auth_input(kenni_auth_code, pkce_code_verifier)

    except ValueError as e:
        # Input validation failed - Log details server-side, return generic message
        log_json("info", "Auth input validation failed", error=str(e), correlationId=correlation_id)
        origin = get_allowed_origin(req.headers.get('Origin'))
        return https_fn.Response(
            json.dumps({"error": "INVALID_INPUT", "message": "Invalid request parameters", "correlationId": correlation_id}),
            status=400,
            mimetype="application/json",
            headers={**cors_headers_for_origin(origin), 'X-Correlation-ID': correlation_id},
        )
    except Exception as e:
        # JSON parsing or unexpected input shape
        log_json("info", "Invalid JSON payload", error=str(e), correlationId=correlation_id)
        origin = get_allowed_origin(req.headers.get('Origin'))
        return https_fn.Response(
            json.dumps({"error": "INVALID_JSON", "message": "Invalid JSON", "correlationId": correlation_id}),
            status=400,
            mimetype="application/json",
            headers={**cors_headers_for_origin(origin), 'X-Correlation-ID': correlation_id},
        )

    # Main OAuth flow
    try:
        # Get Kenni.is configuration from environment
        issuer_url = os.environ.get("KENNI_IS_ISSUER_URL")
        client_id = os.environ.get("KENNI_IS_CLIENT_ID")
        
        # Try multiple sources for the client secret
        # 1. Standard env var (KENNI_IS_CLIENT_SECRET)
        # 2. Firebase/Cloud Run default env var (kenni-client-secret)
        # 3. File mount (/run/secrets/kenni-client-secret)
        client_secret = os.environ.get("KENNI_IS_CLIENT_SECRET") or os.environ.get("kenni-client-secret")
        
        # Fallback: Try to read secret from file (Firebase Functions / Cloud Run mount)
        if not client_secret and os.path.exists("/run/secrets/kenni-client-secret"):
            try:
                with open("/run/secrets/kenni-client-secret", "r") as f:
                    client_secret = f.read().strip()
            except Exception as e:
                log_json("warning", "Failed to read secret file", error=str(e), correlationId=correlation_id)

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

        # Normalize phone number to 7 digits (remove hyphen for database storage)
        normalized_phone_num = normalize_phone(phone_number) if phone_number else None

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
            if normalized_phone_num:
                update_data['phoneNumber'] = normalized_phone_num
            if full_name:
                update_data['fullName'] = full_name
            # Store user agent for login audit
            user_agent = req.headers.get('User-Agent')
            if user_agent:
                update_data['lastUserAgent'] = user_agent[:500]  # Limit length

            users_ref.document(auth_uid).update(update_data)
        else:
            # Create new user (with race condition handling)
            log_json("info", "Creating new user", kennitala=f"{normalized_kennitala[:7]}****", correlationId=correlation_id)

            try:
                new_user = auth.create_user(display_name=full_name)
                auth_uid = new_user.uid
                log_json("info", "Created Firebase Auth user", uid=auth_uid, correlationId=correlation_id)

                # Create user profile in Firestore
                user_agent = req.headers.get('User-Agent')
                user_profile_data = {
                    'fullName': full_name,
                    'kennitala': normalized_kennitala,
                    'email': email,
                    'phoneNumber': normalized_phone_num,
                    'photoURL': None,
                    'isMember': False,  # Will be verified separately
                    'createdAt': firestore.SERVER_TIMESTAMP,
                    'lastLogin': firestore.SERVER_TIMESTAMP,
                    'lastUserAgent': user_agent[:500] if user_agent else None
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

        # Step 4b: Link member document to Firebase UID (bidirectional linking)
        # This enables direct lookup from /members/{kennitala} → /users/{uid}
        try:
            member_ref = db.collection('members').document(normalized_kennitala)
            member_doc = member_ref.get()
            if member_doc.exists:
                member_ref.update({
                    'metadata.firebase_uid': auth_uid,
                    'metadata.firebase_uid_linked_at': firestore.SERVER_TIMESTAMP
                })
                log_json("info", "Linked member to Firebase UID",
                         kennitala=f"{normalized_kennitala[:6]}****",
                         uid=auth_uid, correlationId=correlation_id)
            else:
                log_json("debug", "No member document found to link",
                         kennitala=f"{normalized_kennitala[:6]}****",
                         correlationId=correlation_id)
        except Exception as e:
            # Non-fatal - log and continue (user can still log in)
            log_json("warn", "Failed to link member to Firebase UID",
                     error=str(e), kennitala=f"{normalized_kennitala[:6]}****",
                     correlationId=correlation_id)

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
        if normalized_phone_num:
            custom_claims['phoneNumber'] = normalized_phone_num

        # Persist merged claims back to Firebase Auth (ensures roles survive future logins)
        try:
            auth.set_custom_user_claims(auth_uid, custom_claims)
            log_json("debug", "Persisted custom claims to Firebase Auth", uid=auth_uid, claims=sanitize_fields(custom_claims))
        except Exception as e:
            log_json("error", "Failed to persist custom claims to Firebase Auth", error=str(e), uid=auth_uid)
            # Continue anyway - custom token will still work for this session

        log_json("debug", "Creating custom token with claims", uid=auth_uid, claims=sanitize_fields(custom_claims))
        custom_token = auth.create_custom_token(auth_uid, developer_claims=custom_claims)

        # Step 7: Return custom token to frontend
        response_data = {
            "customToken": custom_token.decode("utf-8"),
            "uid": auth_uid
        }

        log_json("info", "Created custom token", uid=auth_uid, correlationId=correlation_id)
        origin = get_allowed_origin(req.headers.get('Origin'))
        # Ensure token-bearing responses are not cached by browsers or intermediaries
        headers = {**cors_headers_for_origin(origin), 'X-Correlation-ID': correlation_id, 'Cache-Control': 'no-store, no-cache, must-revalidate, private, max-age=0'}
        return https_fn.Response(
            json.dumps(response_data),
            status=200,
            mimetype="application/json",
            headers=headers,
        )

    except requests.exceptions.HTTPError as e:
        body = e.response.text if getattr(e, 'response', None) else 'No response'
        log_json("error", "HTTP error during token exchange", error=str(e), responseBody=sanitize_fields({'body': body})['body'], correlationId=correlation_id)
        origin = get_allowed_origin(req.headers.get('Origin'))
        headers = {**cors_headers_for_origin(origin), 'X-Correlation-ID': correlation_id, 'Cache-Control': 'no-store, no-cache, must-revalidate, private, max-age=0'}
        return https_fn.Response(
            json.dumps({"error": "TOKEN_EXCHANGE_FAILED", "message": "Token exchange failed", "correlationId": correlation_id}),
            status=502,
            mimetype="application/json",
            headers=headers
        )
    except Exception as e:
        # Detect configuration error and surface missing env vars explicitly
        msg = str(e)
        origin = get_allowed_origin(req.headers.get('Origin'))
        headers = {**cors_headers_for_origin(origin), 'X-Correlation-ID': correlation_id, 'Cache-Control': 'no-store, no-cache, must-revalidate, private, max-age=0'}
        if msg.startswith("Missing environment variables:"):
            # Security: Log full error server-side but return generic message to client
            log_json("error", "Configuration error in handleKenniAuth", error=msg, correlationId=correlation_id)
            return https_fn.Response(
                json.dumps({
                    "error": "CONFIG_MISSING",
                    "message": "Service configuration error. Please contact support.",
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
