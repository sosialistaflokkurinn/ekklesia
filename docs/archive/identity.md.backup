# Identity and Authentication Documentation

## ⚠️ IMPORTANT: Temporary Development Setup
**This is NOT the final production architecture.** The current setup uses:
- ZITADEL Cloud (temporary) → Will migrate to self-hosted ZITADEL on GCP
- Cloudflare Tunnel for proxy → Will migrate to GCP-hosted proxy
- Local OIDC bridge proxy → Will be containerized and deployed on GCP

**Migration Timeline**: When Agúst receives GCP access, we will migrate to the production architecture described below.

## Planned Production Architecture (GCP)
```
User Browser
    ↓
GCP Load Balancer
    ↓
Self-Hosted ZITADEL (GCP Compute Engine/GKE)
    ↓
OIDC Bridge Proxy (GCP Cloud Run)
    ↓
Kenni.is (External IdP)
```

### Production Benefits:
- Full control over ZITADEL configuration
- No dependency on ZITADEL Cloud limits
- Better latency (Iceland/Europe regions)
- Integrated with GCP Secret Manager
- Scalable containerized proxy
- Unified logging and monitoring

---

## Current Development Setup (Temporary)

## Issue #2: ZITADEL Tenant & Project

### Tenant Information
- **Console URL**: https://sosi-auth-nocfrq.us1.zitadel.cloud
- **Organization ID**: 338266365683162115
- **Project ID**: 338582775940525773
- **Domain**: sosi-auth-nocfrq.us1.zitadel.cloud

### Admin Access
- **Primary Admin**: gudro (Guðröður)
- **Secondary Admin**: ⚠️ NOT CONFIGURED - Break-glass redundancy needed

### Service Account
- **Service User ID**: 338580642700747290
- **Key ID**: 338580768630517453

### Status
✅ ZITADEL Cloud tenant created
✅ Project "Samstaða Voting" created
✅ Tenant/org ID and project ID recorded
❌ Second admin account not invited (required for redundancy)

---

## Issue #3: Kenni/Auðkenni IdP Configuration

### External IdP Setup
- **IdP Type**: OIDC (via Bridge Proxy)
- **Proxy Issuer**: https://kenni-proxy.si-xj.org
- **Original IdP**: https://idp.kenni.is/sosi-kosningakerfi.is
- **Client ID**: @sosi-kosningakerfi.is/rafr-nt-kosningakerfi-s-s
### Mapped Claims
The following attributes are mapped from Kenni.is ID token to ZITADEL user:
- `sub` → Subject/User ID
- `name` → Full Name
- `given_name` → First Name(s) (derived from name split)
- `family_name` → Last Name (derived from name split)  
- `email` → Email Address
- `national_id` → Kennitala (Icelandic National ID) - ⚠️ Must be hashed, never logged raw
- `phone_number` → Phone Number

### Bridge Proxy Solution
Due to OIDC incompatibilities between ZITADEL and Kenni.is:
- **Problem**: ZITADEL hardcodes `prompt=select_account` which Kenni.is rejects
- **Solution**: OIDC bridge proxy at kenni-proxy.si-xj.org strips incompatible parameters
- **Implementation**: Node.js proxy re-signs tokens with consistent issuer

### Configuration in ZITADEL
```
Type: Generic OIDC Provider
Issuer: https://kenni-proxy.si-xj.org
Discovery URL: https://kenni-proxy.si-xj.org/.well-known/openid-configuration
Client ID: @sosi-kosningakerfi.is/rafr-nt-kosningakerfi-s-s
Client Secret: [Stored in environment]
Scopes: openid profile email national_id phone_number
Mapping: ID Token mapping enabled
```

### Status
✅ IdP metadata/credentials obtained from Kenni/Auðkenni
✅ External IdP created in ZITADEL (OIDC via proxy)
✅ Attributes mapped (sub, name, email, kennitala/nationalId)
❌ End-to-end test login not completed with production user

---

## Issue #4: Members App Registration

### OIDC Application Details
- **App Name**: Members
- **Client ID**: 338586423189856794
- **Grant Type**: Authorization Code + PKCE
- **Response Type**: code
- **Auth Method**: none (PKCE public client)

### Redirect URIs
#### Development
- `https://members-dev.sosi-kosningakerfi.is/callback`
- `http://localhost:3000/callback` (local development)

#### Production (to be configured)
- `https://members.sosi-kosningakerfi.is/callback`

### Allowed Origins (CORS)
- `https://members-dev.sosi-kosningakerfi.is`
- `http://localhost:3000`

### Required Scopes
- `openid` - OpenID Connect authentication
- `profile` - User profile information
- `email` - Email address
- `offline_access` - Refresh tokens for long sessions

### Token Configuration
- Access Token Type: JWT
- ID Token Lifetime: 12 hours
- Access Token Lifetime: 12 hours
- Refresh Token Lifetime: 720 hours (30 days)

### Status
✅ OIDC app "Members" created with Auth Code + PKCE
✅ Development redirect URIs configured
✅ Required scopes documented
❌ Client credentials not in Secret Manager (currently in .env.zitadel file)

---

## Security Notes

### Credential Storage
Current credentials are stored in `.env.zitadel` file. These should be migrated to:
1. **Development**: Environment variables or local secrets manager
2. **Production**: Cloud Secret Manager (e.g., GCP Secret Manager, AWS Secrets Manager)

### Kennitala Handling
- **NEVER** log or display raw kennitala values
- **ALWAYS** hash kennitala before storage using secure hash function
- Use hashed kennitala only for identity verification

### Break-Glass Access
⚠️ **URGENT**: Add second organization admin for redundancy
- Prevents lockout scenarios
- Enables account recovery
- Required for production readiness