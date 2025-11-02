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

# Django API Base URL
DJANGO_API_BASE_URL = "https://starf.sosialistaflokkurinn.is/felagar"


def normalize_kennitala(kennitala: str) -> str:
    """Normalize kennitala format to DDMMYY-XXXX"""
    if not kennitala:
        return None

    # Remove any whitespace
    kennitala = kennitala.strip()

    # Already has hyphen
    if '-' in kennitala:
        return kennitala

    # Add hyphen if missing (assumes 10 digits)
    if len(kennitala) == 10 and kennitala.isdigit():
        return f"{kennitala[:6]}-{kennitala[6:]}"

    return kennitala


def normalize_phone(phone: str) -> str:
    """Normalize Icelandic phone number to XXX-XXXX format

    Handles various input formats:
    - +3545551234 -> 555-1234
    - 003545551234 -> 555-1234
    - 5551234 -> 555-1234
    - 555 1234 -> 555-1234
    - 5551-234 -> 555-1234

    Returns None if phone is None or empty.
    Returns original string if format is invalid (not 7 digits after normalization).
    """
    if not phone:
        return None

    # Remove all whitespace, dashes, parentheses, and other separators
    phone = phone.strip()
    digits = ''.join(c for c in phone if c.isdigit())

    # Remove Iceland country code prefix if present
    # +354 or 00354 -> 10 digits total
    if digits.startswith('354') and len(digits) == 10:
        digits = digits[3:]  # Remove '354' prefix

    # Validate: should be exactly 7 digits for Icelandic phone
    if len(digits) != 7:
        log_json("warn", "Invalid phone number format", original=phone, digits=digits, length=len(digits))
        return phone  # Return original if invalid

    # Format as XXX-XXXX (3 digits - hyphen - 4 digits)
    return f"{digits[:3]}-{digits[3:]}"


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

    # Normalize phone number to XXX-XXXX format
    raw_phone = contact_info.get('phone', '')
    normalized_phone = normalize_phone(raw_phone) if raw_phone else ''

    # Normalize kennitala to DDMMYY-XXXX format
    raw_kennitala = django_member.get('ssn', '')
    normalized_kennitala = normalize_kennitala(raw_kennitala) if raw_kennitala else ''

    # Create Firestore document
    firestore_doc = {
        'profile': {
            'kennitala': normalized_kennitala,
            'name': django_member.get('name', ''),
            'birthday': django_member.get('birthday'),
            'email': contact_info.get('email', ''),
            'phone': normalized_phone,
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


def update_user_roles_from_django(db: firestore.Client, django_member: Dict[str, Any]) -> bool:
    """
    Update /users/{uid} with roles from Django member data.

    Epic #116: Sync roles from Django User model to Firestore /users/ collection.

    Args:
        db: Firestore client
        django_member: Django API member object with is_admin, is_superuser fields

    Returns:
        True if successful, False otherwise
    """
    kennitala = django_member.get('ssn')
    if not kennitala:
        return False

    # Normalize kennitala (remove hyphen if present)
    kennitala_normalized = kennitala.replace('-', '')

    # Find Firebase UID by querying /users/ collection with kennitala field
    users_ref = db.collection('users')
    query = users_ref.where('kennitala', '==', kennitala_normalized).limit(1)
    existing_users = list(query.stream())

    if not existing_users:
        # User hasn't logged in yet - skip (roles will be set on first login)
        log_json('DEBUG', 'No Firebase user found for kennitala',
                 event='update_user_roles_skipped_no_firebase_user',
                 kennitala=f"{kennitala[:6]}****",
                 django_id=django_member.get('id'))
        return False

    uid = existing_users[0].id  # Firebase UID

    # Determine roles from Django User model flags
    # Direct mapping from Django to Ekklesia:
    # - is_superuser → superuser (full system access)
    # - is_staff → admin (administrative access)
    # - all members → member (default)
    roles = ['member']  # Default role for all members

    is_staff = django_member.get('is_staff', False)
    is_superuser = django_member.get('is_superuser', False)

    if is_superuser:
        roles.append('superuser')  # Full system access

    if is_staff:
        roles.append('admin')  # Administrative access

    # Update /users/{uid} with roles
    try:
        users_ref.document(uid).update({
            'roles': roles,
            'django_id': django_member.get('id'),
            'lastRoleSync': firestore.SERVER_TIMESTAMP
        })

        log_json('INFO', 'Updated user roles',
                 event='user_roles_updated',
                 uid=uid,
                 kennitala=f"{kennitala[:6]}****",
                 roles=roles,
                 django_id=django_member.get('id'))

        return True

    except Exception as e:
        log_json('ERROR', 'Failed to update user roles',
                 event='update_user_roles_error',
                 uid=uid,
                 kennitala=f"{kennitala[:6]}****",
                 error=str(e))
        return False


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

    # Normalize kennitala for use as document ID
    normalized_kennitala = normalize_kennitala(kennitala)

    try:
        firestore_doc = transform_django_member_to_firestore(django_member)

        # Write to Firestore /members/ collection (use normalized kennitala as document ID)
        member_ref = db.collection('members').document(normalized_kennitala)
        member_ref.set(firestore_doc, merge=True)

        log_json('INFO', 'Member synced to Firestore',
                 event='member_synced_to_firestore',
                 kennitala=kennitala,
                 name=django_member.get('name'),
                 django_id=django_member.get('id'))

        # Epic #116: Also update /users/ collection with roles
        update_user_roles_from_django(db, django_member)

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
                ssn = member.get('ssn', '')

                # Skip fake SSNs (duplicates marked with 9999XXXXXX during cleanup)
                if ssn.startswith('9999'):
                    log_json('DEBUG', 'Skipping fake SSN',
                             event='sync_member_skipped_fake_ssn',
                             ssn=ssn,
                             django_id=member.get('id'),
                             name=member.get('name'))
                    stats['skipped'] += 1
                    continue

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


def get_django_member_by_kennitala(kennitala: str) -> Dict[str, Any]:
    """
    Fetch a single Django member by kennitala.

    Args:
        kennitala: Icelandic national ID (kennitala), normalized (no hyphen)

    Returns:
        Django member data dict, or None if not found
    """
    try:
        django_token = get_django_api_token()
        api_url = f"{DJANGO_API_BASE_URL}/api/full/"

        log_json('DEBUG', 'Django API lookup',
                 event='get_django_member_by_kennitala_request',
                 url=api_url,
                 ssn_param=f"{kennitala[:6]}****")

        response = requests.get(
            api_url,
            headers={'Authorization': f'Token {django_token}'},
            params={'ssn': kennitala},
            timeout=30
        )

        log_json('DEBUG', f'Django API response status: {response.status_code}',
                 event='get_django_member_by_kennitala_response',
                 status_code=response.status_code)

        if response.status_code == 200:
            data = response.json()
            results = data.get('results', [])
            count = len(results)

            log_json('DEBUG', f'Django API returned {count} results',
                     event='get_django_member_by_kennitala_results',
                     count=count)

            if results:
                member = results[0]
                log_json('DEBUG', 'Returning first member',
                         event='get_django_member_by_kennitala_found',
                         django_id=member.get('id'),
                         django_ssn=f"{member.get('ssn', '')[:6]}****")
                return member
            return None
        else:
            log_json('ERROR', f'Django API error: {response.status_code}',
                     event='get_django_member_by_kennitala_error',
                     kennitala=f"{kennitala[:6]}****",
                     response_text=response.text[:200])
            return None

    except Exception as e:
        log_json('ERROR', f'Failed to fetch Django member: {str(e)}',
                 event='get_django_member_by_kennitala_exception',
                 kennitala=f"{kennitala[:6]}****")
        return None


def update_django_member(django_id: int, updates: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update a Django member via PATCH request.

    Args:
        django_id: Django Comrade ID
        updates: Dict of fields to update {name, contact_info, etc}

    Returns:
        Updated member data from Django

    Raises:
        Exception if update fails
    """
    try:
        django_token = get_django_api_token()

        # PATCH request to update member
        response = requests.patch(
            f"{DJANGO_API_BASE_URL}/api/full/{django_id}/",
            headers={
                'Authorization': f'Token {django_token}',
                'Content-Type': 'application/json'
            },
            json=updates,
            timeout=30
        )

        if response.status_code == 200:
            updated_member = response.json()
            log_json('INFO', 'Django member updated',
                     event='update_django_member_success',
                     django_id=django_id,
                     updated_fields=list(updates.keys()))
            return updated_member
        else:
            error_msg = f"Django API returned {response.status_code}: {response.text[:200]}"
            log_json('ERROR', error_msg,
                     event='update_django_member_error',
                     django_id=django_id)
            raise Exception(error_msg)

    except requests.exceptions.RequestException as e:
        error_msg = f"Django API request failed: {str(e)}"
        log_json('ERROR', error_msg,
                 event='update_django_member_exception',
                 django_id=django_id)
        raise Exception(error_msg)
