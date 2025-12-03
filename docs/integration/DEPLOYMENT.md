# Deployment Guide

**Project**: Ekklesia Member Sync System
**Version**: 2.0
**Last Updated**: November 25, 2025

> ⚠️ **MAJOR UPDATE (2025-11-25)**: Sync architecture changed to real-time webhooks.
>
> **Deleted functions** (do NOT deploy):
> - `bidirectional_sync` → replaced by `sync_from_django`
> - `track_member_changes` → no longer needed
>
> **New functions** (deploy with Firebase CLI):
> - `sync_from_django` - Django → Firestore webhook
> - `search_addresses` - Address autocomplete (iceaddr)
> - `validate_address` - Address validation (iceaddr)
> - `validate_postal_code` - Postal code validation (iceaddr)
>
> **Deploy command**: `firebase deploy --only functions`
>
> See [CLOUD_RUN_SERVICES.md](../infrastructure/CLOUD_RUN_SERVICES.md) for current architecture.

## 🎯 Overview

This guide covers deployment procedures for all components of the sync system:

1. Django Backend (Linode VPS)
2. Cloud Functions (GCP)
3. Firestore Schema & Rules
4. Cloud Scheduler
5. Frontend Portal (Firebase)

**Prerequisites:**
- SSH access to Django server (172.105.71.207)
- GCP project access (ekklesia-prod-10-2025)
- gcloud CLI configured
- Firebase CLI installed

## 🚀 Quick Deploy Checklist

### Pre-Deployment
- [ ] Test changes locally
- [ ] Review code changes
- [ ] Update version numbers
- [ ] Backup databases
- [ ] Notify team of deployment

### Deployment
- [ ] Deploy Django backend
- [ ] Deploy Cloud Functions
- [ ] Update Firestore rules
- [ ] Test sync operations
- [ ] Monitor logs

### Post-Deployment
- [ ] Verify all services running
- [ ] Check sync statistics
- [ ] Review error logs
- [ ] Update documentation
- [ ] Send deployment notification

## 🖥️ Django Backend Deployment

### Server Information

**Host**: 172.105.71.207  
**User**: manager  
**Location**: /home/manager/socialism  
**Service**: gunicorn.service  
**Python**: 3.6 (virtual environment)

### SSH Helper Script

**File**: `~/django-ssh.sh`

```bash
#!/bin/bash
ssh manager@172.105.71.207 "$@"
```

**Usage:**
```bash
chmod +x ~/django-ssh.sh
~/django-ssh.sh "ls -la"
```

### Deployment Steps

#### 1. Backup Current State

```bash
# Backup database
~/django-ssh.sh "cd /home/manager/socialism && \
  source venv/bin/activate && \
  python manage.py dumpdata > backup_$(date +%Y%m%d_%H%M%S).json"

# Backup code
~/django-ssh.sh "cd /home/manager && \
  tar -czf socialism_backup_$(date +%Y%m%d_%H%M%S).tar.gz socialism/"
```

#### 2. Upload Changed Files

**Single File:**
```bash
cd services/members/django-backend

# Upload Python file
cat membership/api_views_sync.py | ~/django-ssh.sh \
  "cat > /home/manager/socialism/membership/api_views_sync.py"

# Upload URLs
cat membership/urls_sync.py | ~/django-ssh.sh \
  "cat > /home/manager/socialism/membership/urls_sync.py"
```

**Multiple Files:**
```bash
# Create tarball locally
tar -czf deploy.tar.gz membership/

# Upload and extract
cat deploy.tar.gz | ~/django-ssh.sh \
  "cd /home/manager/socialism && tar -xzf -"
```

#### 3. Run Migrations

```bash
~/django-ssh.sh "cd /home/manager/socialism && \
  source venv/bin/activate && \
  python manage.py makemigrations && \
  python manage.py migrate"
```

**Expected Output:**
```
No changes detected
# or
Migrations for 'membership':
  membership/migrations/0003_auto_20251105.py
    - Add field xyz to comrade
```

#### 4. Collect Static Files

```bash
~/django-ssh.sh "cd /home/manager/socialism && \
  source venv/bin/activate && \
  python manage.py collectstatic --noinput"
```

#### 5. Restart Gunicorn

```bash
~/django-ssh.sh "sudo systemctl restart gunicorn"
```

#### 6. Verify Service Status

```bash
~/django-ssh.sh "sudo systemctl status gunicorn"
```

**Expected Output:**
```
● gunicorn.service - gunicorn daemon
   Loaded: loaded (/etc/systemd/system/gunicorn.service; enabled)
   Active: active (running) since Wed 2025-11-05 17:45:06 UTC
 Main PID: 28976
   CGroup: /system.slice/gunicorn.service
           ├─28976 /home/manager/socialism/venv/bin/python3
           ├─28988 /home/manager/socialism/venv/bin/python3
           ├─28989 /home/manager/socialism/venv/bin/python3
           └─28990 /home/manager/socialism/venv/bin/python3
```

#### 7. Test Endpoints

```bash
# Get API token
TOKEN=$(gcloud secrets versions access latest --secret=django-api-token)

# Test status endpoint
curl -H "Authorization: Token $TOKEN" \
  https://starf.sosialistaflokkurinn.is/felagar/api/sync/status/

# Expected: JSON response with sync statistics
```

### Rollback Procedure

If deployment fails:

```bash
# 1. Restore from backup
~/django-ssh.sh "cd /home/manager && \
  tar -xzf socialism_backup_YYYYMMDD_HHMMSS.tar.gz"

# 2. Restore database (if needed)
~/django-ssh.sh "cd /home/manager/socialism && \
  source venv/bin/activate && \
  python manage.py loaddata backup_YYYYMMDD_HHMMSS.json"

# 3. Restart service
~/django-ssh.sh "sudo systemctl restart gunicorn"
```

### Common Issues

#### Issue: Gunicorn Won't Start

**Check logs:**
```bash
~/django-ssh.sh "sudo journalctl -u gunicorn -n 50"
```

**Common causes:**
- Syntax error in Python files
- Missing dependencies
- Port already in use
- Permission issues

**Solution:**
```bash
# Fix syntax errors, then
~/django-ssh.sh "sudo systemctl restart gunicorn"
```

#### Issue: 500 Internal Server Error

**Check Django logs:**
```bash
~/django-ssh.sh "tail -f /home/manager/socialism/logs/django.log"
```

**Common causes:**
- Missing imports
- Database connection issues
- Incorrect settings

#### Issue: Import Errors

**Check Python path:**
```bash
~/django-ssh.sh "cd /home/manager/socialism && \
  source venv/bin/activate && \
  python manage.py shell"
```

```python
# In shell
import membership.models_sync
# Should succeed without errors
```

## ☁️ Cloud Functions Deployment

### Prerequisites

```bash
# Authenticate with GCP
gcloud auth login

# Set project
gcloud config set project ekklesia-prod-10-2025

# Enable required APIs (if not already enabled)
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

### Deployment Steps

#### 1. Navigate to Functions Directory

```bash
cd services/members/functions
```

#### 2. Verify Files

```bash
ls -la
```

**Required files:**
- `main.py` or `bidirectional_sync.py` (entry point)
- `requirements.txt` (dependencies)

**requirements.txt:**
```txt
google-cloud-firestore==2.11.1
google-cloud-secret-manager==2.16.1
requests==2.31.0
python-dateutil==2.8.2
functions-framework==3.4.0
```

#### ~~3. Deploy bidirectional_sync~~ (DELETED - DO NOT USE)

> ⚠️ **DELETED**: Use `firebase deploy --only functions:sync_from_django` instead.

~~```bash
gcloud functions deploy bidirectional_sync \
  --gen2 \
  --runtime=python311 \
  --region=europe-west2 \
  --source=. \
  --entry-point=bidirectional_sync \
  --trigger-http \
  --allow-unauthenticated \
  --timeout=540 \
  --memory=512MB \
  --set-env-vars DJANGO_API_BASE_URL=https://starf.sosialistaflokkurinn.is/felagar
```

**Expected Output:**
```
Deploying function (may take a while - up to 2 minutes)...done.
availableMemoryMb: 512
buildId: abc123def456
buildName: projects/.../builds/...
entryPoint: bidirectional_sync
httpsTrigger:
  url: https://bidirectional-sync-ymzrguoifa-nw.a.run.app
```

#### 4. Test Deployment

```bash
# Manual trigger
curl -X POST https://bidirectional-sync-ymzrguoifa-nw.a.run.app

# Expected: JSON response with sync results
```

#### ~~5. Deploy track_member_changes~~ (DELETED - DO NOT USE)

> ⚠️ **DELETED**: This function is no longer needed. Real-time sync replaces it.

~~```bash
gcloud functions deploy track_member_changes \
  --gen2 \
  --runtime=python311 \
  --region=europe-west2 \
  --source=. \
  --entry-point=track_firestore_changes \
  --trigger-event-filters="type=google.cloud.firestore.document.v1.written" \
  --trigger-event-filters="database=(default)" \
  --trigger-event-filters-path-pattern="document=members/{memberId}" \
  --timeout=60 \
  --memory=256MB
```

#### 6. Verify Deployments

```bash
# List all functions
gcloud functions list --region=europe-west2

# Get function details
gcloud functions describe bidirectional_sync --region=europe-west2
```

### View Logs

```bash
# Recent logs
gcloud functions logs read bidirectional_sync \
  --region=europe-west2 \
  --limit=50

# Follow logs in real-time
gcloud functions logs read bidirectional_sync \
  --region=europe-west2 \
  --limit=50 \
  --follow

# Filter errors
gcloud functions logs read bidirectional_sync \
  --region=europe-west2 \
  --limit=50 | grep -E "(ERROR|Failed)"
```

### Rollback

```bash
# List revisions
gcloud functions describe bidirectional_sync \
  --region=europe-west2 \
  --format="value(updateTime,version)"

# Deploy specific revision (if needed)
gcloud functions deploy bidirectional_sync \
  --gen2 \
  --region=europe-west2 \
  --source=gs://gcf-v2-sources-.../source.zip
```

### Common Issues

#### Issue: Build Failures

**Check build logs:**
```bash
gcloud builds list --filter="status=FAILURE" --limit=5
```

**Common causes:**
- Syntax errors in Python code
- Missing dependencies in requirements.txt
- Invalid function signature

#### Issue: Function Timeout

**Increase timeout:**
```bash
gcloud functions deploy bidirectional_sync \
  --timeout=900  # Max 9 minutes for Gen2
```

#### Issue: Memory Exceeded

**Increase memory:**
```bash
gcloud functions deploy bidirectional_sync \
  --memory=1024MB  # or 2048MB
```

## 🔥 Firestore Deployment

### Deploy Security Rules

#### 1. Edit Rules File

**File**: `firestore.rules`

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Your rules here
  }
}
```

#### 2. Deploy Rules

```bash
firebase deploy --only firestore:rules
```

**Expected Output:**
```
=== Deploying to 'ekklesia-prod-10-2025'...

i  firestore: checking firestore.rules for compilation errors...
✔  firestore: rules file firestore.rules compiled successfully

i  firestore: uploading rules firestore.rules...
✔  firestore: released rules firestore.rules to cloud.firestore

✔  Deploy complete!
```

#### 3. Test Rules

```bash
firebase emulators:start --only firestore
```

### Deploy Indexes

#### 1. Edit Indexes File

**File**: `firestore.indexes.json`

```json
{
  "indexes": [
    {
      "collectionGroup": "members",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "membership.status", "order": "ASCENDING" },
        { "fieldPath": "profile.name", "order": "ASCENDING" }
      ]
    }
  ]
}
```

#### 2. Deploy Indexes

```bash
firebase deploy --only firestore:indexes
```

**Expected Output:**
```
=== Deploying to 'ekklesia-prod-10-2025'...

i  firestore: reading indexes from firestore.indexes.json...
i  firestore: uploading indexes...
✔  firestore: released indexes

✔  Deploy complete!
```

#### 3. Monitor Index Creation

```bash
# Check index status in console
open "https://console.firebase.google.com/project/ekklesia-prod-10-2025/firestore/indexes"
```

**Note**: Index creation can take several minutes for large collections.

## ⏰ Cloud Scheduler Deployment

### Create/Update Scheduler Job

```bash
gcloud scheduler jobs create http bidirectional-member-sync \
  --location=europe-west2 \
  --schedule="30 3 * * *" \
  --time-zone="Atlantic/Reykjavik" \
  --uri="https://bidirectional-sync-ymzrguoifa-nw.a.run.app" \
  --http-method=POST \
  --oidc-service-account-email="521240388393-compute@developer.gserviceaccount.com"
```

### Update Existing Job

```bash
gcloud scheduler jobs update http bidirectional-member-sync \
  --location=europe-west2 \
  --schedule="30 3 * * *"
```

### Test Scheduler Job

```bash
# Trigger manually
gcloud scheduler jobs run bidirectional-member-sync \
  --location=europe-west2

# Check logs
gcloud functions logs read bidirectional_sync \
  --region=europe-west2 \
  --limit=10
```

### Pause/Resume Scheduler

```bash
# Pause
gcloud scheduler jobs pause bidirectional-member-sync \
  --location=europe-west2

# Resume
gcloud scheduler jobs resume bidirectional-member-sync \
  --location=europe-west2
```

## 🔐 Secrets Management

### Update Django API Token

```bash
# Create new token in Django
TOKEN="your-new-token-here"

# Update in Secret Manager
echo -n "$TOKEN" | gcloud secrets versions add django-api-token \
  --data-file=-

# Verify
gcloud secrets versions access latest --secret=django-api-token
```

### Grant Access to Service Account

```bash
# Allow Cloud Functions to access secret
gcloud secrets add-iam-policy-binding django-api-token \
  --member="serviceAccount:521240388393-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## 🌐 Frontend Portal Deployment

### Build and Deploy

```bash
cd apps/members-portal

# Install dependencies
npm install

# Build production bundle
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

### Deploy Functions (if any)

```bash
firebase deploy --only functions
```

### Preview Before Deploy

```bash
firebase hosting:channel:deploy preview
```

## 🧪 Post-Deployment Testing

### Full System Test

```bash
# 1. Check Django service
~/django-ssh.sh "sudo systemctl status gunicorn"

# 2. Test Django API
TOKEN=$(gcloud secrets versions access latest --secret=django-api-token)
curl -H "Authorization: Token $TOKEN" \
  https://starf.sosialistaflokkurinn.is/felagar/api/sync/status/

# 3. Test Cloud Function
curl -X POST https://bidirectional-sync-ymzrguoifa-nw.a.run.app

# 4. Check sync queue status
~/django-ssh.sh "cd /home/manager/socialism && \
  source venv/bin/activate && \
  python manage.py shell << 'EOF'
from membership.models_sync import MemberSyncQueue
pending = MemberSyncQueue.objects.filter(sync_status='pending').count()
synced = MemberSyncQueue.objects.filter(sync_status='synced').count()
failed = MemberSyncQueue.objects.filter(sync_status='failed').count()
print(f'Pending: {pending}, Synced: {synced}, Failed: {failed}')
EOF"

# 5. Check Cloud Function logs
gcloud functions logs read bidirectional_sync \
  --region=europe-west2 \
  --limit=10
```

### Create Test Member Flow

```bash
# 1. Create test member in Django admin
# Visit: https://starf.sosialistaflokkurinn.is/felagar/admin/

# 2. Wait for signal to create sync queue entry
sleep 2

# 3. Trigger sync
curl -X POST https://bidirectional-sync-ymzrguoifa-nw.a.run.app

# 4. Verify in Firestore
# Visit: https://console.firebase.google.com/project/ekklesia-prod-10-2025/firestore
```

## 📊 Monitoring & Alerts

### Key Metrics to Monitor

**Django:**
- Service uptime
- Response times
- Error rates
- Queue size

**Cloud Functions:**
- Execution count
- Error rate
- Execution time
- Memory usage

**Firestore:**
- Document reads/writes
- Storage size
- Query performance

### Set Up Alerts

```bash
# Create alert for function errors
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Cloud Function Errors" \
  --condition-display-name="Error rate > 5%" \
  --condition-threshold-value=0.05 \
  --condition-threshold-duration=300s
```

### Check Current Status

```bash
# Django service
~/django-ssh.sh "sudo systemctl status gunicorn"

# Cloud Functions
gcloud functions list --region=europe-west2

# Firestore
gcloud firestore operations list

# Scheduler
gcloud scheduler jobs list --location=europe-west2
```

## 🔄 Continuous Deployment

### GitHub Actions Workflow

**File**: `.github/workflows/deploy.yml`

```yaml
name: Deploy Ekklesia Sync

on:
  push:
    branches: [main]
    paths:
      - 'services/members/**'

jobs:
  deploy-django:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Django
        env:
          SSH_KEY: ${{ secrets.DJANGO_SSH_KEY }}
        run: |
          echo "$SSH_KEY" > key.pem
          chmod 600 key.pem
          scp -i key.pem -r services/members/django-backend/* \
            manager@172.105.71.207:/home/manager/socialism/
          ssh -i key.pem manager@172.105.71.207 \
            "sudo systemctl restart gunicorn"
  
  deploy-functions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      
      - name: Deploy Cloud Functions
        run: |
          cd services/members/functions
          gcloud functions deploy bidirectional_sync \
            --gen2 \
            --runtime=python311 \
            --region=europe-west2 \
            --source=. \
            --entry-point=bidirectional_sync \
            --trigger-http \
            --allow-unauthenticated
```

## 📝 Deployment Checklist

### Pre-Deployment
- [ ] Code reviewed and approved
- [ ] Tests passing
- [ ] Documentation updated
- [ ] Database backup completed
- [ ] Deployment window scheduled
- [ ] Team notified

### Django Deployment
- [ ] Upload changed files
- [ ] Run migrations
- [ ] Collect static files
- [ ] Restart gunicorn
- [ ] Verify service status
- [ ] Test API endpoints

### Cloud Functions Deployment
- [ ] Deploy functions
- [ ] Verify deployment
- [ ] Test function execution
- [ ] Check logs for errors
- [ ] Update scheduler if needed

### Firestore Deployment
- [ ] Deploy security rules
- [ ] Deploy indexes
- [ ] Wait for index creation
- [ ] Test queries

### Post-Deployment
- [ ] Run full system test
- [ ] Monitor logs for 15 minutes
- [ ] Check error rates
- [ ] Verify sync operations
- [ ] Update deployment log
- [ ] Notify team of completion

## 🚨 Emergency Procedures

### Complete System Rollback

```bash
# 1. Rollback Django
~/django-ssh.sh "cd /home/manager && \
  tar -xzf socialism_backup_LATEST.tar.gz && \
  sudo systemctl restart gunicorn"

# 2. Rollback Cloud Functions
gcloud functions deploy bidirectional_sync \
  --gen2 \
  --region=europe-west2 \
  --source=gs://PREVIOUS_SOURCE_PATH

# 3. Pause scheduler
gcloud scheduler jobs pause bidirectional-member-sync \
  --location=europe-west2

# 4. Investigate and fix
# Review logs, identify issue, prepare fix

# 5. Resume operations
gcloud scheduler jobs resume bidirectional-member-sync \
  --location=europe-west2
```

### Contact Information

**System Administrator**: [Your contact info]  
**On-Call**: [On-call rotation]  
**Emergency**: [Emergency contact]

---

**Back**: [INDEX.md](./INDEX.md)
**System Status**: [CURRENT_DEVELOPMENT_STATUS.md](../status/CURRENT_DEVELOPMENT_STATUS.md)
