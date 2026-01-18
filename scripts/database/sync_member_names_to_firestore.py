#!/usr/bin/env python3
"""
Sync member names from PostgreSQL (Cloud SQL) to Firestore.

This script reads member names from the Cloud SQL membership_comrade table
and updates the corresponding Firestore documents in the 'members' collection.

The Firestore members collection uses kennitala (ssn) as the document ID.

Usage:
    # Test what would be done
    python sync_member_names_to_firestore.py --dry-run

    # Sync all members
    python sync_member_names_to_firestore.py

    # Sync with verbose output
    python sync_member_names_to_firestore.py --verbose

Requirements:
    pip install firebase-admin pg8000

Environment:
    DB_PASSWORD: Database password (or will use Secret Manager)
    LOCAL_DB_HOST: Database host (e.g., localhost:5433 for Cloud SQL Proxy)

Before running:
    1. Start Cloud SQL Proxy:
       cloud-sql-proxy ekklesia-prod-10-2025:europe-west1:ekklesia-db-eu1 --port 5433 --gcloud-auth

    2. Set environment variables:
       export LOCAL_DB_HOST=localhost:5433
       export DB_PASSWORD='Socialism2025#Db'
"""

import argparse
import logging
import os
from typing import Dict, List, Any

import pg8000
import firebase_admin
from firebase_admin import credentials, firestore

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Database configuration
DB_HOST = os.environ.get('LOCAL_DB_HOST', 'localhost:5433')
DB_NAME = 'socialism'
DB_USER = 'socialism'


def init_firebase() -> firestore.Client:
    """Initialize Firebase Admin SDK and return Firestore client."""
    if not firebase_admin._apps:
        # Use application default credentials
        cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred, {
            'projectId': 'ekklesia-prod-10-2025'
        })
    return firestore.client()


def get_db_password() -> str:
    """Get database password from environment or Secret Manager."""
    # Check explicit DB_PASSWORD
    if os.environ.get('DB_PASSWORD'):
        return os.environ['DB_PASSWORD']

    # Fallback: Use Secret Manager API
    try:
        from google.cloud import secretmanager
        client = secretmanager.SecretManagerServiceClient()
        name = "projects/ekklesia-prod-10-2025/secrets/django-socialism-db-password/versions/latest"
        response = client.access_secret_version(request={"name": name})
        return response.payload.data.decode("UTF-8").strip()
    except Exception as e:
        logger.error(f"Failed to get database password: {e}")
        raise


def get_members_from_postgres() -> List[Dict[str, Any]]:
    """
    Fetch all members with names from PostgreSQL.

    Returns:
        List of dicts with kennitala and name
    """
    password = get_db_password()

    # Parse host:port
    if ':' in DB_HOST:
        host, port = DB_HOST.split(':')
    else:
        host = DB_HOST
        port = '5432'

    logger.info(f"Connecting to PostgreSQL at {host}:{port}...")

    conn = pg8000.connect(
        host=host,
        port=int(port),
        user=DB_USER,
        password=password,
        database=DB_NAME,
    )

    try:
        cursor = conn.cursor()

        # Get all members with names (excluding test accounts and deleted)
        query = """
            SELECT ssn, name
            FROM membership_comrade
            WHERE deleted_at IS NULL
              AND name IS NOT NULL
              AND name != ''
              AND ssn NOT LIKE '9999%%'
              AND ssn NOT LIKE '0101%%'
            ORDER BY ssn
        """

        cursor.execute(query)
        columns = ['ssn', 'name']
        rows = cursor.fetchall()

        members = [dict(zip(columns, row)) for row in rows]
        logger.info(f"Found {len(members)} members with names in PostgreSQL")

        return members

    finally:
        cursor.close()
        conn.close()


def get_firestore_members_without_names(db: firestore.Client) -> Dict[str, Dict]:
    """
    Get all Firestore members that don't have a name or have empty name.

    Returns:
        Dict mapping kennitala -> document data
    """
    logger.info("Fetching Firestore members...")

    members_ref = db.collection('members')
    docs = members_ref.stream()

    members_needing_names = {}
    total = 0

    for doc in docs:
        total += 1
        data = doc.to_dict()
        kt = doc.id

        # Skip test accounts
        if kt.startswith('9999') or kt.startswith('0101'):
            continue

        # Check if name is missing or empty
        name = data.get('name', '')
        if not name or name.strip() == '':
            members_needing_names[kt] = data

    logger.info(f"Found {len(members_needing_names)} members needing names out of {total} total")

    return members_needing_names


def sync_names(
    db: firestore.Client,
    postgres_members: List[Dict],
    firestore_members: Dict[str, Dict],
    dry_run: bool = False,
    verbose: bool = False
) -> Dict[str, int]:
    """
    Sync names from PostgreSQL to Firestore.

    Args:
        db: Firestore client
        postgres_members: Members from PostgreSQL with names
        firestore_members: Firestore members needing names
        dry_run: If True, only log what would be done
        verbose: If True, log each update

    Returns:
        Dict with update statistics
    """
    # Build lookup by kennitala
    pg_lookup = {m['ssn']: m['name'] for m in postgres_members}

    # Find members to update
    to_update = []
    for kt, fs_data in firestore_members.items():
        if kt in pg_lookup:
            to_update.append({
                'kennitala': kt,
                'name': pg_lookup[kt]
            })

    logger.info(f"Found {len(to_update)} members to update")

    if dry_run:
        logger.info(f"[DRY RUN] Would update {len(to_update)} members")
        # Note: No PII logging - CodeQL flags even masked kennitalas
        return {
            'would_update': len(to_update),
            'firestore_needing_names': len(firestore_members),
            'postgres_with_names': len(postgres_members)
        }

    # Batch write to Firestore (500 per batch)
    batch_size = 500
    updated = 0
    errors = 0

    members_ref = db.collection('members')

    for i in range(0, len(to_update), batch_size):
        batch = db.batch()
        batch_items = to_update[i:i + batch_size]

        for item in batch_items:
            doc_ref = members_ref.document(item['kennitala'])
            batch.update(doc_ref, {
                'name': item['name'],
                'name_synced_from_postgres': True,
                'name_sync_date': firestore.SERVER_TIMESTAMP
            })

            # Note: No PII logging - CodeQL flags even masked kennitalas

        try:
            batch.commit()
            updated += len(batch_items)
            logger.info(f"Updated {updated}/{len(to_update)} members")
        except Exception as e:
            logger.error(f"Batch commit failed: {e}")
            errors += len(batch_items)

    return {
        'updated': updated,
        'errors': errors,
        'firestore_needing_names': len(firestore_members),
        'postgres_with_names': len(postgres_members)
    }


def main():
    parser = argparse.ArgumentParser(
        description='Sync member names from PostgreSQL to Firestore'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be done without making changes'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Show verbose output (each update)'
    )
    parser.add_argument(
        '--all',
        action='store_true',
        help='Update all members (not just those missing names)'
    )

    args = parser.parse_args()

    # Initialize Firebase
    logger.info("Initializing Firebase...")
    db = init_firebase()

    # Get members from PostgreSQL
    postgres_members = get_members_from_postgres()

    if args.all:
        # Update ALL members, not just missing names
        logger.info("Mode: Update all members (--all)")
        # Get all Firestore members
        members_ref = db.collection('members')
        docs = members_ref.stream()

        firestore_members = {}
        for doc in docs:
            kt = doc.id
            if not kt.startswith('9999') and not kt.startswith('0101'):
                firestore_members[kt] = doc.to_dict()

        logger.info(f"Will update {len(firestore_members)} Firestore members")
    else:
        # Get only Firestore members without names
        firestore_members = get_firestore_members_without_names(db)

    # Sync names
    stats = sync_names(
        db,
        postgres_members,
        firestore_members,
        dry_run=args.dry_run,
        verbose=args.verbose
    )

    # Print summary
    logger.info("=" * 50)
    logger.info("SYNC SUMMARY")
    logger.info("=" * 50)
    for key, value in stats.items():
        logger.info(f"  {key}: {value}")


if __name__ == '__main__':
    main()
