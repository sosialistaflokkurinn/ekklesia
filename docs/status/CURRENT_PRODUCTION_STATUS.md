# 🚀 Ekklesia Production Status

**Last Updated**: 2025-10-08 12:30 UTC
**Project**: ekklesia-prod-10-2025 (521240388393)
**Region**: europe-west2 (London)
**Validated**: CLI tools (gcloud, firebase, gsutil)

---

## ✅ Active Services

### Cloud Run Services
| Service | Type | URL | Status | Memory | Last Deploy |
|---------|------|-----|--------|--------|-------------|
| **handlekenniauth** | Cloud Function (Python 3.11) | https://handlekenniauth-ymzrguoifa-nw.a.run.app | ✅ Active | 512 MB | Oct 8, 2025 10:08 UTC |
| **verifymembership** | Cloud Function (Python 3.11) | https://verifymembership-ymzrguoifa-nw.a.run.app | ✅ Active | 256 MB | Oct 8, 2025 12:30 UTC |

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
| **PostgreSQL 15** | ekklesia-db | ✅ RUNNABLE | db-f1-micro, europe-west2, ready for Events service | 34.147.159.80 |

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

### 🔨 Events Service - Design Complete (Oct 8, 2025)

**Status**: Design complete, ready for implementation
**Technology Stack**:
- **Runtime**: Node.js + Express
- **Deployment**: Cloud Run (serverless)
- **Database**: Cloud SQL PostgreSQL 15 (ekklesia-db, shared instance)
- **Auth**: Firebase Admin SDK (verify JWT from Members)

**MVP Scope**:
- One election (Kosning)
- One question (yes/no/abstain)
- Active membership eligibility
- One-time voting token issuance (SHA-256 hashed)
- S2S communication with Elections service
- Audit trail (kennitala → token_hash)

**Implementation Timeline**: 5 days (4 phases)

**Design Document**: [docs/EVENTS_SERVICE_MVP.md](docs/EVENTS_SERVICE_MVP.md)

---

### 📋 Elections Service - Next Phase

**Status**: Design pending, implements after Events service
**Purpose**: Anonymous ballot recording (no PII, S2S only)

**Planned Features**:
- Accept voting tokens (S2S registered by Events)
- Record ballots anonymously
- Enforce one-vote-per-token
- Calculate and return results to Events service

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

---

## 🚦 Current Status Summary

### ✅ Production
- **Members Service**: Fully operational (Oct 6, 2025)
- **Firebase Authentication**: Working with Kenni.is
- **Cloud SQL**: Ready for Events service
- **Cost**: $7/month (90% savings vs ZITADEL)

### 🔨 In Progress
- **Events Service**: Design complete, ready to implement
- **Branch**: feature/firebase-members-auth (PR #28 open)

### 📋 Next Steps
1. Merge PR #28 to main (after review)
2. Implement Events service (5-day timeline)
3. Design Elections service
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
