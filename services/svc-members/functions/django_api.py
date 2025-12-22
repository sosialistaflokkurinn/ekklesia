"""
Django API Client Module

Shared functions for communicating with Django Admin API.
Used by membership functions to sync data back to Django.

API Base: https://starf.sosialistaflokkurinn.is/felagar

Endpoints used:
- POST /api/sync/create-member/ - Create new member
- PATCH /api/sync/update-member/{id}/ - Update member
- POST /api/sync/update-address/ - Update address by kennitala
- POST /api/sync/soft-delete/ - Soft delete member
- POST /api/sync/reactivate/ - Reactivate member
"""

import os
import requests
from util_logging import log_json

# Django API base URL (custom domain for stability)
DJANGO_API_BASE_URL = os.environ.get(
    'DJANGO_API_BASE_URL',
    'https://starf.sosialistaflokkurinn.is/felagar'
)


def get_django_api_token() -> str:
    """
    Get Django API token from environment variable.

    Raises:
        ValueError: If token is not found
    """
    token = os.environ.get('django-api-token') or os.environ.get('DJANGO_API_TOKEN')
    if not token:
        raise ValueError("Django API token not found")
    return token


def update_django_member(django_id: int, updates: dict) -> dict:
    """
    Update member in Django via PATCH request.

    Args:
        django_id: Django member ID (comrade.id)
        updates: Dict of fields to update

    Returns:
        Response data from Django API

    Raises:
        requests.RequestException: On API error
    """
    if not updates:
        return {"success": True, "message": "No updates to apply"}

    try:
        token = get_django_api_token()

        response = requests.patch(
            f"{DJANGO_API_BASE_URL}/api/sync/update-member/{django_id}/",
            json=updates,
            headers={
                'Authorization': f'Token {token}',
                'Content-Type': 'application/json'
            },
            timeout=30
        )

        if response.ok:
            log_json("info", "Django member updated",
                     django_id=django_id,
                     fields=list(updates.keys()))
            return response.json()
        else:
            log_json("warning", "Django member update failed",
                     django_id=django_id,
                     status=response.status_code,
                     response=response.text[:200])
            response.raise_for_status()

    except requests.RequestException as e:
        log_json("error", "Django API error",
                 endpoint="update-member",
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
            f"{DJANGO_API_BASE_URL}/api/sync/update-address/",
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


def create_django_member(member_data: dict) -> dict:
    """
    Create new member in Django via POST request.

    Args:
        member_data: Dict with member fields

    Returns:
        Response data from Django API (including new django_id)

    Raises:
        requests.RequestException: On API error
    """
    try:
        token = get_django_api_token()

        response = requests.post(
            f"{DJANGO_API_BASE_URL}/api/sync/create-member/",
            json=member_data,
            headers={
                'Authorization': f'Token {token}',
                'Content-Type': 'application/json'
            },
            timeout=30
        )

        if response.ok:
            result = response.json()
            log_json("info", "Django member created",
                     django_id=result.get('id'))
            return result
        else:
            log_json("warning", "Django member creation failed",
                     status=response.status_code,
                     response=response.text[:200])
            response.raise_for_status()

    except requests.RequestException as e:
        log_json("error", "Django API error",
                 endpoint="create-member",
                 error=str(e))
        raise
