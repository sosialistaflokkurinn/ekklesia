# Ekklesia Members Service

✅ **Production Status**: Firebase-based implementation operational
🔄 **Migration Complete**: Migrated from ZITADEL to Firebase (Oct 6-7, 2025)

---

## Current Implementation (Firebase-based)

**Production**: https://ekklesia-prod-10-2025.web.app
**Technology**: Firebase Hosting + Cloud Functions + Firebase Authentication

### What's Running

- **Firebase Hosting**: Static HTML/CSS from `public/`
- **Cloud Functions**:
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
- Member verification against kennitalas.txt ✅
- User profile with national eID data ✅
- Icelandic language UI ✅
- Component-based CSS architecture ✅
- Firestore user profiles ✅

---

## Quick Start

### Deployment

```bash
# Deploy Cloud Functions
cd members
./scripts/deploy-stage-3-functions.sh

# Deploy hosting (if changes to public/)
firebase deploy --only hosting --project ekklesia-prod-10-2025
```

### Testing Production

```bash
# Test Firebase Hosting
curl https://ekklesia-prod-10-2025.web.app/

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
│   ├── index.html                    Landing page
│   ├── login.html                    Kenni.is OAuth login
│   ├── profile.html                  User profile
│   ├── callback.html                 OAuth callback handler
│   └── styles/                       Component CSS
│       ├── global.css
│       └── components/
│           ├── index.css
│           ├── login.css
│           └── profile.css
│
├── functions/                        ✅ PRODUCTION - Cloud Functions
│   ├── index.js                      handleKenniAuth & verifyMembership
│   ├── package.json                  Dependencies
│   └── node_modules/
│
├── data/                             ✅ PRODUCTION - Membership data
│   └── kennitalas.txt                Verified member kennitalas (200978-XXXX format)
│
├── docs/                             📚 Documentation
│   ├── FIREBASE_KENNI_SETUP.md       Setup guide
│   └── KENNI_QUICKSTART.md           Quick start
│
├── scripts/                          🔧 Deployment
│   └── deploy-stage-3-functions.sh   Deploy Cloud Functions
│
├── firebase.json                     Firebase configuration
├── .firebaserc                       Project config
├── CODEBASE_STRUCTURE.md             Code organization guide
└── README.md                         ⭐ YOU ARE HERE
```

### Legacy Code (Archived)

⚠️ **Not used in production** - See [archive/node-zitadel-implementation/](archive/node-zitadel-implementation/)

The `archive/node-zitadel-implementation/` directory contains the original Node.js/ZITADEL implementation (replaced Oct 6-7, 2025). All ZITADEL references are in archived code only.

**See**: [CODEBASE_STRUCTURE.md](CODEBASE_STRUCTURE.md) for detailed explanation.

---

## Authentication Flow (Firebase)

1. User visits Firebase Hosting landing page (`/`)
2. Clicks "Innskráning með Rafræn Auðkenni"
3. Redirected to `login.html`
4. JavaScript initiates OAuth PKCE flow with Kenni.is
5. Kenni.is OAuth authorization (user authenticates with national eID)
6. Redirect to `callback.html` with authorization code
7. JavaScript calls `handleKenniAuth` Cloud Function
8. Function exchanges code for tokens with Kenni.is
9. Function calls `verifyMembership` to check kennitala
10. Function creates Firebase custom token with claims
11. Client signs in with custom token
12. User redirected to `profile.html`

### Security Features

- ✅ OAuth 2.0 PKCE (RFC 7636) - Public client flow
- ✅ State parameter for CSRF protection
- ✅ Nonce for replay attack prevention
- ✅ Firebase custom tokens with verified claims
- ✅ Kennitala verification against membership list
- ✅ Secure HTTPS-only communication
- ✅ Firebase security rules for Firestore

---

## Configuration

### Environment Variables (Cloud Functions)

Set via Secret Manager:

```bash
# Kenni.is OAuth credentials
KENNI_CLIENT_ID=@sosi-kosningakerfi.is/rafr-nt-kosningakerfi-s-s
KENNI_CLIENT_SECRET=[stored in Secret Manager]

# Kenni.is endpoints
KENNI_ISSUER=https://idp.kenni.is/sosi-kosningakerfi.is
KENNI_AUTH_URL=https://idp.kenni.is/oauth2/auth
KENNI_TOKEN_URL=https://idp.kenni.is/oauth2/token
KENNI_USERINFO_URL=https://idp.kenni.is/oauth2/userinfo

# Redirect URI
REDIRECT_URI=https://ekklesia-prod-10-2025.web.app/callback.html

# Firebase service account (auto-configured in Cloud Functions)
GOOGLE_APPLICATION_CREDENTIALS=[automatic]
```

### Firebase Configuration

- **Project**: ekklesia-prod-10-2025
- **Region**: europe-west2 (London)
- **Authentication**: Custom token provider
- **Database**: Firestore (user profiles)
- **Hosting**: ekklesia-prod-10-2025.web.app

---

## Endpoints

### Firebase Hosting (Static)
- `GET /` - Landing page
- `GET /login.html` - Login page (OAuth initiation)
- `GET /profile.html` - User profile (requires auth)
- `GET /callback.html` - OAuth callback handler

### Cloud Functions (API)
- `POST handleKenniAuth` - OAuth token exchange
  - URL: https://handlekenniauth-ymzrguoifa-nw.a.run.app
  - Body: `{ code, codeVerifier, state }`
  - Returns: `{ customToken }`

- `POST verifyMembership` - Kennitala verification
  - URL: https://verifymembership-ymzrguoifa-nw.a.run.app
  - Body: `{ kennitala }`
  - Returns: `{ isMember: boolean }`

---

## Documentation

**Current Implementation**:
- [CODEBASE_STRUCTURE.md](CODEBASE_STRUCTURE.md) - Code organization
- [docs/FIREBASE_KENNI_SETUP.md](docs/FIREBASE_KENNI_SETUP.md) - Complete setup guide
- [docs/KENNI_QUICKSTART.md](docs/KENNI_QUICKSTART.md) - Quick start

**Production Status**:
- [../CURRENT_PRODUCTION_STATUS.md](../CURRENT_PRODUCTION_STATUS.md) - Infrastructure status
- [../docs/DOCUMENTATION_INDEX.md](../docs/DOCUMENTATION_INDEX.md) - All documentation

**Legacy (Archived)**:
- [archive/node-zitadel-implementation/](archive/node-zitadel-implementation/) - Old ZITADEL code

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
- Cloud Functions (handleKenniAuth, verifyMembership)
- Direct Kenni.is OAuth PKCE integration
- Firestore user profiles

**Results**:
- Cost: $135/month → $0/month
- Simpler architecture (no server, no database)
- Direct integration (no OIDC Bridge)
- Better scalability (Firebase CDN)

**See**: [../docs/FIREBASE_MIGRATION_STATUS.md](../docs/FIREBASE_MIGRATION_STATUS.md)

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

---

## Project

- **Organization**: Samstaða (Icelandic Social Democratic Party)
- **Repository**: https://github.com/sosialistaflokkurinn/ekklesia
- **Platform**: Ekklesia e-democracy platform
- **License**: See repository root

---

## Support

**Production Issues**:
- Firebase Console: https://console.firebase.google.com/project/ekklesia-prod-10-2025
- GCP Console: https://console.cloud.google.com/run?project=ekklesia-prod-10-2025
- Cloud Functions logs: GCP Cloud Run → handlekenniauth/verifymembership

**Kenni.is Support**:
- Documentation: https://idp.kenni.is/
- OAuth configuration managed through Kenni.is portal
