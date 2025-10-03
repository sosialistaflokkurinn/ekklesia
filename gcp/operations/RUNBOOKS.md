# 📋 Operational Runbooks

**Project:** Ekklesia Production Infrastructure
**GCP Project:** ekklesia-prod-10-2025
**Region:** europe-west2 (London)
**Last Updated:** 2025-10-03

---

## 📚 Table of Contents

1. [Service Overview](#service-overview)
2. [Common Operations](#common-operations)
3. [Deployment Procedures](#deployment-procedures)
4. [Rollback Procedures](#rollback-procedures)
5. [Scaling Operations](#scaling-operations)
6. [Troubleshooting](#troubleshooting)
7. [Incident Response](#incident-response)
8. [Maintenance Tasks](#maintenance-tasks)

---

## 🎯 Service Overview

### Deployed Services

| Service | URL | Purpose | Status |
|---------|-----|---------|--------|
| **ZITADEL** | https://zitadel-ymzrguoifa-nw.a.run.app | Identity & Access Management | ✅ Production |
| **OIDC Bridge** | https://oidc-bridge-proxy-ymzrguoifa-nw.a.run.app | Kenni.is OIDC compatibility | ✅ Production |
| **Members** | https://members-ymzrguoifa-nw.a.run.app | Members portal (hello-world) | ✅ Production |
| **Cloud SQL** | zitadel-db (zitadel8) | PostgreSQL 15 database | ✅ Production |

### Custom Domains

- **auth.si-xj.org** → Load Balancer (34.8.250.20) → ZITADEL
  - Status: SSL provisioning in progress
  - DNS: Cloudflare (A record)

---

## 🔧 Common Operations

### Authentication

All gcloud commands require authentication:

```bash
# Check current account
gcloud auth list

# Login if needed
gcloud auth login

# Set project
gcloud config set project ekklesia-prod-10-2025
```

### Get Identity Token (for API testing)

```bash
# Get token for authenticated requests
TOKEN=$(gcloud auth print-identity-token)

# Use in curl
curl -H "Authorization: Bearer $TOKEN" https://members-ymzrguoifa-nw.a.run.app/health
```

### View Service Status

```bash
# List all Cloud Run services
gcloud run services list --region=europe-west2

# Get specific service details
gcloud run services describe <SERVICE_NAME> --region=europe-west2

# Check service health
gcloud run services describe <SERVICE_NAME> \
  --region=europe-west2 \
  --format="value(status.conditions)"
```

### View Logs

```bash
# Real-time logs for a service
gcloud run services logs tail <SERVICE_NAME> --region=europe-west2

# Recent logs (last 50 lines)
gcloud run services logs read <SERVICE_NAME> \
  --region=europe-west2 \
  --limit=50

# Filter logs by severity
gcloud logging read "resource.type=cloud_run_revision \
  AND resource.labels.service_name=<SERVICE_NAME> \
  AND severity>=ERROR" \
  --limit=20 \
  --format=json
```

---

## 🚀 Deployment Procedures

### Deploy Members Service

**Pre-deployment Checklist:**
- [ ] Code changes tested locally
- [ ] Dependencies updated (`npm audit`)
- [ ] Documentation updated
- [ ] Backup current revision (automatic)

**Deployment Steps:**

```bash
# Navigate to members directory
cd /home/gudro/Development/projects/ekklesia/members

# Deploy using Cloud Build
./deploy-gcp.sh

# Monitor deployment
gcloud run services describe members \
  --region=europe-west2 \
  --format="value(status.conditions)"
```

**Expected Duration:** 2-3 minutes

**Verification:**

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe members \
  --region=europe-west2 \
  --format='value(status.url)')

# Test health endpoint
TOKEN=$(gcloud auth print-identity-token)
curl -H "Authorization: Bearer $TOKEN" $SERVICE_URL/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-03T...",
  "version": "1.0.0",
  "service": "ekklesia-members"
}
```

### Deploy OIDC Bridge

```bash
cd /home/gudro/Development/projects/ekklesia/gcp

# Update environment variables if needed
gcloud run services update oidc-bridge-proxy \
  --region=europe-west2 \
  --update-env-vars="PROXY_ISSUER=https://oidc-bridge-proxy-ymzrguoifa-nw.a.run.app"

# Or full redeploy
REGION=europe-west2 ./deploy_proxy.sh
```

### Deploy ZITADEL

**⚠️ CRITICAL:** ZITADEL deployment affects authentication for all services

```bash
cd /home/gudro/Development/projects/ekklesia/gcp/zitadel-deploy

# Review current configuration
gcloud run services describe zitadel --region=europe-west2

# Deploy (see ZITADEL_QUICK_REFERENCE.md for full command)
gcloud run deploy zitadel \
  --image=ghcr.io/zitadel/zitadel:latest \
  --region=europe-west2 \
  --platform=managed \
  --port=8080 \
  --memory=2Gi \
  --cpu=2 \
  --min-instances=1 \
  --max-instances=3 \
  --set-secrets=ZITADEL_DATABASE_POSTGRES_USER_PASSWORD=zitadel-db-password:latest \
  --set-env-vars="ZITADEL_DATABASE_POSTGRES_HOST=/cloudsql/ekklesia-prod-10-2025:europe-west2:zitadel-db,..." \
  --add-cloudsql-instances=ekklesia-prod-10-2025:europe-west2:zitadel-db
```

---

## ⏮️ Rollback Procedures

### Rollback Members Service

Cloud Run keeps previous revisions for quick rollback:

```bash
# List all revisions
gcloud run revisions list \
  --service=members \
  --region=europe-west2 \
  --format="table(name,status,creationTimestamp)"

# Rollback to previous revision
PREVIOUS_REVISION=$(gcloud run revisions list \
  --service=members \
  --region=europe-west2 \
  --format="value(name)" \
  --limit=1 \
  --sort-by=~creationTimestamp \
  --filter="status.conditions.status:False OR status.conditions.status:Unknown")

# If previous revision found, rollback
gcloud run services update-traffic members \
  --region=europe-west2 \
  --to-revisions=$PREVIOUS_REVISION=100

# Verify rollback
gcloud run services describe members \
  --region=europe-west2 \
  --format="value(status.traffic)"
```

### Emergency Rollback Script

```bash
#!/bin/bash
# rollback.sh - Emergency rollback for Cloud Run service

SERVICE_NAME=${1:-members}
REGION=europe-west2

echo "Rolling back $SERVICE_NAME..."

# Get previous stable revision
PREV_REV=$(gcloud run revisions list \
  --service=$SERVICE_NAME \
  --region=$REGION \
  --limit=2 \
  --sort-by=~creationTimestamp \
  --format="value(name)" | tail -1)

if [ -z "$PREV_REV" ]; then
  echo "❌ No previous revision found"
  exit 1
fi

echo "Rolling back to: $PREV_REV"

gcloud run services update-traffic $SERVICE_NAME \
  --region=$REGION \
  --to-revisions=$PREV_REV=100

echo "✅ Rollback complete"
```

---

## 📊 Scaling Operations

### Scale Members Service

```bash
# Increase min instances (for higher availability)
gcloud run services update members \
  --region=europe-west2 \
  --min-instances=1 \
  --max-instances=10

# Scale to zero (cost optimization)
gcloud run services update members \
  --region=europe-west2 \
  --min-instances=0

# Increase resources
gcloud run services update members \
  --region=europe-west2 \
  --memory=1Gi \
  --cpu=2
```

### Scale ZITADEL

**Current Configuration:**
- Min instances: 1 (always-on for authentication)
- Max instances: 3
- Memory: 2Gi
- CPU: 2

**Increase capacity during high load:**

```bash
gcloud run services update zitadel \
  --region=europe-west2 \
  --max-instances=5
```

### Scale Cloud SQL

```bash
# Upgrade database tier
gcloud sql instances patch zitadel-db \
  --tier=db-custom-2-8192 \
  --activation-policy=ALWAYS

# Check current tier
gcloud sql instances describe zitadel-db \
  --format="value(settings.tier)"
```

---

## 🔍 Troubleshooting

### Service Not Responding

**Symptoms:** HTTP 502/503 errors, timeouts

**Diagnosis:**

```bash
# Check service status
gcloud run services describe <SERVICE_NAME> \
  --region=europe-west2 \
  --format="value(status.conditions)"

# Check recent logs for errors
gcloud logging read "resource.type=cloud_run_revision \
  AND resource.labels.service_name=<SERVICE_NAME> \
  AND severity>=ERROR" \
  --limit=20 \
  --format="value(timestamp,textPayload,jsonPayload.message)"

# Check container health
gcloud run revisions describe <REVISION_NAME> \
  --region=europe-west2 \
  --format="value(status.containerStatuses)"
```

**Solutions:**

1. **Rollback to previous revision** (see Rollback Procedures)
2. **Check for failed deployments:**
   ```bash
   gcloud logging read "resource.type=cloud_build" --limit=10
   ```
3. **Restart service:**
   ```bash
   gcloud run services update <SERVICE_NAME> \
     --region=europe-west2 \
     --update-env-vars="RESTART=$(date +%s)"
   ```

### Authentication Errors

**Symptoms:** 401/403 errors, "Your client does not have permission"

**Diagnosis:**

```bash
# Check IAM policy
gcloud run services get-iam-policy <SERVICE_NAME> \
  --region=europe-west2

# Check ingress settings
gcloud run services describe <SERVICE_NAME> \
  --region=europe-west2 \
  --format="value(spec.template.metadata.annotations[run.googleapis.com/ingress])"
```

**Solutions:**

1. **For testing, use Bearer token:**
   ```bash
   TOKEN=$(gcloud auth print-identity-token)
   curl -H "Authorization: Bearer $TOKEN" <SERVICE_URL>
   ```

2. **Check organization policies:**
   ```bash
   gcloud resource-manager org-policies describe \
     iam.allowedPolicyMemberDomains \
     --project=ekklesia-prod-10-2025
   ```

### Database Connection Issues

**Symptoms:** ZITADEL errors, "connection refused", timeout errors

**Diagnosis:**

```bash
# Check Cloud SQL status
gcloud sql instances describe zitadel-db \
  --format="value(state)"

# Check database operations
gcloud sql operations list \
  --instance=zitadel-db \
  --limit=10

# Check ZITADEL logs for database errors
gcloud logging read "resource.type=cloud_run_revision \
  AND resource.labels.service_name=zitadel \
  AND (textPayload=~'database' OR textPayload=~'postgres')" \
  --limit=20
```

**Solutions:**

1. **Verify Cloud SQL connection string:**
   ```bash
   gcloud run services describe zitadel \
     --region=europe-west2 \
     --format="value(spec.template.metadata.annotations[run.googleapis.com/cloudsql-instances])"
   ```

2. **Check database connectivity:**
   ```bash
   gcloud sql connect zitadel-db --user=zitadel --database=zitadel8
   ```

3. **Restart Cloud SQL instance (last resort):**
   ```bash
   gcloud sql instances restart zitadel-db
   ```

### SSL Certificate Issues (Custom Domain)

**Symptoms:** auth.si-xj.org not accessible, SSL errors

**Diagnosis:**

```bash
# Check certificate status
gcloud compute ssl-certificates describe zitadel-cert \
  --global \
  --format="value(managed.status,managed.domainStatus)"

# Check DNS resolution
dig +short auth.si-xj.org

# Expected: 34.8.250.20
```

**Solutions:**

1. **Verify DNS configuration:**
   - Should be A record pointing to 34.8.250.20
   - Cloudflare proxy must be DISABLED (gray cloud)

2. **Delete and recreate certificate if FAILED:**
   ```bash
   gcloud compute ssl-certificates delete zitadel-cert --global
   gcloud compute ssl-certificates create zitadel-cert \
     --domains=auth.si-xj.org \
     --global
   ```

3. **Wait for provisioning:** SSL certificates take 15-60 minutes

---

## 🚨 Incident Response

### Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| **P0 - Critical** | Complete service outage | Immediate | All services down, database failure |
| **P1 - High** | Major functionality broken | < 1 hour | Authentication broken, ZITADEL down |
| **P2 - Medium** | Degraded performance | < 4 hours | Slow response times, partial outage |
| **P3 - Low** | Minor issues | < 24 hours | UI glitches, non-critical features |

### P0 - Critical Incident Response

**All Services Down:**

1. **Check GCP Status:**
   - https://status.cloud.google.com/

2. **Verify project status:**
   ```bash
   gcloud projects describe ekklesia-prod-10-2025
   ```

3. **Check billing:**
   ```bash
   gcloud beta billing projects describe ekklesia-prod-10-2025
   ```

4. **Check service health:**
   ```bash
   for service in zitadel oidc-bridge-proxy members; do
     echo "=== $service ==="
     gcloud run services describe $service --region=europe-west2 \
       --format="value(status.conditions)"
   done
   ```

5. **Review recent changes:**
   ```bash
   gcloud logging read "protoPayload.methodName=~'cloudbuild'" \
     --limit=10 \
     --format="table(timestamp,protoPayload.methodName,protoPayload.status)"
   ```

### P1 - Authentication Failure

**ZITADEL Down:**

1. **Check ZITADEL status:**
   ```bash
   gcloud run services describe zitadel --region=europe-west2
   ```

2. **Check database:**
   ```bash
   gcloud sql instances describe zitadel-db
   ```

3. **Review ZITADEL logs:**
   ```bash
   gcloud run services logs read zitadel --region=europe-west2 --limit=50
   ```

4. **Restart if needed:**
   ```bash
   gcloud run services update zitadel \
     --region=europe-west2 \
     --update-env-vars="RESTART=$(date +%s)"
   ```

5. **Rollback if recent deployment:**
   - See Rollback Procedures above

### Communication Template

**Incident Notification:**

```
INCIDENT: [P0/P1/P2/P3] - [Brief Description]

START TIME: [ISO 8601 timestamp]
AFFECTED SERVICES: [List services]
IMPACT: [User-facing impact description]
STATUS: Investigating / Identified / Monitoring / Resolved

ACTIONS TAKEN:
- [Action 1]
- [Action 2]

NEXT STEPS:
- [Next step 1]
- [Next step 2]

UPDATED: [Timestamp]
```

---

## 🔧 Maintenance Tasks

### Weekly Tasks

**Every Monday:**

1. **Review logs for errors:**
   ```bash
   gcloud logging read "severity>=ERROR" \
     --freshness=7d \
     --format="table(timestamp,resource.labels.service_name,severity,textPayload)"
   ```

2. **Check service health:**
   ```bash
   for service in zitadel oidc-bridge-proxy members; do
     echo "=== $service ==="
     TOKEN=$(gcloud auth print-identity-token)
     URL=$(gcloud run services describe $service --region=europe-west2 --format='value(status.url)')
     curl -s -H "Authorization: Bearer $TOKEN" $URL/health || echo "No health endpoint"
   done
   ```

3. **Review resource usage:**
   - Check Cloud Run metrics in console
   - Review Cloud SQL performance

### Monthly Tasks

**First of each month:**

1. **Update dependencies:**
   ```bash
   cd /home/gudro/Development/projects/ekklesia/members
   npm audit
   npm update
   npm test
   ```

2. **Review costs:**
   ```bash
   gcloud billing accounts list
   # Review in Cloud Console: Billing > Reports
   ```

3. **Backup verification:**
   ```bash
   gcloud sql backups list --instance=zitadel-db --limit=10
   ```

4. **Certificate expiry check:**
   ```bash
   gcloud compute ssl-certificates list --global
   ```

### Quarterly Tasks

**Every 3 months:**

1. **Security review:**
   - Review IAM policies
   - Audit service accounts
   - Check organization policies
   - Review secret rotation

2. **Performance review:**
   - Analyze logs for patterns
   - Review scaling configurations
   - Optimize resource allocation

3. **Documentation update:**
   - Update this runbook
   - Review and update all documentation
   - Verify all commands still work

---

## 📞 Contact Information

### GCP Project Details

- **Project ID:** ekklesia-prod-10-2025
- **Project Number:** 521240388393
- **Region:** europe-west2 (London)
- **Organization:** sosialistaflokkurinn.is

### Key Personnel

- **Owner:** gudrodur@sosialistaflokkurinn.is
- **Member:** agust@sosialistaflokkurinn.is

### Support Resources

- **GCP Support:** https://cloud.google.com/support
- **ZITADEL Docs:** https://zitadel.com/docs
- **Kenni.is Support:** https://kenni.is
- **GitHub Repo:** https://github.com/sosialistaflokkurinn/ekklesia

---

## 🔗 Related Documentation

- **MEMBERS_DEPLOYMENT_GUIDE.md** - Members service deployment
- **ZITADEL_QUICK_REFERENCE.md** - ZITADEL commands
- **MONITORING_SETUP.md** - Monitoring and alerting
- **DOCUMENTATION_MAP.md** - Master documentation index

---

**Last Updated:** 2025-10-03
**Version:** 1.0
**Maintainer:** Ekklesia Operations Team
