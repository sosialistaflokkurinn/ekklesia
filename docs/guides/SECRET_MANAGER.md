# Google Secret Manager - Ekklesia Project

**Service**: Google Cloud Secret Manager
**Project**: ekklesia-prod-10-2025
**Purpose**: Secure storage for API keys, passwords, and other sensitive configuration
**Last Updated**: 2025-10-10

---

## Overview

Google Cloud Secret Manager is used to store all sensitive credentials for the Ekklesia project. Secrets are accessed at runtime by Cloud Run services and Cloud Functions.

**Key Benefits**:
- ✅ Encrypted at rest and in transit
- ✅ Version history (can rotate secrets)
- ✅ Audit logging (who accessed what, when)
- ✅ IAM-based access control
- ✅ No secrets in code or git
- ✅ Automatic injection into Cloud Run services

---

## Current Secrets (Production)

### Active Secrets

| Secret Name | Purpose | Used By | Created | Rotation |
|-------------|---------|---------|---------|----------|
| `kenni-client-secret` | Kenni.is OAuth client secret | handleKenniAuth (Members) | Oct 1, 2025 | Manual (when Kenni.is key changes) |
| `postgres-password` | Cloud SQL PostgreSQL password | Events, Elections services | Oct 9, 2025 | Quarterly (recommended) |
| `elections-s2s-api-key` | S2S authentication between Events ↔ Elections | Events + Elections services | Oct 9, 2025 | Annually (recommended) |

---

## Secret Details

### 1. kenni-client-secret

**Purpose**: OAuth client secret for Kenni.is national eID authentication

**Used By**:
- Cloud Function: `handleKenniAuth` (Members service)
- OAuth flow: Exchange authorization code for access token

**Format**: String (Kenni.is provided)

**Access Pattern**:
```javascript
// In Cloud Function (handleKenniAuth)
const clientSecret = process.env.KENNI_CLIENT_SECRET;
// Accessed via Secret Manager binding
```

**Rotation Strategy**:
- **When**: Only when Kenni.is issues new credentials
- **How**: Update secret version, redeploy Cloud Function
- **Risk**: Manual rotation (triggered by Kenni.is, not scheduled)

**How to Update**:
```bash
# Create new version
echo -n "new-secret-from-kenni" | gcloud secrets versions add kenni-client-secret \
  --data-file=- \
  --project=ekklesia-prod-10-2025

# Cloud Function automatically picks up latest version
```

---

### 2. postgres-password

**Purpose**: PostgreSQL database password for Cloud SQL instance `ekklesia-db`

**Used By**:
- Events service (Cloud Run)
- Elections service (Cloud Run)
- Local development (via gcloud CLI)

**Format**: Base64-like string (64 characters)

**Access Pattern**:
```javascript
// In Node.js services (Events, Elections)
const dbPassword = process.env.DATABASE_PASSWORD;
// Accessed via Secret Manager binding in Cloud Run
```

**Local Development**:
```bash
# Retrieve for local .env file
gcloud secrets versions access latest \
  --secret=postgres-password \
  --project=ekklesia-prod-10-2025

# Output: <64-character-base64-string>
```

**Rotation Strategy**:
- **When**: Quarterly (every 3 months) or on security incident
- **How**: Update Cloud SQL password, then update secret
- **Complexity**: High (requires coordinated update)

**How to Rotate**:
```bash
# 1. Generate new password
NEW_PASSWORD=$(openssl rand -base64 48)

# 2. Update Cloud SQL password
gcloud sql users set-password postgres \
  --instance=ekklesia-db \
  --password="$NEW_PASSWORD" \
  --project=ekklesia-prod-10-2025

# 3. Update secret
echo -n "$NEW_PASSWORD" | gcloud secrets versions add postgres-password \
  --data-file=- \
  --project=ekklesia-prod-10-2025

# 4. Redeploy services (they'll pick up new version)
cd events && ./deploy.sh
cd elections && ./deploy.sh
```

---

### 3. elections-s2s-api-key

**Purpose**: Server-to-Server authentication between Events and Elections services

**Used By**:
- Events service (client - sends API key in `X-API-Key` header)
- Elections service (server - validates API key)

**Format**: Hex string (64 characters, generated with `openssl rand -hex 32`)

**Created**: Oct 9, 2025 (Phase 5 - Events ↔ Elections integration)

**Current Value**: `18049af18339761224731135cb21a627951955eab6928295b2448f34d0c2ba5f` (version 2, no trailing newline)

**How to Create** (already done):
```bash
# 1. Generate secure random key
S2S_API_KEY=$(openssl rand -hex 32)

# 2. Store in Secret Manager
echo -n "$S2S_API_KEY" | gcloud secrets create elections-s2s-api-key \
  --data-file=- \
  --replication-policy=automatic \
  --project=ekklesia-prod-10-2025

# 3. Grant access to both services
gcloud secrets add-iam-policy-binding elections-s2s-api-key \
  --member="serviceAccount:521240388393-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=ekklesia-prod-10-2025
```

**Access Pattern**:
```javascript
// Events service (client)
const s2sApiKey = process.env.S2S_API_KEY;
const response = await fetch('https://elections-service.run.app/api/s2s/register-token', {
  method: 'POST',
  headers: {
    'X-API-Key': s2sApiKey,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ token_hash: '...' })
});

// Elections service (server)
const s2sApiKey = process.env.S2S_API_KEY;
if (req.headers['x-api-key'] !== s2sApiKey) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

**Rotation Strategy**:
- **When**: Annually or on security incident
- **How**: Update secret version, redeploy both services
- **Impact**: Both Events and Elections services must be redeployed simultaneously

**How to Rotate**:
```bash
# 1. Generate new S2S API key
NEW_API_KEY=$(openssl rand -hex 32)

# 2. Create new secret version (use echo -n to avoid trailing newline!)
echo -n "$NEW_API_KEY" | gcloud secrets versions add elections-s2s-api-key \
  --data-file=- \
  --project=ekklesia-prod-10-2025

# 3. Redeploy both services (they'll pick up :latest version)
cd events && ./deploy.sh
cd elections && ./deploy.sh
```

**Important**: Version 1 had a trailing newline bug (caused 401 errors). Always use `echo -n` to avoid this!

---

## Cost

**Pricing** (as of 2025):
- Active secret versions: $0.06/month per secret
- Access operations: $0.03 per 10,000 accesses

**Current Monthly Cost** (Oct 10, 2025):
- 3 secrets × $0.06 = **$0.18/month**
- Access operations (estimated 100,000/month): **$0.30/month**
- **Total**: ~$0.48/month

**Negligible cost** - included in overall infrastructure budget.

---

## gcloud Commands Reference

### List All Secrets

```bash
gcloud secrets list \
  --project=ekklesia-prod-10-2025 \
  --format="table(name,createTime,replication.automatic)"
```

### View Secret Metadata

```bash
gcloud secrets describe postgres-password \
  --project=ekklesia-prod-10-2025
```

### Access Secret Value (Latest Version)

```bash
gcloud secrets versions access latest \
  --secret=postgres-password \
  --project=ekklesia-prod-10-2025
```

### Access Specific Version

```bash
gcloud secrets versions access 2 \
  --secret=postgres-password \
  --project=ekklesia-prod-10-2025
```

### List Secret Versions

```bash
gcloud secrets versions list postgres-password \
  --project=ekklesia-prod-10-2025 \
  --format="table(name,state,createTime)"
```

### Create New Secret

```bash
echo -n "secret-value" | gcloud secrets create my-new-secret \
  --data-file=- \
  --replication-policy=automatic \
  --project=ekklesia-prod-10-2025
```

### Add New Version to Existing Secret

```bash
echo -n "new-secret-value" | gcloud secrets versions add my-secret \
  --data-file=- \
  --project=ekklesia-prod-10-2025
```

### Delete Secret Version

```bash
gcloud secrets versions destroy 1 \
  --secret=my-secret \
  --project=ekklesia-prod-10-2025
```

### Delete Entire Secret

```bash
gcloud secrets delete my-secret \
  --project=ekklesia-prod-10-2025
```

---

## IAM Permissions

### Who Can Access Secrets

**Project Owners** (full access):
- gudrodur@sosialistaflokkurinn.is

**Service Accounts** (read-only):
- `521240388393-compute@developer.gserviceaccount.com` (default Compute Engine)
  - Used by Cloud Run services
  - Used by Cloud Functions
  - Access to: kenni-client-secret, postgres-password

**Cloud Functions Service Agent**:
- `service-521240388393@gcf-admin-robot.iam.gserviceaccount.com`
  - Automatically granted access by Cloud Functions

### Grant Access to Service Account

```bash
# Grant access to specific secret
gcloud secrets add-iam-policy-binding postgres-password \
  --member="serviceAccount:521240388393-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=ekklesia-prod-10-2025
```

### View IAM Policy for Secret

```bash
gcloud secrets get-iam-policy postgres-password \
  --project=ekklesia-prod-10-2025
```

---

## Using Secrets in Cloud Run

### Via Environment Variables (Recommended)

**In deploy.sh script**:
```bash
gcloud run deploy my-service \
  --image gcr.io/project/image \
  --set-secrets "DATABASE_PASSWORD=postgres-password:latest" \
  --project=ekklesia-prod-10-2025
```

**How it works**:
- Cloud Run mounts secret as environment variable
- Service reads: `process.env.DATABASE_PASSWORD`
- Automatic version resolution (`:latest` always gets newest)

### Via Volume Mount (Alternative)

```bash
gcloud run deploy my-service \
  --image gcr.io/project/image \
  --update-secrets /secrets/db-password=postgres-password:latest \
  --project=ekklesia-prod-10-2025
```

**Access in code**:
```javascript
const fs = require('fs');
const password = fs.readFileSync('/secrets/db-password', 'utf8');
```

---

## Using Secrets in Cloud Functions

**In deployment** (automatic):
```bash
gcloud functions deploy myFunction \
  --runtime nodejs18 \
  --trigger-http \
  --set-secrets "KENNI_CLIENT_SECRET=kenni-client-secret:latest" \
  --project=ekklesia-prod-10-2025
```

**Access in code**:
```javascript
exports.myFunction = (req, res) => {
  const clientSecret = process.env.KENNI_CLIENT_SECRET;
  // Use secret
};
```

---

## Local Development

### Option 1: gcloud CLI (Recommended)

```bash
# Add to .env file
export DB_PASSWORD=$(gcloud secrets versions access latest \
  --secret=postgres-password \
  --project=ekklesia-prod-10-2025)

echo "DATABASE_PASSWORD=$DB_PASSWORD" >> .env
```

### Option 2: Manual Copy

```bash
# 1. View secret
gcloud secrets versions access latest \
  --secret=postgres-password \
  --project=ekklesia-prod-10-2025

# 2. Copy to .env file manually
# DATABASE_PASSWORD=<paste-value-here>
```

**Security Note**: Never commit `.env` files to git!

---

## Security Best Practices

### ✅ Do

1. **Use Secret Manager for all sensitive data**
   - API keys, passwords, OAuth secrets
   - Database credentials
   - S2S authentication keys

2. **Use environment variables in Cloud Run/Functions**
   - Automatic injection via `--set-secrets`
   - No secrets in container images

3. **Rotate secrets regularly**
   - Database passwords: Quarterly
   - S2S API keys: Annually
   - OAuth secrets: When provider changes

4. **Use `.env` files locally**
   - Add `.env` to .gitignore
   - Document in `.env.example`

5. **Grant minimal IAM permissions**
   - Service accounts: `secretmanager.secretAccessor` only
   - Humans: Project owner or `secretmanager.admin`

### ❌ Don't

1. **Never commit secrets to git**
   - Check .gitignore includes `.env`, `*.env`, etc.
   - Use `.env.example` as template

2. **Never hardcode secrets in code**
   - Always use environment variables
   - Always read from Secret Manager

3. **Never share secrets via Slack/email**
   - Use Secret Manager URL instead
   - Require gcloud CLI access

4. **Never store secrets in Cloud Storage**
   - Use Secret Manager instead
   - Encryption at rest is not enough

5. **Never grant public access**
   - Secrets should require authentication
   - Use IAM service accounts only

---

## Troubleshooting

### Issue: "Permission denied" when accessing secret

**Cause**: Service account lacks `secretmanager.secretAccessor` role

**Fix**:
```bash
gcloud secrets add-iam-policy-binding SECRET_NAME \
  --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
  --role="roles/secretmanager.secretAccessor" \
  --project=ekklesia-prod-10-2025
```

### Issue: Cloud Run service can't read secret

**Cause**: Secret not mounted or wrong version

**Fix**:
```bash
# Redeploy with correct secret binding
gcloud run services update SERVICE_NAME \
  --set-secrets "ENV_VAR=SECRET_NAME:latest" \
  --project=ekklesia-prod-10-2025
```

### Issue: "Secret not found"

**Cause**: Secret doesn't exist or wrong project

**Fix**:
```bash
# Verify project
gcloud config get-value project

# List secrets to confirm
gcloud secrets list --project=ekklesia-prod-10-2025
```

### Issue: Getting old secret value

**Cause**: Not using `:latest` version specifier

**Fix**:
```bash
# Use :latest in Cloud Run deployment
--set-secrets "VAR=secret:latest"  # ✅ Good
--set-secrets "VAR=secret:1"       # ❌ Locked to version 1
```

---

## Audit Logging

Secret Manager access is logged to Cloud Logging.

**View access logs**:
```bash
gcloud logging read "resource.type=secretmanager.googleapis.com/Secret AND protoPayload.methodName=AccessSecretVersion" \
  --limit=50 \
  --format=json \
  --project=ekklesia-prod-10-2025
```

**What's logged**:
- Who accessed the secret (service account or user)
- When it was accessed
- Which secret and version
- Source (Cloud Run service, Cloud Function, gcloud CLI)

**Retention**: 30 days (default), can export to Cloud Storage for longer retention

---

## Migration from Other Secret Storage

### From Environment Variables (hardcoded)

**Before**:
```bash
# deploy.sh
gcloud run deploy my-service \
  --set-env-vars "DB_PASSWORD=hardcoded-password"  # ❌ Bad
```

**After**:
```bash
# 1. Create secret
echo -n "hardcoded-password" | gcloud secrets create my-secret --data-file=-

# 2. Deploy with secret
gcloud run deploy my-service \
  --set-secrets "DB_PASSWORD=my-secret:latest"  # ✅ Good
```

### From .env Files (in git)

**Before**:
```bash
# .env (in git)
DATABASE_PASSWORD=exposed-password  # ❌ Bad
```

**After**:
```bash
# 1. Move to Secret Manager
gcloud secrets create postgres-password --data-file=.env

# 2. Add .env to .gitignore
echo ".env" >> .gitignore

# 3. Create .env.example template
echo "DATABASE_PASSWORD=<from-secret-manager>" > .env.example
```

---

## Related Documentation

- [docs/OPERATIONAL_PROCEDURES.md](../OPERATIONAL_PROCEDURES.md) - Meeting day operations (uses Secret Manager)
- [events/deploy.sh](../../events/deploy.sh) - Events deployment script (retrieves postgres-password, elections-s2s-api-key)
- [elections/deploy.sh](../../elections/deploy.sh) - Elections deployment script (retrieves elections-s2s-api-key)
- [docs/status/PHASE_5_INTEGRATION_COMPLETE.md](../status/PHASE_5_INTEGRATION_COMPLETE.md) - S2S API key creation details
- [Google Secret Manager Docs](https://cloud.google.com/secret-manager/docs)

---

## Summary

**Active Secrets**: 3 (kenni-client-secret, postgres-password, elections-s2s-api-key)
**Cost**: ~$0.48/month (negligible)
**Access**: Via gcloud CLI or Cloud Run/Functions environment variables
**Rotation**:
- Database password: Quarterly (recommended)
- S2S API key: Annually (recommended)
- OAuth secrets: On-demand (when provider changes)

**Best Practice**: All sensitive configuration should be in Secret Manager, never in git or hardcoded.

**Phase 5 Complete** (Oct 10, 2025): All 3 services operational with S2S authentication via elections-s2s-api-key.
