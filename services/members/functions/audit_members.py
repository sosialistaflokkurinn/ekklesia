"""
Firestore trigger for auditing member changes (Epic #116, Issue #119)

This Cloud Function triggers on any write to the members collection
and creates an immutable audit log entry with before/after snapshots.
"""

from typing import Optional, Dict, Any, List
from datetime import datetime
import firebase_admin
from firebase_admin import auth, firestore
from firebase_functions import firestore_fn, options

from utils_logging import log_json


def _calculate_diff(before: Optional[Dict], after: Optional[Dict]) -> List[str]:
    """Calculate which fields changed between before and after."""
    if before is None and after is None:
        return []
    if before is None:
        return list(after.keys()) if after else []
    if after is None:
        return list(before.keys()) if before else []
    
    diff = []
    all_keys = set(before.keys()) | set(after.keys())
    for key in all_keys:
        before_val = before.get(key)
        after_val = after.get(key)
        if before_val != after_val:
            diff.append(key)
    
    return diff


def _determine_action(
    before_exists: bool,
    after_exists: bool,
    after_data: Optional[Dict]
) -> str:
    """Determine what type of action occurred."""
    if not before_exists and after_exists:
        return 'create'
    elif before_exists and not after_exists:
        return 'delete'
    elif before_exists and after_exists:
        # Check if this is a restore (status changed from inactive to active)
        if after_data and after_data.get('status') == 'active':
            # Would need to check before.status=='inactive' to confirm restore
            # For now, treat all updates as 'update'
            return 'update'
        return 'update'
    else:
        # Should never happen, but handle gracefully
        return 'unknown'


async def _get_admin_email(admin_id: str) -> str:
    """Get admin email from Firebase Auth, with error handling."""
    try:
        user = await auth.get_user(admin_id)
        return user.email or f"unknown-{admin_id}"
    except Exception as e:
        log_json('ERROR', 'Failed to get admin email',
                 event='audit_get_admin_email_failed',
                 admin_id=admin_id,
                 error=str(e))
        return f"error-{admin_id}"


@firestore_fn.on_document_written(
    document="members/{kennitala}",
    region="europe-west2",
    memory=options.MemoryOption.MB_256,
    timeout_sec=60
)
async def audit_member_changes(
    event: firestore_fn.Event[firestore_fn.Change[firestore_fn.DocumentSnapshot]]
) -> None:
    """
    Firestore trigger that creates an audit log entry for any member change.
    
    Triggered on: create, update, delete operations on members/{kennitala}
    Creates: Document in members_audit_log collection
    
    Args:
        event: Firestore event with before/after snapshots
    """
    kennitala = event.params["kennitala"]
    change = event.data
    
    # Get before and after snapshots
    before_exists = change.before.exists if change.before else False
    after_exists = change.after.exists if change.after else False
    before_data = change.before.to_dict() if before_exists else None
    after_data = change.after.to_dict() if after_exists else None
    
    # Determine action type
    action = _determine_action(before_exists, after_exists, after_data)
    
    # Get admin ID from document metadata
    admin_id = 'system'  # Default
    if after_data:
        admin_id = after_data.get('updatedBy') or after_data.get('createdBy') or 'system'
    elif before_data:
        admin_id = before_data.get('updatedBy') or before_data.get('createdBy') or 'system'
    
    # Get admin email
    admin_email = await _get_admin_email(admin_id)
    
    # Get member name
    member_name = 'Unknown'
    if after_data:
        member_name = after_data.get('name', 'Unknown')
    elif before_data:
        member_name = before_data.get('name', 'Unknown')
    
    # Calculate diff
    diff = _calculate_diff(before_data, after_data)
    
    # Create audit log entry
    db = firestore.client()
    timestamp_ms = int(datetime.now().timestamp() * 1000)
    log_id = f"{timestamp_ms}_{admin_id}_{action}_{kennitala}"
    
    audit_entry = {
        'adminId': admin_id,
        'adminEmail': admin_email,
        'action': action,
        'memberId': kennitala,
        'memberName': member_name,
        'timestamp': firestore.SERVER_TIMESTAMP,
        'changes': {
            'before': before_data,
            'after': after_data,
            'diff': diff
        },
        'source': 'firestore-trigger',
        'success': True
    }
    
    try:
        await db.collection('members_audit_log').document(log_id).set(audit_entry)
        
        log_json('INFO', 'Audit log created',
                 event='audit_member_changes_success',
                 log_id=log_id,
                 action=action,
                 member_id=kennitala,
                 admin_id=admin_id,
                 changes_count=len(diff))
        
    except Exception as e:
        log_json('ERROR', 'Failed to create audit log',
                 event='audit_member_changes_failed',
                 log_id=log_id,
                 action=action,
                 member_id=kennitala,
                 admin_id=admin_id,
                 error=str(e))
        
        # Don't raise exception - we don't want to block the original operation
        # Just log the failure and continue
        pass


# Export function for Firebase Functions
__all__ = ['audit_member_changes']
