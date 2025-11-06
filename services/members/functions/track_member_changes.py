"""
Cloud Function: Track Firestore Member Changes
Triggered on: members/{memberId} document write (create, update, delete)

This function tracks changes to members in Firestore and adds them
to a sync queue for the bi-directional sync to process.
"""

from google.cloud import firestore
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_changed_fields(old_data, new_data):
    """
    Compare old and new values, return only changed fields with Firestore paths.
    
    Args:
        old_data: dict - Previous document data
        new_data: dict - New document data
    
    Returns:
        dict - Changed fields with Firestore paths as keys
    """
    changes = {}
    
    # Check profile fields
    old_profile = old_data.get('profile', {})
    new_profile = new_data.get('profile', {})
    
    profile_fields = ['name', 'email', 'phone', 'birthday', 'gender', 'facebook', 'housingSituation']
    for field in profile_fields:
        old_val = old_profile.get(field)
        new_val = new_profile.get(field)
        if old_val != new_val:
            changes[f'profile.{field}'] = new_val
    
    # Check address fields
    old_address = old_data.get('address', {})
    new_address = new_data.get('address', {})
    
    address_fields = ['street', 'postal_code', 'city', 'country']
    for field in address_fields:
        old_val = old_address.get(field)
        new_val = new_address.get(field)
        if old_val != new_val:
            changes[f'address.{field}'] = new_val
    
    # Check membership fields
    old_membership = old_data.get('membership', {})
    new_membership = new_data.get('membership', {})
    
    membership_fields = ['status', 'reachable', 'groupable']
    for field in membership_fields:
        old_val = old_membership.get(field)
        new_val = new_membership.get(field)
        if old_val != new_val:
            changes[f'membership.{field}'] = new_val
    
    return changes


def track_firestore_changes(event, context):
    """
    Cloud Function triggered by Firestore document write.
    
    This is a Firestore trigger function, not an HTTP function.
    Deploy with:
        gcloud functions deploy track_member_changes \\
          --runtime python311 \\
          --trigger-event providers/cloud.firestore/eventTypes/document.write \\
          --trigger-resource "projects/ekklesia-prod-10-2025/databases/(default)/documents/members/{memberId}"
    
    Args:
        event: dict - The Firestore event data
        context: google.cloud.functions.Context - The event context
    """
    
    db = firestore.Client()
    
    # Get document path from context
    resource_path = context.resource
    member_id = resource_path.split('/')[-1]
    
    logger.info(f"Processing change for member: {member_id}")
    
    # Get old and new values
    old_value = event.get('oldValue')
    new_value = event.get('value')
    
    # Convert Firestore document snapshots to dicts
    old_data = {}
    new_data = {}
    
    if old_value and 'fields' in old_value:
        old_data = _firestore_value_to_dict(old_value['fields'])
    
    if new_value and 'fields' in new_value:
        new_data = _firestore_value_to_dict(new_value['fields'])
    
    # Determine action type
    if not old_value:
        action = 'create'
        changed_fields = new_data
        logger.info(f"Member created: {member_id}")
    elif not new_value:
        action = 'delete'
        changed_fields = old_data
        logger.info(f"Member deleted: {member_id}")
    else:
        action = 'update'
        changed_fields = get_changed_fields(old_data, new_data)
        logger.info(f"Member updated: {member_id}, fields changed: {list(changed_fields.keys())}")
    
    # Skip if no changes
    if not changed_fields and action == 'update':
        logger.info(f"No syncable fields changed for member: {member_id}")
        return
    
    # Get kennitala and django_id from the data
    kennitala = new_data.get('profile', {}).get('kennitala') or old_data.get('profile', {}).get('kennitala')
    django_id = new_data.get('metadata', {}).get('django_id') or old_data.get('metadata', {}).get('django_id')
    
    if not kennitala:
        logger.error(f"Cannot sync member {member_id}: missing kennitala")
        return
    
    # Add to sync queue
    try:
        sync_queue_ref = db.collection('sync_queue').document()
        sync_queue_ref.set({
            'source': 'firestore',
            'target': 'django',
            'collection': 'members',
            'docId': member_id,
            'kennitala': kennitala,
            'django_id': django_id,
            'action': action,
            'changes': changed_fields,
            'created_at': firestore.SERVER_TIMESTAMP,
            'synced_at': None,
            'sync_status': 'pending'
        })
        
        logger.info(f"Added to sync queue: {sync_queue_ref.id}")
    
    except Exception as e:
        logger.error(f"Failed to add to sync queue: {str(e)}")
        raise


def _firestore_value_to_dict(fields):
    """
    Convert Firestore API value format to Python dict.
    
    Firestore trigger events use a different format than the client library.
    This helper converts the API format to a standard Python dict.
    
    Args:
        fields: dict - Firestore fields in API format
    
    Returns:
        dict - Python dictionary
    """
    result = {}
    
    for key, value_obj in fields.items():
        if 'stringValue' in value_obj:
            result[key] = value_obj['stringValue']
        elif 'integerValue' in value_obj:
            result[key] = int(value_obj['integerValue'])
        elif 'booleanValue' in value_obj:
            result[key] = value_obj['booleanValue']
        elif 'timestampValue' in value_obj:
            result[key] = value_obj['timestampValue']
        elif 'mapValue' in value_obj:
            # Nested object
            nested_fields = value_obj['mapValue'].get('fields', {})
            result[key] = _firestore_value_to_dict(nested_fields)
        elif 'arrayValue' in value_obj:
            # Array
            array_values = value_obj['arrayValue'].get('values', [])
            result[key] = [
                _firestore_value_to_dict({'item': val})['item']
                for val in array_values
            ]
        elif 'nullValue' in value_obj:
            result[key] = None
    
    return result
