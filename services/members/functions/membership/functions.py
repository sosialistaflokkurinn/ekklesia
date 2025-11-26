"""
Membership management Cloud Functions for Ekklesia Members Service

Handles membership verification, sync operations, and profile updates.
"""

from datetime import datetime, timezone
from typing import Dict, Any
import json

from firebase_admin import auth, firestore
from firebase_functions import https_fn, options
from utils_logging import log_json
from shared.validators import normalize_kennitala, normalize_phone
from sync_members import sync_all_members, create_sync_log, update_django_member, update_django_address
from cleanup_audit_logs import cleanup_old_audit_logs


def verifyMembership_handler(req: https_fn.CallableRequest) -> dict:
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
        kennitala_normalized = normalize_kennitala(kennitala)

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
            from utils_logging import sanitize_fields
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


from shared.auth_helpers import verify_firebase_token
from shared.cors import get_allowed_origin

def syncmembers_handler(req: https_fn.Request) -> https_fn.Response:
    """
    Epic #43: Manual trigger to sync all members from Django to Firestore.

    Requires authentication and 'admin' or 'superuser' role.
    Handles CORS manually to support direct fetch calls.

    Returns:
        Response object with sync statistics
    """
    # Handle CORS
    origin = req.headers.get('Origin')
    allowed_origin = get_allowed_origin(origin)
    headers = {
        'Access-Control-Allow-Origin': allowed_origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '3600'
    }

    if req.method == 'OPTIONS':
        return https_fn.Response(status=204, headers=headers)

    try:
        # Verify authentication
        decoded_token = verify_firebase_token(req)
        uid = decoded_token.get('uid')
        roles = decoded_token.get('roles', [])

        # Verify admin or superuser role
        has_access = 'admin' in roles or 'superuser' in roles
        if not has_access:
            log_json("warn", "Unauthorized sync attempt", uid=uid, roles=roles)
            return https_fn.Response(
                status=403,
                response=json.dumps({'error': "Admin or superuser role required"}),
                headers=headers,
                content_type='application/json'
            )

        log_json("info", "Member sync initiated", uid=uid)

        # Run sync
        stats = sync_all_members()

        # Create sync log
        db = firestore.Client()
        log_id = create_sync_log(db, stats)

        log_json("info", "Member sync completed successfully",
                 uid=uid,
                 stats=stats,
                 log_id=log_id)

        response_data = {
            'result': {  # Wrap in result for Callable compatibility if needed, though we are raw HTTP now
                'success': True,
                'stats': stats,
                'log_id': log_id
            }
        }
        
        return https_fn.Response(
            status=200,
            response=json.dumps(response_data),
            headers=headers,
            content_type='application/json'
        )

    except https_fn.HttpsError as e:
        status_code = 500
        if e.code == https_fn.FunctionsErrorCode.UNAUTHENTICATED:
            status_code = 401
        elif e.code == https_fn.FunctionsErrorCode.PERMISSION_DENIED:
            status_code = 403
        elif e.code == https_fn.FunctionsErrorCode.INVALID_ARGUMENT:
            status_code = 400
        elif e.code == https_fn.FunctionsErrorCode.NOT_FOUND:
            status_code = 404
            
        return https_fn.Response(
            status=status_code,
            response=json.dumps({'error': e.message}),
            headers=headers,
            content_type='application/json'
        )
    except Exception as e:
        log_json("error", "Member sync failed", error=str(e))
        return https_fn.Response(
            status=500,
            response=json.dumps({'error': f"Sync failed: {str(e)}"}),
            headers=headers,
            content_type='application/json'
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

    # Get request data
    kennitala = req.data.get('kennitala')
    updates = req.data.get('updates', {})

    if not kennitala:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="kennitala is required"
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

        log_json("debug", "Looking up member in Firestore",
                 uid=req.auth.uid,
                 kennitala=f"{kennitala_no_hyphen[:6]}****")

        db = firestore.client()
        member_ref = db.collection('members').document(kennitala_no_hyphen)
        member_doc = member_ref.get()

        if not member_doc.exists:
            log_json("error", "Member not found in Firestore",
                     uid=req.auth.uid,
                     kennitala=f"{kennitala_no_hyphen[:6]}****")
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message="Member not found in system"
            )

        member_data = member_doc.to_dict()
        django_id = member_data.get('metadata', {}).get('django_id')

        if not django_id:
            log_json("error", "Django ID missing from Firestore member",
                     uid=req.auth.uid,
                     kennitala=f"{kennitala_no_hyphen[:6]}****")
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INTERNAL,
                message="Member data incomplete - please contact admin"
            )

        log_json("debug", "Found member in Firestore",
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
        if 'addresses' in updates and updates['addresses']:
            addresses = updates['addresses']
            # Find the default Iceland address for Django sync
            default_iceland_address = None
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

            if default_iceland_address:
                # Sync Iceland address to Django via NewLocalAddress system
                try:
                    address_sync_result = update_django_address(
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
                    log_json("info", "Address synced to Django NewLocalAddress",
                             uid=req.auth.uid,
                             street=default_iceland_address.get('street', ''),
                             postal=default_iceland_address.get('postal_code', ''),
                             map_address_id=address_sync_result.get('map_address_id'),
                             address_linked=address_sync_result.get('address_linked'))

                    # Log sync result to Firestore for audit trail
                    sync_log_entry = {
                        'type': 'address_sync',
                        'timestamp': datetime.now(timezone.utc),
                        'source': 'firestore',
                        'target': 'django',
                        'success': address_sync_result.get('success', False),
                        'address': {
                            'street': default_iceland_address.get('street', ''),
                            'number': default_iceland_address.get('number', ''),
                            'postal_code': default_iceland_address.get('postal_code', '')
                        },
                        'django_response': {
                            'map_address_id': address_sync_result.get('map_address_id'),
                            'address_linked': address_sync_result.get('address_linked'),
                            'message': address_sync_result.get('message', '')
                        }
                    }
                    member_ref.collection('syncHistory').add(sync_log_entry)

                except Exception as addr_error:
                    # Log but don't fail - address sync is secondary
                    log_json("warn", "Django address sync failed",
                             uid=req.auth.uid,
                             error=str(addr_error))

                    # Log failed sync to Firestore
                    sync_log_entry = {
                        'type': 'address_sync',
                        'timestamp': datetime.now(timezone.utc),
                        'source': 'firestore',
                        'target': 'django',
                        'success': False,
                        'address': {
                            'street': default_iceland_address.get('street', ''),
                            'number': default_iceland_address.get('number', ''),
                            'postal_code': default_iceland_address.get('postal_code', '')
                        },
                        'error': str(addr_error)
                    }
                    member_ref.collection('syncHistory').add(sync_log_entry)

        # Update Django via API
        profile_sync_success = False
        profile_sync_error = None
        try:
            updated_member = update_django_member(django_id, django_updates)
            profile_sync_success = True

            log_json("info", "Profile updated successfully in Django",
                     uid=req.auth.uid,
                     django_id=django_id,
                     kennitala=f"{kennitala[:6]}****")

            # Log profile sync to Firestore syncHistory (for non-address fields)
            if django_updates:
                profile_sync_entry = {
                    'type': 'profile_sync',
                    'timestamp': datetime.now(timezone.utc),
                    'source': 'firestore',
                    'target': 'django',
                    'success': True,
                    'fields_updated': list(django_updates.keys()),
                    'changes': {
                        k: v for k, v in django_updates.items()
                        if k not in ['contact_info']  # Don't log sensitive contact details
                    }
                }
                # Add contact_info fields without actual values
                if 'contact_info' in django_updates:
                    profile_sync_entry['changes']['contact_info'] = list(django_updates['contact_info'].keys())
                member_ref.collection('syncHistory').add(profile_sync_entry)

        except Exception as django_error:
            profile_sync_error = str(django_error)
            log_json("error", "Django profile update failed",
                     uid=req.auth.uid,
                     django_id=django_id,
                     error=profile_sync_error)

            # Log failed sync to Firestore
            if django_updates:
                profile_sync_entry = {
                    'type': 'profile_sync',
                    'timestamp': datetime.now(timezone.utc),
                    'source': 'firestore',
                    'target': 'django',
                    'success': False,
                    'fields_attempted': list(django_updates.keys()),
                    'error': profile_sync_error
                }
                member_ref.collection('syncHistory').add(profile_sync_entry)
            raise

        # Also update Firestore (optimistic update from frontend already done,
        # but we update again with canonical Django data)
        try:
            # Reuse db and kennitala_no_hyphen from above
            # Get member_ref for update
            member_ref = db.collection('members').document(kennitala_no_hyphen)

            # Build Firestore updates with nested profile fields
            firestore_updates = {}
            if 'name' in updates:
                firestore_updates['profile.name'] = updates['name']
            if 'email' in updates:
                firestore_updates['profile.email'] = updates['email']
            if 'phone' in updates:
                firestore_updates['profile.phone'] = normalize_phone(updates['phone'])

            # Handle reachable/groupable preferences
            if 'reachable' in updates:
                firestore_updates['profile.reachable'] = updates['reachable']
            if 'groupable' in updates:
                firestore_updates['profile.groupable'] = updates['groupable']

            # Handle gender and birthday
            if 'gender' in updates:
                firestore_updates['profile.gender'] = updates['gender']
            if 'birthday' in updates:
                firestore_updates['profile.birthday'] = updates['birthday']

            # Handle addresses - store full array in profile.addresses
            if 'addresses' in updates:
                firestore_updates['profile.addresses'] = updates['addresses']

            # Always update last_modified timestamp
            firestore_updates['metadata.last_modified'] = datetime.now(timezone.utc)

            member_ref.update(firestore_updates)

            log_json("info", "Profile updated successfully in Firestore",
                     uid=req.auth.uid,
                     kennitala=f"{kennitala[:6]}****",
                     firestore_fields=list(firestore_updates.keys()))

        except Exception as firestore_error:
            # Log error but don't fail the request - Django is source of truth
            log_json("warn", "Firestore update failed (Django succeeded)",
                     uid=req.auth.uid,
                     kennitala=f"{kennitala[:6]}****",
                     error=str(firestore_error))

        # Return fresh data from Django
        return {
            'success': True,
            'django_id': django_id,
            'updated_fields': list(updates.keys()),
            'member': updated_member
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


def cleanupauditlogs_handler(req: https_fn.CallableRequest) -> dict:
    """
    Cleanup old audit logs, keeping only the most recent N entries.

    Requires admin role.

    Request data:
        keep_count: Number of most recent logs to keep (default: 50)

    Returns:
        Dict with cleanup statistics
    """
    # Require authentication
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Must be authenticated to cleanup audit logs"
        )

    uid = req.auth.uid

    # Get user's roles from Firestore
    db = firestore.client()
    user_ref = db.collection('users').document(uid)
    user_doc = user_ref.get()

    if not user_doc.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message="User not found"
        )

    user_data = user_doc.to_dict()
    roles = user_data.get('roles', [])

    # Require admin or superuser role (roles is a list like ['member', 'admin'])
    if not ('admin' in roles or 'superuser' in roles):
        log_json("warn", "Unauthorized audit log cleanup attempt",
                 uid=uid,
                 roles=roles)
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message="Admin role required"
        )

    # Get keep_count parameter (default: 50)
    keep_count = req.data.get('keep_count', 50) if req.data else 50

    log_json("info", "Starting audit log cleanup",
             uid=uid,
             keep_count=keep_count)

    try:
        # Run cleanup
        result = cleanup_old_audit_logs(keep_count=keep_count)

        log_json("info", "Audit log cleanup completed",
                 uid=uid,
                 result=result)

        return result

    except Exception as e:
        log_json("error", "Audit log cleanup failed",
                 uid=uid,
                 error=str(e))
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Cleanup failed: {str(e)}"
        )
