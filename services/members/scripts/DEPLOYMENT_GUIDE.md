# Bi-Directional Sync Deployment Guide

**Date**: 2025-11-05  
**Purpose**: Guide for deploying bi-directional sync between Django and Firestore

---

## Overview

This deployment enables bi-directional synchronization between Django backend and Firestore:

- **Django → Firestore**: Changes made in Django admin appear in Ekklesia
- **Firestore → Django**: Changes made in Ekklesia appear in Django
- **Scheduled Sync**: Runs automatically at 3:30 AM daily
- **Delta Sync**: Only changed data is synced (efficient)

---

## Architecture

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

## Components

### Django Backend (Linode)

**New Files**:
- `/home/manager/socialism/membership/models_sync.py` - MemberSyncQueue model
- `/home/manager/socialism/membership/signals.py` - Auto-tracking signals
- `/home/manager/socialism/membership/api_views_sync.py` - Sync API endpoints
- `/home/manager/socialism/membership/admin_sync.py` - Admin interface

**API Endpoints**:
- `GET /felagar/api/sync/changes/` - Get pending changes from Django
- `POST /felagar/api/sync/apply/` - Apply Firestore changes to Django
- `POST /felagar/api/sync/mark-synced/` - Mark changes as synced
- `GET /felagar/api/sync/status/` - Get sync queue stats

### Cloud Functions (GCP)

**Functions**:
1. **bidirectional_sync** (HTTP trigger)
   - Syncs changes between Django and Firestore
   - Triggered by Cloud Scheduler at 3:30 AM
   - Can be triggered manually via HTTP

2. **track_member_changes** (Firestore trigger)
   - Tracks changes to `/members/` collection
   - Adds changes to `sync_queue` collection
   - Runs automatically on document write

### Frontend (Firebase Hosting)

**Changes**:
- `member-profile.js` - Updated to add changes to sync queue
- Every field save creates a sync queue entry
- Sync happens on next scheduled run (3:30 AM)

---

## Deployment Steps

### Option 1: Deploy Everything (Recommended)

Run the master deployment script:

```bash
cd /home/gudro/Development/projects/ekklesia/services/members/scripts
./deploy-all-sync.sh
```

This will:
1. Deploy Django backend
2. Deploy Cloud Functions
3. Set up Cloud Scheduler
4. Deploy frontend

---

### Option 2: Deploy Components Separately

#### 1. Deploy Django Backend

```bash
cd /home/gudro/Development/projects/ekklesia/services/members/scripts
./deploy-django-sync.sh
```

**What it does**:
- Backs up existing files
- Uploads new Python files
- Updates Django configuration
- Runs migrations
- Restarts Gunicorn

**Verify**:
```bash
~/django-ssh.sh "systemctl status gunicorn --no-pager | head -20"
```

#### 2. Deploy Cloud Functions

```bash
cd /home/gudro/Development/projects/ekklesia/services/members/scripts
./deploy-cloud-functions.sh
```

**What it does**:
- Deploys `bidirectional_sync` function (HTTP trigger)
- Deploys `track_member_changes` function (Firestore trigger)

**Verify**:
```bash
gcloud functions list --filter="name:sync OR name:track"
```

#### 3. Set up Cloud Scheduler

```bash
cd /home/gudro/Development/projects/ekklesia/services/members/scripts
./setup-scheduler.sh
```

**What it does**:
- Creates scheduler job `bidirectional-member-sync`
- Schedule: 3:30 AM daily (Atlantic/Reykjavik timezone)
- Triggers `bidirectional_sync` function

**Verify**:
```bash
gcloud scheduler jobs describe bidirectional-member-sync --location=europe-west2
```

#### 4. Deploy Frontend

```bash
cd /home/gudro/Development/projects/ekklesia/services/members
firebase deploy --only hosting
```

---

## Testing

### 1. Test Manual Sync

Trigger sync immediately:

```bash
gcloud scheduler jobs run bidirectional-member-sync --location=europe-west2
```

Or trigger function directly:

```bash
FUNCTION_URL=$(gcloud functions describe bidirectional_sync --region=europe-west2 --gen2 --format='value(serviceConfig.uri)')
curl -X POST $FUNCTION_URL
```

### 2. Test Firestore → Django

1. Edit a member in Ekklesia admin:
   - https://ekklesia-prod-10-2025.web.app/admin/member-profile.html?id=999999-9999

2. Check Firestore sync queue:
   - https://console.firebase.google.com/project/ekklesia-prod-10-2025/firestore/data/~2Fsync_queue

3. Run sync manually (see above)

4. Check Django sync queue admin:
   - https://starf.sosialistaflokkurinn.is/admin/membership/membersyncqueue/

### 3. Test Django → Firestore

1. Edit a member in Django admin:
   - https://starf.sosialistaflokkurinn.is/admin/membership/comrade/

2. Check Django sync queue:
   - https://starf.sosialistaflokkurinn.is/admin/membership/membersyncqueue/
   - Should see new entry with `sync_status=pending`

3. Run sync manually (see above)

4. Check Firestore member document:
   - https://console.firebase.google.com/project/ekklesia-prod-10-2025/firestore/data/~2Fmembers

---

## Monitoring

### Cloud Function Logs

View sync logs:

```bash
# Last 50 log entries
gcloud functions logs read bidirectional_sync --region=europe-west2 --gen2 --limit=50

# Follow logs in real-time
gcloud functions logs read bidirectional_sync --region=europe-west2 --gen2 --tail
```

### Django Logs

View Gunicorn logs:

```bash
~/django-ssh.sh "journalctl -u gunicorn -n 100 --no-pager"
```

### Firestore Sync Queue

Check pending sync items:

```bash
# In Firebase Console
https://console.firebase.google.com/project/ekklesia-prod-10-2025/firestore/data/~2Fsync_queue?query=sync_status%3D%3Dpending
```

### Django Sync Queue

Check Django admin:

```bash
https://starf.sosialistaflokkurinn.is/admin/membership/membersyncqueue/?sync_status__exact=pending
```

---

## Troubleshooting

### Issue: Sync not running

**Check scheduler status**:
```bash
gcloud scheduler jobs describe bidirectional-member-sync --location=europe-west2
```

**Check if paused**:
```bash
# Resume if paused
gcloud scheduler jobs resume bidirectional-member-sync --location=europe-west2
```

### Issue: Django API errors

**Check Django logs**:
```bash
~/django-ssh.sh "journalctl -u gunicorn -n 50 --no-pager | grep ERROR"
```

**Test API manually**:
```bash
# Get Django token
TOKEN=$(gcloud secrets versions access latest --secret=django-api-token --project=ekklesia-prod-10-2025)

# Test status endpoint
curl -H "Authorization: Token $TOKEN" \
  https://starf.sosialistaflokkurinn.is/felagar/api/sync/status/
```

### Issue: Firestore trigger not firing

**Check function logs**:
```bash
gcloud functions logs read track_member_changes --region=europe-west2 --gen2 --limit=50
```

**Verify trigger configuration**:
```bash
gcloud functions describe track_member_changes --region=europe-west2 --gen2
```

### Issue: Conflicts in data

Bi-directional sync uses **Last Write Wins** strategy:
- Changes with newer `created_at` timestamp win
- If same field changed in both systems within 1 hour → potential conflict
- Check logs for conflict warnings

**Manual resolution**:
1. Pause scheduler
2. Fix data manually in Django or Firestore
3. Clear sync queues
4. Resume scheduler

---

## Rollback

If issues occur:

### 1. Pause Scheduled Sync

```bash
gcloud scheduler jobs pause bidirectional-member-sync --location=europe-west2
```

### 2. Restore Django Backup

```bash
# List backups
~/django-ssh.sh "ls -lt /home/manager/socialism/membership/backups/ | head -10"

# Restore from backup (replace TIMESTAMP)
~/django-ssh.sh "
  cd /home/manager/socialism/membership
  cp backups/TIMESTAMP/models.py models.py
  cp backups/TIMESTAMP/urls.py urls.py
  cp backups/TIMESTAMP/admin.py admin.py
  systemctl restart gunicorn
"
```

### 3. Re-enable Old Sync

```bash
# Deploy old one-way sync function
cd /home/gudro/Development/projects/ekklesia/services/members/functions
gcloud functions deploy sync_members --runtime=python311 --trigger-http --region=europe-west2
```

---

## Maintenance

### Clean Old Sync Logs

Django sync queue grows over time. Clean old synced items:

```bash
~/django-ssh.sh "
  cd /home/manager/socialism
  source venv/bin/activate
  python manage.py shell << 'EOF'
from membership.models_sync import MemberSyncQueue
deleted = MemberSyncQueue.cleanup_old_synced(days=30)
print(f'Deleted {deleted} old sync items')
EOF
"
```

### Monitor Sync Performance

Check sync duration:

```bash
gcloud functions logs read bidirectional_sync \
  --region=europe-west2 \
  --gen2 \
  --limit=10 \
  --format="table(timestamp, severity, jsonPayload.stats.duration_seconds)"
```

---

## Next Steps

1. **Monitor first few syncs** - Check logs and verify data accuracy
2. **Set up alerts** - Cloud Monitoring alerts for sync failures
3. **Document conflicts** - Track any data conflicts and resolution
4. **Optimize performance** - If sync takes > 5 min, investigate bottlenecks
5. **Add unit tests** - Test Django API endpoints and Cloud Functions

---

## Support

**Documentation**:
- Full design doc: `/docs/architecture/BI_DIRECTIONAL_SYNC_DESIGN.md`
- Django API audit: `/docs/audits/current/DJANGO_API_USAGE_AUDIT_2025-11-05.md`

**Logs**:
- Cloud Functions: `gcloud functions logs read bidirectional_sync`
- Django: `~/django-ssh.sh "journalctl -u gunicorn"`
- Firestore: Firebase Console

**Contacts**:
- Django backend: Ask Django team about models/API
- Cloud Functions: Check GCP logs and function config
- Frontend: Check Firebase Hosting and member-profile.js
