# 🚀 Ekklesia Production Status

**Last Updated**: 2025-10-13 12:00 UTC
**Project**: ekklesia-prod-10-2025 (521240388393)
**Region**: europe-west2 (London)
**Validated**: CLI tools (gcloud, firebase, gsutil)
**Security Status**: ✅ Phase 1-3 Hardening Complete (Oct 12, 2025)

---

## ✅ Active Services

### Cloud Run Services
| Service | Type | Public URL | Status | Memory | Last Deploy |
|---------|------|------------|--------|--------|-------------|
| **elections-service** | Node.js 18 + Express | https://elections-service-ymzrguoifa-nw.a.run.app | ✅ Active | 512 MB | Oct 13, 2025 10:05 UTC |
| **events-service** | Node.js 18 + Express | https://events-service-ymzrguoifa-nw.a.run.app | ✅ Active | 512 MB | Oct 13, 2025 10:06 UTC |
| **handlekenniauth** | Cloud Function (Python 3.11) | https://handlekenniauth-ymzrguoifa-nw.a.run.app | ✅ Active | 512 MB | Oct 13, 2025 10:06 UTC |
| **verifymembership** | Cloud Function (Python 3.11) | https://verifymembership-ymzrguoifa-nw.a.run.app | ✅ Active | 256 MB | Oct 13, 2025 10:06 UTC |

**Note**: Services use native Cloud Run URLs (*.run.app) for cost efficiency.

### Firebase Services
| Service | URL | Status | Details | Last Deploy |
|---------|-----|--------|---------|-------------|
| **Hosting** | https://ekklesia-prod-10-2025.web.app | ✅ Active | Members portal (dashboard, profile) | Oct 8, 2025 12:18 UTC |
| **Authentication** | Firebase Auth | ✅ Active | Custom token auth with kennitala claims | Production |
| **Firestore** | Cloud Firestore (europe-west2) | ✅ Active | User profiles, membership status | Production |
| **Storage** | Firebase Storage | ✅ Active | kennitalas.txt (2,273 members, 24.47 KiB) | Oct 8, 2025 |

### Cloud SQL Services
| Service | Instance | Status | Details | IP Address |
|---------|----------|--------|---------|------------|
| **PostgreSQL 15** | ekklesia-db | ✅ RUNNABLE | db-f1-micro, europe-west2, pgaudit enabled, 30-day backups | 34.147.159.80 |

---

## 🔒 Security Hardening (Oct 12, 2025)

**Status**: ✅ Phase 1-3 Complete (All critical security issues resolved)

### Phase 1: Critical Fixes (Oct 12, 2025 21:03 UTC)
- ✅ **Issue #30**: Firestore Security Rules deployed
- ✅ **Issue #33**: CSRF Protection (state parameter validation)
- ✅ **Issue #32**: Idempotency Fix (user creation race condition)

### Phase 2: Security Infrastructure (Oct 12, 2025 22:51 UTC)
- ✅ **Issue #31**: Rate Limiting analysis complete
- ✅ **Security Assessment**: Comprehensive threat model and defense analysis
  - Authentication layer (Firebase Auth with Kenni.is)
  - Authorization layer (Firestore rules)
  - Audit logging (Cloud Logging)
  - Origin protection evaluation

### Phase 3: Documentation & Safety (Oct 12, 2025 23:17 UTC)
- ✅ **Security Documentation**: Comprehensive defense analysis and architecture decisions
- ✅ **DNS Management Scripts**: Automation for Cloud DNS operations
  - scripts/update-dns-records.sh - DNS record management
  - scripts/disable-cloudflare-proxy.sh - Cloudflare proxy control
- ✅ **Git Pre-commit Hook**: Prevents tracking forbidden files (.gitignore, AUTOMATION.md, secrets)
- ✅ **Hook Installation Script**: scripts/install-git-hooks.sh (147 lines)

### Phase 4: Architecture Decision - Direct Cloud Run URLs (Oct 13, 2025)
- ✅ **Decision**: Use native Cloud Run URLs (*.run.app) instead of custom domains
- ✅ **Rationale**: Cost-benefit analysis (see [SECURITY_DEFENSE_ANALYSIS.md](../security/SECURITY_DEFENSE_ANALYSIS.md))
  - Custom domains via Load Balancer: $216/year = 138% cost increase
  - Custom domains via Cloudflare Pro: $240/year = 154% cost increase
  - Direct URLs: $0 = cosmetic trade-off for cost efficiency
- ✅ **Configuration**: All services use native Cloud Run URLs (*.run.app)
  - `config_api_events`: https://events-service-ymzrguoifa-nw.a.run.app
  - `config_api_elections`: https://elections-service-ymzrguoifa-nw.a.run.app
  - `config_api_handle_auth`: https://handlekenniauth-ymzrguoifa-nw.a.run.app
  - `config_api_verify`: https://verifymembership-ymzrguoifa-nw.a.run.app
- ✅ **Security Maintained**: Authentication, authorization, audit logging all active

**Documentation**:
- [docs/status/SECURITY_HARDENING_PLAN.md](SECURITY_HARDENING_PLAN.md) - Complete hardening plan
- [docs/security/CLOUDFLARE_SETUP.md](../security/CLOUDFLARE_SETUP.md) - Cloudflare infrastructure guide
- [docs/security/SECURITY_DEFENSE_ANALYSIS.md](../security/SECURITY_DEFENSE_ANALYSIS.md) - Security assessment & architecture decisions
- [docs/security/CLOUDFLARE_HOST_HEADER_INVESTIGATION.md](../security/CLOUDFLARE_HOST_HEADER_INVESTIGATION.md) - Technical investigation
- [scripts/README.md](../../scripts/README.md) - Automation scripts guide

**Architecture Justification**:
- ✅ Threat level appropriate (monthly meetings, low-profile target)
- ✅ Cost efficiency prioritized (98% cheaper than always-on alternatives)
- ✅ Security comprehensive (auth, authorization, audit logging)
- ✅ Accepts cosmetic trade-off (functional URLs vs pretty URLs)

---

## 🏗️ Architecture

### Current Implementation (Oct 8, 2025)
**Members Service: Firebase + Kenni.is Direct PKCE**

```
┌─────────────┐
│   Browser   │
│  (Member)   │
└──────┬──────┘
       │
       │ 1. Login to Members
       │
       ▼
┌─────────────────────────────────────┐
│  Firebase Hosting                   │
│  https://ekklesia-prod-10-2025.web.app
│  - Static HTML/CSS/JS               │
│  - Login page                       │
│  - Profile page                     │
└──────┬──────────────────────────────┘
       │
       │ 2. OAuth redirect to Kenni.is
       │    (PKCE challenge)
       │
       ▼
┌─────────────────────────────────────┐
│  Kenni.is (National eID)            │
│  https://idp.kenni.is               │
│  - Government authentication        │
│  - Kennitala verification           │
└──────┬──────────────────────────────┘
       │
       │ 3. Callback with auth code
       │
       ▼
┌─────────────────────────────────────┐
│  handleKenniAuth (Cloud Function)   │
│  - Exchange code + PKCE verifier    │
│  - Verify Kenni.is ID token         │
│  - Extract kennitala                │
│  - Create Firebase custom token     │
└──────┬──────────────────────────────┘
       │
       │ 4. Custom token
       │
       ▼
┌─────────────────────────────────────┐
│  Firebase Authentication            │
│  - Sign in with custom token        │
│  - Claims: kennitala, isMember      │
└──────┬──────────────────────────────┘
       │
       │ 5. Authenticated session
       │
       ▼
┌─────────────────────────────────────┐
│  Members Service (Static)           │
│  - Profile page                     │
│  - Membership verification          │
│  - Session management               │
└─────────────────────────────────────┘
```

---

## 🚀 Services Status

### ✅ Members Service - Production (Oct 6-8, 2025)

**Technology Stack**:
- **Hosting**: Firebase Hosting (Static HTML/CSS/JS)
- **Functions**: Cloud Functions (2nd gen, Python 3.11)
- **Auth**: Firebase Authentication (custom tokens)
- **Database**: Firestore (user profiles)
- **Storage**: Firebase Storage (membership list)
- **OAuth**: Kenni.is (direct PKCE, no intermediary)

**Features**:
- ✅ Kenni.is national eID authentication
- ✅ Kennitala extraction and verification
- ✅ Kennitala normalization (handles both `DDMMYY-XXXX` and `DDMMYYXXXX` formats)
- ✅ Member verification against membership list (2,273 members)
- ✅ Custom Firebase tokens with kennitala + isMember claims
- ✅ User profile storage in Firestore
- ✅ Icelandic language UI (i18n/R.string pattern)
- ✅ Socialist red color theme
- ✅ Multi-page portal (index, dashboard, profile, test)

**URLs**:
- Production: https://ekklesia-prod-10-2025.web.app
- Dashboard: https://ekklesia-prod-10-2025.web.app/dashboard.html
- Profile: https://ekklesia-prod-10-2025.web.app/profile.html

**Cloud Functions** (Python 3.11, Gen 2):
1. **handleKenniAuth** - OAuth token exchange with PKCE
   - URL: https://handlekenniauth-ymzrguoifa-nw.a.run.app
   - Memory: 512 MB
   - Last Deploy: Oct 8, 2025 10:08 UTC
2. **verifyMembership** - Membership status verification
   - URL: https://verifymembership-ymzrguoifa-nw.a.run.app
   - Memory: 256 MB
   - Last Deploy: Oct 8, 2025 11:54 UTC (with kennitala normalization)

**Data**:
- Membership List: gs://ekklesia-prod-10-2025.firebasestorage.app/kennitalas.txt
- Members Count: 2,273 (January 2025 roster)
- File Size: 24.47 KiB

**Cost**: $0/month (Firebase free tier)

---

### ✅ Events Service - Production (Oct 9, 2025)

**Status**: ✅ MVP Deployed to Production
**URL**: https://events-service-ymzrguoifa-nw.a.run.app

**Technology Stack**:
- **Runtime**: Node.js 18 + Express
- **Deployment**: Cloud Run (serverless, europe-west2)
- **Database**: Cloud SQL PostgreSQL 15 (Unix socket connection)
- **Auth**: Firebase Admin SDK (verify JWT from Members)
- **Container**: Docker (node:18-slim base image)

**MVP Scope (Deployed)**:
- ✅ One election (Prófunarkosning 2025)
- ✅ One question (yes/no/abstain)
- ✅ Active membership eligibility check
- ✅ One-time voting token issuance (SHA-256 hashed, 32 bytes)
- ✅ Token storage with audit trail (kennitala → token_hash)
- ✅ Token retrieval endpoint
- ⏸️ S2S communication with Elections service (Phase 5)

**API Endpoints**:
- `GET /health` - Health check (✅ Production verified)
- `GET /api/election` - Election details
- `POST /api/request-token` - Issue voting token
- `GET /api/my-status` - Participation status
- `GET /api/my-token` - Retrieve issued token
- `GET /api/results` - Results placeholder

**Cloud Run Configuration**:
- Memory: 512 MB
- CPU: 1
- Max instances: 10
- Min instances: 0
- Timeout: 60s
- Cloud SQL connector: ekklesia-prod-10-2025:europe-west2:ekklesia-db
- Public access: Allowed (Firebase auth enforced at app level)

**Testing Results**:
- ✅ Local testing complete (Phase 3, Oct 9)
- ✅ Production deployment successful (Phase 4, Oct 9)
- ✅ Health check verified: Service running
- ✅ Firebase Admin SDK initialized
- ✅ Cloud SQL connection via Unix socket
- Sample voting token issued (local): `51a4fcc6f8a3a805385231248ec596098a79dbab5dc7859b1771c6b9c4727964`

**Implementation Timeline**:
- ✅ Phase 1: Database Setup (Oct 9, 2025)
- ✅ Phase 2: Core API (Oct 9, 2025)
- ✅ Phase 3: Testing & Debugging (Oct 9, 2025)
- ✅ Phase 4: Cloud Run Deployment (Oct 9, 2025)
- 📋 Phase 5: Elections Service Integration (Next)

**Deployment**:
- Deploy script: `events/deploy.sh`
- Image: `gcr.io/ekklesia-prod-10-2025/events-service`
- Test page: `events/test-production.html` (use with Members service)

**Design Document**: [docs/design/EVENTS_SERVICE_MVP.md](../design/EVENTS_SERVICE_MVP.md)
**Testing Log**: [archive/testing-logs/EVENTS_SERVICE_TESTING_LOG.md](../../archive/testing-logs/EVENTS_SERVICE_TESTING_LOG.md) (archived Oct 11)

---

### ✅ Elections Service - Production (Oct 9, 2025)

**Status**: ✅ Deployed to Production (MVP Complete)
**URL**: https://elections-service-ymzrguoifa-nw.a.run.app
**Purpose**: Anonymous ballot recording (no PII, S2S only)

**Technology Stack**:
- **Runtime**: Node.js 18 + Express
- **Deployment**: Cloud Run (serverless, europe-west2)
- **Database**: Cloud SQL PostgreSQL 15 (ekklesia-db, `elections` schema)
- **Auth**: S2S API key for Events service communication

**MVP Features** (Deployed):
- ✅ S2S token registration (Events → Elections)
- ✅ Anonymous ballot recording (no PII, no member data)
- ✅ One-vote-per-token enforcement (database constraints)
- ✅ Results tabulation (S2S endpoint for Events)
- ✅ yes/no/abstain voting (MVP scope)
- ✅ Audit logging (no PII, token hash prefix only)

**API Endpoints**:
- `GET /health` - Health check (✅ Verified)
- `POST /api/s2s/register-token` - Register voting token (S2S, API key)
- `GET /api/s2s/results` - Fetch results (S2S, API key)
- `POST /api/vote` - Submit ballot (public, token-based)
- `GET /api/token-status` - Check token validity (public, token-based)

**Database Schema** (`elections`):
- `voting_tokens` - One-time tokens (SHA-256 hashed)
- `ballots` - Anonymous ballots (timestamp rounded to minute)
- `audit_log` - System events (no PII)

**Cloud Run Configuration** (optimized for 300 votes/sec spike):
- Memory: 512 MB
- CPU: 1 (with startup boost)
- Max instances: 100
- Min instances: 0 (cost optimization)
- Concurrency: 50 (database-bound)
- Timeout: 5s (fail fast)
- Cloud SQL: Unix socket connection

**Deployment Timeline**:
- ✅ Phase 1: Database Setup (Oct 9, 2025)
- ✅ Phase 2: Core API Implementation (Oct 9, 2025)
- ✅ Phase 3: Local Testing (Oct 9, 2025)
- ✅ Phase 4: Cloud Run Deployment (Oct 9, 2025 20:52 UTC)
- ⏸️ Phase 5: Integration Testing (Next - test with Events service)

**Next Steps**:
1. Update Events service to call Elections S2S endpoints
2. End-to-end integration testing
3. Load testing (300 votes/sec spike - see USAGE_CONTEXT.md)

**Design Document**: [docs/design/ELECTIONS_SERVICE_MVP.md](../design/ELECTIONS_SERVICE_MVP.md)
**Load Patterns**: [docs/USAGE_CONTEXT.md](../USAGE_CONTEXT.md)
**Operations**: [docs/OPERATIONAL_PROCEDURES.md](../OPERATIONAL_PROCEDURES.md)

---

### ❌ Decommissioned Services (Oct 8, 2025)

**Legacy Members Service**:
- Status: ❌ Deleted from Cloud Run (Oct 8, 2025)
- Reason: Replaced by Firebase Hosting (static HTML/CSS/JS)
- URL (deleted): https://members-ymzrguoifa-nw.a.run.app

**Portal Service**:
- Status: ❌ Decommissioned from Cloud Run
- Reason: External Ekklesia Portal does not match election requirements
- Archived: archive/ekklesia-platform-evaluation/

**ZITADEL Authentication**:
- Status: ❌ Replaced by Firebase (Oct 6-7, 2025)
- Migration: Complete
- Cost Savings: $135/month → $0/month (90% reduction)
- Archived: archive/zitadel-legacy/

---

## 🔑 Secrets (Secret Manager)

### Active Secrets
| Secret | Purpose | Used By | Status |
|--------|---------|---------|--------|
| `kenni-client-secret` | Kenni.is OAuth client secret | handleKenniAuth | ✅ Active |

### Cleanup Complete (Oct 8, 2025)
**Deleted 12 deprecated secrets**:
- ✅ `members-session-secret` (Members session encryption)
- ✅ `portal-db-password` (Portal PostgreSQL password)
- ✅ `portal-session-secret` (Portal session encryption)
- ✅ `idp-client-id` (ZITADEL config)
- ✅ `idp-client-secret` (ZITADEL config)
- ✅ `kenni-client-id` (Now environment variable)
- ✅ `kenni-issuer` (Now environment variable)
- ✅ `zitadel-db-password` (ZITADEL PostgreSQL)
- ✅ `zitadel-org-id` (ZITADEL organization)
- ✅ `zitadel-postgres-admin-password` (ZITADEL PostgreSQL admin)
- ✅ `zitadel-project-id` (ZITADEL project)
- ✅ `cloudflare-api-token` (Legacy DNS management)

---

## 📊 Cost Analysis

### Migration Savings
- **Before (ZITADEL)**: $135/month
- **After (Firebase)**: $7-13/month
- **Annual Savings**: ~$1,500/year (90% reduction)

### Current Monthly Costs
| Service | Cost | Notes |
|---------|------|-------|
| **Firebase** (Hosting, Auth, Firestore) | $0 | Free tier (500 members) |
| **Cloud Functions** (2 functions) | $0 | Free tier (2M requests/month) |
| **Cloud SQL** (db-f1-micro) | $7 | Only paid component |
| **Artifact Registry** | ~$0.10 | Minimal storage |
| **Secret Manager** | ~$0.06 | Active secrets only |
| **Total** | **~$7/month** | **~$84/year** |

### After Events + Elections Services
| Service | Estimated Cost |
|---------|----------------|
| Cloud SQL (db-f1-micro, shared) | $7 |
| Events Service (Cloud Run) | $0-3 (free tier covers ~3,000 requests/month) |
| Elections Service (Cloud Run) | $0-3 (free tier) |
| **Estimated Total** | **$7-13/month** (~$84-156/year) |

---

## 🧪 Testing

### Production Members Service
1. Visit: https://ekklesia-prod-10-2025.web.app
2. Click login → Redirects to Kenni.is
3. Authenticate with Kenni.is
4. Verify:
   - Custom token created
   - Firebase sign-in successful
   - Profile page displays kennitala
   - Membership status verified

### Test Endpoints
```bash
# Check Cloud Functions status
gcloud run services list --region=europe-west2

# Check Firebase Hosting
curl https://ekklesia-prod-10-2025.web.app/

# Check Cloud SQL
gcloud sql instances describe ekklesia-db
```

---

## 📝 Technology Stack Summary

### Infrastructure
- **GCP Project**: ekklesia-prod-10-2025
- **Region**: europe-west2 (London)
- **Database**: Cloud SQL PostgreSQL 15 (db-f1-micro)
- **Hosting**: Firebase Hosting
- **Compute**: Cloud Run + Cloud Functions (2nd gen)
- **Authentication**: Firebase Authentication
- **NoSQL**: Firestore
- **OAuth Provider**: Kenni.is National eID

### Application Stack
- **Runtime**: Node.js
- **Web Framework**: Express.js (for future services)
- **Database Client**: node-postgres (pg)
- **Auth Library**: Firebase Admin SDK
- **Language**: JavaScript

### Deployment
- **CLI Tools**: Firebase CLI, gcloud CLI
- **CI/CD**: Manual deployment
- **Secrets**: Cloud Secret Manager

---

## 🔄 Migration Timeline

| Date | Event | Impact |
|------|-------|--------|
| Oct 1, 2025 | Project created | Initial GCP setup |
| Oct 3, 2025 | ZITADEL deployed | Authentication working |
| Oct 5, 2025 | Kenni.is integration | OAuth flow working via ZITADEL |
| Oct 6, 2025 | **Firebase migration started** | Switch from ZITADEL to Firebase |
| Oct 7, 2025 | **Firebase migration complete** | Direct Firebase + Kenni.is PKCE |
| Oct 7, 2025 | Portal evaluation started | External Ekklesia Platform tested |
| Oct 8, 2025 | **Portal decommissioned** | Does not match requirements |
| Oct 8, 2025 | **Events service designed** | Ready for implementation |
| Oct 8, 2025 | **Legacy cleanup complete** | ZITADEL and Portal archived |
| Oct 8, 2025 | **Membership verification complete** | Kennitala normalization, 2,273 members verified |
| Oct 8, 2025 | **UI improvements deployed** | Icelandic i18n, socialist red theme, multi-page portal |
| Oct 9, 2025 | **Events service Phase 1-3 complete** | Database, API, testing complete - ready for deployment |

---

## 🚦 Current Status Summary

### ✅ Production
- **Members Service**: Fully operational (Oct 6, 2025)
- **Firebase Authentication**: Working with Kenni.is
- **Cloud SQL**: Active with Events service database
- **Cost**: $7/month (90% savings vs ZITADEL)

### 🔨 In Progress
- **Branch**: feature/firebase-members-auth (PR #28 open)
  - Ready to merge after final production testing

### 📋 Next Steps
1. Test Events service with production Firebase authentication
   - Use test-production.html to verify all endpoints
   - Test token issuance flow end-to-end
   - Verify database writes in production
2. Merge PR #28 to main (after production testing)
3. Design Elections service (Phase 5)
   - Anonymous ballot recording (S2S only)
   - Token validation and one-vote enforcement
   - Result calculation and storage
4. Implement Elections service

---

## 📧 Monitoring & Support

**Cloud Console Links**:
- Cloud Logging: https://console.cloud.google.com/logs/query?project=ekklesia-prod-10-2025
- Cloud Functions: https://console.cloud.google.com/functions/list?project=ekklesia-prod-10-2025
- Cloud Run: https://console.cloud.google.com/run?project=ekklesia-prod-10-2025
- Firebase Console: https://console.firebase.google.com/project/ekklesia-prod-10-2025/overview
- Cloud SQL: https://console.cloud.google.com/sql/instances?project=ekklesia-prod-10-2025

**Support Contacts**:
- Production Issues: Check Cloud Logging
- Authentication Issues: Check handleKenniAuth logs
- Membership Issues: Check verifyMembership logs

---

**Production Account**: g******@sosialistaflokkurinn.is
**Project Repository**: https://github.com/sosialistaflokkurinn/ekklesia
**Current Branch**: feature/firebase-members-auth (PR #28)
