# Django Backend Documentation

**Status**: Production  
**Last Updated**: November 25, 2025

## 🎯 Overview

The Django backend is a legacy membership system that serves as the source of truth for member data. It provides:

- PostgreSQL database with member records
- REST API for sync operations
- Admin interface for member management
- Automatic change tracking via signals

**Technology Stack:**
- Django 2.2.3
- Python 3.6
- PostgreSQL 11+
- Django REST Framework
- Gunicorn WSGI server

## 📊 Database Models

### Core Model: Comrade

Main member model in `membership/models.py`:

```python
class Comrade(models.Model):
    ssn = models.CharField(max_length=10, unique=True)  # 10-digit format
    name = models.CharField(max_length=255)
    birthday = models.DateField(null=True, blank=True)
    gender = models.IntegerField(default=0)  # 0=unknown, 1=male, 2=female, 3=other
    housing_situation = models.IntegerField(default=0)  # 0=unknown, 1-6=various
    date_joined = models.DateTimeField(auto_now_add=True)
    reachable = models.BooleanField(default=False)
    groupable = models.BooleanField(default=False)
```

**Field Details:**

| Field | Type | Description | Notes |
|-------|------|-------------|-------|
| `ssn` | CharField(10) | Kennitala without dash | Format: `0101701234` |
| `name` | CharField(255) | Full name | |
| `birthday` | DateField | Birth date | ISO format: YYYY-MM-DD |
| `gender` | Integer | Gender enum | 0-3 values |
| `housing_situation` | Integer | Housing enum | 0-6 values |
| `date_joined` | DateTimeField | Membership date | Auto-set on creation |
| `reachable` | Boolean | Contact permission | Default: False |
| `groupable` | Boolean | Group assignment OK | Default: False |

**Enums:**

```python
# Gender
GENDER_CHOICES = (
    (0, 'Unknown'),
    (1, 'Male'),
    (2, 'Female'),
    (3, 'Other')
)

# Housing Situation
HOUSING_CHOICES = (
    (0, 'Unknown'),
    (1, 'Owner'),
    (2, 'Rental'),
    (3, 'Cooperative'),
    (4, 'Family'),
    (5, 'Other'),
    (6, 'Homeless')
)
```

### Sync Model: MemberSyncQueue

Change tracking model in `membership/models_sync.py`:

```python
class MemberSyncQueue(models.Model):
    member = models.ForeignKey(Comrade, null=True, on_delete=models.SET_NULL)
    ssn = models.CharField(max_length=10)
    action = models.CharField(max_length=20)  # 'create', 'update', 'delete'
    fields_changed = JSONField(default=dict)
    sync_status = models.CharField(max_length=20, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    synced_at = models.DateTimeField(null=True, blank=True)
    retry_count = models.IntegerField(default=0)
    error_message = models.TextField(blank=True, null=True)
```

**Indexes:**
```sql
CREATE INDEX idx_sync_queue_status ON membership_membersyncqueue(sync_status, created_at);
CREATE INDEX idx_sync_queue_ssn ON membership_membersyncqueue(ssn, created_at);
```

**Model Methods:**

```python
def mark_synced(self):
    """Mark this entry as successfully synced"""
    self.sync_status = 'synced'
    self.synced_at = timezone.now()
    self.save()

def mark_failed(self, error_msg):
    """Mark as failed with error message"""
    self.sync_status = 'failed'
    self.error_message = error_msg
    self.retry_count += 1
    self.save()

@classmethod
def get_pending_changes(cls, since=None):
    """Get all pending changes since timestamp"""
    qs = cls.objects.filter(sync_status='pending')
    if since:
        qs = qs.filter(created_at__gt=since)
    return qs.order_by('created_at')
```

### Related Models

**Email** (`communication/models.py`):
```python
class Email(models.Model):
    comrade = models.ForeignKey(Comrade, on_delete=models.CASCADE)
    email = models.EmailField()
    is_primary = models.BooleanField(default=True)
```

**ContactInfo** (`membership/models.py`):
```python
class ContactInfo(models.Model):
    comrade = models.OneToOneField(Comrade, primary_key=True, on_delete=models.CASCADE)
    phone = models.CharField(max_length=32, blank=True)
    email = models.CharField(max_length=124, blank=True)
    facebook = models.CharField(max_length=255, blank=True)
    foreign_phone = models.CharField(max_length=32, blank=True)
```

**SimpleAddress** (`membership/models.py`):
```python
class SimpleAddress(models.Model):
    comrade = models.OneToOneField(Comrade, on_delete=models.CASCADE)  # ✅ OneToOne, not ForeignKey
    street_address = models.CharField(max_length=255, blank=True)
    postal_code = models.CharField(max_length=10, blank=True)
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    raw_address = models.CharField(max_length=500, blank=True)
    address = models.ForeignKey('map.Address', null=True, blank=True, on_delete=models.SET_NULL)
```

## 🔔 Signal Handlers

Automatic change tracking in `membership/signals.py`:

### Pre-Delete Signal

```python
@receiver(pre_delete, sender=Comrade)
def store_member_ssn_before_delete(sender, instance, **kwargs):
    """Store SSN before deletion for sync tracking"""
    _member_ssn_before_delete[instance.pk] = instance.ssn
```

**Purpose**: Save SSN before Django deletes the object (can't access after deletion)

### Post-Save Signal

```python
@receiver(post_save, sender=Comrade)
def track_member_changes_on_save(sender, instance, created, **kwargs):
    """Track create/update operations"""
    action = 'create' if created else 'update'
    
    fields_changed = {}
    if not created:
        fields_changed = {
            'name': instance.name,
            'birthday': instance.birthday.isoformat() if instance.birthday else None,
            'gender': instance.gender,
            'housing_situation': instance.housing_situation,
        }
    
    MemberSyncQueue.objects.create(
        member=instance,
        ssn=instance.ssn,
        action=action,
        fields_changed=fields_changed
    )
```

**Triggers:**
- New member created → `action='create'`
- Existing member updated → `action='update'` with changed fields

### Post-Delete Signal

```python
@receiver(post_delete, sender=Comrade)
def track_member_deletion(sender, instance, **kwargs):
    """Track deletion operations"""
    ssn = _member_ssn_before_delete.pop(instance.pk, instance.ssn)
    
    MemberSyncQueue.objects.create(
        member=None,
        ssn=ssn,
        action='delete',
        fields_changed={'ssn': ssn}
    )
```

**Triggers:** Member deleted → `action='delete'`

### Signal Registration

Signals are loaded via AppConfig in `membership/apps.py`:

```python
class MembershipConfig(AppConfig):
    name = 'membership'
    
    def ready(self):
        """Import signals when app is ready"""
        import membership.signals
```

**Why AppConfig.ready()?**
- Prevents circular imports
- Ensures signals load after app registry initialization
- Django 2.2 compatible pattern

## 🌐 REST API Endpoints

All endpoints require authentication via Django REST Framework Token:

```bash
Authorization: Token <your-token-here>
```

### 1. Get Pending Changes

**Endpoint**: `GET /api/sync/changes/`

**Query Parameters:**
- `since` (optional): ISO timestamp, only return changes after this time

**Request:**
```bash
curl -H "Authorization: Token <token>" \
  "https://starf.sosialistaflokkurinn.is/felagar/api/sync/changes/?since=2025-11-04T00:00:00Z"
```

**Response:**
```json
{
  "changes": [
    {
      "id": 1,
      "ssn": "0101701234",
      "action": "update",
      "fields_changed": {
        "name": "Jón Jónsson",
        "birthday": "1970-01-01"
      },
      "created_at": "2025-11-05T15:30:00Z"
    }
  ]
}
```

**Implementation** (`membership/api_views_sync.py`):
```python
@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAdminUser])
def get_pending_changes(request):
    since_param = request.GET.get('since')
    since = None
    if since_param:
        since = parse_datetime(since_param)
    
    queryset = MemberSyncQueue.get_pending_changes(since=since)
    
    changes = []
    for item in queryset:
        changes.append({
            'id': item.id,
            'ssn': item.ssn,
            'action': item.action,
            'fields_changed': item.fields_changed,
            'created_at': item.created_at.isoformat()
        })
    
    return Response({'changes': changes})
```

### 2. Apply Firestore Changes

**Endpoint**: `POST /api/sync/apply/`

**Purpose**: Apply changes from Firestore to Django

**Request:**
```json
{
  "changes": [
    {
      "kennitala": "0101701234",
      "action": "update",
      "changes": {
        "profile.email": "new@example.is",
        "profile.phone": "5551234"
      }
    }
  ]
}
```

**Response:**
```json
{
  "results": [
    {
      "ssn": "0101701234",
      "status": "success"
    }
  ]
}
```

**Field Mappings:**
```python
FIRESTORE_TO_DJANGO = {
    'profile.email': 'email',  # Updates Email model
    'profile.phone': 'phone',  # Updates ContactInfo model
    'profile.name': 'name',    # Updates Comrade model
    'profile.address.street': 'street_address',  # Updates SimpleAddress
    'profile.address.postalcode': 'postal_code',
    'profile.address.city': 'city'
}
```

### 3. Mark Changes as Synced

**Endpoint**: `POST /api/sync/mark-synced/`

**Purpose**: Mark sync queue entries as successfully synced

**Request:**
```json
{
  "sync_ids": [1, 2, 3]
}
```

**Response:**
```json
{
  "marked": 3
}
```

**Implementation:**
```python
@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAdminUser])
def mark_changes_synced(request):
    sync_ids = request.data.get('sync_ids', [])
    
    updated = MemberSyncQueue.objects.filter(
        id__in=sync_ids
    ).update(
        sync_status='synced',
        synced_at=timezone.now()
    )
    
    return Response({'marked': updated})
```

### 4. Get Sync Status

**Endpoint**: `GET /api/sync/status/`

**Purpose**: Get queue statistics

**Request:**
```bash
curl -H "Authorization: Token <token>" \
  https://starf.sosialistaflokkurinn.is/felagar/api/sync/status/
```

**Response:**
```json
{
  "pending": 2,
  "synced": 150,
  "failed": 0,
  "oldest_pending": "2025-11-05T15:30:00Z"
}
```

### 5. Get Member by SSN

**Endpoint**: `GET /api/sync/member/<ssn>/`

**Purpose**: Fetch full member data for sync

**Request:**
```bash
curl -H "Authorization: Token <token>" \
  https://starf.sosialistaflokkurinn.is/felagar/api/sync/member/0101701234/
```

**Response:**
```json
{
  "ssn": "0101701234",
  "name": "Jón Jónsson",
  "birthday": "1970-01-01",
  "gender": 1,
  "housing_situation": 2,
  "reachable": true,
  "groupable": false,
  "date_joined": "2019-01-06T16:43:47Z",
  "email": "jon@example.is",
  "phone": "5551234",
  "street_address": "Dæmigata 1",
  "postal_code": "101",
  "city": "Reykjavík"
}
```

## 🔧 Configuration

### URL Configuration

Add to `membership/urls.py`:

```python
from django.conf.urls import url, include

urlpatterns = [
    # Include sync URLs
    url(r'', include('membership.urls_sync')),
]
```

### Settings

**ALLOWED_HOSTS** (`socialism/settings.py`):
```python
ALLOWED_HOSTS = [
    'starf.sosialistaflokkurinn.is',
    'felagakerfi.piratar.is',
]
```

**INSTALLED_APPS**:
```python
INSTALLED_APPS = [
    'django.contrib.postgres',  # For JSONField
    'rest_framework',
    'rest_framework.authtoken',
    'membership',
    'communication',
]
```

**REST_FRAMEWORK**:
```python
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}
```

## 🚀 Deployment

### Server Information

- **Host**: 172.105.71.207 (Linode)
- **User**: manager
- **Path**: /home/manager/socialism/
- **Virtualenv**: /home/manager/socialism/venv/
- **Service**: gunicorn.service

### Deployment Process

1. **Backup Current Code:**
```bash
~/django-ssh.sh "cd /home/manager/socialism && \
  cp membership/api_views_sync.py membership/api_views_sync.py.backup-$(date +%Y%m%d-%H%M%S)"
```

2. **Upload Files:**
```bash
cd services/members/django-backend
cat api_views_sync.py | ~/django-ssh.sh "cat > /home/manager/socialism/membership/api_views_sync.py"
cat urls_sync.py | ~/django-ssh.sh "cat > /home/manager/socialism/membership/urls_sync.py"
cat signals.py | ~/django-ssh.sh "cat > /home/manager/socialism/membership/signals.py"
```

3. **Run Migrations (if needed):**
```bash
~/django-ssh.sh "cd /home/manager/socialism && \
  source venv/bin/activate && \
  python manage.py makemigrations && \
  python manage.py migrate"
```

4. **Restart Service:**
```bash
~/django-ssh.sh "sudo systemctl restart gunicorn"
```

5. **Verify:**
```bash
~/django-ssh.sh "sudo systemctl status gunicorn --no-pager | head -15"
```

### Service Management

**Check Status:**
```bash
~/django-ssh.sh "systemctl status gunicorn"
```

**View Logs:**
```bash
~/django-ssh.sh "tail -f /home/manager/log/gunicorn/error.log"
```

**Restart:**
```bash
~/django-ssh.sh "sudo systemctl restart gunicorn"
```

## 💻 Local Development Environment

A complete local mirror of the Django production system is available for testing changes before deployment and deep exploration of the legacy system.

### Location

```
/home/gudro/Development/projects/django/
```

### Containers

Two Podman containers are used for local development:

| Container | Purpose | Port |
|-----------|---------|------|
| `socialism-db` | PostGIS database | 5434 |
| `django-local` | Django development server | 8000 |

### Quick Start

```bash
# Start database container
podman start socialism-db

# Start Django server
cd /home/gudro/Development/projects/django
./run_local.sh
```

### Access Points

- **Admin**: http://localhost:8000/admin/
- **API**: http://localhost:8000/api/

### Database Refresh

To update local database from production:

```bash
# Dump from production
ssh root@172.105.71.207 "PGPASSWORD='Vladimir Ilyich Ulyanov' pg_dump -U socialism -h localhost socialism" > socialism_dump.sql

# Import to local container
PGPASSWORD='Vladimir Ilyich Ulyanov' psql -h localhost -p 5434 -U socialism -d socialism -f socialism_dump.sql
```

### Sync Changes to Production

```bash
rsync -avz --exclude='*.pyc' --exclude='__pycache__' \
  /home/gudro/Development/projects/django/ \
  root@172.105.71.207:/home/manager/socialism/
```

### Important Notes

- **Legacy System**: Django 2.2.3 with Python 3.6 - do NOT upgrade without testing
- **GIS**: Uses PostGIS for geographic member locations and cell boundaries
- **Language**: Icelandic UI (Félagar = Members, Sellur = Cells)
- **Admin Optimization**: ComradeAdmin uses `get_queryset()` with `select_related`/`prefetch_related` to prevent N+1 queries

### Project Documentation

See `.claude/settings.json` and `CLAUDE.md` in the local Django directory for detailed quirks and configuration.

## 🧪 Testing

### Test Signal Tracking

```python
# Django shell
python manage.py shell

from membership.models import Comrade
from membership.models_sync import MemberSyncQueue

# Create test member
member = Comrade.objects.create(
    ssn='0101701234',
    name='Test User',
    birthday='1970-01-01'
)

# Check sync queue
entries = MemberSyncQueue.objects.filter(ssn='0101701234')
print(f'Created {entries.count()} sync entries')

# Update member
member.name = 'Updated Name'
member.save()

# Check queue again
entries = MemberSyncQueue.objects.filter(ssn='0101701234')
print(f'Now have {entries.count()} entries')
```

### Test API Endpoints

```bash
# Get auth token from Secret Manager
TOKEN=$(gcloud secrets versions access latest \
  --secret=django-api-token \
  --project=ekklesia-prod-10-2025)

# Test status endpoint
curl -H "Authorization: Token $TOKEN" \
  https://starf.sosialistaflokkurinn.is/felagar/api/sync/status/

# Test pending changes
curl -H "Authorization: Token $TOKEN" \
  "https://starf.sosialistaflokkurinn.is/felagar/api/sync/changes/?since=2025-11-04T00:00:00Z"
```

## 🔍 Troubleshooting

### Issue: Signals Not Firing

**Symptoms**: No sync queue entries created when members change

**Check:**
```python
# Verify signals are loaded
python manage.py shell
from membership import signals
print(signals)  # Should show the module
```

**Fix**: Ensure `membership/apps.py` has `ready()` method

### Issue: Import Errors

**Symptoms**: `ImportError: cannot import name 'X'`

**Common Causes:**
- Wrong model import (Phone/Address vs ContactInfo/SimpleAddress)
- Missing model in related app

**Fix**: Check model actually exists:
```python
from django.apps import apps
models = apps.get_app_config('membership').get_models()
for model in models:
    print(model.__name__)
```

### Issue: 500 Errors on API

**Check Logs:**
```bash
~/django-ssh.sh "tail -50 /home/manager/log/gunicorn/error.log"
```

**Common Issues:**
- Missing authentication token
- Wrong URL (check ALLOWED_HOSTS)
- Database connection issues

### Issue: Migrations Not Applied

**Check:**
```bash
~/django-ssh.sh "cd /home/manager/socialism && \
  source venv/bin/activate && \
  python manage.py showmigrations membership"
```

**Apply:**
```bash
~/django-ssh.sh "cd /home/manager/socialism && \
  source venv/bin/activate && \
  python manage.py migrate"
```

## 📊 Monitoring

### Queue Statistics

```python
from membership.models_sync import MemberSyncQueue

print(f"Pending: {MemberSyncQueue.objects.filter(sync_status='pending').count()}")
print(f"Synced: {MemberSyncQueue.objects.filter(sync_status='synced').count()}")
print(f"Failed: {MemberSyncQueue.objects.filter(sync_status='failed').count()}")
```

### Performance Metrics

```python
from django.db.models import Avg, Count
from datetime import timedelta
from django.utils import timezone

# Average time to sync
recent = timezone.now() - timedelta(hours=24)
stats = MemberSyncQueue.objects.filter(
    synced_at__gte=recent
).aggregate(
    count=Count('id'),
    avg_time=Avg('synced_at') - Avg('created_at')
)
```

---

**Next**: [CLOUD_FUNCTIONS.md](./CLOUD_FUNCTIONS.md)  
**Back**: [INDEX.md](./INDEX.md)
