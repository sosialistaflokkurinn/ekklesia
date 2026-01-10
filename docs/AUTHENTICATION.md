# Authentication

Authentication in Ekklesia uses Kenni.is (Icelandic national ID) for login and Firebase Authentication for session management.

---

## Overview

```
User → Kenni.is (Íslykill) → handleKenniAuth → Firebase Custom Token → Frontend
```

### Required Components
- `handleKenniAuth` - Cloud Run function for OAuth callback
- Firebase Authentication - Session management
- Kenni.is IdP - Identity provider

---

## OAuth Troubleshooting

### Quick Checklist

- [ ] Frontend redirect URI = IdP URI = backend env (no trailing slash)
- [ ] Required env vars present:
  - `KENNI_IS_ISSUER_URL`
  - `KENNI_IS_CLIENT_ID`
  - `KENNI_IS_CLIENT_SECRET` (Secret Manager)
  - `KENNI_IS_REDIRECT_URI`
  - `FIREBASE_STORAGE_BUCKET`

### 1. Verify Config via Health Endpoint

```bash
curl -s https://handlekenniauth-<hash>-<region>.a.run.app/healthz | jq
```

Expected:
```json
{
  "ok": true,
  "env": {
    "KENNI_IS_ISSUER_URL": true,
    "KENNI_IS_CLIENT_ID": true,
    "KENNI_IS_CLIENT_SECRET": true,
    "KENNI_IS_REDIRECT_URI": true,
    "FIREBASE_STORAGE_BUCKET": true
  }
}
```

If any env value is `false`, fix before proceeding.

### 2. Check Effective Environment Variables

```bash
gcloud run services describe handlekenniauth \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025 \
  --format=json | jq -r '.spec.template.spec.containers[0].env // [] | map({(.name): (.value // ("<secret:" + .valueFrom.secretKeyRef.name + ":" + .valueFrom.secretKeyRef.key + ">"))}) | add'
```

### 3. Fix Missing Config

```bash
gcloud run services update handlekenniauth \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025 \
  --update-env-vars \
    KENNI_IS_ISSUER_URL=https://idp.kenni.is/sosi-kosningakerfi.is,\
    KENNI_IS_CLIENT_ID=@sosi-kosningakerfi.is/rafr-nt-kosningakerfi-s-s,\
    KENNI_IS_REDIRECT_URI=https://ekklesia-prod-10-2025.web.app \
  --update-secrets \
    KENNI_IS_CLIENT_SECRET=kenni-client-secret:latest
```

### 4. Capture Correlation ID

When login fails:
1. Open browser DevTools console
2. Copy `cid` from error message
3. Search logs:

```bash
gcloud logging read "resource.type=cloud_run_revision \
  AND resource.labels.service_name=handlekenniauth \
  AND jsonPayload.correlationId=<YOUR_CID>" \
  --limit=10 \
  --project=ekklesia-prod-10-2025 \
  --format=json | jq '.[].jsonPayload'
```

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `invalid_grant` | Redirect URI mismatch | Match exactly (no trailing slash) |
| `invalid_client` | Wrong credentials | Check Secret Manager binding |
| `invalid_request` | Missing params | Verify PKCE and body fields |
| `CONFIG_MISSING` | Env var not set | Bind secret to service |

### CORS Issues

Ensure backend exposes:
- `Access-Control-Expose-Headers: X-Correlation-ID`
- `Access-Control-Allow-Headers: Content-Type, Authorization, X-Firebase-AppCheck`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`

---

## MFA Enforcement

Multi-Factor Authentication is required for users with elevated roles.

### Affected Roles
- `developer`
- `meeting_election_manager`
- `event_manager`

### Check MFA Status

```javascript
const admin = require('firebase-admin');
const user = await admin.auth().getUser(uid);
const hasMfa = (user.multiFactor?.enrolledFactors?.length || 0) > 0;
```

### Monthly Audit Process

1. **Export users with elevated roles**
   ```bash
   ./scripts/export-elevated-users.sh > /tmp/elevated_users.json
   ```

2. **Check MFA status for each**

3. **Notify non-compliant users**
   - 7-day deadline to enable MFA
   - CC security officer

4. **Remove roles after deadline**
   ```javascript
   const claims = user.customClaims || {};
   const updatedRoles = (claims.roles || [])
     .filter(r => !['developer', 'election_manager', 'event_manager'].includes(r));
   await admin.auth().setCustomUserClaims(uid, { ...claims, roles: updatedRoles });
   ```

### MFA Setup (Users)

#### TOTP (Recommended)

1. Sign in to https://felagar.sosialistaflokkurinn.is
2. Account Settings → Security → Multi-Factor Auth
3. Add "Authenticator App (TOTP)"
4. Scan QR code with Google Authenticator/Authy
5. Enter 6-digit code
6. Save recovery codes securely

#### SMS

1. Account Settings → Security → Multi-Factor Auth
2. Add "SMS"
3. Enter mobile number
4. Verify with SMS code

### Troubleshooting MFA

| Issue | Resolution |
|-------|-----------|
| TOTP not working | Verify device time is synchronized |
| SMS code not received | Check phone number; wait 30s |
| Recovery codes lost | Contact admin; verify identity |
| MFA disabled by accident | Re-enable; use recovery code |

---

## Pre-Deploy Checklist

Before deploying auth services:

- [ ] All secrets exist in Secret Manager with enabled version
- [ ] All secrets bound to service as env vars
- [ ] All required env vars are set and non-empty
- [ ] Redirect URI matches frontend, backend, and IdP
- [ ] No secrets in code or public repo
- [ ] Verify with `gcloud run services describe` command above

---

## Compliance Checklist

- [ ] All developer accounts have MFA enabled
- [ ] All election_manager accounts have MFA enabled
- [ ] All event_manager accounts have MFA enabled
- [ ] Monthly audit completed
- [ ] Non-compliant users notified
- [ ] Two-person approval for role changes
