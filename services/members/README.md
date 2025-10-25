# Ekklesia Members Service

**Status**: ✅ **Production Deployed** (Firebase Hosting + Cloud Functions)
**Production URL**: https://ekklesia-prod-10-2025.web.app
**Last Updated**: 2025-10-24
**Purpose**: Member authentication, profile management, and member portal frontend
**Architecture**: Phase 5 - Firebase Hosting + Python Cloud Functions + Kenni.is OAuth

---

## Overview

The Members Service provides the public-facing member portal for Sósíalistaflokkur Íslands. It handles authentication via Kenni.is (Iceland's national eID), user profile management, and serves as the frontend for the voting system.

**Key Features**:
- 🔐 Kenni.is OAuth 2.0 PKCE authentication (Iceland's national eID)
- 🔥 Firebase Hosting (static HTML/CSS/JavaScript)
- ☁️ Cloud Functions (Python 3.11, 2nd gen)
- 📊 Firestore for user profiles
- 💰 Cost: $0/month (Firebase free tier)

---

## Production Status

### What's Running (Oct 24, 2025)

**Firebase Hosting**:
- **URL**: https://ekklesia-prod-10-2025.web.app
- **CDN**: Global (Firebase CDN)
- **Pages**: 7 HTML pages (index, dashboard, profile, elections, election-detail, election-api-test, events)
- **Cost**: $0/month (free tier)

**Cloud Functions** (Python 3.11, 2nd gen):
- **handleKenniAuth**: OAuth token exchange with Kenni.is (HTTPS function)
  - URL: https://handlekenniauth-521240388393.europe-west2.run.app
  - Deployed: Cloud Run (2nd gen)
  - Region: europe-west2 (London)

- **verifyMembership**: Kennitala verification against membership list (callable function)
  - URL: https://verifymembership-521240388393.europe-west2.run.app
  - Deployed: Cloud Run (2nd gen)
  - Region: europe-west2 (London)

- **healthz**: Health check and configuration sanity endpoint
  - URL: https://healthz-521240388393.europe-west2.run.app
  - Returns: Environment variable presence and JWKS cache stats

**Firebase Authentication**:
- Custom token provider
- Custom claims: kennitala, email, phoneNumber, roles, isMember

**Firestore**:
- Collection: `users` (user profiles)
- Collection: `rate_limits` (IP-based rate limiting)

**Cloud Storage**:
- `kennitalas.txt` - Membership verification list (DDMMYYXXXX format)

---

## Project Structure

```
members/
├── public/                           ✅ SYMLINK → ../../apps/members-portal
│   ├── index.html                    Login page (Kenni.is OAuth)
│   ├── dashboard.html                Member dashboard (main page after login)
│   ├── profile.html                  User profile page
│   ├── elections.html                Elections list
│   ├── election-detail.html          Election details and voting
│   ├── election-api-test.html        API integration testing
│   ├── events.html                   Events and announcements
│   │
│   ├── js/                           JavaScript modules
│   │   ├── auth.js                   Authentication logic (Kenni.is OAuth PKCE)
│   │   ├── login.js                  Login page logic
│   │   ├── dashboard.js              Dashboard page logic
│   │   ├── profile.js                Profile page logic
│   │   ├── elections.js              Elections list logic
│   │   ├── election-detail.js        Election voting logic
│   │   ├── election-api-test.js      API testing logic
│   │   ├── events.js                 Events page logic
│   │   ├── nav.js                    Navigation component
│   │   ├── page-init.js              Page initialization
│   │   └── api/                      API client modules
│   │       ├── events.js             Events Service API client
│   │       └── elections.js          Elections Service API client
│   │
│   ├── styles/                       CSS stylesheets
│   │   ├── global.css                Global styles, CSS reset, design tokens
│   │   ├── elections.css             Elections-specific styles
│   │   ├── events.css                Events-specific styles
│   │   └── components/               Component-specific styles
│   │       ├── page.css              Page layout
│   │       ├── navigation.css        Navigation bar
│   │       └── elections.css         Election components
│   │
│   └── i18n/                         Internationalization
│       ├── R.js                      R.string pattern utility
│       └── is.js                     Icelandic translations
│
├── functions/                        ✅ PRODUCTION - Cloud Functions (Python 3.11)
│   ├── main.py                       Cloud Functions implementation
│   ├── utils_logging.py              Structured logging utilities
│   ├── util_jwks.py                  JWKS client with TTL caching
│   ├── requirements.txt              Python dependencies
│   ├── package.json                  Node.js dependencies (Firebase SDK)
│   ├── .env.yaml                     Environment variables (NOT in git)
│   └── .gcloudignore                 Deployment exclusions
│
├── data/                             ✅ Membership data (deployed to Cloud Storage)
│   └── kennitalas.txt                Verified member kennitalas (DDMMYYXXXX format)
│
├── docs/                             📚 Documentation (local-only, NOT in git)
│   ├── FIREBASE_KENNI_SETUP.md       Complete setup guide
│   └── KENNI_QUICKSTART.md           Quick start guide
│
├── archive/                          🗄️ ARCHIVED - Legacy code (NOT in production)
│   ├── stage3-oidc-provider-attempt/ Legacy Firebase OIDC provider implementation
│   └── node-zitadel-implementation/  Legacy ZITADEL authentication (decommissioned Oct 6-7, 2025)
│
├── firebase.json                     Firebase configuration
├── .firebaserc                       Firebase project config
└── README.md                         ⭐ YOU ARE HERE
```

**Important**: The `public/` directory is a **symlink** to `../../apps/members-portal`. All HTML, CSS, and JavaScript files are actually located in `/home/gudro/Development/projects/ekklesia/apps/members-portal/`.

---

## Pages (Frontend)

All pages served via Firebase Hosting at https://ekklesia-prod-10-2025.web.app

### Public Pages

#### `index.html` - Login Page
- **URL**: `/` or `/index.html`
- **Purpose**: Kenni.is OAuth 2.0 PKCE authentication
- **Features**:
  - Kenni.is login button
  - OAuth PKCE flow (code challenge/verifier generation)
  - State parameter for CSRF protection
  - Custom token sign-in
- **JavaScript**: `js/login.js`
- **Redirects to**: `/dashboard.html` after successful login

### Authenticated Pages

#### `dashboard.html` - Member Dashboard
- **URL**: `/dashboard.html`
- **Purpose**: Main landing page after login
- **Features**:
  - User greeting (full name from Kenni.is)
  - Quick actions (view profile, elections, events)
  - Membership status indicator
- **JavaScript**: `js/dashboard.js`
- **Auth Required**: Yes (redirects to `/index.html` if not authenticated)

#### `profile.html` - User Profile
- **URL**: `/profile.html`
- **Purpose**: Display user profile information
- **Features**:
  - Full name (from Kenni.is)
  - Kennitala (masked: DDMMYY-****)
  - Email and phone number (from Kenni.is)
  - Membership status (verified/not verified)
  - Profile picture placeholder
- **JavaScript**: `js/profile.js`
- **Auth Required**: Yes

#### `elections.html` - Elections List
- **URL**: `/elections.html`
- **Purpose**: List all available elections
- **Features**:
  - Current active elections
  - Past elections
  - Election status (draft, published, open, closed)
  - Link to election details
- **JavaScript**: `js/elections.js`
- **API**: Events Service (`GET /api/election`)
- **Auth Required**: Yes

#### `election-detail.html` - Election Details and Voting
- **URL**: `/election-detail.html?id={election_id}`
- **Purpose**: View election details and cast vote
- **Features**:
  - Election title, description, question
  - Answer options
  - Voting token request
  - Vote submission
  - Results (after voting closes)
- **JavaScript**: `js/election-detail.js`
- **API**:
  - Events Service (`POST /api/request-token`)
  - Elections Service (`POST /api/vote`)
- **Auth Required**: Yes

#### `events.html` - Events and Announcements
- **URL**: `/events.html`
- **Purpose**: Display party events and announcements
- **Features**:
  - Upcoming events
  - Past events
  - Event details
- **JavaScript**: `js/events.js`
- **Auth Required**: Yes

### Testing Pages

#### `election-api-test.html` - API Integration Testing
- **URL**: `/election-api-test.html`
- **Purpose**: Test complete voting flow with real APIs
- **Features**:
  - Health check tests
  - Token request testing
  - Vote submission testing
  - Error handling validation
  - Mock API toggle (USE_MOCK_API flag)
- **JavaScript**: `js/election-api-test.js`
- **API**: Events Service + Elections Service (complete flow)
- **Auth Required**: Yes

---

## Cloud Functions (Backend)

All Cloud Functions are Python 3.11, 2nd generation (Cloud Run), deployed to europe-west2.

### `handleKenniAuth` - OAuth Token Exchange (HTTPS Function)

**Endpoint**: `POST https://handlekenniauth-521240388393.europe-west2.run.app`

**Purpose**: Exchange Kenni.is authorization code for Firebase custom token

**Flow**:
1. Receive authorization code + PKCE code verifier from frontend
2. Exchange code for ID token with Kenni.is (OAuth token endpoint)
3. Verify ID token signature (JWKS from Kenni.is)
4. Extract user information (kennitala, name, email, phone)
5. Create or update user in Firestore
6. Create Firebase custom token with claims
7. Return custom token to frontend

**Request**:
```json
{
  "kenniAuthCode": "oauth_code_from_kenni_is",
  "pkceCodeVerifier": "generated_code_verifier"
}
```

**Response**:
```json
{
  "customToken": "firebase_custom_token",
  "uid": "firebase_uid"
}
```

**Security Features**:
- CORS validation (allowed origins from environment)
- Rate limiting (5 attempts per 10 minutes per IP)
- Input validation (auth code max 500 chars, verifier max 200 chars)
- PKCE verification (code verifier sent to Kenni.is)
- ID token signature verification (JWKS)
- Race condition handling (concurrent user creation)
- Custom claims persistence (roles preserved across logins)

**Error Codes**:
- `400 INVALID_INPUT` - Missing or invalid input
- `400 INVALID_JSON` - Malformed JSON
- `429 RATE_LIMITED` - Too many auth attempts (retry after 600s)
- `500 CONFIG_MISSING` - Missing environment variables
- `500 INTERNAL` - Unexpected error
- `502 TOKEN_EXCHANGE_FAILED` - Kenni.is token exchange failed

**Example**:
```bash
curl -X POST https://handlekenniauth-521240388393.europe-west2.run.app \
  -H "Content-Type: application/json" \
  -H "X-Correlation-ID: $(uuidgen)" \
  -d '{
    "kenniAuthCode": "AUTH_CODE_FROM_KENNIS",
    "pkceCodeVerifier": "CODE_VERIFIER_FROM_PKCE"
  }'
```

---

### `verifyMembership` - Membership Verification (Callable Function)

**Endpoint**: `POST https://verifymembership-521240388393.europe-west2.run.app`

**Purpose**: Verify if authenticated user's kennitala is in membership list

**Flow**:
1. Verify user is authenticated (Firebase Auth required)
2. Extract kennitala from custom claims
3. Download `kennitalas.txt` from Cloud Storage
4. Check if kennitala exists in list
5. Update user profile in Firestore (`isMember` field)
6. Update custom claims with membership status
7. Return verification result

**Request** (Firebase Callable):
```javascript
// Frontend calls this via Firebase SDK
const verifyMembership = httpsCallable(functions, 'verifyMembership');
const result = await verifyMembership();
```

**Response**:
```json
{
  "isMember": true,
  "verified": true,
  "kennitala": "200978-****"
}
```

**Security Features**:
- Firebase Authentication required
- Kennitala extracted from verified custom claims
- Membership status persisted to Firestore and custom claims
- Kennitala masked in response (DDMMYY-****)

**Error Codes**:
- `UNAUTHENTICATED` - User not authenticated
- `FAILED_PRECONDITION` - No kennitala in custom claims
- `INTERNAL` - Failed to verify membership

---

### `healthz` - Health Check (HTTPS Function)

**Endpoint**: `GET https://healthz-521240388393.europe-west2.run.app`

**Purpose**: Health check and configuration sanity check

**Response**:
```json
{
  "ok": true,
  "env": {
    "KENNI_IS_ISSUER_URL": true,
    "KENNI_IS_CLIENT_ID": true,
    "KENNI_IS_CLIENT_SECRET": true,
    "KENNI_IS_REDIRECT_URI": true,
    "FIREBASE_STORAGE_BUCKET": true
  },
  "jwks": {
    "cacheSize": 1,
    "lastRefresh": "2025-10-24T12:30:00.000Z",
    "ttlSeconds": 3600
  },
  "issuerConfigured": true,
  "correlationId": "uuid-v4"
}
```

**Security Features**:
- Only shows presence of env vars (not values)
- CORS headers
- X-Correlation-ID for request tracing

**Example**:
```bash
curl -s https://healthz-521240388393.europe-west2.run.app | jq
```

---

## Authentication Flow (Kenni.is OAuth PKCE)

### Complete Flow Diagram

```
1. User visits https://ekklesia-prod-10-2025.web.app/index.html
   ↓
2. User clicks "Innskráning með Kenni.is" button
   ↓
3. Frontend (login.js) generates PKCE challenge:
   - code_verifier = random(43-128 chars, base64url)
   - code_challenge = SHA256(code_verifier).base64url
   - state = random UUID (CSRF protection)
   ↓
4. Frontend redirects to Kenni.is OAuth:
   https://idp.kenni.is/oauth2/auth?
     client_id=@sosi-kosningakerfi.is/...
     &redirect_uri=https://ekklesia-prod-10-2025.web.app/index.html
     &response_type=code
     &scope=openid+profile+email+phone+national_id
     &code_challenge={code_challenge}
     &code_challenge_method=S256
     &state={state}
   ↓
5. User authenticates with Kenni.is (national eID)
   - Íslykill (mobile app)
   - Rafræn skilríki (smart card)
   - Kennitala + password
   ↓
6. Kenni.is redirects back to redirect_uri:
   https://ekklesia-prod-10-2025.web.app/index.html?
     code={authorization_code}
     &state={state}
   ↓
7. Frontend validates state (CSRF check)
   ↓
8. Frontend calls handleKenniAuth Cloud Function:
   POST https://handlekenniauth-521240388393.europe-west2.run.app
   {
     "kenniAuthCode": "{authorization_code}",
     "pkceCodeVerifier": "{code_verifier}"
   }
   ↓
9. handleKenniAuth exchanges code for tokens:
   POST https://idp.kenni.is/oauth2/token
   {
     "grant_type": "authorization_code",
     "code": "{authorization_code}",
     "redirect_uri": "...",
     "client_id": "...",
     "client_secret": "...",
     "code_verifier": "{code_verifier}"  ← PKCE verification
   }
   ↓
10. Kenni.is returns ID token (JWT)
    ↓
11. handleKenniAuth verifies ID token:
    - Fetch JWKS from https://idp.kenni.is/.well-known/jwks.json
    - Verify signature (RS256)
    - Verify issuer, audience, expiration
    ↓
12. handleKenniAuth extracts claims:
    - national_id (kennitala)
    - name (full name)
    - email
    - phone_number
    ↓
13. handleKenniAuth creates/updates Firestore user:
    db.collection('users').document(uid).set({
      fullName, kennitala, email, phoneNumber,
      isMember: false,  // verified separately
      createdAt, lastLogin
    })
    ↓
14. handleKenniAuth creates Firebase custom token:
    auth.create_custom_token(uid, {
      kennitala, email, phoneNumber,
      roles: [...],  // preserved from previous login
      isMember: false
    })
    ↓
15. handleKenniAuth returns custom token:
    { "customToken": "...", "uid": "..." }
    ↓
16. Frontend signs in with custom token:
    await signInWithCustomToken(auth, customToken)
    ↓
17. Frontend redirects to dashboard:
    window.location.href = '/dashboard.html'
    ↓
18. User authenticated! ✅
```

---

## Security Features

### OAuth 2.0 PKCE (RFC 7636)
- ✅ Public client flow (no client secret in frontend)
- ✅ Code challenge/verifier generation (SHA256)
- ✅ State parameter for CSRF protection (Issue #33, Oct 12, 2025)
- ✅ Nonce for replay attack prevention

### Firebase Authentication
- ✅ Custom tokens with verified claims (kennitala, email, phone)
- ✅ Custom claims persistence (roles preserved across logins)
- ✅ ID token validation (signature, issuer, audience, expiration)

### Cloud Functions
- ✅ CORS validation (allowed origins from environment)
- ✅ Rate limiting (5 attempts per 10 minutes per IP, Issue #62)
- ✅ Input validation (auth code max 500 chars, verifier max 200 chars, Issue #64)
- ✅ Correlation ID for request tracing (X-Correlation-ID header)
- ✅ Structured logging (no PII in logs)
- ✅ Cache-Control headers (no caching of token responses)

### Firestore
- ✅ Security rules (Issue #30, Oct 12, 2025)
- ✅ Idempotency protection (race condition handling, Issue #32)
- ✅ Rate limiting via transactional counters

### Kenni.is Integration
- ✅ ID token signature verification (JWKS)
- ✅ JWKS caching with TTL (configurable via JWKS_CACHE_TTL_SECONDS)
- ✅ Kennitala format validation (DDMMYY-XXXX or DDMMYYXXXX)
- ✅ Kennitala normalization (consistent format)

### Membership Verification
- ✅ Cloud Storage for membership list (`kennitalas.txt`)
- ✅ Secure membership verification (callable function)
- ✅ Kennitala masking in responses (DDMMYY-****)

---

## Configuration

### Environment Variables (Cloud Functions)

Set in `functions/.env.yaml` (NOT in git):

```yaml
# Kenni.is OAuth Configuration
KENNI_IS_ISSUER_URL: "https://idp.kenni.is"
KENNI_IS_CLIENT_ID: "@sosi-kosningakerfi.is/rafr-nt-kosningakerfi-s-s"
KENNI_IS_CLIENT_SECRET: "SECRET_FROM_KENNI_IS"
KENNI_IS_REDIRECT_URI: "https://ekklesia-prod-10-2025.web.app/index.html"

# Firebase Configuration
FIREBASE_STORAGE_BUCKET: "ekklesia-prod-10-2025.appspot.com"

# CORS Configuration
CORS_ALLOWED_ORIGINS: "https://ekklesia-prod-10-2025.web.app,https://ekklesia-prod-10-2025.firebaseapp.com,http://localhost:3000"

# JWKS Cache Configuration (optional)
JWKS_CACHE_TTL_SECONDS: "3600"
```

### Firebase Configuration

**Project**: ekklesia-prod-10-2025
**Region**: europe-west2 (London)

**Hosting**:
- Primary domain: ekklesia-prod-10-2025.web.app
- Firebase domain: ekklesia-prod-10-2025.firebaseapp.com

**Authentication**:
- Provider: Custom token
- Custom claims: kennitala, email, phoneNumber, roles, isMember

**Firestore**:
- Database: `(default)`
- Collections:
  - `users` - User profiles
  - `rate_limits` - IP-based rate limiting

**Cloud Storage**:
- Bucket: ekklesia-prod-10-2025.appspot.com
- Files:
  - `kennitalas.txt` - Membership verification list

---

## Development

### Prerequisites

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Install Python dependencies (for Cloud Functions)
cd functions
pip install -r requirements.txt

# Install Node.js dependencies (for Firebase SDK)
npm install
```

### Local Testing

**IMPORTANT**: Kenni.is OAuth requires production redirect URIs. You cannot test the complete OAuth flow locally.

**Option 1: Firebase Hosting Preview Channels** (Recommended)

```bash
# Deploy to preview channel
firebase hosting:channel:deploy preview --project ekklesia-prod-10-2025

# Test with preview URL
# https://ekklesia-prod-10-2025--preview-XXXXXXXX.web.app
```

**Option 2: Production Testing**

```bash
# Deploy to production (use with caution)
firebase deploy --project ekklesia-prod-10-2025
```

**Local Development (No OAuth)**:

You can test non-OAuth features locally:

```bash
# Serve static files locally (no OAuth)
firebase serve --only hosting --project ekklesia-prod-10-2025

# Access at http://localhost:5000
```

### Function Development

```bash
cd functions

# Install dependencies
pip install -r requirements.txt
npm install

# Deploy single function (faster iteration)
firebase deploy --only functions:handleKenniAuth --project ekklesia-prod-10-2025

# Deploy all functions
firebase deploy --only functions --project ekklesia-prod-10-2025

# View logs
firebase functions:log --project ekklesia-prod-10-2025

# Or view in Cloud Console
gcloud run services list --project=ekklesia-prod-10-2025 --region=europe-west2
```

---

## Deployment

### Deploy All Services

```bash
cd members

# Deploy hosting + functions
firebase deploy --project ekklesia-prod-10-2025
```

### Deploy Hosting Only

```bash
firebase deploy --only hosting --project ekklesia-prod-10-2025
```

### Deploy Functions Only

```bash
firebase deploy --only functions --project ekklesia-prod-10-2025
```

### Deploy Single Function

```bash
# Faster iteration during development
firebase deploy --only functions:handleKenniAuth --project ekklesia-prod-10-2025
```

### Deploy Membership List

```bash
# Upload kennitalas.txt to Cloud Storage
gsutil cp data/kennitalas.txt gs://ekklesia-prod-10-2025.appspot.com/

# Verify upload
gsutil cat gs://ekklesia-prod-10-2025.appspot.com/kennitalas.txt | head
```

---

## CSS Architecture

Following `.claude/rules.md` CSS principles - semantic, component-based CSS.

### Global Stylesheet (`styles/global.css`)

**Purpose**: CSS reset, typography system, design tokens

**Features**:
- CSS reset (normalize.css-inspired)
- Typography scale (1rem base, 1.5 line-height)
- Color palette (CSS custom properties)
- Spacing system (--spacing-xs to --spacing-xl)
- Socialist red brand colors (#E53935, #C62828, #B71C1C)

**Design Tokens**:
```css
:root {
  /* Colors */
  --color-primary: #E53935;
  --color-primary-dark: #C62828;
  --color-text: #212121;
  --color-text-light: #757575;
  --color-background: #FAFAFA;
  --color-surface: #FFFFFF;
  --color-border: #E0E0E0;

  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;

  /* Typography */
  --font-family-base: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.25rem;
  --font-size-xl: 1.5rem;
}
```

### Component Stylesheets (`styles/components/`)

**Purpose**: Scoped, semantic CSS for UI components

**Files**:
- `page.css` - Page layout, container, header, footer
- `navigation.css` - Navigation bar, menu items
- `elections.css` - Election cards, voting UI

**Naming Convention**: BEM-inspired (Block__Element--Modifier)

```css
/* Example: Election card component */
.election-card {
  /* Block */
}

.election-card__title {
  /* Element */
}

.election-card--active {
  /* Modifier */
}
```

### Page-Specific Stylesheets (`styles/`)

**Purpose**: Page-specific layout and styles

**Files**:
- `elections.css` - Elections page layout
- `events.css` - Events page layout

### Benefits for Designers

✅ **Clear separation**: HTML structure + scoped CSS
✅ **CSS custom properties**: Easy theming (change --color-primary)
✅ **Semantic class names**: .election-card, not .flex-col-center
✅ **No utility classes**: No .mt-4, .px-2 (no Tailwind)
✅ **Easy iteration**: Change CSS without touching JavaScript

---

## Internationalization (i18n)

Android R.string pattern for maintainable translations.

### Structure

```
i18n/
├── R.js              # Utility module, language switching
└── is.js             # Icelandic strings (default)
```

### Usage

```javascript
// Import R.string
import { R } from '/i18n/R.js';

// Use translations
document.getElementById('title').textContent = R.string.login_title;
// Output: "Innskráning"

// In HTML (via JavaScript)
`<h1>${R.string.dashboard_greeting}</h1>`
```

### Adding New Language

1. Create `i18n/en.js` with matching keys:

```javascript
// i18n/en.js
export const strings = {
  login_title: "Login",
  dashboard_greeting: "Welcome",
  // ... all keys from is.js
};
```

2. Uncomment language switching in `i18n/R.js`:

```javascript
// Enable language switching
const currentLang = localStorage.getItem('language') || 'is';
import(`/i18n/${currentLang}.js`).then(module => {
  R.string = module.strings;
});
```

3. Add UI language switcher in navigation

### Benefits

✅ **Centralized**: All strings in one file per language
✅ **Scalable**: Easy to add new languages
✅ **Type-safe**: `R.string.key` pattern (IDE autocomplete)
✅ **Debug-friendly**: Missing key warnings in console

---

## Migration History

### Oct 6-7, 2025: Firebase Migration

**Removed**:
- ❌ Self-hosted ZITADEL (Cloud Run) - $60/month
- ❌ OIDC Bridge Proxy (Cloud Run) - $20/month
- ❌ Cloud SQL zitadel8 database - $25/month
- ❌ Load Balancer (auth.si-xj.org) - $30/month
- ❌ Node.js/Fastify server - maintenance burden

**Added**:
- ✅ Firebase Hosting (static HTML/CSS)
- ✅ Firebase Authentication (custom tokens)
- ✅ Cloud Functions (handleKenniAuth, verifyMembership) - Python 3.11
- ✅ Direct Kenni.is OAuth PKCE integration (no intermediary)
- ✅ Firestore user profiles

**Results**:
- 💰 Cost: $135/month → $0/month (100% savings)
- 🏗️ Architecture: Simpler (no server, no database)
- 🔐 Integration: Direct (no OIDC Bridge)
- 📈 Scalability: Better (Firebase CDN, auto-scaling)
- 🛠️ Maintenance: Lower (managed services)

---

## Technology Stack

### Frontend
- **HTML5**: Semantic HTML
- **CSS3**: Component-based, BEM-inspired
- **JavaScript**: ES6 modules (type="module")
- **Firebase SDK**: Authentication, Firestore, callable functions

### Backend (Cloud Functions)
- **Language**: Python 3.11
- **Framework**: Firebase Functions Framework (2nd gen)
- **Runtime**: Cloud Run (serverless)
- **Region**: europe-west2 (London)

### Dependencies

**Python** (`functions/requirements.txt`):
```txt
firebase-admin==6.2.0
firebase-functions==0.1.1
requests==2.31.0
PyJWT==2.8.0
cryptography==41.0.4
```

**Node.js** (`functions/package.json`):
```json
{
  "engines": {
    "node": "18"
  },
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^5.0.0"
  }
}
```

---

## Testing

### Manual Testing (Production)

```bash
# Test Firebase Hosting
curl -s https://ekklesia-prod-10-2025.web.app/index.html | grep -i "kenni"

# Test Health Check
curl -s https://healthz-521240388393.europe-west2.run.app | jq

# Test handleKenniAuth (requires valid auth code)
curl -X POST https://handlekenniauth-521240388393.europe-west2.run.app \
  -H "Content-Type: application/json" \
  -d '{"kenniAuthCode": "...", "pkceCodeVerifier": "..."}'
```

### Integration Testing

**election-api-test.html** provides end-to-end testing:

1. Visit https://ekklesia-prod-10-2025.web.app/election-api-test.html
2. Authenticate with Kenni.is
3. Run complete voting flow test
4. Verify all API calls succeed

---

## Monitoring & Debugging

### Cloud Functions Logs

```bash
# View all function logs
firebase functions:log --project ekklesia-prod-10-2025

# View specific function logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=handlekenniauth" \
  --limit=20 \
  --project=ekklesia-prod-10-2025 \
  --format="table(timestamp,jsonPayload.message,severity)"

# Follow logs in real-time
gcloud logging tail "resource.type=cloud_run_revision" \
  --project=ekklesia-prod-10-2025
```

### Firebase Hosting Logs

```bash
# View hosting requests
gcloud logging read "resource.type=firebase_domain" \
  --limit=20 \
  --project=ekklesia-prod-10-2025
```

### Structured Logging

All Cloud Functions use structured JSON logging:

```python
# functions/utils_logging.py
log_json("info", "User authenticated", uid=uid, kennitala="200978-****")
```

**Log Fields**:
- `severity`: error, warn, info, debug
- `message`: Human-readable message
- `correlationId`: Request tracing (X-Correlation-ID header)
- `uid`: Firebase user ID
- `kennitala`: Masked (DDMMYY-****)
- `ip`: IP address (rate limiting)

**PII Protection**: No full kennitalas, emails, or phone numbers in logs.

---

## Troubleshooting

### Issue: "Invalid redirect_uri" from Kenni.is

**Cause**: Redirect URI mismatch between frontend and Kenni.is configuration

**Fix**:
1. Check `KENNI_IS_REDIRECT_URI` in `functions/.env.yaml`
2. Verify matches Kenni.is OAuth application settings
3. Must be exact match (including trailing slash)

### Issue: "Token exchange failed" in handleKenniAuth

**Cause**: Missing or invalid PKCE code verifier

**Fix**:
1. Verify frontend generates code_verifier (43-128 chars, base64url)
2. Verify code_verifier is sent to handleKenniAuth
3. Check Cloud Functions logs for detailed error

### Issue: "User not authenticated" on dashboard

**Cause**: Firebase custom token not set or expired

**Fix**:
1. Check browser localStorage for Firebase token
2. Clear localStorage and re-authenticate
3. Verify handleKenniAuth returns customToken
4. Check frontend calls signInWithCustomToken()

### Issue: Rate limiting (429 error)

**Cause**: Too many authentication attempts from same IP

**Fix**:
1. Wait 10 minutes
2. Check Cloud Functions logs for rate limit warnings
3. Verify IP address extraction (X-Forwarded-For header)

---

## Production Checklist

### Before First Production Use

- [x] Firebase Hosting deployed
- [x] Cloud Functions deployed (handleKenniAuth, verifyMembership, healthz)
- [x] Kenni.is OAuth configured (redirect URI, scopes)
- [x] Environment variables set (functions/.env.yaml)
- [x] Membership list uploaded (kennitalas.txt)
- [x] Firestore security rules deployed
- [x] CORS configured (allowed origins)
- [x] Rate limiting tested
- [x] End-to-end OAuth flow tested
- [x] Migration from ZITADEL completed

### Monthly Maintenance

- [ ] Update membership list (kennitalas.txt)
- [ ] Review Cloud Functions logs (errors, rate limits)
- [ ] Check Firebase quota usage (free tier limits)
- [ ] Update dependencies (Python, Node.js)
- [ ] Test OAuth flow (verify still working)

---

## Documentation

**Production Status**:
- [../docs/status/CURRENT_PRODUCTION_STATUS.md](../docs/status/CURRENT_PRODUCTION_STATUS.md) - Infrastructure status
- [../docs/SYSTEM_ARCHITECTURE_OVERVIEW.md](../docs/SYSTEM_ARCHITECTURE_OVERVIEW.md) - System architecture

**Local Documentation** (NOT in git):
- `docs/FIREBASE_KENNI_SETUP.md` - Complete setup guide
- `docs/KENNI_QUICKSTART.md` - Quick start guide

**Legacy (Archived)**:
- [archive/node-zitadel-implementation/](archive/node-zitadel-implementation/) - Old ZITADEL implementation (decommissioned Oct 6-7, 2025)
- [archive/stage3-oidc-provider-attempt/](archive/stage3-oidc-provider-attempt/) - Legacy Firebase OIDC provider implementation

---

## Support

### Firebase Console
- **URL**: https://console.firebase.google.com/project/ekklesia-prod-10-2025
- **Hosting**: https://console.firebase.google.com/project/ekklesia-prod-10-2025/hosting/main
- **Functions**: https://console.firebase.google.com/project/ekklesia-prod-10-2025/functions
- **Firestore**: https://console.firebase.google.com/project/ekklesia-prod-10-2025/firestore
- **Authentication**: https://console.firebase.google.com/project/ekklesia-prod-10-2025/authentication

### GCP Console
- **Cloud Run**: https://console.cloud.google.com/run?project=ekklesia-prod-10-2025
- **Logs**: https://console.cloud.google.com/logs?project=ekklesia-prod-10-2025

### Kenni.is Support
- **Documentation**: https://idp.kenni.is/
- **OAuth Configuration**: Managed through Kenni.is portal

---

## Project

- **Organization**: Sósíalistaflokkur Íslands (Socialist Party of Iceland)
- **Repository**: https://github.com/sosialistaflokkurinn/ekklesia
- **Platform**: Ekklesia e-democracy platform
- **Project**: ekklesia-prod-10-2025
- **Region**: europe-west2 (London)

---

## Related Services

- **Events Service**: `/home/gudro/Development/projects/ekklesia/services/events`
  - Election management and voting token issuance
  - See: [services/events/README.md](../events/README.md)

- **Elections Service**: `/home/gudro/Development/projects/ekklesia/services/elections`
  - Anonymous voting and ballot counting
  - See: [services/elections/README.md](../elections/README.md)

---

**Production Account**: gudrodur@sosialistaflokkurinn.is
**Last Updated**: 2025-10-24
**Status**: ✅ Production Deployed - All systems operational
