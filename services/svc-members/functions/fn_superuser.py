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
from shared.rate_limit import check_uid_rate_limit
from db_members import (
    get_member_by_kennitala,
    get_member_by_django_id,
    get_member_by_email,
    get_deleted_member_count,
    get_deleted_members,
    hard_delete_member_sql,
    anonymize_member_sql
)
import requests
import time
import os
import ast
import re

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
        "url": "https://elections-service-521240388393.europe-west1.run.app/health"
    },
    {
        "id": "events-service",
        "name": "Viðburðaþjónusta",
        "url": "https://events-service-521240388393.europe-west1.run.app/health"
    },
    {
        "id": "healthz",
        "name": "Kenni.is Health Check",
        "url": "https://healthz-521240388393.europe-west2.run.app/"
    },
    {
        "id": "django-socialism",
        "name": "Django Admin (GCP)",
        "url": "https://starf.sosialistaflokkurinn.is/felagar/api/"
    },
]

# Base URL for Firebase Callable Functions
FUNCTIONS_BASE_URL = "https://europe-west2-ekklesia-prod-10-2025.cloudfunctions.net"

# Firebase Functions - Member Operations (Cloud Run backed, no /health endpoint)
MEMBER_FUNCTIONS = [
    {"id": "handlekenniauth", "name": "Kenni.is Auth"},
    {"id": "verifymembership", "name": "Staðfesting félagsaðildar"},
    {"id": "updatememberprofile", "name": "Prófíluppfærsla"},
    {"id": "softdeleteself", "name": "Afskrá sjálfan sig"},
    {"id": "reactivateself", "name": "Endurvirkja aðild"},
]

# Firebase Functions - Address Validation
ADDRESS_FUNCTIONS = [
    {"id": "search-addresses", "name": "Heimilisfangaleit"},
    {"id": "validate-address", "name": "Staðfesting heimilisfangs"},
    {"id": "validate-postal-code", "name": "Staðfesting póstnúmers"},
]

# Firebase Functions - Lookup (safe to ping - return static data)
LOOKUP_FUNCTIONS = [
    {"id": "list-unions", "name": "Stéttarfélög", "function_name": "list_unions"},
    {"id": "list-job-titles", "name": "Starfsheiti", "function_name": "list_job_titles"},
    {"id": "list-countries", "name": "Lönd", "function_name": "list_countries"},
    {"id": "list-postal-codes", "name": "Póstnúmer", "function_name": "list_postal_codes"},
    {"id": "get-cells-by-postal-code", "name": "Sellur eftir póstnúmeri", "function_name": "get_cells_by_postal_code"},
]

# Firebase Functions - Registration
REGISTRATION_FUNCTIONS = [
    {"id": "register-member", "name": "Skráning félaga"},
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
    {"id": "listelevatedusers", "name": "Listi yfir stjórnendur"},
    {"id": "purgedeleted", "name": "Eyða merktum félögum"},
    {"id": "getdeletedcounts", "name": "Fjöldi eyddra gagna"},
]

# Firebase Functions - Email Operations (Issue #323)
EMAIL_FUNCTIONS = [
    {"id": "listemailtemplates", "name": "Lista póstsniðmát"},
    {"id": "getemailtemplate", "name": "Sækja póstsniðmát"},
    {"id": "saveemailtemplate", "name": "Vista póstsniðmát"},
    {"id": "deleteemailtemplate", "name": "Eyða póstsniðmáti"},
    {"id": "sendemail", "name": "Senda tölvupóst"},
    {"id": "listemailcampaigns", "name": "Lista herferðir"},
    {"id": "createemailcampaign", "name": "Búa til herferð"},
    {"id": "sendcampaign", "name": "Senda herferð"},
    {"id": "getemailstats", "name": "Tölfræði sendinga"},
    {"id": "listemaillogs", "name": "Sendingarskrá"},
    {"id": "getemailpreferences", "name": "Sækja póstkjörstillingar"},
    {"id": "updateemailpreferences", "name": "Uppfæra póstkjörstillingar"},
    {"id": "unsubscribe", "name": "Afskráning af póstlista"},
]

# Firebase Functions - Heatmap/Analytics
HEATMAP_FUNCTIONS = [
    {"id": "compute-member-heatmap-stats", "name": "Reikna hitakortsgögn"},
    {"id": "get-member-heatmap-data", "name": "Sækja hitakortsgögn"},
]

# Firebase Functions - Admin Member Operations
ADMIN_MEMBER_FUNCTIONS = [
    {"id": "listmembers", "name": "Lista félaga"},
    {"id": "getmember", "name": "Sækja félaga"},
    {"id": "getmemberstats", "name": "Tölfræði félaga"},
    {"id": "getmemberself", "name": "Sækja eigin gögn"},
]

# Combined list for backward compatibility
FIREBASE_FUNCTIONS = (
    MEMBER_FUNCTIONS +
    ADDRESS_FUNCTIONS +
    SUPERUSER_FUNCTIONS +
    EMAIL_FUNCTIONS +
    HEATMAP_FUNCTIONS +
    ADMIN_MEMBER_FUNCTIONS
)


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

    # Security: Rate limit role changes (10 per 10 minutes)
    if not check_uid_rate_limit(caller_uid, "set_role", max_attempts=10, window_minutes=10):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.RESOURCE_EXHAUSTED,
            message="Rate limit exceeded. Maximum 10 role changes per 10 minutes."
        )

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
        old_roles = old_claims.get("roles", ["member"])
        old_role = old_claims.get("role", "member")  # Legacy field

        # Build new roles array - everyone keeps 'member' base role
        # Roles hierarchy: member (base), admin, superuser
        new_roles = ["member"]
        if new_role == "admin":
            new_roles.append("admin")
        elif new_role == "superuser":
            new_roles.append("superuser")
        # If new_role == "member", just ['member']

        # Set new custom claims (using 'roles' array as primary)
        auth.set_custom_user_claims(target_uid, {"roles": new_roles})

        # Log the action
        log_json("info", "User role updated",
                 action="set_user_role",
                 caller_uid=caller_uid,
                 target_uid=target_uid,
                 target_email=target_user.email,
                 old_roles=old_roles,
                 new_roles=new_roles)

        # Update Firestore user document (roles array only, delete legacy 'role' string)
        db = firestore.client()
        user_ref = db.collection("users").document(target_uid)
        user_ref.set({
            "roles": new_roles,
            "role": firestore.DELETE_FIELD,  # Remove legacy field
            "roleUpdatedAt": firestore.SERVER_TIMESTAMP,
            "roleUpdatedBy": caller_uid
        }, merge=True)

        return {
            "success": True,
            "target_uid": target_uid,
            "old_role": old_role,  # Keep for backwards compat
            "new_role": new_role,  # Keep for backwards compat
            "old_roles": old_roles,
            "new_roles": new_roles,
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

        # Get roles from array (new format) with fallback
        roles = claims.get("roles", ["member"])

        return {
            "uid": target_uid,
            "email": target_user.email,
            "displayName": target_user.display_name,
            "roles": roles,  # Array format
            "role": roles[-1] if roles else "member",  # Legacy: highest role for backwards compat
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

    # Check Firebase Callable Functions by pinging them
    def check_callable_function(service, category):
        """Check health of a Firebase Callable Function by making HTTP POST."""
        func_name = service.get("function_name")
        if not func_name:
            # No function_name means we can't ping it safely
            return {
                "id": service["id"],
                "name": service["name"],
                "status": "available",
                "message": "Tilbúið",
                "responseTime": None,
                "category": category
            }

        url = f"{FUNCTIONS_BASE_URL}/{func_name}"
        try:
            start_time = time.time()
            # Callable functions expect POST with JSON body {"data": {...}}
            response = requests.post(
                url,
                json={"data": {}},
                timeout=10,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "Ekklesia-HealthCheck/1.0"
                }
            )
            response_time = int((time.time() - start_time) * 1000)

            # 200 = success, 401/403 = auth required but function is running
            if response.status_code in [200, 401, 403]:
                return {
                    "id": service["id"],
                    "name": service["name"],
                    "status": "healthy",
                    "message": f"OK ({response_time}ms)",
                    "responseTime": response_time,
                    "category": category
                }
            else:
                return {
                    "id": service["id"],
                    "name": service["name"],
                    "status": "degraded",
                    "message": f"HTTP {response.status_code} ({response_time}ms)",
                    "responseTime": response_time,
                    "category": category
                }

        except requests.Timeout:
            return {
                "id": service["id"],
                "name": service["name"],
                "status": "degraded",
                "message": "Timeout (>10s)",
                "responseTime": None,
                "category": category
            }
        except requests.RequestException as e:
            return {
                "id": service["id"],
                "name": service["name"],
                "status": "down",
                "message": str(e)[:50],
                "responseTime": None,
                "category": category
            }

    # Add Firebase Functions by category
    def add_functions(func_list, category):
        for service in func_list:
            results.append(check_callable_function(service, category))

    # Ping lookup functions (safe - return static data, no auth required)
    add_functions(LOOKUP_FUNCTIONS, "lookup")

    # Other functions without function_name get "available" status
    add_functions(MEMBER_FUNCTIONS, "member")
    add_functions(ADDRESS_FUNCTIONS, "address")
    add_functions(REGISTRATION_FUNCTIONS, "registration")
    add_functions(SUPERUSER_FUNCTIONS, "superuser")
    add_functions(EMAIL_FUNCTIONS, "email")
    add_functions(HEATMAP_FUNCTIONS, "heatmap")
    add_functions(ADMIN_MEMBER_FUNCTIONS, "admin")

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
        instance_name = "ekklesia-db-eu1"
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

    # Summary - count "available" as healthy (Firebase Functions without health endpoint)
    healthy_count = sum(1 for r in results if r["status"] in ("healthy", "available"))
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

    # Security: Allowlist for service names to prevent filter injection
    ALLOWED_SERVICES = {
        "handlekenniauth", "verifymembership", "updatememberprofile",
        "softdeleteself", "reactivateself", "search-addresses",
        "validate-address", "validate-postal-code", "list-unions", "list-job-titles",
        "list-countries", "list-postal-codes", "get-cells-by-postal-code",
        "register-member", "checksystemhealth", "setuserrole", "getuserrole",
        "getauditlogs", "getloginaudit", "harddeletemember", "anonymizemember",
        "listelevatedusers", "purgedeleted"
    }
    ALLOWED_SEVERITIES = {"DEBUG", "INFO", "NOTICE", "WARNING", "ERROR", "CRITICAL", "ALERT", "EMERGENCY"}

    if service and service not in ALLOWED_SERVICES:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Invalid service name"
        )

    if severity and severity.upper() not in ALLOWED_SEVERITIES:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Invalid severity level"
        )

    # Security: Validate hours range (1-168 = 1 week max)
    if not isinstance(hours, int) or hours < 1 or hours > 168:
        hours = 24  # Default to 24 hours if invalid

    # Security: Sanitize correlation_id (alphanumeric + dashes only, max 64 chars)
    if correlation_id:
        if not re.match(r'^[a-zA-Z0-9\-]{1,64}$', str(correlation_id)):
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                message="Invalid correlation_id format"
            )

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

# ... inside get_audit_logs_handler ...

        # Query logs
        entries = []
        for entry in client.list_entries(filter_=filter_str, max_results=limit):
            # entry.payload is usually a dict (or OrderedDict) for JSON payloads
            payload = entry.payload if isinstance(entry.payload, dict) else {"message": str(entry.payload)}
            
            # Default values
            message = payload.get("message") or payload.get("msg")
            action = None
            resource = None
            status = None
            user = payload.get("user") or payload.get("uid")

            # DETECT STRUCTURED AUDIT LOG (GCP Audit Log)
            # Check for keys present in the raw OrderedDict output seen in logs
            if not message and "authenticationInfo" in payload and "methodName" in payload:
                try:
                    auth_info = payload.get("authenticationInfo", {})
                    # request_meta = payload.get("requestMetadata", {}) # Not used currently
                    authz_info_list = payload.get("authorizationInfo", [])
                    authz_info = authz_info_list[0] if authz_info_list else {}
                    
                    user_email = auth_info.get("principalEmail")
                    method = payload.get("methodName", "").split(".")[-1] # Shorten: google...UpdateFunction -> UpdateFunction
                    res_name = payload.get("resourceName", "").split("/")[-1] # Shorten resource
                    
                    # Set structured fields
                    user = user_email
                    action = method
                    resource = res_name
                    status = "Granted" if authz_info.get("granted") else "Denied"
                    
                    # Format human-readable message
                    message = f"{user_email} performed {method} on {res_name}"
                    
                except Exception as parse_error:
                    log_json("warning", "Failed to parse structured audit log", error=str(parse_error))
            
            # Fallback if message is still empty
            if not message:
                message = str(payload)

            entries.append({
                "timestamp": entry.timestamp.isoformat() if entry.timestamp else None,
                "severity": entry.severity,
                "service": entry.resource.labels.get("function_name") if entry.resource else None,
                "message": message,
                "correlationId": payload.get("correlationId") or payload.get("correlation_id"),
                "user": user,
                "action": action,
                "resource": resource,
                "status": status,
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
        - member_id: The member's Cloud SQL ID
        - confirmation: Must be "EYÐA VARANLEGA"

    Returns:
        Deletion status.
    """
    # Verify superuser access
    caller_claims = require_superuser(req)
    caller_uid = req.auth.uid

    # Security: Rate limit destructive operations (3 per hour)
    if not check_uid_rate_limit(caller_uid, "hard_delete", max_attempts=3, window_minutes=60):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.RESOURCE_EXHAUSTED,
            message="Rate limit exceeded. Maximum 3 deletions per hour."
        )

    data = req.data or {}
    member_id = data.get("member_id")
    confirmation = data.get("confirmation")

    if not member_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="member_id is required"
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
        # 1. Verify member exists in Cloud SQL (source of truth)
        member = get_member_by_django_id(int(member_id))

        if not member:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message=f"Member not found: {member_id}"
            )

        kennitala = member.get("kennitala")

        # 2. Find firebase_uid by querying /users collection
        firebase_uid = None
        users_query = db.collection("users").where("kennitala", "==", kennitala).limit(1).stream()
        for user_doc in users_query:
            firebase_uid = user_doc.id
            break

        # 3. Delete Firebase Auth user if exists
        if firebase_uid:
            try:
                auth.delete_user(firebase_uid)
                deleted_items.append(f"Firebase Auth user: {firebase_uid}")
            except auth.UserNotFoundError:
                pass  # Already deleted
            except Exception as e:
                errors.append(f"Firebase Auth: {str(e)}")

        # 4. Delete from /users/ collection
        if firebase_uid:
            try:
                db.collection("users").document(firebase_uid).delete()
                deleted_items.append(f"Firestore /users/{firebase_uid}")
            except Exception as e:
                errors.append(f"Firestore /users/: {str(e)}")

        # 5. Delete from Cloud SQL (source of truth)
        sql_result = hard_delete_member_sql(int(member_id))
        if sql_result["success"]:
            deleted_items.append("Cloud SQL member record")
            deleted_items.extend(sql_result.get("deleted_tables", []))
        else:
            errors.extend(sql_result.get("errors", []))

        # 6. Log the action
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
        - member_id: The member's Cloud SQL ID
        - confirmation: Must be "NAFNHREINSA"

    Returns:
        Anonymization status.
    """
    # Verify superuser access
    caller_claims = require_superuser(req)
    caller_uid = req.auth.uid

    # Security: Rate limit destructive operations (5 per hour for anonymization)
    if not check_uid_rate_limit(caller_uid, "anonymize", max_attempts=5, window_minutes=60):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.RESOURCE_EXHAUSTED,
            message="Rate limit exceeded. Maximum 5 anonymizations per hour."
        )

    data = req.data or {}
    member_id = data.get("member_id")
    confirmation = data.get("confirmation")

    if not member_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="member_id is required"
        )

    if confirmation != "NAFNHREINSA":
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="Invalid confirmation phrase"
        )

    db = firestore.client()

    try:
        # 1. Verify member exists in Cloud SQL (source of truth)
        member = get_member_by_django_id(int(member_id))

        if not member:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.NOT_FOUND,
                message=f"Member not found: {member_id}"
            )

        kennitala = member.get("kennitala")

        # 2. Find firebase_uid by querying /users collection
        firebase_uid = None
        users_query = db.collection("users").where("kennitala", "==", kennitala).limit(1).stream()
        for user_doc in users_query:
            firebase_uid = user_doc.id
            break

        # Generate anonymous ID
        import uuid
        anon_id = f"ANON-{uuid.uuid4().hex[:8].upper()}"

        anonymized_items = []

        # 3. Anonymize Firebase Auth user if exists
        if firebase_uid:
            try:
                auth.update_user(
                    firebase_uid,
                    display_name=anon_id,
                    email=f"{anon_id.lower()}@anonymized.local",
                    disabled=True
                )
                anonymized_items.append("Firebase Auth")
            except Exception as e:
                log_json("warning", "Could not anonymize Firebase Auth user",
                         error=str(e), uid=firebase_uid)

            # 4. Delete /users document (contains preferences)
            try:
                db.collection("users").document(firebase_uid).delete()
                anonymized_items.append("/users document")
            except Exception as e:
                log_json("warning", "Could not delete /users document",
                         error=str(e), uid=firebase_uid)

        # 5. Anonymize in Cloud SQL (source of truth)
        sql_result = anonymize_member_sql(int(member_id), anon_id)
        if sql_result["success"]:
            anonymized_items.append("Cloud SQL member record")
            anonymized_items.extend(sql_result.get("anonymized_fields", []))
        else:
            log_json("warning", "Cloud SQL anonymization had errors",
                     errors=sql_result.get("errors"))

        # Log the action
        log_json("warning", "DANGEROUS: Member anonymized (GDPR)",
                 action="anonymize_member",
                 caller_uid=caller_uid,
                 original_kennitala=kennitala[:6] + "****",
                 anon_id=anon_id,
                 items=anonymized_items)

        return {
            "success": True,
            "anon_id": anon_id,
            "anonymized": anonymized_items,
            "message": f"Member anonymized as {anon_id} in Firebase and Cloud SQL."
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
        # NOTE: django_elevated removed - roles come from Firebase only

        # 1. Query /users/ collection for 'roles' array field
        # Note: setUserRole() stores roles as array: ["member", "superuser"]
        superuser_docs = db.collection("users").where("roles", "array_contains", "superuser").stream()
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

        admin_docs = db.collection("users").where("roles", "array_contains", "admin").stream()
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

        # 2. Skip Firebase Auth list_users() - it's too slow (iterates ALL users)
        # The /users/ collection query above is sufficient since:
        # - All elevated users should have a /users/ document
        # - setUserRole() creates/updates /users/ document when setting role
        # - Edge case of claims-only user is rare and acceptable to miss

        # NOTE: Django roles (is_staff, is_superuser) are NO LONGER queried.
        # Elevated users come ONLY from Firebase (/users/ collection).
        # See: tmp/RFC_RBAC_CLEANUP.md

        # Convert to sorted lists
        superusers = sorted(list(superusers_map.values()), key=lambda x: (x["displayName"] or "").lower())
        admins = sorted(list(admins_map.values()), key=lambda x: (x["displayName"] or "").lower())

        log_json("info", "Listed elevated users",
                superuser_count=len(superusers),
                admin_count=len(admins))

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

def get_deleted_counts_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Get counts and details of soft-deleted members and votes.

    Members queried from Cloud SQL (source of truth).
    Votes queried from Firestore (elections service).

    Returns:
        Dict with:
            - counts: { members, votes }
            - deleted_members: List of { id, name, kennitala_masked, deleted_at }
    """
    # Verify superuser access
    require_superuser(req)

    try:
        # Count and list members from Cloud SQL (source of truth)
        deleted_member_count = get_deleted_member_count()
        deleted_member_list = get_deleted_members(limit=50)

        # Count votes with deletedAt != null (if votes collection exists)
        deleted_votes = 0
        try:
            db = firestore.client()
            votes_query = db.collection("votes").where("deletedAt", "!=", None)
            deleted_votes = len(list(votes_query.stream()))
        except Exception:
            pass  # votes collection might not exist

        return {
            "success": True,
            "counts": {
                "members": deleted_member_count,
                "votes": deleted_votes
            },
            "deleted_members": deleted_member_list
        }

    except Exception as e:
        log_json("error", "Failed to get deleted counts", error=str(e))
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Failed to get deleted counts: {str(e)}"
        )


@https_fn.on_call(region="europe-west2")
def purgedeleted(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Permanently delete all soft-deleted members.

    This is a DANGEROUS bulk operation that removes data from:
    - Cloud SQL (source of truth)
    - Firebase Auth
    - Firestore /users collection

    Returns:
        Dict with count of deleted members and any errors.
    """
    # Verify superuser access
    require_superuser(req)
    caller_uid = req.auth.uid

    # Security: Rate limit bulk purge operations (1 per hour)
    if not check_uid_rate_limit(caller_uid, "purge_deleted", max_attempts=1, window_minutes=60):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.RESOURCE_EXHAUSTED,
            message="Rate limit exceeded. Maximum 1 purge per hour."
        )

    try:
        db = firestore.client()

        # 1. Get all soft-deleted members from Cloud SQL (source of truth)
        deleted_members = get_deleted_members(limit=1000)  # Get up to 1000

        if not deleted_members:
            return {
                "success": True,
                "count": 0,
                "message": "No soft-deleted members to purge."
            }

        deleted_count = 0
        errors = []

        # 2. Process each soft-deleted member
        for member in deleted_members:
            member_id = member.get("id")
            kennitala = member.get("kennitala")
            member_name = member.get("name", "Unknown")

            try:
                # 2a. Find Firebase UID by kennitala
                firebase_uid = None
                if kennitala:
                    users_query = db.collection("users").where(
                        "kennitala", "==", kennitala
                    ).limit(1).stream()
                    for user_doc in users_query:
                        firebase_uid = user_doc.id
                        break

                # 2b. Delete Firebase Auth user
                if firebase_uid:
                    try:
                        auth.delete_user(firebase_uid)
                    except auth.UserNotFoundError:
                        pass  # Already deleted
                    except Exception as e:
                        log_json("warning", "Could not delete Firebase Auth",
                                 error=str(e), member_id=member_id)

                    # 2c. Delete Firestore /users document
                    try:
                        db.collection("users").document(firebase_uid).delete()
                    except Exception as e:
                        log_json("warning", "Could not delete /users doc",
                                 error=str(e), member_id=member_id)

                # 2d. Delete from Cloud SQL (source of truth)
                sql_result = hard_delete_member_sql(int(member_id))
                if sql_result["success"]:
                    deleted_count += 1
                else:
                    errors.append(f"{member_name}: {sql_result.get('errors', ['Unknown error'])}")

            except Exception as e:
                errors.append(f"{member_name}: {str(e)}")
                log_json("warning", "Failed to purge member",
                         error=str(e), member_id=member_id)

        # 3. Log the bulk operation
        log_json("warning", "DANGEROUS: Bulk purge of deleted members",
                 action="purge_deleted",
                 caller_uid=caller_uid,
                 deleted_count=deleted_count,
                 error_count=len(errors))

        return {
            "success": len(errors) == 0,
            "count": deleted_count,
            "errors": errors if errors else None,
            "message": f"Permanently deleted {deleted_count} members." + (
                f" {len(errors)} errors occurred." if errors else ""
            )
        }

    except Exception as e:
        log_json("error", "Failed to purge deleted members", error=str(e))
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Failed to purge deleted members: {str(e)}"
        )
