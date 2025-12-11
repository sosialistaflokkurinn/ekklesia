"""
Register Member Cloud Function

Handles new member registration from skraning-static frontend.
Creates member in Firestore and assigns to cell.

Usage:
    register_member({
        name: "Jón Jónsson",
        ssn: "0112901234",
        email: "jon@example.com",
        phone: "8881234",
        address_type: "iceland" | "foreign" | "unlocated",
        # For Iceland address:
        address_id: 12345,  # hnitnum from iceaddr
        # For foreign address:
        country_id: 45,
        foreign_address: "123 Main Street",
        foreign_municipality: "London",
        foreign_postal_code: "SW1A 1AA",
        # For unlocated:
        cell_id: 5,
        # Optional fields:
        housing_situation: 2,
        union_id: 93,
        title_id: 14,
        reachable: true,
        groupable: true
    })
    Returns: { comrade_id: 1234, error: null }
"""

import logging
import os
import re
import requests
from datetime import datetime, timezone
from typing import Any

from firebase_functions import https_fn, options
from firebase_admin import firestore
from google.cloud.firestore_v1 import Increment

from shared.validators import normalize_kennitala, normalize_phone, validate_kennitala
from util_logging import log_json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Iceland country ID
ICELAND_COUNTRY_ID = 109

# Django API for creating members
DJANGO_API_BASE_URL = os.environ.get(
    'DJANGO_API_BASE_URL',
    'https://django-socialism-521240388393.europe-west2.run.app/felagar'
)


def get_django_api_token() -> str:
    """Get Django API token from environment variable."""
    token = os.environ.get('django-api-token') or os.environ.get('DJANGO_API_TOKEN')
    if not token:
        raise ValueError("Django API token not found")
    return token


def sync_member_to_django(member_data: dict) -> dict | None:
    """
    Create member in Django via API.

    Args:
        member_data: Dict with member data to sync

    Returns:
        Dict with django_id if successful, None if failed
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
            timeout=15
        )

        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                log_json('INFO', 'Member synced to Django',
                         event='django_sync_success',
                         django_id=result.get('django_id'),
                         already_existed=result.get('already_existed', False))
                return result
            else:
                log_json('ERROR', 'Django sync failed',
                         event='django_sync_failed',
                         error=result.get('error'))
                return None
        else:
            log_json('ERROR', 'Django API error',
                     event='django_api_error',
                     status_code=response.status_code,
                     response=response.text[:200])
            return None

    except requests.exceptions.Timeout:
        log_json('ERROR', 'Django API timeout',
                 event='django_sync_timeout')
        return None
    except Exception as e:
        log_json('ERROR', 'Django sync exception',
                 event='django_sync_exception',
                 error=str(e))
        return None


def validate_email(email: str) -> bool:
    """Basic email validation."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def parse_birthday_from_kennitala(kennitala: str) -> str | None:
    """
    Extract birthday from kennitala.

    Kennitala format: DDMMYYXXXX
    - Last digit indicates century: 0 = 2000s, 8/9 = 1800s, else 1900s

    Returns ISO date string (YYYY-MM-DD) or None if invalid.
    """
    if not kennitala or len(kennitala) != 10:
        return None

    try:
        day = int(kennitala[0:2])
        month = int(kennitala[2:4])
        year_short = int(kennitala[4:6])
        century_digit = int(kennitala[9])

        # Determine century
        if century_digit == 0:
            century = 2000
        elif century_digit in (8, 9):
            century = 1800
        else:
            century = 1900

        year = century + year_short

        # Validate date
        birthday = datetime(year, month, day)
        return birthday.strftime('%Y-%m-%d')
    except (ValueError, IndexError):
        return None


def get_next_comrade_id(db: firestore.Client) -> int:
    """
    Get next comrade_id using Firestore counter.

    Uses atomic increment on /counters/comrade_id document.
    """
    counter_ref = db.collection('counters').document('comrade_id')

    # Try to increment existing counter
    try:
        counter_ref.update({'value': Increment(1)})
        doc = counter_ref.get()
        return doc.to_dict()['value']
    except Exception:
        # Counter doesn't exist, initialize it
        # First, count existing members to start from correct number
        members_count = len(list(db.collection('members').limit(10000).stream()))
        initial_value = max(members_count + 1, 1917)  # Start at 1917 minimum (symbolic)

        counter_ref.set({'value': initial_value})
        return initial_value


def get_lookup_name(db: firestore.Client, collection: str, item_id: int) -> str | None:
    """Get name from lookup collection by ID."""
    if not item_id:
        return None

    doc = db.collection(collection).document(str(item_id)).get()
    if doc.exists:
        return doc.to_dict().get('name')
    return None


def get_address_from_iceaddr(address_id: int) -> dict | None:
    """
    Get address details from iceaddr by hnitnum.

    Uses the iceaddr library to look up address.
    """
    try:
        from iceaddr import iceaddr_lookup

        results = iceaddr_lookup(hnitnum=address_id)
        if results:
            addr = results[0]
            return {
                'street': addr.get('heiti_nf', ''),
                'number': str(addr.get('husnr', '')) if addr.get('husnr') else '',
                'letter': addr.get('bokst', '') or '',
                'postal_code': str(addr.get('postnr', '')),
                'city': addr.get('stadur_nf', ''),
                'country': 'IS',
                'hnitnum': address_id,
                'is_default': True
            }
    except Exception as e:
        logger.error(f"Failed to lookup iceaddr: {e}")

    return None


def get_cell_for_postal_code(db: firestore.Client, postal_code_id: int) -> dict | None:
    """Get a random cell for postal code from pre-computed mapping."""
    import random

    doc = db.collection('postal_code_cells').document(str(postal_code_id)).get()
    if doc.exists:
        data = doc.to_dict()
        cells = data.get('cells', [])
        if cells:
            return random.choice(cells)
    return None


def get_postal_code_id_from_code(db: firestore.Client, postal_code: str) -> int | None:
    """Look up postal code ID from code (e.g., "101" -> 1)."""
    docs = db.collection('lookup_postal_codes').where('code', '==', postal_code).limit(1).stream()
    for doc in docs:
        return doc.to_dict().get('id')
    return None


@https_fn.on_call(
    region="europe-west2",
    memory=options.MemoryOption.MB_512,
    timeout_sec=60,
)
def register_member(req: https_fn.CallableRequest) -> dict[str, Any]:
    """
    Register a new member.

    Args:
        req.data: Registration data (see module docstring for fields)

    Returns:
        dict with 'comrade_id' (int) and 'error' (str or null)
    """
    try:
        data = req.data or {}

        # Extract required fields
        name = (data.get('comrade-name') or data.get('name', '')).strip()
        ssn = (data.get('comrade-ssn') or data.get('ssn', '')).strip()
        email = (data.get('contact_info-email') or data.get('email', '')).strip()
        phone = (data.get('contact_info-phone') or data.get('phone', '')).strip()

        # Validate required fields
        errors = {}

        if not name or len(name) < 3:
            errors['name'] = 'Nafn verður að vera að minnsta kosti 3 stafir'

        if not ssn or not validate_kennitala(ssn):
            errors['ssn'] = 'Þetta er ekki gild kennitala'

        if not email or not validate_email(email):
            errors['email'] = 'Þetta er ekki gilt netfang'

        if not phone:
            errors['phone'] = 'Sími vantar'

        if errors:
            log_json('WARN', 'Registration validation failed',
                     event='register_member_validation_error',
                     errors=errors)
            return {'comrade_id': None, 'error': errors}

        # Normalize inputs
        normalized_kennitala = normalize_kennitala(ssn)
        normalized_phone = normalize_phone(phone)
        birthday = parse_birthday_from_kennitala(normalized_kennitala)

        # Initialize Firestore
        db = firestore.client()

        # Check for duplicate kennitala
        existing = db.collection('members').document(normalized_kennitala).get()
        if existing.exists:
            log_json('WARN', 'Duplicate kennitala registration attempt',
                     event='register_member_duplicate',
                     kennitala=f"{normalized_kennitala[:6]}****")
            return {
                'comrade_id': None,
                'error': {'ssn': 'Þessi kennitala er þegar skráð'}
            }

        # Extract address info
        country_id = int(data.get('country-country', ICELAND_COUNTRY_ID))
        is_iceland = country_id == ICELAND_COUNTRY_ID
        is_unlocated = data.get('street-unlocated') in [True, 'true', 'on', 'True']

        addresses = []
        cell = None

        if is_iceland and not is_unlocated:
            # Iceland address with hnitnum
            address_id = data.get('local_address-address') or data.get('contact_info-address')
            if address_id:
                address_id = int(address_id)
                addr_data = get_address_from_iceaddr(address_id)
                if addr_data:
                    addresses.append(addr_data)
                    # Get cell for this postal code
                    pc_id = get_postal_code_id_from_code(db, addr_data['postal_code'])
                    if pc_id:
                        cell = get_cell_for_postal_code(db, pc_id)

        elif is_iceland and is_unlocated:
            # Iceland without specific address
            cell_id = data.get('cell-cell')
            if cell_id:
                cell = {'id': int(cell_id), 'name': 'Manual selection'}

        else:
            # Foreign address
            country_name = get_lookup_name(db, 'lookup_countries', country_id)
            addresses.append({
                'street': data.get('foreign_address-address', ''),
                'number': '',
                'letter': '',
                'postal_code': data.get('foreign_address-postal_code', ''),
                'city': data.get('foreign_address-municipality', ''),
                'country': country_name or str(country_id),
                'is_default': True
            })

        # Get union and title names
        union_id = data.get('union-union')
        title_id = data.get('title-title')

        union_name = get_lookup_name(db, 'lookup_unions', int(union_id)) if union_id else None
        title_name = get_lookup_name(db, 'lookup_job_titles', int(title_id)) if title_id else None

        # Get next comrade ID
        comrade_id = get_next_comrade_id(db)

        # Build member document
        housing_situation = data.get('comrade-housing_situation')
        reachable = data.get('comrade-reachable') not in [False, 'false', 'False']
        groupable = data.get('comrade-groupable') not in [False, 'false', 'False']

        member_doc = {
            'profile': {
                'kennitala': normalized_kennitala,
                'name': name,
                'birthday': birthday,
                'email': email.lower(),
                'phone': normalized_phone,
                'foreign_phone': '',
                'facebook': '',
                'gender': None,
                'reachable': reachable,
                'groupable': groupable,
                'housing_situation': int(housing_situation) if housing_situation else None,
                'addresses': addresses
            },
            'membership': {
                'date_joined': datetime.now(timezone.utc),
                'status': 'active',
                'unions': [union_name] if union_name else [],
                'titles': [title_name] if title_name else [],
                'cell': cell
            },
            'metadata': {
                'comrade_id': comrade_id,
                'created_at': firestore.SERVER_TIMESTAMP,
                'last_modified': datetime.now(timezone.utc),
                'source': 'skraning-static',
                'django_id': None  # Will be set after Django sync
            }
        }

        # Save to Firestore first
        db.collection('members').document(normalized_kennitala).set(member_doc)

        log_json('INFO', 'Member saved to Firestore',
                 event='register_member_firestore_saved',
                 comrade_id=comrade_id,
                 kennitala=f"{normalized_kennitala[:6]}****")

        # Sync to Django to get django_id
        django_id = None
        try:
            # Build address data for Django
            address_for_django = {}
            if addresses:
                addr = addresses[0]
                if addr.get('country') == 'IS':
                    if addr.get('hnitnum'):
                        address_for_django = {
                            'type': 'iceland',
                            'street': addr.get('street', ''),
                            'number': addr.get('number', ''),
                            'letter': addr.get('letter', ''),
                            'postal_code': addr.get('postal_code', ''),
                            'city': addr.get('city', ''),
                            'country': 'IS',
                            'hnitnum': addr.get('hnitnum')
                        }
                    else:
                        address_for_django = {
                            'type': 'unlocated',
                            'cell_id': cell.get('id') if cell else None
                        }
                else:
                    address_for_django = {
                        'type': 'foreign',
                        'street': addr.get('street', ''),
                        'postal_code': addr.get('postal_code', ''),
                        'city': addr.get('city', ''),
                        'country': addr.get('country', ''),
                        'country_id': country_id
                    }
            elif cell:
                # No address but has cell (unlocated)
                address_for_django = {
                    'type': 'unlocated',
                    'cell_id': cell.get('id')
                }

            django_data = {
                'kennitala': normalized_kennitala,
                'name': name,
                'email': email.lower(),
                'phone': normalized_phone,
                'birthday': birthday,
                'housing_situation': int(housing_situation) if housing_situation else None,
                'reachable': reachable,
                'groupable': groupable,
                'address': address_for_django,
                'union_name': union_name,
                'title_name': title_name
            }

            django_result = sync_member_to_django(django_data)
            if django_result and django_result.get('django_id'):
                django_id = django_result['django_id']

                # Update Firestore with django_id
                db.collection('members').document(normalized_kennitala).update({
                    'metadata.django_id': django_id
                })

                log_json('INFO', 'Updated Firestore with django_id',
                         event='register_member_django_id_updated',
                         django_id=django_id,
                         kennitala=f"{normalized_kennitala[:6]}****")

        except Exception as django_err:
            # Log but don't fail registration - Django sync can happen later
            log_json('WARN', 'Django sync failed but Firestore registration succeeded',
                     event='register_member_django_sync_failed',
                     error=str(django_err),
                     kennitala=f"{normalized_kennitala[:6]}****")

        log_json('INFO', 'Member registered successfully',
                 event='register_member_success',
                 comrade_id=comrade_id,
                 django_id=django_id,
                 kennitala=f"{normalized_kennitala[:6]}****",
                 has_address=len(addresses) > 0,
                 has_cell=cell is not None)

        return {'comrade_id': comrade_id, 'django_id': django_id, 'error': None}

    except Exception as e:
        logger.error(f"Registration failed: {e}")
        log_json('ERROR', 'Registration failed',
                 event='register_member_error',
                 error=str(e))
        return {
            'comrade_id': None,
            'error': 'Villa kom upp við skráningu. Reyndu aftur.'
        }
