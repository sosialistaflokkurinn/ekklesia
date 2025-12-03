"""
Cloud Function: Validate Icelandic Address
Callable HTTPS Function

This function validates Icelandic addresses using the iceaddr library.
It takes address components and returns validated, standardized address data
with GPS coordinates from the official Icelandic national address registry.

Usage from frontend:
    const result = await validateAddress({
        street: 'Njálsgata',
        number: 8,
        letter: 'C',
        postal_code: 101
    });
"""

from firebase_functions import https_fn, options
from iceaddr import iceaddr_lookup, postcode_lookup
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@https_fn.on_call(
    region="europe-west2",
    memory=options.MemoryOption.MB_256,
    timeout_sec=30
)
def validate_address(req: https_fn.CallableRequest) -> dict:
    """
    Validate and standardize an Icelandic address using iceaddr.

    Args:
        req.data: dict containing:
            - street (str): Street name (e.g., "Njálsgata")
            - number (int/str): House number (e.g., 8)
            - letter (str, optional): House letter (e.g., "C")
            - postal_code (str/int, optional): Postal code (e.g., 101)

    Returns:
        dict: {
            'valid': bool,              # Was address found in registry?
            'address': dict or None,    # Validated address data if found
            'error': str or None        # Error message if invalid
        }

        If valid=True, address contains:
            - street: str              # Standardized street name
            - number: int              # House number
            - letter: str              # House letter (or empty string)
            - postal_code: int         # Postal code
            - city: str                # City/town name
            - municipality: str        # Municipality name
            - latitude: float          # GPS latitude (WGS84)
            - longitude: float         # GPS longitude (WGS84)
            - hnitnum: int             # National registry ID
            - landnr: int              # Land registry number
    """
    try:
        # Extract request data
        data = req.data

        # Validate input
        if not data:
            return {
                'valid': False,
                'address': None,
                'error': 'No data provided'
            }

        street = data.get('street', '').strip()
        number = data.get('number')
        letter = data.get('letter', '').strip().upper()
        postal_code = data.get('postal_code')

        # Validate required fields
        if not street:
            return {
                'valid': False,
                'address': None,
                'error': 'Street name is required'
            }

        if not number:
            return {
                'valid': False,
                'address': None,
                'error': 'House number is required'
            }

        # Convert types
        try:
            number_int = int(number)
        except (ValueError, TypeError):
            return {
                'valid': False,
                'address': None,
                'error': f'Invalid house number: {number}'
            }

        # Convert postal code if provided
        postal_code_int = None
        if postal_code:
            try:
                postal_code_int = int(postal_code)
            except (ValueError, TypeError):
                logger.warning(f'Invalid postal code: {postal_code}, will search without it')

        logger.info(f"Validating address: {street} {number_int}{letter}, {postal_code_int}")

        # Query iceaddr
        addresses = iceaddr_lookup(
            street,
            number=number_int,
            letter=letter if letter else None,
            postcode=postal_code_int
        )

        # If not found with letter, try without letter
        if not addresses and letter:
            logger.info(f"Retrying without letter: {letter}")
            addresses = iceaddr_lookup(
                street,
                number=number_int,
                postcode=postal_code_int
            )

        # Check if address was found
        if not addresses:
            error_msg = f'Address not found in national registry: {street} {number_int}{letter}'
            if postal_code_int:
                error_msg += f', {postal_code_int}'

            logger.warning(error_msg)
            return {
                'valid': False,
                'address': None,
                'error': error_msg
            }

        # Take first result (best match from iceaddr)
        iceaddr_data = addresses[0]

        # Extract and structure validated address data
        validated_address = {
            'street': iceaddr_data['heiti_nf'],           # Street name (nominative case)
            'number': iceaddr_data['husnr'],              # House number
            'letter': iceaddr_data.get('bokst', ''),      # House letter (or empty)
            'postal_code': iceaddr_data['postnr'],        # Postal code
            'city': iceaddr_data['stadur_nf'],            # City/town name (nominative)
            'municipality': iceaddr_data.get('svfheiti', ''),  # Municipality name
            'latitude': iceaddr_data['lat_wgs84'],        # GPS latitude
            'longitude': iceaddr_data['long_wgs84'],      # GPS longitude
            'hnitnum': iceaddr_data.get('hnitnum'),       # National registry ID
            'landnr': iceaddr_data.get('landnr')          # Land registry number
        }

        logger.info(f"Address validated successfully: {validated_address['street']} {validated_address['number']}{validated_address['letter']}, {validated_address['postal_code']} {validated_address['city']}")

        return {
            'valid': True,
            'address': validated_address,
            'error': None
        }

    except Exception as e:
        error_msg = f'Address validation error: {str(e)}'
        logger.error(error_msg, exc_info=True)
        return {
            'valid': False,
            'address': None,
            'error': error_msg
        }


@https_fn.on_call(
    region="europe-west2",
    memory=options.MemoryOption.MB_256,
    timeout_sec=10
)
def validate_postal_code(req: https_fn.CallableRequest) -> dict:
    """
    Validate an Icelandic postal code.

    Args:
        req.data: dict containing:
            - postal_code (int/str): Postal code to validate (e.g., 101)

    Returns:
        dict: {
            'valid': bool,
            'info': dict or None,  # Postal code info if valid
            'error': str or None
        }

        If valid=True, info contains:
            - code: int           # Postal code
            - city: str           # City/town name
            - region: str         # Region name
            - municipality: str   # Municipality name
    """
    try:
        data = req.data

        if not data:
            return {
                'valid': False,
                'info': None,
                'error': 'No data provided'
            }

        postal_code = data.get('postal_code')

        if not postal_code:
            return {
                'valid': False,
                'info': None,
                'error': 'Postal code is required'
            }

        # Convert to int
        try:
            postal_code_int = int(postal_code)
        except (ValueError, TypeError):
            return {
                'valid': False,
                'info': None,
                'error': f'Invalid postal code format: {postal_code}'
            }

        # Lookup postal code
        info = postcode_lookup(postal_code_int)

        if not info:
            return {
                'valid': False,
                'info': None,
                'error': f'Postal code not found: {postal_code_int}'
            }

        # Structure postal code info
        postal_info = {
            'code': info.get('postnr'),
            'city': info.get('stadur_nf', ''),
            'region': info.get('svaedi_nf', ''),
            'municipality': info.get('svfheiti', '')
        }

        logger.info(f"Postal code validated: {postal_info['code']} - {postal_info['city']}")

        return {
            'valid': True,
            'info': postal_info,
            'error': None
        }

    except Exception as e:
        error_msg = f'Postal code validation error: {str(e)}'
        logger.error(error_msg, exc_info=True)
        return {
            'valid': False,
            'info': None,
            'error': error_msg
        }
