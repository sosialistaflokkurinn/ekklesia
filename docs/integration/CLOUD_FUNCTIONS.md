# Cloud Functions Documentation

**Platform**: Google Cloud Platform (GCP)
**Region**: europe-west2
**Runtime**: Python 3.13
**Last Updated**: November 25, 2025

## 🎯 Overview

Cloud Functions provide serverless compute for the Ekklesia system. They handle:

- **Real-time bidirectional sync** between Django and Firestore (instant, no queues)
- Member profile updates with address sync
- Authentication with Kenni.is
- Address validation with iceaddr

**Current Functions (14 total):**
1. `sync_from_django` - Django → Firestore webhook (NEW)
2. `syncmembers` - Manual full sync
3. `updatememberprofile` - Firestore → Django profile sync
4. `handleKenniAuth` - Kenni.is authentication
5. `verifyMembership` - Membership verification
6. `search_addresses` - Address autocomplete (iceaddr)
7. `validate_address` - Address validation (iceaddr)
8. `validate_postal_code` - Postal code validation (iceaddr)
9. `auditmemberchanges` - Audit logging
10. `cleanupauditlogs` - Audit cleanup
11. `healthz` - Health check
12. `get_django_token` - Django token utility

> **Architecture Change (2025-11-25):** Deleted `bidirectional_sync` and `track_member_changes`.
> Sync now happens instantly via HTTP webhooks instead of scheduled queue processing.
> See [CLOUD_RUN_SERVICES.md](../infrastructure/CLOUD_RUN_SERVICES.md) for details.

## 📦 Function: sync_from_django (NEW)

### Overview

**Type**: HTTP Trigger
**Runtime**: Python 3.13
**Timeout**: 30 seconds
**Memory**: 256MB

**URL**: https://europe-west2-ekklesia-prod-10-2025.cloudfunctions.net/sync_from_django

### Purpose

Real-time webhook called by Django signals for instant Django → Firestore sync.
Replaces the old scheduled `bidirectional_sync` function.

**Request Format:**
```json
{
  "kennitala": "0101701234",
  "action": "create|update|delete",
  "data": { /* serialized member data */ }
}
```

**Code Location:** `services/members/functions/sync_from_django.py`

---

## ~~📦 Function: bidirectional_sync~~ (DELETED)

> ⚠️ **DELETED (2025-11-25)**: Replaced by real-time `sync_from_django` webhook.
> The scheduled queue-based sync is no longer used.

~~**Type**: HTTP Trigger~~
~~**Runtime**: Python 3.11~~
~~**URL**: https://bidirectional-sync-ymzrguoifa-nw.a.run.app~~

~~### Purpose~~

~~Main sync orchestrator that runs bi-directional synchronization:~~
~~1. **Firestore → Django**: Apply member edits from Ekklesia portal to Django~~
~~2. **Django → Firestore**: Pull member changes from Django admin to Firestore~~

### Environment Variables

```bash
DJANGO_API_BASE_URL=https://starf.sosialistaflokkurinn.is/felagar
LOG_EXECUTION_ID=true
```

### Function Code Structure

**File**: `services/members/functions/bidirectional_sync.py`

```python
def bidirectional_sync(request):
    """
    Main sync function - runs in both directions
    
    Flow:
    1. Get Django API token from Secret Manager
    2. Get last sync timestamp
    3. Sync Firestore → Django (push)
    4. Sync Django → Firestore (pull)
    5. Log sync results
    """
    db = firestore.Client()
    token = get_django_api_token()
    since = get_last_sync_time(db)
    
    # Step 1: Firestore → Django
    firestore_changes = get_pending_firestore_changes(db, since)
    if firestore_changes:
        push_results = push_to_django(db, firestore_changes, token)
    
    # Step 2: Django → Firestore
    django_changes = get_pending_django_changes(since, token)
    if django_changes:
        pull_results = pull_to_firestore(db, django_changes, token)
    
    # Log completion
    create_sync_log(db, {
        'completed_at': datetime.now(timezone.utc),
        'status': 'success',
        'firestore_to_django': push_results,
        'django_to_firestore': pull_results
    })
    
    return jsonify(results)
```

### Key Functions

#### 1. get_last_sync_time()

```python
def get_last_sync_time(db: firestore.Client) -> datetime:
    """
    Get timestamp of last successful sync.
    Returns 24 hours ago if no previous sync.
    """
    sync_logs = db.collection('sync_logs') \
        .where('type', '==', 'bidirectional_sync') \
        .where('status', '==', 'success') \
        .order_by('completed_at', direction=firestore.Query.DESCENDING) \
        .limit(1) \
        .stream()
    
    for log in sync_logs:
        return log.to_dict().get('completed_at')
    
    return datetime.now(timezone.utc) - timedelta(hours=24)
```

#### 2. push_to_django()

```python
def push_to_django(db: firestore.Client, changes: list, token: str) -> dict:
    """
    Push Firestore changes to Django API
    
    POST /api/sync/apply/ with changes
    
    Returns:
        {'success': int, 'failed': int}
    """
    url = f"{DJANGO_API_BASE_URL}/api/sync/apply/"
    headers = {
        'Authorization': f'Token {token}',
        'Content-Type': 'application/json'
    }
    
    response = requests.post(url, json={'changes': changes}, headers=headers)
    results = response.json()['results']
    
    # Mark synced in Firestore
    for result in results:
        if result['status'] == 'success':
            db.collection('sync_queue').document(result['sync_queue_id']).update({
                'synced_at': firestore.SERVER_TIMESTAMP,
                'sync_status': 'synced'
            })
    
    return {'success': success_count, 'failed': failed_count}
```

#### 3. pull_to_firestore()

```python
def pull_to_firestore(db: firestore.Client, changes: list, token: str) -> dict:
    """
    Pull Django changes to Firestore
    
    For each change:
    - create: Fetch full member from Django, create Firestore doc
    - update: Update specific fields with field mapping
    - delete: Soft delete (mark as inactive)
    
    Returns:
        {'success': int, 'failed': int}
    """
    for change in changes:
        ssn = change['ssn']
        action = change['action']
        kennitala_key = ssn.replace('-', '')
        member_ref = db.collection('members').document(kennitala_key)
        
        if action == 'create':
            # Fetch full member data from Django
            url = f"{DJANGO_API_BASE_URL}/api/sync/member/{ssn}/"
            response = requests.get(url, headers={'Authorization': f'Token {token}'})
            member_data = response.json()
            
            # Transform and create Firestore document
            firestore_doc = transform_django_to_firestore(member_data)
            member_ref.set(firestore_doc)
            
        elif action == 'update':
            # Map and update specific fields
            updates = map_django_fields_to_firestore(change['fields_changed'])
            member_ref.update(updates)
            
        elif action == 'delete':
            # Soft delete
            if member_ref.get().exists:
                member_ref.update({
                    'membership.status': 'inactive',
                    'metadata.deleted_at': firestore.SERVER_TIMESTAMP
                })
    
    return {'success': success_count, 'failed': failed_count}
```

### Field Mapping

**Django → Firestore:**

```python
FIELD_MAPPINGS = {
    # Direct mappings
    'name': 'profile.name',
    'birthday': 'profile.birthday',  # ISO date string
    
    # Enum mappings
    'gender': lambda v: ['unknown', 'male', 'female', 'other'][v],
    'housing_situation': lambda v: {
        0: 'unknown', 1: 'owner', 2: 'rental',
        3: 'cooperative', 4: 'family', 5: 'other', 6: 'homeless'
    }.get(v, 'unknown'),
    
    # Address mappings
    'street_address': 'profile.address.street',
    'postal_code': 'profile.address.postalcode',
    'city': 'profile.address.city',
    
    # Contact mappings
    'email': 'profile.email',
    'phone': 'profile.phone',
    
    # Boolean mappings
    'reachable': 'privacy.reachable',
    'groupable': 'privacy.groupable'
}
```

### Deployment

```bash
cd services/members/functions

gcloud functions deploy bidirectional_sync \
  --gen2 \
  --runtime=python311 \
  --region=europe-west2 \
  --source=. \
  --entry-point=bidirectional_sync \
  --trigger-http \
  --allow-unauthenticated \
  --timeout=540 \
  --set-env-vars DJANGO_API_BASE_URL=https://starf.sosialistaflokkurinn.is/felagar
```

### Testing

**Manual Trigger:**
```bash
curl -X POST https://bidirectional-sync-ymzrguoifa-nw.a.run.app
```

**Response:**
```json
{
  "completed_at": "2025-11-05T17:45:18.919835+00:00",
  "django_to_firestore": {
    "failed": 0,
    "success": 4
  },
  "duration_seconds": 2.562273,
  "firestore_to_django": {
    "failed": 0,
    "success": 0
  },
  "last_sync": "2025-11-04T17:45:16.434031+00:00",
  "started_at": "2025-11-05T17:45:16.357583+00:00",
  "status": "success"
}
```

### Logs

**View Logs:**
```bash
gcloud functions logs read bidirectional_sync \
  --region=europe-west2 \
  --limit=50
```

**Filter Errors:**
```bash
gcloud functions logs read bidirectional_sync \
  --region=europe-west2 \
  --limit=50 | grep -E "(ERROR|Failed)"
```

## ~~📦 Function: track_member_changes~~ (DELETED)

> ⚠️ **DELETED (2025-11-25)**: No longer needed with real-time sync architecture.
> The sync_queue collection has been removed.

~~### Overview~~

~~**Type**: Firestore Trigger~~
~~**Runtime**: Python 3.11~~
~~**Trigger**: `document.write` on `/members/{memberId}`~~

~~### Purpose~~

~~Logs all changes to member documents in Firestore for auditing purposes.~~

### Function Code

**File**: `services/members/functions/track_member_changes.py`

```python
def track_firestore_changes(event, context):
    """
    Triggered when a member document is written.
    Logs changes to sync_logs collection.
    """
    db = firestore.Client()
    
    # Get document ID (kennitala)
    kennitala = context.resource.split('/')[-1]
    
    # Get old and new values
    old_data = event.data.get('oldValue', {})
    new_data = event.data.get('value', {})
    
    # Determine what changed
    changes = get_changed_fields(old_data, new_data)
    
    # Log to sync_logs
    db.collection('sync_logs').add({
        'kennitala': kennitala,
        'action': 'update',
        'changes': changes,
        'timestamp': firestore.SERVER_TIMESTAMP,
        'type': 'member_change'
    })
    
    log_json('INFO', 'Member change logged', kennitala=kennitala)
```

### Deployment

```bash
gcloud functions deploy track_member_changes \
  --gen2 \
  --runtime=python311 \
  --region=europe-west2 \
  --source=. \
  --entry-point=track_firestore_changes \
  --trigger-event-filters="type=google.cloud.firestore.document.v1.written" \
  --trigger-event-filters="database=(default)" \
  --trigger-event-filters-path-pattern="document=members/{memberId}"
```

## 📦 Other Functions

### syncmembers

**Purpose**: Legacy full sync function  
**Type**: HTTP Trigger  
**Status**: Active but being replaced by `bidirectional_sync`

Performs full sync of all members from Django to Firestore (non-delta).

### updatememberprofile

**Purpose**: Update member profile from Ekklesia portal  
**Type**: HTTP Trigger  

Allows members to update their profile information directly.

### handleKenniAuth

**Purpose**: Authentication with Kenni.is OAuth2  
**Type**: HTTP Trigger  

Handles OAuth2 flow for member login via Kenni.is.

### verifyMembership

**Purpose**: Verify member status  
**Type**: HTTP Trigger  

Checks if a person is an active member.

## ⏰ Cloud Scheduler

> ⚠️ **No longer used (2025-11-25)**: Scheduled sync has been replaced by real-time webhooks.
> Django signals now call Cloud Functions directly for instant sync.

### ~~bidirectional-member-sync Job~~ (REMOVED)

~~**Schedule**: `30 3 * * *` (3:30 AM daily)~~
~~**Timezone**: Atlantic/Reykjavik~~
~~**Target**: bidirectional_sync Cloud Function~~

The scheduled job is no longer needed. Sync now happens instantly when:
- **Django → Firestore**: Django `post_save` signal calls `sync_from_django`
- **Firestore → Django**: User saves profile, `updatememberprofile` calls Django API

## 🔐 Secrets & Authentication

### Django API Token

**Secret Name**: `django-api-token`  
**Project**: ekklesia-prod-10-2025

**Access in Code:**
```python
from google.cloud.secretmanager import SecretManagerServiceClient

def get_django_api_token():
    client = SecretManagerServiceClient()
    project_id = os.getenv('GCP_PROJECT', 'ekklesia-prod-10-2025')
    secret_name = f"projects/{project_id}/secrets/django-api-token/versions/latest"
    
    response = client.access_secret_version(request={"name": secret_name})
    return response.payload.data.decode('UTF-8')
```

**Update Secret:**
```bash
echo -n "new-token-here" | gcloud secrets versions add django-api-token --data-file=-
```

## 📊 Monitoring

### Function Metrics

**View in Console:**
```
https://console.cloud.google.com/functions/details/europe-west2/bidirectional_sync?project=ekklesia-prod-10-2025
```

**Key Metrics:**
- Invocations per day
- Execution time (avg: 2-3 seconds)
- Error rate (target: < 1%)
- Memory usage

### Logs Analysis

**Count Errors:**
```bash
gcloud functions logs read bidirectional_sync \
  --region=europe-west2 \
  --limit=1000 | grep -c ERROR
```

**View Sync Results:**
```bash
gcloud functions logs read bidirectional_sync \
  --region=europe-west2 \
  --limit=10 | grep "Sync completed"
```

## 🔧 Development

### Local Testing

**Setup:**
```bash
cd services/members/functions
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Set Environment:**
```bash
export DJANGO_API_BASE_URL="http://localhost:8000/felagar"
export GCP_PROJECT="ekklesia-prod-10-2025"
```

**Run Tests:**
```bash
pytest tests/
```

### Dependencies

**File**: `requirements.txt`

```txt
google-cloud-firestore==2.11.1
google-cloud-secret-manager==2.16.1
requests==2.31.0
python-dateutil==2.8.2
functions-framework==3.4.0
```

## 🐛 Troubleshooting

### Issue: Function Timeout

**Symptoms**: Function exceeds 540 second timeout

**Solutions:**
- Optimize database queries
- Batch Firestore operations
- Reduce number of API calls
- Implement pagination

### Issue: Authentication Failures

**Symptoms**: `401 Unauthorized` from Django API

**Check:**
```bash
# Verify token in Secret Manager
gcloud secrets versions access latest --secret=django-api-token

# Test token manually
curl -H "Authorization: Token <token>" \
  https://starf.sosialistaflokkurinn.is/felagar/api/sync/status/
```

### Issue: Firestore Permission Denied

**Symptoms**: `Permission denied` when accessing Firestore

**Check Service Account Permissions:**
```bash
gcloud projects get-iam-policy ekklesia-prod-10-2025 \
  --flatten="bindings[].members" \
  --filter="bindings.members:521240388393-compute@developer.gserviceaccount.com"
```

**Required Roles:**
- `roles/datastore.user` - Firestore access
- `roles/secretmanager.secretAccessor` - Secret access

### Issue: Deployment Failures

**Common Causes:**
- Missing `requirements.txt`
- Syntax errors in code
- Wrong runtime version
- Insufficient IAM permissions

**Check Build Logs:**
```bash
gcloud functions logs read bidirectional_sync \
  --region=europe-west2 \
  --limit=50 | grep -i "build"
```

## 📈 Performance Optimization

### Current Performance

| Metric | Value | Target |
|--------|-------|--------|
| Execution Time | 2-3 sec | < 10 sec |
| Memory Usage | ~200 MB | < 512 MB |
| Cold Start | ~1-2 sec | < 3 sec |
| Success Rate | 100% | > 99% |

### Optimization Strategies

1. **Batch Operations**
   ```python
   # Instead of individual updates
   batch = db.batch()
   for doc_ref in refs:
       batch.update(doc_ref, updates)
   batch.commit()
   ```

2. **Parallel Processing**
   ```python
   from concurrent.futures import ThreadPoolExecutor
   
   with ThreadPoolExecutor(max_workers=5) as executor:
       futures = [executor.submit(process_change, c) for c in changes]
   ```

3. **Cache API Token**
   ```python
   _cached_token = None
   _token_expiry = None
   
   def get_django_api_token():
       global _cached_token, _token_expiry
       if _cached_token and _token_expiry > time.time():
           return _cached_token
       # Fetch new token...
   ```

---

**Next**: [FIRESTORE_SCHEMA.md](./FIRESTORE_SCHEMA.md)  
**Back**: [INDEX.md](./INDEX.md)
