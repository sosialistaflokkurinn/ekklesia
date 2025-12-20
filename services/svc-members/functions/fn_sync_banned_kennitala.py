"""
Sync banned kennitala from Django to Firestore.

HTTP endpoint called by Django signals when a kennitala is banned/unbanned.
Stores banned kennitalas in Firestore for registration checks.
"""

import os
import json
from datetime import datetime, timezone
from typing import Dict, Any

from firebase_admin import firestore
from firebase_functions import https_fn, options
from google.cloud.firestore import SERVER_TIMESTAMP

from util_logging import log_json
from shared.validators import normalize_kennitala


# Collection name for banned kennitalas
BANNED_COLLECTION = 'bannedKennitalas'


def get_sync_api_key() -> str:
    """Get API key for validating Django sync requests."""
    key = os.environ.get('sync-api-key') or os.environ.get('SYNC_API_KEY')
    if not key:
        key = os.environ.get('django-api-token') or os.environ.get('DJANGO_API_TOKEN')
    return key or ''


def validate_request(req: https_fn.Request) -> bool:
    """Validate incoming request has correct API key."""
    expected_key = get_sync_api_key()
    if not expected_key:
        log_json('ERROR', 'No API key configured for sync_banned_kennitala')
        return False

    auth_header = req.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        provided_key = auth_header[7:]
    elif auth_header.startswith('Token '):
        provided_key = auth_header[6:]
    else:
        provided_key = auth_header

    return provided_key == expected_key


def is_kennitala_banned(kennitala: str) -> bool:
    """
    Check if a kennitala is on the banned list.
    Used by registration function to implement shadow ban.

    Args:
        kennitala: The SSN to check (with or without dash)

    Returns:
        True if banned and active, False otherwise
    """
    kt = normalize_kennitala(kennitala)
    if not kt:
        return False

    try:
        db = firestore.client()
        doc = db.collection(BANNED_COLLECTION).document(kt).get()

        if doc.exists:
            data = doc.to_dict()
            return data.get('active', False)
        return False
    except Exception as e:
        log_json('ERROR', 'Failed to check banned kennitala',
                 error=str(e), kennitala=f"{kt[:6]}****")
        # On error, don't block registration (fail open)
        return False


@https_fn.on_request(
    region='europe-west2',
    memory=options.MemoryOption.MB_256,
    timeout_sec=30,
    secrets=['django-api-token']
)
def sync_banned_kennitala(req: https_fn.Request) -> https_fn.Response:
    """
    HTTP endpoint called by Django when a kennitala is banned/unbanned.

    POST body:
    {
        "kennitala": "1234567890",
        "action": "ban" | "update" | "unban",
        "data": {
            "ssn": "1234567890",
            "reason": "Reason for ban",
            "banned_by": "admin_username",
            "banned_at": "2025-12-12T15:00:00+00:00",
            "active": true
        }
    }

    Returns:
        JSON response with success/error status
    """
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
        log_json('WARN', 'Unauthorized sync_banned_kennitala request')
        return https_fn.Response(
            json.dumps({'error': 'Unauthorized'}),
            status=401,
            headers=headers
        )

    try:
        body = req.get_json(silent=True)
        if not body:
            return https_fn.Response(
                json.dumps({'error': 'Invalid JSON body'}),
                status=400,
                headers=headers
            )

        kennitala = normalize_kennitala(body.get('kennitala', ''))
        action = body.get('action', 'ban')
        data = body.get('data', {})

        if not kennitala:
            return https_fn.Response(
                json.dumps({'error': 'Missing kennitala'}),
                status=400,
                headers=headers
            )

        log_json('INFO', 'Sync banned kennitala received',
                 kennitala=f"{kennitala[:6]}****",
                 action=action)

        db = firestore.client()
        doc_ref = db.collection(BANNED_COLLECTION).document(kennitala)

        if action == 'unban':
            # Delete the ban record
            doc_ref.delete()
            log_json('INFO', 'Kennitala unbanned in Firestore',
                     kennitala=f"{kennitala[:6]}****")

        elif action in ('ban', 'update'):
            # Create or update ban record
            firestore_doc = {
                'ssn': kennitala,
                'reason': data.get('reason', ''),
                'banned_by': data.get('banned_by', ''),
                'active': data.get('active', True),
                'synced_at': SERVER_TIMESTAMP,
                'source': 'django'
            }

            # Parse banned_at if provided
            banned_at = data.get('banned_at')
            if banned_at:
                try:
                    firestore_doc['banned_at'] = datetime.fromisoformat(
                        banned_at.replace('Z', '+00:00')
                    )
                except (ValueError, AttributeError):
                    firestore_doc['banned_at'] = datetime.now(timezone.utc)
            else:
                firestore_doc['banned_at'] = datetime.now(timezone.utc)

            if action == 'ban':
                doc_ref.set(firestore_doc)
                log_json('INFO', 'Kennitala banned in Firestore',
                         kennitala=f"{kennitala[:6]}****")
            else:
                doc_ref.set(firestore_doc, merge=True)
                log_json('INFO', 'Banned kennitala updated in Firestore',
                         kennitala=f"{kennitala[:6]}****")

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
        log_json('ERROR', 'sync_banned_kennitala failed', error=str(e))
        return https_fn.Response(
            json.dumps({'error': 'Internal server error'}),
            status=500,
            headers=headers
        )
