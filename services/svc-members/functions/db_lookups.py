"""
Cloud SQL Lookup Queries

Helper functions for querying lookup data from Cloud SQL (Django database).
These replace Firestore lookup collections.

Tables:
    - membership_union → list_unions()
    - membership_title → list_job_titles()
    - map_country → list_countries()
    - map_postalcode → list_postal_codes()
"""

import logging
from typing import List, Dict, Any
from db import execute_query

logger = logging.getLogger(__name__)


def get_unions() -> List[Dict[str, Any]]:
    """
    Get all unions (stéttarfélög) for dropdown selection.

    Returns:
        List of dicts with id, name, abbreviation, logo
    """
    query = """
        SELECT id, name, abbreviation, logo
        FROM membership_union
        ORDER BY name
    """
    rows = execute_query(query)
    return [
        {
            'id': row['id'],
            'name': row['name'],
            'abbreviation': row['abbreviation'],
            'logo': row['logo'],
        }
        for row in rows
    ]


def get_job_titles() -> List[Dict[str, Any]]:
    """
    Get all job titles (starfsheiti) for dropdown selection.

    Returns:
        List of dicts with id, name
    """
    query = """
        SELECT id, name
        FROM membership_title
        ORDER BY name
    """
    rows = execute_query(query)
    return [
        {
            'id': row['id'],
            'name': row['name'],
        }
        for row in rows
    ]


def get_countries() -> List[Dict[str, Any]]:
    """
    Get all countries (lönd) for dropdown selection.

    Returns:
        List of dicts with id, code, name
    """
    query = """
        SELECT id, code, name
        FROM map_country
        ORDER BY name
    """
    rows = execute_query(query)
    return [
        {
            'id': row['id'],
            'code': row['code'],
            'name': row['name'],
        }
        for row in rows
    ]


def get_postal_codes() -> List[Dict[str, Any]]:
    """
    Get all postal codes (póstnúmer) with region info for dropdown selection.

    Returns:
        List of dicts with id, code, region (id, name)
    """
    query = """
        SELECT p.id, p.code, r.id as region_id, r.name as region_name
        FROM map_postalcode p
        LEFT JOIN map_region r ON p.region_id = r.id
        ORDER BY p.code
    """
    rows = execute_query(query)
    return [
        {
            'id': row['id'],
            'code': str(row['code']),
            'region': {
                'id': row['region_id'],
                'name': row['region_name'],
            } if row['region_id'] else None,
        }
        for row in rows
    ]


def get_cells_by_postal_code(postal_code_id: int) -> List[Dict[str, Any]]:
    """
    Get cells that intersect with a postal code using spatial query.

    Args:
        postal_code_id: The postal code ID (database ID)

    Returns:
        List of dicts with id, name for each cell
    """
    query = """
        SELECT c.comradegroup_ptr_id as id, g.name
        FROM cells_cell c
        JOIN groups_comradegroup g ON c.comradegroup_ptr_id = g.id
        JOIN map_postalcode p ON ST_Intersects(c.geometry, p.geometry)
        WHERE p.id = %s
        ORDER BY g.name
    """
    rows = execute_query(query, params=(postal_code_id,))
    return [{'id': row['id'], 'name': row['name']} for row in rows]


def is_kennitala_banned(kennitala: str) -> bool:
    """
    Check if a kennitala is banned from registration.

    Args:
        kennitala: 10-digit kennitala (no hyphen)

    Returns:
        True if banned, False otherwise
    """
    kennitala = kennitala.replace("-", "").strip()
    query = """
        SELECT 1 FROM membership_bannedkennitala
        WHERE ssn = %s AND active = true
        LIMIT 1
    """
    result = execute_query(query, params=(kennitala,), fetch_one=True)
    return result is not None
