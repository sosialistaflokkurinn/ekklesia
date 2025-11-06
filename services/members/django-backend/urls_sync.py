"""
Django URL Configuration for Sync API
Add these URLs to your urlpatterns

File: membership/urls.py (add to existing file)
"""

from django.conf.urls import url
from membership.api_views_sync import (
    get_pending_changes,
    apply_firestore_changes,
    mark_changes_synced,
    sync_status,
    get_member_by_ssn
)

# Add these to your urlpatterns
urlpatterns = [
    # Existing URLs...
    
    # Bi-directional sync endpoints
    url(r'^api/sync/changes/$', get_pending_changes, name='sync_get_changes'),
    url(r'^api/sync/apply/$', apply_firestore_changes, name='sync_apply_changes'),
    url(r'^api/sync/mark-synced/$', mark_changes_synced, name='sync_mark_synced'),
    url(r'^api/sync/status/$', sync_status, name='sync_status'),
    url(r'^api/sync/member/(?P<ssn>[0-9-]+)/$', get_member_by_ssn, name='sync_get_member'),
]
