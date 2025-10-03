# 🏗️ ZITADEL Self-Hosting á GCP - Implementation Plan

**Dagsetning:** 2025-10-02
**Markmið:** Migrate frá cloud ZITADEL yfir í self-hosted ZITADEL á GCP
**Staða:** ✅ Phase 0-2 Complete | ⏰ Phase 3 Next (Initial Setup & Configuration)

---

## 🎯 Af hverju Self-Host ZITADEL?

### Kostir:
- ✅ **Full control** - Eigum öll gögn og infrastructure
- ✅ **Data sovereignty** - Öll data í okkar GCP project
- ✅ **Cost optimization** - Borgum bara fyrir það sem við notum
- ✅ **Customization** - Getum breytt því sem við viljum
- ✅ **No vendor lock-in** - Óháð cloud ZITADEL pricing
- ✅ **Better integration** - Allt í sama GCP ecosystem

### Ókostir (og hvernig við leysum þá):
- ⚠️ Þurfum að maintain infrastructure → Nota managed services (Cloud SQL, Cloud Run)
- ⚠️ Þurfum að handle backups → Automatic Cloud SQL backups
- ⚠️ Þurfum að monitor → Cloud Monitoring & Logging
- ⚠️ Updates og patches → Docker containers með automatic deploys

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        GCP Project                           │
│                   ekklesia-prod-10-2025                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐         ┌────────────────────┐         │
│  │   Cloud Run     │         │  Cloud SQL         │         │
│  │                 │         │  PostgreSQL        │         │
│  │  ZITADEL        │◄────────┤                    │         │
│  │  self-hosted    │         │  ZITADEL database  │         │
│  │                 │         │                    │         │
│  └────────┬────────┘         └────────────────────┘         │
│           │                                                  │
│           │ Uses OIDC Bridge                                │
│           ▼                                                  │
│  ┌─────────────────┐         ┌────────────────────┐         │
│  │   Cloud Run     │         │  Secret Manager    │         │
│  │                 │         │                    │         │
│  │  OIDC Bridge    │◄────────┤  - Kenni secrets   │         │
│  │  Proxy          │         │  - ZITADEL keys    │         │
│  │  (deployed!)    │         │  - DB passwords    │         │
│  └─────────────────┘         └────────────────────┘         │
│                                                               │
└─────────────────────────────────────────────────────────────┘

External Users
      │
      ▼
   ZITADEL
      │
      ▼
 OIDC Bridge Proxy
      │
      ▼
   Kenni.is
```

---

## 📋 Implementation Phases

### Phase 1: Database Setup (✅ COMPLETE - Oct 2, 2025)
**Goal:** Set up PostgreSQL database fyrir ZITADEL

**Completed Tasks:**
1. ✅ Cloud SQL PostgreSQL instance created (zitadel-db)
2. ✅ Database created (zitadel2 - fresh initialization)
3. ✅ User created (zitadel)
4. ✅ Password stored í Secret Manager (zitadel-db-password)
5. ✅ Backups configured (daily at 03:00, 7 day retention)

**Instance Details:**
- Type: db-f1-micro (0.6GB RAM, shared CPU)
- Storage: 10GB SSD with auto-resize
- Region: europe-west2-c
- Status: RUNNABLE
- Connection: ekklesia-prod-10-2025:europe-west2:zitadel-db
- Active Database: zitadel2 (previous zitadel db deprecated due to domain mismatch)

**Completed:** October 1-2, 2025

---

### Phase 2: ZITADEL Deployment (✅ COMPLETE - Oct 2, 2025)
**Goal:** Deploy self-hosted ZITADEL til Cloud Run

**Completed Tasks:**
1. ✅ Built ZITADEL Docker image (gcr.io/ekklesia-prod-10-2025/zitadel:latest)
2. ✅ Deployed to Cloud Run with correct configuration
3. ✅ Connected to Cloud SQL database (zitadel2)
4. ✅ Fixed domain mismatch issue (using zitadel-ymzrguoifa-nw.a.run.app)
5. ✅ Fixed Docker binary path (command: /app/zitadel)
6. ✅ Enabled public access (invoker-iam-disabled annotation)
7. ✅ Ran initial database migrations
8. ✅ Console accessible at https://zitadel-ymzrguoifa-nw.a.run.app/ui/console

**Service Details:**
- URL: https://zitadel-ymzrguoifa-nw.a.run.app
- Console: https://zitadel-ymzrguoifa-nw.a.run.app/ui/console
- Login: https://zitadel-ymzrguoifa-nw.a.run.app/ui/login/
- Region: europe-west2
- Memory: 512Mi
- CPU: 1 vCPU
- Max Instances: 3
- Command: `/app/zitadel start-from-init --masterkey=... --tlsMode=disabled`
- External Domain: zitadel-ymzrguoifa-nw.a.run.app
- Database: zitadel2

**Issues Fixed:**
1. ✅ Domain mismatch ("Instance not found") - Created fresh DB with correct domain
2. ✅ Docker binary path - Binary is at /app/zitadel, not in PATH
3. ✅ Public access 403 errors - Added invoker-iam-disabled annotation
4. ✅ Database connection pool - Using fresh database resolved FATAL errors

**Completed:** October 2, 2025

---

### Phase 3: Initial Setup & Configuration (⏰ IN PROGRESS)
**Goal:** Set up ZITADEL instance and configure Kenni.is integration

**Tasks:**
1. ⏰ Access ZITADEL console (https://zitadel-ymzrguoifa-nw.a.run.app/ui/console)
2. ⏰ Create first admin user
3. ⏰ Set up organization (Ekklesia)
4. ⏰ Add Kenni.is as external Identity Provider
5. ⏰ Configure OIDC settings for Kenni.is
   - Issuer: https://oidc-bridge-proxy-ymzrguoifa-nw.a.run.app
   - Discovery: https://oidc-bridge-proxy-ymzrguoifa-nw.a.run.app/.well-known/openid-configuration
6. ⏰ Set up claims mapping
7. ⏰ Test authentication flow

**Estimated Time:** 1-2 hours

---

### Phase 4: Migration frá Cloud ZITADEL (⏰ PENDING)
**Goal:** Move users og settings frá cloud til self-hosted

**Tasks:**
1. Export users frá cloud ZITADEL (ef possible)
2. Export configuration
3. Import til self-hosted
4. Update ekklesia app configuration
5. Test end-to-end
6. Monitor fyrir errors

**Estimated time:** 2-4 hours

---

### Phase 5: Production Hardening (⏰ PENDING)
**Goal:** Make it production-ready

**Tasks:**
1. Set up custom domain (auth.ekklesia.is?)
2. Configure SSL certificates
3. Set up monitoring og alerting
4. Configure automatic backups
5. Set up disaster recovery plan
6. Load testing
7. Security audit
8. Documentation

**Estimated time:** 4-8 hours

---

## 💰 Cost Estimate

### Cloud SQL PostgreSQL
- **Instance:** db-f1-micro (shared CPU, 0.6GB RAM)
- **Storage:** 10GB SSD
- **Backup:** 7 days automatic
- **Cost:** ~$7-10/month

### Cloud Run (ZITADEL)
- **Memory:** 512MB-1GB
- **CPU:** 1 vCPU
- **Requests:** Minimal (authentication only)
- **Cost:** ~$2-5/month (likely within free tier)

### Cloud Run (OIDC Bridge) - Already deployed!
- **Cost:** < $1/month (within free tier)

### Total Estimated Cost
**~$10-15/month** vs **$20-50+/month** fyrir cloud ZITADEL

---

## 🚀 Quick Start Commands

### 1. Create Cloud SQL Instance
```bash
# Create PostgreSQL instance
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

# Create user
gcloud sql users create zitadel \
  --instance=zitadel-db \
  --password=GENERATE_SECURE_PASSWORD \
  --project=ekklesia-prod-10-2025
```

### 2. Store Database Credentials
```bash
# Store password in Secret Manager
echo -n "YOUR_SECURE_PASSWORD" | \
  gcloud secrets create zitadel-db-password \
    --data-file=- \
    --replication-policy=automatic \
    --project=ekklesia-prod-10-2025

# Store connection string
echo -n "postgresql://zitadel:PASSWORD@/zitadel?host=/cloudsql/ekklesia-prod-10-2025:europe-west2:zitadel-db" | \
  gcloud secrets create zitadel-db-connection \
    --data-file=- \
    --replication-policy=automatic \
    --project=ekklesia-prod-10-2025
```

### 3. Deploy ZITADEL
```bash
# Deploy to Cloud Run
gcloud run deploy zitadel \
  --image=ghcr.io/zitadel/zitadel:latest \
  --region=europe-west2 \
  --platform=managed \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --set-cloudsql-instances=ekklesia-prod-10-2025:europe-west2:zitadel-db \
  --set-secrets=ZITADEL_DATABASE_POSTGRES_PASSWORD=zitadel-db-password:latest \
  --set-env-vars="ZITADEL_DATABASE_POSTGRES_HOST=/cloudsql/ekklesia-prod-10-2025:europe-west2:zitadel-db,ZITADEL_DATABASE_POSTGRES_PORT=5432,ZITADEL_DATABASE_POSTGRES_DATABASE=zitadel,ZITADEL_DATABASE_POSTGRES_USER_USERNAME=zitadel,ZITADEL_DATABASE_POSTGRES_USER_SSL_MODE=disable,ZITADEL_EXTERNALSECURE=true,ZITADEL_TLS_ENABLED=false" \
  --allow-unauthenticated \
  --project=ekklesia-prod-10-2025
```

---

## 📊 Implementation Timeline

### Dag 1 (Oct 1-2, 2025) - ✅ Started
- ✅ OIDC Bridge Proxy (DONE - Oct 1!)
- ✅ Set up Cloud SQL (DONE - Oct 1!)
- ⏰ Deploy ZITADEL (NEXT - Oct 2)
- ⏰ Basic configuration

### Dag 2 (2-3 klst)
- ⏰ Configure Kenni.is integration
- ⏰ Test authentication flows
- ⏰ Begin migration

### Dag 3-7 (4-8 klst)
- ⏰ Complete migration
- ⏰ Custom domain + SSL
- ⏰ Monitoring + backups
- ⏰ Production hardening
- ⏰ Documentation

**Total:** ~8-14 hours across 3-7 days  
**Progress:** ~30% complete (Database + OIDC Bridge ready)

---

## ✅ Prerequisites

- [x] GCP Project created (ekklesia-prod-10-2025)
- [x] OIDC Bridge Proxy deployed og virkar
- [x] Kenni.is credentials í Secret Manager
- [x] Billing enabled
- [x] APIs enabled (Cloud SQL, Cloud Run, Secret Manager)
- [x] **Cloud SQL PostgreSQL created (zitadel-db)** ✅ NEW
- [x] **Database and user configured** ✅ NEW
- [x] **Database password in Secret Manager** ✅ NEW
- [ ] Domain fyrir ZITADEL (t.d. auth.ekklesia.is)
- [ ] SSL certificate (can use managed cert)

---

## 🎯 Success Criteria

### Technical
- [ ] ZITADEL running on Cloud Run
- [ ] Connected to Cloud SQL PostgreSQL
- [ ] Admin console accessible
- [ ] Kenni.is authentication virkar
- [ ] Users can login via ekklesia app
- [ ] Automatic backups configured
- [ ] Monitoring set up

### Business
- [ ] Users migrated frá cloud ZITADEL
- [ ] All authentication flows virka
- [ ] Performance meets requirements (<500ms)
- [ ] Cost within budget (<$15/month)
- [ ] Documented fyrir maintenance

---

## 📚 Resources

### ZITADEL Documentation
- Self-hosting guide: https://zitadel.com/docs/self-hosting/deploy/compose
- Cloud Run deployment: https://zitadel.com/docs/self-hosting/deploy/cloudrun
- Configuration: https://zitadel.com/docs/self-hosting/manage/configure

### GCP Documentation
- Cloud SQL: https://cloud.google.com/sql/docs/postgres
- Cloud Run: https://cloud.google.com/run/docs
- Secret Manager: https://cloud.google.com/secret-manager/docs

---

## 🔒 Security Considerations

### Network Security
- ✅ Use Cloud SQL private IP (recommended)
- ✅ Cloud Run to Cloud SQL via Unix socket
- ✅ Secrets í Secret Manager (never in env vars)
- ✅ TLS/SSL fyrir all external connections

### Authentication
- ✅ ZITADEL admin með strong password
- ✅ MFA fyrir admin accounts
- ✅ Service accounts með minimal permissions
- ✅ Regular security audits

### Data Protection
- ✅ Automatic daily backups (7 day retention)
- ✅ Point-in-time recovery enabled
- ✅ Encryption at rest og in transit
- ✅ Regular backup testing

---

## 🆘 Troubleshooting Guide

### Common Issues

**1. Cloud SQL Connection Failed**
- Check Cloud SQL instance is running
- Verify Cloud Run has cloudsql-instances set
- Check Unix socket path
- Verify credentials in Secret Manager

**2. ZITADEL Initialization Failed**
- Check database migrations ran
- Verify database permissions
- Check ZITADEL logs: `gcloud run services logs read zitadel`
- Try manual migration if needed

**3. Kenni.is Authentication Not Working**
- Verify OIDC Bridge Proxy URL in ZITADEL config
- Check client_id and client_secret
- Test OIDC Bridge endpoints directly
- Check ZITADEL logs fyrir errors

---

## 🎉 Næstu Skref

Viltu að ég:

1. **Start með ZITADEL Deployment?** ✅ READY!
   - Deploy ZITADEL til Cloud Run
   - Connect til zitadel-db database
   - Run initial setup
   - Access admin console

2. **Review Deployment Plan?**
   - Check ZITADEL configuration
   - Review environment variables
   - Verify database connection settings

3. **Something else?**
   - Test database connection
   - Review cost estimates
   - Plan migration strategy

**Hvað viltu byrja á?** 🚀

---

**Current Status:**
- ✅ Phase 0: OIDC Bridge Proxy deployed og virkar
- ✅ Phase 1: Database setup - **COMPLETE!**
- ✅ Phase 2: ZITADEL deployment - **COMPLETE!**
- ⏰ Phase 3: Initial Setup & Configuration - **IN PROGRESS**
- ⏰ Phase 4: Migration - Pending
- ⏰ Phase 5: Production hardening - Pending

---

## 🔧 Troubleshooting Guide (Lessons Learned)

### Issue 1: "Instance not found" / Domain Mismatch
**Error:** `unable to set instance using origin {zitadel-....run.app} (ExternalDomain is auth.ekklesia.is): ID=QUERY-1kIjX Message=Instance not found`

**Root Cause:** ZITADEL instance was initialized with one domain but accessed via another

**Solution:**
1. Delete ZITADEL service: `gcloud run services delete zitadel --region=europe-west2 --quiet`
2. Create fresh database: `gcloud sql databases create zitadel2 --instance=zitadel-db`
3. Redeploy with correct `ZITADEL_EXTERNALDOMAIN` matching Cloud Run URL

**Key Learning:** The domain must match exactly between EXTERNALDOMAIN env var and the URL used to access ZITADEL

### Issue 2: Container Fails - "executable 'zitadel' not found in PATH"
**Error:** `failed to resolve binary path: error finding executable "zitadel" in PATH`

**Root Cause:** ZITADEL binary is at `/app/zitadel`, not in system PATH

**Solution:**
```bash
--command="/app/zitadel" \
--args="start-from-init" \
--args="--masterkey=MasterkeyNeedsToHave32Characters" \
--args="--tlsMode=disabled"
```

**Key Learning:** Always check official image Dockerfile for binary location

### Issue 3: 403 Forbidden on Public Access
**Error:** All requests return 403 Forbidden

**Root Cause:** Cloud Run requires either IAM bindings OR invoker-iam-disabled annotation

**Solution:**
```bash
gcloud run services update zitadel \
  --region=europe-west2 \
  --update-annotations="run.googleapis.com/invoker-iam-disabled=true"
```

**Alternative:** Organization policy may block public IAM bindings, so annotation method is more reliable

### Issue 4: Database Connection Pool Exhausted
**Error:** `FATAL: remaining connection slots are reserved for non-replication superuser connections`

**Root Cause:** db-f1-micro has limited connections (~25), ZITADEL may exhaust pool

**Solutions:**
1. Use fresh database (resolved previous connection leaks)
2. Upgrade to db-g1-small (100 connections)
3. Configure ZITADEL connection pool limits

**Key Learning:** Monitor connection count and upgrade tier if needed

### Best Practices for ZITADEL on Cloud Run

1. ✅ **Always use fresh database** when changing external domain
2. ✅ **Use Cloud Run URL as EXTERNALDOMAIN** (e.g., `service-hash.region.run.app`)
3. ✅ **Set command explicitly** to `/app/zitadel start-from-init`
4. ✅ **Use invoker-iam-disabled annotation** for public access
5. ✅ **Test in order:** Health → Logs → Console → Login
6. ✅ **Keep database tier appropriate** for connection count needs
