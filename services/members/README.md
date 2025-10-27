# Ekklesia Members Service

✅ **Production Status**: Firebase-based implementation operational
🔄 **Migration Complete**: Migrated from ZITADEL to Firebase (Oct 6-7, 2025)

---

## Current Implementation (Firebase-based)

**Production**: https://ekklesia-prod-10-2025.web.app
**Technology**: Firebase Hosting + Cloud Functions (Python 3.11) + Firebase Authentication

### What's Running

- **Firebase Hosting**: Static HTML from `public/` (dashboard.html, profile.html, test.html, test-events.html)
- **Cloud Functions** (Python 3.11, 2nd gen):
  - `handleKenniAuth` - OAuth token exchange with Kenni.is
  - `verifyMembership` - Kennitala verification against membership list
- **Firebase Authentication**: Custom tokens with kennitala claims
- **Firestore**: User profiles and session data
- **Kenni.is Integration**: Direct OAuth PKCE (no intermediary)

**Cost**: $0/month (Firebase free tier)

---

## Features

✅ **Milestone 3 Complete** - Kenni.is National eID Authentication

- Direct Kenni.is OAuth PKCE integration ✅
- Firebase custom token authentication ✅
- Kennitala extraction and verification ✅
- Member verification against Firestore members collection (Epic #43) ✅
- User profile with national eID data ✅
- Icelandic language UI ✅
- Component-based CSS architecture ✅
- Internationalization (i18n) with R.string pattern ✅
- Firestore user profiles ✅

---

## Architecture

### CSS Methodology

Following `.claude/rules.md` CSS principles:

**1. Global Stylesheet** (`styles/global.css`):
- CSS reset
- Typography system
- Color palette (CSS custom properties)
- Spacing and layout variables
- Socialist red brand colors

**2. Component Stylesheets** (`styles/components/`):
- `login.css` - Authentication page styles
- Scoped, semantic CSS
- No utility-first frameworks (no Tailwind)

**Benefits for Designers**:
- Clear separation: HTML structure + scoped CSS
- CSS custom properties for easy theming
- Semantic class names
- Easy to iterate without touching JavaScript

### Internationalization (i18n)

Android R.string pattern for maintainable translations:

**Structure**:
```
i18n/
├── R.js              # Utility module
└── is.js             # Icelandic strings
```

**Usage**:
```javascript
import { R } from '/i18n/R.js';
const text = R.string.login_title; // "Innskráning"
```

**Adding Languages**:
1. Create `i18n/en.js` with matching keys
2. Uncomment language switching in `R.js`
3. Add UI language switcher

**Benefits**:
- Centralized: All strings in one file per language
- Scalable: Easy to add new languages
- Type-safe: `R.string.key` pattern
- Debug-friendly: Missing key warnings

---

## Quick Start

### Deployment

```bash
# Deploy Cloud Functions
cd members
firebase deploy --only functions --project ekklesia-prod-10-2025

# Deploy hosting (if changes to public/)
firebase deploy --only hosting --project ekklesia-prod-10-2025
```

### Testing Production

```bash
# Test Firebase Hosting
curl https://ekklesia-prod-10-2025.web.app/test.html

# Test Cloud Functions
gcloud run services list --project=ekklesia-prod-10-2025 --region=europe-west2

# Check Firebase Authentication
firebase auth:export users.json --project ekklesia-prod-10-2025
```

---

## Architecture

### Current Structure (Production)

```
members/
├── public/                           ✅ PRODUCTION - Firebase Hosting
│   └── test.html                     OAuth test page
│
├── functions/                        ✅ PRODUCTION - Cloud Functions (2nd gen)
│   ├── main.py                       handleKenniAuth & verifyMembership (Python 3.11)
│   ├── requirements.txt              Python dependencies
│   ├── package.json                  Node.js dependencies (Firebase SDK)
│   ├── .env.yaml                     Environment variables
│   ├── .gcloudignore                 Deployment exclusions
│   └── sync_members.py               Epic #43: Django member sync
│
├── docs/                             📚 Documentation (local-only)
│   ├── FIREBASE_KENNI_SETUP.md       Setup guide
│   └── KENNI_QUICKSTART.md           Quick start
│
├── auth/                             🗄️ ARCHIVED - Legacy code
│   └── README.md                     Old ZITADEL implementation
│
├── firebase.json                     Firebase configuration
├── .firebaserc                       Project config
└── README.md                         ⭐ YOU ARE HERE
```

### Legacy Code (Archived)

⚠️ **Not used in production** - See `members/auth/` directory

The `members/auth/` directory contains the original Node.js/ZITADEL implementation (replaced Oct 6-7, 2025). All ZITADEL references are in archived code only.

---

## Authentication Flow (Firebase)

1. User visits Firebase Hosting test page (`/test.html`)
2. Clicks "Start Kenni.is Login Flow"
3. JavaScript initiates OAuth PKCE flow with Kenni.is
4. Kenni.is OAuth authorization (user authenticates with national eID)
5. Redirect to callback with authorization code
6. JavaScript calls `handleKenniAuth` Cloud Function
7. Function exchanges code for tokens with Kenni.is (PKCE verifier)
8. Function calls `verifyMembership` to check kennitala
9. Function creates Firebase custom token with claims
10. Client signs in with custom token
11. User authenticated with kennitala in claims

### Security Features

- ✅ OAuth 2.0 PKCE (RFC 7636) - Public client flow
- ✅ State parameter for CSRF protection (Issue #33, Oct 12, 2025)
- ✅ Nonce for replay attack prevention
- ✅ Firebase custom tokens with verified claims
- ✅ Kennitala verification against membership list
- ✅ Secure HTTPS-only communication
- ✅ Firebase security rules for Firestore (Issue #30, Oct 12, 2025)
- ✅ Idempotency protection for user creation (Issue #32, Oct 12, 2025)
- ✅ Cloudflare rate limiting - 100 req/10sec per IP (Issue #31, Oct 12, 2025)
- ✅ Origin protection - CF-Ray header + Cloudflare IP validation (Oct 12, 2025)
- ✅ SSL/TLS Full (strict) encryption via Cloudflare

---

## Configuration

### Environment Variables (Cloud Functions)

Set in `functions/.env.yaml`:

```yaml
KENNI_CLIENT_ID: "@sosi-kosningakerfi.is/rafr-nt-kosningakerfi-s-s"
KENNI_ISSUER: "https://idp.kenni.is/sosi-kosningakerfi.is"
KENNI_AUTH_URL: "https://idp.kenni.is/oauth2/auth"
KENNI_TOKEN_URL: "https://idp.kenni.is/oauth2/token"
KENNI_USERINFO_URL: "https://idp.kenni.is/oauth2/userinfo"
REDIRECT_URI: "https://ekklesia-prod-10-2025.web.app/test.html"
```

Secret Manager:
```bash
# Kenni.is OAuth client secret
kenni-client-secret
```

**CORS**:

- `CORS_ALLOWED_ORIGINS`: Comma-separated list of allowed origins for Cloud Functions responses. Defaults to `https://ekklesia-prod-10-2025.web.app, https://ekklesia-prod-10-2025.firebaseapp.com, http://localhost:3000` to align with Firebase Hosting and local tooling.

### Firebase Configuration

- **Project**: ekklesia-prod-10-2025
- **Region**: europe-west2 (London)
- **Authentication**: Custom token provider
- **Database**: Firestore (user profiles)
- **Hosting**: ekklesia-prod-10-2025.web.app

---

## Endpoints

### Firebase Hosting (Static)
- `GET /dashboard.html` - Member dashboard (main page after login)
- `GET /profile.html` - User profile page
- `GET /test.html` - OAuth test page with Kenni.is integration
- `GET /test-events.html` - Events service integration test page

### Cloud Functions (API)
- `POST handleKenniAuth` - OAuth token exchange
  - URL: https://handlekenniauth-521240388393.europe-west2.run.app
  - Body: `{ code, codeVerifier, state }`
  - Returns: `{ customToken }`

- `POST verifyMembership` - Kennitala verification
  - URL: https://verifymembership-521240388393.europe-west2.run.app
  - Body: `{ kennitala }`
  - Returns: `{ isMember: boolean }`

---

## Documentation

**Current Implementation**:
- [../docs/status/CURRENT_PRODUCTION_STATUS.md](../docs/status/CURRENT_PRODUCTION_STATUS.md) - Infrastructure status
- [../docs/SYSTEM_ARCHITECTURE_OVERVIEW.md](../docs/SYSTEM_ARCHITECTURE_OVERVIEW.md) - System architecture

**Local Documentation** (not in git):
- `docs/FIREBASE_KENNI_SETUP.md` - Complete setup guide
- `docs/KENNI_QUICKSTART.md` - Quick start

**Legacy (Archived)**:
- [auth/README.md](auth/README.md) - Old ZITADEL implementation

---

## Migration History

### Oct 6-7, 2025: Firebase Migration

**Removed**:
- Self-hosted ZITADEL (Cloud Run)
- OIDC Bridge Proxy (Cloud Run)
- Cloud SQL zitadel8 database
- Load Balancer (auth.si-xj.org)
- Node.js/Fastify server

**Added**:
- Firebase Hosting (static HTML/CSS)
- Firebase Authentication (custom tokens)
- Cloud Functions (handleKenniAuth, verifyMembership) - Python 3.11
- Direct Kenni.is OAuth PKCE integration
- Firestore user profiles

**Results**:
- Cost: $135/month → $0/month (90% savings)
- Simpler architecture (no server, no database)
- Direct integration (no OIDC Bridge)
- Better scalability (Firebase CDN)

---

## 🗄️ Archived Code

### members/archive/stage3-oidc-provider-attempt/
Legacy Firebase OIDC provider implementation (JavaScript/Node.js approach). Replaced by current Python Cloud Functions with manual OAuth PKCE.

### members/archive/node-zitadel-implementation/
Legacy ZITADEL authentication implementation. Decommissioned Oct 6-7, 2025.

---

## Development

### Local Testing

Firebase Hosting and Cloud Functions require production URLs configured in Kenni.is. Local development must use Firebase Hosting preview channels:

```bash
# Deploy to preview channel
firebase hosting:channel:deploy preview --project ekklesia-prod-10-2025

# Test with preview URL
# https://ekklesia-prod-10-2025--preview-XXXXXXXX.web.app
```

**Do not test OAuth flows locally** - Kenni.is requires production redirect URIs.

### Function Development

```bash
cd functions

# Install dependencies
pip install -r requirements.txt
npm install

# Deploy functions
firebase deploy --only functions --project ekklesia-prod-10-2025
```

---

## Technology Stack

### Production Stack
- **Language**: Python 3.11 (Cloud Functions)
- **Framework**: Firebase Functions Framework
- **Auth**: Firebase Admin SDK
- **OAuth**: Requests library (Kenni.is PKCE)
- **Database**: Firestore
- **Hosting**: Firebase Hosting

### Dependencies
See `functions/requirements.txt`:
- firebase-admin
- firebase-functions
- requests
- PyJWT
- cryptography

---

## Project

- **Organization**: Sósíalistaflokkur Íslands (Socialist Party of Iceland)
- **Repository**: https://github.com/sosialistaflokkurinn/ekklesia
- **Platform**: Ekklesia e-democracy platform
- **Project**: ekklesia-prod-10-2025
- **Region**: europe-west2 (London)

---

## Support

**Production Issues**:
- Firebase Console: https://console.firebase.google.com/project/ekklesia-prod-10-2025
- GCP Console: https://console.cloud.google.com/run?project=ekklesia-prod-10-2025
- Cloud Functions logs: Cloud Run → handlekenniauth/verifymembership

**Kenni.is Support**:
- Documentation: https://idp.kenni.is/
- OAuth configuration managed through Kenni.is portal

---

**Production Account**: gudrodur@sosialistaflokkurinn.is
**Last Updated**: 2025-10-12
