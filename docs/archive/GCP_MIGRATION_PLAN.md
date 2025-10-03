# GCP Migration Plan - ZITADEL Self-Hosting Implementation

**Last Updated:** 2025-10-01  
**Status:** ✅ Phase 3 Complete (OIDC Bridge) | ⏰ Phase 2 Next (ZITADEL)

---

## Overview

This document outlines the complete implementation plan for self-hosted ZITADEL authentication infrastructure on GCP.

**Current Status:**
- ✅ **Phase 1:** GCP Project setup - COMPLETE
- ⏰ **Phase 2:** ZITADEL deployment - NEXT
- ✅ **Phase 3:** OIDC Bridge deployment - COMPLETE
- ⏰ **Phase 4:** Configuration - PENDING
- ⏰ **Phase 5:** Testing & Production - PENDING

---

## Architecture Evolution

### OLD: Development Setup (DECOMMISSIONED ❌)
```
ZITADEL Cloud → Cloudflare Tunnel → Local Proxy → Kenni.is
```

### CURRENT: Hybrid Production (Oct 1, 2025)
```
┌─────────────────┐
│ ZITADEL Cloud   │ ← ⏰ TO BE REPLACED
│ (Free tier)     │
└────────┬────────┘
         │
┌────────▼────────┐
│ GCP Cloud Run   │ ← ✅ DEPLOYED Oct 1, 2025
│ OIDC Bridge     │
└────────┬────────┘
         │
┌────────▼────────┐
│ Kenni.is        │
└─────────────────┘
```

### TARGET: Full Self-Hosted Production
```
┌─────────────────────────┐
│ GCP ekklesia-prod       │
│ ┌─────────────────────┐ │
│ │ ZITADEL Self-Host   │ │ ← ⏰ NEXT
│ │ (Cloud Run)         │ │
│ └─────────┬───────────┘ │
│           │             │
│ ┌─────────▼───────────┐ │
│ │ Cloud SQL           │ │ ← ⏰ NEXT
│ │ PostgreSQL          │ │
│ └─────────────────────┘ │
│                         │
│ ┌─────────────────────┐ │
│ │ OIDC Bridge         │ │ ← ✅ DONE
│ │ (Cloud Run)         │ │
│ └─────────┬───────────┘ │
│           │             │
│ ┌─────────▼───────────┐ │
│ │ Secret Manager      │ │ ← ✅ DONE
│ └─────────────────────┘ │
└────────────┬────────────┘
             │
      ┌──────▼──────┐
      │  Kenni.is   │
      └─────────────┘
```

---

## ✅ Phase 1: GCP Project Setup (COMPLETE)

### Completed Tasks
- [x] Created project: `ekklesia-prod-10-2025`
- [x] Enabled billing (Account: 01EC55-5777F9-F0ED3F)
- [x] Enabled required APIs:
  - [x] Compute Engine
  - [x] Cloud Run
  - [x] Secret Manager
  - [x] Cloud SQL
  - [x] Container Registry
  - [x] Cloud Build
- [x] Configured IAM permissions
- [x] Added team members (gudrodur, agust)

**Completion Date:** September-October 2025  
**Status:** ✅ **PRODUCTION READY**

---

## ⏰ Phase 2: ZITADEL Self-Hosted Deployment (NEXT)

### 2.1 Database Setup (30 minutes)

**Create Cloud SQL PostgreSQL:**
```bash
# Create instance
gcloud sql instances create zitadel-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=europe-west2 \
  --storage-type=SSD \
  --storage-size=10GB \
  --storage-auto-increase \
  --backup-start-time=03:00 \
  --enable-bin-log \
  --retained-backups-count=7 \
  --project=ekklesia-prod-10-2025

# Create database
gcloud sql databases create zitadel \
  --instance=zitadel-db \
  --project=ekklesia-prod-10-2025

# Create user with secure password
DB_PASSWORD=$(openssl rand -base64 32)
gcloud sql users create zitadel \
  --instance=zitadel-db \
  --password="$DB_PASSWORD" \
  --project=ekklesia-prod-10-2025

# Store password in Secret Manager
echo -n "$DB_PASSWORD" | \
  gcloud secrets create zitadel-db-password \
    --data-file=- \
    --replication-policy=automatic \
    --project=ekklesia-prod-10-2025
```

**Estimated Time:** 30 minutes  
**Cost:** ~$7-10/month

### 2.2 ZITADEL Deployment to Cloud Run (1 hour)

**Deploy ZITADEL:**
```bash
# Deploy with all required configuration
gcloud run deploy zitadel \
  --image=ghcr.io/zitadel/zitadel:latest \
  --region=europe-west2 \
  --platform=managed \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --timeout=300 \
  --set-cloudsql-instances=ekklesia-prod-10-2025:europe-west2:zitadel-db \
  --set-secrets=ZITADEL_DATABASE_POSTGRES_PASSWORD=zitadel-db-password:latest \
  --set-env-vars="\
ZITADEL_DATABASE_POSTGRES_HOST=/cloudsql/ekklesia-prod-10-2025:europe-west2:zitadel-db,\
ZITADEL_DATABASE_POSTGRES_PORT=5432,\
ZITADEL_DATABASE_POSTGRES_DATABASE=zitadel,\
ZITADEL_DATABASE_POSTGRES_USER_USERNAME=zitadel,\
ZITADEL_DATABASE_POSTGRES_USER_SSL_MODE=disable,\
ZITADEL_EXTERNALSECURE=true,\
ZITADEL_TLS_ENABLED=false,\
ZITADEL_MASTERKEY=CHANGE_TO_SECURE_KEY,\
ZITADEL_FIRSTINSTANCE_ORG_NAME=Ekklesia" \
  --allow-unauthenticated \
  --project=ekklesia-prod-10-2025

# Get ZITADEL URL
ZITADEL_URL=$(gcloud run services describe zitadel \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025 \
  --format='value(status.url)')

echo "ZITADEL deployed at: $ZITADEL_URL"
```

**Estimated Time:** 1 hour (including setup)  
**Cost:** ~$2-5/month

### 2.3 Initial ZITADEL Setup

**Access and Configure:**
1. Open ZITADEL URL in browser
2. Complete setup wizard
3. Create admin user (save credentials!)
4. Create organization: "Ekklesia"
5. Note organization ID

**Estimated Time:** 15 minutes

**Status:** ⏰ **READY TO START**

---

## ✅ Phase 3: OIDC Bridge Proxy Deployment (COMPLETE)

### Completed Tasks
- [x] Created Dockerfile for Node.js proxy
- [x] Created cloudbuild.yaml for CI/CD
- [x] Configured Secret Manager access
- [x] Built and pushed Docker image
- [x] Deployed to Cloud Run (europe-west2)
- [x] Configured public access
- [x] Tested all OIDC endpoints
- [x] Verified health and discovery

**Service Details:**
- **URL:** https://oidc-bridge-proxy-ymzrguoifa-nw.a.run.app
- **Region:** europe-west2 (London, UK)
- **Memory:** 512MB
- **CPU:** 1 vCPU
- **Cost:** <$1/month (within free tier)

**Completion Date:** October 1, 2025  
**Status:** ✅ **PRODUCTION READY**

### Verified Endpoints
- ✅ `/health` - Health check
- ✅ `/.well-known/openid-configuration` - Discovery
- ✅ `/.well-known/jwks.json` - Public keys
- ✅ `/authorize` - Authorization
- ✅ `/token` - Token exchange
- ✅ `/userinfo` - User information

---

## ⏰ Phase 4: Configuration (NEXT - 1 hour)

### 4.1 Configure Kenni.is in ZITADEL

**Add External Identity Provider:**

1. **Login to ZITADEL admin console**
2. **Navigate:** Settings → Identity Providers
3. **Add Provider:** Generic OIDC

**Provider Configuration:**
```yaml
Name: Kenni.is
Type: Generic OIDC
Issuer: https://oidc-bridge-proxy-ymzrguoifa-nw.a.run.app
Discovery: https://oidc-bridge-proxy-ymzrguoifa-nw.a.run.app/.well-known/openid-configuration
```

**Get Client Credentials:**
```bash
# Retrieve from Secret Manager
CLIENT_ID=$(gcloud secrets versions access latest \
  --secret=kenni-client-id \
  --project=ekklesia-prod-10-2025)

CLIENT_SECRET=$(gcloud secrets versions access latest \
  --secret=kenni-client-secret \
  --project=ekklesia-prod-10-2025)

echo "Client ID: $CLIENT_ID"
echo "Client Secret: $CLIENT_SECRET"
```

**Scopes:**
```
openid
profile
email
national_id
phone_number
```

**Claims Mapping:**
- `sub` → `national_id`
- `email` → `email`
- `name` → `name`
- `phone_number` → `phone`
- `national_id` → `national_id`

### 4.2 Create Application

**Create OIDC Application in ZITADEL:**

1. **Navigate:** Projects → Ekklesia → Applications
2. **Create Application:** OIDC Web Application
3. **Name:** Ekklesia Voting System
4. **Type:** Web Application
5. **Auth Method:** Code + PKCE
6. **Redirect URIs:** 
   - Development: `http://localhost:5000/callback`
   - Production: `https://ekklesia.is/callback`
7. **Post Logout URIs:**
   - Development: `http://localhost:5000`
   - Production: `https://ekklesia.is`

**Save Client ID and Secret**

**Estimated Time:** 1 hour  
**Status:** ⏰ **PENDING**

---

## ⏰ Phase 5: Testing & Integration (NEXT - 30 min)

### 5.1 Test Authentication Flow

**Test Steps:**
1. Open ekklesia app
2. Click "Login with Kenni.is"
3. Redirects to ZITADEL
4. Redirects to OIDC Bridge
5. Redirects to Kenni.is
6. Login with credentials
7. Redirects back to ZITADEL
8. Redirects back to ekklesia app
9. Verify user logged in
10. Check user claims

**Monitor During Testing:**
```bash
# ZITADEL logs
gcloud run services logs tail zitadel --region=europe-west2

# OIDC Bridge logs
gcloud run services logs tail oidc-bridge-proxy --region=europe-west2
```

### 5.2 Update Ekklesia Configuration

**Update Application Config:**
```yaml
# Old (Cloud ZITADEL)
authority: https://sosi-auth-nocfrq.us1.zitadel.cloud

# New (Self-hosted)
authority: https://zitadel-SERVICE_ID-nw.a.run.app
client_id: YOUR_NEW_CLIENT_ID
client_secret: YOUR_NEW_CLIENT_SECRET
```

**Estimated Time:** 30 minutes  
**Status:** ⏰ **PENDING**

---

## ⏰ Phase 6: Production Hardening (LATER - 4-8 hours)

### 6.1 Custom Domain Setup

**Configure DNS:**
```bash
# Reserve static IP
gcloud compute addresses create zitadel-ip \
  --global \
  --project=ekklesia-prod-10-2025

# Get IP address
gcloud compute addresses describe zitadel-ip \
  --global \
  --format="value(address)"

# Add DNS records:
# auth.ekklesia.is → STATIC_IP
```

**Create SSL Certificate:**
```bash
# Google-managed certificate
gcloud compute ssl-certificates create zitadel-cert \
  --domains=auth.ekklesia.is \
  --global \
  --project=ekklesia-prod-10-2025
```

### 6.2 Monitoring & Alerting

**Setup Cloud Monitoring:**
```bash
# Create notification channel (email)
gcloud alpha monitoring channels create \
  --display-name="Ekklesia Alerts" \
  --type=email \
  --channel-labels=email_address=gudrodur@sosialistaflokkurinn.is

# Create uptime check
gcloud monitoring uptime-checks create http zitadel-health \
  --resource-type=uptime-url \
  --hostname=auth.ekklesia.is \
  --path=/debug/healthz
```

**Setup Alerts:**
- High error rate (>5%)
- High latency (>1s)
- Service down
- Database connection failures

### 6.3 Backup Strategy

**Automated Backups (Already Configured):**
- Daily backups at 03:00 UTC
- 7-day retention
- Point-in-time recovery enabled

**Test Backup Restore:**
```bash
# Create test restore
gcloud sql backups list --instance=zitadel-db

# Restore to new instance (test)
gcloud sql backups restore BACKUP_ID \
  --backup-instance=zitadel-db \
  --backup-id=BACKUP_ID
```

### 6.4 Security Audit

**Checklist:**
- [ ] All secrets in Secret Manager (no env vars)
- [ ] IAM permissions minimal (least privilege)
- [ ] SSL/TLS enabled everywhere
- [ ] Database encryption at rest
- [ ] Network security configured
- [ ] Audit logging enabled
- [ ] MFA enabled for admins
- [ ] Security scanning enabled

**Estimated Time:** 4-8 hours  
**Status:** ⏰ **FUTURE**

---

## Migration Checklist

### Pre-Migration
- [x] GCP project created
- [x] Billing enabled
- [x] APIs enabled
- [x] OIDC Bridge deployed
- [ ] Database created
- [ ] ZITADEL deployed
- [ ] Configuration complete
- [ ] Testing complete

### During Migration
- [ ] Backup current ZITADEL Cloud config
- [ ] Export users (if possible)
- [ ] Create projects in self-hosted
- [ ] Configure IdPs
- [ ] Create applications
- [ ] Update app configs
- [ ] Test authentication
- [ ] Monitor for errors

### Post-Migration
- [ ] Verify all users can login
- [ ] Check all applications work
- [ ] Monitor performance
- [ ] Document issues
- [ ] Keep Cloud ZITADEL as backup (30 days)
- [ ] Decommission old setup

---

## Rollback Plan

**If Issues Occur:**

### Immediate (<1 hour)
1. Update app configs back to Cloud ZITADEL
2. Notify users
3. Investigate issues
4. Keep GCP running in parallel

### Delayed (>1 hour)
1. Fix issues in self-hosted
2. Re-test thoroughly
3. Plan new migration window
4. Try again when ready

**Rollback is easy:** Just change app configuration URLs back to Cloud ZITADEL.

---

## Cost Analysis

### Current Monthly Costs
- OIDC Bridge (Cloud Run): <$1 ✅
- ZITADEL Cloud (free tier): $0 ⏰
- Secret Manager: ~$0.06
- **Total: ~$1/month**

### After Self-Hosting
- Cloud SQL: $7-10
- ZITADEL (Cloud Run): $2-5
- OIDC Bridge: <$1
- Secret Manager: ~$0.10
- **Total: ~$10-15/month**

### Comparison
- Cloud ZITADEL (paid): $20-50+/month
- Self-hosted: $10-15/month
- **Savings: 50-70%** ✅

### With Free Credits
- $300 credits available
- Covers ~20-30 months
- **Essentially free for 2+ years** 🎉

---

## Timeline

| Phase | Time | Status | Date |
|-------|------|--------|------|
| 1. GCP Setup | 4 hours | ✅ Done | Sep-Oct 2025 |
| 3. OIDC Bridge | 4 hours | ✅ Done | Oct 1, 2025 |
| 2. Database | 30 min | ⏰ Next | TBD |
| 2. ZITADEL Deploy | 1 hour | ⏰ Next | TBD |
| 4. Configuration | 1 hour | ⏰ Pending | TBD |
| 5. Testing | 30 min | ⏰ Pending | TBD |
| 6. Hardening | 4-8 hours | ⏰ Future | TBD |
| **Basic Total** | **~3-4 hours** | **⏰ Ready** | **Today?** |
| **Full Total** | **~7-12 hours** | **⏰ Future** | **This month** |

---

## Team Responsibilities

### Anyone Can Do (Basic Setup)
- Database creation
- ZITADEL deployment
- Configuration
- Testing

**Time:** ~3-4 hours  
**Documented:** Complete step-by-step guides

### Coordination Needed (Production)
- Custom domain setup
- DNS configuration
- Security audit
- Load testing

**Time:** 4-8 hours  
**Requires:** Both team members

---

## Success Criteria

### Phase 2 (Database)
- [ ] Database instance created
- [ ] Database accessible
- [ ] Credentials stored
- [ ] Connection tested

### Phase 2 (ZITADEL)
- [ ] Service deployed
- [ ] Migrations completed
- [ ] Admin console accessible
- [ ] Organization created

### Phase 4 (Configuration)
- [ ] Kenni.is IdP configured
- [ ] Application created
- [ ] Test user can login
- [ ] Claims mapped correctly

### Phase 5 (Integration)
- [ ] Ekklesia app updated
- [ ] End-to-end works
- [ ] No errors in logs
- [ ] Performance acceptable

### Phase 6 (Production)
- [ ] Custom domain working
- [ ] SSL certificates valid
- [ ] Monitoring active
- [ ] Backups tested

---

## Documentation

### Available Guides
- **`ZITADEL_QUICKSTART.md`** - Step-by-step commands (350 lines)
- **`ZITADEL_SELFHOSTING_PLAN.md`** - Complete architecture (381 lines)
- **`SUMMARY.md`** - Quick overview
- **`CURRENT_STATUS.md`** - Detailed status (Íslenska)

### Reference
- **`README.md`** - Project overview
- **`DEPLOYMENT_SUCCESS.md`** - OIDC Bridge success
- **`IAM_TROUBLESHOOTING.md`** - Permission solutions

---

## Next Actions

### Immediate (Today)
1. **Read guides:**
   - `ZITADEL_QUICKSTART.md`
   - `ZITADEL_SELFHOSTING_PLAN.md`

2. **Start Phase 2:**
   - Create database (30 min)
   - Deploy ZITADEL (1 hour)

### Short-term (This Week)
3. **Complete Configuration:**
   - Setup Kenni.is IdP
   - Create application
   - Test authentication

4. **Update Ekklesia:**
   - Change configuration
   - Test end-to-end
   - Monitor logs

### Long-term (This Month)
5. **Production Ready:**
   - Custom domain
   - Advanced monitoring
   - Security audit
   - Full documentation

---

**Ready to continue?** 🚀  
Start with: `cat /home/gudro/dev/projects/ekklesia/gcp/ZITADEL_QUICKSTART.md`
