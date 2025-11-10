"""
Membership management Cloud Functions for Ekklesia Members Service

Handles membership verification, sync operations, and profile updates.
"""

from datetime import datetime, timezone
from typing import Dict, Any

from firebase_admin import auth, firestore
from firebase_functions import https_fn, options
from utils_logging import log_json
from shared.validators import normalize_kennitala, normalize_phone
from sync_members import sync_all_members, create_sync_log, update_django_member
from cleanup_audit_logs import cleanup_old_audit_logs


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


@https_fn.on_call(timeout_sec=540, memory=512)
def syncmembers(req: https_fn.CallableRequest) -> Dict[str, Any]:
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
def updatememberprofile(req: https_fn.CallableRequest) -> Dict[str, Any]:
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
    # Normalize both kennitalas to same format (no hyphens) for comparison
    user_kennitala = req.auth.token.get('kennitala', '').replace('-', '')
    request_kennitala = kennitala.replace('-', '')
    if user_kennitala != request_kennitala:
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

        # Update Django via API
        updated_member = update_django_member(django_id, django_updates)

        log_json("info", "Profile updated successfully in Django",
                 uid=req.auth.uid,
                 django_id=django_id,
                 kennitala=f"{kennitala[:6]}****")

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


@https_fn.on_call(
    region="europe-west2",
    memory=options.MemoryOption.MB_256,
    timeout_sec=300
)
def cleanupauditlogs(req: https_fn.CallableRequest) -> dict:
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
    roles = user_data.get('roles', {})

    # Require admin or superuser role
    if not (roles.get('admin') or roles.get('superuser')):
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
