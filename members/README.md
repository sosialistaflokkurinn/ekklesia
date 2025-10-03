# Ekklesia Members Service

Member authentication and profile service for the Ekklesia platform.

## Status

✅ **Milestone 2 Complete** - OIDC Authentication (Story #14)

- OpenID Connect (OIDC) integration ✅
- Kenni.is national eID login ✅
- PKCE authentication flow ✅
- Session management with secure cookies ✅
- Protected routes with authentication middleware ✅
- Icelandic language UI ✅
- Deployed to Cloud Run ✅ (https://members-ymzrguoifa-nw.a.run.app)

**Version:** 2.0.0

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start server (localhost:3000)
npm start

# Test health endpoint
curl http://localhost:3000/health
```

### Deploy to Cloud Run

```bash
# Deploy to production
./deploy.sh

# Or with custom region
REGION=europe-west2 ./deploy.sh
```

## Endpoints

### Public Routes
- `GET /` - Landing page with login button
- `GET /health` - Health check (legacy)
- `GET /healthz` - Health check (Cloud Run)

### Authentication Routes
- `GET /login` - Initiate OIDC authentication flow
- `GET /callback` - OIDC callback handler
- `GET /logout` - End user session

### Protected Routes
- `GET /profile` - User profile page (requires authentication)

## Configuration

### Environment Variables

**Application:**
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3000)
- `HOST` - Server host (default: 0.0.0.0)
- `LOG_LEVEL` - Log level (default: info)

**ZITADEL OIDC:**
- `ZITADEL_ISSUER` - ZITADEL instance URL
- `ZITADEL_CLIENT_ID` - OIDC application client ID
- `ZITADEL_REDIRECT_URI` - OAuth callback URL

**Session:**
- `SESSION_SECRET` - Session encryption key (stored in Secret Manager)
- `SESSION_COOKIE_NAME` - Cookie name (default: members_session)
- `SESSION_MAX_AGE` - Session lifetime in ms (default: 86400000 / 24h)

## Architecture

- **Framework:** Fastify 4.x
- **Runtime:** Node.js 18+
- **Authentication:** OpenID Connect (OIDC) with PKCE
- **Session:** @fastify/session with secure cookies
- **OIDC Client:** openid-client 5.x
- **Logging:** Pino
- **Container:** Docker (node:18-alpine)

### Directory Structure

```
members/
├── src/
│   ├── index.js              # Main entry point
│   ├── config.js             # Configuration
│   ├── oidc.js               # OIDC client setup
│   ├── routes/
│   │   ├── index.js          # Landing page
│   │   ├── auth.js           # Login/callback/logout
│   │   ├── profile.js        # Protected profile page
│   │   └── health.js         # Health checks
│   ├── middleware/
│   │   ├── session.js        # Session configuration
│   │   └── auth.js           # Authentication middleware
│   └── lib/
│       └── pkce.js           # PKCE utilities
├── Dockerfile
├── package.json
├── cloudbuild.yaml
└── README.md
```

## Deployment

Service deployed to:
- **Region:** europe-west2 (London)
- **Platform:** Cloud Run
- **Project:** ekklesia-prod-10-2025
- **URL:** https://members-ymzrguoifa-nw.a.run.app

### Testing Deployed Service

```bash
# Get authentication token
TOKEN=$(gcloud auth print-identity-token)

# Test root endpoint
curl -H "Authorization: Bearer $TOKEN" https://members-ymzrguoifa-nw.a.run.app/

# Test health endpoint
curl -H "Authorization: Bearer $TOKEN" https://members-ymzrguoifa-nw.a.run.app/health
```

## Authentication Flow

1. User visits landing page (`/`)
2. Clicks "Login with Kenni.is"
3. Redirected to ZITADEL (`/login`)
4. ZITADEL shows Kenni.is login option
5. User authenticates with national eID
6. ZITADEL redirects to Members callback (`/callback`)
7. Members validates tokens and creates session
8. User redirected to profile page (`/profile`)

### Security Features

- ✅ PKCE (Proof Key for Code Exchange) - RFC 7636
- ✅ State parameter for CSRF protection
- ✅ Nonce for replay attack prevention
- ✅ ID token validation (signature, issuer, audience, expiration)
- ✅ Secure session cookies (httpOnly, secure, sameSite)
- ✅ Security headers (HSTS, X-Frame-Options, CSP)

## Next Steps

- [ ] Enhanced membership profile (Story #20)
- [ ] Role-based access control
- [ ] Organization membership display
- [ ] Voting integration (Story #25)
