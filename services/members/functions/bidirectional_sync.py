"""
Bi-Directional Sync: Django ↔ Firestore
Runs daily at 3:30 AM via Cloud Scheduler

This function syncs changes in both directions:
1. Firestore → Django (member edits in Ekklesia)
2. Django → Firestore (member edits in Django admin)
"""

import requests
from datetime import datetime, timezone, timedelta
from google.cloud import firestore
from google.cloud.secretmanager import SecretManagerServiceClient
from utils_logging import log_json
from sync_members import (
    get_django_api_token,
    fetch_members_from_django,
    transform_django_member_to_firestore,
    normalize_kennitala
)
import os

# Django API base URL - use environment variable or default
DJANGO_API_BASE_URL = os.getenv('DJANGO_API_BASE_URL', 'https://felagakerfi.piratar.is/felagar')


def get_last_sync_time(db: firestore.Client) -> datetime:
    """
    Get timestamp of last successful bidirectional sync.
    
    Returns:
        datetime - Last sync time, or 24 hours ago if no previous sync
    """
    try:
        sync_logs = db.collection('sync_logs') \
            .where('type', '==', 'bidirectional_sync') \
            .where('status', '==', 'success') \
            .order_by('completed_at', direction=firestore.Query.DESCENDING) \
            .limit(1) \
            .stream()
        
        for log in sync_logs:
            completed_at = log.to_dict().get('completed_at')
            if completed_at:
                log_json('INFO', 'Found last sync time', last_sync=completed_at.isoformat())
                return completed_at
    except Exception as e:
        log_json('WARN', 'Could not get last sync time', error=str(e))
    
    # Default: 24 hours ago
    default_time = datetime.now(timezone.utc) - timedelta(hours=24)
    log_json('INFO', 'Using default sync time', default_time=default_time.isoformat())
    return default_time


def get_pending_firestore_changes(db: firestore.Client, since: datetime) -> list:
    """
    Get pending changes from Firestore sync queue.
    
    Args:
        db: Firestore client
        since: Only get changes after this time
    
    Returns:
        list of dicts with change information
    """
    try:
        query = db.collection('sync_queue') \
            .where('source', '==', 'firestore') \
            .where('target', '==', 'django') \
            .where('sync_status', '==', 'pending') \
            .where('created_at', '>', since) \
            .order_by('created_at') \
            .stream()
        
        changes = []
        for doc in query:
            data = doc.to_dict()
            data['sync_queue_id'] = doc.id
            changes.append(data)
        
        log_json('INFO', 'Fetched Firestore changes', count=len(changes))
        return changes
    
    except Exception as e:
        log_json('ERROR', 'Failed to fetch Firestore changes', error=str(e))
        return []


def push_to_django(db: firestore.Client, changes: list, token: str) -> dict:
    """
    Push Firestore changes to Django.
    
    POST /api/sync/apply/ with changes
    
    Returns:
        dict with success/failed counts
    """
    if not changes:
        log_json('INFO', 'No Firestore changes to push')
        return {'success': 0, 'failed': 0}
    
    # Group changes by kennitala (merge multiple field updates for same member)
    grouped = {}
    for change in changes:
        kennitala = change['kennitala']
        if kennitala not in grouped:
            grouped[kennitala] = {
                'kennitala': kennitala,
                'django_id': change.get('django_id'),
                'action': change['action'],
                'changes': {}
            }
        
        # Merge field changes
        grouped[kennitala]['changes'].update(change['changes'])
    
    url = f"{DJANGO_API_BASE_URL}/api/sync/apply/"
    headers = {
        'Authorization': f'Token {token}',
        'Content-Type': 'application/json'
    }
    payload = {'changes': list(grouped.values())}
    
    log_json('INFO', 'Pushing to Django', 
             url=url, 
             count=len(grouped),
             changes=list(grouped.keys())[:5])  # Log first 5 SSNs
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=120)
        response.raise_for_status()
        results = response.json()['results']
        
        # Update sync queue status
        success_count = 0
        failed_count = 0
        
        for i, result in enumerate(results):
            sync_queue_id = changes[i]['sync_queue_id']
            
            if result.get('status') == 'success':
                # Mark as synced
                db.collection('sync_queue').document(sync_queue_id).update({
                    'synced_at': firestore.SERVER_TIMESTAMP,
                    'sync_status': 'synced'
                })
                success_count += 1
            else:
                # Mark as failed
                db.collection('sync_queue').document(sync_queue_id).update({
                    'sync_status': 'failed',
                    'error_message': result.get('message', 'Unknown error')
                })
                failed_count += 1
                log_json('ERROR', 'Django sync failed',
                         kennitala=result.get('ssn'),
                         error=result.get('message'))
        
        return {'success': success_count, 'failed': failed_count}
    
    except requests.exceptions.RequestException as e:
        log_json('ERROR', 'Django API request failed', error=str(e))
        # Mark all as failed
        for change in changes:
            db.collection('sync_queue').document(change['sync_queue_id']).update({
                'sync_status': 'failed',
                'error_message': f'API request failed: {str(e)}'
            })
        return {'success': 0, 'failed': len(changes)}


def get_pending_django_changes(since: datetime, token: str) -> list:
    """
    Get pending changes from Django sync queue.
    
    GET /api/sync/changes/?since=<timestamp>
    
    Returns:
        list of change dicts
    """
    url = f"{DJANGO_API_BASE_URL}/api/sync/changes/"
    headers = {'Authorization': f'Token {token}'}
    params = {'since': since.isoformat()}
    
    log_json('INFO', 'Fetching Django changes', url=url, since=since.isoformat())
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=60)
        response.raise_for_status()
        data = response.json()
        changes = data.get('changes', [])
        
        log_json('INFO', 'Fetched Django changes', count=len(changes))
        return changes
    
    except requests.exceptions.RequestException as e:
        log_json('ERROR', 'Failed to fetch Django changes', error=str(e))
        return []


def pull_to_firestore(db: firestore.Client, changes: list, token: str) -> dict:
    """
    Pull Django changes to Firestore.
    
    For each change:
    - create: Fetch full member data from Django
    - update: Update specific fields
    - delete: Soft delete (mark as inactive)
    
    Returns:
        dict with success/failed counts
    """
    if not changes:
        log_json('INFO', 'No Django changes to pull')
        return {'success': 0, 'failed': 0}
    
    stats = {'success': 0, 'failed': 0}
    sync_ids_to_mark = []
    
    for change in changes:
        try:
            ssn = change['ssn']
            action = change['action']
            sync_id = change['id']
            
            # Normalize kennitala for Firestore doc ID (remove dash)
            kennitala_key = ssn.replace('-', '') if '-' in ssn else ssn
            member_ref = db.collection('members').document(kennitala_key)
            
            if action == 'create':
                # New member - fetch full data from Django
                log_json('INFO', 'Creating new member from Django', kennitala=ssn)
                
                # Fetch member data from Django API
                url = f"{DJANGO_API_BASE_URL}/api/sync/member/{ssn}/"
                headers = {'Authorization': f'Token {token}'}
                response = requests.get(url, headers=headers, timeout=10)
                
                if response.status_code == 200:
                    member_data = response.json()
                    
                    # Transform to Firestore format
                    firestore_doc = {
                        'kennitala': kennitala_key,
                        'profile': {
                            'name': member_data.get('name', ''),
                            'birthday': member_data.get('birthday'),
                            'gender': ['unknown', 'male', 'female', 'other'][member_data.get('gender', 0)],
                            'email': member_data.get('email', ''),
                            'phone': member_data.get('phone', ''),
                        },
                        'membership': {
                            'status': 'active',
                            'joined': member_data.get('date_joined'),
                        },
                        'privacy': {
                            'reachable': member_data.get('reachable', False),
                            'groupable': member_data.get('groupable', False),
                        },
                        'metadata': {
                            'created_at': firestore.SERVER_TIMESTAMP,
                            'last_sync': firestore.SERVER_TIMESTAMP,
                            'source': 'django'
                        }
                    }
                    
                    # Add address if present
                    if member_data.get('street_address'):
                        firestore_doc['profile']['address'] = {
                            'street': member_data.get('street_address', ''),
                            'postalcode': member_data.get('postal_code', ''),
                            'city': member_data.get('city', '')
                        }
                    
                    # Create Firestore document
                    member_ref.set(firestore_doc)
                    log_json('INFO', 'Created member in Firestore', kennitala=ssn)
                    stats['success'] += 1
                    sync_ids_to_mark.append(sync_id)
                else:
                    log_json('ERROR', 'Failed to fetch member from Django',
                             kennitala=ssn,
                             status_code=response.status_code)
                    stats['failed'] += 1
                
                continue
            
            elif action == 'update':
                # Update specific fields
                updates = {}
                for field, value in change.get('fields_changed', {}).items():
                    # Map Django fields to Firestore paths
                    if field == 'name':
                        updates['profile.name'] = value
                    
                    elif field == 'birthday':
                        if value:
                            # Convert ISO date string to Firestore date string
                            # value is already ISO format (YYYY-MM-DD) from Django
                            updates['profile.birthday'] = value
                    
                    elif field == 'gender':
                        # Django: 0=unknown, 1=male, 2=female, 3=other
                        # Firestore: 'unknown', 'male', 'female', 'other'
                        gender_map = {
                            0: 'unknown',
                            1: 'male', 
                            2: 'female',
                            3: 'other'
                        }
                        if isinstance(value, int):
                            updates['profile.gender'] = gender_map.get(value, 'unknown')
                        else:
                            updates['profile.gender'] = value
                    
                    elif field == 'housing_situation':
                        # Django: Integer enum values
                        # Firestore: String values
                        housing_map = {
                            0: 'unknown',
                            1: 'owner',
                            2: 'rental',
                            3: 'cooperative',
                            4: 'family',
                            5: 'other',
                            6: 'homeless'
                        }
                        if isinstance(value, int):
                            updates['profile.housingSituation'] = housing_map.get(value, 'unknown')
                        else:
                            updates['profile.housingSituation'] = value
                    
                    # Handle other common fields
                    elif field == 'street_address':
                        if value:
                            updates['profile.address.street'] = value
                    elif field == 'postal_code':
                        if value:
                            updates['profile.address.postalcode'] = value
                    elif field == 'city':
                        if value:
                            updates['profile.address.city'] = value
                    elif field == 'email':
                        if value:
                            updates['profile.email'] = value
                    elif field == 'phone':
                        if value:
                            updates['profile.phone'] = value
                
                if updates:
                    updates['metadata.last_modified'] = firestore.SERVER_TIMESTAMP
                    updates['metadata.last_sync'] = firestore.SERVER_TIMESTAMP
                    member_ref.update(updates)
                    log_json('INFO', 'Updated member from Django',
                             kennitala=ssn,
                             fields=list(updates.keys()))
            
            elif action == 'delete':
                # Soft delete (mark as inactive)
                # Check if document exists first
                doc = member_ref.get()
                if doc.exists:
                    member_ref.update({
                        'membership.status': 'inactive',
                        'metadata.deleted_at': firestore.SERVER_TIMESTAMP,
                        'metadata.last_sync': firestore.SERVER_TIMESTAMP
                    })
                    log_json('INFO', 'Soft-deleted member', kennitala=ssn)
                else:
                    # Document doesn't exist, nothing to delete
                    log_json('WARN', 'Cannot delete non-existent member', kennitala=ssn)
            
            stats['success'] += 1
            sync_ids_to_mark.append(sync_id)
        
        except Exception as e:
            stats['failed'] += 1
            log_json('ERROR', 'Failed to apply Django change',
                     kennitala=change.get('ssn'),
                     error=str(e))
    
    # Mark synced in Django
    if sync_ids_to_mark:
        mark_django_changes_synced(sync_ids_to_mark, token)
    
    return stats


def mark_django_changes_synced(sync_ids: list, token: str):
    """
    Mark Django sync queue items as synced.
    
    POST /api/sync/mark-synced/ with sync_ids
    """
    url = f"{DJANGO_API_BASE_URL}/api/sync/mark-synced/"
    headers = {
        'Authorization': f'Token {token}',
        'Content-Type': 'application/json'
    }
    payload = {'sync_ids': sync_ids}
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=60)
        response.raise_for_status()
        log_json('INFO', 'Marked Django changes as synced', count=len(sync_ids))
    except requests.exceptions.RequestException as e:
        log_json('ERROR', 'Failed to mark Django changes as synced', error=str(e))


def bidirectional_sync(request):
    """
    Main bi-directional sync function.
    
    Triggered by Cloud Scheduler at 3:30 AM daily.
    HTTP endpoint for manual triggering.
    
    Returns:
        tuple: (dict response, int status_code)
    """
    db = firestore.Client()
    token = get_django_api_token()
    
    started_at = datetime.now(timezone.utc)
    last_sync = get_last_sync_time(db)
    
    log_json('INFO', 'Bi-directional sync started',
             event='bidirectional_sync_started',
             last_sync=last_sync.isoformat(),
             started_at=started_at.isoformat())
    
    stats = {
        'started_at': started_at.isoformat(),
        'last_sync': last_sync.isoformat(),
        'firestore_to_django': {},
        'django_to_firestore': {}
    }
    
    try:
        # Step 1: Push Firestore changes to Django
        log_json('INFO', 'Step 1: Pushing Firestore changes to Django')
        firestore_changes = get_pending_firestore_changes(db, last_sync)
        stats['firestore_to_django'] = push_to_django(db, firestore_changes, token)
        
        # Step 2: Pull Django changes to Firestore
        log_json('INFO', 'Step 2: Pulling Django changes to Firestore')
        django_changes = get_pending_django_changes(last_sync, token)
        stats['django_to_firestore'] = pull_to_firestore(db, django_changes, token)
        
        stats['completed_at'] = datetime.now(timezone.utc).isoformat()
        stats['status'] = 'success'
        stats['duration_seconds'] = (datetime.now(timezone.utc) - started_at).total_seconds()
        
        log_json('INFO', 'Bi-directional sync completed',
                 event='bidirectional_sync_completed',
                 stats=stats)
    
    except Exception as e:
        stats['completed_at'] = datetime.now(timezone.utc).isoformat()
        stats['status'] = 'failed'
        stats['error'] = str(e)
        stats['duration_seconds'] = (datetime.now(timezone.utc) - started_at).total_seconds()
        
        log_json('ERROR', 'Bi-directional sync failed',
                 event='bidirectional_sync_failed',
                 error=str(e),
                 stats=stats)
    
    # Log sync results to Firestore
    db.collection('sync_logs').add({
        'type': 'bidirectional_sync',
        'status': stats['status'],
        'stats': stats,
        'created_at': firestore.SERVER_TIMESTAMP,
        'completed_at': firestore.SERVER_TIMESTAMP
    })
    
    return (stats, 200)
