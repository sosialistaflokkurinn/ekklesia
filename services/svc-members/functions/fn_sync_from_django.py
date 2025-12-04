"""
Real-time sync from Django to Firestore.

HTTP endpoint called by Django signals when member data changes.
Immediately syncs the change to Firestore without using a queue.
"""

import os
import json
from datetime import datetime, timezone
from typing import Dict, Any

from firebase_admin import firestore
from firebase_functions import https_fn, options
from google.cloud.firestore import SERVER_TIMESTAMP

from util_logging import log_json
from fn_sync_members import transform_django_member_to_firestore, normalize_kennitala


def get_sync_api_key() -> str:
    """Get API key for validating Django sync requests."""
    # Try both naming conventions
    key = os.environ.get('sync-api-key') or os.environ.get('SYNC_API_KEY')
    if not key:
        # Fall back to Django API token if sync key not set
        key = os.environ.get('django-api-token') or os.environ.get('DJANGO_API_TOKEN')
    return key or ''


def validate_request(req: https_fn.Request) -> bool:
    """Validate incoming request has correct API key."""
    expected_key = get_sync_api_key()
    if not expected_key:
        log_json('ERROR', 'No API key configured for sync_from_django')
        return False

    # Check Authorization header
    auth_header = req.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        provided_key = auth_header[7:]  # Remove 'Bearer ' prefix
    elif auth_header.startswith('Token '):
        provided_key = auth_header[6:]  # Remove 'Token ' prefix
    else:
        provided_key = auth_header

    return provided_key == expected_key


@https_fn.on_request(
    region='europe-west2',
    memory=options.MemoryOption.MB_256,
    timeout_sec=30,
    secrets=['django-api-token']
)
def sync_from_django(req: https_fn.Request) -> https_fn.Response:
    """
    HTTP endpoint called by Django when member data changes.
    Immediately syncs the change to Firestore.

    POST body:
    {
        "kennitala": "1234567890",
        "action": "create" | "update" | "delete",
        "data": { Django member data }
    }

    Returns:
        JSON response with success/error status
    """
    # CORS headers
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    }

    # Handle preflight
    if req.method == 'OPTIONS':
        return https_fn.Response('', status=204, headers=headers)

    # Only allow POST
    if req.method != 'POST':
        return https_fn.Response(
            json.dumps({'error': 'Method not allowed'}),
            status=405,
            headers=headers
        )

    # Validate API key
    if not validate_request(req):
        log_json('WARN', 'Unauthorized sync_from_django request')
        return https_fn.Response(
            json.dumps({'error': 'Unauthorized'}),
            status=401,
            headers=headers
        )

    try:
        # Parse request body
        body = req.get_json(silent=True)
        if not body:
            return https_fn.Response(
                json.dumps({'error': 'Invalid JSON body'}),
                status=400,
                headers=headers
            )

        kennitala = body.get('kennitala', '').replace('-', '')
        action = body.get('action', 'update')
        django_data = body.get('data', {})

        if not kennitala:
            return https_fn.Response(
                json.dumps({'error': 'Missing kennitala'}),
                status=400,
                headers=headers
            )

        log_json('INFO', 'Sync from Django received',
                 kennitala=f"{kennitala[:6]}****",
                 action=action)

        # Get Firestore client
        db = firestore.client()
        doc_ref = db.collection('members').document(normalize_kennitala(kennitala))

        if action == 'delete':
            # Soft delete - mark as inactive
            doc_ref.update({
                'membership.status': 'inactive',
                'metadata.deleted_at': datetime.now(timezone.utc),
                'metadata.synced_at': SERVER_TIMESTAMP
            })
            log_json('INFO', 'Member marked inactive in Firestore',
                     kennitala=f"{kennitala[:6]}****")

        elif action in ('create', 'update'):
            # Transform Django data to Firestore format
            if django_data:
                firestore_doc = transform_django_member_to_firestore(django_data)

                if action == 'create':
                    doc_ref.set(firestore_doc)
                    log_json('INFO', 'Member created in Firestore',
                             kennitala=f"{kennitala[:6]}****")
                else:
                    # Merge update to preserve existing fields
                    doc_ref.set(firestore_doc, merge=True)
                    log_json('INFO', 'Member updated in Firestore',
                             kennitala=f"{kennitala[:6]}****")
            else:
                return https_fn.Response(
                    json.dumps({'error': 'Missing data for create/update'}),
                    status=400,
                    headers=headers
                )

        else:
            return https_fn.Response(
                json.dumps({'error': f'Invalid action: {action}'}),
                status=400,
                headers=headers
            )

        return https_fn.Response(
            json.dumps({
                'success': True,
                'kennitala': f"{kennitala[:6]}****",
                'action': action
            }),
            status=200,
            headers=headers
        )

    except Exception as e:
        log_json('ERROR', 'sync_from_django failed', error=str(e))
        return https_fn.Response(
            json.dumps({'error': 'Internal server error'}),
            status=500,
            headers=headers
        )
