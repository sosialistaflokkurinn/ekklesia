"""
Django API Integration

Functions for interacting with Django backend API.
Used for profile updates (Ekklesia → Django).

Note: Member reads now go directly to Cloud SQL via db_members.py.
This module is for write operations that need to go through Django API.
"""

import os
import requests
from datetime import datetime, timezone
from typing import Dict, Any

from util_logging import log_json
from shared.validators import normalize_kennitala as normalize_kennitala_shared, normalize_phone as normalize_phone_shared

# Django API Base URL
# 2025-12-05: Switched from Linode to GCP Cloud Run
# Custom domain for Django API (more stable than Cloud Run URL)
DJANGO_API_BASE_URL = "https://starf.sosialistaflokkurinn.is/felagar"


def normalize_kennitala(kennitala: str) -> str:
    """
    Normalize kennitala to 10 digits without hyphen.

    Wrapper for shared.validators.normalize_kennitala() for backwards compatibility.
    """
    return normalize_kennitala_shared(kennitala)


def normalize_phone(phone: str) -> str:
    """
    Normalize Icelandic phone number to 7 digits without hyphen.

    Wrapper for shared.validators.normalize_phone() for backwards compatibility.
    """
    return normalize_phone_shared(phone)


def get_django_api_token() -> str:
    """
    Get Django API token from environment variable.

    The token is injected via Secret Manager at runtime by Cloud Run.

    Tries both naming conventions:
    - 'django-api-token' (Firebase Functions Gen2 format)
    - 'DJANGO_API_TOKEN' (gcloud deploy format)

    Returns:
        Django API token string

    Raises:
        ValueError: If token is not found in either format
    """
    # Try Firebase Functions format first (lowercase with hyphens)
    token = os.environ.get('django-api-token')

    # Fall back to gcloud format (uppercase with underscores)
    if not token:
        token = os.environ.get('DJANGO_API_TOKEN')

    if not token:
        raise ValueError("Django API token not found in environment (tried 'django-api-token' and 'DJANGO_API_TOKEN')")

    log_json('INFO', 'Django API token retrieved from environment',
             event='django_api_token_retrieved',
             timestamp=datetime.now(timezone.utc).isoformat())

    return token


def get_django_member_by_kennitala(kennitala: str) -> Dict[str, Any]:
    """
    Fetch a single Django member by kennitala.

    Note: For most read operations, use db_members.get_member_by_kennitala() instead.
    This function is for cases where you need the full Django API response.

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


def update_django_address(kennitala: str, address_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update a member's address in Django via the NewLocalAddress system.

    This uses the /api/sync/address/ endpoint which:
    1. Looks up the address in map_address (Iceland address registry)
    2. Creates/updates NewLocalAddress linking member to map_address

    Args:
        kennitala: Member's kennitala (10 digits, no hyphen)
        address_data: Dict with keys:
            - street: Street name (e.g., "Gullengi")
            - number: House number (e.g., 37)
            - letter: House letter (e.g., "A") - optional
            - postal_code: Postal code (e.g., "112")
            - city: City name (e.g., "Reykjavík")
            - country: Country code (e.g., "IS")

    Returns:
        Response from Django API with:
            - success: bool
            - message: str
            - map_address_id: int or None
            - address_linked: bool

    Raises:
        Exception if update fails
    """
    try:
        django_token = get_django_api_token()

        payload = {
            'kennitala': kennitala,
            'address': address_data
        }

        log_json('INFO', 'Updating Django address',
                 event='update_django_address_start',
                 kennitala=f"{kennitala[:6]}****",
                 street=address_data.get('street', ''),
                 postal_code=address_data.get('postal_code', ''))

        response = requests.post(
            f"{DJANGO_API_BASE_URL}/api/sync/address/",
            headers={
                'Authorization': f'Token {django_token}',
                'Content-Type': 'application/json'
            },
            json=payload,
            timeout=30
        )

        if response.status_code == 200:
            result = response.json()
            log_json('INFO', 'Django address updated',
                     event='update_django_address_success',
                     kennitala=f"{kennitala[:6]}****",
                     map_address_id=result.get('map_address_id'),
                     address_linked=result.get('address_linked'))
            return result
        else:
            error_msg = f"Django address API returned {response.status_code}: {response.text[:200]}"
            log_json('ERROR', error_msg,
                     event='update_django_address_error',
                     kennitala=f"{kennitala[:6]}****")
            raise Exception(error_msg)

    except requests.exceptions.RequestException as e:
        error_msg = f"Django address API request failed: {str(e)}"
        log_json('ERROR', error_msg,
                 event='update_django_address_exception',
                 kennitala=f"{kennitala[:6]}****")
        raise Exception(error_msg)
