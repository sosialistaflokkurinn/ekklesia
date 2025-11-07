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
            return Response({
                'error': f'Invalid since parameter: {str(e)}. Use ISO 8601 format.'
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
                        # Handle email separately (ManyToMany relationship)
                        if value:
                            email_obj, created = Email.objects.get_or_create(email=value)
                            member.emails.clear()
                            member.emails.add(email_obj)
                
                # Save member if any fields changed
                if updated_fields:
                    member.save(update_fields=updated_fields)
                
                results.append({
                    'ssn': kennitala,
                    'status': 'success',
                    'updated_fields': updated_fields
                })
        
        except Exception as e:
            results.append({
                'ssn': kennitala,
                'status': 'error',
                'message': str(e)
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
