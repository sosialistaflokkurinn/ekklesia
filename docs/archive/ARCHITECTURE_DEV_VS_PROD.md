# Authentication Architecture - Current Status & Future Plans

**Last Updated:** 2025-10-01  
**Status:** ✅ OIDC Bridge Deployed on GCP | ⏰ ZITADEL Self-Hosting Next

---

## Current State: Hybrid Development/Production

### What's Live NOW ✅
- **OIDC Bridge Proxy** - Deployed on GCP Cloud Run (production-ready!)
- **Kenni.is Integration** - Working via OIDC Bridge
- **Cloud ZITADEL** - Still using free tier (temporary)

### Current Architecture
```
┌─────────────────────────────────┐
│ ZITADEL Cloud (Free Tier)       │ ← ⏰ TO BE REPLACED with self-hosted
│ sosi-auth-nocfrq.us1.zitadel.   │    Limited to 1000 users
│ cloud                           │
└────────────┬────────────────────┘
             │ OIDC
┌────────────▼────────────────────┐
│ GCP Cloud Run                   │ ← ✅ PRODUCTION READY!
│ OIDC Bridge Proxy               │    europe-west2 (London)
│ oidc-bridge-proxy-ymzrguoifa    │    Auto-scaling
│ -nw.a.run.app                   │    Public access enabled
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│ GCP Secret Manager              │ ← ✅ PRODUCTION READY!
│ - kenni-client-id               │    Encrypted storage
│ - kenni-client-secret           │    IAM controlled
│ - kenni-issuer                  │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│ Kenni.is (Production)           │ ← ✅ PRODUCTION READY!
│ idp.kenni.is                   │
└─────────────────────────────────┘
```

### What's Production Ready Now ✅
- ✅ OIDC Bridge Proxy on Cloud Run
- ✅ Secret Manager for credentials
- ✅ Public access properly configured
- ✅ Automatic scaling enabled
- ✅ Monitoring and logging active
- ✅ High availability (multi-zone)

### What's Still Temporary ⏰
- ⏰ ZITADEL Cloud (free tier, limited)
- ⏰ No custom domain (using .run.app)
- ⏰ Basic monitoring only

---

## OLD Development Setup (DECOMMISSIONED) ❌

### Previous Architecture (No Longer Used)
```
❌ DECOMMISSIONED - October 1, 2025

┌─────────────────────────────────┐
│ ZITADEL Cloud (Free Tier)       │
│ sosi-auth-nocfrq.us1.zitadel.   │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│ Cloudflare Tunnel (Personal)    │ ← REMOVED: No longer needed
│ kenni-proxy.si-xj.org          │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│ Local Node.js Proxy             │ ← REMOVED: Now on Cloud Run
│ oidc-bridge-proxy.js           │
└────────────┬────────────────────┘
             │
┌────────────▼────────────────────┐
│ Kenni.is (Production)           │
└─────────────────────────────────┘
```

### Why We Moved to GCP
- ❌ ~~Single point of failure~~ → ✅ High availability on GCP
- ❌ ~~Credentials in .env files~~ → ✅ Secret Manager
- ❌ ~~Manual proxy management~~ → ✅ Automatic scaling
- ❌ ~~No monitoring~~ → ✅ Cloud Monitoring
- ❌ ~~Personal Cloudflare account~~ → ✅ Professional GCP infrastructure

---

## Target State: Full Self-Hosted Production (NEXT)

### What We're Building Next ⏰

**Timeline:** ~3-4 hours for basic setup

### Target Architecture
```
┌─────────────────────────────────────────────┐
│ Google Cloud Platform                       │
│ ekklesia-prod-10-2025                      │
│ ┌─────────────────────────────────────────┐ │
│ │ Cloud Run                               │ │
│ │ Self-Hosted ZITADEL                     │ │ ← ⏰ NEXT: Deploy here
│ │ ⏰ TO BE DEPLOYED                       │ │    Full control
│ │ Memory: 1GB, CPU: 1                     │ │    Unlimited users
│ └──────────┬──────────────────────────────┘ │    Custom branding
│            │                                  │
│ ┌──────────▼──────────────────────────────┐ │
│ │ Cloud SQL PostgreSQL                    │ │ ← ⏰ NEXT: Create database
│ │ ZITADEL Database                        │ │    Automatic backups
│ │ ⏰ TO BE CREATED                        │ │    Point-in-time recovery
│ │ db-f1-micro, 10GB SSD                   │ │    Encryption at rest
│ └─────────────────────────────────────────┘ │
│                                               │
│ ┌─────────────────────────────────────────┐ │
│ │ Cloud Run                               │ │
│ │ OIDC Bridge Proxy                       │ │ ← ✅ DEPLOYED
│ │ ✅ LIVE & WORKING                       │ │    Public access
│ │ europe-west2 (London)                   │ │    Auto-scaling
│ └──────────┬──────────────────────────────┘ │
│            │                                  │
│ ┌──────────▼──────────────────────────────┐ │
│ │ Secret Manager                          │ │ ← ✅ CONFIGURED
│ │ - Kenni credentials                     │ │    Encrypted
│ │ - ZITADEL DB password (next)            │ │    IAM controlled
│ │ - Signing keys                          │ │    Versioned
│ └─────────────────────────────────────────┘ │
│                                               │
└────────────┬──────────────────────────────────┘
             │
┌────────────▼────────────────────┐
│ Kenni.is (Production)           │ ← ✅ INTEGRATED
│ idp.kenni.is                   │
└─────────────────────────────────┘
```

### Production Benefits (After Self-Hosting)
- ✅ Full control over authentication data
- ✅ Unlimited users (no 1000 user limit)
- ✅ Custom branding and UI
- ✅ ~50-70% cost savings vs cloud ZITADEL
- ✅ Better integration with GCP ecosystem
- ✅ Data sovereignty (all data in our GCP)
- ✅ High availability (automatic failover)
- ✅ Automated backups and disaster recovery
- ✅ Professional monitoring and alerting

---

## Migration Progress

### ✅ Phase 0: OIDC Bridge (COMPLETED - Oct 1, 2025)
- [x] Created GCP project
- [x] Enabled billing and APIs
- [x] Stored secrets in Secret Manager
- [x] Built Docker container
- [x] Deployed to Cloud Run
- [x] Configured public access
- [x] Tested all endpoints
- [x] Verified health and discovery

**Duration:** ~4 hours (including troubleshooting)  
**Status:** ✅ **PRODUCTION READY**

---

### ⏰ Phase 1: Database Setup (NEXT - 30 minutes)

**Tasks:**
- [ ] Create Cloud SQL PostgreSQL instance
- [ ] Create `zitadel` database
- [ ] Create `zitadel` user with password
- [ ] Store credentials in Secret Manager
- [ ] Test connection from Cloud Run

**Commands Ready:** See `ZITADEL_QUICKSTART.md`

---

### ⏰ Phase 2: ZITADEL Deployment (NEXT - 1 hour)

**Tasks:**
- [ ] Deploy ZITADEL Docker image to Cloud Run
- [ ] Connect to Cloud SQL database
- [ ] Run initial setup/migrations
- [ ] Access admin console
- [ ] Create organization and project

**Commands Ready:** See `ZITADEL_QUICKSTART.md`

---

### ⏰ Phase 3: Configuration (NEXT - 1 hour)

**Tasks:**
- [ ] Configure Kenni.is as external IDP in ZITADEL
- [ ] Point to OIDC Bridge Proxy endpoints
- [ ] Set up claims mapping
- [ ] Create test application
- [ ] Test authentication flow

**Guide Available:** See `ZITADEL_SELFHOSTING_PLAN.md`

---

### ⏰ Phase 4: Ekklesia Integration (NEXT - 30 minutes)

**Tasks:**
- [ ] Update ekklesia app configuration
- [ ] Point to self-hosted ZITADEL
- [ ] Test end-to-end authentication
- [ ] Verify user creation and claims
- [ ] Monitor logs for issues

**Testing:** See `ZITADEL_QUICKSTART.md` Phase 4

---

### ⏰ Phase 5: Production Hardening (LATER - 4-8 hours)

**Tasks:**
- [ ] Custom domain (auth.ekklesia.is)
- [ ] SSL certificates (managed certs)
- [ ] Advanced monitoring and alerting
- [ ] Backup strategy and testing
- [ ] Security audit
- [ ] Load testing
- [ ] Documentation and runbooks
- [ ] Disaster recovery plan

**Detailed Plan:** See `ZITADEL_SELFHOSTING_PLAN.md`

---

## Architecture Comparison

| Aspect | OLD (Dev) | CURRENT | TARGET (Full Prod) |
|--------|-----------|---------|-------------------|
| **ZITADEL** | Cloud SaaS | Cloud SaaS ⏰ | Self-hosted ✅ |
| **OIDC Proxy** | Local ❌ | Cloud Run ✅ | Cloud Run ✅ |
| **Tunnel** | Cloudflare ❌ | N/A | N/A |
| **Secrets** | .env files ❌ | Secret Manager ✅ | Secret Manager ✅ |
| **Database** | ZITADEL managed | ZITADEL managed ⏰ | Cloud SQL ✅ |
| **Users Limit** | 1,000 | 1,000 ⏰ | Unlimited ✅ |
| **Cost/month** | Free | <$1 | $10-15 ✅ |
| **Availability** | Low ❌ | High ✅ | High ✅ |
| **Monitoring** | None ❌ | Basic ✅ | Full ✅ |
| **Control** | None ❌ | Partial ⏰ | Full ✅ |
| **Data Location** | US/EU | US/EU ⏰ | Our GCP ✅ |

---

## Cost Analysis

### Current Costs (Per Month)
- **OIDC Bridge (Cloud Run):** <$1 (within free tier)
- **Secret Manager:** ~$0.06 (5 secrets)
- **Cloud ZITADEL (Free tier):** $0
- **Total:** **~$0-1/month** ✅

### After Self-Hosting (Per Month)
- **Cloud SQL (db-f1-micro):** $7-10
- **ZITADEL (Cloud Run):** $2-5
- **OIDC Bridge (Cloud Run):** <$1
- **Secret Manager:** ~$0.10 (more secrets)
- **Total:** **~$10-15/month**

### Comparison with Cloud ZITADEL
- **Cloud ZITADEL (paid):** $20-50+/month
- **Self-hosted:** $10-15/month
- **Savings:** **50-70%** ✅

### With Free Credits
- **$300 GCP credits available**
- **Covers ~20-30 months** of usage
- **Essentially free for 2+ years** 🎉

---

## Performance Metrics

### Current Performance (OIDC Bridge)
- **Cold start:** 2-3 seconds
- **Warm requests:** <100ms
- **Latency to Iceland:** ~57ms (from London)
- **Availability:** 99.95% (Cloud Run SLA)

### Expected Performance (After Self-Hosting)
- **ZITADEL response:** <300ms
- **Total auth flow:** <2 seconds
- **Concurrent users:** 1000+ (auto-scaling)
- **Availability:** 99.95% (multi-zone)

---

## Security Improvements

### OLD Setup (Insecure) ❌
- Credentials in `.env` files
- Local machine dependency
- Personal Cloudflare account
- No audit logging
- No secret rotation

### CURRENT Setup (Improved) ✅
- Credentials in Secret Manager
- Cloud Run isolation
- GCP professional account
- Cloud Logging enabled
- IAM access control

### TARGET Setup (Best Practice) ✅
- Everything in CURRENT +
- Database encryption at rest
- Automated backups
- Point-in-time recovery
- Advanced monitoring
- Automated security scanning
- Compliance ready

---

## Next Steps

### Immediate (Today/This Week)
1. **Read documentation:**
   - `ZITADEL_QUICKSTART.md` - Quick start guide
   - `ZITADEL_SELFHOSTING_PLAN.md` - Complete plan

2. **Start Phase 1:**
   - Create Cloud SQL database (30 min)
   - Store credentials in Secret Manager
   - Test connection

3. **Continue Phase 2:**
   - Deploy ZITADEL to Cloud Run (1 hour)
   - Run initial setup
   - Access admin console

### Short-term (This Month)
4. **Complete Configuration:**
   - Setup Kenni.is integration
   - Test authentication flows
   - Update ekklesia app

5. **Basic Production:**
   - Verify everything works
   - Monitor for issues
   - Document setup

### Long-term (Next Month)
6. **Production Hardening:**
   - Custom domain
   - Advanced monitoring
   - Security audit
   - Load testing

---

## Documentation References

### Implementation Guides
- **`ZITADEL_QUICKSTART.md`** - 350 lines, step-by-step commands
- **`ZITADEL_SELFHOSTING_PLAN.md`** - 381 lines, complete architecture
- **`SUMMARY.md`** - Quick overview and status

### Current Status
- **`CURRENT_STATUS.md`** - Detailed status (Íslenska)
- **`PUBLIC_ACCESS_SUCCESS.md`** - OIDC Bridge success
- **`NEXT_STEPS.md`** - Quick next steps guide

### Deployment History
- **`DEPLOYMENT_SUCCESS.md`** - OIDC Bridge deployment
- **`DEPLOYMENT_GUIDE.md`** - Full deployment instructions
- **`IAM_TROUBLESHOOTING.md`** - Permission solutions

---

## Team Information

### Current Access
- **gudrodur@sosialistaflokkurinn.is** - Owner
- **agust@sosialistaflokkurinn.is** - Owner

### Responsibilities

**Phase 1-4 (Basic Setup):**
- Either team member can complete
- ~3-4 hours total time
- All commands documented

**Phase 5 (Production Hardening):**
- Coordinate together
- Domain configuration
- Security review
- Production launch

---

## Success Criteria

### Current Phase (OIDC Bridge) ✅
- [x] Service deployed
- [x] All endpoints working
- [x] Public access enabled
- [x] Secrets configured
- [x] Monitoring active

### Next Phase (ZITADEL) ⏰
- [ ] Database running
- [ ] ZITADEL deployed
- [ ] Admin console accessible
- [ ] Kenni.is integrated
- [ ] Authentication working
- [ ] Monitoring configured

---

## Key Achievements

**2025-10-01:**
- ✅ Migrated OIDC Bridge from local to GCP Cloud Run
- ✅ Configured production-ready infrastructure
- ✅ Enabled public access properly
- ✅ Created comprehensive documentation
- ✅ Tested all endpoints successfully
- ✅ Ready for ZITADEL self-hosting

---

**Next:** Read `ZITADEL_QUICKSTART.md` and start Phase 1! 🚀
