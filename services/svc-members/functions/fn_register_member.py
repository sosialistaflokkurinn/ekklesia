"""
Register Member Cloud Function

Handles new member registration from skraning-static frontend.
Creates member in Cloud SQL (via Django API) and assigns to cell.

## Address Handling

For Iceland addresses, you MUST provide `address_id` which is the `hnitnum`
from the Icelandic address registry. Get it using:

1. Frontend: Use `search_addresses` Cloud Function (autocomplete)
2. Python: Use `iceaddr_lookup(street, number, postal_code)`
3. Direct: Query `stadfong` table in iceaddr database

See docs/ADDRESS_SYSTEM.md for full documentation.

## Usage

```python
register_member({
    # Required fields
    "name": "Jón Jónsson",
    "kennitala": "0000000000",  # Also accepts "ssn" for backwards compat
    "email": "jon@example.com",
    "phone": "8881234",
    "address_type": "iceland",  # or "foreign" or "unlocated"

    # For Iceland address (address_type="iceland"):
    "address_id": 2000507,  # <-- hnitnum from iceaddr (REQUIRED)

    # For foreign address (address_type="foreign"):
    "country_id": 45,
    "foreign_address": "123 Main Street",
    "foreign_municipality": "London",
    "foreign_postal_code": "SW1A 1AA",

    # For unlocated (address_type="unlocated"):
    "cell_id": 5,

    # Optional fields:
    "housing_situation": 2,
    "union_id": 93,
    "title_id": 14,
    "reachable": True,
    "groupable": True
})
```

Returns: `{ "comrade_id": 1234, "django_id": 1234, "error": null }`

## Important Notes

- If `address_id` is missing for Iceland addresses, the address will not
  be linked to the map or cell assignment.
- Use `search_addresses` Cloud Function for frontend autocomplete.
- Shadow banned kennitalas return fake success (security feature).
"""

import logging
import re
import random
from datetime import datetime, timezone
from typing import Any

from firebase_functions import https_fn, options
from firebase_admin import firestore

from shared.validators import normalize_kennitala, normalize_phone, validate_kennitala
from shared.rate_limit import check_rate_limit
from util_logging import log_json
from db_members import is_kennitala_banned, member_exists
from db_registration import create_member_in_cloudsql

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Iceland country ID
ICELAND_COUNTRY_ID = 109


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


def get_lookup_name(db: firestore.Client, collection: str, item_id: int) -> str | None:
    """Get name from lookup collection by ID."""
    if not item_id:
        return None

    doc = db.collection(collection).document(str(item_id)).get()
    if doc.exists:
        return doc.to_dict().get('name')
    return None


def get_address_from_iceaddr(hnitnum: int) -> dict | None:
    """
    Get address details from iceaddr by hnitnum.

    Uses direct SQL query to iceaddr SQLite database since
    iceaddr_lookup() doesn't support hnitnum parameter.

    Args:
        hnitnum: The unique address ID from Icelandic address registry

    Returns:
        Address dict or None if not found
    """
    try:
        from iceaddr.db import shared_db
        from iceaddr import postcode_lookup

        conn = shared_db.connection()
        cursor = conn.cursor()

        # Query by hnitnum - iceaddr's shared_db returns dict rows
        cursor.execute('SELECT * FROM stadfong WHERE hnitnum = ?', (hnitnum,))
        row = cursor.fetchone()

        if row:
            # iceaddr's connection returns dict rows
            postnr = row['postnr']

            # Get city name from postal code
            city = ''
            if postnr:
                pc_info = postcode_lookup(postnr)
                if pc_info:
                    city = pc_info.get('stadur_nf', '')

            result = {
                'street': row['heiti_nf'] or '',
                'number': str(row['husnr']) if row['husnr'] else '',
                'letter': row['bokst'] or '',
                'postal_code': str(postnr) if postnr else '',
                'city': city,
                'country': 'IS',
                'hnitnum': hnitnum,
                'is_default': True
            }
            log_json('INFO', 'Address lookup successful',
                     event='iceaddr_lookup_success',
                     hnitnum=hnitnum,
                     street=result['street'],
                     number=result['number'])
            return result
        else:
            log_json('WARN', 'Address not found in iceaddr',
                     event='iceaddr_lookup_not_found',
                     hnitnum=hnitnum)

    except Exception as e:
        log_json('ERROR', 'Failed to lookup iceaddr',
                 event='iceaddr_lookup_error',
                 hnitnum=hnitnum,
                 error=str(e),
                 error_type=type(e).__name__)

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
    """Look up postal code ID from code (e.g., "101" -> 81).

    Args:
        db: Firestore client
        postal_code: Postal code as string (e.g., "101")

    Returns:
        Postal code ID (for postal_code_cells lookup) or None
    """
    try:
        # Convert to int for Firestore query (code is stored as integer)
        code_int = int(postal_code)
        docs = db.collection('lookup_postal_codes').where('code', '==', code_int).limit(1).stream()
        for doc in docs:
            return doc.to_dict().get('id')
    except (ValueError, TypeError) as e:
        logger.warning(f"Invalid postal code format: {postal_code} - {e}")
    return None


@https_fn.on_call(
    region="europe-west2",
    memory=options.MemoryOption.MB_512,
    timeout_sec=60,
    secrets=["django-socialism-db-password"],  # Cloud SQL direct instead of Django API
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
        # Security: IP-based rate limiting (5 registrations per 10 minutes per IP)
        client_ip = None
        if hasattr(req, 'raw_request') and req.raw_request:
            client_ip = req.raw_request.headers.get('X-Forwarded-For', '').split(',')[0].strip()
            if not client_ip:
                client_ip = req.raw_request.remote_addr

        if client_ip and not check_rate_limit(client_ip, max_attempts=5, window_minutes=10):
            log_json('WARN', 'Registration rate limit exceeded',
                     event='register_member_rate_limited',
                     ip=client_ip[:20] if client_ip else 'unknown')
            return {
                'comrade_id': None,
                'error': {'_rate_limit': 'Of margar skráningar. Reyndu aftur eftir smá stund.'}
            }

        data = req.data or {}

        # Extract required fields
        name = (data.get('comrade-name') or data.get('name', '')).strip()
        # Accept both 'kennitala' and 'ssn' for backwards compatibility with external forms
        kennitala_raw = (
            data.get('comrade-kennitala') or
            data.get('comrade-ssn') or
            data.get('kennitala') or
            data.get('ssn', '')
        ).strip()
        email = (data.get('contact_info-email') or data.get('email', '')).strip()
        phone = (data.get('contact_info-phone') or data.get('phone', '')).strip()

        # Validate required fields
        errors = {}

        if not name or len(name) < 3:
            errors['name'] = 'Nafn verður að vera að minnsta kosti 3 stafir'

        if not kennitala_raw or not validate_kennitala(kennitala_raw):
            errors['kennitala'] = 'Þetta er ekki gild kennitala'

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
        normalized_kennitala = normalize_kennitala(kennitala_raw)
        normalized_phone = normalize_phone(phone)
        birthday = parse_birthday_from_kennitala(normalized_kennitala)

        # =====================================================================
        # SHADOW BAN CHECK
        # If kennitala is banned, return fake success but don't register
        # This prevents banned users from knowing they're banned
        # =====================================================================
        if is_kennitala_banned(normalized_kennitala):
            # Log the attempt for audit purposes (superuser can see this)
            log_json('WARN', 'Shadow banned registration attempt',
                     event='register_member_shadow_banned',
                     kennitala=f"{normalized_kennitala[:6]}****",
                     name=name[:20] if name else 'unknown',
                     email=email[:20] if email else 'unknown')

            # Store in audit log for superuser visibility
            try:
                db = firestore.client()
                db.collection('audit_log').add({
                    'event': 'shadow_ban_registration_blocked',
                    'timestamp': firestore.SERVER_TIMESTAMP,
                    'kennitala_hash': normalized_kennitala[:6] + '****',
                    'name': name,
                    'email': email,
                    'phone': normalized_phone,
                    'ip_address': req.raw_request.remote_addr if hasattr(req, 'raw_request') else None,
                    'details': 'Registration blocked due to banned kennitala (shadow ban)'
                })
            except Exception as audit_err:
                logger.warning(f"Failed to write shadow ban audit log: {audit_err}")

            # Return fake success - user thinks they registered
            # Security: Use random ID to prevent enumeration of banned kennitalas
            fake_id = random.randint(10000, 99999)
            return {
                'comrade_id': fake_id,
                'django_id': None,
                'error': None
                # Note: shadow_banned flag removed to prevent detection
            }

        # Check for duplicate kennitala in Cloud SQL (source of truth)
        if member_exists(normalized_kennitala):
            log_json('WARN', 'Duplicate kennitala registration attempt',
                     event='register_member_duplicate',
                     kennitala=f"{normalized_kennitala[:6]}****")
            return {
                'comrade_id': None,
                'error': {'kennitala': 'Þessi kennitala er nú þegar skráð í flokkinn. Skráðu þig inn á mínar síður til að skoða aðildina þína.'}
            }

        # Initialize Firestore (only for audit logging)
        db = firestore.client()

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

        # Extract optional fields
        housing_situation = data.get('comrade-housing_situation') or data.get('housingStatus')
        reachable_val = data.get('comrade-reachable', data.get('reachable'))
        groupable_val = data.get('comrade-groupable', data.get('groupable'))
        # Default to True if not specified, False only if explicitly false
        reachable = reachable_val not in [False, 'false', 'False']
        groupable = groupable_val not in [False, 'false', 'False']

        # Build address data for Django API
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

        # Create member directly in Cloud SQL (source of truth)
        member_data = {
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

        try:
            result = create_member_in_cloudsql(member_data)

            if not result.get('success') or not result.get('django_id'):
                log_json('ERROR', 'Cloud SQL registration failed',
                         event='register_member_cloudsql_failed',
                         kennitala=f"{normalized_kennitala[:6]}****",
                         error=result.get('error'))
                return {
                    'comrade_id': None,
                    'error': 'Villa kom upp við skráningu. Reyndu aftur.'
                }

            django_id = result['django_id']

            log_json('INFO', 'Member registered successfully in Cloud SQL',
                     event='register_member_success',
                     django_id=django_id,
                     kennitala=f"{normalized_kennitala[:6]}****",
                     has_address=len(addresses) > 0,
                     has_cell=cell is not None)

            # Return django_id as comrade_id (they are now the same)
            return {'comrade_id': django_id, 'django_id': django_id, 'error': None}

        except Exception as e:
            log_json('ERROR', 'Cloud SQL registration exception',
                     event='register_member_cloudsql_exception',
                     kennitala=f"{normalized_kennitala[:6]}****",
                     error=str(e))
            return {
                'comrade_id': None,
                'error': 'Villa kom upp við skráningu. Reyndu aftur.'
            }

    except Exception as e:
        logger.error(f"Registration failed: {e}")
        log_json('ERROR', 'Registration failed',
                 event='register_member_error',
                 error=str(e))
        return {
            'comrade_id': None,
            'error': 'Villa kom upp við skráningu. Reyndu aftur.'
        }
