# Bi-Directional Sync System

**Implemented**: 2025-11-05  
**Status**: Production

## 🎯 Purpose

Bi-directional sync keeps member data synchronized between Django (PostgreSQL) and Ekklesia (Firestore). This enables:

- Admins can edit in Django admin → syncs to Ekklesia
- Members can edit in Ekklesia portal → syncs to Django
- All data is always synchronized
- Changes are tracked for auditability

## 🔄 Sync Mechanism

### Delta Sync (Change Tracking)

We use **queue-based delta sync** instead of full sync:

**Advantages:**
- ⚡ Faster - syncs only changes
- 📊 Auditability - history of all changes
- 🔁 Retry logic - can retry if something fails
- 🎯 Targeted - syncs specific fields

**Compared to Full Sync:**
```
Full Sync:    Compare all 5000 members → Update differences
              Time: ~30 seconds, Network: Heavy
              
Delta Sync:   Process only 3 changed members
              Time: ~0.5 seconds, Network: Minimal
```

## 📋 Sync Queue System

### Django → Firestore Queue

**Table**: `membership_membersyncqueue`

```sql
CREATE TABLE membership_membersyncqueue (
    id SERIAL PRIMARY KEY,
    member_id INTEGER REFERENCES membership_comrade(id),
    ssn VARCHAR(10) NOT NULL,
    action VARCHAR(20) NOT NULL,  -- 'create', 'update', 'delete'
    fields_changed JSONB,
    sync_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL,
    synced_at TIMESTAMP NULL,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT NULL
);

CREATE INDEX idx_sync_queue_status ON membership_membersyncqueue(sync_status, created_at);
CREATE INDEX idx_sync_queue_ssn ON membership_membersyncqueue(ssn, created_at);
```

**Example Entry:**
```json
{
  "id": 1,
  "member_id": 12345,
  "ssn": "0101701234",
  "action": "update",
  "fields_changed": {
    "name": "Jón Jónsson",
    "birthday": "1970-01-01"
  },
  "sync_status": "pending",
  "created_at": "2025-11-05T16:18:46Z",
  "synced_at": null,
  "retry_count": 0
}
```

### Firestore → Django Queue

**Collection**: `/sync_queue/{id}`

```javascript
{
  "id": "abc123",
  "kennitala": "0101701234",
  "target": "django",
  "action": "update",
  "changes": {
    "profile.email": "newemail@example.is",
    "profile.phone": "5551234"
  },
  "status": "pending",
  "createdAt": Timestamp,
  "syncedAt": null,
  "retryCount": 0,
  "error": null
}
```

## ⚙️ How It Works

### 1. Change Detection (Django Side)

Django **signals** auto-detect changes:

```python
# signals.py
from django.db.models.signals import post_save, post_delete, pre_delete

@receiver(pre_delete, sender=Comrade)
def store_ssn_before_delete(sender, instance, **kwargs):
    """Store SSN before deletion for sync queue"""
    instance._ssn_to_sync = instance.ssn

@receiver(post_save, sender=Comrade)
def track_member_change(sender, instance, created, **kwargs):
    """Create sync queue entry on member create/update"""
    action = 'create' if created else 'update'
    
    # Determine which fields changed
    fields_changed = {}
    if not created:
        # Track specific field changes
        fields_changed = {
            'name': instance.name,
            'birthday': str(instance.birthday) if instance.birthday else None,
            # ... more fields
        }
    
    MemberSyncQueue.objects.create(
        member=instance,
        ssn=instance.ssn,
        action=action,
        fields_changed=fields_changed,
        sync_status='pending'
    )

@receiver(post_delete, sender=Comrade)
def track_member_deletion(sender, instance, **kwargs):
    """Create sync queue entry on member delete"""
    ssn = getattr(instance, '_ssn_to_sync', None)
    if ssn:
        MemberSyncQueue.objects.create(
            member=None,
            ssn=ssn,
            action='delete',
            fields_changed={'ssn': ssn},
            sync_status='pending'
        )
```

### 2. Change Detection (Firestore Side)

Frontend creates sync queue entries:

```javascript
// member-profile.js
async function saveProfile(memberId, updates) {
  // Update Firestore document
  await updateDoc(doc(db, 'members', memberId), updates);
  
  // Create sync queue entry
  await addDoc(collection(db, 'sync_queue'), {
    kennitala: memberId,
    target: 'django',
    action: 'update',
    changes: updates,
    status: 'pending',
    createdAt: serverTimestamp()
  });
}
```

Optional trigger for additional logging:

```python
# track_member_changes.py (Cloud Function)
def track_firestore_changes(event, context):
    """Track member document changes"""
    kennitala = context.resource.split('/')[-1]
    
    # Compare old vs new values
    old_data = event.data.get('oldValue', {})
    new_data = event.data.get('value', {})
    
    changes = get_changed_fields(old_data, new_data)
    
    # Log to sync_logs for auditing
    db.collection('sync_logs').add({
        'kennitala': kennitala,
        'action': 'update',
        'changes': changes,
        'timestamp': firestore.SERVER_TIMESTAMP
    })
```

### 3. Scheduled Sync

**Cloud Scheduler** triggers sync daily:

```yaml
Job: bidirectional-member-sync
Schedule: "30 3 * * *"  # 3:30 AM daily
Timezone: Atlantic/Reykjavik
Target: https://bidirectional-sync-ymzrguoifa-nw.a.run.app
Method: POST
Auth: OIDC token
```

### 4. Bi-Directional Sync Function

**Function**: `bidirectional_sync` (HTTP trigger)

```python
def bidirectional_sync(request):
    """
    Main sync function - runs in both directions
    """
    # 1. Get authentication token
    token = get_django_api_token()
    
    # 2. Get last sync time (fallback to 24 hours ago)
    since = get_last_sync_time(db)
    
    # Step 1: Firestore → Django
    firestore_changes = get_pending_firestore_changes(since)
    if firestore_changes:
        push_results = push_to_django(db, firestore_changes, token)
    
    # Step 2: Django → Firestore  
    django_changes = get_pending_django_changes(since, token)
    if django_changes:
        pull_results = pull_to_firestore(db, django_changes, token)
    
    # 3. Record sync completion
    create_sync_log(db, {
        'timestamp': datetime.now(timezone.utc),
        'status': 'success',
        'firestore_to_django': push_results,
        'django_to_firestore': pull_results
    })
    
    return {
        'status': 'success',
        'firestore_to_django': push_results,
        'django_to_firestore': pull_results
    }
```

### 5. Sync Execution Details

**Firestore → Django:**

```python
def push_to_django(db, changes, token):
    """Push Firestore changes to Django"""
    url = f"{DJANGO_API_BASE_URL}/api/sync/apply/"
    headers = {
        'Authorization': f'Token {token}',
        'Content-Type': 'application/json'
    }
    
    # Group changes by kennitala
    grouped = {}
    for change in changes:
        kennitala = change['kennitala']
        if kennitala not in grouped:
            grouped[kennitala] = {
                'kennitala': kennitala,
                'action': change['action'],
                'changes': {}
            }
        grouped[kennitala]['changes'].update(change['changes'])
    
    # POST to Django
    response = requests.post(url, json={'changes': list(grouped.values())}, 
                           headers=headers)
    results = response.json()['results']
    
    # Mark as synced
    for result in results:
        if result['status'] == 'success':
            mark_firestore_synced(db, result['sync_queue_id'])
    
    return {'success': success_count, 'failed': failed_count}
```

**Django → Firestore:**

```python
def pull_to_firestore(db, changes, token):
    """Pull Django changes to Firestore"""
    for change in changes:
        kennitala = change['ssn'].replace('-', '')
        member_ref = db.collection('members').document(kennitala)
        
        if change['action'] == 'create':
            # Fetch full member data from Django
            member_data = fetch_member_from_django(kennitala, token)
            member_ref.set(member_data)
            
        elif change['action'] == 'update':
            # Update specific fields
            updates = map_django_fields_to_firestore(change['fields_changed'])
            member_ref.update(updates)
            
        elif change['action'] == 'delete':
            # Soft delete (mark as inactive)
            member_ref.update({'membership.status': 'inactive'})
        
        # Mark Django entry as synced
        mark_django_synced(change['id'], token)
    
    return {'success': success_count, 'failed': failed_count}
```

## 🗺️ Field Mapping

### Django → Firestore

```python
FIELD_MAPPING = {
    # Direct mappings
    'name': 'profile.name',
    'ssn': 'kennitala',
    
    # Date conversions
    'birthday': lambda v: firestore.Timestamp.from_datetime(
        datetime.fromisoformat(v)
    ),
    'date_joined': 'membership.joined',
    
    # Boolean mappings
    'reachable': 'privacy.reachable',
    'groupable': 'privacy.groupable',
    
    # Enum mappings
    'gender': lambda v: ['unknown', 'male', 'female', 'other'][v],
    'housing_situation': lambda v: HOUSING_MAP.get(v, 'unknown')
}
```

### Firestore → Django

```python
REVERSE_MAPPING = {
    'profile.name': 'name',
    'profile.email': lambda v: {'email_address': v},
    'profile.phone': lambda v: {'phone_number': v},
    'profile.address.street': lambda v: {'street_address': v},
    'profile.address.postalcode': lambda v: {'postal_code': v},
    'profile.address.city': lambda v: {'city': v}
}
```

## ⏱️ Sync Timeline

```
3:30 AM - Scheduled trigger
3:30:00 - Get last sync time (2025-11-04T03:30:00)
3:30:01 - Fetch Firestore changes since last sync
3:30:02 - POST to Django /api/sync/apply/ (3 changes)
3:30:03 - Mark Firestore entries as synced
3:30:04 - GET Django /api/sync/changes/ 
3:30:05 - Update Firestore members (5 changes)
3:30:06 - POST Django /api/sync/mark-synced/
3:30:07 - Create sync log entry
3:30:08 - Complete (8 seconds total)
```

## 🔍 Monitoring & Logging

### Django Sync Queue Status

```bash
# Check pending items
curl -H "Authorization: Token <token>" \
  https://starf.sosialistaflokkurinn.is/felagar/api/sync/status/

# Response:
{
  "pending": 4,
  "synced": 120,
  "failed": 2,
  "oldest_pending": "2025-11-05T03:30:00Z"
}
```

### Firestore Sync Logs

Query in Firestore Console:
```
Collection: sync_logs
Order by: timestamp desc
Limit: 10
```

### Cloud Function Logs

```bash
gcloud functions logs read bidirectional_sync \
  --region=europe-west2 \
  --limit=50
```

## 🚨 Error Handling

### Retry Logic

```python
# Django model method
def increment_retry(self):
    self.retry_count += 1
    if self.retry_count >= MAX_RETRIES:
        self.sync_status = 'failed'
    self.save()
```

### Error States

| Status | Description | Action |
|--------|-------------|--------|
| `pending` | Waiting for sync | Will be processed |
| `syncing` | Currently processing | Temporary state |
| `synced` | Successfully synced | Cleanup after 7 days |
| `failed` | Failed after retries | Manual review needed |

### Failure Scenarios

**Scenario 1: Network timeout**
```
Action: Retry up to 3 times with exponential backoff
Logging: Error message in sync queue entry
Alert: Email to admins after 3 failures
```

**Scenario 2: Validation error**
```
Action: Mark as failed immediately (won't retry)
Logging: Validation error details saved
Alert: Admin notification with details
```

**Scenario 3: Conflict (concurrent edits)**
```
Action: Use "last write wins" strategy
Logging: Both versions logged for audit
Alert: None (expected behavior)
```

## 🧪 Testing Sync

### Manual Trigger

```bash
# Trigger immediate sync
curl -X POST https://bidirectional-sync-ymzrguoifa-nw.a.run.app

# Response:
{
  "status": "success",
  "started_at": "2025-11-05T16:30:00Z",
  "completed_at": "2025-11-05T16:30:08Z",
  "duration_seconds": 8,
  "firestore_to_django": {"success": 3, "failed": 0},
  "django_to_firestore": {"success": 5, "failed": 0},
  "last_sync": "2025-11-04T03:30:00Z"
}
```

### Test Workflow

1. **Create test member in Django**
   ```python
   user = Comrade.objects.create(
       ssn='0101701234',
       name='Test User',
       date_joined=timezone.now()
   )
   ```

2. **Verify sync queue entry created**
   ```python
   entry = MemberSyncQueue.objects.filter(ssn='0101701234').first()
   assert entry.action == 'create'
   assert entry.sync_status == 'pending'
   ```

3. **Trigger manual sync**
   ```bash
   curl -X POST https://bidirectional-sync-ymzrguoifa-nw.a.run.app
   ```

4. **Verify Firestore document created**
   ```javascript
   const doc = await getDoc(doc(db, 'members', '0101701234'));
   assert(doc.exists());
   assert(doc.data().name === 'Test User');
   ```

5. **Update in Firestore**
   ```javascript
   await updateDoc(doc(db, 'members', '0101701234'), {
     'profile.email': 'test@example.is'
   });
   await addDoc(collection(db, 'sync_queue'), {
     kennitala: '0101701234',
     target: 'django',
     action: 'update',
     changes: {'profile.email': 'test@example.is'},
     status: 'pending'
   });
   ```

6. **Trigger sync again**
   ```bash
   curl -X POST https://bidirectional-sync-ymzrguoifa-nw.a.run.app
   ```

7. **Verify Django updated**
   ```python
   user.refresh_from_db()
   email = Email.objects.get(comrade=user)
   assert email.email == 'test@example.is'
   ```

## 📊 Performance Metrics

### Current Performance

| Metric | Value | Target |
|--------|-------|--------|
| Sync Duration | 2-8 seconds | < 10 seconds |
| Items per sync | 3-10 | < 100 |
| API Latency | 100-200ms | < 500ms |
| Success Rate | 95% | > 99% |

### Optimization Opportunities

1. **Parallel Processing**: Process multiple members simultaneously
2. **Batch Operations**: Firestore batch writes for multiple updates
3. **Caching**: Cache Django API token between calls
4. **Indexes**: Ensure proper database indexes on sync_status, created_at

## 🔮 Future Enhancements

### Real-Time Sync (Webhooks)

Instead of scheduled sync, trigger immediately on changes:

```
Django → Webhook → Cloud Function → Firestore (instant)
Firestore → Trigger → Cloud Function → Django (instant)
```

### Conflict Resolution

Implement more sophisticated conflict resolution:
- Track modification timestamps
- Allow manual merge for conflicts
- UI for admins to resolve conflicts

### Audit Trail

Enhanced audit logging:
- Who made the change
- What was changed (before/after)
- When it was changed
- Where it was changed (Django vs Ekklesia)

---

**Next**: [DJANGO_BACKEND.md](./DJANGO_BACKEND.md)  
**Back**: [INDEX.md](./INDEX.md)
