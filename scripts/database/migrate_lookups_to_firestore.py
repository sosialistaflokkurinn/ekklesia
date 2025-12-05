#!/usr/bin/env python3
"""
Migrate lookup data from Django API to Firestore.

This script fetches reference data (unions, job titles, countries, postal codes)
from the Django API and populates Firestore collections.

Usage:
    python migrate_lookups_to_firestore.py --collection unions
    python migrate_lookups_to_firestore.py --collection job_titles
    python migrate_lookups_to_firestore.py --collection countries
    python migrate_lookups_to_firestore.py --collection postal_codes
    python migrate_lookups_to_firestore.py --collection postal_code_cells
    python migrate_lookups_to_firestore.py --all

Requirements:
    pip install firebase-admin requests

Environment:
    GOOGLE_APPLICATION_CREDENTIALS: Path to service account JSON
    DJANGO_API_URL: Base URL for Django API (default: https://django-socialism-demo-521240388393.europe-west2.run.app)
    LINODE_API_URL: Base URL for Linode Django (for PostGIS queries, default: https://starf.sosialistaflokkurinn.is)
"""

import argparse
import logging
import os
import sys
from datetime import datetime
from typing import Any

import requests
import firebase_admin
from firebase_admin import credentials, firestore

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Django API base URL (Cloud Run)
DJANGO_API_URL = os.environ.get(
    'DJANGO_API_URL',
    'https://django-socialism-demo-521240388393.europe-west2.run.app'
)

# Linode Django API (for PostGIS queries like pnr-sellur)
LINODE_API_URL = os.environ.get(
    'LINODE_API_URL',
    'https://starf.sosialistaflokkurinn.is'
)

# Firestore collection names
COLLECTIONS = {
    'unions': 'lookup_unions',
    'job_titles': 'lookup_job_titles',
    'countries': 'lookup_countries',
    'postal_codes': 'lookup_postal_codes',
    'postal_code_cells': 'postal_code_cells',
}

# Django API endpoints
ENDPOINTS = {
    'unions': '/kort/stettarfelog/',
    'job_titles': '/kort/starfsheiti/',
    'countries': '/kort/lond/',
    'postal_codes': '/kort/pnr/',
}


def init_firebase() -> firestore.Client:
    """Initialize Firebase Admin SDK and return Firestore client."""
    if not firebase_admin._apps:
        # Try to use application default credentials
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {
            'projectId': 'ekklesia-prod-10-2025'
        })
    return firestore.client()


def fetch_from_django(endpoint: str) -> list[dict[str, Any]]:
    """Fetch data from Django API endpoint."""
    url = f"{DJANGO_API_URL}{endpoint}"
    logger.info(f"Fetching from: {url}")

    response = requests.get(url, timeout=30)
    response.raise_for_status()

    data = response.json()
    logger.info(f"Fetched {len(data)} items")
    return data


def transform_union(item: dict) -> dict:
    """Transform Django union data to Firestore format."""
    return {
        'id': item['id'],
        'name': item['name'],
        'abbreviation': item.get('abbreviation') or None,
        'logo': item.get('logo') or None,
        'created_at': firestore.SERVER_TIMESTAMP,
        'updated_at': firestore.SERVER_TIMESTAMP,
    }


def transform_job_title(item: dict) -> dict:
    """Transform Django job title data to Firestore format."""
    return {
        'id': item['id'],
        'name': item['name'],
        'created_at': firestore.SERVER_TIMESTAMP,
        'updated_at': firestore.SERVER_TIMESTAMP,
    }


def transform_country(item: dict) -> dict:
    """Transform Django country data to Firestore format."""
    return {
        'id': item['id'],
        'code': item['code'],
        'name': item['name'],
        'created_at': firestore.SERVER_TIMESTAMP,
        'updated_at': firestore.SERVER_TIMESTAMP,
    }


def transform_postal_code(item: dict) -> dict:
    """Transform Django postal code data to Firestore format."""
    region = item.get('region') or {}
    return {
        'id': item['id'],
        'code': item['code'],
        'region_id': region.get('id'),
        'region_name': region.get('name'),
        'created_at': firestore.SERVER_TIMESTAMP,
        'updated_at': firestore.SERVER_TIMESTAMP,
    }


TRANSFORMERS = {
    'unions': transform_union,
    'job_titles': transform_job_title,
    'countries': transform_country,
    'postal_codes': transform_postal_code,
}


def migrate_collection(
    db: firestore.Client,
    collection_type: str,
    dry_run: bool = False
) -> int:
    """
    Migrate a single collection from Django to Firestore.

    Args:
        db: Firestore client
        collection_type: One of 'unions', 'job_titles', 'countries', 'postal_codes'
        dry_run: If True, only log what would be done

    Returns:
        Number of documents written
    """
    if collection_type not in COLLECTIONS:
        raise ValueError(f"Unknown collection type: {collection_type}")

    collection_name = COLLECTIONS[collection_type]
    endpoint = ENDPOINTS[collection_type]
    transformer = TRANSFORMERS[collection_type]

    logger.info(f"Migrating {collection_type} to {collection_name}")

    # Fetch from Django
    items = fetch_from_django(endpoint)

    if dry_run:
        logger.info(f"[DRY RUN] Would write {len(items)} documents to {collection_name}")
        for item in items[:3]:
            transformed = transformer(item)
            logger.info(f"  Sample: {transformed}")
        return 0

    # Write to Firestore in batches
    batch_size = 500
    written = 0
    collection_ref = db.collection(collection_name)

    for i in range(0, len(items), batch_size):
        batch = db.batch()
        batch_items = items[i:i + batch_size]

        for item in batch_items:
            transformed = transformer(item)
            doc_id = str(transformed['id'])
            doc_ref = collection_ref.document(doc_id)
            batch.set(doc_ref, transformed)

        batch.commit()
        written += len(batch_items)
        logger.info(f"Written {written}/{len(items)} documents")

    logger.info(f"Migration complete: {written} documents in {collection_name}")
    return written


def clear_collection(db: firestore.Client, collection_type: str) -> int:
    """Delete all documents in a collection before migrating."""
    collection_name = COLLECTIONS[collection_type]
    collection_ref = db.collection(collection_name)

    docs = collection_ref.stream()
    deleted = 0

    batch = db.batch()
    batch_count = 0

    for doc in docs:
        batch.delete(doc.reference)
        batch_count += 1
        deleted += 1

        if batch_count >= 500:
            batch.commit()
            batch = db.batch()
            batch_count = 0

    if batch_count > 0:
        batch.commit()

    logger.info(f"Cleared {deleted} documents from {collection_name}")
    return deleted


def migrate_postal_code_cells(
    db: firestore.Client,
    dry_run: bool = False
) -> int:
    """
    Migrate postal code to cells mapping from Linode Django to Firestore.

    This requires PostGIS which only Linode has, so we use LINODE_API_URL.
    For each postal code, we query the cells that intersect with it.

    Args:
        db: Firestore client
        dry_run: If True, only log what would be done

    Returns:
        Number of documents written
    """
    logger.info("Migrating postal_code_cells mapping")

    # First, get all postal codes
    postal_codes = fetch_from_django('/kort/pnr/')
    logger.info(f"Found {len(postal_codes)} postal codes to process")

    if dry_run:
        logger.info("[DRY RUN] Would fetch cells for each postal code from Linode")
        return 0

    collection_ref = db.collection('postal_code_cells')
    written = 0
    errors = 0

    for pc in postal_codes:
        pc_id = pc['id']
        try:
            # Query Linode for cells intersecting this postal code
            url = f"{LINODE_API_URL}/kort/pnr-sellur/?postal_code_id={pc_id}"
            response = requests.get(url, timeout=30)

            if response.status_code == 200:
                cells = response.json()
                # Store as list of {id, name}
                cell_list = [{'id': c['id'], 'name': c['name']} for c in cells]

                doc_ref = collection_ref.document(str(pc_id))
                doc_ref.set({
                    'postal_code_id': pc_id,
                    'postal_code': pc['code'],
                    'cells': cell_list,
                    'cell_count': len(cell_list),
                    'created_at': firestore.SERVER_TIMESTAMP,
                    'updated_at': firestore.SERVER_TIMESTAMP,
                })
                written += 1

                if written % 20 == 0:
                    logger.info(f"Processed {written}/{len(postal_codes)} postal codes")
            else:
                logger.warning(f"Failed to fetch cells for postal code {pc_id}: HTTP {response.status_code}")
                errors += 1

        except Exception as e:
            logger.error(f"Error processing postal code {pc_id}: {e}")
            errors += 1

    logger.info(f"Migration complete: {written} postal codes processed, {errors} errors")
    return written


def main():
    parser = argparse.ArgumentParser(
        description='Migrate lookup data from Django to Firestore'
    )
    parser.add_argument(
        '--collection',
        choices=list(COLLECTIONS.keys()),
        help='Collection to migrate'
    )
    parser.add_argument(
        '--all',
        action='store_true',
        help='Migrate all collections'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be done without making changes'
    )
    parser.add_argument(
        '--clear',
        action='store_true',
        help='Clear existing documents before migrating'
    )

    args = parser.parse_args()

    if not args.collection and not args.all:
        parser.error('Either --collection or --all must be specified')

    # Initialize Firebase
    logger.info("Initializing Firebase...")
    db = init_firebase()

    # Determine which collections to migrate
    collections_to_migrate = (
        list(COLLECTIONS.keys()) if args.all
        else [args.collection]
    )

    total_written = 0

    for collection_type in collections_to_migrate:
        try:
            if args.clear and not args.dry_run:
                clear_collection(db, collection_type)

            # Special handling for postal_code_cells (requires Linode)
            if collection_type == 'postal_code_cells':
                written = migrate_postal_code_cells(db, dry_run=args.dry_run)
            else:
                written = migrate_collection(db, collection_type, dry_run=args.dry_run)
            total_written += written

        except Exception as e:
            logger.error(f"Failed to migrate {collection_type}: {e}")
            if not args.all:
                sys.exit(1)

    logger.info(f"Total documents written: {total_written}")


if __name__ == '__main__':
    main()
