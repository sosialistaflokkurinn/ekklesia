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

# Import authentication functions
from auth.kenni_flow import healthz, handleKenniAuth

# ==============================================================================
# MEMBERSHIP FUNCTIONS
# ==============================================================================

# Import membership management functions
from membership.functions import (
    verifyMembership,
    syncmembers,
    updatememberprofile,
    cleanupauditlogs
)

# ==============================================================================
# AUDIT AND SYNC FUNCTIONS (Epic #116, Epic #159)
# ==============================================================================

# Import functions from existing modules
# NOTE: These are already in separate files and work correctly
from audit_members import auditmemberchanges
from get_django_token import get_django_token
from update_member_foreign_address import updatememberforeignaddress
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
    'updatememberforeignaddress',
    'bidirectional_sync',
    'track_firestore_changes',
]
