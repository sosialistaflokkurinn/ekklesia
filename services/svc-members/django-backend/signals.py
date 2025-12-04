"""
Django Signal Handlers for Real-Time Sync to Firestore

These signals automatically sync Comrade changes to Firestore
via Cloud Function webhook (no queue).
"""

import os
import logging
import requests
from django.db.models.signals import post_save, post_delete, pre_delete
from django.dispatch import receiver
from membership.models import Comrade

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

# Cloud Function URL - set in Django settings or environment
SYNC_CLOUD_FUNCTION_URL = os.environ.get(
    'SYNC_CLOUD_FUNCTION_URL',
    'https://europe-west2-ekklesia-prod-10-2025.cloudfunctions.net/sync_from_django'
)

# API key for authenticating to Cloud Function
SYNC_API_KEY = os.environ.get('SYNC_API_KEY', '')

# Store member SSN before deletion so we can track it
_member_ssn_before_delete = {}


def serialize_member(instance):
    """
    Serialize Comrade instance to Django API format for sync.

    This matches the format expected by transform_django_member_to_firestore().
    """
    # Get contact info
    contact_info = {}
    try:
        from membership.models import ContactInfo
        ci = ContactInfo.objects.filter(comrade=instance).first()
        if ci:
            contact_info = {
                'email': ci.email or '',
                'phone': ci.phone or '',
                'foreign_phone': ci.foreign_phone or '',
                'facebook': ci.facebook or ''
            }
    except Exception as e:
        logger.warning(f'Could not get contact info: {e}')

    # Get local address
    local_address = {}
    try:
        from membership.models import NewLocalAddress
        addr = NewLocalAddress.objects.filter(comrade=instance, current=True).first()
        if addr and addr.address:
            postal_code = addr.address.street.postal_code if addr.address.street else None
            # Get city name from municipality via MunicipalityPostalCode
            city = ''
            if postal_code:
                mpc = postal_code.municipalitypostalcode_set.first()
                if mpc and mpc.municipality:
                    city = mpc.municipality.name
            local_address = {
                'street': addr.address.street.name if addr.address.street else '',
                'number': addr.address.number,
                'letter': addr.address.letter or '',
                'postal_code': postal_code.code if postal_code else '',
                'city': city
            }
    except Exception as e:
        logger.warning(f'Could not get local address: {e}')

    # Get unions
    unions = []
    try:
        for um in instance.union_memberships.all():
            if um.union:
                unions.append({'name': um.union.name})
    except Exception as e:
        logger.warning(f'Could not get unions: {e}')

    # Get titles
    titles = []
    try:
        for ct in instance.comradetitles.all():
            if ct.title:
                titles.append({'name': ct.title.name})
    except Exception as e:
        logger.warning(f'Could not get titles: {e}')

    # Get foreign addresses
    foreign_addresses = []
    try:
        from membership.models import NewForeignAddress
        for fa in NewForeignAddress.objects.filter(comrade=instance):
            foreign_addresses.append({
                'pk': fa.id,
                'country': fa.country_id,
                'current': fa.current,
                'municipality': fa.municipality or '',
                'postal_code': fa.postal_code or '',
                'address': fa.address or ''
            })
    except Exception as e:
        logger.warning(f'Could not get foreign addresses: {e}')

    return {
        'id': instance.id,
        'ssn': instance.ssn,
        'name': instance.name,
        'birthday': instance.birthday.isoformat() if instance.birthday else None,
        'gender': instance.gender,
        'housing_situation': instance.housing_situation,
        'reachable': instance.reachable,
        'groupable': instance.groupable,
        'date_joined': instance.date_joined.isoformat() if instance.date_joined else None,
        'contact_info': contact_info,
        'local_address': local_address,
        'unions': unions,
        'titles': titles,
        'foreign_addresses': foreign_addresses
    }


def sync_to_firestore(kennitala, action, data=None):
    """
    Call Cloud Function to sync member to Firestore.

    Args:
        kennitala: Member SSN
        action: 'create', 'update', or 'delete'
        data: Serialized member data (optional for delete)
    """
    if not SYNC_API_KEY:
        logger.warning('SYNC_API_KEY not set, skipping Firestore sync')
        return False

    try:
        payload = {
            'kennitala': kennitala.replace('-', ''),
            'action': action
        }
        if data:
            payload['data'] = data

        response = requests.post(
            SYNC_CLOUD_FUNCTION_URL,
            json=payload,
            headers={
                'Authorization': f'Bearer {SYNC_API_KEY}',
                'Content-Type': 'application/json'
            },
            timeout=10
        )

        if response.status_code == 200:
            logger.info('[FIRESTORE SYNC] %s for member %s succeeded',
                       action, mask_ssn(kennitala))
            return True
        else:
            logger.error('[FIRESTORE SYNC] %s for member %s failed: %d',
                        action, mask_ssn(kennitala), response.status_code)
            return False

    except requests.exceptions.Timeout:
        logger.error('[FIRESTORE SYNC] Timeout syncing member %s', mask_ssn(kennitala))
        return False
    except Exception as e:
        logger.error('[FIRESTORE SYNC] Error syncing member %s: %s',
                    mask_ssn(kennitala), type(e).__name__)
        return False


@receiver(pre_delete, sender=Comrade)
def store_member_ssn_before_delete(sender, instance, **kwargs):
    """Store member SSN before deletion so post_delete can access it."""
    _member_ssn_before_delete[instance.pk] = instance.ssn


@receiver(post_save, sender=Comrade)
def sync_member_on_save(sender, instance, created, **kwargs):
    """
    Sync member to Firestore immediately when created or updated.
    """
    action = 'create' if created else 'update'
    data = serialize_member(instance)
    sync_to_firestore(instance.ssn, action, data)


@receiver(post_delete, sender=Comrade)
def sync_member_on_delete(sender, instance, **kwargs):
    """
    Sync member deletion to Firestore immediately.
    """
    ssn = _member_ssn_before_delete.pop(instance.pk, instance.ssn)
    sync_to_firestore(ssn, 'delete')
