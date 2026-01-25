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
            c.email_marketing,
            c.email_marketing_updated_at,
            c.profile_image_url,
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
            'profile_image_url': result['profile_image_url'],
        },
        'membership': {
            'date_joined': str(result['date_joined']) if result['date_joined'] else None,
            'deleted_at': str(result['deleted_at']) if result['deleted_at'] else None,
            'status': 'deleted' if result['deleted_at'] else 'active',
        },
        'reachable': result['reachable'],
        'groupable': result['groupable'],
        'email_marketing': result['email_marketing'] if result['email_marketing'] is not None else True,
        'email_marketing_updated_at': str(result['email_marketing_updated_at']) if result['email_marketing_updated_at'] else None,
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
            c.email_marketing,
            c.email_marketing_updated_at,
            c.profile_image_url,
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
            'profile_image_url': result['profile_image_url'],
        },
        'membership': {
            'date_joined': str(result['date_joined']) if result['date_joined'] else None,
            'deleted_at': str(result['deleted_at']) if result['deleted_at'] else None,
            'status': 'deleted' if result['deleted_at'] else 'active',
        },
        'reachable': result['reachable'],
        'groupable': result['groupable'],
        'email_marketing': result['email_marketing'] if result['email_marketing'] is not None else True,
        'email_marketing_updated_at': str(result['email_marketing_updated_at']) if result['email_marketing_updated_at'] else None,
    }


def get_member_by_firebase_uid(firebase_uid: str) -> Optional[Dict[str, Any]]:
    """
    Get a member by Firebase UID.

    Args:
        firebase_uid: Firebase Auth UID

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
            c.email_marketing,
            c.email_marketing_updated_at,
            c.profile_image_url,
            ci.email,
            ci.phone
        FROM membership_comrade c
        LEFT JOIN membership_contactinfo ci ON ci.comrade_id = c.id
        WHERE c.firebase_uid = %s
    """

    result = execute_query(query, params=(firebase_uid,), fetch_one=True)
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
            'profile_image_url': result['profile_image_url'],
        },
        'membership': {
            'date_joined': str(result['date_joined']) if result['date_joined'] else None,
            'deleted_at': str(result['deleted_at']) if result['deleted_at'] else None,
            'status': 'deleted' if result['deleted_at'] else 'active',
        },
        'reachable': result['reachable'],
        'groupable': result['groupable'],
        'email_marketing': result['email_marketing'] if result['email_marketing'] is not None else True,
        'email_marketing_updated_at': str(result['email_marketing_updated_at']) if result['email_marketing_updated_at'] else None,
    }


def get_members_for_email(
    status: Optional[str] = None,
    municipalities: Optional[List[str]] = None,
    cells: Optional[List[str]] = None,
    max_results: int = 5000
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
    # IMPORTANT: Email filter must be in SQL, not Python, so LIMIT works correctly
    conditions = [
        "c.ssn NOT LIKE '9999%%'",
        "ci.email IS NOT NULL",
        "ci.email != ''"
    ]
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
            ci.phone,
            c.reachable,
            c.email_marketing,
            c.sms_marketing
        FROM membership_comrade c
        JOIN membership_contactinfo ci ON ci.comrade_id = c.id
        WHERE {where_clause}
        ORDER BY c.id
        LIMIT %s
    """
    params.append(max_results)

    rows = execute_query(query, params=tuple(params))

    # Email filter is now in SQL WHERE clause, no need to filter here
    return [
        {
            'django_id': row['django_id'],
            'kennitala': row['kennitala'],
            'profile': {
                'name': row['name'],
                'email': row['email'],
                'phone': row['phone'],
            },
            'reachable': row['reachable'],
            'preferences': {
                'email_marketing': row['email_marketing'] if row['email_marketing'] is not None else True,
                'sms_marketing': row['sms_marketing'] if row['sms_marketing'] is not None else True,
            },
        }
        for row in rows
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
        from db import execute_update
        affected = execute_update(query, params=(firebase_uid, kennitala, firebase_uid))
        if affected > 0:
            logger.info(f"Updated firebase_uid for kennitala {kennitala[:6]}****")
        return affected > 0
    except Exception as e:
        logger.error(f"Failed to update firebase_uid for kennitala {kennitala[:6]}****: {e}")
        return False


def update_email_marketing(member_id: int, email_marketing: bool) -> bool:
    """
    Update email_marketing preference for a member.

    Args:
        member_id: Django member ID
        email_marketing: True to receive marketing emails, False to unsubscribe

    Returns:
        True if updated successfully, False otherwise
    """
    from datetime import datetime

    query = """
        UPDATE membership_comrade
        SET email_marketing = %s,
            email_marketing_updated_at = %s
        WHERE id = %s
    """

    try:
        from db import execute_update
        affected = execute_update(query, params=(email_marketing, datetime.utcnow(), member_id))
        logger.info(f"Updated email_marketing={email_marketing} for member_id {member_id}, rows affected: {affected}")
        return affected > 0
    except Exception as e:
        logger.error(f"Failed to update email_marketing for member_id {member_id}: {e}")
        return False


def update_sms_marketing(member_id: int, sms_marketing: bool) -> bool:
    """
    Update sms_marketing preference for a member.

    Args:
        member_id: Django member ID
        sms_marketing: True to receive marketing SMS, False to unsubscribe

    Returns:
        True if updated successfully, False otherwise
    """
    from datetime import datetime

    query = """
        UPDATE membership_comrade
        SET sms_marketing = %s,
            sms_marketing_updated_at = %s
        WHERE id = %s
    """

    try:
        from db import execute_update
        affected = execute_update(query, params=(sms_marketing, datetime.utcnow(), member_id))
        logger.info(f"Updated sms_marketing={sms_marketing} for member_id {member_id}, rows affected: {affected}")
        return affected > 0
    except Exception as e:
        logger.error(f"Failed to update sms_marketing for member_id {member_id}: {e}")
        return False


def hard_delete_member_sql(member_id: int) -> Dict[str, Any]:
    """
    Permanently delete a member from Cloud SQL.

    This is a DANGEROUS operation that removes all member data from the database.
    Only soft-deleted members should be hard deleted.

    Deletes from tables in order (respecting foreign key constraints):
    1. membership_contactinfo (contact details)
    2. membership_newlocaladdress / membership_newcomradeaddress (local addresses)
    3. billing_membershipfee (fee records)
    4. cells_cell_coordinators / cells_cellgroup_coordinators (if coordinator)
    5. groups_comradegroupmembership (group memberships)
    6. communication_sentemail (sent email records)
    7. membership_unionmembership (union memberships)
    8. membership_comradetitle (titles)
    9. membership_activation (activation records)
    10. membership_newforeignaddress (foreign addresses)
    11. communication_conversation (conversations - nullify done_by, delete as subject)
    12. issues_invitation (issue invitations)
    13. issues_unabletoattend (unable to attend records)
    14. groups_eventinvitation (event invitations - nullify invited_by, delete as invitee)
    15. groups_post (posts by member)
    16. membership_comrade (main member record)

    Note: Django's ON DELETE CASCADE is ORM-level only, raw SQL needs explicit DELETE.

    Args:
        member_id: Django database ID of the member

    Returns:
        Dict with success status and deleted table counts
    """
    from db import execute_query, execute_update

    deleted_tables = []
    errors = []

    try:
        # 1. Delete contact info
        try:
            execute_update(
                "DELETE FROM membership_contactinfo WHERE comrade_id = %s",
                params=(member_id,)
            )
            deleted_tables.append("membership_contactinfo")
        except Exception as e:
            errors.append(f"membership_contactinfo: {str(e)}")

        # 2. Delete addresses (need to delete local addresses first, then base)
        try:
            # Get address IDs first (use execute_query for SELECT)
            addr_ids = execute_query(
                """SELECT newcomradeaddress_ptr_id FROM membership_newlocaladdress
                   WHERE comrade_id = %s""",
                params=(member_id,)
            )
            addr_id_list = [row['newcomradeaddress_ptr_id'] for row in (addr_ids or [])]

            # Delete local addresses
            execute_update(
                "DELETE FROM membership_newlocaladdress WHERE comrade_id = %s",
                params=(member_id,)
            )
            deleted_tables.append("membership_newlocaladdress")

            # Delete base address records
            if addr_id_list:
                placeholders = ", ".join(["%s"] * len(addr_id_list))
                execute_update(
                    f"DELETE FROM membership_newcomradeaddress WHERE id IN ({placeholders})",
                    params=tuple(addr_id_list)
                )
                deleted_tables.append("membership_newcomradeaddress")
        except Exception as e:
            errors.append(f"addresses: {str(e)}")

        # 3. Delete billing/fee records
        try:
            execute_update(
                "DELETE FROM billing_membershipfee WHERE comrade_id = %s",
                params=(member_id,)
            )
            deleted_tables.append("billing_membershipfee")
        except Exception as e:
            logger.warning(f"Could not delete from billing_membershipfee: {e}")
            errors.append(f"billing_membershipfee: {str(e)}")

        # 4. Delete cell coordinator records (if any)
        try:
            execute_update(
                "DELETE FROM cells_cell_coordinators WHERE comrade_id = %s",
                params=(member_id,)
            )
            deleted_tables.append("cells_cell_coordinators")
        except Exception as e:
            logger.warning(f"Could not delete from cells_cell_coordinators: {e}")
            errors.append(f"cells_cell_coordinators: {str(e)}")

        try:
            execute_update(
                "DELETE FROM cells_cellgroup_coordinators WHERE comrade_id = %s",
                params=(member_id,)
            )
            deleted_tables.append("cells_cellgroup_coordinators")
        except Exception as e:
            logger.warning(f"Could not delete from cells_cellgroup_coordinators: {e}")
            errors.append(f"cells_cellgroup_coordinators: {str(e)}")

        # 5. Delete group memberships (if any)
        try:
            execute_update(
                "DELETE FROM groups_comradegroupmembership WHERE comrade_id = %s",
                params=(member_id,)
            )
            deleted_tables.append("groups_comradegroupmembership")
        except Exception as e:
            logger.warning(f"Could not delete from groups_comradegroupmembership: {e}")
            errors.append(f"groups_comradegroupmembership: {str(e)}")

        # 6. Delete sent email records (if any)
        try:
            execute_update(
                "DELETE FROM communication_sentemail WHERE comrade_id = %s",
                params=(member_id,)
            )
            deleted_tables.append("communication_sentemail")
        except Exception as e:
            logger.warning(f"Could not delete from communication_sentemail: {e}")
            errors.append(f"communication_sentemail: {str(e)}")

        # 7. Delete union memberships
        try:
            execute_update(
                "DELETE FROM membership_unionmembership WHERE comrade_id = %s",
                params=(member_id,)
            )
            deleted_tables.append("membership_unionmembership")
        except Exception as e:
            logger.warning(f"Could not delete from membership_unionmembership: {e}")
            errors.append(f"membership_unionmembership: {str(e)}")

        # 8. Delete comrade titles
        try:
            execute_update(
                "DELETE FROM membership_comradetitle WHERE comrade_id = %s",
                params=(member_id,)
            )
            deleted_tables.append("membership_comradetitle")
        except Exception as e:
            logger.warning(f"Could not delete from membership_comradetitle: {e}")
            errors.append(f"membership_comradetitle: {str(e)}")

        # 9. Delete activation records
        try:
            execute_update(
                "DELETE FROM membership_activation WHERE comrade_id = %s",
                params=(member_id,)
            )
            deleted_tables.append("membership_activation")
        except Exception as e:
            logger.warning(f"Could not delete from membership_activation: {e}")
            errors.append(f"membership_activation: {str(e)}")

        # 10. Delete foreign addresses
        try:
            # Get foreign address IDs first
            foreign_addr_ids = execute_query(
                """SELECT newcomradeaddress_ptr_id FROM membership_newforeignaddress
                   WHERE comrade_id = %s""",
                params=(member_id,)
            )
            foreign_addr_id_list = [row['newcomradeaddress_ptr_id'] for row in (foreign_addr_ids or [])]

            execute_update(
                "DELETE FROM membership_newforeignaddress WHERE comrade_id = %s",
                params=(member_id,)
            )
            deleted_tables.append("membership_newforeignaddress")

            # Delete base address records for foreign addresses
            if foreign_addr_id_list:
                placeholders = ", ".join(["%s"] * len(foreign_addr_id_list))
                execute_update(
                    f"DELETE FROM membership_newcomradeaddress WHERE id IN ({placeholders})",
                    params=tuple(foreign_addr_id_list)
                )
        except Exception as e:
            logger.warning(f"Could not delete from membership_newforeignaddress: {e}")
            errors.append(f"membership_newforeignaddress: {str(e)}")

        # 11. Delete conversations (both as subject and done_by)
        try:
            # First nullify done_by references
            execute_update(
                "UPDATE communication_conversation SET done_by_id = NULL WHERE done_by_id = %s",
                params=(member_id,)
            )
            # Then delete conversations where member is subject
            execute_update(
                "DELETE FROM communication_conversation WHERE comrade_id = %s",
                params=(member_id,)
            )
            deleted_tables.append("communication_conversation")
        except Exception as e:
            logger.warning(f"Could not delete from communication_conversation: {e}")
            errors.append(f"communication_conversation: {str(e)}")

        # 12. Delete issues invitations
        try:
            execute_update(
                "DELETE FROM issues_invitation WHERE comrade_id = %s",
                params=(member_id,)
            )
            deleted_tables.append("issues_invitation")
        except Exception as e:
            logger.warning(f"Could not delete from issues_invitation: {e}")
            errors.append(f"issues_invitation: {str(e)}")

        # 13. Delete unable to attend records
        try:
            execute_update(
                "DELETE FROM issues_unabletoattend WHERE comrade_id = %s",
                params=(member_id,)
            )
            deleted_tables.append("issues_unabletoattend")
        except Exception as e:
            logger.warning(f"Could not delete from issues_unabletoattend: {e}")
            errors.append(f"issues_unabletoattend: {str(e)}")

        # 14. Delete event invitations (both as invitee and inviter)
        try:
            # First nullify invited_by references
            execute_update(
                "UPDATE groups_eventinvitation SET invited_by_id = NULL WHERE invited_by_id = %s",
                params=(member_id,)
            )
            # Then delete invitations where member is invitee
            execute_update(
                "DELETE FROM groups_eventinvitation WHERE comrade_id = %s",
                params=(member_id,)
            )
            deleted_tables.append("groups_eventinvitation")
        except Exception as e:
            logger.warning(f"Could not delete from groups_eventinvitation: {e}")
            errors.append(f"groups_eventinvitation: {str(e)}")

        # 15. Delete posts
        try:
            execute_update(
                "DELETE FROM groups_post WHERE author_id = %s",
                params=(member_id,)
            )
            deleted_tables.append("groups_post")
        except Exception as e:
            logger.warning(f"Could not delete from groups_post: {e}")
            errors.append(f"groups_post: {str(e)}")

        # 16. Finally, delete the member record
        try:
            rows_deleted = execute_update(
                "DELETE FROM membership_comrade WHERE id = %s",
                params=(member_id,)
            )
            if rows_deleted > 0:
                deleted_tables.append("membership_comrade")
            else:
                errors.append("membership_comrade: No rows deleted (record not found)")
        except Exception as e:
            errors.append(f"membership_comrade: {str(e)}")

        success = "membership_comrade" in deleted_tables
        return {
            "success": success,
            "deleted_tables": deleted_tables,
            "errors": errors if errors else None
        }

    except Exception as e:
        logger.error(f"Hard delete failed for member {member_id}: {e}")
        return {
            "success": False,
            "deleted_tables": deleted_tables,
            "errors": [str(e)]
        }


def anonymize_member_sql(member_id: int, anon_id: str) -> Dict[str, Any]:
    """
    Anonymize a member's PII in Cloud SQL while keeping statistical data.

    This is used for GDPR requests where deletion is not possible.
    Anonymizes personal information but preserves:
    - date_joined (for membership statistics)
    - birthday (for age demographics)
    - gender (for demographics)
    - housing_situation (for demographics)

    Args:
        member_id: Django database ID of the member
        anon_id: The anonymized ID to use (e.g., "ANON-389BDB78")

    Returns:
        Dict with success status and anonymized fields
    """
    from db import execute_query, execute_update

    anonymized_fields = []
    errors = []

    # Generate unique SSN for anonymization (ssn has unique constraint)
    # Use format: ANON + 6 digits from member_id (padded)
    anon_ssn = f"ANON{member_id:06d}"

    try:
        # 1. Delete contact info (phone, email, facebook)
        try:
            execute_update(
                "DELETE FROM membership_contactinfo WHERE comrade_id = %s",
                params=(member_id,)
            )
            anonymized_fields.append("contact_info_deleted")
        except Exception as e:
            logger.warning(f"Could not delete contact info: {e}")

        # 2. Delete addresses
        try:
            # Get address IDs first
            addr_ids = execute_query(
                """SELECT newcomradeaddress_ptr_id FROM membership_newlocaladdress
                   WHERE comrade_id = %s""",
                params=(member_id,)
            )
            addr_id_list = [row['newcomradeaddress_ptr_id'] for row in (addr_ids or [])]

            # Delete local addresses
            execute_update(
                "DELETE FROM membership_newlocaladdress WHERE comrade_id = %s",
                params=(member_id,)
            )
            anonymized_fields.append("addresses_deleted")

            # Delete base address records
            if addr_id_list:
                placeholders = ", ".join(["%s"] * len(addr_id_list))
                execute_update(
                    f"DELETE FROM membership_newcomradeaddress WHERE id IN ({placeholders})",
                    params=tuple(addr_id_list)
                )
        except Exception as e:
            logger.warning(f"Could not delete addresses: {e}")

        # 3. Anonymize member record
        try:
            execute_update(
                """UPDATE membership_comrade
                   SET name = %s,
                       ssn = %s,
                       firebase_uid = NULL,
                       reachable = FALSE,
                       groupable = FALSE
                   WHERE id = %s""",
                params=(anon_id, anon_ssn, member_id)
            )
            anonymized_fields.extend(["name", "ssn", "firebase_uid", "reachable", "groupable"])
        except Exception as e:
            errors.append(f"membership_comrade: {str(e)}")

        success = "name" in anonymized_fields
        return {
            "success": success,
            "anon_id": anon_id,
            "anon_ssn": anon_ssn,
            "anonymized_fields": anonymized_fields,
            "errors": errors if errors else None
        }

    except Exception as e:
        logger.error(f"Anonymization failed for member {member_id}: {e}")
        return {
            "success": False,
            "anon_id": anon_id,
            "anonymized_fields": anonymized_fields,
            "errors": [str(e)]
        }
