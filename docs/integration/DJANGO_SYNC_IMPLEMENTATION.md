# Django → Ekklesia Weekly Sync Implementation

# ⚠️ DEPRECATED
**This document is outdated. Please refer to [Epic #43 Member Management System](../features/election-voting/EPIC_43_MEMBER_MANAGEMENT_SYSTEM.md) for the current implementation.**

**Document Type**: Technical Implementation Guide
**Last Updated**: 2025-10-15
**Status**: 📋 Planned - Phase 5 (Dec 2025)
**Purpose**: Automated weekly sync of member kennitalas from Django to Ekklesia

---

## Overview

This document describes the implementation of **automatic weekly synchronization** of member kennitalas from the legacy Django system to Ekklesia's Firebase Storage.

### Goals

1. **Eliminate manual work**: Replace manual export/upload process
2. **Keep data fresh**: Sync weekly to ensure Ekklesia has current member list
3. **Audit trail**: Log all sync operations for troubleshooting
4. **Fail gracefully**: Alert on errors, don't break production

### Non-Goals

- **Two-way sync**: This is one-way only (Django → Ekklesia)
- **Real-time sync**: Weekly schedule is sufficient for member list updates
- **Full data migration**: Only kennitalas are synced (not profiles, payments, etc.)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Weekly Sync Flow                              │
└─────────────────────────────────────────────────────────────────┘

   Monday 3 AM                Django API              Cloud Function
   Iceland time               (Linode)                (GCP)
        │
        │
        ▼
   ┌─────────────┐
   │   Cloud     │
   │  Scheduler  │──────────┐
   └─────────────┘          │
                            │ Trigger (Pub/Sub)
                            │
                            ▼
                    ┌────────────────┐
                    │ Cloud Function │
                    │ syncMemberList │
                    └────────┬───────┘
                             │
                             │ HTTP GET
                             │ Authorization: Token <secret>
                             │
                             ▼
                    ┌─────────────────────┐
                    │ Django REST API     │
                    │ /api/members/       │
                    │  kennitalas/        │──────┐
                    └─────────────────────┘      │
                             │                   │
                             │ Query DB          │
                             │                   │
                             ▼                   │
                    ┌─────────────────────┐      │
                    │   PostgreSQL        │      │
                    │   membership_       │      │
                    │   comrade (2216)    │      │
                    └─────────────────────┘      │
                             │                   │
                             │                   │
                             ▼                   │
                    JSON Response               │
                    {                            │
                      "count": 2216,             │
                      "kennitalas": [...]        │
                    }                            │
                             │                   │
                             │                   │
                             ▼                   │
                    ┌────────────────┐           │
                    │ Cloud Function │           │
                    │  - Parse JSON  │           │
                    │  - Upload to   │           │
                    │    Storage     │           │
                    │  - Log audit   │           │
                    └────────┬───────┘           │
                             │                   │
                             │                   │
                             ▼                   │
                    ┌─────────────────────┐      │
                    │ Firebase Storage    │      │
                    │ kennitalas.txt      │      │
                    │ (2216 lines)        │      │
                    └─────────────────────┘      │
                             │                   │
                             │                   │
                             ▼                   │
                    ┌─────────────────────┐      │
                    │   Firestore         │      │
                    │   sync_audit        │◄─────┘
                    │   collection        │  Log success/error
                    └─────────────────────┘
```

---

## Implementation Steps

### Step 1: Create Django REST API Endpoint

**File**: `/home/manager/socialism/membership/views.py`

#### Add Import Statements

```python
# Add to existing imports at top of file
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
```

#### Add View Function

```python
# Add at the end of the file

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_kennitalas(request):
    """
    Export active member kennitalas (SSNs) for Ekklesia sync.

    Requires: Token authentication
    Returns: JSON with count and array of kennitalas

    Example:
        GET /api/members/kennitalas/
        Authorization: Token abc123...

        Response:
        {
            "count": 2216,
            "kennitalas": ["0101012980", "0101765069", ...],
            "exported_at": "2025-10-15T03:00:00Z"
        }
    """
    kennitalas = Comrade.objects.all().values_list('ssn', flat=True).order_by('ssn')

    return Response({
        'count': len(kennitalas),
        'kennitalas': list(kennitalas),
        'exported_at': timezone.now().isoformat()
    })
```

#### Update URL Configuration

**File**: `/home/manager/socialism/membership/urls.py`

```python
# Add to existing urlpatterns
urlpatterns = [
    # ... existing patterns ...
    url(r'^api/members/kennitalas/$', views.export_kennitalas, name='export_kennitalas'),
]
```

#### Create API Token for Ekklesia

```bash
# SSH to Django server
ssh root@172.105.71.207

# Create Django shell
cd /home/manager/socialism
sudo -u manager venv/bin/python manage.py shell
```

```python
# In Django shell
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token

# Create service user for Ekklesia
user = User.objects.create_user(
    username='ekklesia_sync',
    email='system@sosialistaflokkurinn.is',
    password='unused_password_token_auth_only'
)

# Generate token
token = Token.objects.create(user=user)
print(f"Token: {token.key}")

# Save this token - you'll need it for Cloud Function config
```

**Important**: Save the token key (e.g., `a1b2c3d4e5f6...`). You'll store this in Google Secret Manager.

#### Test Django Endpoint

```bash
# From your local machine (or server)
curl -H "Authorization: Token a1b2c3d4e5f6..." \
  http://172.105.71.207/api/members/kennitalas/ | jq
```

**Expected Response**:
```json
{
  "count": 2216,
  "kennitalas": ["0101012980", "0101765069", ...],
  "exported_at": "2025-10-15T03:00:00Z"
}
```

---

### Step 2: Store Django Token in Secret Manager

```bash
# From Ekklesia project directory
cd /home/gudro/Development/projects/ekklesia

# Store Django API token
echo -n "a1b2c3d4e5f6..." | gcloud secrets create django-api-token \
  --data-file=- \
  --replication-policy=automatic \
  --project=ekklesia-prod-10-2025

# Verify
gcloud secrets versions access latest \
  --secret=django-api-token \
  --project=ekklesia-prod-10-2025
```

---

### Step 3: Create Cloud Function

**File**: `functions/sync-member-list/index.js`

```javascript
/**
 * syncMemberList - Weekly sync of member kennitalas from Django to Firebase
 *
 * Triggered by: Cloud Scheduler (weekly, Monday 3 AM Iceland time)
 * Purpose: Keep Ekklesia member list in sync with Django legacy system
 *
 * Flow:
 *   1. Fetch kennitalas from Django REST API
 *   2. Upload to Firebase Storage (kennitalas.txt)
 *   3. Log audit trail to Firestore
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

// Initialize Firebase Admin (if not already initialized)
if (!admin.apps.length) {
  admin.initializeApp();
}

exports.syncMemberList = functions
  .runWith({
    timeoutSeconds: 120,
    memory: '256MB',
  })
  .pubsub.schedule('0 3 * * 1')  // Every Monday at 3:00 AM
  .timeZone('Atlantic/Reykjavik')
  .onRun(async (context) => {
    const startTime = Date.now();

    // Configuration
    const DJANGO_API_URL = 'https://172.105.71.207/api/members/kennitalas/';

    // Get Django API token from Secret Manager (using @google-cloud/secret-manager)
    const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
    const secretClient = new SecretManagerServiceClient();
    const secretName = 'projects/ekklesia-prod-10-2025/secrets/django-api-token/versions/latest';
    const [{ payload: { data } }] = await secretClient.accessSecretVersion({ name: secretName });
    const DJANGO_TOKEN = data.toString('utf8');

    try {
      console.log('[SYNC] Starting weekly member list sync...');

      // Step 1: Fetch kennitalas from Django API
      console.log('[SYNC] Fetching kennitalas from Django API...');
      const response = await fetch(DJANGO_API_URL, {
        method: 'GET',
        headers: {
          'Authorization': `Token ${DJANGO_TOKEN}`,
          'Accept': 'application/json',
        },
        timeout: 30000,  // 30 second timeout
      });

      if (!response.ok) {
        throw new Error(
          `Django API returned ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      const kennitalas = data.kennitalas;
      const count = data.count;

      console.log(`[SYNC] Received ${count} kennitalas from Django`);

      // Validation
      if (!Array.isArray(kennitalas) || kennitalas.length === 0) {
        throw new Error('Django API returned empty or invalid kennitalas array');
      }

      if (count !== kennitalas.length) {
        console.warn(
          `[SYNC] Warning: count mismatch (${count} vs ${kennitalas.length})`
        );
      }

      // Step 2: Upload to Firebase Storage
      console.log('[SYNC] Uploading to Firebase Storage...');
      const bucket = admin.storage().bucket();
      const file = bucket.file('kennitalas.txt');

      const fileContent = kennitalas.join('\n');

      await file.save(fileContent, {
        metadata: {
          contentType: 'text/plain',
          metadata: {
            syncedAt: new Date().toISOString(),
            memberCount: count.toString(),
            source: 'django-api',
            djangoExportedAt: data.exported_at,
          },
        },
      });

      console.log('[SYNC] Upload complete');

      // Step 3: Log to audit trail
      const duration = Date.now() - startTime;

      await admin.firestore().collection('sync_audit').add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: 'success',
        memberCount: count,
        duration_ms: duration,
        source: 'django-api',
        djangoExportedAt: data.exported_at,
      });

      console.log(
        `[SYNC] ✅ Sync completed successfully (${count} members, ${duration}ms)`
      );

      return {
        success: true,
        count: count,
        duration: duration,
      };

    } catch (error) {
      console.error('[SYNC] ❌ Sync failed:', error);

      // Log error to audit trail
      const duration = Date.now() - startTime;

      await admin.firestore().collection('sync_audit').add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: 'error',
        error: error.message,
        errorStack: error.stack,
        duration_ms: duration,
      });

      // Re-throw to mark Cloud Function as failed
      throw new functions.https.HttpsError('internal', error.message);
    }
  });
```

**File**: `functions/sync-member-list/package.json`

```json
{
  "name": "sync-member-list",
  "version": "1.0.0",
  "description": "Weekly sync of member kennitalas from Django to Firebase",
  "main": "index.js",
  "dependencies": {
    "firebase-admin": "^11.0.0",
    "firebase-functions": "^4.0.0",
    "node-fetch": "^2.6.7"
  },
  "engines": {
    "node": "18"
  }
}
```

---

### Step 4: Deploy Cloud Function

```bash
# From Ekklesia project directory
cd /home/gudro/Development/projects/ekklesia/functions/sync-member-list

# Install dependencies
npm install

# Deploy function
gcloud functions deploy syncMemberList \
  --gen2 \
  --runtime=nodejs18 \
  --region=europe-west2 \
  --entry-point=syncMemberList \
  --trigger-topic=sync-member-list-topic \
  --timeout=120s \
  --memory=256MB \
  --project=ekklesia-prod-10-2025

# Note: Cloud Scheduler is automatically created by the
# functions.pubsub.schedule() trigger
```

**Verify Deployment**:
```bash
# Check Cloud Function
gcloud functions describe syncMemberList \
  --region=europe-west2 \
  --gen2 \
  --project=ekklesia-prod-10-2025

# Check Cloud Scheduler job
gcloud scheduler jobs list \
  --project=ekklesia-prod-10-2025
```

---

### Step 5: Test Sync Manually

```bash
# Trigger sync manually (don't wait for Monday 3 AM)
gcloud scheduler jobs run firebase-schedule-syncMemberList-europe-west2 \
  --project=ekklesia-prod-10-2025

# Watch logs
gcloud functions logs read syncMemberList \
  --region=europe-west2 \
  --gen2 \
  --limit=50 \
  --project=ekklesia-prod-10-2025
```

**Expected Logs**:
```
[SYNC] Starting weekly member list sync...
[SYNC] Fetching kennitalas from Django API...
[SYNC] Received 2216 kennitalas from Django
[SYNC] Uploading to Firebase Storage...
[SYNC] Upload complete
[SYNC] ✅ Sync completed successfully (2216 members, 1234ms)
```

**Verify Firebase Storage**:
```bash
# Check file metadata
gsutil stat gs://ekklesia-prod-10-2025.firebasestorage.app/kennitalas.txt

# Download and verify count
gsutil cat gs://ekklesia-prod-10-2025.firebasestorage.app/kennitalas.txt | wc -l
```

**Expected**: 2216 lines

---

## Monitoring & Alerting

### Audit Trail (Firestore)

All sync operations are logged to the `sync_audit` collection:

**Success Record**:
```json
{
  "timestamp": "2025-10-15T03:00:12.345Z",
  "status": "success",
  "memberCount": 2216,
  "duration_ms": 1234,
  "source": "django-api",
  "djangoExportedAt": "2025-10-15T03:00:00Z"
}
```

**Error Record**:
```json
{
  "timestamp": "2025-10-15T03:00:12.345Z",
  "status": "error",
  "error": "Django API returned 500: Internal Server Error",
  "errorStack": "...",
  "duration_ms": 5678
}
```

### Query Sync History

```javascript
// Firestore console or Firebase Admin
const auditLogs = await admin
  .firestore()
  .collection('sync_audit')
  .orderBy('timestamp', 'desc')
  .limit(10)
  .get();

auditLogs.forEach((doc) => {
  const data = doc.data();
  console.log(`${data.timestamp}: ${data.status} (${data.memberCount} members)`);
});
```

### Set Up Alerts

**Option 1: Email Alerts (Cloud Monitoring)**

```bash
# Create notification channel (email)
gcloud alpha monitoring channels create \
  --display-name="Ekklesia Alerts" \
  --type=email \
  --channel-labels=email_address=alerts@sosialistaflokkurinn.is \
  --project=ekklesia-prod-10-2025

# Create alert policy (sync failures)
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Member List Sync Failed" \
  --condition-display-name="Sync error in last 24 hours" \
  --condition-threshold-value=1 \
  --condition-threshold-duration=60s \
  --condition-filter='resource.type="cloud_function" AND resource.labels.function_name="syncMemberList" AND severity>=ERROR' \
  --project=ekklesia-prod-10-2025
```

**Option 2: Manual Monitoring (Weekly Check)**

Every Monday morning, check:
1. Firebase Storage file timestamp (should be from Monday 3 AM)
2. Firestore `sync_audit` latest record (should be "success")
3. Cloud Function logs (no errors)

---

## Troubleshooting

### Issue 1: Django API Returns 401 Unauthorized

**Symptoms**:
- Cloud Function logs: "Django API returned 401"
- Sync fails

**Cause**: Django API token is invalid or expired

**Solution**:
```bash
# Regenerate token in Django
ssh root@172.105.71.207
cd /home/manager/socialism
sudo -u manager venv/bin/python manage.py shell
```

```python
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import User

user = User.objects.get(username='ekklesia_sync')
Token.objects.filter(user=user).delete()  # Delete old token
token = Token.objects.create(user=user)
print(f"New token: {token.key}")

# ⚠️ SECURITY NOTE: Do NOT log, commit, or share this token.
# Store only in Secret Manager. Anyone with this token can authenticate
# to the Django API on behalf of the sync service.
```

Update Secret Manager:
```bash
echo -n "NEW_TOKEN_HERE" | gcloud secrets versions add django-api-token \
  --data-file=- \
  --project=ekklesia-prod-10-2025
```

### Issue 2: Django API Returns 500 Internal Server Error

**Symptoms**:
- Cloud Function logs: "Django API returned 500"
- Sync fails

**Cause**: Django server error (database connection, code error, etc.)

**Solution**:
1. Check Django logs on Linode server
2. Check PostgreSQL is running: `systemctl status postgresql`
3. Test endpoint manually: `curl http://172.105.71.207/api/members/kennitalas/`
4. Restart Django app if needed

### Issue 3: Sync Completes but Member Count Drops Significantly

**Symptoms**:
- Previous sync: 2216 members
- Latest sync: 1800 members (400+ drop)
- No expected mass departures

**Cause**: Django database issue or API bug

**Solution**:
1. **DO NOT PANIC** - Old kennitalas.txt is still in Firebase Storage (versioned)
2. Check Django database directly:
   ```bash
   sudo -u postgres psql socialism -c "SELECT COUNT(*) FROM membership_comrade;"
   ```
3. If count is correct in DB, check Django API endpoint manually
4. If count is wrong in DB, restore from backup (Linode backups)
5. Disable automatic sync until issue resolved:
   ```bash
   gcloud scheduler jobs pause firebase-schedule-syncMemberList-europe-west2
   ```

### Issue 4: Cloud Function Timeout

**Symptoms**:
- Cloud Function logs: "Function execution took too long"
- Sync fails after 120 seconds

**Cause**: Django API is slow or network issues

**Solution**:
1. Increase Cloud Function timeout:
   ```javascript
   // In index.js
   .runWith({
     timeoutSeconds: 300,  // Increase to 5 minutes
     memory: '256MB',
   })
   ```
2. Redeploy Cloud Function
3. If still times out, check Django API performance

---

## Cost Estimate

| Component | Cost | Notes |
|-----------|------|-------|
| Cloud Function (scheduled) | $0.00 | Free tier (2M requests/month) |
| Cloud Scheduler | $0.10/month | First 3 jobs free, then $0.10/job |
| Firestore writes (audit log) | $0.00 | ~4 writes/month (negligible) |
| Firebase Storage | $0.00 | kennitalas.txt = 24 KB (negligible) |
| Secret Manager | $0.06/month | 1 secret (django-api-token) |
| **Total** | **~$0.16/month** | **~$2/year** |

**Comparison to Manual Work**:
- Manual export time: 5-10 minutes/week
- Annual time saved: ~4-8 hours
- **ROI**: Huge (automation pays for itself immediately)

---

## Security Considerations

### Django API Token

- **Storage**: Google Secret Manager (encrypted at rest)
- **Access**: Cloud Function only (service account permissions)
- **Rotation**: Rotate token every 6-12 months
- **Revocation**: Delete token in Django if compromised

### Network Security

- **Django API**: Currently exposed on public IP (172.105.71.207)
- **Recommendation**: Add IP whitelist in Django (allow Cloud Function IPs only)
- **Alternative**: Set up VPN or Cloud VPN between GCP and Linode

### Data in Transit

- **Current**: HTTP (unencrypted)
- **Recommendation**: Enable HTTPS on Django server (Let's Encrypt)
- **Implementation**: Configure Nginx with SSL certificate

### Audit Trail

- **Firestore rules**: Restrict `sync_audit` collection to admin only
- **Retention**: Keep logs for 12 months, then delete
- **Monitoring**: Alert on failed syncs

---

## Future Improvements

### Phase 6: Add Member Diffs

Track changes between syncs:

```javascript
// In Cloud Function
const previousKennitalas = await getPreviousKennitalas();
const added = kennitalas.filter(kt => !previousKennitalas.includes(kt));
const removed = previousKennitalas.filter(kt => !kennitalas.includes(kt));

await admin.firestore().collection('sync_audit').add({
  // ... existing fields ...
  changes: {
    added: added.length,
    removed: removed.length,
    addedKennitalas: added,
    removedKennitalas: removed,
  },
});
```

### Phase 7: Two-Way Sync

Allow Ekklesia to write back to Django:

1. Admin adds member in Ekklesia
2. Cloud Function calls Django API: `POST /api/members/create/`
3. Django creates `Comrade` record
4. Next weekly sync pulls updated list

**Complexity**: High (requires Django API changes, conflict resolution)

### Phase 8: Real-Time Sync

Replace weekly schedule with real-time updates:

1. Django sends webhook on member create/delete
2. Cloud Function receives webhook
3. Update Firebase Storage immediately

**Complexity**: Medium (requires webhook setup in Django)

---

## Testing Checklist

Before deploying to production:

- [ ] Django API endpoint returns correct data format
- [ ] Django API token authentication works
- [ ] Cloud Function can access Django API
- [ ] Cloud Function uploads to Firebase Storage
- [ ] Firestore audit trail records are created
- [ ] Cloud Scheduler triggers function on schedule
- [ ] Manual trigger works (`gcloud scheduler jobs run ...`)
- [ ] Error handling logs to Firestore
- [ ] Alert notification works (if configured)
- [ ] Member count matches Django database count

---

## Rollback Plan

If sync implementation causes issues:

1. **Disable Cloud Scheduler**:
   ```bash
   gcloud scheduler jobs pause firebase-schedule-syncMemberList-europe-west2
   ```

2. **Restore previous kennitalas.txt** (if corrupted):
   ```bash
   # List previous versions
   gsutil ls -a gs://ekklesia-prod-10-2025.firebasestorage.app/kennitalas.txt

   # Restore specific version
   gsutil cp gs://ekklesia-prod-10-2025.firebasestorage.app/kennitalas.txt#1234567890 \
     gs://ekklesia-prod-10-2025.firebasestorage.app/kennitalas.txt
   ```

3. **Delete Cloud Function** (if needed):
   ```bash
   gcloud functions delete syncMemberList \
     --region=europe-west2 \
     --gen2 \
     --project=ekklesia-prod-10-2025
   ```

4. **Resume manual export/upload** (temporary fallback)

---

## Related Documentation

- DJANGO_LEGACY_SYSTEM.md (archived) - Django system details
- [CURRENT_DEVELOPMENT_STATUS.md](../status/CURRENT_DEVELOPMENT_STATUS.md) - Ekklesia production status
- [services/members/README.md](../../services/members/README.md) - Members service documentation

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-10-15 | Initial implementation guide | Claude |
| 2025-10-15 | Added Django API endpoint code | Claude |
| 2025-10-15 | Added Cloud Function implementation | Claude |
| 2025-10-15 | Added monitoring and troubleshooting | Claude |

---

**Last Updated**: 2025-10-15
**Status**: 📋 Planned for Phase 5 (Dec 2025)
**Next Review**: After implementation and first successful sync
