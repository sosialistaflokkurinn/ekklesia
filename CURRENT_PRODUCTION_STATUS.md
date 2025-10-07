# 🚀 Ekklesia Production Status

**Last Updated**: 2025-10-07
**Project**: ekklesia-prod-10-2025 (521240388393)
**Region**: europe-west2 (London)

---

## ✅ Active Services

### Cloud Run Services
| Service | Type | URL | Status | Memory | Last Deploy |
|---------|------|-----|--------|--------|-------------|
| **handlekenniauth** | Cloud Function (Python 3.11) | https://handlekenniauth-ymzrguoifa-nw.a.run.app | ✅ Active | 512 MB | Oct 6, 2025 |
| **verifymembership** | Cloud Function (Python 3.11) | https://verifymembership-ymzrguoifa-nw.a.run.app | ✅ Active | 256 MB | Oct 7, 2025 |
| **members** | Node.js Service | https://members-ymzrguoifa-nw.a.run.app | ✅ Active | 512 MB | Oct 5, 2025 |
| **portal** | Python/Morepath Service | https://portal-ymzrguoifa-nw.a.run.app | 🟡 Deployed (DB not migrated) | 512 MB | Oct 7, 2025 |

### Firebase Services
| Service | URL | Status | Details |
|---------|-----|--------|---------|
| **Hosting** | https://ekklesia-prod-10-2025.web.app | ✅ Active | Last deploy: Oct 7, 10:53 |
| **Test Page** | https://ekklesia-prod-10-2025.web.app/test.html | ✅ Active | OAuth test flow |
| **Identity Platform** | Firebase Auth | ✅ Free Tier | Custom token auth |
| **Firestore** | Cloud Firestore (europe-west2) | ✅ Active | User profiles, metadata |

### Cloud SQL Services
| Service | Instance | Status | Details |
|---------|----------|--------|---------|
| **PostgreSQL 15** | ekklesia-db | ✅ Active | db-f1-micro, 10GB HDD |
| **Portal Database** | ekklesia_portal | 🟡 Created (not migrated) | 0 tables |

---

## 🏗️ Architecture

### Current Implementation
**Direct Firebase + Kenni.is PKCE Flow**

```
┌─────────────┐
│   Browser   │
│  (Frontend) │
└──────┬──────┘
       │
       │ 1. Initiate login
       │
       ▼
┌─────────────────────────────────────┐
│  Firebase Hosting                   │
│  https://ekklesia-prod-10-2025.web.app
└──────┬──────────────────────────────┘
       │
       │ 2. Redirect to Kenni.is
       │    (with PKCE challenge)
       │
       ▼
┌─────────────────────────────────────┐
│  Kenni.is (National eID)            │
│  https://idp.kenni.is               │
└──────┬──────────────────────────────┘
       │
       │ 3. Return with auth code
       │
       ▼
┌─────────────────────────────────────┐
│  handleKenniAuth Cloud Function     │
│  - Exchange code + verifier         │
│  - Verify Kenni.is ID token         │
│  - Extract kennitala                │
│  - Create Firebase custom token     │
└──────┬──────────────────────────────┘
       │
       │ 4. Return custom token
       │
       ▼
┌─────────────────────────────────────┐
│  Firebase Auth                      │
│  - Sign in with custom token        │
│  - Set kennitala in custom claims   │
└──────┬──────────────────────────────┘
       │
       │ 5. Authenticated session
       │
       ▼
┌─────────────────────────────────────┐
│  Members Service                    │
│  - Protected routes                 │
│  - Profile page                     │
│  - Membership verification          │
└─────────────────────────────────────┘
```

### Key Components

#### 1. **Frontend Auth Module** ([members/auth/kenni-auth.js](members/auth/kenni-auth.js))
- PKCE generation (verifier + challenge)
- OAuth flow management
- Custom token sign-in
- Session handling

#### 2. **Cloud Functions** ([members/functions/main.py](members/functions/main.py))

**handleKenniAuth** (HTTPS Function)
- **Trigger**: HTTP POST request
- **Purpose**: OAuth code exchange with PKCE
- **Flow**:
  1. Receive authorization code + PKCE verifier from frontend
  2. Exchange code for tokens with Kenni.is (including verifier)
  3. Verify ID token from Kenni.is
  4. Extract kennitala (national ID)
  5. Create or update user in Firestore
  6. Generate Firebase custom token with kennitala claim
  7. Return custom token to frontend

**verifyMembership** (Callable Function)
- **Trigger**: Callable from authenticated clients
- **Purpose**: Verify user membership status
- **Flow**:
  1. Check authenticated user's kennitala
  2. Read kennitalas.txt from Cloud Storage
  3. Verify membership status
  4. Update Firestore user profile
  5. Set custom claims (kennitala, isMember)

#### 3. **Firebase Authentication**
- Custom token authentication
- Custom claims: `kennitala`, `isMember`
- No password/email auth required

#### 4. **Kenni.is Integration**
- **Issuer**: https://idp.kenni.is/sosi-kosningakerfi.is
- **Client ID**: @sosi-kosningakerfi.is/rafr-nt-kosningakerfi-s-s
- **Scopes**: openid, profile, national_id, email, phone_number
- **PKCE**: S256 (SHA-256)
- **Claims Captured**: kennitala, name, email, phone_number

---

## 🔑 Secrets (Secret Manager)

| Secret | Purpose | Used By | Status |
|--------|---------|---------|--------|
| `kenni-client-secret` | Kenni.is OAuth client secret | handleKenniAuth | ✅ Active |
| `portal-db-password` | Portal PostgreSQL user password | Portal service | ✅ Active |
| `portal-session-secret` | Portal session encryption | Portal service | ✅ Active |
| `members-session-secret` | Session encryption | Members service | ⚠️ Legacy |
| `idp-client-id` | ZITADEL config | None | ⚠️ Deprecated |
| `idp-client-secret` | ZITADEL config | None | ⚠️ Deprecated |
| `kenni-client-id` | Kenni.is client ID | None | ⚠️ Deprecated (now env var) |
| `kenni-issuer` | Kenni.is issuer URL | None | ⚠️ Deprecated (now env var) |
| `zitadel-*` | ZITADEL configs | None | ⚠️ Deprecated (migration complete) |

---

## 📊 Cost Analysis

### Migration from ZITADEL to Firebase
- **Before**: $135/month (ZITADEL SaaS)
- **After**: ~$7-10/month (Cloud SQL only)
- **Annual Savings**: ~$1,500-1,536

### Current Monthly Costs
| Service | Cost | Notes |
|---------|------|-------|
| Firebase (Hosting, Auth, Firestore) | $0 | Free Tier |
| Cloud Functions (2 functions) | $0 | Within free tier |
| Cloud Run (3 services) | $0 | Within free tier (minimal traffic) |
| Cloud SQL (db-f1-micro) | ~$7-10 | Only paid component |
| Artifact Registry | ~$0.10 | Minimal storage |
| Secret Manager | ~$0.06 | 13 secrets |
| **Total** | **~$7-10/month** | **~$84-120/year** |

---

## 🧪 Testing

### Manual OAuth Flow Test
1. Visit: https://ekklesia-prod-10-2025.web.app/test.html
2. Click "Start Kenni.is Login Flow"
3. Authenticate with Kenni.is (test or production account)
4. Verify:
   - Authorization code received
   - PKCE verifier sent
   - Custom token created
   - Firebase sign-in successful
   - Kennitala extracted to custom claims

### Membership Verification Test
```javascript
// From authenticated client
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const verifyMembership = httpsCallable(functions, 'verifyMembership');

const result = await verifyMembership();
console.log(result.data);
// { isMember: true/false, verified: true, kennitala: "DDMMYY-****" }
```

---

## 📝 Reference Implementation

This implementation is based on:
- **Repository**: https://github.com/gudrodur/firebase-manual-oauth-pkce
- **Author**: gudrodur@gmail.com
- **Purpose**: Demonstrates manual OAuth PKCE flow for Firebase when the built-in OIDC provider cannot support PKCE

---

## 🔄 Migration History

| Date | Event | Impact |
|------|-------|--------|
| Oct 1, 2025 | Project created | Initial setup |
| Oct 3, 2025 | Members service deployed | Hello World + OIDC |
| Oct 5, 2025 | ZITADEL integration | Kenni.is authentication working |
| Oct 6, 2025 | Firebase migration started | Switched from ZITADEL to Firebase |
| Oct 7, 2025 | Firebase migration complete | Direct Firebase + Kenni.is PKCE |
| Oct 7, 2025 | Enhanced claims capture | Added email + phone_number scopes |
| Oct 7, 2025 | Portal deployment started | Cloud SQL + Portal service deployed |

---

## 🚦 Service Status

### ✅ Fully Operational
- **Members Authentication**: Firebase + Kenni.is OAuth with PKCE
- **handleKenniAuth**: Token exchange with all user claims (kennitala, email, phone)
- **verifyMembership**: Membership verification function
- **Firebase Hosting**: Test page and static assets
- **Firestore**: User profile storage
- **Cloud SQL**: PostgreSQL 15 instance running

### 🟡 Partially Complete
- **Portal Service**: Deployed but database not migrated
  - Container running on Cloud Run
  - Cloud SQL database created
  - 24 Alembic migrations pending (dependency resolution issue)
  - See: [PORTAL_DEPLOYMENT_PROGRESS.md](PORTAL_DEPLOYMENT_PROGRESS.md)

### ⚠️ Known Issues
- Portal migrations blocked by Poetry dependency resolution
- Recommended: Export requirements.txt from poetry.lock

**Monitoring**:
- Cloud Logging: https://console.cloud.google.com/logs/query?project=ekklesia-prod-10-2025
- Cloud Functions: https://console.cloud.google.com/functions/list?project=ekklesia-prod-10-2025
- Cloud Run: https://console.cloud.google.com/run?project=ekklesia-prod-10-2025
- Firebase Console: https://console.firebase.google.com/project/ekklesia-prod-10-2025/overview
- Cloud SQL: https://console.cloud.google.com/sql/instances?project=ekklesia-prod-10-2025

---

## 📧 Support

- **Production Issues**: Check Cloud Logging
- **Authentication Issues**: Check handleKenniAuth logs
- **Membership Issues**: Check verifyMembership logs + kennitalas.txt in Storage

---

**Account Information**:
- **Reference Repo**: gudrodur@gmail.com
- **Production**: gudrodur@sosialistaflokkurinn.is
