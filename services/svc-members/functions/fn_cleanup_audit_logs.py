"""
Cleanup old audit logs to keep only the most recent N entries.

This prevents members_audit_log collection from growing indefinitely.
Should be run periodically via Cloud Scheduler or manually after large syncs.
"""

from firebase_admin import firestore
from util_logging import log_json


def cleanup_old_audit_logs(keep_count: int = 50) -> dict:
    """
    Keep only the most recent N audit log entries, delete the rest.

    Args:
        keep_count: Number of most recent logs to keep (default: 50)

    Returns:
        Dict with cleanup statistics
    """
    db = firestore.client()

    log_json('INFO', f'Starting audit log cleanup (keeping {keep_count} most recent)',
             event='audit_cleanup_start',
             keep_count=keep_count)

    # Query all audit logs, ordered by timestamp descending
    logs_ref = db.collection('members_audit_log')
    all_logs = logs_ref.order_by('timestamp', direction=firestore.Query.DESCENDING).stream()

    # Convert to list and count
    log_docs = list(all_logs)
    total_count = len(log_docs)

    log_json('INFO', f'Found {total_count} audit log entries',
             event='audit_cleanup_count',
             total_count=total_count,
             keep_count=keep_count)

    # Skip if we're under the limit
    if total_count <= keep_count:
        log_json('INFO', 'No cleanup needed',
                 event='audit_cleanup_skip',
                 total_count=total_count,
                 keep_count=keep_count)
        return {
            'total_logs': total_count,
            'deleted': 0,
            'kept': total_count
        }

    # Delete old logs (everything after index keep_count)
    logs_to_delete = log_docs[keep_count:]
    deleted_count = 0

    # Batch delete (Firestore max batch size is 500)
    batch_size = 500
    for i in range(0, len(logs_to_delete), batch_size):
        batch = db.batch()
        batch_logs = logs_to_delete[i:i + batch_size]

        for log_doc in batch_logs:
            batch.delete(log_doc.reference)

        batch.commit()
        deleted_count += len(batch_logs)

        log_json('INFO', f'Deleted batch of {len(batch_logs)} audit logs',
                 event='audit_cleanup_batch',
                 batch_size=len(batch_logs),
                 deleted_so_far=deleted_count)

    log_json('INFO', f'Audit log cleanup complete',
             event='audit_cleanup_complete',
             total_logs=total_count,
             deleted=deleted_count,
             kept=keep_count)

    return {
        'total_logs': total_count,
        'deleted': deleted_count,
        'kept': keep_count
    }


# For testing/manual execution
if __name__ == '__main__':
    import firebase_admin

    # Initialize Firebase (if not already initialized)
    try:
        firebase_admin.get_app()
    except ValueError:
        firebase_admin.initialize_app()

    # Run cleanup
    result = cleanup_old_audit_logs(keep_count=50)
    log_json('INFO', f"Cleanup complete: {result}")
