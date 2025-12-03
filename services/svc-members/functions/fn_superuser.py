"""
Superuser Cloud Functions

Functions for superuser console operations:
- Role management (set/get Firebase custom claims)
- System health checks
- Audit log queries
- Dangerous operations (delete, anonymize)

All functions require superuser role.
"""

from typing import Dict, Any, Optional
from firebase_admin import auth, firestore
from firebase_functions import https_fn, options
from util_logging import log_json
import requests
import time
import os

# Import Cloud Logging lazily to avoid import issues in local dev
_logging_client = None

def get_logging_client():
    """Get Cloud Logging client (lazy initialization)."""
    global _logging_client
    if _logging_client is None:
        try:
            from google.cloud import logging as cloud_logging
            _logging_client = cloud_logging.Client()
        except ImportError:
            log_json("warning", "google-cloud-logging not available")
            _logging_client = None
    return _logging_client

# Service URLs for health checks
# Services with URLs get actively checked
# Services without URLs are listed but marked as "no health endpoint"

# Core GCP services with health endpoints
CLOUD_RUN_SERVICES = [
    {
        "id": "elections-service",
        "name": "Kosningaþjónusta",
        "url": "https://elections-service-521240388393.europe-west2.run.app/health"
    },
    {
        "id": "events-service",
        "name": "Viðburðaþjónusta",
        "url": "https://events-service-521240388393.europe-west2.run.app/health"
    },
    {
        "id": "healthz",
        "name": "Kenni.is Health Check",
        "url": "https://healthz-521240388393.europe-west2.run.app/"
    },
]

# External services (Linode, etc.)
EXTERNAL_SERVICES = [
    {
        "id": "django-linode",
        "name": "Django Backend (Linode)",
        "url": "https://starf.sosialistaflokkurinn.is/felagar/api/"
    },
]

# Demo/Test services (not in production yet)
DEMO_SERVICES = [
    {
        "id": "django-socialism-demo",
        "name": "Django Backend (GCP Demo)",
        "url": "https://django-socialism-demo-521240388393.europe-west2.run.app/felagar/api/"
    },
]

# Firebase Functions - Member Operations (Cloud Run backed, no /health endpoint)
MEMBER_FUNCTIONS = [
    {"id": "handlekenniauth", "name": "Kenni.is Auth"},
    {"id": "verifymembership", "name": "Staðfesting félagsaðildar"},
    {"id": "syncmembers", "name": "Samstilling félagaskrár"},
    {"id": "sync-from-django", "name": "Django → Firestore sync"},
    {"id": "updatememberprofile", "name": "Prófíluppfærsla"},
    {"id": "auditmemberchanges", "name": "Breytingasaga félaga"},
]

# Firebase Functions - Address Validation
ADDRESS_FUNCTIONS = [
    {"id": "search-addresses", "name": "Heimilisfangaleit"},
    {"id": "validate-address", "name": "Staðfesting heimilisfangs"},
    {"id": "validate-postal-code", "name": "Staðfesting póstnúmers"},
]

# Firebase Functions - Superuser Operations
SUPERUSER_FUNCTIONS = [
    {"id": "checksystemhealth", "name": "Staða kerfis"},
    {"id": "setuserrole", "name": "Setja hlutverk notanda"},
    {"id": "getuserrole", "name": "Sækja hlutverk notanda"},
    {"id": "getauditlogs", "name": "Aðgerðaskrár"},
    {"id": "getloginaudit", "name": "Innskráningarsaga"},
    {"id": "harddeletemember", "name": "Eyða félaga"},
    {"id": "anonymizemember", "name": "Nafnhreinsa félaga"},
    {"id": "purgedeleted", "name": "Eyða merktum félögum"},  # New function
]

# Firebase Functions - Utility/Background
UTILITY_FUNCTIONS = [
    {"id": "get-django-token", "name": "Django API lykill"},
    {"id": "cleanupauditlogs", "name": "Hreinsun aðgerðaskráa"},
]

# Combined list for backward compatibility
FIREBASE_FUNCTIONS = MEMBER_FUNCTIONS + ADDRESS_FUNCTIONS + SUPERUSER_FUNCTIONS + UTILITY_FUNCTIONS


def require_superuser(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Verify that the caller has superuser role.

    Args:
        req: The callable request object with auth context.

    Returns:
        The decoded token with custom claims.

    Raises:
        https_fn.HttpsError: If not authenticated or not superuser.
    """
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Authentication required"
        )

    # Check for superuser role in custom claims
    # Support both 'role' (singular) and 'roles' (array) formats
    claims = req.auth.token or {}
    roles = claims.get("roles", [])
    single_role = claims.get("role")

    is_superuser = (
        "superuser" in roles or
        single_role == "superuser"
    )

    if not is_superuser:
        log_json("warning", "Unauthorized superuser access attempt",
                 uid=req.auth.uid,
                 roles=roles,
                 single_role=single_role,
                 attempted_action="superuser_function")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message="Superuser role required"
        )

    return claims


# ==============================================================================
# ROLE MANAGEMENT
# ==============================================================================

def set_user_role_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Set Firebase custom claims (role) for a user.

    Required data:
        - target_uid: Firebase UID of user to modify
        - role: 'member', 'admin', or 'superuser'

    Returns:
        Success status with updated claims.
    """
    # Verify superuser access
    caller_claims = require_superuser(req)
    caller_uid = req.auth.uid

    # Validate input
    data = req.data or {}
    target_uid = data.get("target_uid")
    new_role = data.get("role")

    if not target_uid:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="target_uid is required"
        )

    if new_role not in ["member", "admin", "superuser"]:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="role must be 'member', 'admin', or 'superuser'"
        )

    # Prevent self-demotion for safety
    if target_uid == caller_uid and new_role != "superuser":
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="Cannot demote yourself. Ask another superuser."
        )

    try:
        # Get target user info
        target_user = auth.get_user(target_uid)
        old_claims = target_user.custom_claims or {}
        old_role = old_claims.get("role", "member")

        # Set new custom claims
        auth.set_custom_user_claims(target_uid, {"role": new_role})

        # Log the action
        log_json("info", "User role updated",
                 action="set_user_role",
                 caller_uid=caller_uid,
                 target_uid=target_uid,
                 target_email=target_user.email,
                 old_role=old_role,
                 new_role=new_role)

        # Update Firestore user document
        db = firestore.client()
        user_ref = db.collection("users").document(target_uid)
        user_ref.set({
            "role": new_role,
            "roleUpdatedAt": firestore.SERVER_TIMESTAMP,
            "roleUpdatedBy": caller_uid
        }, merge=True)

        return {
            "success": True,
            "target_uid": target_uid,
            "old_role": old_role,
            "new_role": new_role,
            "message": f"Role updated from {old_role} to {new_role}"
        }

    except auth.UserNotFoundError:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message=f"User not found: {target_uid}"
        )
    except Exception as e:
        log_json("error", "Failed to set user role",
                 error=str(e),
                 target_uid=target_uid,
                 caller_uid=caller_uid)
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Failed to update role: {str(e)}"
        )


def get_user_role_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Get Firebase custom claims (role) for a user.

    Required data:
        - target_uid: Firebase UID of user to query

    Returns:
        User info with current role.
    """
    # Verify superuser access
    require_superuser(req)

    # Validate input
    data = req.data or {}
    target_uid = data.get("target_uid")

    if not target_uid:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="target_uid is required"
        )

    try:
        # Get target user info
        target_user = auth.get_user(target_uid)
        claims = target_user.custom_claims or {}

        return {
            "uid": target_uid,
            "email": target_user.email,
            "displayName": target_user.display_name,
            "role": claims.get("role", "member"),
            "disabled": target_user.disabled,
            "lastSignIn": target_user.user_metadata.last_sign_in_timestamp
        }

    except auth.UserNotFoundError:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message=f"User not found: {target_uid}"
        )


# ==============================================================================
# SYSTEM HEALTH
# ==============================================================================

def check_system_health_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Check health of all services (GCP, external, Firebase functions).
    Bypasses CORS issues by making server-side requests.

    Returns:
        Status of each service grouped by category.
    """
    # Verify superuser access
    require_superuser(req)

    def check_service(service):
        """Check health of a single service."""
        status = "unknown"
        message = ""
        response_time = None

        if service.get("url"):
            try:
                start_time = time.time()
                response = requests.get(
                    service["url"],
                    timeout=5,
                    headers={"User-Agent": "Ekklesia-HealthCheck/1.0"}
                )
                response_time = int((time.time() - start_time) * 1000)

                if response.ok:
                    status = "healthy"
                    message = f"OK ({response_time}ms)"
                else:
                    status = "degraded"
                    message = f"HTTP {response.status_code}"

            except requests.Timeout:
                status = "degraded"
                message = "Timeout (>5s)"
            except requests.RequestException as e:
                status = "down"
                message = str(e)[:50]
        else:
            message = "No health endpoint"

        return {
            "id": service["id"],
            "name": service["name"],
            "status": status,
            "message": message,
            "responseTime": response_time
        }

    results = []

    # Check Cloud Run services (GCP)
    for service in CLOUD_RUN_SERVICES:
        results.append(check_service(service))

    # Check external services (Linode, etc.)
    for service in EXTERNAL_SERVICES:
        results.append(check_service(service))

    # Check demo services
    for service in DEMO_SERVICES:
        result = check_service(service)
        result["category"] = "demo"
        results.append(result)

    # Add Firebase Functions by category (no health endpoint - shown as "available")
    def add_functions(func_list, category):
        for service in func_list:
            results.append({
                "id": service["id"],
                "name": service["name"],
                "status": "available",
                "message": "Tilbúið",
                "responseTime": None,
                "category": category
            })

    add_functions(MEMBER_FUNCTIONS, "member")
    add_functions(ADDRESS_FUNCTIONS, "address")
    add_functions(SUPERUSER_FUNCTIONS, "superuser")
    add_functions(UTILITY_FUNCTIONS, "utility")

    # Check Firestore connectivity
    try:
        db = firestore.client()
        db.collection("_health").document("ping").set(
            {"timestamp": firestore.SERVER_TIMESTAMP},
            merge=True
        )
        results.append({
            "id": "firestore",
            "name": "Firestore",
            "status": "healthy",
            "message": "Connected"
        })
    except Exception as e:
        results.append({
            "id": "firestore",
            "name": "Firestore",
            "status": "down",
            "message": str(e)[:50]
        })

    # Check Cloud SQL (PostgreSQL) via Admin API
    try:
        import google.auth
        from google.auth.transport.requests import Request

        # Get credentials and project
        credentials, project = google.auth.default()
        credentials.refresh(Request())

        # Cloud SQL Admin API endpoint
        instance_name = "ekklesia-db"
        sql_api_url = f"https://sqladmin.googleapis.com/v1/projects/{project}/instances/{instance_name}"

        start_time = time.time()
        response = requests.get(
            sql_api_url,
            headers={
                "Authorization": f"Bearer {credentials.token}",
                "Content-Type": "application/json"
            },
            timeout=5
        )
        response_time = int((time.time() - start_time) * 1000)

        if response.ok:
            data = response.json()
            state = data.get("state", "UNKNOWN")
            if state == "RUNNABLE":
                results.append({
                    "id": "cloudsql",
                    "name": "Cloud SQL (PostgreSQL)",
                    "status": "healthy",
                    "message": f"Running ({response_time}ms)",
                    "responseTime": response_time
                })
            else:
                results.append({
                    "id": "cloudsql",
                    "name": "Cloud SQL (PostgreSQL)",
                    "status": "degraded",
                    "message": f"State: {state}",
                    "responseTime": response_time
                })
        else:
            results.append({
                "id": "cloudsql",
                "name": "Cloud SQL (PostgreSQL)",
                "status": "degraded",
                "message": f"API error: {response.status_code}"
            })
    except Exception as e:
        results.append({
            "id": "cloudsql",
            "name": "Cloud SQL (PostgreSQL)",
            "status": "unknown",
            "message": str(e)[:50]
        })

    # Summary
    healthy_count = sum(1 for r in results if r["status"] == "healthy")
    degraded_count = sum(1 for r in results if r["status"] == "degraded")
    down_count = sum(1 for r in results if r["status"] == "down")

    return {
        "services": results,
        "summary": {
            "healthy": healthy_count,
            "degraded": degraded_count,
            "down": down_count,
            "total": len(results)
        },
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }


# ==============================================================================
# AUDIT LOGS
# ==============================================================================

def get_audit_logs_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Query Cloud Logging for audit events.

    Optional data:
        - service: Filter by service name
        - severity: Filter by severity (INFO, WARNING, ERROR)
        - hours: Time range in hours (default 24)
        - correlation_id: Filter by correlation ID
        - limit: Max results (default 100)

    Returns:
        List of log entries.
    """
    # Verify superuser access
    require_superuser(req)

    data = req.data or {}
    service = data.get("service")
    severity = data.get("severity")
    hours = data.get("hours", 24)
    correlation_id = data.get("correlation_id")
    limit = min(data.get("limit", 100), 500)  # Cap at 500

    try:
        client = get_logging_client()
        if not client:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.UNAVAILABLE,
                message="Cloud Logging client not available"
            )

        # Build filter
        filters = [
            'resource.type="cloud_function"',
            f'timestamp>="{_hours_ago(hours)}"'
        ]

        if service:
            filters.append(f'resource.labels.function_name="{service}"')

        if severity:
            filters.append(f'severity="{severity}"')

        if correlation_id:
            filters.append(f'jsonPayload.correlationId="{correlation_id}"')

        filter_str = " AND ".join(filters)

        # Query logs
        entries = []
        for entry in client.list_entries(filter_=filter_str, max_results=limit):
            payload = entry.payload if isinstance(entry.payload, dict) else {"message": str(entry.payload)}

            entries.append({
                "timestamp": entry.timestamp.isoformat() if entry.timestamp else None,
                "severity": entry.severity,
                "service": entry.resource.labels.get("function_name") if entry.resource else None,
                "message": payload.get("message") or payload.get("msg") or str(payload),
                "correlationId": payload.get("correlationId") or payload.get("correlation_id"),
                "user": payload.get("user") or payload.get("uid"),
                "error": payload.get("error")
            })

        return {
            "logs": entries,
            "count": len(entries),
            "filter": {
                "service": service,
                "severity": severity,
                "hours": hours,
                "correlation_id": correlation_id
            }
        }

    except Exception as e:
        log_json("error", "Failed to fetch audit logs", error=str(e))
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Failed to fetch logs: {str(e)}"
        )


def _hours_ago(hours: int) -> str:
    """Return ISO timestamp for N hours ago."""
    from datetime import datetime, timedelta, timezone
    dt = datetime.now(timezone.utc) - timedelta(hours=hours)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


# ==============================================================================
# DANGEROUS OPERATIONS
# ==============================================================================

def hard_delete_member_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Permanently delete a member from all systems.

    Required data:
        - kennitala: The member's kennitala (SSN)
        - confirmation: Must be "EYÐA VARANLEGA"

    Returns:
        Deletion status.
    """
    # Verify superuser access
    caller_claims = require_superuser(req)
    caller_uid = req.auth.uid

    data = req.data or {}
    kennitala = data.get("kennitala")
    confirmation = data.get("confirmation")

    if not kennitala or len(kennitala) != 10:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Valid 10-digit kennitala required"
        )

    if confirmation != "EYÐA VARANLEGA":
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="Invalid confirmation phrase"
        )

    db = firestore.client()
    deleted_items = []
    errors = []

    try:
        # 1. Find member in Firestore
        member_ref = db.collection("members").document(kennitala)
        member_doc = member_ref.get()

        if not member_doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message=f"Member not found: {kennitala}"
            )

        member_data = member_doc.to_dict()
        firebase_uid = member_data.get("firebaseUid")

        # 2. Delete Firebase Auth user if exists
        if firebase_uid:
            try:
                auth.delete_user(firebase_uid)
                deleted_items.append(f"Firebase Auth user: {firebase_uid}")
            except auth.UserNotFoundError:
                pass  # Already deleted
            except Exception as e:
                errors.append(f"Firebase Auth: {str(e)}")

        # 3. Delete from /users/ collection
        if firebase_uid:
            try:
                db.collection("users").document(firebase_uid).delete()
                deleted_items.append(f"Firestore /users/{firebase_uid}")
            except Exception as e:
                errors.append(f"Firestore /users/: {str(e)}")

        # 4. Delete from /members/ collection
        try:
            member_ref.delete()
            deleted_items.append(f"Firestore /members/{kennitala}")
        except Exception as e:
            errors.append(f"Firestore /members/: {str(e)}")

        # 5. Log the action
        log_json("warning", "DANGEROUS: Member hard deleted",
                 action="hard_delete_member",
                 caller_uid=caller_uid,
                 kennitala=kennitala[:6] + "****",  # Partial kennitala for audit
                 deleted_items=deleted_items,
                 errors=errors if errors else None)

        return {
            "success": len(errors) == 0,
            "deleted": deleted_items,
            "errors": errors if errors else None,
            "message": "Member permanently deleted" if not errors else "Partial deletion - check errors"
        }

    except https_fn.HttpsError:
        raise
    except Exception as e:
        log_json("error", "Hard delete failed", error=str(e), kennitala=kennitala[:6] + "****")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Deletion failed: {str(e)}"
        )


def anonymize_member_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Anonymize a member's PII while keeping statistical data.
    Used for GDPR requests where deletion is not possible.

    Required data:
        - kennitala: The member's kennitala (SSN)
        - confirmation: Must be "NAFNHREINSA"

    Returns:
        Anonymization status.
    """
    # Verify superuser access
    caller_claims = require_superuser(req)
    caller_uid = req.auth.uid

    data = req.data or {}
    kennitala = data.get("kennitala")
    confirmation = data.get("confirmation")

    if not kennitala or len(kennitala) != 10:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Valid 10-digit kennitala required"
        )

    if confirmation != "NAFNHREINSA":
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="Invalid confirmation phrase"
        )

    db = firestore.client()

    try:
        # Find member
        member_ref = db.collection("members").document(kennitala)
        member_doc = member_ref.get()

        if not member_doc.exists:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message=f"Member not found: {kennitala}"
            )

        member_data = member_doc.to_dict()
        firebase_uid = member_data.get("firebaseUid")

        # Generate anonymous ID
        import uuid
        anon_id = f"ANON-{uuid.uuid4().hex[:8].upper()}"

        # Anonymize member document
        anonymized_data = {
            "name": anon_id,
            "email": f"{anon_id.lower()}@anonymized.local",
            "kennitala": None,
            "phone": None,
            "address": None,
            "postalCode": member_data.get("postalCode"),  # Keep for statistics
            "region": member_data.get("region"),  # Keep for statistics
            "memberSince": member_data.get("memberSince"),  # Keep for statistics
            "anonymizedAt": firestore.SERVER_TIMESTAMP,
            "anonymizedBy": caller_uid,
            "isAnonymized": True
        }

        # Create new document with anonymous ID, delete old
        db.collection("members").document(anon_id).set(anonymized_data)
        member_ref.delete()

        # Anonymize Firebase Auth user if exists
        if firebase_uid:
            try:
                auth.update_user(
                    firebase_uid,
                    display_name=anon_id,
                    email=f"{anon_id.lower()}@anonymized.local",
                    disabled=True
                )
            except Exception as e:
                log_json("warning", "Could not anonymize Firebase Auth user",
                         error=str(e), uid=firebase_uid)

        # Log the action
        log_json("warning", "DANGEROUS: Member anonymized (GDPR)",
                 action="anonymize_member",
                 caller_uid=caller_uid,
                 original_kennitala=kennitala[:6] + "****",
                 anon_id=anon_id)

        return {
            "success": True,
            "anon_id": anon_id,
            "message": f"Member anonymized as {anon_id}"
        }

    except https_fn.HttpsError:
        raise
    except Exception as e:
        log_json("error", "Anonymization failed", error=str(e))
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Anonymization failed: {str(e)}"
        )


# ==============================================================================
# LIST ELEVATED USERS
# ==============================================================================

def list_elevated_users_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    List all users with elevated privileges (admin, superuser, staff).
    
    OPTIMIZED VERSION: 
    1. Checks /users/ collection for role field
    2. Uses Firebase Auth list_users() to find users with custom claims
       (batch operation, much faster than individual get_user calls)
    3. Checks /members/ collection for Django is_staff/is_superuser/is_admin flags
       (synced from Django, catches users who haven't logged in yet)

    Returns:
        Lists of superusers and admins with their info.
    """
    # Verify superuser access
    require_superuser(req)

    db = firestore.client()

    try:
        # Track by UID or kennitala to avoid duplicates
        superusers_map = {}  # keyed by uid
        admins_map = {}      # keyed by uid
        django_elevated = {} # keyed by kennitala (for users without Firebase account)

        # 1. Query /users/ collection for explicit role field
        superuser_docs = db.collection("users").where("role", "==", "superuser").stream()
        for doc in superuser_docs:
            data = doc.to_dict()
            superusers_map[doc.id] = {
                "uid": doc.id,
                "kennitala": data.get("kennitala"),
                "displayName": data.get("displayName") or data.get("fullName") or "Nafnlaus",
                "email": data.get("email") or "-",
                "roleUpdatedAt": data.get("roleUpdatedAt").isoformat() if data.get("roleUpdatedAt") else None,
                "source": "users",
                "hasLoggedIn": True
            }

        admin_docs = db.collection("users").where("role", "==", "admin").stream()
        for doc in admin_docs:
            data = doc.to_dict()
            if doc.id not in superusers_map:  # Don't downgrade superusers
                admins_map[doc.id] = {
                    "uid": doc.id,
                    "kennitala": data.get("kennitala"),
                    "displayName": data.get("displayName") or data.get("fullName") or "Nafnlaus",
                    "email": data.get("email") or "-",
                    "roleUpdatedAt": data.get("roleUpdatedAt").isoformat() if data.get("roleUpdatedAt") else None,
                    "source": "users",
                    "hasLoggedIn": True
                }

        # 2. Check Firebase Auth custom claims (batch operation)
        # This catches users with roles set via claims but not in /users/ collection
        try:
            page = auth.list_users()
            while page:
                for user in page.users:
                    claims = user.custom_claims or {}
                    role = claims.get("role")
                    roles = claims.get("roles", [])
                    
                    is_superuser = role == "superuser" or "superuser" in roles
                    is_admin = role == "admin" or "admin" in roles
                    
                    if is_superuser and user.uid not in superusers_map:
                        superusers_map[user.uid] = {
                            "uid": user.uid,
                            "kennitala": None,
                            "displayName": user.display_name or user.email or "Nafnlaus",
                            "email": user.email or "-",
                            "roleUpdatedAt": None,
                            "source": "firebase_claims",
                            "hasLoggedIn": True
                        }
                    elif is_admin and user.uid not in superusers_map and user.uid not in admins_map:
                        admins_map[user.uid] = {
                            "uid": user.uid,
                            "kennitala": None,
                            "displayName": user.display_name or user.email or "Nafnlaus",
                            "email": user.email or "-",
                            "roleUpdatedAt": None,
                            "source": "firebase_claims",
                            "hasLoggedIn": True
                        }
                
                # Get next page
                page = page.get_next_page()
        except Exception as e:
            log_json("warning", "Failed to list Firebase Auth users", error=str(e))
            # Continue with what we have from /users/ collection

        # 3. Check /members/ collection for Django elevated flags
        # This catches users with Django staff/admin roles who haven't logged into Ekklesia
        # Field is "django_roles" with is_staff and is_superuser booleans
        try:
            # Get existing kennitölur to avoid duplicates
            existing_kts = set()
            for u in list(superusers_map.values()) + list(admins_map.values()):
                if u.get("kennitala"):
                    existing_kts.add(u["kennitala"])
            
            # Query members with is_superuser=true
            superuser_members = db.collection("members").where(
                "django_roles.is_superuser", "==", True
            ).stream()
            for doc in superuser_members:
                kt = doc.id
                if kt in existing_kts:
                    continue
                data = doc.to_dict()
                profile = data.get("profile", {})
                metadata = data.get("metadata", {})
                firebase_uid = metadata.get("firebase_uid")
                
                # Skip if already in map by UID
                if firebase_uid and firebase_uid in superusers_map:
                    continue
                
                entry = {
                    "uid": firebase_uid,
                    "kennitala": kt,
                    "displayName": profile.get("name") or "Nafnlaus",
                    "email": profile.get("email") or "-",
                    "roleUpdatedAt": None,
                    "source": "django_members",
                    "hasLoggedIn": firebase_uid is not None,
                    "djangoFlags": {"is_superuser": True}
                }
                
                if firebase_uid:
                    superusers_map[firebase_uid] = entry
                else:
                    django_elevated[f"kt:{kt}:superuser"] = entry
                existing_kts.add(kt)
            
            # Query members with is_staff=true (admins)
            staff_members = db.collection("members").where(
                "django_roles.is_staff", "==", True
            ).stream()
            for doc in staff_members:
                kt = doc.id
                if kt in existing_kts:
                    continue
                data = doc.to_dict()
                profile = data.get("profile", {})
                metadata = data.get("metadata", {})
                django_roles = data.get("django_roles", {})
                firebase_uid = metadata.get("firebase_uid")
                
                # Skip superusers
                if django_roles.get("is_superuser"):
                    continue
                
                # Skip if already in map by UID
                if firebase_uid and (firebase_uid in superusers_map or firebase_uid in admins_map):
                    continue
                
                entry = {
                    "uid": firebase_uid,
                    "kennitala": kt,
                    "displayName": profile.get("name") or "Nafnlaus",
                    "email": profile.get("email") or "-",
                    "roleUpdatedAt": None,
                    "source": "django_members",
                    "hasLoggedIn": firebase_uid is not None,
                    "djangoFlags": {
                        "is_staff": True,
                        "is_admin": django_roles.get("is_admin", False)
                    }
                }
                
                if firebase_uid:
                    admins_map[firebase_uid] = entry
                else:
                    django_elevated[f"kt:{kt}:admin"] = entry
                existing_kts.add(kt)
                
        except Exception as e:
            log_json("warning", "Failed to check /members/ for Django elevated users", error=str(e))
            # Continue with what we have

        # Convert to sorted lists (include Django-only users)
        all_superusers = list(superusers_map.values()) + [
            v for k, v in django_elevated.items() if ":superuser" in k
        ]
        all_admins = list(admins_map.values()) + [
            v for k, v in django_elevated.items() if ":admin" in k
        ]
        
        superusers = sorted(all_superusers, key=lambda x: (x["displayName"] or "").lower())
        admins = sorted(all_admins, key=lambda x: (x["displayName"] or "").lower())

        log_json("info", "Listed elevated users",
                superuser_count=len(superusers),
                admin_count=len(admins),
                django_only_count=len(django_elevated))

        return {
            "superusers": superusers,
            "admins": admins,
            "counts": {
                "superusers": len(superusers),
                "admins": len(admins)
            }
        }

    except Exception as e:
        log_json("error", "Failed to list elevated users", error=str(e))
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Failed to list elevated users: {str(e)}"
        )


def _fetch_django_elevated_users() -> Dict[str, list]:
    """
    Fetch users with elevated privileges from Django API.

    Returns:
        Dict with 'superusers' and 'admins' lists
    """
    django_token = os.environ.get('django-api-token') or os.environ.get('DJANGO_API_TOKEN')
    if not django_token:
        raise ValueError("Django API token not found")

    headers = {
        'Authorization': f'Token {django_token}',
        'Accept': 'application/json'
    }

    # Django API endpoint for all members
    url = "https://starf.sosialistaflokkurinn.is/felagar/api/full/"

    superusers = []
    admins = []

    # Fetch all pages to find elevated users
    page = 1
    while True:
        response = requests.get(url, headers=headers, params={'page': page}, timeout=30)
        if not response.ok:
            break

        data = response.json()
        results = data.get('results', [])

        for member in results:
            is_superuser = member.get('is_superuser', False)
            is_staff = member.get('is_staff', False)

            if is_superuser:
                superusers.append({
                    'id': member.get('id'),
                    'name': member.get('name'),
                    'email': member.get('contact_info', {}).get('email'),
                    'username': member.get('username')
                })
            elif is_staff:
                admins.append({
                    'id': member.get('id'),
                    'name': member.get('name'),
                    'email': member.get('contact_info', {}).get('email'),
                    'username': member.get('username')
                })

        # Check for next page
        if not data.get('next'):
            break
        page += 1

        # Safety limit
        if page > 50:
            break

    return {
        'superusers': superusers,
        'admins': admins
    }


def _check_user_has_logged_in(db, email: str) -> bool:
    """Check if a user with this email has logged into Ekklesia."""
    if not email:
        return False

    # Check /members/ collection for firebase_uid by email
    members = db.collection("members").where(
        "profile.email", "==", email
    ).limit(1).stream()

    for member_doc in members:
        member_data = member_doc.to_dict()
        if member_data.get("metadata", {}).get("firebase_uid"):
            return True

    return False


# ==============================================================================
# LOGIN AUDIT
# ==============================================================================

def get_login_audit_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Get login history from Firestore /users/ collection.

    Optional data:
        - status: 'success' or 'failed'
        - hours: Time range in hours (default 24)
        - user_filter: Filter by name or email
        - limit: Max results (default 100)

    Returns:
        List of login events.
    """
    # Verify superuser access
    require_superuser(req)

    data = req.data or {}
    status_filter = data.get("status")
    hours = data.get("hours", 24)
    user_filter = (data.get("user_filter") or "").lower()
    result_limit = min(data.get("limit", 100), 500)

    db = firestore.client()

    try:
        from datetime import datetime, timedelta, timezone
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

        # Query users with recent login activity
        query = db.collection("users").order_by("lastLogin", direction=firestore.Query.DESCENDING).limit(result_limit)

        results = []
        for doc in query.stream():
            user_data = doc.to_dict()
            last_login = user_data.get("lastLogin")

            # Skip if before cutoff
            if last_login and last_login < cutoff:
                continue

            # Apply user filter
            if user_filter:
                name = (user_data.get("displayName") or "").lower()
                email = (user_data.get("email") or "").lower()
                if user_filter not in name and user_filter not in email:
                    continue

            # Determine login status (based on loginError field)
            login_status = "failed" if user_data.get("loginError") else "success"

            # Apply status filter
            if status_filter and login_status != status_filter:
                continue

            results.append({
                "uid": doc.id,
                "user": user_data.get("displayName") or user_data.get("fullName"),
                "email": user_data.get("email"),
                "status": login_status,
                "timestamp": last_login.isoformat() if last_login else None,
                "method": user_data.get("authProvider", "kenni.is"),
                "userAgent": user_data.get("lastUserAgent"),
                "error": user_data.get("loginError")
            })

        # Calculate stats
        success_count = sum(1 for r in results if r["status"] == "success")
        failed_count = sum(1 for r in results if r["status"] == "failed")

        return {
            "logins": results,
            "stats": {
                "total": len(results),
                "success": success_count,
                "failed": failed_count
            }
        }

    except Exception as e:
        log_json("error", "Failed to fetch login audit", error=str(e))
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Failed to fetch login audit: {str(e)}"
        )


# ==============================================================================
# PURGE DELETED MEMBERS
# ==============================================================================

@https_fn.on_call(region="europe-west2")
def purgedeleted(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Permanently delete members marked as 'deleted'.
    
    This is a dangerous operation that removes data from Firestore.
    It does NOT remove the user from Firebase Auth (that should be handled separately).
    
    Returns:
        Dict with count of deleted documents.
    """
    # 1. Verify Superuser
    if not is_superuser(req):
        log_json("warning", "Unauthorized purgeDeleted attempt", uid=req.auth.uid if req.auth else "anonymous")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message="Only superusers can perform this operation."
        )

    try:
        db = firestore.client()
        
        # Query for soft-deleted members
        # Assuming 'deleted' field is boolean true or 'status' is 'deleted'
        # Based on typical patterns, let's check both or adjust based on schema
        # For now, we'll assume a 'deleted' boolean flag based on common soft-delete patterns
        
        # Option A: status == 'deleted'
        docs = db.collection("users").where("status", "==", "deleted").stream()
        
        deleted_count = 0
        batch = db.batch()
        batch_size = 0
        MAX_BATCH_SIZE = 400  # Firestore limit is 500
        
        for doc in docs:
            batch.delete(doc.reference)
            deleted_count += 1
            batch_size += 1
            
            if batch_size >= MAX_BATCH_SIZE:
                batch.commit()
                batch = db.batch()
                batch_size = 0
        
        if batch_size > 0:
            batch.commit()
            
        log_json("info", "Purged deleted members", count=deleted_count, admin=req.auth.uid)
        
        return {
            "success": True,
            "count": deleted_count,
            "message": f"Permanently deleted {deleted_count} records."
        }

    except Exception as e:
        log_json("error", "Failed to purge deleted members", error=str(e))
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Failed to purge deleted members: {str(e)}"
        )
