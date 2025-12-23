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
    updatememberprofile_handler,
    # Note: cleanupauditlogs_handler removed - /members_audit_log no longer used
    soft_delete_self_handler,
    reactivate_self_handler
)

# Define decorated functions in main.py (required by Firebase Functions SDK)
@https_fn.on_call(
    region="europe-west2",
    memory=options.MemoryOption.MB_256,
    timeout_sec=30,
    secrets=["django-socialism-db-password"],  # Cloud SQL access
)
def verifyMembership(req: https_fn.CallableRequest) -> dict:
    """Verify membership - delegates to handler (reads from Cloud SQL)"""
    return verifyMembership_handler(req)

@https_fn.on_call(timeout_sec=30, memory=256, secrets=["django-api-token"])
def updatememberprofile(req: https_fn.CallableRequest):
    """Update member profile - delegates to handler"""
    return updatememberprofile_handler(req)

# Note: cleanupauditlogs removed - /members_audit_log no longer used (Cloud SQL is source of truth)

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

# Note: get_django_token removed - Linode decommissioned 2025-12-11, Django now on Cloud Run

# Note: auditmemberchanges removed - /members collection no longer used (Cloud SQL is source of truth)

# Note: sync_from_django removed - Cloud Functions now read directly from Cloud SQL

# Note: sync_banned_kennitala removed - banned kennitalas checked directly in Cloud SQL

# ==============================================================================
# ADDRESS VALIDATION FUNCTIONS (iceaddr integration)
# ==============================================================================

# Import address validation functions
from fn_validate_address import validate_address, validate_postal_code

# Import address search function (autocomplete)
from fn_search_addresses import search_addresses


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
from fn_member_heatmap import get_member_heatmap_data, compute_member_heatmap_stats

# Import registration function
from fn_register_member import register_member

# ==============================================================================
# ADMIN MEMBER FUNCTIONS (Cloud SQL source of truth)
# ==============================================================================

# Import admin member handlers
from fn_admin_members import (
    list_members_handler,
    get_member_handler,
    get_member_stats_handler,
    get_member_self_handler  # Self-service: member gets own data
)

# Define decorated functions for admin member operations
@https_fn.on_call(
    timeout_sec=30,
    memory=options.MemoryOption.MB_512,
    secrets=["django-socialism-db-password"]
)
def listMembers(req: https_fn.CallableRequest) -> dict:
    """List members from Cloud SQL - requires admin"""
    return list_members_handler(req)

@https_fn.on_call(
    timeout_sec=30,
    memory=options.MemoryOption.MB_256,
    secrets=["django-socialism-db-password"]
)
def getMember(req: https_fn.CallableRequest) -> dict:
    """Get single member from Cloud SQL - requires admin"""
    return get_member_handler(req)

@https_fn.on_call(
    timeout_sec=30,
    memory=options.MemoryOption.MB_256,
    secrets=["django-socialism-db-password"]
)
def getMemberStats(req: https_fn.CallableRequest) -> dict:
    """Get member statistics from Cloud SQL - requires admin"""
    return get_member_stats_handler(req)

# ==============================================================================
# SELF-SERVICE MEMBER FUNCTIONS (Cloud SQL source of truth)
# ==============================================================================

@https_fn.on_call(
    timeout_sec=30,
    memory=options.MemoryOption.MB_256,
    secrets=["django-socialism-db-password"]
)
def getMemberSelf(req: https_fn.CallableRequest) -> dict:
    """Get authenticated user's own member data from Cloud SQL"""
    return get_member_self_handler(req)

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
    list_email_logs_handler,
    unsubscribe_handler,
    get_email_preferences_handler,
    update_email_preferences_handler
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

@https_fn.on_call(timeout_sec=60, memory=256, secrets=["sendgrid-api-key", "resend-api-key", "unsubscribe-secret"])
def sendEmail(req: https_fn.CallableRequest) -> dict:
    """Send email via SendGrid (primary) or Resend (backup) - requires admin"""
    return send_email_handler(req)

@https_fn.on_call(timeout_sec=30, memory=256)
def listEmailCampaigns(req: https_fn.CallableRequest) -> dict:
    """List email campaigns - requires admin"""
    return list_email_campaigns_handler(req)

@https_fn.on_call(timeout_sec=30, memory=256)
def createEmailCampaign(req: https_fn.CallableRequest) -> dict:
    """Create a new email campaign - requires admin"""
    return create_email_campaign_handler(req)

@https_fn.on_call(timeout_sec=540, memory=512, secrets=["sendgrid-api-key", "resend-api-key"])
def sendCampaign(req: https_fn.CallableRequest) -> dict:
    """Send campaign via SendGrid (primary) or Resend (backup) - requires admin"""
    return send_campaign_handler(req)

@https_fn.on_call(timeout_sec=30, memory=256)
def getEmailStats(req: https_fn.CallableRequest) -> dict:
    """Get email sending statistics - requires admin"""
    return get_email_stats_handler(req)

@https_fn.on_call(timeout_sec=30, memory=256)
def listEmailLogs(req: https_fn.CallableRequest) -> dict:
    """List email send logs - requires admin"""
    return list_email_logs_handler(req)

@https_fn.on_call(timeout_sec=30, memory=256, secrets=["unsubscribe-secret"])
def unsubscribe(req: https_fn.CallableRequest) -> dict:
    """Unsubscribe from marketing emails - uses signed token, no auth required"""
    return unsubscribe_handler(req)

@https_fn.on_call(timeout_sec=30, memory=256)
def getEmailPreferences(req: https_fn.CallableRequest) -> dict:
    """Get email preferences for current user - requires auth"""
    return get_email_preferences_handler(req)

@https_fn.on_call(timeout_sec=30, memory=256)
def updateEmailPreferences(req: https_fn.CallableRequest) -> dict:
    """Update email preferences for current user - requires auth"""
    return update_email_preferences_handler(req)

# Note: ses_webhook removed - now using Resend, not AWS SES

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
    'updatememberprofile',
    # Note: cleanupauditlogs removed - /members_audit_log no longer used
    'softDeleteSelf',
    'reactivateSelf',
    # Audit and sync functions
    # Note: auditmemberchanges removed - /members collection no longer used
    # Note: get_django_token removed - Linode decommissioned 2025-12-11
    # Address validation functions
    'validate_address',
    'validate_postal_code',
    # Address search (autocomplete)
    'search_addresses',
    # Municipality migration (issue #330) - module does not exist
    # 'run_municipality_migration',
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
    'get_member_heatmap_data',
    'compute_member_heatmap_stats',  # Hourly scheduled heatmap update
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
    'unsubscribe',
    'getEmailPreferences',
    'updateEmailPreferences',
    # Note: ses_webhook removed - now using Resend
    # Admin member functions (Cloud SQL)
    'listMembers',
    'getMember',
    'getMemberStats',
    # Self-service member functions (Cloud SQL)
    'getMemberSelf',
]
