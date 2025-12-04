"""
Django REST API Views for Bi-Directional Sync
Add this to membership/api_views_sync.py

These views handle sync requests from Cloud Functions:
1. GET /api/sync/changes/ - Get pending changes
2. POST /api/sync/apply/ - Apply changes from Firestore
3. POST /api/sync/mark-synced/ - Mark changes as synced
"""

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from django.db import transaction
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from membership.models import Comrade
from communication.models import Email
from membership.models_sync import MemberSyncQueue
from datetime import datetime
import json
import logging
import hashlib

logger = logging.getLogger(__name__)


def mask_ssn(ssn):
    """
    Mask SSN for logging to prevent PII exposure.
    Returns only last 4 digits with prefix masked.
    Example: "0101701234" -> "******1234"
    """
    if not ssn or len(ssn) < 4:
        return "****"
    return f"******{ssn[-4:]}"


def hash_ssn_for_log(ssn):
    """
    Create a short hash of SSN for log correlation without exposing PII.
    Returns first 8 chars of SHA256 hash.
    """
    if not ssn:
        return "unknown"
    return hashlib.sha256(ssn.encode()).hexdigest()[:8]


@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAdminUser])
def get_pending_changes(request):
    """
    GET /api/sync/changes/?since=2025-11-05T03:30:00Z
    
    Returns all pending changes from Django that need to be synced to Firestore.
    
    Query Parameters:
        since: ISO 8601 timestamp - only return changes after this time
    
    Response:
        {
            "changes": [
                {
                    "id": 123,
                    "ssn": "9999999999",
                    "action": "update",
                    "fields_changed": {"name": "New Name"},
                    "created_at": "2025-11-05T10:30:00Z"
                }
            ],
            "count": 1
        }
    """
    
    # Parse 'since' parameter
    since_param = request.GET.get('since')
    since = None
    
    if since_param:
        try:
            # Python 3.6 compatible date parsing
            from django.utils.dateparse import parse_datetime
            since = parse_datetime(since_param.replace('Z', '+00:00'))
            if since is None:
                raise ValueError('Invalid datetime format')
        except (ValueError, TypeError) as e:
            # Log actual error server-side for debugging
            logger.warning(f'Invalid since parameter: {str(e)}')

            return Response({
                'error': 'Invalid since parameter format. Use ISO 8601 format (e.g., 2025-11-14T12:00:00Z).'
            }, status=400)
    
    # Get pending changes
    queryset = MemberSyncQueue.get_pending_changes(since=since)
    
    # Serialize to JSON
    changes = []
    for item in queryset:
        changes.append({
            'id': item.id,
            'ssn': item.ssn,
            'action': item.action,
            'fields_changed': item.fields_changed,
            'created_at': item.created_at.isoformat()
        })
    
    return Response({
        'changes': changes,
        'count': len(changes)
    })


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAdminUser])
def apply_firestore_changes(request):
    """
    POST /api/sync/apply/
    
    Apply changes from Firestore to Django.
    
    Request Body:
        {
            "changes": [
                {
                    "kennitala": "999999-9999",
                    "action": "update",
                    "changes": {
                        "profile.email": "new@email.is",
                        "profile.phone": "555-1234"
                    }
                }
            ]
        }
    
    Response:
        {
            "results": [
                {
                    "ssn": "9999999999",
                    "status": "success"
                }
            ]
        }
    """
    
    try:
        changes = request.data.get('changes', [])
    except (AttributeError, KeyError) as e:
        return Response({
            'error': 'Invalid request body'
        }, status=400)
    
    results = []
    
    for change in changes:
        kennitala = change.get('kennitala', '').replace('-', '')  # Remove dash
        action = change.get('action')
        field_changes = change.get('changes', {})
        
        if not kennitala:
            results.append({
                'ssn': kennitala,
                'status': 'error',
                'message': 'Missing kennitala'
            })
            continue
        
        try:
            with transaction.atomic():
                # Find member by SSN
                try:
                    member = Comrade.objects.get(ssn=kennitala)
                except Comrade.DoesNotExist:
                    results.append({
                        'ssn': kennitala,
                        'status': 'error',
                        'message': 'Member not found'
                    })
                    continue
                
                # Apply field changes
                updated_fields = []
                
                for field_path, value in field_changes.items():
                    # Map Firestore paths to Django fields
                    # e.g., "profile.name" -> "name"
                    
                    if field_path == 'profile.name':
                        member.name = value
                        updated_fields.append('name')
                    
                    elif field_path == 'profile.birthday':
                        if value:
                            member.birthday = datetime.fromisoformat(value).date()
                        else:
                            member.birthday = None
                        updated_fields.append('birthday')
                    
                    elif field_path == 'profile.gender':
                        member.gender = value
                        updated_fields.append('gender')
                    
                    elif field_path == 'profile.housingSituation':
                        member.housing_situation = value
                        updated_fields.append('housing_situation')
                    
                    elif field_path == 'profile.email':
                        # Handle email in ContactInfo
                        if value:
                            from membership.models import ContactInfo
                            contact, created = ContactInfo.objects.get_or_create(comrade=member)
                            contact.email = value
                            contact.save()

                    elif field_path == 'profile.phone':
                        # Handle phone in ContactInfo
                        if value:
                            from membership.models import ContactInfo
                            contact, created = ContactInfo.objects.get_or_create(comrade=member)
                            contact.phone = value
                            contact.save()

                    # Handle address fields (profile.address.street, etc.)
                    elif field_path.startswith('profile.address.'):
                        # Collect all address changes
                        if not hasattr(member, '_address_changes'):
                            member._address_changes = {}

                        address_field = field_path.split('.')[-1]  # street, postal_code, city, country
                        member._address_changes[address_field] = value

                # Save member if any fields changed
                if updated_fields:
                    member.save(update_fields=updated_fields)

                # Handle address changes (update or create SimpleAddress)
                if hasattr(member, '_address_changes') and member._address_changes:
                    from membership.models import SimpleAddress

                    simple_addr, created = SimpleAddress.objects.get_or_create(comrade=member)

                    # Update SimpleAddress fields
                    if 'street' in member._address_changes:
                        simple_addr.street_address = member._address_changes['street']
                    if 'postal_code' in member._address_changes:
                        simple_addr.postal_code = member._address_changes['postal_code']
                    if 'city' in member._address_changes:
                        simple_addr.city = member._address_changes['city']
                    if 'country' in member._address_changes:
                        simple_addr.country = member._address_changes['country']

                    simple_addr.save()

                    logger.info('SimpleAddress %s for member %s',
                               'created' if created else 'updated',
                               mask_ssn(kennitala))
                
                results.append({
                    'ssn': kennitala,
                    'status': 'success',
                    'updated_fields': updated_fields
                })
        
        except Exception as e:
            # Log actual error server-side for debugging (no PII in message)
            logger.error('Member sync failed for member %s: %s',
                        mask_ssn(kennitala), type(e).__name__)

            results.append({
                'ssn': kennitala,
                'status': 'error',
                'message': 'Failed to process member data'
            })
    
    return Response({
        'results': results
    })


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAdminUser])
def mark_changes_synced(request):
    """
    POST /api/sync/mark-synced/
    
    Mark sync queue items as successfully synced.
    
    Request Body:
        {
            "sync_ids": [123, 456, 789]
        }
    
    Response:
        {
            "success": true,
            "marked_synced": 3
        }
    """
    
    try:
        sync_ids = request.data.get('sync_ids', [])
    except (AttributeError, KeyError):
        return Response({
            'error': 'Invalid request body'
        }, status=400)
    
    if not sync_ids:
        return Response({
            'error': 'No sync_ids provided'
        }, status=400)
    
    # Mark items as synced
    updated_count = MemberSyncQueue.objects.filter(
        id__in=sync_ids,
        sync_status='pending'
    ).update(
        sync_status='synced',
        synced_at=timezone.now()
    )
    
    return Response({
        'success': True,
        'marked_synced': updated_count
    })


@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAdminUser])
def sync_status(request):
    """
    GET /api/sync/status/
    
    Get sync queue statistics.
    
    Response:
        {
            "pending": 5,
            "synced": 120,
            "failed": 2,
            "oldest_pending": "2025-11-05T03:30:00Z"
        }
    """
    
    pending_count = MemberSyncQueue.objects.filter(sync_status='pending').count()
    synced_count = MemberSyncQueue.objects.filter(sync_status='synced').count()
    failed_count = MemberSyncQueue.objects.filter(sync_status='failed').count()
    
    oldest_pending = MemberSyncQueue.objects.filter(
        sync_status='pending'
    ).order_by('created_at').first()
    
    return Response({
        'pending': pending_count,
        'synced': synced_count,
        'failed': failed_count,
        'oldest_pending': oldest_pending.created_at.isoformat() if oldest_pending else None
    })


def find_map_address(street_name, house_number, postal_code, house_letter=''):
    """
    Find map_address by street name, house number, and postal code.

    Args:
        street_name: Street name (e.g., "Gullengi")
        house_number: House number (e.g., 37)
        postal_code: Postal code as string or int (e.g., "112" or 112)
        house_letter: Optional house letter (e.g., "A")

    Returns:
        map_address instance or None
    """
    from map.models import Address as MapAddress, Street as MapStreet, PostalCode as MapPostalCode

    try:
        # Normalize postal code to integer
        postal_code_int = int(str(postal_code).strip()) if postal_code else None

        if not postal_code_int:
            logger.warning('No postal code provided for address lookup')
            return None

        # Find postal code record
        postal_code_obj = MapPostalCode.objects.filter(code=postal_code_int).first()
        if not postal_code_obj:
            logger.warning('Postal code %d not found in map_postalcode', postal_code_int)
            return None

        # Find street by name and postal code
        street = MapStreet.objects.filter(
            name__iexact=street_name.strip(),
            postal_code=postal_code_obj
        ).first()

        if not street:
            logger.warning('Street not found in postal code %d', postal_code_int)
            return None

        # Find address by street and house number
        address_query = MapAddress.objects.filter(
            street=street,
            number=int(house_number) if house_number else None
        )

        # Add letter filter if provided
        if house_letter:
            address_query = address_query.filter(letter__iexact=house_letter.strip())
        else:
            address_query = address_query.filter(letter='')

        address = address_query.first()

        if address:
            logger.info('Found map_address %d in postal code %d', address.id, postal_code_int)
        else:
            logger.warning('Address not found in street %d', street.id)

        return address

    except Exception as e:
        logger.error('Error finding map_address: %s', type(e).__name__)
        return None


def update_member_local_address(member, address_data):
    """
    Update or create NewLocalAddress for a member.
    This uses the proper Iceland address registry (map_address).

    Args:
        member: Comrade instance
        address_data: dict with keys:
            - street: Street name (e.g., "Gullengi")
            - number: House number (e.g., 37)
            - letter: House letter (e.g., "A") - optional
            - postal_code: Postal code (e.g., "112")
            - city: City name (for reference, not used in lookup)
            - country: Country code (e.g., "IS")

    Returns:
        tuple (NewLocalAddress instance or None, bool created, str message)
    """
    from membership.models import NewLocalAddress

    try:
        country = address_data.get('country', 'IS')

        # Only use map_address lookup for Iceland addresses
        if country != 'IS':
            logger.info('Non-Iceland address for member %s, skipping map_address lookup',
                       mask_ssn(member.ssn))
            return None, False, 'Foreign address - use NewForeignAddress'

        street_name = address_data.get('street', '')
        house_number = address_data.get('number', '')
        house_letter = address_data.get('letter', '')
        postal_code = address_data.get('postal_code', '')

        if not street_name or not postal_code:
            return None, False, 'Missing street name or postal code'

        # Find the map_address record
        map_address = find_map_address(
            street_name=street_name,
            house_number=house_number,
            postal_code=postal_code,
            house_letter=house_letter
        )

        # Mark any existing current addresses as not current
        NewLocalAddress.objects.filter(
            comrade=member,
            current=True
        ).update(current=False)

        if map_address:
            # Create/update with linked map_address
            local_addr, created = NewLocalAddress.objects.update_or_create(
                comrade=member,
                address=map_address,
                defaults={
                    'current': True,
                    'unlocated': False,
                    'country_id': 109,  # Iceland
                }
            )
            logger.info('NewLocalAddress %s for member %s -> map_address %d',
                       'created' if created else 'updated',
                       mask_ssn(member.ssn), map_address.id)
            return local_addr, created, 'Success - address linked to registry'
        else:
            # Create unlocated address (address not found in registry)
            local_addr, created = NewLocalAddress.objects.update_or_create(
                comrade=member,
                address=None,
                unlocated=True,
                defaults={
                    'current': True,
                    'country_id': 109,  # Iceland
                }
            )
            logger.info('Unlocated NewLocalAddress %s for member %s',
                       'created' if created else 'updated',
                       mask_ssn(member.ssn))
            return local_addr, created, 'Created but address not found in registry'

    except Exception as e:
        logger.error('Error updating NewLocalAddress for member %s: %s',
                    mask_ssn(member.ssn), type(e).__name__)
        return None, False, 'Error updating address'


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAdminUser])
def update_member_address(request):
    """
    POST /api/sync/address/

    Update a member's local address (NewLocalAddress) using the Iceland address registry.

    Request Body:
        {
            "kennitala": "0101701234",
            "address": {
                "street": "Gullengi",
                "number": 37,
                "letter": "",
                "postal_code": "112",
                "city": "Reykjavík",
                "country": "IS"
            }
        }

    Response:
        {
            "success": true,
            "message": "Address updated",
            "map_address_id": 12345,
            "address_linked": true
        }
    """
    try:
        kennitala = request.data.get('kennitala', '').replace('-', '')
        address_data = request.data.get('address', {})

        if not kennitala:
            return Response({'error': 'Missing kennitala'}, status=400)

        if not address_data:
            return Response({'error': 'Missing address data'}, status=400)

        # Find member
        try:
            member = Comrade.objects.get(ssn=kennitala)
        except Comrade.DoesNotExist:
            return Response({'error': 'Member not found'}, status=404)

        # Update address
        local_addr, created, message = update_member_local_address(member, address_data)

        return Response({
            'success': local_addr is not None,
            'message': message,
            'created': created,
            'map_address_id': local_addr.address_id if local_addr and local_addr.address else None,
            'address_linked': local_addr.address is not None if local_addr else False,
            'unlocated': local_addr.unlocated if local_addr else None
        })

    except Exception as e:
        logger.error('Error in update_member_address: %s', type(e).__name__)
        return Response({'error': 'An internal error occurred'}, status=500)


@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAdminUser])
def get_member_by_ssn(request, ssn):
    """
    Get full member data by SSN for sync purposes.
    
    GET /api/sync/member/<ssn>/
    
    Response:
        {
            "ssn": "9999999999",
            "name": "Jon Jonsson",
            "birthday": "1970-01-01",
            "gender": 1,
            "housing_situation": 2,
            "email": "jon@example.is",
            "phone": "5551234",
            ...
        }
    """
    # Remove dash from SSN if present
    ssn_clean = ssn.replace('-', '')
    
    try:
        member = Comrade.objects.get(ssn=ssn_clean)
    except Comrade.DoesNotExist:
        return Response({
            'error': 'Member not found'
        }, status=404)
    
    # Build member data
    data = {
        'ssn': member.ssn,
        'name': member.name,
        'birthday': member.birthday.isoformat() if member.birthday else None,
        'gender': member.gender,
        'housing_situation': member.housing_situation,
        'reachable': member.reachable,
        'groupable': member.groupable,
        'date_joined': member.date_joined.isoformat() if member.date_joined else None,
    }
    
    # Add email if exists
    try:
        email = Email.objects.filter(comrade=member).first()
        if email:
            data['email'] = email.email
    except:
        pass
    
    # Add phone from ContactInfo if exists
    try:
        from membership.models import ContactInfo
        contact = ContactInfo.objects.filter(comrade=member).first()
        if contact and contact.phone:
            data['phone'] = contact.phone
    except:
        pass
    
    # Add address from SimpleAddress if exists  
    try:
        from membership.models import SimpleAddress
        address = SimpleAddress.objects.filter(comrade=member).first()
        if address:
            data['street_address'] = address.street_address or ''
            data['postal_code'] = address.postal_code or ''
            data['city'] = address.city or ''
    except:
        pass
    
    return Response(data)
