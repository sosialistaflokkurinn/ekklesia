"""
Django Signal Handlers for Change Tracking
Add this to membership/signals.py

These signals automatically track changes to Comrade model
and add them to the MemberSyncQueue for syncing to Firestore.
"""

import logging
from django.db.models.signals import post_save, post_delete, pre_delete
from django.dispatch import receiver
from membership.models import Comrade
from membership.models_sync import MemberSyncQueue

logger = logging.getLogger(__name__)

# Store member SSN before deletion so we can track it
_member_ssn_before_delete = {}


@receiver(pre_delete, sender=Comrade)
def store_member_ssn_before_delete(sender, instance, **kwargs):
    """
    Store member SSN before deletion so post_delete can access it.
    """
    _member_ssn_before_delete[instance.pk] = instance.ssn


@receiver(post_save, sender=Comrade)
def track_member_changes_on_save(sender, instance, created, **kwargs):
    """
    Track member create/update and add to sync queue.
    
    Triggered after Comrade.save() is called.
    """
    
    # Determine action type
    action = 'create' if created else 'update'
    
    # Get changed fields (simple approach - track all fields on update)
    # For more granular tracking, use django-dirtyfields library
    fields_changed = {}
    
    if not created:
        # For updates, we'll track all syncable fields
        # In production, you'd want to track only changed fields
        fields_changed = {
            'name': instance.name,
            'birthday': instance.birthday.isoformat() if instance.birthday else None,
            'gender': instance.gender,
            'housing_situation': instance.housing_situation,
        }
    
    # Create sync queue entry
    MemberSyncQueue.objects.create(
        member=instance,
        ssn=instance.ssn,
        action=action,
        fields_changed=fields_changed
    )
    
    # Log for debugging
    logger.info(f"[SYNC QUEUE] Added {action} for member {instance.ssn}")


@receiver(post_delete, sender=Comrade)
def track_member_deletion(sender, instance, **kwargs):
    """
    Track member deletion and add to sync queue.
    
    Triggered after Comrade.delete() is called.
    """
    
    # Get SSN that we stored in pre_delete
    ssn = _member_ssn_before_delete.pop(instance.pk, instance.ssn)
    
    # Create sync queue entry
    MemberSyncQueue.objects.create(
        member=None,  # Member is already deleted
        ssn=ssn,
        action='delete',
        fields_changed={'ssn': ssn}
    )
    
    # Log for debugging
    logger.info(f"[SYNC QUEUE] Added delete for member {ssn}")


# Alternative: If you want more granular field tracking, use django-dirtyfields
# Install: pip install django-dirtyfields
# Then in models.py:
#
# from dirtyfields import DirtyFieldsMixin
#
# class Comrade(DirtyFieldsMixin, models.Model):
#     ...
#
# Then in signals:
#
# @receiver(post_save, sender=Comrade)
# def track_member_changes_with_dirty_fields(sender, instance, created, **kwargs):
#     if created:
#         fields_changed = {}
#     else:
#         # Get only fields that actually changed
#         dirty_fields = instance.get_dirty_fields()
#         fields_changed = {
#             field: getattr(instance, field)
#             for field in dirty_fields.keys()
#             if field in ['name', 'birthday', 'gender', 'housing_situation']
#         }
#     
#     if created or fields_changed:
#         MemberSyncQueue.objects.create(
#             member=instance,
#             ssn=instance.ssn,
#             action='create' if created else 'update',
#             fields_changed=fields_changed
#         )
