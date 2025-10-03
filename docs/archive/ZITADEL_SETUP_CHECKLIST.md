# ZITADEL Self-Hosting Setup Checklist

**Last Updated:** 2025-10-01  
**Status:** ✅ OIDC Bridge Ready | ⏰ ZITADEL Self-Hosting Next

---

## 🎯 Overview

**NEW PLAN:** Self-host ZITADEL on GCP instead of using cloud ZITADEL

**Why?**
- ✅ Full control over data and infrastructure
- ✅ 50-70% cost savings ($10-15/mth vs $20-50+/mth)
- ✅ No vendor lock-in
- ✅ Unlimited users (no 1000 user limit)
- ✅ Better integration with GCP ecosystem

---

## ✅ Phase 0: Prerequisites (COMPLETE)

### Infrastructure
- [x] GCP Project created (`ekklesia-prod-10-2025`)
- [x] Billing enabled with $300 credits
- [x] Required APIs enabled
- [x] IAM permissions configured
- [x] Secret Manager configured
- [x] OIDC Bridge Proxy deployed ✅

### Credentials
- [x] Kenni.is client_id stored
- [x] Kenni.is client_secret stored
- [x] Kenni.is issuer configured

### Team Access
- [x] gudrodur@sosialistaflokkurinn.is (Owner)
- [x] agust@sosialistaflokkurinn.is (Owner)

---

## ⏰ Phase 1: Database Setup (30 minutes)

### 1.1 Create Cloud SQL Instance
- [ ] Create PostgreSQL 15 instance
- [ ] Configure: db-f1-micro, europe-west2
- [ ] Enable automatic backups (daily, 7-day retention)
- [ ] Enable binary logging
- [ ] Configure auto-storage-increase

**Command Ready:** See `ZITADEL_QUICKSTART.md` Phase 1 Step 1

### 1.2 Create Database & User
- [ ] Create `zitadel` database
- [ ] Generate secure password (32 char)
- [ ] Create `zitadel` user with password
- [ ] Test connection

**Command Ready:** See `ZITADEL_QUICKSTART.md` Phase 1 Step 2

### 1.3 Store Credentials
- [ ] Store database password in Secret Manager
- [ ] Verify secret is accessible
- [ ] Document connection string

**Command Ready:** See `ZITADEL_QUICKSTART.md` Phase 1 Step 3

**Estimated Time:** 30 minutes  
**Cost:** ~$7-10/month

---

## ⏰ Phase 2: ZITADEL Deployment (1 hour)

### 2.1 Deploy ZITADEL to Cloud Run
- [ ] Pull official ZITADEL Docker image
- [ ] Configure environment variables
- [ ] Connect to Cloud SQL via Unix socket
- [ ] Set memory to 1GB, CPU to 1
- [ ] Configure auto-scaling (0-3 instances)
- [ ] Enable public access

**Command Ready:** See `ZITADEL_QUICKSTART.md` Phase 2 Step 1

### 2.2 Initial Setup
- [ ] Access ZITADEL admin console
- [ ] Complete setup wizard
- [ ] Create admin user (SAVE CREDENTIALS!)
- [ ] Note admin email and password

**Guide Available:** See `ZITADEL_QUICKSTART.md` Phase 2 Step 3

### 2.3 Organization Setup
- [ ] Create organization: "Ekklesia"
- [ ] Note organization ID
- [ ] Create project: "Ekklesia Voting"
- [ ] Note project ID

**Estimated Time:** 1 hour  
**Cost:** ~$2-5/month

---

## ⏰ Phase 3: Kenni.is Integration (1 hour)

### 3.1 Add External Identity Provider

**In ZITADEL Admin Console:**
- [ ] Navigate: Settings → Identity Providers
- [ ] Click "Add Provider"
- [ ] Select: Generic OIDC
- [ ] Name: `Kenni.is`

**Configuration:**
```yaml
Issuer: https://oidc-bridge-proxy-ymzrguoifa-nw.a.run.app
Discovery: https://oidc-bridge-proxy-ymzrguoifa-nw.a.run.app/.well-known/openid-configuration
```

**Retrieve Credentials:**
```bash
# From Secret Manager
gcloud secrets versions access latest --secret=kenni-client-id
gcloud secrets versions access latest --secret=kenni-client-secret
```

**Scopes:**
- [ ] `openid`
- [ ] `profile`
- [ ] `email`
- [ ] `national_id`
- [ ] `phone_number`

**Guide Available:** See `ZITADEL_QUICKSTART.md` Phase 3 Step 1-2

### 3.2 Configure Claims Mapping

**Map Claims:**
- [ ] `sub` → `national_id`
- [ ] `email` → `email`
- [ ] `name` → `name`
- [ ] `phone_number` → `phone`
- [ ] `national_id` → `national_id` (custom)

### 3.3 Create Application

**Application Settings:**
- [ ] Type: Web Application
- [ ] Name: `Ekklesia Voting System`
- [ ] Auth Method: Authorization Code + PKCE
- [ ] Redirect URIs configured (dev + prod)
- [ ] Post-logout URIs configured
- [ ] Client ID saved
- [ ] Client secret saved (if needed)

**Estimated Time:** 1 hour

---

## ⏰ Phase 4: Testing & Integration (30 minutes)

### 4.1 Test Authentication Flow

**Test Steps:**
- [ ] Open ekklesia app
- [ ] Click "Login with Kenni.is"
- [ ] Redirects to self-hosted ZITADEL
- [ ] Redirects to OIDC Bridge
- [ ] Redirects to Kenni.is
- [ ] Login with test credentials
- [ ] Redirects back to ZITADEL
- [ ] Redirects back to ekklesia
- [ ] User logged in successfully

**Monitor Logs:**
```bash
# ZITADEL
gcloud run services logs tail zitadel --region=europe-west2

# OIDC Bridge
gcloud run services logs tail oidc-bridge-proxy --region=europe-west2
```

### 4.2 Verify User Data

**Check:**
- [ ] User created in ZITADEL
- [ ] National ID (kennitala) mapped correctly
- [ ] Email present
- [ ] Name present
- [ ] Phone number present (if provided)

### 4.3 Update Ekklesia Configuration

**Old Configuration (Cloud ZITADEL):**
```yaml
authority: https://sosi-auth-nocfrq.us1.zitadel.cloud
```

**New Configuration (Self-hosted):**
```yaml
authority: https://zitadel-XXXXX.a.run.app
client_id: NEW_CLIENT_ID
client_secret: NEW_CLIENT_SECRET (if needed)
```

**Estimated Time:** 30 minutes

---

## ⏰ Phase 5: Production Hardening (Later - 4-8 hours)

### 5.1 Custom Domain
- [ ] Reserve static IP in GCP
- [ ] Configure DNS (auth.ekklesia.is)
- [ ] Create SSL certificate (managed)
- [ ] Configure load balancer
- [ ] Test HTTPS access
- [ ] Update ZITADEL issuer URL

### 5.2 Security
- [ ] Enable MFA for admin accounts
- [ ] Configure password policies
- [ ] Enable audit logging
- [ ] Review IAM permissions
- [ ] Security scanning enabled
- [ ] Secrets rotation policy

### 5.3 Monitoring
- [ ] Setup uptime checks
- [ ] Configure error alerts (>5% error rate)
- [ ] Configure latency alerts (>1s)
- [ ] Setup log-based metrics
- [ ] Create monitoring dashboard
- [ ] Configure notification channels

### 5.4 Backup & Recovery
- [ ] Verify automatic backups working
- [ ] Test backup restore
- [ ] Document recovery procedures
- [ ] Setup backup alerts
- [ ] Test point-in-time recovery

### 5.5 Documentation
- [ ] Admin runbook
- [ ] User guide
- [ ] Troubleshooting guide
- [ ] Architecture diagram
- [ ] Incident response plan

**Estimated Time:** 4-8 hours  
**Priority:** Medium (can be done later)

---

## 📊 Progress Tracking

### Overall Status
```
Phase 0: Prerequisites      ████████████████████ 100% ✅ DONE
Phase 1: Database Setup     ░░░░░░░░░░░░░░░░░░░░   0% ⏰ NEXT
Phase 2: ZITADEL Deploy     ░░░░░░░░░░░░░░░░░░░░   0% ⏰ TODO
Phase 3: Kenni.is Setup     ░░░░░░░░░░░░░░░░░░░░   0% ⏰ TODO
Phase 4: Testing            ░░░░░░░░░░░░░░░░░░░░   0% ⏰ TODO
Phase 5: Hardening          ░░░░░░░░░░░░░░░░░░░░   0% ⏰ LATER
```

### Time Estimates
- **Basic Setup (Phases 1-4):** ~3-4 hours
- **Production Ready (Phase 5):** +4-8 hours
- **Total:** ~7-12 hours

### Current Sprint: Basic Setup
**Goal:** Get self-hosted ZITADEL working with Kenni.is  
**Time:** ~3-4 hours  
**Can do:** Today or this week

---

## 🎯 Success Criteria

### Phase 1 Success
- [ ] Database instance running and accessible
- [ ] Credentials stored securely
- [ ] Connection tested from Cloud Run

### Phase 2 Success
- [ ] ZITADEL deployed to Cloud Run
- [ ] Admin console accessible
- [ ] Database migrations completed
- [ ] Organization and project created

### Phase 3 Success
- [ ] Kenni.is configured as external IdP
- [ ] Application created in ZITADEL
- [ ] All scopes and claims configured

### Phase 4 Success
- [ ] End-to-end authentication working
- [ ] User data mapped correctly
- [ ] No errors in logs
- [ ] Ekklesia app updated

### Phase 5 Success (Later)
- [ ] Custom domain working
- [ ] HTTPS enabled with valid certificate
- [ ] Monitoring and alerts active
- [ ] Backups tested
- [ ] Documentation complete

---

## 💰 Cost Summary

### Current
- OIDC Bridge: <$1/month ✅
- **Total: ~$0-1/month**

### After Basic Setup
- Cloud SQL: $7-10/month
- ZITADEL: $2-5/month
- OIDC Bridge: <$1/month
- **Total: ~$10-15/month**

### With Free Credits
- $300 credits available
- Covers ~20-30 months
- **Essentially free for 2+ years** 🎉

---

## 📚 Documentation Links

### Implementation Guides
- **Quick Start:** `ZITADEL_QUICKSTART.md` (350 lines)
- **Full Plan:** `ZITADEL_SELFHOSTING_PLAN.md` (381 lines)
- **Migration:** `GCP_MIGRATION_PLAN.md` (627 lines)

### Status & Reference
- **Summary:** `SUMMARY.md`
- **Current Status:** `CURRENT_STATUS.md` (Íslenska)
- **Architecture:** `ARCHITECTURE_DEV_VS_PROD.md`

### Troubleshooting
- **IAM Issues:** `IAM_TROUBLESHOOTING.md`
- **Public Access:** `FIX_PUBLIC_ACCESS_CONSOLE.md`

---

## 🚀 Getting Started

### Option 1: Start Now (Recommended)
```bash
cd /home/gudro/dev/projects/ekklesia/gcp

# Read quick start
cat ZITADEL_QUICKSTART.md

# Start Phase 1: Database
# Follow commands in ZITADEL_QUICKSTART.md
```

### Option 2: Review First
```bash
# Read full implementation plan
cat ZITADEL_SELFHOSTING_PLAN.md

# Review architecture
cat /home/gudro/dev/projects/ekklesia/docs/ARCHITECTURE_DEV_VS_PROD.md

# Check migration plan
cat /home/gudro/dev/projects/ekklesia/docs/GCP_MIGRATION_PLAN.md
```

### Option 3: Quick Command Reference
```bash
# List all guides
ls /home/gudro/dev/projects/ekklesia/gcp/*.md

# Search for specific topics
grep -r "database" /home/gudro/dev/projects/ekklesia/gcp/*.md
```

---

## ✅ Pre-Start Checklist

Before starting Phase 1, verify:
- [x] GCP project access (gudrodur or agust)
- [x] gcloud CLI installed and configured
- [x] Billing enabled
- [x] OIDC Bridge deployed and working
- [ ] 3-4 hours available for basic setup
- [ ] Coffee ready ☕

---

## 📞 Support

**Questions or Issues?**
- Check documentation first
- Review troubleshooting guides
- Check GCP Console logs
- Ask team members

**Key People:**
- gudrodur@sosialistaflokkurinn.is
- agust@sosialistaflokkurinn.is

---

## 🎉 Milestones

### Completed ✅
- **Oct 1, 2025:** OIDC Bridge deployed to GCP
- **Oct 1, 2025:** Public access configured
- **Oct 1, 2025:** All endpoints tested and working
- **Oct 1, 2025:** Documentation created

### Next Milestones ⏰
- **TBD:** Database created
- **TBD:** ZITADEL deployed
- **TBD:** Kenni.is integrated
- **TBD:** End-to-end authentication working
- **TBD:** Production ready

---

**Ready to start?** 🚀  
Begin with: `cat /home/gudro/dev/projects/ekklesia/gcp/ZITADEL_QUICKSTART.md`
