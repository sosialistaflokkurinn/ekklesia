"""
Member Heatmap Cloud Functions

Returns aggregated member counts by municipality for visualization.
Privacy-preserving: Only returns aggregate counts, never individual data.

Two functions:
1. get_member_heatmap_data() - on_call function that reads precomputed stats
2. compute_member_heatmap_stats() - scheduled function that precomputes hourly

Usage:
    get_member_heatmap_data()
    Returns: {municipalities: [{name, count, percentage, voters_percentage, eligible_voters}], ...}

Data sources:
    - Member counts: Cloud SQL (PostgreSQL) - Django database
    - Eligible voters (18+): Hagstofa Íslands (Statistics Iceland), Jan 2025

Caching:
    Uses Firestore stats document (reliable in serverless)
    Scheduled function refreshes every hour

Migration Note (Dec 2025):
    Changed from Firestore to Cloud SQL for member data.
    Cloud SQL is the single source of truth (Django database).
"""

import json
import logging
import os
import time
from typing import Dict, List
from collections import defaultdict

from firebase_functions import https_fn, options, scheduler_fn
from firebase_admin import firestore

# Cloud SQL database connection
from db import execute_query


def _load_population_data() -> Dict[str, dict]:
    """
    Load municipality population data from JSON file.

    Returns:
        Dict mapping municipality name to population data
    """
    data_path = os.path.join(os.path.dirname(__file__), 'data', 'municipality_population.json')
    try:
        with open(data_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        logging.warning(f"Could not load population data: {e}")
        return {}

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Stats collection and document
STATS_COLLECTION = 'stats'
HEATMAP_DOC_ID = 'municipality_heatmap'
CACHE_TTL_SECONDS = 3600  # 1 hour - fallback for on-demand recompute


def _compute_heatmap_stats() -> dict:
    """
    Internal function to compute heatmap statistics from Cloud SQL.
    Called by both scheduled function and on-demand fallback.

    Data source: Cloud SQL PostgreSQL (Django database)

    Returns:
        dict: Heatmap data with voter percentages
    """
    logger.info("Computing heatmap stats from Cloud SQL")

    # Load population data (eligible voters by municipality)
    population_data = _load_population_data()
    total_eligible_voters = sum(
        m.get('adults_18_plus', 0) for m in population_data.values()
    )

    # Country code to name mapping (ISO 3166-1 alpha-2 → Icelandic names)
    country_names = {
        # Nordic countries
        'NO': 'Noregur',
        'DK': 'Danmörk',
        'SE': 'Svíþjóð',
        'FI': 'Finnland',
        'FO': 'Færeyjar',
        'AX': 'Álandseyjar',
        # Western Europe
        'DE': 'Þýskaland',
        'GB': 'Bretland',
        'IE': 'Írland',
        'FR': 'Frakkland',
        'NL': 'Holland',
        'BE': 'Belgía',
        'LU': 'Lúxemborg',
        'CH': 'Sviss',
        # Southern Europe
        'ES': 'Spánn',
        'PT': 'Portúgal',
        # Central/Eastern Europe
        'CZ': 'Tékkland',
        # Americas
        'US': 'Bandaríkin',
        'CA': 'Kanada',
        'PE': 'Perú',
        # Asia
        'CN': 'Kína',
        'IN': 'Indland',
        'KR': 'Suður-Kórea',
        'LB': 'Líbanon',
        'PH': 'Filippseyjar',
        # Africa
        'EG': 'Egyptaland',
        'ET': 'Eþíópía',
        'DZ': 'Alsír',
        # Oceania
        'AU': 'Ástralía',
        'NZ': 'Nýja-Sjáland',
        # Fallback
        'XX': 'Annað',
    }

    # Get total active members (excluding test accounts and deleted)
    total_result = execute_query("""
        SELECT COUNT(*) as count
        FROM membership_comrade
        WHERE deleted_at IS NULL
          AND ssn NOT LIKE '9999%%'
    """, fetch_one=True)
    total_members = total_result['count'] if total_result else 0

    # Map database municipality names → population data names (Hagstofa official names)
    # Database uses shorter names or old names from before municipal mergers
    # Population data uses official Hagstofa names (January 2025)
    db_to_population_name = {
        # Name differences
        'Reykjavík': 'Reykjavíkurborg',
        'Stykkishólmsbær': 'Sveitarfélagið Stykkishólmur',
        # Merged into Húnabyggð (2022)
        'Blönduósbær': 'Húnabyggð',
        # Merged into Múlaþing (2020)
        'Fljótsdalshérað': 'Múlaþing',
        'Breiðdalshreppur': 'Múlaþing',
        'Djúpavogshreppur': 'Múlaþing',
        # Merged into Suðurnesjabær (2022)
        'Sveitarfélagið Garður': 'Suðurnesjabær',
        'Sandgerðisbær': 'Suðurnesjabær',
        # Merged into Þingeyjarsveit
        'Skútustaðahreppur': 'Þingeyjarsveit',
        # Merged into Vesturbyggð
        'Tálknafjarðarhreppur': 'Vesturbyggð',
        # Merged into Sveitarfélagið Skagafjörður
        'Akrahreppur': 'Sveitarfélagið Skagafjörður',
        # Merged into Húnaþing vestra
        'Húnavatnshreppur': 'Húnaþing vestra',
    }

    # Count members by municipality (from local addresses)
    # Django model inheritance: newlocaladdress → newcomradeaddress (for current flag)
    # Then: map_address → map_street → map_municipality
    municipality_query = """
        SELECT m.name as municipality, COUNT(DISTINCT c.id) as count
        FROM membership_comrade c
        JOIN membership_newlocaladdress la ON la.comrade_id = c.id
        JOIN membership_newcomradeaddress nca ON la.newcomradeaddress_ptr_id = nca.id AND nca.current = true
        JOIN map_address a ON la.address_id = a.id
        JOIN map_street s ON a.street_id = s.id
        JOIN map_municipality m ON s.municipality_id = m.id
        WHERE c.deleted_at IS NULL
          AND c.ssn NOT LIKE '9999%%'
        GROUP BY m.name
        ORDER BY count DESC
    """
    municipality_rows = execute_query(municipality_query)

    # Normalize names to match population data
    municipality_counts: Dict[str, int] = {}
    for row in municipality_rows:
        db_name = row['municipality']
        normalized_name = db_to_population_name.get(db_name, db_name)
        # Aggregate in case multiple db names map to same population name
        municipality_counts[normalized_name] = municipality_counts.get(normalized_name, 0) + row['count']

    # Count members abroad (from foreign addresses)
    # Django model inheritance: newforeignaddress → newcomradeaddress (for current/country)
    # Iceland is country_id = 109
    # Use LEFT JOIN to include addresses with NULL country_id (labeled as 'XX' / Unknown)
    abroad_query = """
        SELECT COALESCE(co.code, 'XX') as country_code, COUNT(DISTINCT c.id) as count
        FROM membership_comrade c
        JOIN membership_newforeignaddress fa ON fa.comrade_id = c.id
        JOIN membership_newcomradeaddress nca ON fa.newcomradeaddress_ptr_id = nca.id AND nca.current = true
        LEFT JOIN map_country co ON nca.country_id = co.id
        WHERE c.deleted_at IS NULL
          AND c.ssn NOT LIKE '9999%%'
          AND (co.id IS NULL OR co.id != 109)
        GROUP BY COALESCE(co.code, 'XX')
        ORDER BY count DESC
    """
    abroad_rows = execute_query(abroad_query)
    abroad_counts: Dict[str, int] = {
        row['country_code']: row['count'] for row in abroad_rows
    }

    # Calculate totals
    total_with_local = sum(municipality_counts.values())
    total_abroad = sum(abroad_counts.values())
    total_with_address = total_with_local + total_abroad

    # Format response - include ALL municipalities (including those with 0 members)
    municipalities = []

    # Combine population data municipalities with actual counts
    all_municipalities = set(population_data.keys())
    all_municipalities.update(municipality_counts.keys())

    for name in all_municipalities:
        count = municipality_counts.get(name, 0)
        pop_info = population_data.get(name, {})
        eligible_voters = pop_info.get('adults_18_plus', 0)

        municipalities.append({
            'name': name,
            'count': count,
            'percentage': round((count / total_with_address * 100), 1) if total_with_address > 0 else 0,
            'voters_percentage': round((count / eligible_voters * 100), 2) if eligible_voters > 0 else 0,
            'eligible_voters': eligible_voters,
            'total_population': pop_info.get('total_population', 0)
        })

    # Sort: first by count descending, then by eligible_voters descending for ties
    municipalities.sort(key=lambda x: (-x['count'], -x['eligible_voters']))

    # Format abroad data - sorted by count descending
    abroad = []
    for country_code, count in abroad_counts.items():
        abroad.append({
            'country_code': country_code,
            'country_name': country_names.get(country_code, country_code),
            'count': count,
            'percentage': round((count / total_abroad * 100), 1) if total_abroad > 0 else 0
        })
    abroad.sort(key=lambda x: -x['count'])

    result = {
        'municipalities': municipalities,
        'abroad': abroad,
        'total_members': total_members,
        'total_with_address': total_with_address,
        'total_abroad': total_abroad,
        'total_eligible_voters': total_eligible_voters,
        'coverage_percentage': round((total_with_address / total_members * 100), 1) if total_members > 0 else 0,
        'national_voters_percentage': round((total_members / total_eligible_voters * 100), 2) if total_eligible_voters > 0 else 0,
        'last_updated': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'computed_at': int(time.time()),
        'population_source': 'Hagstofa Íslands, 1. janúar 2025',
        'data_source': 'Cloud SQL (PostgreSQL)'
    }

    logger.info(f"Computed heatmap: {len(municipalities)} municipalities, {total_abroad} abroad, {total_members} members")
    return result


@scheduler_fn.on_schedule(
    schedule="0 * * * *",  # Every hour at minute 0
    region="europe-west2",
    memory=options.MemoryOption.MB_512,
    timeout_sec=300,
    secrets=["django-socialism-db-password"],  # Cloud SQL access
)
def compute_member_heatmap_stats(event: scheduler_fn.ScheduledEvent) -> None:
    """
    Scheduled function to precompute heatmap statistics.
    Runs hourly to update the cached stats document.

    This prevents expensive full-collection scans on every user request.
    """
    logger.info("Scheduled heatmap computation starting")

    try:
        # Compute stats
        result = _compute_heatmap_stats()

        # Store in Firestore
        db = firestore.client()
        stats_ref = db.collection(STATS_COLLECTION).document(HEATMAP_DOC_ID)
        stats_ref.set(result)

        logger.info(f"Heatmap stats saved to Firestore: {STATS_COLLECTION}/{HEATMAP_DOC_ID}")

    except Exception as e:
        logger.error(f"Failed to compute heatmap stats: {e}")
        raise


@https_fn.on_call(
    region="europe-west2",
    memory=options.MemoryOption.MB_512,  # Increased for Cloud SQL connection
    timeout_sec=60,  # Increased for database queries
    secrets=["django-socialism-db-password"],  # Cloud SQL access
)
def get_member_heatmap_data(req: https_fn.CallableRequest) -> dict:
    """
    Get aggregated member counts by municipality.

    Reads from precomputed Firestore stats document (fast, cheap).
    Falls back to on-demand computation if stats are stale/missing.

    Args:
        req: Firebase callable request (requires authentication)

    Returns:
        dict: {
            municipalities: [{
                name: str,
                count: int,
                percentage: float,           # % of all members
                voters_percentage: float,    # % of eligible voters in municipality
                eligible_voters: int,        # Adults 18+ in municipality
                total_population: int        # Total population
            }],
            total_members: int,
            total_with_address: int,
            total_eligible_voters: int,      # National 18+ population
            coverage_percentage: float,
            national_voters_percentage: float,  # Members as % of national voters
            population_source: str,          # Data source attribution
            last_updated: str (ISO format)
        }

    Security:
        - Requires authenticated user
        - Only returns aggregate counts (privacy-preserving)
    """
    # Require authentication
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Authentication required"
        )

    logger.info("Fetching heatmap data")

    try:
        db = firestore.client()
        stats_ref = db.collection(STATS_COLLECTION).document(HEATMAP_DOC_ID)
        stats_doc = stats_ref.get()

        if stats_doc.exists:
            data = stats_doc.to_dict()
            computed_at = data.get('computed_at', 0)

            # Check if stats are fresh (less than 2 hours old)
            # Allow 2x TTL to handle missed scheduled runs
            if (time.time() - computed_at) < (CACHE_TTL_SECONDS * 2):
                logger.info("Returning precomputed heatmap data from Firestore")
                # Remove internal computed_at field from response
                data.pop('computed_at', None)
                return data
            else:
                logger.info("Precomputed stats are stale, recomputing...")
        else:
            logger.info("No precomputed stats found, computing on demand...")

        # Fallback: compute on demand and save
        # This should rarely happen if scheduled function is running
        result = _compute_heatmap_stats()

        # Save for next request
        stats_ref.set(result)

        # Remove internal field from response
        result.pop('computed_at', None)
        return result

    except Exception as e:
        logger.error(f"Failed to get heatmap data: {e}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Failed to get heatmap data"
        )
