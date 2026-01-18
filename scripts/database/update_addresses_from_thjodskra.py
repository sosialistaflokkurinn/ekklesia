#!/usr/bin/env python3
"""
Update member addresses from Þjóðskrá results using Django API.

This script:
1. Reads results from thjodskra-results.json
2. Uses iceaddr to validate addresses and get hnitnum
3. Updates addresses via Django API endpoint

Usage:
    python update_addresses_from_thjodskra.py --dry-run  # Test
    python update_addresses_from_thjodskra.py            # Execute

Requirements:
    pip install iceaddr requests

Environment:
    DJANGO_API_TOKEN: Django API token (or uses Secret Manager)
"""

import argparse
import json
import logging
import os
import re
import requests
from typing import Optional, Dict, Any

from iceaddr import iceaddr_lookup

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

RESULTS_FILE = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    'thjodskra-results.json'
)

DJANGO_API_BASE_URL = "https://starf.sosialistaflokkurinn.is/felagar"


def get_django_api_token() -> str:
    """Get Django API token from environment or Secret Manager."""
    if os.environ.get('DJANGO_API_TOKEN'):
        return os.environ['DJANGO_API_TOKEN']

    try:
        from google.cloud import secretmanager
        client = secretmanager.SecretManagerServiceClient()
        name = "projects/ekklesia-prod-10-2025/secrets/django-api-token/versions/latest"
        response = client.access_secret_version(request={"name": name})
        return response.payload.data.decode("UTF-8").strip()
    except Exception as e:
        logger.error(f"Failed to get Django API token: {e}")
        raise


def load_results() -> list:
    """Load Þjóðskrá lookup results from JSON file."""
    logger.info(f"Loading results from {RESULTS_FILE}")
    with open(RESULTS_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Filter to found members with addresses
    found = [r for r in data['results'] if r.get('found')]
    logger.info(f"Found {len(found)} members in Þjóðskrá")
    return found


def parse_address(heimili: str, postnumer: str) -> Optional[Dict[str, Any]]:
    """
    Parse Þjóðskrá address and look up in iceaddr.

    Returns dict with street, number, letter, postal_code, city, hnitnum
    or None if address couldn't be parsed/found.
    """
    if not heimili or not postnumer:
        return None

    # Skip special cases
    if heimili in ('Ótilgreint', 'Danmörk') or postnumer == '':
        return None

    # Parse "Street Number" or "Street Number-Number" format
    match = re.match(r'^(.+?)\s+(\d+)([a-zA-Z])?(?:-\d+[a-zA-Z]?)?$', heimili)
    if not match:
        logger.warning(f"Could not parse address: {heimili}")
        return None

    street = match.group(1)
    number = int(match.group(2))
    letter = match.group(3) or ''

    try:
        postal_code = int(postnumer)
    except ValueError:
        logger.warning(f"Invalid postal code: {postnumer}")
        return None

    # Look up in iceaddr
    results = iceaddr_lookup(street, number=number, postcode=postal_code)
    if not results:
        logger.warning(f"Address not found in iceaddr: {heimili}, {postnumer}")
        return None

    r = results[0]
    return {
        'street': r['heiti_nf'],
        'number': str(r['husnr']),
        'letter': r.get('bokst', ''),
        'postal_code': str(r['postnr']),
        'city': r['stadur_nf'],
        'hnitnum': r['hnitnum']
    }


def update_address_via_django(kennitala: str, address_data: dict, token: str) -> bool:
    """Update address via Django API."""
    payload = {
        'kennitala': kennitala,
        'street': address_data['street'],
        'number': address_data['number'],
        'letter': address_data.get('letter', ''),
        'postal_code': address_data['postal_code'],
        'city': address_data['city'],
        'hnitnum': address_data['hnitnum']
    }

    try:
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
            return True
        else:
            logger.error(f"Django API error: {response.status_code} - {response.text[:200]}")
            return False

    except requests.RequestException as e:
        logger.error(f"Request error: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description='Update member addresses from Þjóðskrá results'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be done without making changes'
    )
    args = parser.parse_args()

    # Load results
    found_members = load_results()

    if not found_members:
        logger.info("No members found in Þjóðskrá, nothing to update")
        return

    # Get API token (only if not dry run)
    token = None
    if not args.dry_run:
        logger.info("Getting Django API token...")
        token = get_django_api_token()

    # Process each member
    updated = 0
    skipped = 0
    errors = 0
    special_cases = []

    for member in found_members:
        kt = member['kt']
        heimili = member.get('heimili', '')
        postnumer = member.get('postnumer', '')
        sveitarfelag = member.get('sveitarfelag', '')
        nafn = member.get('nafn', 'Unknown')

        # Check for special cases
        if sveitarfelag == 'Abroad' or heimili == 'Ótilgreint' or not postnumer:
            special_cases.append({
                'kt': kt,
                'nafn': nafn,
                'heimili': heimili,
                'reason': 'Abroad' if sveitarfelag == 'Abroad' else 'Unlocated'
            })
            skipped += 1
            continue

        # Parse and look up address
        address_data = parse_address(heimili, postnumer)
        if not address_data:
            logger.warning(f"⚠️  {kt}: Could not process address '{heimili}, {postnumer}'")
            skipped += 1
            continue

        if args.dry_run:
            logger.info(f"[DRY RUN] {kt} ({nafn})")
            logger.info(f"  Þjóðskrá: {heimili}, {postnumer} {sveitarfelag}")
            logger.info(f"  iceaddr: {address_data['street']} {address_data['number']}{address_data['letter']}, "
                       f"{address_data['postal_code']} {address_data['city']} (hnitnum={address_data['hnitnum']})")
            updated += 1
        else:
            success = update_address_via_django(kt, address_data, token)
            if success:
                logger.info(f"✅ {kt}: {nafn} - {address_data['street']} {address_data['number']}, {address_data['postal_code']}")
                updated += 1
            else:
                logger.error(f"❌ {kt}: Failed to update")
                errors += 1

    # Print summary
    logger.info("=" * 50)
    logger.info("SUMMARY")
    logger.info("=" * 50)
    logger.info(f"  Updated: {updated}")
    logger.info(f"  Skipped: {skipped}")
    logger.info(f"  Errors: {errors}")

    if special_cases:
        logger.info("")
        logger.info("Special cases (require manual handling):")
        for sc in special_cases:
            logger.info(f"  {sc['kt']} ({sc['nafn']}): {sc['heimili']} - {sc['reason']}")


if __name__ == '__main__':
    main()
