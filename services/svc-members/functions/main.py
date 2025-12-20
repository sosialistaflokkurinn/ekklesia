"""
Cloud Functions for Ekklesia Members Service

Main entry point that imports and re-exports all Cloud Functions.
Firebase Functions discovers functions by scanning this file.
"""

import firebase_admin
from firebase_admin import initialize_app
from firebase_functions import options

# Initialize Firebase Admin SDK
if not firebase_admin._apps:
    initialize_app()

# Set global options for all functions
options.set_global_options(region="europe-west2")

# ==============================================================================
# AUTHENTICATION FUNCTIONS
# ==============================================================================

# Import authentication handlers (not decorated)
from auth.kenni_flow import healthz_handler, handleKenniAuth_handler
from firebase_functions import https_fn

# Define decorated functions in main.py (required by Firebase Functions SDK)
@https_fn.on_request()
def healthz(req: https_fn.Request) -> https_fn.Response:
    """Health check endpoint - delegates to handler"""
    return healthz_handler(req)

@https_fn.on_request(secrets=["kenni-client-secret"])
def handleKenniAuth(req: https_fn.Request) -> https_fn.Response:
    """OAuth authentication endpoint - delegates to handler"""
    return handleKenniAuth_handler(req)

# ==============================================================================
# MEMBERSHIP FUNCTIONS
# ==============================================================================

# Import membership handlers (not decorated)
from membership.functions import (
    verifyMembership_handler,
    syncmembers_handler,
    updatememberprofile_handler,
    cleanupauditlogs_handler,
    soft_delete_self_handler,
    reactivate_self_handler
)

# Define decorated functions in main.py (required by Firebase Functions SDK)
@https_fn.on_call()
def verifyMembership(req: https_fn.CallableRequest) -> dict:
    """Verify membership - delegates to handler"""
    return verifyMembership_handler(req)

@https_fn.on_request(timeout_sec=540, memory=512, secrets=["django-api-token"])
def syncmembers(req: https_fn.Request) -> https_fn.Response:
    """Sync members from Django - delegates to handler"""
    return syncmembers_handler(req)

@https_fn.on_call(timeout_sec=30, memory=256, secrets=["django-api-token"])
def updatememberprofile(req: https_fn.CallableRequest):
    """Update member profile - delegates to handler"""
    return updatememberprofile_handler(req)

@https_fn.on_call(
    region="europe-west2",
    memory=options.MemoryOption.MB_256,
    timeout_sec=300
)
def cleanupauditlogs(req: https_fn.CallableRequest) -> dict:
    """Cleanup audit logs - delegates to handler"""
    return cleanupauditlogs_handler(req)

@https_fn.on_call(timeout_sec=30, memory=256, secrets=["django-api-token"])
def softDeleteSelf(req: https_fn.CallableRequest) -> dict:
    """User soft-deletes their own membership - delegates to handler"""
    return soft_delete_self_handler(req)

@https_fn.on_call(timeout_sec=30, memory=256, secrets=["django-api-token"])
def reactivateSelf(req: https_fn.CallableRequest) -> dict:
    """User reactivates their soft-deleted membership - delegates to handler"""
    return reactivate_self_handler(req)

# ==============================================================================
# AUDIT AND SYNC FUNCTIONS (Epic #116, Epic #159)
# ==============================================================================

# Import functions from existing modules
from fn_audit_members import auditmemberchanges
from fn_get_django_token import get_django_token

# Real-time sync from Django to Firestore (replaces bidirectional_sync and track_member_changes)
from fn_sync_from_django import sync_from_django

# Sync banned kennitalas from Django to Firestore (shadow ban feature)
from fn_sync_banned_kennitala import sync_banned_kennitala

# ==============================================================================
# ADDRESS VALIDATION FUNCTIONS (iceaddr integration)
# ==============================================================================

# Import address validation functions
from fn_validate_address import validate_address, validate_postal_code

# Import address search function (autocomplete)
from fn_search_addresses import search_addresses

# Import municipality migration function (issue #330)
from fn_migrate_municipality import run_municipality_migration

# ==============================================================================
# SUPERUSER FUNCTIONS (Epic: Superuser Console)
# ==============================================================================

# Import superuser handlers
from fn_superuser import (
    set_user_role_handler,
    get_user_role_handler,
    check_system_health_handler,
    get_audit_logs_handler,
    hard_delete_member_handler,
    anonymize_member_handler,
    list_elevated_users_handler,
    get_login_audit_handler,
    get_deleted_counts_handler,
    purgedeleted  # Decorated function - import directly
)

# Define decorated functions for superuser operations
@https_fn.on_call(timeout_sec=30, memory=256)
def setUserRole(req: https_fn.CallableRequest) -> dict:
    """Set Firebase custom claims for a user - requires superuser"""
    return set_user_role_handler(req)

@https_fn.on_call(timeout_sec=30, memory=256)
def getUserRole(req: https_fn.CallableRequest) -> dict:
    """Get Firebase custom claims for a user - requires superuser"""
    return get_user_role_handler(req)

@https_fn.on_call(timeout_sec=60, memory=256)
def checkSystemHealth(req: https_fn.CallableRequest) -> dict:
    """Check health of all Cloud Run services - requires superuser"""
    return check_system_health_handler(req)

@https_fn.on_call(timeout_sec=60, memory=512)
def getAuditLogs(req: https_fn.CallableRequest) -> dict:
    """Query Cloud Logging for audit events - requires superuser"""
    return get_audit_logs_handler(req)

@https_fn.on_call(timeout_sec=60, memory=256)
def hardDeleteMember(req: https_fn.CallableRequest) -> dict:
    """Permanently delete a member - requires superuser and confirmation"""
    return hard_delete_member_handler(req)

@https_fn.on_call(timeout_sec=60, memory=256)
def anonymizeMember(req: https_fn.CallableRequest) -> dict:
    """Anonymize member PII for GDPR - requires superuser and confirmation"""
    return anonymize_member_handler(req)

@https_fn.on_call(timeout_sec=30, memory=256)
def getLoginAudit(req: https_fn.CallableRequest) -> dict:
    """Get login history from Firestore - requires superuser"""
    return get_login_audit_handler(req)

@https_fn.on_call(timeout_sec=30, memory=256)
def getDeletedCounts(req: https_fn.CallableRequest) -> dict:
    """Get counts of soft-deleted members and votes - requires superuser"""
    return get_deleted_counts_handler(req)

@https_fn.on_call(timeout_sec=120, memory=512, secrets=["django-api-token"])
def listElevatedUsers(req: https_fn.CallableRequest) -> dict:
    """List all users with admin or superuser roles - requires superuser"""
    return list_elevated_users_handler(req)

# ==============================================================================
# LOOKUP FUNCTIONS (skraning-static registration form)
# ==============================================================================

# Import lookup functions for registration form dropdowns
from fn_list_unions import list_unions
from fn_list_job_titles import list_job_titles
from fn_list_countries import list_countries
from fn_list_postal_codes import list_postal_codes
from fn_cells_by_postal_code import get_cells_by_postal_code

# Import registration function
from fn_register_member import register_member

# ==============================================================================
# EMAIL FUNCTIONS (Issue #323 - Postmark Integration)
# ==============================================================================

# Import email handlers
from fn_email import (
    list_email_templates_handler,
    get_email_template_handler,
    save_email_template_handler,
    delete_email_template_handler,
    send_email_handler,
    list_email_campaigns_handler,
    create_email_campaign_handler,
    send_campaign_handler,
    get_email_stats_handler,
    list_email_logs_handler
)

# Define decorated functions for email operations
@https_fn.on_call(timeout_sec=30, memory=256)
def listEmailTemplates(req: https_fn.CallableRequest) -> dict:
    """List all email templates - requires admin"""
    return list_email_templates_handler(req)

@https_fn.on_call(timeout_sec=30, memory=256)
def getEmailTemplate(req: https_fn.CallableRequest) -> dict:
    """Get a single email template - requires admin"""
    return get_email_template_handler(req)

@https_fn.on_call(timeout_sec=30, memory=256)
def saveEmailTemplate(req: https_fn.CallableRequest) -> dict:
    """Create or update an email template - requires admin"""
    return save_email_template_handler(req)

@https_fn.on_call(timeout_sec=30, memory=256)
def deleteEmailTemplate(req: https_fn.CallableRequest) -> dict:
    """Delete an email template - requires admin"""
    return delete_email_template_handler(req)

@https_fn.on_call(timeout_sec=60, memory=256, secrets=["aws-ses-access-key", "aws-ses-secret-key"])
def sendEmail(req: https_fn.CallableRequest) -> dict:
    """Send a single transactional email via Amazon SES - requires admin"""
    return send_email_handler(req)

@https_fn.on_call(timeout_sec=30, memory=256)
def listEmailCampaigns(req: https_fn.CallableRequest) -> dict:
    """List email campaigns - requires admin"""
    return list_email_campaigns_handler(req)

@https_fn.on_call(timeout_sec=30, memory=256)
def createEmailCampaign(req: https_fn.CallableRequest) -> dict:
    """Create a new email campaign - requires admin"""
    return create_email_campaign_handler(req)

@https_fn.on_call(timeout_sec=540, memory=512, secrets=["aws-ses-access-key", "aws-ses-secret-key"])
def sendCampaign(req: https_fn.CallableRequest) -> dict:
    """Send an email campaign to all recipients via Amazon SES - requires admin"""
    return send_campaign_handler(req)

@https_fn.on_call(timeout_sec=30, memory=256)
def getEmailStats(req: https_fn.CallableRequest) -> dict:
    """Get email sending statistics - requires admin"""
    return get_email_stats_handler(req)

@https_fn.on_call(timeout_sec=30, memory=256)
def listEmailLogs(req: https_fn.CallableRequest) -> dict:
    """List email send logs - requires admin"""
    return list_email_logs_handler(req)

# Import SES webhook handler (HTTP function, already decorated)
from fn_ses_webhook import ses_webhook

# ==============================================================================
# EXPORTS
# ==============================================================================

# Re-export all functions at module level so Firebase discovers them
# This list must include all Cloud Functions that should be deployed
__all__ = [
    # Auth functions
    'healthz',
    'handleKenniAuth',
    # Membership functions
    'verifyMembership',
    'syncmembers',
    'updatememberprofile',
    'cleanupauditlogs',
    'softDeleteSelf',
    'reactivateSelf',
    # Audit and sync functions
    'auditmemberchanges',
    'get_django_token',
    'sync_from_django',  # Real-time Django → Firestore sync
    'sync_banned_kennitala',  # Django → Firestore banned kennitalas sync
    # Address validation functions
    'validate_address',
    'validate_postal_code',
    # Address search (autocomplete)
    'search_addresses',
    # Municipality migration (issue #330)
    'run_municipality_migration',
    # Superuser functions
    'setUserRole',
    'getUserRole',
    'checkSystemHealth',
    'getAuditLogs',
    'hardDeleteMember',
    'anonymizeMember',
    'getLoginAudit',
    'getDeletedCounts',
    'listElevatedUsers',
    'purgedeleted',
    # Lookup functions (skraning-static)
    'list_unions',
    'list_job_titles',
    'list_countries',
    'list_postal_codes',
    'get_cells_by_postal_code',
    # Registration function
    'register_member',
    # Email functions (Issue #323)
    'listEmailTemplates',
    'getEmailTemplate',
    'saveEmailTemplate',
    'deleteEmailTemplate',
    'sendEmail',
    'listEmailCampaigns',
    'createEmailCampaign',
    'sendCampaign',
    'getEmailStats',
    'listEmailLogs',
    'ses_webhook',
]
