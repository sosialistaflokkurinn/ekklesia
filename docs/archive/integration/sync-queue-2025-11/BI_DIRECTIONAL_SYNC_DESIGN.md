# Bi-Directional Sync Design - Django ↔ Firestore

> ⚠️ **DEPRECATED (2025-11-25)**: This design was **implemented but then replaced** by real-time sync.
>
> **What changed:**
> - The queue-based approach was replaced with instant HTTP webhooks
> - Django signals call `sync_from_django` Cloud Function directly
> - No scheduled 3:30 AM sync - changes sync instantly
> - Deleted: `bidirectional_sync.py`, `track_member_changes.py`, `sync_queue` collection
>
> **See instead:** [CLOUD_RUN_SERVICES.md](../infrastructure/CLOUD_RUN_SERVICES.md) for current architecture.

**Date**: 2025-11-05
**Status**: ~~🚧 DESIGN PHASE~~ **ARCHIVED - Replaced by Real-Time Sync**
**Epic**: Bi-Directional Member Data Sync

---

## Problem Statement

**Current Issues**:
- One-way sync only (Django → Firestore)
- Member edits in Ekklesia are overwritten on next sync
- Full sync of all members is inefficient (~15 min for 1200 members)
- No real-time updates
- Data divergence between systems

**Goal**: Implement efficient bi-directional sync that:
- Preserves edits made in both systems
- Only syncs changed data (delta sync)
- Runs automatically at 3:30 AM daily
- Handles conflicts gracefully

---

## Architecture Overview

```
┌─────────────────────┐         ┌─────────────────────┐
│   Django Backend    │         │   Firestore DB      │
│  (Source of Truth)  │◄───────►│  (Fast Queries)     │
└─────────────────────┘         └─────────────────────┘
         │                               │
         │                               │
    ┌────▼─────┐                    ┌───▼────┐
    │ Changes  │                    │Changes │
    │  Queue   │                    │ Queue  │
    └──────────┘                    └────────┘
         │                               │
         │      Scheduled Sync           │
         │      (3:30 AM Daily)          │
         └───────────┬───────────────────┘
                     │
              ┌──────▼──────┐
              │  Sync Cloud │
              │  Function   │
              └─────────────┘
```

---

## Data Flow

### 1. Member Edited in Ekklesia (Firestore)

**Trigger**: User edits profile in members portal

```javascript
// When field is saved in member-profile.js
async function saveField(fieldName, value, statusElement) {
  // 1. Update Firestore
  await updateDoc(memberDocRef, {
    [`profile.${fieldName}`]: value,
    updated_at: new Date()
  });
  
  // 2. Add to sync queue
  await addToSyncQueue(memberData.kennitala, {
    action: 'update',
    collection: 'members',
    docId: memberData.kennitala,
    field: `profile.${fieldName}`,
    value: value,
    timestamp: new Date()
  });
}
```

**Firestore Structure**:
```
/sync_queue/{auto-id}
  - source: "firestore"
  - target: "django"
  - kennitala: "999999-9999"
  - django_id: 3584
  - action: "update"
  - changes: {
      "profile.email": "new@email.is",
      "profile.phone": "555-1234"
    }
  - created_at: Timestamp
  - synced_at: null
  - sync_status: "pending"
```

---

### 2. Member Edited in Django

**Trigger**: Admin edits member in Django admin or via API

```python
# Django: Override save() to track changes
class Member(models.Model):
    # ... fields ...
    
    def save(self, *args, **kwargs):
        # Track what changed
        if self.pk:  # Existing member (update)
            old_obj = Member.objects.get(pk=self.pk)
            changed_fields = {}
            
            for field in ['name', 'email', 'phone', 'birthday', 'gender']:
                old_val = getattr(old_obj, field)
                new_val = getattr(self, field)
                if old_val != new_val:
                    changed_fields[field] = new_val
            
            if changed_fields:
                MemberSyncQueue.objects.create(
                    member=self,
                    action='update',
                    fields_changed=changed_fields
                )
        else:  # New member (create)
            MemberSyncQueue.objects.create(
                member=self,
                action='create',
                fields_changed={}
            )
        
        super().save(*args, **kwargs)
```

---

### 3. Scheduled Sync (3:30 AM Daily)

**Cloud Scheduler** → **Cloud Function: `bidirectional_sync`**

```python
def bidirectional_sync(request):
    """
    Bi-directional sync: Django ↔ Firestore
    Runs daily at 3:30 AM
    """
    
    # Step 1: Push Firestore changes to Django
    firestore_changes = get_pending_firestore_changes()
    push_to_django(firestore_changes)
    
    # Step 2: Pull Django changes to Firestore
    django_changes = get_pending_django_changes()
    pull_to_firestore(django_changes)
    
    # Step 3: Log sync results
    log_sync_results(stats)
    
    return {'success': True, 'stats': stats}
```

---

## Implementation Plan

### Phase 1: Django Backend Changes (Week 1)

**Django Developer Tasks**:

1. **Create MemberSyncQueue Model**
   ```python
   # felagar/models.py
   class MemberSyncQueue(models.Model):
       member = models.ForeignKey(Member, on_delete=models.CASCADE)
       action = models.CharField(max_length=20)  # 'create', 'update', 'delete'
       fields_changed = models.JSONField(default=dict)
       created_at = models.DateTimeField(auto_now_add=True)
       synced_at = models.DateTimeField(null=True, blank=True)
       sync_status = models.CharField(max_length=20, default='pending')
       error_message = models.TextField(blank=True)
   ```

2. **Add Signal Handlers for Change Tracking**
   ```python
   # felagar/signals.py
   from django.db.models.signals import post_save, post_delete
   from django.dispatch import receiver
   
   @receiver(post_save, sender=Member)
   def track_member_changes(sender, instance, created, **kwargs):
       action = 'create' if created else 'update'
       
       # Get changed fields (requires django-dirtyfields or similar)
       if not created and hasattr(instance, 'get_dirty_fields'):
           changed_fields = instance.get_dirty_fields()
       else:
           changed_fields = {}
       
       MemberSyncQueue.objects.create(
           member=instance,
           action=action,
           fields_changed=changed_fields
       )
   
   @receiver(post_delete, sender=Member)
   def track_member_deletion(sender, instance, **kwargs):
       MemberSyncQueue.objects.create(
           member=None,  # Already deleted
           action='delete',
           fields_changed={'ssn': instance.ssn}
       )
   ```

3. **Create Sync API Endpoints**
   ```python
   # felagar/api/sync.py
   from rest_framework.decorators import api_view
   from rest_framework.response import Response
   
   @api_view(['GET'])
   def get_pending_changes(request):
       """Get changes since last sync"""
       since = request.GET.get('since')  # ISO timestamp
       
       query = MemberSyncQueue.objects.filter(synced_at__isnull=True)
       if since:
           query = query.filter(created_at__gt=since)
       
       changes = []
       for item in query:
           changes.append({
               'id': item.id,
               'ssn': item.member.ssn if item.member else None,
               'action': item.action,
               'fields_changed': item.fields_changed,
               'created_at': item.created_at.isoformat()
           })
       
       return Response({'changes': changes})
   
   @api_view(['POST'])
   def apply_firestore_changes(request):
       """Apply changes from Firestore to Django"""
       changes = request.data.get('changes', [])
       
       results = []
       for change in changes:
           try:
               ssn = change['kennitala']
               member = Member.objects.get(ssn=ssn)
               
               # Apply field changes
               for field, value in change['changes'].items():
                   # Map Firestore paths to Django fields
                   if field.startswith('profile.'):
                       django_field = field.replace('profile.', '')
                       setattr(member, django_field, value)
               
               member.save()
               results.append({'ssn': ssn, 'status': 'success'})
           
           except Member.DoesNotExist:
               results.append({'ssn': ssn, 'status': 'error', 'message': 'Member not found'})
           except Exception as e:
               results.append({'ssn': ssn, 'status': 'error', 'message': str(e)})
       
       return Response({'results': results})
   
   @api_view(['POST'])
   def mark_synced(request):
       """Mark changes as synced"""
       sync_ids = request.data.get('sync_ids', [])
       
       MemberSyncQueue.objects.filter(id__in=sync_ids).update(
           synced_at=timezone.now(),
           sync_status='synced'
       )
       
       return Response({'success': True})
   ```

4. **Update URLs**
   ```python
   # felagar/urls.py
   urlpatterns = [
       path('api/sync/changes/', get_pending_changes),
       path('api/sync/apply/', apply_firestore_changes),
       path('api/sync/mark-synced/', mark_synced),
   ]
   ```

---

### Phase 2: Firestore Change Tracking (Week 1)

**Cloud Function Tasks**:

1. **Create Firestore Trigger for Change Tracking**
   ```python
   # functions/track_firestore_changes.py
   from google.cloud import firestore
   
   def on_member_update(change, context):
       """
       Firestore Trigger: Track changes to /members/ collection
       Triggered on: Create, Update, Delete
       """
       
       db = firestore.Client()
       
       # Get old and new values
       old_values = change.before.to_dict() if change.before.exists else {}
       new_values = change.after.to_dict() if change.after.exists else {}
       
       # Determine action
       if not change.before.exists:
           action = 'create'
           changed_fields = new_values
       elif not change.after.exists:
           action = 'delete'
           changed_fields = old_values
       else:
           action = 'update'
           changed_fields = get_changed_fields(old_values, new_values)
       
       if not changed_fields:
           return  # No changes
       
       # Add to sync queue
       db.collection('sync_queue').add({
           'source': 'firestore',
           'target': 'django',
           'collection': 'members',
           'docId': context.resource.split('/')[-1],
           'kennitala': new_values.get('profile', {}).get('kennitala') or old_values.get('profile', {}).get('kennitala'),
           'django_id': new_values.get('metadata', {}).get('django_id') or old_values.get('metadata', {}).get('django_id'),
           'action': action,
           'changes': changed_fields,
           'created_at': firestore.SERVER_TIMESTAMP,
           'synced_at': None,
           'sync_status': 'pending'
       })
   
   def get_changed_fields(old_values, new_values):
       """Compare old and new values, return only changed fields"""
       changes = {}
       
       # Check profile fields
       old_profile = old_values.get('profile', {})
       new_profile = new_values.get('profile', {})
       
       for field in ['name', 'email', 'phone', 'birthday', 'gender', 'facebook']:
           if old_profile.get(field) != new_profile.get(field):
               changes[f'profile.{field}'] = new_profile.get(field)
       
       # Check address fields
       old_address = old_values.get('address', {})
       new_address = new_values.get('address', {})
       
       for field in ['street', 'postal_code', 'city']:
           if old_address.get(field) != new_address.get(field):
               changes[f'address.{field}'] = new_address.get(field)
       
       return changes
   ```

2. **Deploy Firestore Trigger**
   ```bash
   gcloud functions deploy track_member_changes \
     --runtime python311 \
     --trigger-event providers/cloud.firestore/eventTypes/document.write \
     --trigger-resource "projects/ekklesia-prod-10-2025/databases/(default)/documents/members/{memberId}"
   ```

---

### Phase 3: Bi-Directional Sync Function (Week 2)

**File**: `/services/members/functions/bidirectional_sync.py`

```python
"""
Bi-Directional Sync: Django ↔ Firestore
Runs daily at 3:30 AM via Cloud Scheduler
"""

import requests
from datetime import datetime, timezone, timedelta
from google.cloud import firestore
from utils_logging import log_json

DJANGO_API_BASE_URL = "https://starf.sosialistaflokkurinn.is/felagar"


def get_last_sync_time(db: firestore.Client) -> datetime:
    """Get timestamp of last successful sync"""
    sync_logs = db.collection('sync_logs') \
        .where('type', '==', 'bidirectional_sync') \
        .where('status', '==', 'success') \
        .order_by('completed_at', direction=firestore.Query.DESCENDING) \
        .limit(1) \
        .stream()
    
    for log in sync_logs:
        return log.to_dict()['completed_at']
    
    # Default: 24 hours ago
    return datetime.now(timezone.utc) - timedelta(hours=24)


def get_pending_firestore_changes(db: firestore.Client, since: datetime):
    """Get changes from Firestore sync queue"""
    query = db.collection('sync_queue') \
        .where('source', '==', 'firestore') \
        .where('target', '==', 'django') \
        .where('sync_status', '==', 'pending') \
        .where('created_at', '>', since) \
        .stream()
    
    changes = []
    for doc in query:
        data = doc.to_dict()
        data['sync_queue_id'] = doc.id
        changes.append(data)
    
    return changes


def push_to_django(db: firestore.Client, changes: list, token: str):
    """
    Push Firestore changes to Django
    
    POST /api/sync/apply/
    {
        "changes": [
            {
                "kennitala": "999999-9999",
                "django_id": 3584,
                "action": "update",
                "changes": {
                    "profile.email": "new@email.is"
                }
            }
        ]
    }
    """
    
    if not changes:
        log_json('INFO', 'No Firestore changes to push', count=0)
        return {'success': 0, 'failed': 0}
    
    url = f"{DJANGO_API_BASE_URL}/api/sync/apply/"
    headers = {
        'Authorization': f'Token {token}',
        'Content-Type': 'application/json'
    }
    
    # Group changes by kennitala (merge multiple field updates)
    grouped = {}
    for change in changes:
        kennitala = change['kennitala']
        if kennitala not in grouped:
            grouped[kennitala] = {
                'kennitala': kennitala,
                'django_id': change.get('django_id'),
                'action': change['action'],
                'changes': {}
            }
        
        # Merge field changes
        grouped[kennitala]['changes'].update(change['changes'])
    
    payload = {'changes': list(grouped.values())}
    
    log_json('INFO', 'Pushing to Django', url=url, count=len(grouped))
    
    response = requests.post(url, json=payload, headers=headers, timeout=60)
    response.raise_for_status()
    
    results = response.json()['results']
    
    # Mark synced in Firestore
    synced_ids = []
    failed_ids = []
    
    for i, result in enumerate(results):
        sync_queue_id = changes[i]['sync_queue_id']
        
        if result['status'] == 'success':
            synced_ids.append(sync_queue_id)
        else:
            failed_ids.append(sync_queue_id)
            log_json('ERROR', 'Django sync failed', 
                     kennitala=result.get('ssn'),
                     error=result.get('message'))
    
    # Update sync queue status
    for sync_id in synced_ids:
        db.collection('sync_queue').document(sync_id).update({
            'synced_at': firestore.SERVER_TIMESTAMP,
            'sync_status': 'synced'
        })
    
    for sync_id in failed_ids:
        db.collection('sync_queue').document(sync_id).update({
            'sync_status': 'failed',
            'error_message': 'Django sync failed'
        })
    
    return {'success': len(synced_ids), 'failed': len(failed_ids)}


def get_pending_django_changes(since: datetime, token: str):
    """
    Get changes from Django sync queue
    
    GET /api/sync/changes/?since=2025-11-05T03:30:00Z
    """
    
    url = f"{DJANGO_API_BASE_URL}/api/sync/changes/"
    headers = {'Authorization': f'Token {token}'}
    params = {'since': since.isoformat()}
    
    log_json('INFO', 'Fetching Django changes', url=url, since=since.isoformat())
    
    response = requests.get(url, headers=headers, params=params, timeout=30)
    response.raise_for_status()
    
    data = response.json()
    return data['changes']


def pull_to_firestore(db: firestore.Client, changes: list, token: str):
    """
    Pull Django changes to Firestore
    """
    
    if not changes:
        log_json('INFO', 'No Django changes to pull', count=0)
        return {'success': 0, 'failed': 0}
    
    stats = {'success': 0, 'failed': 0}
    sync_ids_to_mark = []
    
    for change in changes:
        try:
            ssn = change['ssn']
            action = change['action']
            
            # Normalize kennitala for Firestore doc ID
            kennitala_key = ssn.replace('-', '') if '-' in ssn else ssn
            member_ref = db.collection('members').document(kennitala_key)
            
            if action == 'create':
                # New member - fetch full data from Django
                member_data = fetch_full_member_from_django(ssn, token)
                member_ref.set(member_data)
            
            elif action == 'update':
                # Update specific fields
                updates = {}
                for field, value in change['fields_changed'].items():
                    # Map Django fields to Firestore paths
                    if field in ['name', 'email', 'phone', 'birthday', 'gender']:
                        updates[f'profile.{field}'] = value
                    elif field in ['street', 'postal_code', 'city']:
                        updates[f'address.{field}'] = value
                
                updates['metadata.last_modified'] = firestore.SERVER_TIMESTAMP
                member_ref.update(updates)
            
            elif action == 'delete':
                # Soft delete (mark as inactive)
                member_ref.update({
                    'membership.status': 'inactive',
                    'metadata.deleted_at': firestore.SERVER_TIMESTAMP
                })
            
            stats['success'] += 1
            sync_ids_to_mark.append(change['id'])
            
            log_json('INFO', 'Django change applied', 
                     kennitala=ssn, action=action)
        
        except Exception as e:
            stats['failed'] += 1
            log_json('ERROR', 'Failed to apply Django change',
                     kennitala=change.get('ssn'),
                     error=str(e))
    
    # Mark synced in Django
    if sync_ids_to_mark:
        mark_django_changes_synced(sync_ids_to_mark, token)
    
    return stats


def mark_django_changes_synced(sync_ids: list, token: str):
    """Mark Django sync queue items as synced"""
    url = f"{DJANGO_API_BASE_URL}/api/sync/mark-synced/"
    headers = {
        'Authorization': f'Token {token}',
        'Content-Type': 'application/json'
    }
    payload = {'sync_ids': sync_ids}
    
    response = requests.post(url, json=payload, headers=headers, timeout=30)
    response.raise_for_status()


def bidirectional_sync(request):
    """
    Main bi-directional sync function
    Triggered by Cloud Scheduler at 3:30 AM daily
    """
    
    db = firestore.Client()
    token = get_django_api_token()
    
    started_at = datetime.now(timezone.utc)
    last_sync = get_last_sync_time(db)
    
    log_json('INFO', 'Bi-directional sync started',
             event='bidirectional_sync_started',
             last_sync=last_sync.isoformat(),
             started_at=started_at.isoformat())
    
    stats = {
        'started_at': started_at.isoformat(),
        'last_sync': last_sync.isoformat(),
        'firestore_to_django': {},
        'django_to_firestore': {}
    }
    
    try:
        # Step 1: Push Firestore changes to Django
        firestore_changes = get_pending_firestore_changes(db, last_sync)
        stats['firestore_to_django'] = push_to_django(db, firestore_changes, token)
        
        # Step 2: Pull Django changes to Firestore
        django_changes = get_pending_django_changes(last_sync, token)
        stats['django_to_firestore'] = pull_to_firestore(db, django_changes, token)
        
        stats['completed_at'] = datetime.now(timezone.utc).isoformat()
        stats['status'] = 'success'
        
        log_json('INFO', 'Bi-directional sync completed',
                 event='bidirectional_sync_completed',
                 stats=stats)
    
    except Exception as e:
        stats['completed_at'] = datetime.now(timezone.utc).isoformat()
        stats['status'] = 'failed'
        stats['error'] = str(e)
        
        log_json('ERROR', 'Bi-directional sync failed',
                 event='bidirectional_sync_failed',
                 error=str(e))
    
    # Log sync results
    db.collection('sync_logs').add({
        'type': 'bidirectional_sync',
        'stats': stats,
        'created_at': firestore.SERVER_TIMESTAMP
    })
    
    return ({'stats': stats}, 200)
```

---

### Phase 4: Cloud Scheduler Setup (Week 2)

**Create Scheduler Job**:

```bash
# Create Cloud Scheduler job to run at 3:30 AM Iceland time (GMT)
gcloud scheduler jobs create http bidirectional-member-sync \
  --location=europe-west2 \
  --schedule="30 3 * * *" \
  --time-zone="Atlantic/Reykjavik" \
  --uri="https://europe-west2-ekklesia-prod-10-2025.cloudfunctions.net/bidirectional_sync" \
  --http-method=POST \
  --oidc-service-account-email="ekklesia-sync@ekklesia-prod-10-2025.iam.gserviceaccount.com"
```

**Test Manually**:
```bash
gcloud scheduler jobs run bidirectional-member-sync --location=europe-west2
```

---

### Phase 5: Frontend Updates (Week 2)

**Update member-profile.js to use sync queue**:

```javascript
// Add change to sync queue after saving
async function saveField(fieldName, value, statusElement) {
  try {
    // 1. Update Firestore
    await updateDoc(memberDocRef, {
      [`profile.${fieldName}`]: value,
      updated_at: new Date()
    });
    
    // 2. Add to sync queue for Django
    await addDoc(collection(db, 'sync_queue'), {
      source: 'firestore',
      target: 'django',
      collection: 'members',
      docId: memberData.kennitala,
      kennitala: memberData.kennitala,
      django_id: memberData.metadata?.django_id,
      action: 'update',
      changes: {
        [`profile.${fieldName}`]: value
      },
      created_at: new Date(),
      synced_at: null,
      sync_status: 'pending'
    });
    
    showStatus(statusElement, 'success');
    
  } catch (error) {
    debug.error('Error saving field:', error);
    showStatus(statusElement, 'error');
  }
}
```

---

## Conflict Resolution Strategy

### Priority Rules:

1. **Last Write Wins** (default)
   - Compare `updated_at` timestamps
   - Most recent change wins

2. **Field-Level Merging**
   - If different fields changed in both systems, merge both
   - Example: Django changed email, Firestore changed phone → keep both

3. **Manual Review for Conflicts**
   - If same field changed in both systems within sync window
   - Log conflict, notify admin
   - Admin resolves via UI

**Conflict Detection**:
```python
def detect_conflict(django_change, firestore_change):
    """
    Check if same field changed in both systems
    """
    django_fields = set(django_change['fields_changed'].keys())
    firestore_fields = set(firestore_change['changes'].keys())
    
    conflicting_fields = django_fields & firestore_fields
    
    if conflicting_fields:
        # Compare timestamps
        django_time = django_change['created_at']
        firestore_time = firestore_change['created_at']
        
        if abs((django_time - firestore_time).total_seconds()) < 3600:
            # Changes within 1 hour - potential conflict
            return {
                'conflict': True,
                'fields': list(conflicting_fields),
                'django_time': django_time,
                'firestore_time': firestore_time
            }
    
    return {'conflict': False}
```

---

## Testing Plan

### Unit Tests

1. **Test Change Tracking**
   - Edit member in Django → verify sync queue entry created
   - Edit member in Firestore → verify sync queue entry created

2. **Test Sync Functions**
   - Mock Django API responses
   - Verify Firestore updates
   - Test error handling

3. **Test Conflict Resolution**
   - Create conflicting changes
   - Verify last write wins
   - Verify field-level merging

### Integration Tests

1. **End-to-End Sync**
   - Edit in Django → verify appears in Firestore
   - Edit in Firestore → verify appears in Django
   - Test round-trip (edit both ways)

2. **Performance Testing**
   - 100 changes → verify sync time < 5 min
   - 1000 changes → verify sync time < 30 min

3. **Error Scenarios**
   - Django API down → verify retry logic
   - Firestore unavailable → verify error handling
   - Network timeout → verify partial sync recovery

---

## Monitoring & Alerts

### Cloud Monitoring Metrics

1. **Sync Success Rate**
   - Target: > 99%
   - Alert if < 95%

2. **Sync Duration**
   - Target: < 5 minutes
   - Alert if > 10 minutes

3. **Conflict Count**
   - Target: < 10 per day
   - Alert if > 50 per day

4. **Failed Changes**
   - Target: 0
   - Alert on any failures

### Logs to Monitor

```
# Sync started
bidirectional_sync_started

# Changes pushed/pulled
firestore_to_django: {success: X, failed: Y}
django_to_firestore: {success: X, failed: Y}

# Conflicts detected
conflict_detected: {kennitala, fields, resolution}

# Sync completed
bidirectional_sync_completed: {duration_seconds, total_changes}
```

---

## Rollout Plan

### Week 1: Django Backend
- ✅ Create MemberSyncQueue model
- ✅ Add signal handlers
- ✅ Create sync API endpoints
- ✅ Test in Django development environment

### Week 2: Firestore + Cloud Functions
- ✅ Deploy Firestore trigger for change tracking
- ✅ Implement bidirectional_sync function
- ✅ Set up Cloud Scheduler
- ✅ Test with staging data

### Week 3: Frontend Updates
- ✅ Update member-profile.js to use sync queue
- ✅ Add sync status UI
- ✅ Test in staging environment

### Week 4: Production Rollout
- ✅ Deploy to production
- ✅ Monitor sync runs
- ✅ Address any issues
- ✅ Document for team

---

## Rollback Plan

If issues occur:

1. **Disable scheduled sync**
   ```bash
   gcloud scheduler jobs pause bidirectional-member-sync --location=europe-west2
   ```

2. **Fall back to old one-way sync**
   ```bash
   # Re-enable old sync_members function
   gcloud functions deploy sync_members --trigger-http
   ```

3. **Clear sync queues**
   ```python
   # Clear pending changes
   db.collection('sync_queue').where('sync_status', '==', 'pending').delete()
   ```

---

## Success Criteria

- ✅ Edits in Ekklesia appear in Django within 24 hours
- ✅ Edits in Django appear in Ekklesia within 24 hours
- ✅ No data loss during sync
- ✅ Conflicts handled gracefully
- ✅ Sync completes in < 5 minutes
- ✅ 99% sync success rate

---

## Next Steps

1. **Django Developer**: Implement MemberSyncQueue + API endpoints
2. **Cloud Functions**: Implement bidirectional_sync function
3. **Frontend**: Update member-profile.js to use sync queue
4. **DevOps**: Set up Cloud Scheduler
5. **Testing**: End-to-end integration testing
6. **Documentation**: Update operational runbooks

---

**Status**: 🚧 Awaiting Django backend implementation  
**Estimated Completion**: 4 weeks from start  
**Assigned To**: TBD
