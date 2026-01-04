"""
Cloud SQL Registration Module

Functions for creating new members directly in Cloud SQL.
Replaces Django API calls for member registration.

Tables affected:
- membership_comrade: name, ssn, birthday, gender, housing_situation, reachable, groupable
- membership_contactinfo: email, phone
- membership_newlocaladdress: Iceland addresses (with map_address FK)
- membership_newforeignaddress: foreign addresses
- groups_comradegroupmembership: cell assignment
- membership_unionmembership: union membership
- membership_comradetitle: job title
"""

import logging
from datetime import datetime
from typing import Optional

from db import get_connection, execute_query
from util_logging import log_json

logger = logging.getLogger(__name__)

# Iceland country ID in map_country table
ICELAND_COUNTRY_ID = 109


def find_map_address(street: str, number: int | str | None, postal_code: str) -> dict | None:
    """
    Find map_address by street name, number, and postal code.

    Note: hnitnum (iceaddr) ≠ map_address.id - they are different ID systems!
    This function looks up by street/number/postal_code to get the map_address.id.

    Args:
        street: Street name (e.g., "Laugavegur")
        number: House number (e.g., 1 or "1")
        postal_code: Postal code (e.g., "101")

    Returns:
        Dict with id and geometry, or None if not found
    """
    try:
        # Convert number to int if string
        num = None
        if number:
            try:
                num = int(number)
            except (ValueError, TypeError):
                pass

        # Build query based on whether we have a number
        if num:
            query = """
                SELECT a.id, ST_AsText(a.geometry) as geometry_text
                FROM map_address a
                JOIN map_street s ON a.street_id = s.id
                JOIN map_postalcode pc ON s.postal_code_id = pc.id
                WHERE s.name ILIKE %s AND pc.code = %s AND a.number = %s
                LIMIT 1
            """
            result = execute_query(query, params=(street, postal_code, num), fetch_one=True)
        else:
            query = """
                SELECT a.id, ST_AsText(a.geometry) as geometry_text
                FROM map_address a
                JOIN map_street s ON a.street_id = s.id
                JOIN map_postalcode pc ON s.postal_code_id = pc.id
                WHERE s.name ILIKE %s AND pc.code = %s
                LIMIT 1
            """
            result = execute_query(query, params=(street, postal_code), fetch_one=True)

        if result:
            log_json("info", "Found map_address",
                     street=street, number=num, postal_code=postal_code,
                     map_address_id=result['id'])
            return result

        log_json("warning", "map_address not found",
                 street=street, number=num, postal_code=postal_code)
        return None

    except Exception as e:
        log_json("error", "map_address lookup failed",
                 street=street, number=number, postal_code=postal_code,
                 error=str(e))
        return None


def find_cell_by_geometry(geometry_text: str) -> int | None:
    """
    Find cell ID by geometry using PostGIS ST_Contains.

    Note: cells_cell inherits from groups_comradegroup via comradegroup_ptr_id

    Args:
        geometry_text: WKT geometry string (from ST_AsText)

    Returns:
        Cell ID (comradegroup_ptr_id) or None if not found
    """
    if not geometry_text:
        return None

    try:
        # cells_cell.comradegroup_ptr_id is the cell ID (FK to groups_comradegroup)
        # geometry is in SRID 3057 (ISN93/Lambert 1993 - Icelandic projection)
        query = """
            SELECT comradegroup_ptr_id as id FROM cells_cell
            WHERE ST_Contains(geometry, ST_GeomFromText(%s, 3057))
            LIMIT 1
        """
        result = execute_query(query, params=(geometry_text,), fetch_one=True)
        if result:
            return result['id']
    except Exception as e:
        log_json("warning", "Cell lookup by geometry failed",
                 error=str(e))
    return None


def find_union_by_name(name: str) -> int | None:
    """Find union ID by name (case-insensitive)."""
    if not name:
        return None

    result = execute_query(
        "SELECT id FROM membership_union WHERE name ILIKE %s LIMIT 1",
        params=(name,),
        fetch_one=True
    )
    return result['id'] if result else None


def find_title_by_name(name: str) -> int | None:
    """Find job title ID by name (case-insensitive)."""
    if not name:
        return None

    result = execute_query(
        "SELECT id FROM membership_title WHERE name ILIKE %s LIMIT 1",
        params=(name,),
        fetch_one=True
    )
    return result['id'] if result else None


def create_member_in_cloudsql(data: dict) -> dict:
    """
    Create a new member directly in Cloud SQL.

    Args:
        data: Dict with:
            - kennitala: SSN (required)
            - name: Full name (required)
            - email: Email address (required)
            - phone: Phone number (required)
            - birthday: ISO date string (optional)
            - gender: Gender code (optional)
            - housing_situation: Housing code (optional)
            - reachable: Boolean (default True)
            - groupable: Boolean (default True)
            - address: Dict with type, street, number, postal_code, city, country_id, cell_id
            - union_name: Union name to lookup (optional)
            - title_name: Job title name to lookup (optional)

    Returns:
        {"success": True, "django_id": comrade_id} on success
        {"success": False, "error": "message"} on failure
    """
    kennitala = data.get('kennitala', '').replace('-', '')
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    phone = data.get('phone', '').replace('-', '').replace(' ', '')

    if not kennitala or not name:
        return {"success": False, "error": "kennitala and name are required"}

    # Parse birthday
    birthday = None
    birthday_str = data.get('birthday')
    if birthday_str:
        try:
            birthday = datetime.fromisoformat(birthday_str.replace('Z', '+00:00')).date()
        except (ValueError, TypeError):
            pass

    with get_connection() as conn:
        cursor = conn.cursor()
        try:
            # 1. Create Comrade
            cursor.execute("""
                INSERT INTO membership_comrade
                    (ssn, name, birthday, gender, housing_situation, reachable, groupable, date_joined)
                VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                RETURNING id
            """, (
                kennitala,
                name,
                birthday,
                data.get('gender'),
                data.get('housing_situation'),
                data.get('reachable', True),
                data.get('groupable', True)
            ))
            comrade_id = cursor.fetchone()[0]
            log_json("info", "Created comrade", comrade_id=comrade_id)

            # 2. Create ContactInfo
            cursor.execute("""
                INSERT INTO membership_contactinfo
                    (comrade_id, email, phone, foreign_phone, facebook)
                VALUES (%s, %s, %s, '', '')
            """, (comrade_id, email, phone))

            # 3. Handle address
            address_data = data.get('address', {})
            address_type = address_data.get('type', 'iceland')
            cell_id = None
            map_address = None

            if address_type == 'unlocated':
                # Iceland without specific address
                # Django multi-table inheritance: first create parent, then child
                cursor.execute("""
                    INSERT INTO membership_newcomradeaddress
                        (country_id, current, moved_in, moved_out)
                    VALUES (%s, true, NULL, NULL)
                    RETURNING id
                """, (ICELAND_COUNTRY_ID,))
                address_parent_id = cursor.fetchone()[0]

                cursor.execute("""
                    INSERT INTO membership_newlocaladdress
                        (newcomradeaddress_ptr_id, comrade_id, unlocated, address_id)
                    VALUES (%s, %s, true, NULL)
                """, (address_parent_id, comrade_id))

                # Use provided cell_id
                cell_id = address_data.get('cell_id')

            elif address_type == 'iceland':
                # Iceland with specific address - lookup map_address
                street = address_data.get('street', '').strip()
                number = address_data.get('number')
                postal_code = address_data.get('postal_code', '').strip()

                if street and postal_code:
                    map_address = find_map_address(street, number, postal_code)

                # Django multi-table inheritance: first create parent, then child
                cursor.execute("""
                    INSERT INTO membership_newcomradeaddress
                        (country_id, current, moved_in, moved_out)
                    VALUES (%s, true, NULL, NULL)
                    RETURNING id
                """, (ICELAND_COUNTRY_ID,))
                address_parent_id = cursor.fetchone()[0]

                cursor.execute("""
                    INSERT INTO membership_newlocaladdress
                        (newcomradeaddress_ptr_id, comrade_id, unlocated, address_id)
                    VALUES (%s, %s, false, %s)
                """, (address_parent_id, comrade_id, map_address['id'] if map_address else None))

                # Find cell from geometry
                if map_address and map_address.get('geometry_text'):
                    cell_id = find_cell_by_geometry(map_address['geometry_text'])

            elif address_type == 'foreign':
                # Foreign address
                country_id = address_data.get('country_id', 1)

                # Django multi-table inheritance: first create parent, then child
                cursor.execute("""
                    INSERT INTO membership_newcomradeaddress
                        (country_id, current, moved_in, moved_out)
                    VALUES (%s, true, NULL, NULL)
                    RETURNING id
                """, (country_id,))
                address_parent_id = cursor.fetchone()[0]

                cursor.execute("""
                    INSERT INTO membership_newforeignaddress
                        (newcomradeaddress_ptr_id, comrade_id, address, postal_code, municipality)
                    VALUES (%s, %s, %s, %s, %s)
                """, (
                    address_parent_id,
                    comrade_id,
                    address_data.get('street', ''),
                    address_data.get('postal_code', ''),
                    address_data.get('city', '')
                ))

                # Find cell for foreign country
                # Note: cells_cell uses comradegroup_ptr_id (Django multi-table inheritance)
                result = execute_query("""
                    SELECT c.comradegroup_ptr_id as id FROM cells_cell c
                    JOIN cells_cell_countries cc ON c.comradegroup_ptr_id = cc.cell_id
                    WHERE cc.country_id = %s
                    LIMIT 1
                """, params=(country_id,), fetch_one=True)
                if result:
                    cell_id = result['id']

            # 4. Assign to cell
            if cell_id:
                cursor.execute("""
                    INSERT INTO groups_comradegroupmembership
                        (comrade_id, group_id, date_joined, confirmed)
                    VALUES (%s, %s, NOW(), true)
                """, (comrade_id, cell_id))
                log_json("info", "Assigned to cell", comrade_id=comrade_id, cell_id=cell_id)

            # 5. Handle union
            union_name = data.get('union_name')
            if union_name:
                union_id = find_union_by_name(union_name)
                if union_id:
                    cursor.execute("""
                        INSERT INTO membership_unionmembership (comrade_id, union_id)
                        VALUES (%s, %s)
                    """, (comrade_id, union_id))

            # 6. Handle job title
            title_name = data.get('title_name')
            if title_name:
                title_id = find_title_by_name(title_name)
                if title_id:
                    cursor.execute("""
                        INSERT INTO membership_comradetitle (comrade_id, title_id)
                        VALUES (%s, %s)
                    """, (comrade_id, title_id))

            # Commit transaction
            conn.commit()

            log_json("info", "Member created successfully in Cloud SQL",
                     comrade_id=comrade_id,
                     kennitala=f"{kennitala[:6]}****",
                     has_address=address_type != 'unlocated',
                     has_cell=cell_id is not None)

            return {
                "success": True,
                "django_id": comrade_id,
                "message": "Member created successfully",
                "already_existed": False
            }

        except Exception as e:
            conn.rollback()
            log_json("error", "Failed to create member in Cloud SQL",
                     error=str(e),
                     kennitala=f"{kennitala[:6]}****" if kennitala else "unknown")
            raise
        finally:
            cursor.close()
