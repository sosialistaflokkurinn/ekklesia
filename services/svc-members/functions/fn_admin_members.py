"""
Member Cloud Functions

Cloud Functions for member list and profile views.
These read from Cloud SQL (source of truth) instead of Firestore.

Issue: Migrate admin pages from Firestore to Cloud SQL
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from firebase_functions import https_fn
from firebase_admin import auth
from util_logging import log_json
from db import execute_query, execute_update
from shared.rate_limit import check_uid_rate_limit
from shared.validators import normalize_kennitala


def require_auth(req: https_fn.CallableRequest) -> str:
    """Check that user is authenticated and return their kennitala."""
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Authentication required"
        )

    kennitala = req.auth.token.get('kennitala')
    if not kennitala:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="No kennitala found for user"
        )

    return normalize_kennitala(kennitala)


def require_admin(req: https_fn.CallableRequest) -> None:
    """Check that user has admin or superuser role."""
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Authentication required"
        )

    claims = req.auth.token or {}
    roles = claims.get("roles", [])

    if "admin" not in roles and "superuser" not in roles:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message="Admin access required"
        )


def list_members_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    List members from Cloud SQL with pagination and filtering.

    Request data:
        - limit: int (default 50, max 200)
        - offset: int (default 0)
        - status: str ('all', 'active', 'deleted') - default 'active'
        - search: str (search by name, kennitala, or email)
        - municipality: str (filter by municipality name)

    Returns:
        - members: List of member objects
        - total: Total count matching filters
        - hasMore: Whether there are more results
    """
    require_admin(req)
    check_uid_rate_limit(req.auth.uid, "list_members", max_attempts=100, window_minutes=1)

    data = req.data or {}
    limit = min(int(data.get("limit", 50)), 200)
    offset = int(data.get("offset", 0))
    status = data.get("status", "active")
    search = data.get("search", "").strip()
    municipality = data.get("municipality", "").strip()

    # Input validation
    MAX_SEARCH_LENGTH = 200
    MAX_MUNICIPALITY_LENGTH = 100

    if len(search) > MAX_SEARCH_LENGTH:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message=f"Search term too long (max {MAX_SEARCH_LENGTH} characters)"
        )

    if len(municipality) > MAX_MUNICIPALITY_LENGTH:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message=f"Municipality name too long (max {MAX_MUNICIPALITY_LENGTH} characters)"
        )

    if status not in ["active", "deleted", "all"]:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Invalid status filter (must be 'active', 'deleted', or 'all')"
        )

    # Build query
    conditions = ["c.ssn NOT LIKE '9999%%'"]  # Exclude test accounts
    params = []

    # Status filter
    if status == "active":
        conditions.append("c.deleted_at IS NULL")
    elif status == "deleted":
        conditions.append("c.deleted_at IS NOT NULL")
    # 'all' - no status filter

    # Search filter
    if search:
        conditions.append("""
            (c.name ILIKE %s
             OR c.ssn LIKE %s
             OR ci.email ILIKE %s)
        """)
        search_pattern = f"%{search}%"
        params.extend([search_pattern, search_pattern, search_pattern])

    # Municipality filter
    if municipality:
        if municipality == "Erlendis":
            # Filter for members with foreign address (no local address)
            conditions.append("""
                EXISTS (
                    SELECT 1 FROM membership_newforeignaddress fa
                    JOIN membership_newcomradeaddress nca ON fa.newcomradeaddress_ptr_id = nca.id
                    WHERE fa.comrade_id = c.id AND nca.current = true
                )
                AND NOT EXISTS (
                    SELECT 1 FROM membership_newlocaladdress la
                    JOIN membership_newcomradeaddress nca ON la.newcomradeaddress_ptr_id = nca.id
                    WHERE la.comrade_id = c.id AND nca.current = true
                )
            """)
        else:
            # Filter for members with local address in specific municipality
            conditions.append("""
                EXISTS (
                    SELECT 1 FROM membership_newlocaladdress la
                    JOIN membership_newcomradeaddress nca ON la.newcomradeaddress_ptr_id = nca.id
                    JOIN map_address a ON la.address_id = a.id
                    JOIN map_street s ON a.street_id = s.id
                    JOIN map_municipality m ON s.municipality_id = m.id
                    WHERE la.comrade_id = c.id
                      AND nca.current = true
                      AND m.name = %s
                )
            """)
            params.append(municipality)

    where_clause = " AND ".join(conditions)

    # Count query
    count_query = f"""
        SELECT COUNT(DISTINCT c.id) as total
        FROM membership_comrade c
        LEFT JOIN membership_contactinfo ci ON ci.comrade_id = c.id
        WHERE {where_clause}
    """
    count_result = execute_query(count_query, params=tuple(params), fetch_one=True)
    total = count_result['total'] if count_result else 0

    # Main query with pagination
    main_query = f"""
        SELECT DISTINCT
            c.id as django_id,
            c.name,
            c.ssn as kennitala,
            c.birthday,
            c.date_joined,
            c.deleted_at,
            ci.email,
            ci.phone,
            COALESCE(
                (
                    SELECT m.name
                    FROM membership_newlocaladdress la
                    JOIN membership_newcomradeaddress nca ON la.newcomradeaddress_ptr_id = nca.id
                    JOIN map_address a ON la.address_id = a.id
                    JOIN map_street s ON a.street_id = s.id
                    JOIN map_municipality m ON s.municipality_id = m.id
                    WHERE la.comrade_id = c.id AND nca.current = true
                    LIMIT 1
                ),
                (
                    SELECT 'Erlendis'
                    FROM membership_newforeignaddress fa
                    JOIN membership_newcomradeaddress nca ON fa.newcomradeaddress_ptr_id = nca.id
                    WHERE fa.comrade_id = c.id AND nca.current = true
                    LIMIT 1
                )
            ) as municipality
        FROM membership_comrade c
        LEFT JOIN membership_contactinfo ci ON ci.comrade_id = c.id
        WHERE {where_clause}
        ORDER BY c.id DESC
        LIMIT %s OFFSET %s
    """
    params.extend([limit, offset])

    rows = execute_query(main_query, params=tuple(params))

    members = []
    for row in rows:
        members.append({
            'id': str(row['django_id']),
            'django_id': row['django_id'],
            'kennitala': row['kennitala'],
            'name': row['name'] or '',
            'email': row['email'] or '',
            'phone': row['phone'] or '',
            'birthday': str(row['birthday']) if row['birthday'] else None,
            'date_joined': str(row['date_joined']) if row['date_joined'] else None,
            'status': 'deleted' if row['deleted_at'] else 'active',
            'municipality': row['municipality'] or '',
            'metadata': {
                'django_id': row['django_id']
            }
        })

    log_json("info", "Listed members",
             count=len(members),
             total=total,
             admin_uid=req.auth.uid)

    return {
        'members': members,
        'total': total,
        'hasMore': offset + len(members) < total
    }


def get_member_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Get a single member by kennitala or django_id.

    Request data (one required):
        - kennitala: str
        - django_id: int

    Returns:
        Member object with full details
    """
    require_admin(req)
    check_uid_rate_limit(req.auth.uid, "get_member", max_attempts=100, window_minutes=1)

    data = req.data or {}
    kennitala = data.get("kennitala", "").replace("-", "").strip()
    django_id = data.get("django_id")

    if not kennitala and not django_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Either kennitala or django_id is required"
        )

    # Build query
    if kennitala:
        condition = "c.ssn = %s"
        param = kennitala
    else:
        condition = "c.id = %s"
        param = int(django_id)

    query = f"""
        SELECT
            c.id as django_id,
            c.name,
            c.ssn as kennitala,
            c.birthday,
            c.date_joined,
            c.deleted_at,
            c.reachable,
            c.groupable,
            c.housing_situation,
            c.gender,
            c.firebase_uid,
            ci.email,
            ci.phone,
            (
                SELECT json_build_object(
                    'street', s.name,
                    'number', a.number,
                    'letter', a.letter,
                    'postal_code', pc.code,
                    'city', m.name,
                    'municipality', m.name,
                    'country', 'IS',
                    'is_default', true
                )
                FROM membership_newlocaladdress la
                JOIN membership_newcomradeaddress nca ON la.newcomradeaddress_ptr_id = nca.id
                JOIN map_address a ON la.address_id = a.id
                JOIN map_street s ON a.street_id = s.id
                JOIN map_municipality m ON s.municipality_id = m.id
                LEFT JOIN map_postalcode pc ON s.postal_code_id = pc.id
                WHERE la.comrade_id = c.id AND nca.current = true
                LIMIT 1
            ) as address,
            (
                SELECT json_agg(json_build_object(
                    'id', u.id,
                    'name', u.name
                ))
                FROM membership_unionmembership um
                JOIN membership_union u ON um.union_id = u.id
                WHERE um.comrade_id = c.id
            ) as unions,
            (
                SELECT json_agg(json_build_object(
                    'id', t.id,
                    'name', t.name
                ))
                FROM membership_comradetitle ct
                JOIN membership_title t ON ct.title_id = t.id
                WHERE ct.comrade_id = c.id
            ) as titles
        FROM membership_comrade c
        LEFT JOIN membership_contactinfo ci ON ci.comrade_id = c.id
        WHERE {condition}
    """

    result = execute_query(query, params=(param,), fetch_one=True)

    if not result:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message="Member not found"
        )

    # Parse JSON fields
    import json
    address = result['address'] or {}
    if isinstance(address, str):
        address = json.loads(address)

    unions = result['unions'] or []
    if isinstance(unions, str):
        unions = json.loads(unions)

    titles = result['titles'] or []
    if isinstance(titles, str):
        titles = json.loads(titles)

    member = {
        'id': str(result['django_id']),
        'django_id': result['django_id'],
        'kennitala': result['kennitala'],
        'name': result['name'] or '',
        'email': result['email'] or '',
        'phone': result['phone'] or '',
        'birthday': str(result['birthday']) if result['birthday'] else None,
        'date_joined': str(result['date_joined']) if result['date_joined'] else None,
        'status': 'deleted' if result['deleted_at'] else 'active',
        'deleted_at': str(result['deleted_at']) if result['deleted_at'] else None,
        'reachable': result['reachable'],
        'groupable': result['groupable'],
        'housing_situation': result['housing_situation'],
        'gender': result['gender'],
        'firebase_uid': result['firebase_uid'],
        'address': address,
        'unions': unions or [],
        'titles': titles or [],
        'metadata': {
            'django_id': result['django_id'],
            'firebase_uid': result['firebase_uid']
        },
        'profile': {
            'name': result['name'] or '',
            'email': result['email'] or '',
            'phone': result['phone'] or '',
            'birthday': str(result['birthday']) if result['birthday'] else None,
            'housing_situation': result['housing_situation'],
            'gender': result['gender'],
            'addresses': [address] if address else []
        },
        'membership': {
            'date_joined': str(result['date_joined']) if result['date_joined'] else None,
            'deleted_at': str(result['deleted_at']) if result['deleted_at'] else None,
            'status': 'deleted' if result['deleted_at'] else 'active',
            'unions': unions or [],
            'titles': titles or [],
        }
    }

    log_json("info", "Got member",
             django_id=result['django_id'],
             admin_uid=req.auth.uid)

    return {'member': member}


def get_member_stats_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Get member statistics from Cloud SQL.

    Returns:
        - total: Total active members
        - deleted: Soft-deleted members
        - with_email: Members with email
        - with_address: Members with address
        - municipalities: Top municipalities with counts
    """
    require_admin(req)
    check_uid_rate_limit(req.auth.uid, "get_member_stats", max_attempts=20, window_minutes=1)

    # Total active
    total_result = execute_query("""
        SELECT COUNT(*) as count
        FROM membership_comrade
        WHERE deleted_at IS NULL AND ssn NOT LIKE '9999%%'
    """, fetch_one=True)
    total = total_result['count'] if total_result else 0

    # Deleted
    deleted_result = execute_query("""
        SELECT COUNT(*) as count
        FROM membership_comrade
        WHERE deleted_at IS NOT NULL AND ssn NOT LIKE '9999%%'
    """, fetch_one=True)
    deleted = deleted_result['count'] if deleted_result else 0

    # With email
    email_result = execute_query("""
        SELECT COUNT(DISTINCT c.id) as count
        FROM membership_comrade c
        JOIN membership_contactinfo ci ON ci.comrade_id = c.id
        WHERE c.deleted_at IS NULL
          AND c.ssn NOT LIKE '9999%%'
          AND ci.email IS NOT NULL
          AND ci.email != ''
    """, fetch_one=True)
    with_email = email_result['count'] if email_result else 0

    # With address
    address_result = execute_query("""
        SELECT COUNT(DISTINCT c.id) as count
        FROM membership_comrade c
        JOIN membership_newlocaladdress la ON la.comrade_id = c.id
        JOIN membership_newcomradeaddress nca ON la.newcomradeaddress_ptr_id = nca.id AND nca.current = true
        WHERE c.deleted_at IS NULL AND c.ssn NOT LIKE '9999%%'
    """, fetch_one=True)
    with_address = address_result['count'] if address_result else 0

    # Top municipalities
    municipalities = execute_query("""
        SELECT m.name, COUNT(DISTINCT c.id) as count
        FROM membership_comrade c
        JOIN membership_newlocaladdress la ON la.comrade_id = c.id
        JOIN membership_newcomradeaddress nca ON la.newcomradeaddress_ptr_id = nca.id AND nca.current = true
        JOIN map_address a ON la.address_id = a.id
        JOIN map_street s ON a.street_id = s.id
        JOIN map_municipality m ON s.municipality_id = m.id
        WHERE c.deleted_at IS NULL AND c.ssn NOT LIKE '9999%%'
        GROUP BY m.name
        ORDER BY count DESC
        LIMIT 10
    """)

    log_json("info", "Got member stats", admin_uid=req.auth.uid)

    return {
        'total': total,
        'deleted': deleted,
        'with_email': with_email,
        'with_address': with_address,
        'without_address': total - with_address,
        'municipalities': [{'name': m['name'], 'count': m['count']} for m in municipalities]
    }


def get_member_self_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Get authenticated user's own member data from Cloud SQL.

    This is the self-service version - users can only get their own data.
    Uses kennitala from Firebase Auth token.

    Returns:
        Member object with full profile details
    """
    kennitala = require_auth(req)
    check_uid_rate_limit(req.auth.uid, "get_member_self", max_attempts=30, window_minutes=1)

    query = """
        SELECT
            c.id as django_id,
            c.name,
            c.ssn as kennitala,
            c.birthday,
            c.date_joined,
            c.deleted_at,
            c.reachable,
            c.groupable,
            c.email_marketing,
            c.email_marketing_updated_at,
            c.gender,
            c.housing_situation,
            ci.email,
            ci.phone,
            (
                SELECT json_build_object(
                    'street', s.name,
                    'number', a.number,
                    'letter', a.letter,
                    'postal_code', pc.code,
                    'city', m.name,
                    'municipality', m.name,
                    'country', 'IS',
                    'is_default', true
                )
                FROM membership_newlocaladdress la
                JOIN membership_newcomradeaddress nca ON la.newcomradeaddress_ptr_id = nca.id
                JOIN map_address a ON la.address_id = a.id
                JOIN map_street s ON a.street_id = s.id
                JOIN map_municipality m ON s.municipality_id = m.id
                LEFT JOIN map_postalcode pc ON s.postal_code_id = pc.id
                WHERE la.comrade_id = c.id AND nca.current = true
                LIMIT 1
            ) as address,
            (
                SELECT json_agg(json_build_object(
                    'id', u.id,
                    'name', u.name
                ))
                FROM membership_unionmembership um
                JOIN membership_union u ON um.union_id = u.id
                WHERE um.comrade_id = c.id
            ) as unions,
            (
                SELECT json_agg(json_build_object(
                    'id', t.id,
                    'name', t.name
                ))
                FROM membership_comradetitle ct
                JOIN membership_title t ON ct.title_id = t.id
                WHERE ct.comrade_id = c.id
            ) as titles
        FROM membership_comrade c
        LEFT JOIN membership_contactinfo ci ON ci.comrade_id = c.id
        WHERE c.ssn = %s
    """

    result = execute_query(query, params=(kennitala,), fetch_one=True)

    if not result:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message="Member not found"
        )

    # Parse JSON fields
    import json
    address = result['address'] or {}
    if isinstance(address, str):
        address = json.loads(address)

    unions = result['unions'] or []
    if isinstance(unions, str):
        unions = json.loads(unions)

    titles = result['titles'] or []
    if isinstance(titles, str):
        titles = json.loads(titles)

    # Format kennitala with hyphen for display
    kt_display = kennitala
    if len(kennitala) == 10 and '-' not in kennitala:
        kt_display = f"{kennitala[:6]}-{kennitala[6:]}"

    member = {
        'id': str(result['django_id']),
        'django_id': result['django_id'],
        'kennitala': kt_display,
        'name': result['name'] or '',
        'email': result['email'] or '',
        'phone': result['phone'] or '',
        'birthday': str(result['birthday']) if result['birthday'] else None,
        'gender': result['gender'],
        'date_joined': str(result['date_joined']) if result['date_joined'] else None,
        'status': 'deleted' if result['deleted_at'] else 'active',
        'deleted_at': str(result['deleted_at']) if result['deleted_at'] else None,
        'reachable': result['reachable'] if result['reachable'] is not None else True,
        'groupable': result['groupable'] if result['groupable'] is not None else True,
        'housing_situation': result['housing_situation'],
        'address': address,
        'unions': unions or [],
        'titles': titles or [],
        'metadata': {
            'django_id': result['django_id']
        },
        'profile': {
            'name': result['name'] or '',
            'email': result['email'] or '',
            'phone': result['phone'] or '',
            'birthday': str(result['birthday']) if result['birthday'] else None,
            'gender': result['gender'],
            'housing_situation': result['housing_situation'],
            'reachable': result['reachable'] if result['reachable'] is not None else True,
            'groupable': result['groupable'] if result['groupable'] is not None else True,
            'addresses': [address] if address else []
        },
        'membership': {
            'date_joined': str(result['date_joined']) if result['date_joined'] else None,
            'deleted_at': str(result['deleted_at']) if result['deleted_at'] else None,
            'status': 'deleted' if result['deleted_at'] else 'active',
            'unions': unions or [],
            'titles': titles or []
        },
        'preferences': {
            'email_marketing': result['email_marketing'] if result['email_marketing'] is not None else True,
            'email_marketing_updated_at': str(result['email_marketing_updated_at']) if result['email_marketing_updated_at'] else None
        }
    }

    log_json("info", "Member fetched own profile",
             django_id=result['django_id'],
             uid=req.auth.uid)

    return {'member': member}


def soft_delete_admin_handler(req: https_fn.CallableRequest) -> Dict[str, Any]:
    """
    Soft delete a member by admin.

    Allows admins to deactivate a member's account:
    1. Disables Firebase Auth account
    2. Sets deleted_at in Cloud SQL (source of truth)

    The member can later be reactivated.

    Requires admin or superuser role.

    Args:
        req.data: {
            'django_id': int - The member's Django ID
            'confirmation': str - Must be 'EYÐA' to confirm
        }

    Returns:
        Dict with success status and member name
    """
    require_admin(req)
    check_uid_rate_limit(req.auth.uid, "soft_delete_admin", max_attempts=20, window_minutes=10)

    data = req.data or {}
    django_id = data.get('django_id')
    confirmation = data.get('confirmation', '')

    if not django_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="django_id is required"
        )

    if confirmation != 'EYÐA':
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Confirmation text must be 'EYÐA'"
        )

    # Get member from Cloud SQL
    query = """
        SELECT c.id, c.name, c.ssn as kennitala, c.firebase_uid, c.deleted_at
        FROM membership_comrade c
        WHERE c.id = %s
    """
    result = execute_query(query, params=(int(django_id),), fetch_one=True)

    if not result:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message="Member not found"
        )

    if result['deleted_at']:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="Member is already deleted"
        )

    member_name = result['name']
    kennitala = result['kennitala']
    firebase_uid = result['firebase_uid']
    deleted_at = datetime.now(timezone.utc)

    log_json("info", "Admin soft delete initiated",
             admin_uid=req.auth.uid,
             target_django_id=django_id,
             target_kennitala=f"{kennitala[:6]}****" if kennitala else None)

    # 1. Disable Firebase Auth account (if UID exists)
    if firebase_uid:
        try:
            auth.update_user(firebase_uid, disabled=True)
            log_json("info", "Firebase Auth disabled by admin",
                     admin_uid=req.auth.uid,
                     target_uid=firebase_uid)

            # Update custom claims
            try:
                existing_claims = auth.get_user(firebase_uid).custom_claims or {}
                merged_claims = {**existing_claims, 'isMember': False}
                auth.set_custom_user_claims(firebase_uid, merged_claims)
            except Exception as claims_error:
                log_json("warn", "Failed to update custom claims",
                         target_uid=firebase_uid,
                         error=str(claims_error))

        except Exception as auth_error:
            log_json("warn", "Failed to disable Firebase Auth",
                     target_uid=firebase_uid,
                     error=str(auth_error))
            # Continue anyway - Cloud SQL update is main goal

    # 2. Update Cloud SQL directly (source of truth)
    try:
        affected_rows = execute_update(
            "UPDATE membership_comrade SET deleted_at = %s WHERE id = %s",
            params=(deleted_at, int(django_id))
        )

        if affected_rows == 0:
            log_json("error", "Cloud SQL update affected 0 rows",
                     admin_uid=req.auth.uid,
                     target_django_id=django_id)
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.INTERNAL,
                message="Database update failed"
            )

        log_json("info", "Cloud SQL soft delete successful",
                 admin_uid=req.auth.uid,
                 target_django_id=django_id)

    except Exception as db_error:
        log_json("error", "Cloud SQL update failed",
                 admin_uid=req.auth.uid,
                 error=str(db_error))
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Database update failed: {str(db_error)}"
        )

    log_json("info", "Admin soft delete completed successfully",
             admin_uid=req.auth.uid,
             target_django_id=django_id,
             target_name=member_name)

    return {
        'success': True,
        'message': f'Félaga {member_name} hefur verið eytt',
        'name': member_name,
        'deleted_at': deleted_at.isoformat()
    }
