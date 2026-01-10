"""
Cloud SQL Member Queries

Helper functions for querying member data from Cloud SQL (Django database).
These replace Firestore queries for member data.

Usage:
    from db_members import get_member_by_kennitala, get_members_for_email

    # Get single member
    member = get_member_by_kennitala("1234567890")

    # Get members for email campaign
    members = get_members_for_email(
        status="active",
        municipalities=["Reykjavíkurborg", "Kópavogsbær"]
    )
"""

import logging
from typing import Dict, Any, List, Optional
from db import execute_query

logger = logging.getLogger(__name__)


def get_member_by_kennitala(kennitala: str) -> Optional[Dict[str, Any]]:
    """
    Get a member by kennitala (SSN).

    Args:
        kennitala: 10-digit kennitala (with or without hyphen)

    Returns:
        Dict with member data or None if not found
    """
    # Normalize kennitala (remove hyphen)
    kennitala = kennitala.replace("-", "").strip()

    query = """
        SELECT
            c.id,
            c.name,
            c.ssn as kennitala,
            c.birthday,
            c.date_joined,
            c.deleted_at,
            c.reachable,
            c.groupable,
            ci.email,
            ci.phone
        FROM membership_comrade c
        LEFT JOIN membership_contactinfo ci ON ci.comrade_id = c.id
        WHERE c.ssn = %s
    """

    result = execute_query(query, params=(kennitala,), fetch_one=True)
    if not result:
        return None

    # Convert to Firestore-like structure for compatibility
    return {
        'id': result['id'],
        'django_id': result['id'],
        'kennitala': result['kennitala'],
        'profile': {
            'name': result['name'],
            'email': result['email'],
            'phone': result['phone'],
            'birthday': str(result['birthday']) if result['birthday'] else None,
        },
        'membership': {
            'date_joined': str(result['date_joined']) if result['date_joined'] else None,
            'deleted_at': str(result['deleted_at']) if result['deleted_at'] else None,
            'status': 'deleted' if result['deleted_at'] else 'active',
        },
        'reachable': result['reachable'],
        'groupable': result['groupable'],
    }


def get_member_by_django_id(django_id: int) -> Optional[Dict[str, Any]]:
    """
    Get a member by Django ID.

    Args:
        django_id: Django database ID

    Returns:
        Dict with member data or None if not found
    """
    query = """
        SELECT
            c.id,
            c.name,
            c.ssn as kennitala,
            c.birthday,
            c.date_joined,
            c.deleted_at,
            c.reachable,
            c.groupable,
            ci.email,
            ci.phone
        FROM membership_comrade c
        LEFT JOIN membership_contactinfo ci ON ci.comrade_id = c.id
        WHERE c.id = %s
    """

    result = execute_query(query, params=(django_id,), fetch_one=True)
    if not result:
        return None

    return {
        'id': result['id'],
        'django_id': result['id'],
        'kennitala': result['kennitala'],
        'profile': {
            'name': result['name'],
            'email': result['email'],
            'phone': result['phone'],
            'birthday': str(result['birthday']) if result['birthday'] else None,
        },
        'membership': {
            'date_joined': str(result['date_joined']) if result['date_joined'] else None,
            'deleted_at': str(result['deleted_at']) if result['deleted_at'] else None,
            'status': 'deleted' if result['deleted_at'] else 'active',
        },
        'reachable': result['reachable'],
        'groupable': result['groupable'],
    }


def get_members_for_email(
    status: Optional[str] = None,
    municipalities: Optional[List[str]] = None,
    cells: Optional[List[str]] = None,
    max_results: int = 1000
) -> List[Dict[str, Any]]:
    """
    Get members for email campaigns with optional filters.

    Args:
        status: "active" to get only non-deleted members
        municipalities: List of municipality names to filter by
        cells: List of cell/district names to filter by
        max_results: Maximum number of results

    Returns:
        List of member dicts with email info
    """
    # Build query with filters
    conditions = ["c.ssn NOT LIKE '9999%%'"]
    params = []

    if status == "active":
        conditions.append("c.deleted_at IS NULL")

    # Municipality filter
    if municipalities:
        placeholders = ", ".join(["%s"] * len(municipalities))
        conditions.append(f"""
            EXISTS (
                SELECT 1 FROM membership_newlocaladdress la
                JOIN membership_newcomradeaddress nca ON la.newcomradeaddress_ptr_id = nca.id
                JOIN map_address a ON la.address_id = a.id
                JOIN map_street s ON a.street_id = s.id
                JOIN map_municipality m ON s.municipality_id = m.id
                WHERE la.comrade_id = c.id
                  AND nca.current = true
                  AND m.name IN ({placeholders})
            )
        """)
        params.extend(municipalities)

    # Cell/district filter (via cells.cell membership)
    if cells:
        placeholders = ", ".join(["%s"] * len(cells))
        conditions.append(f"""
            EXISTS (
                SELECT 1 FROM cells_cell_members cm
                JOIN cells_cell cell ON cm.cell_id = cell.id
                WHERE cm.comrade_id = c.id
                  AND cell.name IN ({placeholders})
            )
        """)
        params.extend(cells)

    where_clause = " AND ".join(conditions)

    query = f"""
        SELECT
            c.id as django_id,
            c.name,
            c.ssn as kennitala,
            ci.email,
            c.reachable
        FROM membership_comrade c
        LEFT JOIN membership_contactinfo ci ON ci.comrade_id = c.id
        WHERE {where_clause}
        ORDER BY c.id
        LIMIT %s
    """
    params.append(max_results)

    rows = execute_query(query, params=tuple(params))

    return [
        {
            'django_id': row['django_id'],
            'kennitala': row['kennitala'],
            'profile': {
                'name': row['name'],
                'email': row['email'],
            },
            'reachable': row['reachable'],
        }
        for row in rows
        if row['email']  # Only include members with email
    ]


def get_active_member_count() -> int:
    """Get count of active (non-deleted) members."""
    result = execute_query("""
        SELECT COUNT(*) as count
        FROM membership_comrade
        WHERE deleted_at IS NULL
          AND ssn NOT LIKE '9999%%'
    """, fetch_one=True)
    return result['count'] if result else 0


def member_exists(kennitala: str) -> bool:
    """Check if a member with this kennitala exists (including deleted)."""
    kennitala = kennitala.replace("-", "").strip()
    result = execute_query(
        "SELECT 1 FROM membership_comrade WHERE ssn = %s LIMIT 1",
        params=(kennitala,),
        fetch_one=True
    )
    return result is not None


def is_kennitala_banned(kennitala: str) -> bool:
    """Check if a kennitala is banned from registration."""
    kennitala = kennitala.replace("-", "").strip()
    result = execute_query(
        "SELECT 1 FROM membership_bannedkennitala WHERE ssn = %s AND active = true LIMIT 1",
        params=(kennitala,),
        fetch_one=True
    )
    return result is not None


def get_member_municipalities() -> List[Dict[str, Any]]:
    """
    Get all municipalities with member counts.
    Used for admin dropdowns and filters.
    """
    query = """
        SELECT m.name, COUNT(DISTINCT c.id) as count
        FROM map_municipality m
        LEFT JOIN map_street s ON s.municipality_id = m.id
        LEFT JOIN map_address a ON a.street_id = s.id
        LEFT JOIN membership_newlocaladdress la ON la.address_id = a.id
        LEFT JOIN membership_newcomradeaddress nca ON la.newcomradeaddress_ptr_id = nca.id AND nca.current = true
        LEFT JOIN membership_comrade c ON la.comrade_id = c.id AND c.deleted_at IS NULL
        GROUP BY m.name
        ORDER BY count DESC, m.name
    """
    return execute_query(query)


def get_membership_status(kennitala: str) -> Dict[str, Any]:
    """
    Get membership status and fee payment info for a kennitala.

    Used by verifyMembership to check if a user is an active member.

    Args:
        kennitala: 10-digit kennitala (with or without hyphen)

    Returns:
        Dict with:
            - is_member: bool (True if active member)
            - status: str ('active', 'unpaid', 'inactive', 'not_found')
            - fees_paid: bool (True if current year fee is paid)
            - django_id: int or None
            - name: str or None
    """
    import datetime
    current_year = datetime.datetime.now().year

    kennitala = kennitala.replace("-", "").strip()

    # Query member with fee status for current year
    query = """
        SELECT
            c.id,
            c.name,
            c.ssn as kennitala,
            c.deleted_at,
            mf.date_paid IS NOT NULL as fees_paid_this_year
        FROM membership_comrade c
        LEFT JOIN billing_membershipfee mf
            ON mf.comrade_id = c.id
            AND mf.year = %s
        WHERE c.ssn = %s
    """

    result = execute_query(query, params=(current_year, kennitala), fetch_one=True)

    if not result:
        return {
            'is_member': False,
            'status': 'not_found',
            'fees_paid': False,
            'django_id': None,
            'name': None
        }

    # Determine status
    is_deleted = result['deleted_at'] is not None
    fees_paid = result['fees_paid_this_year'] or False

    if is_deleted:
        status = 'inactive'
        is_member = False
    elif fees_paid:
        status = 'active'
        is_member = True
    else:
        status = 'unpaid'
        is_member = True  # Still a member, just hasn't paid current year

    return {
        'is_member': is_member,
        'status': status,
        'fees_paid': fees_paid,
        'django_id': result['id'],
        'name': result['name']
    }


def get_deleted_member_count() -> int:
    """Get count of soft-deleted members."""
    result = execute_query("""
        SELECT COUNT(*) as count
        FROM membership_comrade
        WHERE deleted_at IS NOT NULL
          AND ssn NOT LIKE '9999%%'
    """, fetch_one=True)
    return result['count'] if result else 0


def get_deleted_members(limit: int = 50) -> List[Dict[str, Any]]:
    """
    Get list of soft-deleted members with details.

    Used by superuser dashboard to preview which members will be purged.
    Kennitala is masked for privacy (only first 6 digits shown).

    Args:
        limit: Maximum number of results (default 50)

    Returns:
        List of dicts with id, name, kennitala_masked, deleted_at
    """
    query = """
        SELECT
            c.id,
            c.name,
            CONCAT(LEFT(c.ssn, 6), '****') as kennitala_masked,
            c.deleted_at
        FROM membership_comrade c
        WHERE c.deleted_at IS NOT NULL
          AND c.ssn NOT LIKE '9999%%'
        ORDER BY c.deleted_at DESC
        LIMIT %s
    """

    rows = execute_query(query, params=(limit,))
    if not rows:
        return []

    return [
        {
            'id': row['id'],
            'name': row['name'],
            'kennitala_masked': row['kennitala_masked'],
            'deleted_at': row['deleted_at'].isoformat() if row['deleted_at'] else None
        }
        for row in rows
    ]


def get_member_by_email(email: str) -> Optional[Dict[str, Any]]:
    """
    Get a member by email address.

    Args:
        email: Email address

    Returns:
        Dict with member data or None if not found
    """
    if not email:
        return None

    query = """
        SELECT
            c.id,
            c.name,
            c.ssn as kennitala,
            c.deleted_at,
            ci.email
        FROM membership_comrade c
        JOIN membership_contactinfo ci ON ci.comrade_id = c.id
        WHERE LOWER(ci.email) = LOWER(%s)
        LIMIT 1
    """

    result = execute_query(query, params=(email,), fetch_one=True)
    if not result:
        return None

    return {
        'django_id': result['id'],
        'kennitala': result['kennitala'],
        'profile': {
            'name': result['name'],
            'email': result['email'],
        },
        'membership': {
            'deleted_at': str(result['deleted_at']) if result['deleted_at'] else None,
            'status': 'deleted' if result['deleted_at'] else 'active',
        }
    }


def update_member_firebase_uid(kennitala: str, firebase_uid: str) -> bool:
    """
    Update firebase_uid for a member by kennitala.

    Called during login to sync Firebase UID to Django database.
    Uses UPSERT pattern - only updates if firebase_uid is NULL or matches.

    Args:
        kennitala: 10-digit kennitala (with or without hyphen)
        firebase_uid: Firebase Auth UID

    Returns:
        True if updated successfully, False otherwise
    """
    kennitala = kennitala.replace("-", "").strip()

    # Only update if firebase_uid is NULL or already matches (idempotent)
    # This prevents overwriting if there's a mismatch (should be investigated)
    query = """
        UPDATE membership_comrade
        SET firebase_uid = %s
        WHERE ssn = %s
          AND (firebase_uid IS NULL OR firebase_uid = %s)
    """

    try:
        from db import execute_query as exec_write
        result = exec_write(query, params=(firebase_uid, kennitala, firebase_uid))
        # execute_query returns affected rows count for UPDATE
        logger.info(f"Updated firebase_uid for kennitala {kennitala[:6]}****")
        return True
    except Exception as e:
        logger.error(f"Failed to update firebase_uid for kennitala {kennitala[:6]}****: {e}")
        return False
