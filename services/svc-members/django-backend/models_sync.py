"""
Django Model for Bi-Directional Sync Queue
Add this to membership/models.py or create a new app

File: membership/models_sync.py
Django Version: 1.11
"""

from django.db import models
from django.contrib.postgres.fields import JSONField
from django.utils import timezone


class MemberSyncQueue(models.Model):
    """
    Track member changes that need to be synced to Firestore.
    
    This queue ensures changes made in Django are propagated to 
    Firestore during the nightly sync at 3:30 AM.
    """
    
    ACTION_CHOICES = (
        ('create', 'Create'),
        ('update', 'Update'),
        ('delete', 'Delete'),
    )
    
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('synced', 'Synced'),
        ('failed', 'Failed'),
    )
    
    # Member reference (nullable for deletes since member may be gone)
    member = models.ForeignKey(
        'Comrade', 
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sync_queue'
    )
    
    # Member SSN (stored for reference even if member is deleted)
    ssn = models.CharField(
        max_length=10,
        db_index=True,
        help_text="Kennitala (10 digits, no hyphen)"
    )
    
    # Action type
    action = models.CharField(
        max_length=20,
        choices=ACTION_CHOICES,
        default='update'
    )
    
    # Fields that changed (JSON object)
    # Example: {"name": "New Name", "email": "new@email.is"}
    fields_changed = JSONField(
        default=dict,
        blank=True,
        help_text="JSON object of changed fields and their new values"
    )
    
    # Timestamps
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        help_text="When the change was detected"
    )
    
    synced_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the change was synced to Firestore"
    )
    
    # Sync status
    sync_status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        db_index=True
    )
    
    # Error tracking
    error_message = models.TextField(
        blank=True,
        help_text="Error message if sync failed"
    )
    
    retry_count = models.IntegerField(
        default=0,
        help_text="Number of sync retry attempts"
    )
    
    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['sync_status', 'created_at']),
            models.Index(fields=['ssn', 'created_at']),
        ]
        verbose_name = "Member Sync Queue Item"
        verbose_name_plural = "Member Sync Queue"
    
    def __unicode__(self):
        return u"[{}] {} - {} ({})".format(
            self.action.upper(),
            self.ssn,
            self.sync_status,
            self.created_at.strftime('%Y-%m-%d %H:%M')
        )
    
    def __str__(self):
        return self.__unicode__()
    
    def mark_synced(self):
        """Mark this item as successfully synced"""
        self.sync_status = 'synced'
        self.synced_at = timezone.now()
        self.save(update_fields=['sync_status', 'synced_at'])
    
    def mark_failed(self, error):
        """Mark this item as failed with error message"""
        self.sync_status = 'failed'
        self.error_message = str(error)
        self.retry_count += 1
        self.save(update_fields=['sync_status', 'error_message', 'retry_count'])
    
    @classmethod
    def get_pending_changes(cls, since=None):
        """
        Get all pending changes, optionally since a timestamp.
        
        Args:
            since: datetime object - only get changes after this time
        
        Returns:
            QuerySet of pending MemberSyncQueue items
        """
        queryset = cls.objects.filter(sync_status='pending')
        
        if since:
            queryset = queryset.filter(created_at__gt=since)
        
        return queryset.order_by('created_at')
    
    @classmethod
    def cleanup_old_synced(cls, days=30):
        """
        Delete synced items older than X days to prevent table bloat.
        
        Args:
            days: int - delete synced items older than this many days
        
        Returns:
            int - number of items deleted
        """
        cutoff = timezone.now() - timezone.timedelta(days=days)
        deleted_count, _ = cls.objects.filter(
            sync_status='synced',
            synced_at__lt=cutoff
        ).delete()
        return deleted_count
