#!/usr/bin/env python3
"""
Update Firestore members that were found in Þjóðskrá.

This script:
1. Reads results from thjodskra-results.json
2. For members that were found, updates Firestore to:
   - Set needs_review = false
   - Set thjodskra_not_found = false
   - Update address fields from Þjóðskrá data

Usage:
    python update_firestore_thjodskra_found.py --dry-run  # Test
    python update_firestore_thjodskra_found.py            # Execute
"""

import argparse
import json
import logging
import os
from datetime import datetime

import firebase_admin
from firebase_admin import credentials, firestore

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

RESULTS_FILE = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    'thjodskra-results.json'
)


def init_firebase() -> firestore.Client:
    """Initialize Firebase Admin SDK and return Firestore client."""
    if not firebase_admin._apps:
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {
            'projectId': 'ekklesia-prod-10-2025'
        })
    return firestore.client()


def load_results() -> list:
    """Load Þjóðskrá lookup results from JSON file."""
    logger.info(f"Loading results from {RESULTS_FILE}")
    with open(RESULTS_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Filter to only found members
    found = [r for r in data['results'] if r.get('found')]
    logger.info(f"Found {len(found)} members in Þjóðskrá")
    return found


def update_firestore(db: firestore.Client, found_members: list, dry_run: bool = False):
    """Update Firestore documents for found members."""
    members_ref = db.collection('members')

    updated = 0
    errors = 0
    not_in_firestore = 0

    for member in found_members:
        kt = member['kt']
        doc_ref = members_ref.document(kt)

        # Check if document exists
        doc = doc_ref.get()
        if not doc.exists:
            logger.warning(f"⚠️  {kt}: Not in Firestore, skipping")
            not_in_firestore += 1
            continue

        current_data = doc.to_dict()

        # Prepare update data
        update_data = {
            'needs_review': False,
            'thjodskra_not_found': False,
            'thjodskra_lookup_date': datetime.now().isoformat(),
            'thjodskra_name': member.get('nafn', ''),
        }

        # Add address if available
        if member.get('heimili'):
            update_data['thjodskra_address'] = member['heimili']
        if member.get('postnumer'):
            update_data['thjodskra_postal_code'] = member['postnumer']
        if member.get('sveitarfelag'):
            update_data['thjodskra_municipality'] = member['sveitarfelag']

        # Check if abroad
        if member.get('sveitarfelag') == 'Abroad':
            update_data['thjodskra_abroad'] = True

        if dry_run:
            logger.info(f"[DRY RUN] {kt} ({member.get('nafn', 'Unknown')})")
            logger.info(f"  Current: needs_review={current_data.get('needs_review')}, "
                       f"thjodskra_not_found={current_data.get('thjodskra_not_found')}")
            logger.info(f"  Would update: {update_data}")
            updated += 1
        else:
            try:
                doc_ref.update(update_data)
                logger.info(f"✅ {kt}: {member.get('nafn', 'Unknown')} - Updated")
                updated += 1
            except Exception as e:
                logger.error(f"❌ {kt}: Error - {e}")
                errors += 1

    return {
        'updated': updated,
        'errors': errors,
        'not_in_firestore': not_in_firestore,
        'total_found': len(found_members)
    }


def main():
    parser = argparse.ArgumentParser(
        description='Update Firestore for members found in Þjóðskrá'
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

    # Initialize Firebase
    logger.info("Initializing Firebase...")
    db = init_firebase()

    # Update Firestore
    if args.dry_run:
        logger.info("=== DRY RUN MODE ===")

    stats = update_firestore(db, found_members, dry_run=args.dry_run)

    # Print summary
    logger.info("=" * 50)
    logger.info("SUMMARY")
    logger.info("=" * 50)
    for key, value in stats.items():
        logger.info(f"  {key}: {value}")


if __name__ == '__main__':
    main()
