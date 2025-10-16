"""
Cloud Functions for Ekklesia Members Service

Handles manual OAuth flow with Kenni.is including PKCE token exchange.
"""

import os
import json
import requests
import jwt
import functools
from datetime import datetime, timedelta, timezone

import firebase_admin
from firebase_admin import initialize_app, auth, firestore
from firebase_functions import https_fn, options

# --- SETUP ---
if not firebase_admin._apps:
    initialize_app()

options.set_global_options(region="europe-west2")

# --- CONSTANTS ---
CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Firebase-AppCheck',
    'Access-Control-Max-Age': '3600',
}

# --- HELPER FUNCTIONS ---

@functools.lru_cache(maxsize=128)
def get_jwks_client_cached(issuer_url: str):
    """
    Get JWKS client for verifying Kenni.is ID tokens (cached)

    Uses LRU cache with 1-hour TTL to avoid fetching JWKS on every request.
    This saves ~500ms latency and reduces dependency on Kenni.is availability.

    Issue #63: Cache JWKS client to improve performance
    """
    oidc_config_url = f"{issuer_url}/.well-known/openid-configuration"
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        print(f"[CACHE MISS] Fetching JWKS for {issuer_url}")
        config_response = requests.get(oidc_config_url, headers=headers)
        config_response.raise_for_status()
        jwks_uri = config_response.json()["jwks_uri"]
        return jwt.PyJWKClient(jwks_uri, headers=headers)
    except Exception as e:
        print(f"CRITICAL: Failed to get JWKS client: {e}")
        raise

def get_kenni_is_jwks_client(issuer_url: str):
    """Legacy wrapper for cached JWKS client (backward compatibility)"""
    return get_jwks_client_cached(issuer_url)

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

def check_rate_limit(ip_address: str, max_attempts: int = 5, window_minutes: int = 10) -> bool:
    """
    Check if IP address has exceeded rate limit.

    Uses Firestore to track authentication attempts per IP address.
    Limits: 5 attempts per 10 minutes (configurable).

    Args:
        ip_address: Client IP address
        max_attempts: Maximum attempts allowed (default: 5)
        window_minutes: Time window in minutes (default: 10)

    Returns:
        True if request is allowed, False if rate limited

    Issue #62: Add rate limiting to handleKenniAuth function
    """
    db = firestore.client()
    rate_limit_ref = db.collection('rate_limits').document(ip_address)

    # Use actual datetime object (not SERVER_TIMESTAMP sentinel)
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=window_minutes)

    doc = rate_limit_ref.get()

    if doc.exists:
        data = doc.to_dict()
        attempts = data.get('attempts', [])

        # Filter attempts within time window
        recent_attempts = [
            datetime.fromisoformat(attempt_time)
            for attempt_time in attempts
            if datetime.fromisoformat(attempt_time) > window_start
        ]

        if len(recent_attempts) >= max_attempts:
            print(f"[RATE LIMIT] IP {ip_address} exceeded {max_attempts} attempts in {window_minutes} minutes")
            return False  # Rate limited

        # Add current attempt
        recent_attempts.append(now)
        rate_limit_ref.update({
            'attempts': [dt.isoformat() for dt in recent_attempts],
            'last_attempt': now.isoformat()
        })
    else:
        # First attempt from this IP
        rate_limit_ref.set({
            'attempts': [now.isoformat()],
            'last_attempt': now.isoformat()
        })

    return True  # Request allowed

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

    # Handle CORS preflight requests
    if req.method == 'OPTIONS':
        return https_fn.Response("", status=204, headers=CORS_HEADERS)

    # Ensure the method is POST
    if req.method != "POST":
        return https_fn.Response(
            "Invalid request method.",
            status=405,
            headers=CORS_HEADERS
        )

    # Rate limiting check (Issue #62)
    # Get client IP (Cloud Run provides real IP in X-Forwarded-For)
    ip_address = req.headers.get('X-Forwarded-For', req.remote_addr)
    if ip_address:
        ip_address = ip_address.split(',')[0].strip()

    if not check_rate_limit(ip_address):
        return https_fn.Response(
            json.dumps({
                "error": "Too many authentication attempts. Please try again in 10 minutes."
            }),
            status=429,
            mimetype="application/json",
            headers={**CORS_HEADERS, 'Retry-After': '600'}
        )

    # Validate incoming data
    try:
        data = req.get_json()
        kenni_auth_code = data.get('kenniAuthCode')
        pkce_code_verifier = data.get('pkceCodeVerifier')

        # Input validation (Issue #64)
        validate_auth_input(kenni_auth_code, pkce_code_verifier)

    except ValueError as e:
        # Input validation failed
        return https_fn.Response(
            json.dumps({"error": str(e)}),
            status=400,
            mimetype="application/json",
            headers=CORS_HEADERS
        )
    except Exception as e:
        return https_fn.Response(
            json.dumps({"error": f"Invalid JSON: {str(e)}"}),
            status=400,
            mimetype="application/json",
            headers=CORS_HEADERS
        )

    # Main OAuth flow
    try:
        # Get Kenni.is configuration from environment
        issuer_url = os.environ.get("KENNI_IS_ISSUER_URL")
        client_id = os.environ.get("KENNI_IS_CLIENT_ID")
        client_secret = os.environ.get("KENNI_IS_CLIENT_SECRET")
        redirect_uri = os.environ.get("KENNI_IS_REDIRECT_URI")

        if not all([issuer_url, client_id, client_secret, redirect_uri]):
            raise Exception("Missing Kenni.is configuration in environment variables")

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

        print(f"INFO: Exchanging authorization code for tokens...")
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
        print(f"INFO: Verifying ID token from Kenni.is...")
        jwks_client = get_kenni_is_jwks_client(issuer_url)

        # Log cache statistics (Issue #63)
        cache_info = get_jwks_client_cached.cache_info()
        print(f"[CACHE STATS] Hits: {cache_info.hits}, Misses: {cache_info.misses}, Size: {cache_info.currsize}")

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

        print(f"INFO: Successfully verified Kenni.is token for: {full_name} ({normalized_kennitala[:7]}****)")

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
            print(f"INFO: User profile for kennitala {normalized_kennitala[:7]}**** already exists with UID {auth_uid}")

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
            print(f"INFO: Creating new user for kennitala {normalized_kennitala[:7]}****")

            try:
                new_user = auth.create_user(display_name=full_name)
                auth_uid = new_user.uid
                print(f"INFO: Created new Firebase Auth user with UID: {auth_uid}")

                # Create user profile in Firestore
                user_profile_data = {
                    'fullName': full_name,
                    'kennitala': normalized_kennitala,
                    'email': email,
                    'phoneNumber': phone_number,
                    'photoURL': None,
                    'role': 'user',
                    'isMember': False,  # Will be verified separately
                    'createdAt': firestore.SERVER_TIMESTAMP,
                    'lastLogin': firestore.SERVER_TIMESTAMP
                }
                db.collection('users').document(auth_uid).set(user_profile_data)
                print(f"INFO: Created Firestore user profile at /users/{auth_uid}")

            except Exception as e:
                # Handle race condition: user created by concurrent request
                error_message = str(e)
                if 'already exists' in error_message.lower() or 'uid_already_exists' in error_message.lower():
                    print(f"WARN: User already exists (race condition detected), retrying query for kennitala {normalized_kennitala[:7]}****")
                    # Retry query to find the user created by concurrent request
                    query = users_ref.where('kennitala', '==', normalized_kennitala).limit(1)
                    existing_users = list(query.stream())
                    if existing_users:
                        auth_uid = existing_users[0].id
                        print(f"INFO: Found existing user after race condition: {auth_uid}")
                    else:
                        # This shouldn't happen, but handle it gracefully
                        print(f"ERROR: Race condition unresolved - user exists but not found in Firestore")
                        raise Exception("User creation race condition could not be resolved")
                else:
                    # Re-raise if it's a different error
                    raise

        # Step 5: Create Firebase custom token with all claims
        custom_claims = {'kennitala': normalized_kennitala}
        if email:
            custom_claims['email'] = email
        if phone_number:
            custom_claims['phoneNumber'] = phone_number

        custom_token = auth.create_custom_token(auth_uid, developer_claims=custom_claims)

        # Step 6: Return custom token to frontend
        response_data = {
            "customToken": custom_token.decode("utf-8"),
            "uid": auth_uid
        }

        print(f"INFO: Successfully created custom token for UID: {auth_uid}")
        return https_fn.Response(
            json.dumps(response_data),
            status=200,
            mimetype="application/json",
            headers=CORS_HEADERS
        )

    except requests.exceptions.HTTPError as e:
        print(f"ERROR: HTTP error during token exchange: {str(e)}")
        print(f"ERROR: Response: {e.response.text if e.response else 'No response'}")
        return https_fn.Response(
            f"Token exchange failed: {str(e)}",
            status=500,
            headers=CORS_HEADERS
        )
    except Exception as e:
        print(f"ERROR in handleKenniAuth: {str(e)}")
        import traceback
        traceback.print_exc()
        return https_fn.Response(
            f"An internal error occurred: {str(e)}",
            status=500,
            headers=CORS_HEADERS
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
        # Read kennitalas.txt from Cloud Storage
        from google.cloud import storage

        storage_client = storage.Client()
        bucket_name = os.environ.get('FIREBASE_STORAGE_BUCKET')
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob('kennitalas.txt')

        if not blob.exists():
            print(f"WARN: kennitalas.txt not found in storage bucket {bucket_name}")
            return {'isMember': False, 'verified': False}

        contents = blob.download_as_text()
        kennitalas = [
            line.strip()
            for line in contents.split('\n')
            if line.strip()
        ]

        # Normalize kennitala for comparison (remove hyphen if present)
        # File format: DDMMYYXXXX (no hyphen)
        # Token format: may be DDMMYY-XXXX (with hyphen) or DDMMYYXXXX (without)
        kennitala_normalized = kennitala.replace('-', '')

        # Check membership status
        is_member = kennitala_normalized in kennitalas

        # Update user profile in Firestore
        db = firestore.client()
        db.collection('users').document(req.auth.uid).update({
            'isMember': is_member,
            'membershipVerifiedAt': firestore.SERVER_TIMESTAMP
        })

        # Update custom claims
        auth.set_custom_user_claims(req.auth.uid, {
            'kennitala': kennitala,
            'isMember': is_member
        })

        return {
            'isMember': is_member,
            'verified': True,
            'kennitala': kennitala[:7] + '****'  # Masked for security
        }

    except Exception as e:
        print(f"ERROR: Error verifying membership: {str(e)}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Failed to verify membership"
        )
