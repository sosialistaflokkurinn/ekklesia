"""
Django Admin Configuration for MemberSyncQueue
Add this to membership/admin.py

This allows viewing and managing the sync queue from Django admin interface.
"""

from django.contrib import admin
from django.utils import timezone
from membership.models_sync import MemberSyncQueue


@admin.register(MemberSyncQueue)
class MemberSyncQueueAdmin(admin.ModelAdmin):
    """
    Admin interface for MemberSyncQueue.
    
    Allows admins to:
    - View pending/synced/failed sync items
    - Filter by status, date
    - Manually mark items as synced
    - View error messages for failed items
    """
    
    list_display = [
        'id',
        'ssn',
        'action',
        'sync_status',
        'created_at',
        'synced_at',
        'retry_count'
    ]
    
    list_filter = [
        'sync_status',
        'action',
        'created_at',
        'synced_at'
    ]
    
    search_fields = [
        'ssn',
        'error_message'
    ]
    
    readonly_fields = [
        'created_at',
        'synced_at',
        'retry_count'
    ]
    
    ordering = ['-created_at']
    
    date_hierarchy = 'created_at'
    
    actions = ['mark_as_synced', 'mark_as_pending', 'retry_failed']
    
    fieldsets = (
        ('Member Information', {
            'fields': ('member', 'ssn')
        }),
        ('Sync Details', {
            'fields': ('action', 'fields_changed', 'sync_status')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'synced_at')
        }),
        ('Error Tracking', {
            'fields': ('error_message', 'retry_count'),
            'classes': ('collapse',)
        }),
    )
    
    def mark_as_synced(self, request, queryset):
        """Admin action: Mark selected items as synced"""
        updated = queryset.update(
            sync_status='synced',
            synced_at=timezone.now()
        )
        self.message_user(request, "{} items marked as synced.".format(updated))
    
    mark_as_synced.short_description = "Mark selected as synced"
    
    def mark_as_pending(self, request, queryset):
        """Admin action: Mark selected items as pending (for retry)"""
        updated = queryset.update(
            sync_status='pending',
            synced_at=None
        )
        self.message_user(request, "{} items marked as pending.".format(updated))
    
    mark_as_pending.short_description = "Mark selected as pending (retry)"
    
    def retry_failed(self, request, queryset):
        """Admin action: Retry failed items"""
        failed_items = queryset.filter(sync_status='failed')
        updated = failed_items.update(
            sync_status='pending',
            error_message='',
            synced_at=None
        )
        self.message_user(request, "{} failed items marked for retry.".format(updated))
    
    retry_failed.short_description = "Retry failed items"
