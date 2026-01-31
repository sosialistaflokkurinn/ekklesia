"""
Django API Client Module

Functions for updating member data in Cloud SQL.
Cloud SQL is the source of truth for member data.

Tables used:
- membership_comrade: name, reachable, groupable, gender, birthday
- membership_contactinfo: email, phone
- membership_simpleaddress: street, street_number, postal_code
"""

import os
import requests
from util_logging import log_json
from db import execute_update

# Django API base URL (kept for address updates which are more complex)
DJANGO_API_BASE_URL = os.environ.get(
    'DJANGO_API_BASE_URL',
    'https://starf.sosialistaflokkurinn.is/felagar'
)

# Field mappings for Cloud SQL tables
COMRADE_FIELDS = {'name', 'reachable', 'groupable', 'gender', 'birthday', 'profile_image_url', 'display_name'}
CONTACTINFO_FIELDS = {'email', 'phone'}


def get_django_api_token() -> str:
    """
    Get Django API token from environment variable.
    Used for complex operations (address updates).

    Raises:
        ValueError: If token is not found
    """
    token = os.environ.get('django-api-token') or os.environ.get('DJANGO_API_TOKEN')
    if not token:
        raise ValueError("Django API token not found")
    return token


def update_django_member(django_id: int, updates: dict) -> dict:
    """
    Update member in Cloud SQL directly (source of truth).

    Args:
        django_id: Django member ID (comrade.id)
        updates: Dict of fields to update. Supported fields:
                 - membership_comrade: name, reachable, groupable, gender, birthday
                 - membership_contactinfo: email, phone

    Returns:
        Dict with success status and updated fields

    Raises:
        Exception: On database error
    """
    if not updates:
        return {"success": True, "message": "No updates to apply"}

    updated_fields = []

    # Separate updates by table
    comrade_updates = {k: v for k, v in updates.items() if k in COMRADE_FIELDS}
    contact_updates = {k: v for k, v in updates.items() if k in CONTACTINFO_FIELDS}

    try:
        # Update membership_comrade table
        if comrade_updates:
            set_clauses = []
            params = []
            for field, value in comrade_updates.items():
                set_clauses.append(f"{field} = %s")
                params.append(value)
            params.append(int(django_id))

            query = f"UPDATE membership_comrade SET {', '.join(set_clauses)} WHERE id = %s"
            affected = execute_update(query, params=tuple(params))

            if affected > 0:
                updated_fields.extend(comrade_updates.keys())
                log_json("info", "Cloud SQL comrade updated",
                         django_id=django_id,
                         fields=list(comrade_updates.keys()))

        # Update membership_contactinfo table
        if contact_updates:
            set_clauses = []
            params = []
            for field, value in contact_updates.items():
                set_clauses.append(f"{field} = %s")
                params.append(value)
            params.append(int(django_id))

            query = f"UPDATE membership_contactinfo SET {', '.join(set_clauses)} WHERE comrade_id = %s"
            affected = execute_update(query, params=tuple(params))

            if affected > 0:
                updated_fields.extend(contact_updates.keys())
                log_json("info", "Cloud SQL contactinfo updated",
                         django_id=django_id,
                         fields=list(contact_updates.keys()))

        return {
            "success": True,
            "updated_fields": updated_fields,
            "django_id": django_id
        }

    except Exception as e:
        log_json("error", "Cloud SQL update failed",
                 django_id=django_id,
                 error=str(e))
        raise


def update_django_address(kennitala: str, address_data: dict) -> dict:
    """
    Update member address in Django via POST request.

    Args:
        kennitala: Member's kennitala (SSN)
        address_data: Dict with address fields (street, number, letter, postal_code, city)

    Returns:
        Response data from Django API

    Raises:
        requests.RequestException: On API error
    """
    try:
        token = get_django_api_token()

        payload = {
            'kennitala': kennitala,
            **address_data
        }

        response = requests.post(
            f"{DJANGO_API_BASE_URL}/api/sync/address/",
            json=payload,
            headers={
                'Authorization': f'Token {token}',
                'Content-Type': 'application/json'
            },
            timeout=30
        )

        if response.ok:
            log_json("info", "Django address updated",
                     kennitala=kennitala[:6] + "****")
            return response.json()
        else:
            log_json("warning", "Django address update failed",
                     kennitala=kennitala[:6] + "****",
                     status=response.status_code,
                     response=response.text[:200])
            response.raise_for_status()

    except requests.RequestException as e:
        log_json("error", "Django API error",
                 endpoint="update-address",
                 kennitala=kennitala[:6] + "****",
                 error=str(e))
        raise
