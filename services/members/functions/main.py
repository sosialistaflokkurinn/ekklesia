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
    cleanupauditlogs_handler
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

# ==============================================================================
# AUDIT AND SYNC FUNCTIONS (Epic #116, Epic #159)
# ==============================================================================

# Import functions from existing modules
# NOTE: These are already in separate files and work correctly
from audit_members import auditmemberchanges
from get_django_token import get_django_token
from bidirectional_sync import bidirectional_sync
from track_member_changes import track_firestore_changes

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
    # Audit and sync functions
    'auditmemberchanges',
    'get_django_token',
    'bidirectional_sync',
    'track_firestore_changes',
]
