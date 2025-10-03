# Identity and Authentication Documentation

## ✅ PRODUCTION INFRASTRUCTURE DEPLOYED

**Status**: Production deployment on GCP completed (Phase 4)

## Production Architecture (GCP)
```
User Browser
    ↓
GCP Load Balancer (34.8.250.20)
    ↓
Self-Hosted ZITADEL (Cloud Run - europe-west2)
    ↓
OIDC Bridge Proxy (Cloud Run - europe-west2)
    ↓
Kenni.is (External IdP)
    ↓
Cloud SQL PostgreSQL 15
```

### Production Infrastructure:
- **Region**: europe-west2 (London)
- **ZITADEL URL**: https://zitadel-ymzrguoifa-nw.a.run.app
- **Custom Domain**: https://auth.si-xj.org (SSL provisioning in progress)
- **OIDC Bridge**: https://oidc-bridge-proxy-ymzrguoifa-nw.a.run.app
- **Database**: Cloud SQL PostgreSQL 15 (instance: zitadel8)
- **Load Balancer IP**: 34.8.250.20
- **Secrets**: GCP Secret Manager integration

### Production Benefits:
- ✅ Full control over ZITADEL configuration
- ✅ No dependency on ZITADEL Cloud limits
- ✅ Better latency (Europe region)
- ✅ Integrated with GCP Secret Manager
- ✅ Scalable containerized deployment
- ✅ Unified logging and monitoring

---

## Issue #2: ZITADEL Tenant & Project

### Production Deployment (Self-Hosted)
- **Console URL**: https://zitadel-ymzrguoifa-nw.a.run.app
- **Custom Domain**: https://auth.si-xj.org (SSL provisioning)
- **Deployment**: GCP Cloud Run (europe-west2)
- **Database**: Cloud SQL PostgreSQL 15 (zitadel8)
- **Organization ID**: 340504441601245339
- **Project ID**: 340504441601245339

### Admin Access
- **Primary Admin**: gudro (Guðröður)
- **User ID**: 340504966944793723
- **Secondary Admin**: To be configured for break-glass redundancy

### Service Account
- **Service User ID**: 340499069199721595
- **Purpose**: CLI/API access for automation
- **Secrets**: Stored in GCP Secret Manager

### Status
✅ Self-hosted ZITADEL deployed on GCP Cloud Run
✅ Cloud SQL PostgreSQL 15 database configured
✅ Project created with production settings
✅ Service account configured for CLI/API access
✅ Secrets migrated to GCP Secret Manager
⚠️ Second admin account recommended for redundancy

---

## Issue #3: Kenni/Auðkenni IdP Configuration

### External IdP Setup (Production)
- **IdP Type**: OIDC (via Bridge Proxy)
- **Proxy URL**: https://oidc-bridge-proxy-ymzrguoifa-nw.a.run.app
- **Proxy Deployment**: GCP Cloud Run (europe-west2)
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

### Bridge Proxy Solution (Production)
Due to OIDC incompatibilities between ZITADEL and Kenni.is:
- **Problem**: ZITADEL hardcodes `prompt=select_account` which Kenni.is rejects
- **Solution**: OIDC bridge proxy on Cloud Run strips incompatible parameters
- **Implementation**: Containerized Node.js proxy with token re-signing
- **Security**: Client secrets stored in GCP Secret Manager

### Configuration in ZITADEL
```
Type: Generic OIDC Provider
Issuer: https://oidc-bridge-proxy-ymzrguoifa-nw.a.run.app
Discovery URL: https://oidc-bridge-proxy-ymzrguoifa-nw.a.run.app/.well-known/openid-configuration
Client ID: @sosi-kosningakerfi.is/rafr-nt-kosningakerfi-s-s
Client Secret: [Stored in GCP Secret Manager]
Scopes: openid profile email national_id phone_number
Mapping: ID Token mapping enabled
```

### Status
✅ OIDC bridge proxy deployed on GCP Cloud Run
✅ External IdP configured in production ZITADEL instance
✅ Attributes mapped (sub, name, email, kennitala/nationalId)
✅ Kenni.is integration functional
⚠️ End-to-end test login with production Kenni.is user recommended

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
✅ Client credentials stored in GCP Secret Manager
✅ Production-ready configuration

---

## Security Notes

### Credential Storage (Production)
✅ **Production Implementation**:
- All secrets stored in GCP Secret Manager
- Service account keys for CLI/API access
- OIDC bridge client credentials
- Database connection strings
- Automatic secret rotation available

### Kennitala Handling
- **NEVER** log or display raw kennitala values
- **ALWAYS** hash kennitala before storage using secure hash function
- Use hashed kennitala only for identity verification
- ZITADEL processes kennitala as mapped claim

### Break-Glass Access
⚠️ **Recommendation**: Add second organization admin for redundancy
- Prevents lockout scenarios
- Enables account recovery
- Best practice for production environments

### Production Security Features
✅ HTTPS/TLS for all endpoints
✅ GCP IAM-based access control
✅ Cloud SQL with private IP
✅ Secret Manager integration
✅ Audit logging enabled
✅ Network policies configured