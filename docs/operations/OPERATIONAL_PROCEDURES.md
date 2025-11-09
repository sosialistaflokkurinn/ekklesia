# Ekklesia Operational Procedures - Meeting Day

**Document Type**: Operations Manual
**Last Updated**: 2025-11-09
**Status**: ✅ Active - Required for Meeting Operations
**Purpose**: Step-by-step procedures for preparing, running, and shutting down the system for meetings

---

## Overview

The Ekklesia system is designed for **infrequent, high-load events** (monthly meetings). This operational model requires:

1. **Active preparation** before meetings (scale up, pre-warm)
2. **Monitoring** during meetings (ensure availability)
3. **Cost optimization** after meetings (scale down, pause services)

**Philosophy**: It's **completely justified** to manually prepare the system before meetings and scale down afterward. Monthly meetings don't require 24/7 high availability.

## System Status (Nov 9, 2025)

✅ **Phase 5 Core Features Complete**:
- ✅ Admin Elections API - 10 endpoints with RBAC (election-manager, superadmin)
- ✅ Member Voting Interface - Complete voting experience
- ✅ Bidirectional Sync - Django ↔ Firestore member synchronization
- ✅ Policy Session - Immigration policy voting with amendments
- ✅ Project Reorganization - Area-based architecture (/elections/, /events/, /policy-session/)
- ✅ Documentation Automation - 3-layer maintenance system

✅ **End-to-end voting flow validated** (Oct 15, 2025):
- All services working together
- Complete voting flow (authentication → token → vote → results)
- Anonymous voting verified
- One-time token enforcement working
- Performance excellent (<500ms response times)

**Recent Updates (Nov 2025)**:
- Admin API deployed with 10 endpoints
- Member sync infrastructure operational (hourly Django → Firestore, daily Firestore → Django)
- Critical sync bugs fixed (composite index, queue marking)
- Firestore composite index created for sync_queue

**Remaining**: Load testing (300 votes/sec spike), Integration testing, Production security review

---

## Meeting Timeline

### 📅 One Week Before Meeting

**Purpose**: Plan and communicate

**Tasks**:
- [ ] Confirm meeting date and expected attendance (small/large/maximum)
- [ ] Check if database upgrade needed (if >300 attendees expected)
- [ ] Schedule 30 minutes before meeting for system preparation
- [ ] Notify technical contact (availability during meeting)

**No system changes needed at this stage.**

---

### ⏰ 30 Minutes Before Meeting (CRITICAL PREP)

**Purpose**: Pre-warm system, scale up for load spike

#### Step 1: Scale Up Elections Service (Most Critical)

```bash
# Set minimum instances to pre-warm for large meetings
gcloud run services update elections-service \
  --region=europe-west2 \
  --min-instances=10 \
  --max-instances=100 \
  --project=ekklesia-prod-10-2025

# Verify scaling
gcloud run services describe elections-service \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025 \
  --format="value(spec.template.spec.minInstanceCount,spec.template.spec.maxInstanceCount)"
```

**Expected Output**: `10 100`

**Cost Impact**: ~$0.50 for 30 minutes (10 instances idle)
**Benefit**: Cold start eliminated, scales instantly to 100 instances

**When to Skip**: Small meetings (<150 attendees) don't need pre-warming

#### Step 2: Upgrade Database (If Large Meeting)

**If expecting >300 attendees**, temporarily upgrade database:

```bash
# Upgrade to db-g1-small (100 connections, 1000 TPS)
gcloud sql instances patch ekklesia-db \
  --tier=db-g1-small \
  --project=ekklesia-prod-10-2025

# This takes ~5 minutes, database remains available
# Monitor progress:
gcloud sql operations list \
  --instance=ekklesia-db \
  --project=ekklesia-prod-10-2025 \
  --limit=1
```

**Cost Impact**: $25/month prorated (if kept for 1 day = $0.83)

**When to Skip**: Meetings <300 attendees, db-f1-micro sufficient

#### Step 3: Verify Services Are Healthy

```bash
# Check Events service
curl -s https://events-service-ymzrguoifa-nw.a.run.app/health | jq

# Check Elections service
curl -s https://elections-service-ymzrguoifa-nw.a.run.app/health | jq

# Check Members service
curl -s https://ekklesia-prod-10-2025.web.app/
```

**Expected**: All services return 200 OK (JSON for APIs, HTML for hosting)

#### Step 4: Open Monitoring Dashboard

```bash
# Open Cloud Run metrics (Elections service)
echo "https://console.cloud.google.com/run/detail/europe-west2/elections-service/metrics?project=ekklesia-prod-10-2025"

# Open Cloud SQL metrics
echo "https://console.cloud.google.com/sql/instances/ekklesia-db/monitoring?project=ekklesia-prod-10-2025"
```

**Keep these tabs open during meeting** to monitor:
- Request rate (should spike during voting)
- Error rate (should stay <5%)
- Instance count (should scale to 45+ during spike)
- Database connections (should stay <80% of max)

---

### 🎯 During Meeting (Active Monitoring)

**Purpose**: Watch for issues, respond quickly

#### Normal Operations

**What to watch**:
- Elections service instance count (check during voting)
- Error rate (check after each vote)
- Database connection pool (check if errors occur)

**No action needed if**:
- Instance count scales up during voting (10 → 45+)
- Error rate stays <5%
- Response times <500ms

#### If Issues Occur

##### Issue 1: High Error Rate (>10%)

**Symptoms**: Many votes failing, users complaining

**Quick Check**:
```bash
# Check Elections service logs (last 5 minutes)
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=elections-service AND severity>=ERROR" \
  --limit=20 \
  --project=ekklesia-prod-10-2025 \
  --format="table(timestamp,jsonPayload.message)"
```

**Common Causes**:
1. Database connection pool exhausted
2. Cloud Run not scaling fast enough
3. Database lock contention

**Immediate Action**:
```bash
# If connection pool issue, scale up database NOW
gcloud sql instances patch ekklesia-db \
  --tier=db-g1-small \
  --project=ekklesia-prod-10-2025 \
  --async  # Don't wait, start immediately

# If Cloud Run not scaling, increase min instances
gcloud run services update elections-service \
  --min-instances=20 \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025
```

**Communicate**: Tell moderator "Please pause voting for 2 minutes while we resolve a technical issue"

##### Issue 2: Slow Response (>1s)

**Symptoms**: Votes taking a long time to submit

**Quick Check**:
```bash
# Check database connections
gcloud sql instances describe ekklesia-db \
  --project=ekklesia-prod-10-2025 \
  --format="value(settings.tier,stats.connections)"
```

**If connections >80% of max**: Upgrade database (see above)

**If connections normal**: May be database lock contention, restart vote

##### Issue 3: Service Completely Down

**Symptoms**: 503 errors, service unreachable

**Emergency Recovery**:
```bash
# Redeploy Elections service (if deployed)
cd /home/gudro/Development/projects/ekklesia/elections
./deploy.sh

# Or redeploy Events service
cd /home/gudro/Development/projects/ekklesia/events
./deploy.sh
```

**Timeline**: 2-3 minutes to redeploy

**Communicate**: "Technical issue, please wait 3 minutes before voting"

---

### ✅ After Meeting (Within 1 Hour)

**Purpose**: Scale down to save costs

#### Step 1: Scale Down Elections Service

```bash
# Set min instances back to 0 (cost optimization)
gcloud run services update elections-service \
  --region=europe-west2 \
  --min-instances=0 \
  --project=ekklesia-prod-10-2025

# Verify
gcloud run services describe elections-service \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025 \
  --format="value(spec.template.spec.minInstanceCount)"
```

**Expected Output**: `0`

**Cost Savings**: $15-20/month if left at 10 min instances

#### Step 2: Downgrade Database (If Upgraded)

**If database was upgraded to db-g1-small**, downgrade:

```bash
# Downgrade to db-f1-micro ($7/month)
gcloud sql instances patch ekklesia-db \
  --tier=db-f1-micro \
  --project=ekklesia-prod-10-2025

# This takes ~5 minutes
# Monitor progress:
gcloud sql operations list \
  --instance=ekklesia-db \
  --project=ekklesia-prod-10-2025 \
  --limit=1
```

**Cost Savings**: $18/month ($25 → $7)

**Safe to do**: Database will remain available during downgrade

#### Step 3: Verify Cost Optimization

```bash
# Check current instance tiers
gcloud run services list \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025 \
  --format="table(SERVICE,REGION,URL,spec.template.spec.minInstanceCount)"

gcloud sql instances list \
  --project=ekklesia-prod-10-2025 \
  --format="table(NAME,DATABASE_VERSION,TIER,STATE)"
```

**Expected**:
- Elections service: min-instances = 0
- Events service: min-instances = 0
- ekklesia-db: db-f1-micro

**Monthly Cost**: $7-10/month (optimal)

---

## Cost Comparison: Prepared vs Always-On

### Always-On Configuration (NOT RECOMMENDED)

```yaml
Elections service:
  min-instances: 10      # Always warm
  max-instances: 100

Database:
  tier: db-g1-small      # Always ready for load

Monthly Cost: $370/month ($25 DB + $345 Cloud Run)
Annual Cost: $4,440/year
```

### On-Demand Configuration (RECOMMENDED)

```yaml
Elections service:
  min-instances: 0       # Scale to 0 between meetings
  max-instances: 100     # Scale up during voting

Database:
  tier: db-f1-micro      # Upgrade only for large meetings

Monthly Cost: $7-10/month ($7 DB + $0-3 Cloud Run)
Annual Cost: $84-120/year
```

**Savings**: $4,320/year (98% cost reduction)

**Trade-off**: 30 minutes of manual prep before meetings (justified!)

## Implementation Checklist

### Before First Large Meeting (500 attendees)

**Infrastructure (Complete):**
- [x] End-to-end voting flow test (✅ Oct 15, 2025)
- [x] Admin Elections API with RBAC (✅ Nov 2025 - 10 endpoints)
- [x] Member sync infrastructure (✅ Nov 2025 - bidirectional Django ↔ Firestore)
- [x] Firestore composite indexes (✅ Nov 2025 - sync_queue)
- [x] Policy session features (✅ Nov 2025)
- [x] Project reorganization (✅ Nov 2025 - area-based architecture)
- [x] Documentation automation (✅ Nov 2025 - 3-layer system)

**Performance & Testing (Remaining):**
- [ ] Load test Elections service (300 votes/sec)
- [ ] Configure Cloud Run: `--max-instances 100 --startup-cpu-boost`
- [ ] Configure connection pooling: 2 connections per instance
- [ ] Implement `FOR UPDATE NOWAIT` (fail-fast locking)
- [ ] Implement 503 retry logic (connection pool exhaustion)
- [ ] Test end-to-end with 50 concurrent users (smaller test)

**Monitoring & Operations (Remaining):**
- [ ] Set up monitoring dashboard (request rate, error rate, latency)
- [ ] Set up alerts (error rate >10%, connections >80%)
- [ ] Test database upgrade path (db-f1-micro → db-g1-small)
- [ ] Document retry strategy for users (if vote fails, retry)

---

## Pre-Meeting Checklist (Quick Reference)

**Print this and keep it handy:**

```
□ 30 min before: Scale up Elections service (--min-instances=10)
□ 30 min before: Upgrade database if >300 attendees expected
□ 15 min before: Verify all services healthy (curl /health)
□ 10 min before: Open monitoring dashboards (Cloud Run + Cloud SQL)
□ During meeting: Watch error rate and instance count
□ After meeting: Scale down Elections service (--min-instances=0)
□ After meeting: Downgrade database if upgraded
□ After meeting: Verify cost optimization
```

---

## Emergency Contacts & Resources

### Quick Links (Bookmark These)

```bash
# Cloud Run Console (Elections service)
https://console.cloud.google.com/run/detail/europe-west2/elections-service/metrics?project=ekklesia-prod-10-2025

# Cloud SQL Console
https://console.cloud.google.com/sql/instances/ekklesia-db/monitoring?project=ekklesia-prod-10-2025

# Cloud Logging (Errors only)
https://console.cloud.google.com/logs/query?project=ekklesia-prod-10-2025

# Firebase Console (Members service)
https://console.firebase.google.com/project/ekklesia-prod-10-2025/overview
```

### Command Aliases (Add to ~/.bashrc)

```bash
# Add these to make meeting prep faster
alias ekklesia-prep='gcloud run services update elections-service --region=europe-west2 --min-instances=10 --project=ekklesia-prod-10-2025'
alias ekklesia-cleanup='gcloud run services update elections-service --region=europe-west2 --min-instances=0 --project=ekklesia-prod-10-2025'
alias ekklesia-status='gcloud run services describe elections-service --region=europe-west2 --project=ekklesia-prod-10-2025 --format="value(status.url,spec.template.spec.minInstanceCount,status.traffic[0].latestRevision)"'
alias ekklesia-logs='gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=elections-service AND severity>=ERROR" --limit=20 --project=ekklesia-prod-10-2025'
alias ekklesia-db-upgrade='gcloud sql instances patch ekklesia-db --tier=db-g1-small --project=ekklesia-prod-10-2025'
alias ekklesia-db-downgrade='gcloud sql instances patch ekklesia-db --tier=db-f1-micro --project=ekklesia-prod-10-2025'
```

**Usage**:
```bash
# 30 minutes before meeting
ekklesia-prep

# Check status
ekklesia-status

# After meeting
ekklesia-cleanup
```

---

## Advanced: Scheduled Scaling (Optional)

**For recurring meetings** (e.g., first Monday of every month), you can schedule scaling:

### Option 1: Cloud Scheduler + Cloud Functions

Create a Cloud Function that scales up/down on schedule:

```javascript
// functions/scale-for-meeting.js
const {CloudRunClient} = require('@google-cloud/run').v2;

exports.scaleElections = async (req, res) => {
  const action = req.body.action; // 'prep' or 'cleanup'
  const client = new CloudRunClient();

  const minInstances = action === 'prep' ? 10 : 0;

  await client.updateService({
    service: {
      name: 'projects/ekklesia-prod-10-2025/locations/europe-west2/services/elections-service',
      template: {
        scaling: {
          minInstanceCount: minInstances
        }
      }
    }
  });

  res.json({ success: true, action, minInstances });
};
```

**Cloud Scheduler**:
```bash
# Scale up 30 min before meeting (e.g., every 1st Monday at 6:30 PM)
gcloud scheduler jobs create http scale-up-for-meeting \
  --schedule="30 18 * * 1#1" \
  --uri="https://scale-elections-function.run.app" \
  --http-method=POST \
  --message-body='{"action":"prep"}' \
  --time-zone="Atlantic/Reykjavik" \
  --project=ekklesia-prod-10-2025

# Scale down 2 hours after meeting starts
gcloud scheduler jobs create http scale-down-after-meeting \
  --schedule="0 21 * * 1#1" \
  --uri="https://scale-elections-function.run.app" \
  --http-method=POST \
  --message-body='{"action":"cleanup"}' \
  --time-zone="Atlantic/Reykjavik" \
  --project=ekklesia-prod-10-2025
```

**Cost**: $0.10/month for Cloud Scheduler (first 3 jobs free)

### Option 2: Manual Cron (Simpler)

**On your local machine**, create a cron job:

```bash
# Edit crontab
crontab -e

# Add these lines (adjust times as needed)
# Scale up 30 min before meeting (e.g., 1st Monday 6:30 PM)
30 18 * * 1 [ $(date +\%d) -le 7 ] && gcloud run services update elections-service --region=europe-west2 --min-instances=10 --project=ekklesia-prod-10-2025 2>&1 | logger -t ekklesia-prep

# Scale down 2 hours after
0 21 * * 1 [ $(date +\%d) -le 7 ] && gcloud run services update elections-service --region=europe-west2 --min-instances=0 --project=ekklesia-prod-10-2025 2>&1 | logger -t ekklesia-cleanup
```

**Limitations**: Only works if your machine is on. Manual prep more reliable.

---

## Monitoring Best Practices

### What to Monitor During Voting Spike

**Cloud Run Metrics** (Elections service):
- **Request rate**: Should reach 300/sec during spike
- **Instance count**: Should scale to 45-100 instances
- **Error rate**: Should stay <5%
- **Request latency (p95)**: Should stay <500ms

**Cloud SQL Metrics**:
- **Connections**: Should stay <80% of max (20 for db-f1-micro, 80 for db-g1-small)
- **Transaction rate**: Should handle 300 TPS during spike
- **CPU usage**: Should stay <80%

**Firebase Authentication**:
- Not a concern (handles 10,000 req/sec easily)

### Alert Thresholds (Set These Up)

```bash
# Create alert for high error rate (>10%)
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Elections Service High Error Rate" \
  --condition-display-name="Error rate >10%" \
  --condition-threshold-value=0.1 \
  --condition-threshold-duration=60s \
  --condition-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="elections-service" AND metric.type="run.googleapis.com/request_count" AND metric.labels.response_code_class="5xx"'
```

**Better approach**: Watch manually during meeting (monthly event, not worth complex alerting)

---

## Post-Meeting Review

### After Each Meeting, Document:

1. **Attendance**: Actual number of attendees
2. **Peak load**: Max votes/second observed
3. **Issues**: Any errors or slowdowns
4. **Database**: Did we need to upgrade? (connection usage)
5. **Scaling**: Did Cloud Run scale fast enough?
6. **Cost**: Total cost for the meeting

**Template**:
```markdown
## Meeting: 2025-10-15 Board Meeting

- Attendance: 287 members
- Peak load: 245 votes in 2 seconds (122 votes/sec)
- Issues: None
- Database: db-f1-micro sufficient (18/25 connections used)
- Scaling: Elections service scaled to 32 instances (smooth)
- Cost: $0.45 (no database upgrade needed)
- Notes: Consider pre-warming at 5 instances instead of 10
```

**Why**: Build data to refine scaling strategy over time

---

## Disaster Recovery

### Scenario: Elections Service Fails During Vote

**Symptoms**: 503 errors, service unreachable, votes not recording

**Recovery Steps**:

1. **Immediate** (30 seconds):
   ```bash
   # Check if service is running
   gcloud run services describe elections-service \
     --region=europe-west2 \
     --project=ekklesia-prod-10-2025 \
     --format="value(status.conditions[0].message)"
   ```

2. **If database connection issue** (1 minute):
   ```bash
   # Restart Cloud SQL Proxy connection (if using proxy)
   # Or upgrade database tier
   gcloud sql instances patch ekklesia-db \
     --tier=db-g1-small \
     --project=ekklesia-prod-10-2025 \
     --async
   ```

3. **If Cloud Run deployment issue** (3 minutes):
   ```bash
   # Force new revision deployment
   gcloud run services update elections-service \
     --region=europe-west2 \
     --project=ekklesia-prod-10-2025 \
     --tag=emergency-$(date +%s)
   ```

4. **Communicate to moderator**:
   - "Technical issue detected"
   - "Please pause voting for 3 minutes"
   - "We are resolving the issue"
   - "Votes already cast are safe"

5. **After recovery**:
   - Verify ballot count matches expected
   - Check audit logs for any lost votes
   - Resume voting

### Scenario: Database Fails During Vote

**Symptoms**: All services return 500 errors, database unreachable

**Recovery Steps**:

1. **Check database status** (10 seconds):
   ```bash
   gcloud sql instances describe ekklesia-db \
     --project=ekklesia-prod-10-2025 \
     --format="value(state,settings.activationPolicy)"
   ```

2. **If database stopped** (immediate):
   ```bash
   # Restart database
   gcloud sql instances restart ekklesia-db \
     --project=ekklesia-prod-10-2025
   ```

3. **Recovery time**: 1-2 minutes

4. **Worst case** (database corrupted):
   - All ballots in current election lost
   - Audit trail in Events service preserved (token issuance records)
   - Must re-vote (moderator decision)

**Prevention**: This is extremely unlikely with Cloud SQL (99.95% SLA)

---

## Related Documentation

- [USAGE_CONTEXT.md](../development/guides/workflows/USAGE_CONTEXT.md) - Load patterns and capacity planning
- ELECTIONS_SERVICE_MVP.md (see services/elections/) - Elections service design
- EVENTS_SERVICE_MVP.md (see services/events/) - Events service design
- [CURRENT_DEVELOPMENT_STATUS.md](../status/CURRENT_DEVELOPMENT_STATUS.md) - Production status

---

## Summary

**Key Principles**:
1. ✅ **Manual prep is justified** - Monthly meetings don't need 24/7 high availability
2. ✅ **Pre-warming saves money** - 30 minutes of prep vs $4,000/year always-on cost
3. ✅ **Scale up before, scale down after** - Minimize idle resource cost
4. ✅ **Monitor during meetings** - Quick response to issues
5. ✅ **Document and learn** - Refine strategy over time

**Time Investment**: 30 minutes prep + 10 minutes cleanup = 40 minutes per meeting

**Cost Savings**: $4,320/year (98% reduction vs always-on)

**Trade-off**: Worth it! ✅

---

**Last Updated**: 2025-11-09
**Status**: ✅ Active - Required for all meetings
**Next Review**: After first 3 meetings (validate assumptions)
