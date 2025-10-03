# Members Service - OIDC Integration Technical Specification

**Version**: 1.0
**Date**: 2025-10-03
**Status**: ✅ Complete
**Target**: Milestone 2 - Story #14 (Secure Login with National eID)

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication Flow](#authentication-flow)
3. [System Architecture](#system-architecture)
4. [API Specifications](#api-specifications)
5. [Security Requirements](#security-requirements)
6. [Session Management](#session-management)
7. [Error Handling](#error-handling)
8. [Configuration](#configuration)
9. [Code Structure](#code-structure)
10. [Testing Strategy](#testing-strategy)
11. [Deployment](#deployment)

---

## Overview

### Purpose
Implement OpenID Connect (OIDC) authentication for the Members service, enabling users to log in securely using their Kenni.is national eID credentials via ZITADEL as the authorization server.

### Scope
- OIDC Authorization Code Flow with PKCE
- Session management with secure cookies
- User profile extraction from ID tokens
- Login, logout, and callback handling
- Protected route middleware

### Technologies
- **Framework**: Fastify 4.x
- **OIDC Library**: `openid-client` 5.x
- **Session**: `@fastify/session` with Redis or MemoryStore
- **Cookies**: `@fastify/cookie`
- **Crypto**: Node.js built-in `crypto` module (for PKCE)

---

## Authentication Flow

### High-Level Flow Diagram

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       │ 1. GET /
       ↓
┌─────────────────────┐
│  Members Service    │
│  Landing Page       │
│  [Login Button]     │
└──────┬──────────────┘
       │
       │ 2. Click "Login with Kenni.is"
       │    GET /login
       ↓
┌─────────────────────┐
│  Members Service    │
│  - Generate PKCE    │
│  - Store in session │
│  - Build auth URL   │
└──────┬──────────────┘
       │
       │ 3. Redirect to ZITADEL
       │    /oauth/v2/authorize?
       │    client_id=...&
       │    redirect_uri=.../callback&
       │    code_challenge=...&
       │    code_challenge_method=S256&
       │    scope=openid+profile+email&
       │    state=...&
       │    response_type=code
       ↓
┌──────────────────────┐
│     ZITADEL          │
│  Login Options       │
│  [Kenni.is Button]   │
└──────┬───────────────┘
       │
       │ 4. Click "Kenni.is"
       │    Redirect to OIDC Bridge
       ↓
┌──────────────────────┐
│  OIDC Bridge Proxy   │
│  - Strip prompt=...  │
│  - Proxy to Kenni.is │
└──────┬───────────────┘
       │
       │ 5. Redirect to Kenni.is
       ↓
┌──────────────────────┐
│     Kenni.is         │
│  National eID Auth   │
└──────┬───────────────┘
       │
       │ 6. User authenticates
       │    Returns to Bridge
       ↓
┌──────────────────────┐
│  OIDC Bridge Proxy   │
│  - Re-sign token     │
│  - Return to ZITADEL │
└──────┬───────────────┘
       │
       │ 7. ZITADEL validates
       │    Redirect to Members /callback
       │    ?code=...&state=...
       ↓
┌─────────────────────┐
│  Members Service    │
│  /callback          │
│  - Verify state     │
│  - Exchange code    │
│  - Validate tokens  │
│  - Create session   │
└──────┬──────────────┘
       │
       │ 8. Redirect to /profile
       ↓
┌─────────────────────┐
│  Members Service    │
│  /profile           │
│  [User Profile]     │
└─────────────────────┘
```

### Detailed Step-by-Step Flow

#### Step 1: User Visits Landing Page
**Request:**
```http
GET / HTTP/1.1
Host: members-<project>.run.app
```

**Response:**
```html
<!DOCTYPE html>
<html>
<head><title>Samstaða Members</title></head>
<body>
  <h1>Welcome to Samstaða Members</h1>
  <a href="/login">
    <button>Login with Kenni.is</button>
  </a>
</body>
</html>
```

---

#### Step 2: User Initiates Login
**Request:**
```http
GET /login HTTP/1.1
Host: members-<project>.run.app
Cookie: session=...
```

**Backend Processing:**
1. Generate PKCE code verifier (43-128 characters, base64url)
2. Generate code challenge (SHA256 hash of verifier, base64url)
3. Generate random state (CSRF protection)
4. Store in session:
   ```javascript
   {
     codeVerifier: "dBjftJeZ4CVP...xBtZLwu",
     state: "af0ifjsldkj",
     returnTo: "/"  // Original page
   }
   ```
5. Build authorization URL
6. Redirect to ZITADEL

**Response:**
```http
HTTP/1.1 302 Found
Location: https://auth.si-xj.org/oauth/v2/authorize?
  client_id=340609127703243145&
  redirect_uri=https%3A%2F%2Fmembers-<project>.run.app%2Fcallback&
  response_type=code&
  scope=openid+profile+email&
  code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&
  code_challenge_method=S256&
  state=af0ifjsldkj
Set-Cookie: session=...; HttpOnly; Secure; SameSite=Lax
```

---

#### Step 3-7: ZITADEL → Kenni.is → ZITADEL
(Handled by ZITADEL and OIDC Bridge Proxy - already implemented ✅)

---

#### Step 8: ZITADEL Redirects to Members Callback
**Request:**
```http
GET /callback?code=abc123...&state=af0ifjsldkj HTTP/1.1
Host: members-<project>.run.app
Cookie: session=...
```

**Backend Processing:**
1. Verify state matches session (CSRF protection)
2. Retrieve code_verifier from session
3. Exchange authorization code for tokens:
   ```http
   POST /oauth/v2/token HTTP/1.1
   Host: auth.si-xj.org
   Content-Type: application/x-www-form-urlencoded

   grant_type=authorization_code&
   code=abc123...&
   redirect_uri=https://members-<project>.run.app/callback&
   client_id=340609127703243145&
   code_verifier=dBjftJeZ4CVP...xBtZLwu
   ```
4. Receive tokens:
   ```json
   {
     "access_token": "eyJhbGci...",
     "token_type": "Bearer",
     "expires_in": 43200,
     "id_token": "eyJhbGci...",
     "refresh_token": "v1.MfG..."
   }
   ```
5. Validate ID token (signature, issuer, audience, expiration)
6. Extract claims from ID token
7. Store in session:
   ```javascript
   {
     user: {
       sub: "340504966944793723",
       name: "G****** A*** J******",
       given_name: "G****** A***",
       family_name: "J******",
       email: "g******@gmail.com",
       email_verified: true,
       phone_number: "+354 *** ****",
       updated_at: 1696348800
     },
     tokens: {
       access_token: "eyJhbGci...",
       id_token: "eyJhbGci...",
       expires_at: 1696392000  // timestamp
     },
     authenticated: true
   }
   ```
8. Clear temporary PKCE data from session
9. Redirect to protected route

**Response:**
```http
HTTP/1.1 302 Found
Location: /profile
Set-Cookie: session=...; HttpOnly; Secure; SameSite=Lax; Max-Age=86400
```

---

#### Step 9: User Accesses Protected Profile Page
**Request:**
```http
GET /profile HTTP/1.1
Host: members-<project>.run.app
Cookie: session=...
```

**Backend Processing:**
1. Check session for `authenticated: true`
2. Verify token not expired
3. Extract user data from session
4. Render profile page

**Response:**
```html
<!DOCTYPE html>
<html>
<head><title>My Profile - Samstaða Members</title></head>
<body>
  <h1>My Profile</h1>
  <dl>
    <dt>Name:</dt>
    <dd>G****** A*** J******</dd>

    <dt>Email:</dt>
    <dd>g******@gmail.com</dd>

    <dt>Phone:</dt>
    <dd>+354 *** ****</dd>

    <dt>Membership Status:</dt>
    <dd><span class="badge-success">Active</span></dd>
  </dl>
  <a href="/logout">Logout</a>
</body>
</html>
```

---

#### Step 10: User Logs Out
**Request:**
```http
GET /logout HTTP/1.1
Host: members-<project>.run.app
Cookie: session=...
```

**Backend Processing:**
1. Destroy session
2. Clear session cookie
3. (Optional) Call ZITADEL end_session endpoint
4. Redirect to landing page

**Response:**
```http
HTTP/1.1 302 Found
Location: /
Set-Cookie: session=; Max-Age=0; HttpOnly; Secure
```

---

## System Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Members Service                       │
│                                                          │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │   Routes   │  │  Middleware  │  │   Libraries     │ │
│  │            │  │              │  │                 │ │
│  │ /          │  │ - auth       │  │ - oidc-client   │ │
│  │ /login     │  │ - session    │  │ - session       │ │
│  │ /callback  │  │ - error      │  │ - crypto        │ │
│  │ /logout    │  │              │  │                 │ │
│  │ /profile   │  │              │  │                 │ │
│  └────────────┘  └──────────────┘  └─────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │              Session Store                         │ │
│  │  - Redis (production)                              │ │
│  │  - MemoryStore (development)                       │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                         │
                         │ OIDC Protocol
                         ↓
         ┌───────────────────────────────┐
         │         ZITADEL              │
         │  (Authorization Server)      │
         └───────────────────────────────┘
```

### Technology Stack Details

#### Dependencies (package.json)
```json
{
  "name": "members-service",
  "version": "1.0.0",
  "type": "module",
  "engines": {
    "node": ">=20.0.0"
  },
  "dependencies": {
    "fastify": "^4.25.0",
    "@fastify/view": "^8.2.0",
    "@fastify/cookie": "^9.2.0",
    "@fastify/session": "^10.7.0",
    "@fastify/static": "^6.12.0",
    "openid-client": "^5.6.0",
    "pino": "^8.17.0",
    "pino-pretty": "^10.3.0",
    "connect-redis": "^7.1.0",
    "ioredis": "^5.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "nodemon": "^3.0.0"
  }
}
```

---

## API Specifications

### Endpoint: `GET /`

**Purpose**: Landing page (public, unauthenticated)

**Request:**
```http
GET / HTTP/1.1
Host: members-<project>.run.app
```

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: text/html

<!DOCTYPE html>
<html>...</html>
```

**State Machine:**
```
Unauthenticated → Display login button
Authenticated → Show "Go to Profile" link
```

---

### Endpoint: `GET /login`

**Purpose**: Initiate OIDC authentication flow

**Request:**
```http
GET /login HTTP/1.1
Host: members-<project>.run.app
Cookie: session=...
```

**Query Parameters:**
- `returnTo` (optional): URL to return to after login (default: `/profile`)

**Response:**
```http
HTTP/1.1 302 Found
Location: https://zitadel-ymzrguoifa-nw.a.run.app/oauth/v2/authorize?...
Set-Cookie: session=...; HttpOnly; Secure; SameSite=Lax
```

**Session Data Stored:**
```json
{
  "oidc": {
    "codeVerifier": "dBjftJeZ4CVP-mB0b3fZkIVfIXBvbYYq_A3fZLwu",
    "state": "af0ifjsldkj",
    "nonce": "n-0S6_WzA2Mj",
    "returnTo": "/profile"
  }
}
```

**Error Cases:**
- Already authenticated → Redirect to `/profile`

---

### Endpoint: `GET /callback`

**Purpose**: Handle OIDC callback from ZITADEL

**Request:**
```http
GET /callback?code=abc123&state=af0ifjsldkj HTTP/1.1
Host: members-<project>.run.app
Cookie: session=...
```

**Query Parameters:**
- `code` (required): Authorization code from ZITADEL
- `state` (required): CSRF protection token
- `error` (optional): Error code if auth failed
- `error_description` (optional): Human-readable error

**Response (Success):**
```http
HTTP/1.1 302 Found
Location: /profile
Set-Cookie: session=...; HttpOnly; Secure; SameSite=Lax; Max-Age=86400
```

**Response (Error):**
```http
HTTP/1.1 302 Found
Location: /?error=authentication_failed
```

**Session Data Stored (Success):**
```json
{
  "user": {
    "sub": "340504966944793723",
    "name": "G****** A*** J******",
    "given_name": "G****** A***",
    "family_name": "J******",
    "email": "g******@gmail.com",
    "email_verified": true,
    "phone_number": "+354 *** ****",
    "updated_at": 1696348800
  },
  "tokens": {
    "access_token": "eyJhbGci...",
    "id_token": "eyJhbGci...",
    "expires_at": 1696392000
  },
  "authenticated": true,
  "loginTimestamp": 1696348800000
}
```

**Error Cases:**
- State mismatch (CSRF) → Error page + clear session
- Invalid code → Error page
- Token validation failed → Error page
- Missing code_verifier → Error page

---

### Endpoint: `GET /logout`

**Purpose**: Log out user and clear session

**Request:**
```http
GET /logout HTTP/1.1
Host: members-<project>.run.app
Cookie: session=...
```

**Response:**
```http
HTTP/1.1 302 Found
Location: /
Set-Cookie: session=; Max-Age=0; HttpOnly; Secure
```

**Optional: ZITADEL Logout (RP-Initiated Logout)**
```http
HTTP/1.1 302 Found
Location: https://zitadel-ymzrguoifa-nw.a.run.app/oidc/v1/end_session?
  id_token_hint=eyJhbGci...&
  post_logout_redirect_uri=https://members-<project>.run.app/
```

---

### Endpoint: `GET /profile`

**Purpose**: Display user's membership profile (protected)

**Request:**
```http
GET /profile HTTP/1.1
Host: members-<project>.run.app
Cookie: session=...
```

**Response (Authenticated):**
```http
HTTP/1.1 200 OK
Content-Type: text/html

<!DOCTYPE html>
<html>
  <head><title>My Profile</title></head>
  <body>
    <h1>My Profile</h1>
    <dl>
      <dt>Name:</dt><dd>G****** A*** J******</dd>
      <dt>Email:</dt><dd>g******@gmail.com</dd>
      <dt>Membership Status:</dt><dd>Active</dd>
    </dl>
  </body>
</html>
```

**Response (Unauthenticated):**
```http
HTTP/1.1 302 Found
Location: /login?returnTo=%2Fprofile
```

**Data Source:**
```javascript
// From session.user (populated in /callback)
{
  name: session.user.name,
  email: session.user.email,
  phone: session.user.phone_number,
  status: "Active",  // Mock data for now
  lastUpdated: new Date(session.user.updated_at * 1000)
}
```

---

### Endpoint: `GET /healthz`

**Purpose**: Health check for Cloud Run

**Request:**
```http
GET /healthz HTTP/1.1
Host: members-<project>.run.app
```

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "healthy",
  "timestamp": "2025-10-03T12:00:00Z",
  "version": "1.0.0"
}
```

---

## Security Requirements

### 1. PKCE (Proof Key for Code Exchange)

**Why**: Prevents authorization code interception attacks

**Implementation:**
```javascript
import crypto from 'crypto';

function generateCodeVerifier() {
  return base64URLEncode(crypto.randomBytes(32));
}

function generateCodeChallenge(verifier) {
  return base64URLEncode(
    crypto.createHash('sha256').update(verifier).digest()
  );
}

function base64URLEncode(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
```

**Specification**: RFC 7636

---

### 2. State Parameter (CSRF Protection)

**Why**: Prevents cross-site request forgery attacks

**Implementation:**
```javascript
function generateState() {
  return crypto.randomBytes(16).toString('hex');
}

// In /login route
const state = generateState();
req.session.oidc = { state, ... };

// In /callback route
if (req.query.state !== req.session.oidc.state) {
  throw new Error('CSRF protection: state mismatch');
}
```

**Specification**: RFC 6749 Section 10.12

---

### 3. Nonce (Replay Attack Protection)

**Why**: Prevents ID token replay attacks

**Implementation:**
```javascript
function generateNonce() {
  return crypto.randomBytes(16).toString('hex');
}

// Include in authorization request
const authUrl = `${issuer}/authorize?...&nonce=${nonce}`;

// Validate in ID token claims
if (idToken.nonce !== req.session.oidc.nonce) {
  throw new Error('Nonce mismatch');
}
```

**Specification**: OpenID Connect Core 1.0 Section 3.1.2.1

---

### 4. ID Token Validation

**Required Checks:**
1. ✅ Signature verification (using ZITADEL's JWKS)
2. ✅ Issuer (`iss`) matches ZITADEL issuer
3. ✅ Audience (`aud`) matches client ID
4. ✅ Expiration (`exp`) is in the future
5. ✅ Issued at (`iat`) is reasonable
6. ✅ Nonce matches session nonce

**Implementation:**
```javascript
import { Issuer } from 'openid-client';

const zitadelIssuer = await Issuer.discover(
  'https://auth.si-xj.org'
);

const client = new zitadelIssuer.Client({
  client_id: '340609127703243145',
  response_types: ['code'],
  token_endpoint_auth_method: 'none'  // Public client
});

// Validate ID token
const tokenSet = await client.callback(
  redirectUri,
  { code, state },
  { code_verifier, state, nonce }
);

// tokenSet.claims() returns validated claims
```

---

### 5. Secure Session Management

**Cookie Configuration:**
```javascript
fastify.register(session, {
  secret: process.env.SESSION_SECRET,  // 32+ random bytes
  cookie: {
    httpOnly: true,      // Prevent XSS
    secure: true,        // HTTPS only
    sameSite: 'lax',     // CSRF protection
    maxAge: 86400000,    // 24 hours
    path: '/',
    domain: undefined    // Same origin only
  },
  saveUninitialized: false,
  rolling: true          // Reset expiry on activity
});
```

**Session Secret Generation:**
```bash
# Generate session secret
openssl rand -base64 32
# Store in GCP Secret Manager
gcloud secrets create members-session-secret \
  --data-file=- <<< "$(openssl rand -base64 32)"
```

---

### 6. HTTPS Enforcement

**Cloud Run Configuration:**
- All traffic automatically HTTPS
- HTTP requests auto-redirected to HTTPS
- Google-managed SSL certificates

**Application-Level:**
```javascript
// Set secure headers
fastify.addHook('onRequest', async (request, reply) => {
  reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
});
```

---

### 7. Token Storage

**✅ DO:**
- Store tokens in server-side session (Redis/Memory)
- Use httpOnly cookies for session ID
- Encrypt session data at rest (if using database)

**❌ DON'T:**
- Store tokens in localStorage (XSS vulnerable)
- Store tokens in sessionStorage
- Store tokens in regular cookies
- Expose tokens to client-side JavaScript

---

## Session Management

### Session Architecture

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       │ Cookie: session_id=abc123
       ↓
┌─────────────────────┐
│  Members Service    │
│  (Fastify Server)   │
└──────┬──────────────┘
       │
       │ Lookup session by ID
       ↓
┌─────────────────────┐
│   Session Store     │
│   - Redis (prod)    │
│   - Memory (dev)    │
└─────────────────────┘

Session Data:
{
  "sessionId": "abc123",
  "user": { ... },
  "tokens": { ... },
  "authenticated": true,
  "createdAt": 1696348800000,
  "lastActivity": 1696348900000
}
```

### Session Lifecycle

**1. Session Creation (After Login)**
```javascript
// In /callback route
req.session.user = {
  sub: idTokenClaims.sub,
  name: idTokenClaims.name,
  email: idTokenClaims.email,
  // ... other claims
};
req.session.tokens = {
  access_token: tokenSet.access_token,
  id_token: tokenSet.id_token,
  expires_at: Date.now() + (tokenSet.expires_in * 1000)
};
req.session.authenticated = true;
req.session.loginTimestamp = Date.now();
```

**2. Session Validation (On Each Request)**
```javascript
// Middleware: requireAuth
async function requireAuth(request, reply) {
  if (!request.session.authenticated) {
    return reply.redirect('/login?returnTo=' + request.url);
  }

  // Check token expiration
  if (request.session.tokens.expires_at < Date.now()) {
    // Token expired - re-authenticate
    request.session.destroy();
    return reply.redirect('/login?returnTo=' + request.url);
  }

  // Session valid
}
```

**3. Session Refresh (Rolling Session)**
```javascript
// Fastify-session with rolling: true
// Automatically updates session.lastActivity
// Resets cookie max-age on each request
```

**4. Session Termination (Logout)**
```javascript
// In /logout route
request.session.destroy((err) => {
  if (err) console.error('Session destroy error:', err);
  reply.clearCookie('sessionId');
  reply.redirect('/');
});
```

### Session Configuration

**Development (Memory Store):**
```javascript
import session from '@fastify/session';

fastify.register(session, {
  secret: 'dev-secret-min-32-chars-long-12345',
  cookie: {
    httpOnly: true,
    secure: false,  // Allow HTTP in dev
    sameSite: 'lax',
    maxAge: 86400000  // 24 hours
  },
  saveUninitialized: false
});
```

**Production (Redis):**
```javascript
import session from '@fastify/session';
import RedisStore from 'connect-redis';
import { createClient } from 'redis';

// Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});
await redisClient.connect();

fastify.register(session, {
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,  // From Secret Manager
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 86400000
  },
  saveUninitialized: false,
  rolling: true
});
```

---

## Error Handling

### Error Categories

#### 1. OIDC Errors (from ZITADEL)

**Error Response Format:**
```http
GET /callback?error=access_denied&error_description=User+cancelled HTTP/1.1
```

**Common Errors:**
| Error Code | Description | User Action |
|-----------|-------------|-------------|
| `access_denied` | User cancelled login | Show "Login cancelled" message |
| `invalid_request` | Malformed request | Log error, show generic message |
| `unauthorized_client` | Client not authorized | Contact admin (config issue) |
| `server_error` | ZITADEL internal error | Retry, show error message |

**Handling:**
```javascript
// In /callback route
if (request.query.error) {
  const errorMsg = request.query.error_description || request.query.error;
  return reply.view('error', {
    title: 'Login Failed',
    message: mapErrorToUserMessage(request.query.error),
    details: errorMsg
  });
}
```

#### 2. Validation Errors

**State Mismatch (CSRF):**
```javascript
if (request.query.state !== request.session.oidc?.state) {
  fastify.log.error('CSRF attack detected: state mismatch');
  request.session.destroy();
  return reply.status(400).view('error', {
    title: 'Security Error',
    message: 'Invalid request. Please try logging in again.',
    code: 'CSRF_DETECTED'
  });
}
```

**Token Validation Errors:**
```javascript
try {
  const tokenSet = await client.callback(...);
} catch (error) {
  if (error.error === 'invalid_grant') {
    return reply.view('error', {
      message: 'Login expired. Please try again.'
    });
  }

  fastify.log.error('Token validation failed:', error);
  return reply.view('error', {
    message: 'Authentication failed. Please try again.'
  });
}
```

#### 3. Application Errors

**Unauthenticated Access:**
```javascript
// Middleware response
if (!request.session.authenticated) {
  return reply.redirect('/login?returnTo=' + encodeURIComponent(request.url));
}
```

**Session Expired:**
```javascript
if (request.session.tokens.expires_at < Date.now()) {
  request.session.destroy();
  return reply.redirect('/login?error=session_expired');
}
```

### Error Logging

```javascript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty'
  } : undefined
});

// Error logging patterns
logger.error({
  error: 'OIDC_CALLBACK_FAILED',
  reason: error.message,
  query: request.query,
  sessionId: request.session.id
}, 'OIDC callback processing failed');
```

### User-Facing Error Pages

**Error Page Template:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>{{ title }} - Samstaða Members</title>
</head>
<body>
  <div class="error-container">
    <h1>{{ title }}</h1>
    <p class="error-message">{{ message }}</p>

    {% if details %}
    <details>
      <summary>Technical Details</summary>
      <pre>{{ details }}</pre>
    </details>
    {% endif %}

    <a href="/" class="button">Return to Home</a>
  </div>
</body>
</html>
```

---

## Configuration

### Environment Variables

```bash
# ZITADEL Configuration
ZITADEL_ISSUER=https://auth.si-xj.org
ZITADEL_CLIENT_ID=340609127703243145
ZITADEL_REDIRECT_URI=https://members-ymzrguoifa-nw.a.run.app/callback

# Session Management
SESSION_SECRET=<from-secret-manager>
SESSION_COOKIE_NAME=members_session
SESSION_MAX_AGE=86400000  # 24 hours in ms

# Redis (Production)
REDIS_URL=redis://<redis-host>:6379
# Or use Memorystore for Redis:
# REDIS_URL=redis://10.x.x.x:6379

# Application
NODE_ENV=production
PORT=8080
LOG_LEVEL=info

# Optional: Analytics
ANALYTICS_ID=<google-analytics-id>
```

### Secret Manager Integration

**Secrets to Store:**
1. `members-session-secret` - Session encryption key
2. (Future) `members-db-password` - Database password
3. (Future) `members-encryption-key` - Application-level encryption

**Loading Secrets in Cloud Run:**
```yaml
# In Cloud Run service configuration
env:
  - name: ZITADEL_ISSUER
    value: "https://auth.si-xj.org"
  - name: ZITADEL_CLIENT_ID
    value: "340609127703243145"
  - name: SESSION_SECRET
    valueFrom:
      secretKeyRef:
        name: members-session-secret
        key: latest
```

**Runtime Secret Access:**
```javascript
// Using Google Cloud Secret Manager client
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();

async function getSecret(name) {
  const [version] = await client.accessSecretVersion({
    name: `projects/<project-id>/secrets/${name}/versions/latest`
  });
  return version.payload.data.toString('utf8');
}

// Or use environment variables (recommended)
const sessionSecret = process.env.SESSION_SECRET;
```

### Configuration File (config.js)

```javascript
// src/config.js
export default {
  zitadel: {
    issuer: process.env.ZITADEL_ISSUER,
    clientId: process.env.ZITADEL_CLIENT_ID,
    redirectUri: process.env.ZITADEL_REDIRECT_URI,
    scopes: ['openid', 'profile', 'email']
  },

  session: {
    secret: process.env.SESSION_SECRET,
    cookieName: process.env.SESSION_COOKIE_NAME || 'members_session',
    maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000')
  },

  redis: {
    url: process.env.REDIS_URL || null  // null = use memory store
  },

  app: {
    port: parseInt(process.env.PORT || '8080'),
    env: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info'
  }
};
```

---

## Code Structure

### Directory Layout

```
members/
├── src/
│   ├── index.js                 # Application entry point
│   ├── config.js                # Configuration
│   ├── oidc.js                  # OIDC client setup
│   │
│   ├── routes/
│   │   ├── index.js             # GET / (landing page)
│   │   ├── auth.js              # /login, /callback, /logout
│   │   ├── profile.js           # /profile (protected)
│   │   └── health.js            # /healthz
│   │
│   ├── middleware/
│   │   ├── auth.js              # requireAuth middleware
│   │   ├── session.js           # Session setup
│   │   └── error.js             # Error handlers
│   │
│   ├── lib/
│   │   ├── pkce.js              # PKCE utilities
│   │   └── logger.js            # Logger setup
│   │
│   └── views/
│       ├── layouts/
│       │   └── main.html        # Base layout
│       ├── index.html           # Landing page
│       ├── profile.html         # Profile page
│       └── error.html           # Error page
│
├── Dockerfile
├── package.json
├── .dockerignore
└── README.md
```

### Key Files Implementation

#### `src/index.js`
```javascript
import Fastify from 'fastify';
import view from '@fastify/view';
import cookie from '@fastify/cookie';
import path from 'path';
import { fileURLToPath } from 'url';

import config from './config.js';
import sessionMiddleware from './middleware/session.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import indexRoutes from './routes/index.js';
import healthRoutes from './routes/health.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fastify = Fastify({
  logger: {
    level: config.app.logLevel
  }
});

// Register plugins
await fastify.register(cookie);
await fastify.register(sessionMiddleware);

// Setup view engine
await fastify.register(view, {
  engine: { html: () => {} },  // Simple HTML for now
  root: path.join(__dirname, 'views')
});

// Register routes
await fastify.register(indexRoutes);
await fastify.register(authRoutes);
await fastify.register(profileRoutes);
await fastify.register(healthRoutes);

// Start server
const start = async () => {
  try {
    await fastify.listen({
      port: config.app.port,
      host: '0.0.0.0'
    });
    fastify.log.info(`Server listening on port ${config.app.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
```

#### `src/oidc.js`
```javascript
import { Issuer } from 'openid-client';
import config from './config.js';

let client = null;

export async function getOIDCClient() {
  if (client) return client;

  // Discover ZITADEL configuration
  const issuer = await Issuer.discover(config.zitadel.issuer);

  client = new issuer.Client({
    client_id: config.zitadel.clientId,
    redirect_uris: [config.zitadel.redirectUri],
    response_types: ['code'],
    token_endpoint_auth_method: 'none'  // Public client (PKCE)
  });

  return client;
}
```

#### `src/routes/auth.js`
```javascript
import { getOIDCClient } from '../oidc.js';
import { generateCodeVerifier, generateCodeChallenge } from '../lib/pkce.js';
import config from '../config.js';

export default async function (fastify) {

  // Login route
  fastify.get('/login', async (request, reply) => {
    // Already authenticated?
    if (request.session.authenticated) {
      return reply.redirect('/profile');
    }

    const client = await getOIDCClient();

    // Generate PKCE
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = crypto.randomBytes(16).toString('hex');
    const nonce = crypto.randomBytes(16).toString('hex');

    // Store in session
    request.session.oidc = {
      codeVerifier,
      state,
      nonce,
      returnTo: request.query.returnTo || '/profile'
    };

    // Build authorization URL
    const authUrl = client.authorizationUrl({
      scope: config.zitadel.scopes.join(' '),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
      nonce
    });

    return reply.redirect(authUrl);
  });

  // Callback route
  fastify.get('/callback', async (request, reply) => {
    const client = await getOIDCClient();

    // Handle errors from ZITADEL
    if (request.query.error) {
      fastify.log.error('OIDC error:', request.query);
      return reply.view('error', {
        title: 'Login Failed',
        message: 'Authentication failed. Please try again.',
        details: request.query.error_description
      });
    }

    // Verify state (CSRF protection)
    if (request.query.state !== request.session.oidc?.state) {
      fastify.log.error('State mismatch');
      request.session.destroy();
      return reply.status(400).view('error', {
        title: 'Security Error',
        message: 'Invalid request state'
      });
    }

    try {
      // Exchange code for tokens
      const tokenSet = await client.callback(
        config.zitadel.redirectUri,
        request.query,
        {
          code_verifier: request.session.oidc.codeVerifier,
          state: request.session.oidc.state,
          nonce: request.session.oidc.nonce
        }
      );

      // Extract claims
      const claims = tokenSet.claims();

      // Store in session
      request.session.user = {
        sub: claims.sub,
        name: claims.name,
        given_name: claims.given_name,
        family_name: claims.family_name,
        email: claims.email,
        email_verified: claims.email_verified,
        phone_number: claims.phone_number,
        updated_at: claims.updated_at
      };

      request.session.tokens = {
        access_token: tokenSet.access_token,
        id_token: tokenSet.id_token,
        expires_at: Date.now() + (tokenSet.expires_in * 1000)
      };

      request.session.authenticated = true;
      request.session.loginTimestamp = Date.now();

      // Clear OIDC temp data
      delete request.session.oidc;

      // Redirect to return URL
      const returnTo = request.session.oidc?.returnTo || '/profile';
      return reply.redirect(returnTo);

    } catch (error) {
      fastify.log.error('Token exchange failed:', error);
      return reply.view('error', {
        title: 'Authentication Error',
        message: 'Failed to complete login. Please try again.'
      });
    }
  });

  // Logout route
  fastify.get('/logout', async (request, reply) => {
    const idToken = request.session.tokens?.id_token;

    // Destroy session
    request.session.destroy((err) => {
      if (err) fastify.log.error('Session destroy error:', err);
    });

    reply.clearCookie('members_session');

    // Optional: ZITADEL logout
    if (idToken) {
      const client = await getOIDCClient();
      const logoutUrl = client.endSessionUrl({
        id_token_hint: idToken,
        post_logout_redirect_uri: config.zitadel.redirectUri.replace('/callback', '/')
      });
      return reply.redirect(logoutUrl);
    }

    return reply.redirect('/');
  });
}
```

#### `src/middleware/auth.js`
```javascript
export async function requireAuth(request, reply) {
  // Check authentication
  if (!request.session.authenticated) {
    return reply.redirect('/login?returnTo=' + encodeURIComponent(request.url));
  }

  // Check token expiration
  if (request.session.tokens.expires_at < Date.now()) {
    request.session.destroy();
    return reply.redirect('/login?error=session_expired&returnTo=' + encodeURIComponent(request.url));
  }
}
```

#### `src/routes/profile.js`
```javascript
import { requireAuth } from '../middleware/auth.js';

export default async function (fastify) {

  fastify.get('/profile', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.session.user;

    return reply.view('profile', {
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone_number,
        status: 'Active',  // Mock for now
        lastUpdated: new Date(user.updated_at * 1000).toLocaleDateString()
      }
    });
  });
}
```

---

## Testing Strategy

### Unit Tests

**Test PKCE Generation:**
```javascript
// tests/lib/pkce.test.js
import { generateCodeVerifier, generateCodeChallenge } from '../src/lib/pkce.js';
import crypto from 'crypto';

describe('PKCE', () => {
  test('code verifier is 43-128 characters', () => {
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
  });

  test('code challenge is SHA256 of verifier', () => {
    const verifier = 'dBjftJeZ4CVP-mB0b3fZkIVfIXBvbYYq_A3fZLwu';
    const challenge = generateCodeChallenge(verifier);

    const expected = crypto.createHash('sha256')
      .update(verifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    expect(challenge).toBe(expected);
  });
});
```

### Integration Tests

**Test Login Flow:**
```javascript
// tests/routes/auth.test.js
import { test } from 'tap';
import { build } from '../helper.js';

test('/login redirects to ZITADEL', async (t) => {
  const app = await build(t);

  const res = await app.inject({
    method: 'GET',
    url: '/login'
  });

  t.equal(res.statusCode, 302);
  t.match(res.headers.location, /zitadel.*\/authorize/);
  t.match(res.headers.location, /code_challenge=/);
  t.match(res.headers.location, /code_challenge_method=S256/);
});

test('/profile requires authentication', async (t) => {
  const app = await build(t);

  const res = await app.inject({
    method: 'GET',
    url: '/profile'
  });

  t.equal(res.statusCode, 302);
  t.match(res.headers.location, /^\/login\?returnTo=/);
});
```

### End-to-End Tests

**Manual Test Checklist:**
- [ ] Visit `/` - see landing page
- [ ] Click "Login" - redirected to ZITADEL
- [ ] See "Login with Kenni.is" button
- [ ] Click Kenni.is - redirected to Kenni.is
- [ ] Authenticate with Kenni.is
- [ ] Redirected back to Members `/callback`
- [ ] Redirected to `/profile`
- [ ] See user profile with correct data
- [ ] Click "Logout" - session cleared
- [ ] Try accessing `/profile` - redirected to login

---

## Deployment

### Cloud Run Configuration

```yaml
# cloudbuild.yaml
steps:
  # Build Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'europe-west2-docker.pkg.dev/$PROJECT_ID/ekklesia-images/members:$SHORT_SHA', '.']

  # Push to Artifact Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'europe-west2-docker.pkg.dev/$PROJECT_ID/ekklesia-images/members:$SHORT_SHA']

  # Deploy to Cloud Run
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'members'
      - '--image=europe-west2-docker.pkg.dev/$PROJECT_ID/ekklesia-images/members:$SHORT_SHA'
      - '--region=europe-west2'
      - '--platform=managed'
      - '--allow-unauthenticated'
      - '--set-env-vars=NODE_ENV=production'
      - '--set-secrets=SESSION_SECRET=members-session-secret:latest'
      - '--min-instances=0'
      - '--max-instances=10'
      - '--memory=512Mi'
      - '--cpu=1'

images:
  - 'europe-west2-docker.pkg.dev/$PROJECT_ID/ekklesia-images/members:$SHORT_SHA'
```

### Manual Deployment

```bash
# Build and push
cd members
docker build -t members:latest .
docker tag members:latest europe-west2-docker.pkg.dev/$PROJECT_ID/ekklesia-images/members:latest
docker push europe-west2-docker.pkg.dev/$PROJECT_ID/ekklesia-images/members:latest

# Deploy
gcloud run deploy members \
  --image europe-west2-docker.pkg.dev/$PROJECT_ID/ekklesia-images/members:latest \
  --region europe-west2 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars ZITADEL_ISSUER=https://auth.si-xj.org,ZITADEL_CLIENT_ID=340609127703243145,NODE_ENV=production \
  --set-secrets SESSION_SECRET=members-session-secret:latest \
  --min-instances 0 \
  --max-instances 10 \
  --memory 512Mi \
  --cpu 1
```

---

## Appendix

### References

- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)
- [RFC 7636 - PKCE](https://datatracker.ietf.org/doc/html/rfc7636)
- [ZITADEL OIDC Documentation](https://zitadel.com/docs/guides/integrate/login/oidc)
- [openid-client Library](https://github.com/panva/node-openid-client)
- [Fastify Documentation](https://www.fastify.io/)

### Glossary

- **OIDC**: OpenID Connect - Authentication layer on top of OAuth 2.0
- **PKCE**: Proof Key for Code Exchange - Security extension for OAuth
- **IdP**: Identity Provider - Service that authenticates users (Kenni.is)
- **ZITADEL**: Authorization server / Identity platform
- **Claims**: User attributes in ID token (name, email, etc.)
- **Code Verifier**: Random string used in PKCE flow
- **Code Challenge**: SHA256 hash of code verifier
- **State**: Random value for CSRF protection
- **Nonce**: Random value for replay attack protection

---

**Document Version**: 1.0
**Last Updated**: 2025-10-03
**Author**: Technical Specification for Members Service OIDC Integration
