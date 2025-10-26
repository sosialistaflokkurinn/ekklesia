"""
Epic #43: Member Sync from Django to Firestore

This module handles syncing member data from Django backend to Firestore.
Includes full member data (SSN, contact info, addresses, unions, titles).
"""

import os
import requests
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from google.cloud import firestore
from google.cloud.secretmanager import SecretManagerServiceClient
from utils_logging import log_json


def get_django_api_token() -> str:
    """
    Fetch Django API token from Google Secret Manager.

    Returns:
        Django API token string
    """
    project_id = os.getenv('GCP_PROJECT', 'ekklesia-prod-10-2025')
    secret_name = f"projects/{project_id}/secrets/django-api-token/versions/latest"

    client = SecretManagerServiceClient()
    response = client.access_secret_version(request={"name": secret_name})
    token = response.payload.data.decode('UTF-8').strip()

    log_json('INFO', 'Django API token retrieved',
             event='django_api_token_retrieved',
             project_id=project_id,
             timestamp=datetime.now(timezone.utc).isoformat())

    return token


def fetch_members_from_django(page: int = 1) -> Dict[str, Any]:
    """
    Fetch members from Django API with pagination.

    Args:
        page: Page number (1-indexed)

    Returns:
        Dict with keys: count, next, previous, results
    """
    token = get_django_api_token()
    url = "https://starf.sosialistaflokkurinn.is/felagar/api/full/"

    headers = {
        'Authorization': f'Token {token}',
        'Accept': 'application/json'
    }

    params = {'page': page}

    log_json('INFO', 'Fetching members from Django',
             event='fetching_members_from_django',
             page=page,
             url=url)

    response = requests.get(url, headers=headers, params=params, timeout=30)
    response.raise_for_status()

    data = response.json()

    log_json('INFO', 'Fetched members from Django',
             event='fetched_members_from_django',
             page=page,
             count=data.get('count', 0),
             results_count=len(data.get('results', [])))

    return data


def transform_django_member_to_firestore(django_member: Dict[str, Any]) -> Dict[str, Any]:
    """
    Transform Django member data to Firestore format.

    Args:
        django_member: Django API response member object

    Returns:
        Firestore-compatible member document
    """
    # Extract contact info
    contact_info = django_member.get('contact_info', {}) or {}

    # Extract address
    local_address = django_member.get('local_address', {}) or {}

    # Extract unions (array of names)
    unions = [u.get('name') for u in django_member.get('unions', []) if u.get('name')]

    # Extract titles (array of names)
    titles = [t.get('name') for t in django_member.get('titles', []) if t.get('name')]

    # Parse date_joined
    date_joined_str = django_member.get('date_joined')
    date_joined = None
    if date_joined_str:
        try:
            date_joined = datetime.fromisoformat(date_joined_str.replace('Z', '+00:00'))
        except ValueError:
            log_json('WARNING', 'Date parse error',
                     event='date_parse_error',
                     date_joined=date_joined_str,
                     member_id=django_member.get('id'))

    # Create Firestore document
    firestore_doc = {
        'profile': {
            'kennitala': django_member.get('ssn', ''),
            'name': django_member.get('name', ''),
            'birthday': django_member.get('birthday'),
            'email': contact_info.get('email', ''),
            'phone': contact_info.get('phone', ''),
            'facebook': contact_info.get('facebook', ''),
            'gender': django_member.get('gender'),
            'reachable': django_member.get('reachable', True),
            'groupable': django_member.get('groupable', True),
            'housing_situation': django_member.get('housing_situation')
        },
        'address': {
            'street': local_address.get('street', ''),
            'number': local_address.get('number'),
            'letter': local_address.get('letter', ''),
            'postal_code': str(local_address.get('postal_code', '')) if local_address.get('postal_code') else '',
            'city': local_address.get('city', ''),
            'from_reykjavik': False  # Will be enhanced later with API lookup
        },
        'membership': {
            'date_joined': date_joined,
            'status': 'active',  # Default, will be enhanced with actual status
            'unions': unions,
            'titles': titles
        },
        'metadata': {
            'synced_at': firestore.SERVER_TIMESTAMP,
            'django_id': django_member.get('id'),
            'last_modified': datetime.now(timezone.utc)
        }
    }

    return firestore_doc


def sync_member_to_firestore(db: firestore.Client, django_member: Dict[str, Any]) -> bool:
    """
    Sync a single member to Firestore.

    Args:
        db: Firestore client
        django_member: Django API member object

    Returns:
        True if successful, False otherwise
    """
    kennitala = django_member.get('ssn')
    if not kennitala:
        log_json('WARNING', 'Sync member skipped - no SSN',
                 event='sync_member_skipped_no_ssn',
                 member_id=django_member.get('id'),
                 member_name=django_member.get('name'))
        return False

    try:
        firestore_doc = transform_django_member_to_firestore(django_member)

        # Write to Firestore
        member_ref = db.collection('members').document(kennitala)
        member_ref.set(firestore_doc, merge=True)

        log_json('INFO', 'Member synced to Firestore',
                 event='member_synced_to_firestore',
                 kennitala=kennitala,
                 name=django_member.get('name'),
                 django_id=django_member.get('id'))

        return True

    except Exception as e:
        log_json('ERROR', 'Sync member error',
                 event='sync_member_error',
                 kennitala=kennitala,
                 error=str(e),
                 member_id=django_member.get('id'))
        return False


def sync_all_members() -> Dict[str, Any]:
    """
    Sync all members from Django to Firestore.

    Returns:
        Dict with sync statistics
    """
    db = firestore.Client()

    stats = {
        'total_members': 0,
        'synced': 0,
        'failed': 0,
        'skipped': 0,
        'pages_processed': 0,
        'started_at': datetime.now(timezone.utc).isoformat()
    }

    log_json('INFO', 'Member sync started',
             event='member_sync_started',
             timestamp=stats['started_at'])

    page = 1
    has_next = True

    while has_next:
        try:
            data = fetch_members_from_django(page)

            stats['total_members'] = data.get('count', 0)
            stats['pages_processed'] = page

            members = data.get('results', [])

            for member in members:
                success = sync_member_to_firestore(db, member)
                if success:
                    stats['synced'] += 1
                else:
                    stats['skipped'] += 1

            # Check if there's a next page
            has_next = bool(data.get('next'))
            page += 1

        except Exception as e:
            log_json('ERROR', 'Sync page error',
                     event='sync_page_error',
                     page=page,
                     error=str(e))
            stats['failed'] += 1
            break

    stats['completed_at'] = datetime.now(timezone.utc).isoformat()

    log_json('INFO', 'Member sync completed',
             event='member_sync_completed',
             stats=stats)

    return stats


def create_sync_log(db: firestore.Client, stats: Dict[str, Any]) -> str:
    """
    Create a sync log document in Firestore.

    Args:
        db: Firestore client
        stats: Sync statistics

    Returns:
        Document ID of the created log
    """
    log_ref = db.collection('sync_logs').document()
    log_ref.set({
        'type': 'member_sync',
        'stats': stats,
        'created_at': firestore.SERVER_TIMESTAMP
    })

    return log_ref.id
