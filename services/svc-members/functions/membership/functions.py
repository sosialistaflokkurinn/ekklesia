"""
Membership management Cloud Functions for Ekklesia Members Service

Handles membership verification, sync operations, and profile updates.
"""

from datetime import datetime, timezone
from typing import Dict, Any
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import re

from firebase_admin import auth, firestore
from firebase_functions import https_fn, options
from util_logging import log_json
from shared.validators import normalize_kennitala, normalize_phone
from shared.rate_limit import check_uid_rate_limit
from db_members import get_member_by_kennitala

# Security: Input validation limits
MAX_NAME_LENGTH = 100
MAX_EMAIL_LENGTH = 254
MAX_PHONE_LENGTH = 20
MAX_ADDRESS_FIELD_LENGTH = 200
MAX_ADDRESSES = 5
from django_api import (
    update_django_member, update_django_address,
    get_django_api_token, DJANGO_API_BASE_URL
)
import requests


def verifyMembership_handler(req: https_fn.CallableRequest) -> dict:
    """
    Verify user membership status

    Callable function to check if a user's kennitala is in the membership list.
    Reads from Cloud SQL (Django database) - the single source of truth.
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
        # Cloud SQL migration: Read membership status from PostgreSQL
        from db_members import get_membership_status

        # Normalize kennitala (remove hyphen if present)
        kennitala_normalized = normalize_kennitala(kennitala)

        # Query Cloud SQL for membership status
        member_status = get_membership_status(kennitala_normalized)

        is_member = member_status['is_member']
        membership_status = member_status['status']
        fees_paid = member_status['fees_paid']

        # Audit log for membership verification
        if member_status['status'] != 'not_found':
            log_json("info", "Member lookup successful (Cloud SQL)",
                     eventType="membership_verification",
                     kennitalaLast4=kennitala[-4:],  # GDPR: only last 4 digits
                     status=membership_status,
                     fees_paid=fees_paid,
                     isMember=is_member,
                     uid=req.auth.uid)
        else:
            log_json("info", "Member not found in Cloud SQL",
                     eventType="membership_verification",
                     kennitalaLast4=kennitala[-4:],  # GDPR: only last 4 digits
                     isMember=False,
                     uid=req.auth.uid)

        # Update user profile in Firestore (users collection - not members)
        db = firestore.client()
        db.collection('users').document(req.auth.uid).update({
            'isMember': is_member,
            'membershipStatus': membership_status,
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
            from util_logging import sanitize_fields
            auth.set_custom_user_claims(req.auth.uid, merged_claims)
            log_json("debug", "Persisted merged custom claims after membership verification", uid=req.auth.uid, claims=sanitize_fields(merged_claims))
        except Exception as e:
            log_json("error", "Failed to persist custom claims during membership verification", error=str(e), uid=req.auth.uid)

        return {
            'isMember': is_member,
            'membershipStatus': membership_status,  # 'active', 'unpaid', 'inactive', or 'not_found'
            'feesPaid': fees_paid,
            'verified': True,
            'kennitala': kennitala[:7] + '****'  # Masked for security
        }

    except Exception as e:
        log_json("error", "Error verifying membership", error=str(e))
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Failed to verify membership"
        )


def updatememberprofile_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
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
                'phone': str (optional),
                'reachable': bool (optional),
                'groupable': bool (optional),
                'gender': int (optional) - 1=male, 2=female, 3=other,
                'birthday': str (optional) - ISO 8601 date string (YYYY-MM-DD),
                'addresses': array (optional) - Array of address objects with is_default flag
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

    # Security: Rate limit profile updates (5 per 10 minutes per user)
    if not check_uid_rate_limit(req.auth.uid, "profile_update", max_attempts=5, window_minutes=10):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.RESOURCE_EXHAUSTED,
            message="Rate limit exceeded. Maximum 5 profile updates per 10 minutes."
        )

    # Get request data
    kennitala = req.data.get('kennitala')
    updates = req.data.get('updates', {})

    if not kennitala:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="kennitala is required"
        )

    # Security: Validate input field lengths and formats
    def validate_string_field(value, field_name, max_length):
        if value is None:
            return
        if not isinstance(value, str):
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message=f"{field_name} must be a string"
            )
        if len(value) > max_length:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message=f"{field_name} exceeds maximum length of {max_length}"
            )

    validate_string_field(updates.get('name'), 'name', MAX_NAME_LENGTH)
    validate_string_field(updates.get('email'), 'email', MAX_EMAIL_LENGTH)
    validate_string_field(updates.get('phone'), 'phone', MAX_PHONE_LENGTH)

    # Validate email format if provided
    if updates.get('email'):
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, updates['email']):
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message="Invalid email format"
            )

    # Validate addresses if provided
    if 'addresses' in updates:
        addresses = updates['addresses']
        if not isinstance(addresses, list):
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message="addresses must be a list"
            )
        if len(addresses) > MAX_ADDRESSES:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message=f"Maximum {MAX_ADDRESSES} addresses allowed"
            )
        for addr in addresses:
            if not isinstance(addr, dict):
                raise https_fn.HttpsError(
                    code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                    message="Each address must be an object"
                )
            # Validate string fields (number and postal_code can be int or str)
            for field in ['street', 'city', 'country']:
                validate_string_field(addr.get(field), f'address.{field}', MAX_ADDRESS_FIELD_LENGTH)
            # letter is optional string
            if addr.get('letter'):
                validate_string_field(addr.get('letter'), 'address.letter', 10)
            # number and postal_code can be int or str - validate as string after conversion
            for field in ['number', 'postal_code']:
                val = addr.get(field)
                if val is not None:
                    str_val = str(val)
                    if len(str_val) > MAX_ADDRESS_FIELD_LENGTH:
                        raise https_fn.HttpsError(
                            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                            message=f"address.{field} exceeds maximum length"
                        )

    # Check if user has admin/superuser role (can update any profile)
    user_roles = req.auth.token.get('roles', [])
    is_admin = 'admin' in user_roles or 'superuser' in user_roles

    # Verify user is updating their own profile OR is an admin
    # Normalize both kennitalas to same format (no hyphens) for comparison
    user_kennitala = req.auth.token.get('kennitala', '').replace('-', '')
    request_kennitala = kennitala.replace('-', '')
    if user_kennitala != request_kennitala and not is_admin:
        log_json("warn", "Unauthorized profile update attempt",
                 uid=req.auth.uid,
                 requested_kennitala=f"{kennitala[:6]}****",
                 user_kennitala=f"{user_kennitala[:6]}****")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message="You can only update your own profile"
        )

    # Log admin action if updating another user's profile
    if user_kennitala != request_kennitala and is_admin:
        log_json("info", "Admin updating another member's profile",
                 admin_uid=req.auth.uid,
                 admin_kennitala=f"{user_kennitala[:6]}****",
                 target_kennitala=f"{request_kennitala[:6]}****",
                 roles=user_roles)

    log_json("info", "Profile update initiated",
             uid=req.auth.uid,
             kennitala=f"{kennitala[:6]}****",
             fields=list(updates.keys()))

    try:
        # Get Django member ID from Firestore (faster and more reliable than Django API search)
        # Django API doesn't support ?ssn= filter, so we use Firestore lookup
        kennitala_no_hyphen = kennitala.replace('-', '')

        log_json("debug", "Looking up member in Cloud SQL",
                 uid=req.auth.uid,
                 kennitala=f"{kennitala_no_hyphen[:6]}****")

        # Get member from Cloud SQL (source of truth)
        member_data = get_member_by_kennitala(kennitala_no_hyphen)

        if not member_data:
            log_json("error", "Member not found in Cloud SQL",
                     uid=req.auth.uid,
                     kennitala=f"{kennitala_no_hyphen[:6]}****")
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Member not found in system"
            )

        django_id = member_data.get('django_id')

        log_json("debug", "Found member in Cloud SQL",
                 uid=req.auth.uid,
                 django_id=django_id,
                 kennitala=f"{kennitala_no_hyphen[:6]}****")

        # Build Django update payload
        django_updates = {}
        if 'name' in updates:
            django_updates['name'] = updates['name']
        if 'email' in updates:
            # Email is in contact_info nested object
            django_updates['contact_info'] = {'email': updates['email']}
        if 'phone' in updates:
            # Phone is in contact_info nested object
            # IMPORTANT: Django expects phone WITHOUT hyphen (7 digits only)
            phone_digits = ''.join(c for c in updates['phone'] if c.isdigit())
            # Remove country code if present
            if phone_digits.startswith('354') and len(phone_digits) == 10:
                phone_digits = phone_digits[3:]  # Keep only 7 local digits
            if 'contact_info' not in django_updates:
                django_updates['contact_info'] = {}
            django_updates['contact_info']['phone'] = phone_digits

        # Handle reachable/groupable preferences
        if 'reachable' in updates:
            django_updates['reachable'] = updates['reachable']
        if 'groupable' in updates:
            django_updates['groupable'] = updates['groupable']

        # Handle gender and birthday
        if 'gender' in updates:
            django_updates['gender'] = updates['gender']
        if 'birthday' in updates:
            django_updates['birthday'] = updates['birthday']

        # Handle addresses - find default Iceland address and sync to Django NewLocalAddress
        address_sync_result = None
        address_sync_needed = False
        default_iceland_address = None
        
        if 'addresses' in updates and updates['addresses']:
            addresses = updates['addresses']
            # Find the default Iceland address for Django sync
            for addr in addresses:
                if addr.get('country', 'IS') == 'IS':
                    if addr.get('is_default', False):
                        default_iceland_address = addr
                        break
            # If no default, use first Iceland address
            if not default_iceland_address:
                for addr in addresses:
                    if addr.get('country', 'IS') == 'IS':
                        default_iceland_address = addr
                        break
            address_sync_needed = default_iceland_address is not None

        # Determine if profile PATCH is needed (skip if only address changes)
        # Also skip Django sync if member has no django_id (Firestore-only member)
        profile_patch_needed = bool(django_updates) and django_id is not None

        # OPTIMIZATION: Run Django API calls in parallel using ThreadPoolExecutor
        # This saves ~2 seconds by not waiting for address sync before profile update
        profile_sync_success = False
        profile_sync_error = None
        updated_member = None

        # Skip Django sync entirely if no django_id
        if not django_id:
            log_json("info", "Skipping Django sync - Firestore-only member",
                     uid=req.auth.uid,
                     kennitala=f"{kennitala_no_hyphen[:6]}****")
            address_sync_needed = False  # Also skip address sync
            profile_sync_success = True  # Mark as success since there's nothing to sync

        def do_address_sync():
            """Worker function for address sync"""
            return update_django_address(
                kennitala=kennitala_no_hyphen,
                address_data={
                    'street': default_iceland_address.get('street', ''),
                    'number': default_iceland_address.get('number', ''),
                    'letter': default_iceland_address.get('letter', ''),
                    'postal_code': default_iceland_address.get('postal_code', ''),
                    'city': default_iceland_address.get('city', ''),
                    'country': 'IS'
                }
            )

        def do_profile_update():
            """Worker function for profile PATCH"""
            return update_django_member(django_id, django_updates)

        # Execute Django calls in parallel (only if django_id exists)
        if django_id:
            with ThreadPoolExecutor(max_workers=2) as executor:
                futures = {}

                if address_sync_needed:
                    futures['address'] = executor.submit(do_address_sync)

                if profile_patch_needed:
                    futures['profile'] = executor.submit(do_profile_update)

                # Wait for all futures to complete
                for future_name, future in futures.items():
                    try:
                        result = future.result(timeout=35)  # Slightly longer than individual timeouts

                        if future_name == 'address':
                            address_sync_result = result
                            log_json("info", "Address synced to Django NewLocalAddress",
                                     uid=req.auth.uid,
                                     street=default_iceland_address.get('street', ''),
                                     postal=default_iceland_address.get('postal_code', ''),
                                     map_address_id=address_sync_result.get('map_address_id'),
                                     address_linked=address_sync_result.get('address_linked'))

                        elif future_name == 'profile':
                            updated_member = result
                            profile_sync_success = True
                            log_json("info", "Profile updated successfully in Django",
                                     uid=req.auth.uid,
                                     django_id=django_id,
                                     kennitala=f"{kennitala[:6]}****")

                    except Exception as e:
                        error_str = str(e)
                        if future_name == 'address':
                            # Address sync failures are non-fatal
                            log_json("warn", "Django address sync failed",
                                     uid=req.auth.uid,
                                     error=error_str)
                            address_sync_result = {'success': False, 'error': error_str}
                        else:
                            # Check if this is a 404 (member doesn't exist in Django)
                            if '404' in error_str or 'No Comrade matches' in error_str:
                                log_json("warn", "Member not found in Django - continuing with Firestore-only update",
                                         uid=req.auth.uid,
                                         django_id=django_id,
                                         error=error_str)
                                profile_sync_success = True  # Allow Firestore update to proceed
                            else:
                                # Other profile sync failures are fatal
                                profile_sync_error = error_str
                                log_json("error", "Django profile update failed",
                                         uid=req.auth.uid,
                                         django_id=django_id,
                                         error=profile_sync_error)

        # If profile update was needed but failed (and not a 404), raise error
        if profile_patch_needed and not profile_sync_success:
            raise Exception(profile_sync_error or "Profile update failed")

        # Note: Firestore /members collection updates removed - Cloud SQL is source of truth
        log_json("info", "Profile updated successfully",
                 uid=req.auth.uid,
                 kennitala=f"{kennitala[:6]}****",
                 updated_fields=list(updates.keys()))

        # Return fresh data from Django (or minimal response if only address changed)
        return {
            'success': True,
            'django_id': django_id,
            'updated_fields': list(updates.keys()),
            'member': updated_member or member_data  # Use cached data if no profile PATCH
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


def soft_delete_self_handler(req: https_fn.CallableRequest) -> dict:
    """
    Soft delete the authenticated user's own membership.

    This allows a member to deactivate their own account:
    1. Sets membership.status to 'inactive' in Firestore
    2. Sets metadata.deleted_at timestamp
    3. Disables Firebase Auth account
    4. Syncs soft delete to Django backend

    The member can later reactivate their account via reactivate_self.

    Requires authentication (must be the member themselves).

    Args:
        req.data: {
            'confirmation': str - Must be 'EYÐA' to confirm
        }

    Returns:
        Dict with success status
    """
    # Verify authentication
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Authentication required"
        )

    uid = req.auth.uid
    kennitala = req.auth.token.get('kennitala')

    if not kennitala:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="No kennitala found for user"
        )

    # Verify confirmation text
    confirmation = req.data.get('confirmation', '') if req.data else ''
    if confirmation != 'EYÐA':
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Confirmation text must be 'EYÐA'"
        )

    kennitala_normalized = normalize_kennitala(kennitala)
    deleted_at = datetime.now(timezone.utc)

    log_json("info", "Soft delete initiated by user",
             uid=uid,
             kennitala=f"{kennitala_normalized[:6]}****")

    try:
        # Verify member exists in Cloud SQL (source of truth)
        member_data = get_member_by_kennitala(kennitala_normalized)

        if not member_data:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Member not found"
            )

        log_json("info", "Member found, proceeding with soft delete",
                 uid=uid,
                 kennitala=f"{kennitala_normalized[:6]}****")

        # 2. Disable Firebase Auth account
        try:
            auth.update_user(uid, disabled=True)
            log_json("info", "Firebase Auth disabled",
                     uid=uid)
        except Exception as auth_error:
            log_json("error", "Failed to disable Firebase Auth",
                     uid=uid,
                     error=str(auth_error))
            # Continue anyway - Firestore is source of truth

        # 3. Sync to Django
        try:
            django_token = get_django_api_token()
            response = requests.post(
                f"{DJANGO_API_BASE_URL}/api/sync/soft-delete/",
                json={
                    'kennitala': kennitala_normalized,
                    'deleted_at': deleted_at.isoformat()
                },
                headers={
                    'Authorization': f'Token {django_token}',
                    'Content-Type': 'application/json'
                },
                timeout=30
            )

            if response.status_code == 200:
                log_json("info", "Django soft delete sync successful",
                         uid=uid,
                         kennitala=f"{kennitala_normalized[:6]}****")
            else:
                log_json("warn", "Django soft delete sync failed",
                         uid=uid,
                         status_code=response.status_code,
                         response=response.text[:200])
        except Exception as django_error:
            log_json("error", "Django sync failed for soft delete",
                     uid=uid,
                     error=str(django_error))
            # Continue - Firestore update succeeded

        # 4. Update custom claims to reflect inactive status
        try:
            existing_claims = auth.get_user(uid).custom_claims or {}
            merged_claims = {**existing_claims, 'isMember': False}
            auth.set_custom_user_claims(uid, merged_claims)
        except Exception as claims_error:
            log_json("warn", "Failed to update custom claims",
                     uid=uid,
                     error=str(claims_error))

        log_json("info", "Soft delete completed successfully",
                 uid=uid,
                 kennitala=f"{kennitala_normalized[:6]}****")

        return {
            'success': True,
            'message': 'Aðgangur þinn hefur verið gerður óvirkur',
            'deleted_at': deleted_at.isoformat()
        }

    except https_fn.HttpsError:
        raise
    except Exception as e:
        log_json("error", "Soft delete failed",
                 uid=uid,
                 error=str(e))
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Soft delete failed: {str(e)}"
        )


def reactivate_self_handler(req: https_fn.CallableRequest) -> dict:
    """
    Reactivate a soft-deleted membership.

    This is called from a special reactivation page after the user
    authenticates via Kenni.is. The flow:
    1. User tries to log in, gets error (Auth disabled)
    2. User clicks "Endurvakna aðgang"
    3. User authenticates via Kenni.is
    4. Frontend calls this function with kennitala
    5. This function re-enables the account

    The function must verify the kennitala matches the request.

    Args:
        req.data: {
            'kennitala': str - Kennitala from Kenni.is authentication
        }

    Returns:
        Dict with success status and new Firebase custom token
    """
    # Note: This endpoint may be called without Firebase Auth
    # because the user's account is disabled. We verify via kennitala.

    kennitala = req.data.get('kennitala', '') if req.data else ''

    if not kennitala:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Kennitala is required"
        )

    kennitala_normalized = normalize_kennitala(kennitala)

    log_json("info", "Reactivation initiated",
             kennitala=f"{kennitala_normalized[:6]}****")

    try:
        # Get member from Cloud SQL (source of truth)
        member_data = get_member_by_kennitala(kennitala_normalized)

        if not member_data:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Member not found"
            )

        # Verify member was soft-deleted (check Cloud SQL deleted_at)
        deleted_at = member_data.get('membership', {}).get('deleted_at')
        if not deleted_at:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
                message="Account is not deactivated"
            )

        # Get Firebase UID from /users collection by querying for kennitala
        db = firestore.client()
        users_query = db.collection('users').where('kennitala', '==', kennitala_normalized).limit(1).stream()
        firebase_uid = None
        for user_doc in users_query:
            firebase_uid = user_doc.id
            break

        if not firebase_uid:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
                message="No Firebase account linked"
            )

        # 1. Re-enable Firebase Auth
        try:
            auth.update_user(firebase_uid, disabled=False)
            log_json("info", "Firebase Auth re-enabled",
                     uid=firebase_uid)
        except Exception as auth_error:
            log_json("error", "Failed to re-enable Firebase Auth",
                     uid=firebase_uid,
                     error=str(auth_error))
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INTERNAL,
                message="Failed to re-enable account"
            )

        # Note: Firestore /members no longer exists - Cloud SQL is source of truth
        log_json("info", "Proceeding with Django reactivation",
                 kennitala=f"{kennitala_normalized[:6]}****")

        # 3. Sync to Django
        try:
            django_token = get_django_api_token()
            response = requests.post(
                f"{DJANGO_API_BASE_URL}/api/sync/reactivate/",
                json={'kennitala': kennitala_normalized},
                headers={
                    'Authorization': f'Token {django_token}',
                    'Content-Type': 'application/json'
                },
                timeout=30
            )

            if response.status_code == 200:
                log_json("info", "Django reactivation sync successful",
                         kennitala=f"{kennitala_normalized[:6]}****")
            else:
                log_json("warn", "Django reactivation sync failed",
                         status_code=response.status_code,
                         response=response.text[:200])
        except Exception as django_error:
            log_json("error", "Django sync failed for reactivation",
                     error=str(django_error))
            # Continue - Firestore and Auth updates succeeded

        # 4. Update custom claims
        try:
            existing_claims = auth.get_user(firebase_uid).custom_claims or {}
            merged_claims = {**existing_claims, 'isMember': True}
            auth.set_custom_user_claims(firebase_uid, merged_claims)
        except Exception as claims_error:
            log_json("warn", "Failed to update custom claims",
                     uid=firebase_uid,
                     error=str(claims_error))

        # 5. Create custom token for immediate login
        try:
            custom_token = auth.create_custom_token(firebase_uid)
            log_json("info", "Custom token created for reactivated user",
                     uid=firebase_uid)
        except Exception as token_error:
            log_json("error", "Failed to create custom token",
                     uid=firebase_uid,
                     error=str(token_error))
            custom_token = None

        log_json("info", "Reactivation completed successfully",
                 kennitala=f"{kennitala_normalized[:6]}****",
                 uid=firebase_uid)

        return {
            'success': True,
            'message': 'Aðgangur þinn hefur verið endurvakinn',
            'customToken': custom_token.decode('utf-8') if custom_token else None
        }

    except https_fn.HttpsError:
        raise
    except Exception as e:
        log_json("error", "Reactivation failed",
                 kennitala=f"{kennitala_normalized[:6]}****",
                 error=str(e))
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Reactivation failed: {str(e)}"
        )
