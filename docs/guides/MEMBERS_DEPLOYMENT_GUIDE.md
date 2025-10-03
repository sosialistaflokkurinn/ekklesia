# Members Service - Deployment Guide

**Version**: 2.0.0
**Last Updated**: 2025-10-03
**Status**: Milestone 2 Complete - OIDC Authentication Deployed & Tested

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Environment Configuration](#environment-configuration)
4. [Local Development](#local-development)
5. [Container Build](#container-build)
6. [Cloud Run Deployment](#cloud-run-deployment)
7. [Integration with ZITADEL](#integration-with-zitadel)
8. [Testing](#testing)
9. [Rollback Procedures](#rollback-procedures)
10. [Monitoring & Operations](#monitoring--operations)
11. [Troubleshooting](#troubleshooting)

---

## Overview

This guide provides step-by-step instructions for deploying the Members service to GCP Cloud Run, integrating with the existing production infrastructure.

### Deployment Milestones

| Milestone | Features | Status |
|-----------|----------|--------|
| **1: Hello-World** | /healthz endpoint, basic deployment | ✅ Complete |
| **2: OIDC Auth** | Login with Kenni.is via ZITADEL | ✅ Complete & Tested |
| **3: Enhanced Profile** | Display membership profile (Story #20) | 📋 Planned |

### Architecture Context

```
┌─────────────────────────────────────────────────┐
│         Production Infrastructure (Existing)     │
│                                                  │
│  ┌──────────────┐      ┌──────────────────┐    │
│  │   ZITADEL    │      │  OIDC Bridge     │    │
│  │  Cloud Run   │◄─────┤  Proxy           │    │
│  └──────────────┘      └──────────────────┘    │
│         │                                        │
│         │                                        │
│  ┌──────▼───────┐      ┌──────────────────┐    │
│  │  Cloud SQL   │      │  Load Balancer   │    │
│  │  PostgreSQL  │      │  34.8.250.20     │    │
│  └──────────────┘      └──────────────────┘    │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│         Members Service (NEW)                    │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │  Members Service (Cloud Run)             │   │
│  │  - Node.js (Fastify)                     │   │
│  │  - OIDC Client                           │   │
│  │  - Session Management                    │   │
│  │  - Integration with ZITADEL ↑           │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

## Prerequisites

### Required Infrastructure (Already Deployed ✅)

| Component | Status | Details |
|-----------|--------|---------|
| **GCP Project** | ✅ | `ekklesia-voting` |
| **ZITADEL** | ✅ | https://auth.si-xj.org |
| **OIDC Bridge Proxy** | ✅ | https://oidc-bridge-proxy-ymzrguoifa-nw.a.run.app |
| **Cloud SQL** | ✅ | PostgreSQL 15 (instance: zitadel8) |
| **Artifact Registry** | ✅ | `europe-west2-docker.pkg.dev/<project>/ekklesia-images` |
| **Secret Manager** | ✅ | With ZITADEL credentials |
| **Members OIDC App** | ✅ | Client ID: 340609127703243145 (Ekklesia project) |

### Required Tools

```bash
# Check installed tools
node --version          # Should be >= 20.0.0
npm --version          # Should be >= 10.0.0
docker --version       # For local container build
gcloud --version       # For GCP deployment

# Install if missing
# Node.js: https://nodejs.org/
# Docker: https://docs.docker.com/get-docker/
# gcloud: https://cloud.google.com/sdk/docs/install
```

### GCP Authentication

```bash
# Login to GCP
gcloud auth login

# Set project
gcloud config set project ekklesia-voting

# Verify
gcloud config list
```

### Required Secrets

The following secrets must exist in GCP Secret Manager:

```bash
# Check existing secrets
gcloud secrets list

# Required secrets:
# - zitadel-masterkey (already exists)
# - zitadel-db-password (already exists)
# - kenni-client-secret (already exists)
# - members-session-secret (to be created)
```

---

## Environment Configuration

### Environment Matrix

| Variable | Local Dev | Cloud Run Dev | Cloud Run Prod |
|----------|-----------|---------------|----------------|
| **NODE_ENV** | `development` | `development` | `production` |
| **PORT** | `3000` | `8080` | `8080` |
| **ZITADEL_ISSUER** | https://zitadel-... | https://zitadel-... | https://zitadel-... |
| **ZITADEL_CLIENT_ID** | 338586423189856794 | 338586423189856794 | 338586423189856794 |
| **ZITADEL_REDIRECT_URI** | http://localhost:3000/callback | https://members-dev-....run.app/callback | https://members.sosi-kosningakerfi.is/callback |
| **SESSION_SECRET** | `dev-secret-...` | From Secret Manager | From Secret Manager |
| **LOG_LEVEL** | `debug` | `info` | `info` |

### Create Session Secret

```bash
# Generate random 32-byte secret
openssl rand -base64 32

# Store in Secret Manager
echo -n "$(openssl rand -base64 32)" | \
  gcloud secrets create members-session-secret \
    --data-file=- \
    --replication-policy=automatic

# Verify
gcloud secrets versions access latest --secret=members-session-secret
```

### Local Environment File

Create `.env.local` in `members/` directory:

```bash
# members/.env.local
NODE_ENV=development
PORT=3000

# ZITADEL Configuration
ZITADEL_ISSUER=https://zitadel-ymzrguoifa-nw.a.run.app
ZITADEL_CLIENT_ID=338586423189856794
ZITADEL_REDIRECT_URI=http://localhost:3000/callback

# Session (development only - generate new for each developer)
SESSION_SECRET=dev-secret-must-be-at-least-32-chars-long-abc123xyz

# Logging
LOG_LEVEL=debug
```

**⚠️ Important**: Add `.env.local` to `.gitignore`

---

## Local Development

### Step 1: Scaffold Application

```bash
# Navigate to project root
cd /home/gudro/Development/projects/ekklesia

# Create members directory
mkdir -p members
cd members

# Initialize Node.js project
npm init -y

# Install dependencies
npm install fastify@^4.25.0 \
  @fastify/view@^8.2.0 \
  @fastify/cookie@^9.2.0 \
  @fastify/session@^10.7.0 \
  pino@^8.17.0 \
  pino-pretty@^10.3.0

# Install dev dependencies
npm install --save-dev nodemon@^3.0.0
```

### Step 2: Create Application Structure

```bash
# Create directories
mkdir -p src/routes src/middleware src/lib src/views

# Create files (will add code in next steps)
touch src/index.js
touch src/config.js
touch src/routes/health.js
touch src/routes/index.js
touch src/views/index.html
touch .env.local
touch .gitignore
```

### Step 3: Configure package.json

Add scripts to `package.json`:

```json
{
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "test": "echo \"No tests yet\" && exit 0"
  }
}
```

### Step 4: Run Locally

```bash
# Start development server
npm run dev

# Should see:
# Server listening on port 3000
# Visit: http://localhost:3000
```

### Step 5: Test Health Endpoint

```bash
# Test health check
curl http://localhost:3000/healthz

# Expected response:
# {"status":"healthy","timestamp":"2025-10-03T...","version":"1.0.0"}
```

---

## Container Build

### Dockerfile

Create `members/Dockerfile`:

```dockerfile
# Use Node.js 20 LTS Alpine
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application code
COPY src/ ./src/

# Expose port 8080 (Cloud Run default)
EXPOSE 8080

# Set environment to production
ENV NODE_ENV=production
ENV PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/healthz', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run application
CMD ["node", "src/index.js"]
```

### .dockerignore

Create `members/.dockerignore`:

```
node_modules
npm-debug.log
.env.local
.env
*.md
.git
.gitignore
Dockerfile
.dockerignore
```

### Build Locally

```bash
# Build Docker image
cd members
docker build -t members:latest .

# Test locally
docker run -p 8080:8080 \
  -e NODE_ENV=production \
  members:latest

# Test
curl http://localhost:8080/healthz
```

---

## Cloud Run Deployment

### Phase 1: Hello-World Deployment (Milestone 1)

#### Step 1: Create Artifact Registry Repository (if not exists)

```bash
# Check if repository exists
gcloud artifacts repositories list \
  --location=europe-west2

# Create if needed
gcloud artifacts repositories create ekklesia-images \
  --repository-format=docker \
  --location=europe-west2 \
  --description="Ekklesia platform container images"
```

#### Step 2: Build and Push to Artifact Registry

```bash
# Set variables
PROJECT_ID=$(gcloud config get-value project)
REGION=europe-west2
REPO=ekklesia-images
IMAGE=members
TAG=latest  # Or use git SHA: $(git rev-parse --short HEAD)

# Full image path
IMAGE_PATH="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${IMAGE}:${TAG}"

# Build for Cloud Run
docker build -t ${IMAGE_PATH} .

# Authenticate Docker to Artifact Registry
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# Push image
docker push ${IMAGE_PATH}

# Verify
gcloud artifacts docker images list \
  ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}
```

#### Step 3: Deploy to Cloud Run

```bash
# Deploy Members service
gcloud run deploy members \
  --image=${IMAGE_PATH} \
  --region=europe-west2 \
  --platform=managed \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=10 \
  --memory=512Mi \
  --cpu=1 \
  --timeout=60s \
  --set-env-vars="NODE_ENV=production" \
  --set-env-vars="ZITADEL_ISSUER=https://zitadel-ymzrguoifa-nw.a.run.app" \
  --set-env-vars="ZITADEL_CLIENT_ID=338586423189856794"

# Deployment will output service URL
# Example: https://members-<hash>-nw.a.run.app
```

#### Step 4: Verify Deployment

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe members \
  --region=europe-west2 \
  --format='value(status.url)')

echo "Service URL: ${SERVICE_URL}"

# Test health endpoint
curl ${SERVICE_URL}/healthz

# Expected: {"status":"healthy",...}
```

#### Step 5: Update ZITADEL Redirect URI

```bash
# Add Cloud Run URL to ZITADEL allowed redirect URIs
# 1. Go to ZITADEL Console: https://zitadel-ymzrguoifa-nw.a.run.app
# 2. Navigate to: Projects > Samstaða Voting > Applications > Members
# 3. Add redirect URI: https://members-<hash>-nw.a.run.app/callback
# 4. Save
```

---

### Phase 2: OIDC Authentication Deployment (Milestone 2)

#### Step 1: Add Session Secret

```bash
# Deploy with session secret from Secret Manager
gcloud run deploy members \
  --image=${IMAGE_PATH} \
  --region=europe-west2 \
  --platform=managed \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=10 \
  --memory=512Mi \
  --cpu=1 \
  --timeout=60s \
  --set-env-vars="NODE_ENV=production,ZITADEL_ISSUER=https://zitadel-ymzrguoifa-nw.a.run.app,ZITADEL_CLIENT_ID=338586423189856794" \
  --set-secrets="SESSION_SECRET=members-session-secret:latest" \
  --update-env-vars="ZITADEL_REDIRECT_URI=${SERVICE_URL}/callback"
```

#### Step 2: Update ZITADEL Configuration

1. **Add Redirect URI**:
   - URI: `${SERVICE_URL}/callback`
   - Type: Web

2. **Verify Allowed Origins**:
   - Origin: `${SERVICE_URL}`
   - Enable for CORS

3. **Test OIDC Discovery**:
   ```bash
   curl https://zitadel-ymzrguoifa-nw.a.run.app/.well-known/openid-configuration
   ```

#### Step 3: Test Authentication Flow

```bash
# Visit service in browser
open ${SERVICE_URL}

# Click "Login with Kenni.is"
# Complete authentication
# Verify redirect to /profile
```

---

## Integration with ZITADEL

### OIDC Client Configuration

The Members service integrates with ZITADEL as an OIDC client:

**Configuration Summary:**
- **Issuer**: https://zitadel-ymzrguoifa-nw.a.run.app
- **Client ID**: 338586423189856794
- **Client Type**: Public (PKCE)
- **Grant Type**: Authorization Code with PKCE
- **Scopes**: `openid profile email`
- **Redirect URIs**:
  - Dev: http://localhost:3000/callback
  - Cloud Run: https://members-*.run.app/callback
  - Prod: https://members.sosi-kosningakerfi.is/callback

### Authentication Flow

```
Members (/login)
  → Generate PKCE challenge
  → Redirect to ZITADEL /oauth/v2/authorize

ZITADEL
  → Show login options
  → User clicks "Kenni.is"
  → Redirect to OIDC Bridge Proxy

OIDC Bridge Proxy
  → Strip incompatible params
  → Proxy to Kenni.is

Kenni.is
  → User authenticates
  → Return to Bridge

OIDC Bridge
  → Re-sign token
  → Return to ZITADEL

ZITADEL
  → Validate token
  → Redirect to Members /callback

Members (/callback)
  → Verify state (CSRF)
  → Exchange code for token (with PKCE verifier)
  → Validate ID token
  → Create session
  → Redirect to /profile
```

### Required Environment Variables

```bash
# ZITADEL Configuration
ZITADEL_ISSUER=https://zitadel-ymzrguoifa-nw.a.run.app
ZITADEL_CLIENT_ID=338586423189856794
ZITADEL_REDIRECT_URI=<service-url>/callback

# Session Management
SESSION_SECRET=<from-secret-manager>
SESSION_COOKIE_NAME=members_session
SESSION_MAX_AGE=86400000  # 24 hours

# Application
NODE_ENV=production
PORT=8080
LOG_LEVEL=info
```

---

## Testing

### Local Testing Checklist

- [ ] `npm install` succeeds
- [ ] `npm run dev` starts server
- [ ] http://localhost:3000 loads landing page
- [ ] http://localhost:3000/healthz returns 200 OK
- [ ] Docker build succeeds
- [ ] Docker container runs
- [ ] Container health check passes

### Cloud Run Testing Checklist

- [ ] Image builds and pushes to Artifact Registry
- [ ] `gcloud run deploy` succeeds
- [ ] Service URL is accessible via HTTPS
- [ ] `/healthz` endpoint returns 200 OK
- [ ] Service appears in Cloud Run console
- [ ] Logs are visible in Cloud Logging

### OIDC Integration Testing

- [ ] `/login` redirects to ZITADEL
- [ ] ZITADEL shows "Login with Kenni.is"
- [ ] Kenni.is authentication succeeds
- [ ] `/callback` processes code exchange
- [ ] Session is created
- [ ] `/profile` displays user data
- [ ] `/logout` clears session
- [ ] Unauthenticated access redirects to login

### End-to-End Test Script

```bash
#!/bin/bash
# test-members-e2e.sh

SERVICE_URL=$1

if [ -z "$SERVICE_URL" ]; then
  echo "Usage: $0 <service-url>"
  exit 1
fi

echo "Testing Members service: $SERVICE_URL"

# Test 1: Health check
echo -n "Test 1: Health check... "
HEALTH=$(curl -s ${SERVICE_URL}/healthz | jq -r '.status')
if [ "$HEALTH" = "healthy" ]; then
  echo "✅ PASS"
else
  echo "❌ FAIL"
  exit 1
fi

# Test 2: Landing page
echo -n "Test 2: Landing page... "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" ${SERVICE_URL}/)
if [ "$STATUS" = "200" ]; then
  echo "✅ PASS"
else
  echo "❌ FAIL (Status: $STATUS)"
  exit 1
fi

# Test 3: Login redirect
echo -n "Test 3: Login redirect... "
LOCATION=$(curl -s -I ${SERVICE_URL}/login | grep -i "location:" | awk '{print $2}' | tr -d '\r')
if [[ "$LOCATION" == *"zitadel"* ]]; then
  echo "✅ PASS"
else
  echo "❌ FAIL (Location: $LOCATION)"
  exit 1
fi

echo ""
echo "All automated tests passed! ✅"
echo "Manual test: Complete login flow in browser"
```

---

## Rollback Procedures

### Cloud Run Revision Management

Cloud Run keeps previous revisions for easy rollback:

```bash
# List revisions
gcloud run revisions list \
  --service=members \
  --region=europe-west2

# Rollback to previous revision
PREVIOUS_REVISION=$(gcloud run revisions list \
  --service=members \
  --region=europe-west2 \
  --format='value(metadata.name)' \
  --limit=2 | tail -1)

gcloud run services update-traffic members \
  --region=europe-west2 \
  --to-revisions=${PREVIOUS_REVISION}=100

# Verify
gcloud run services describe members \
  --region=europe-west2 \
  --format='value(status.traffic)'
```

### Emergency Rollback

```bash
# Quick rollback to last known good revision
gcloud run services update-traffic members \
  --region=europe-west2 \
  --to-latest

# Or rollback by tag
gcloud run services update-traffic members \
  --region=europe-west2 \
  --to-tags=stable=100
```

### Rollback Checklist

1. [ ] Identify issue (check logs, metrics)
2. [ ] Determine rollback target revision
3. [ ] Execute rollback command
4. [ ] Verify service is healthy
5. [ ] Test critical paths
6. [ ] Document incident
7. [ ] Fix forward, redeploy when ready

---

## Monitoring & Operations

### Cloud Run Metrics

**Key Metrics to Monitor:**
- Request count
- Request latency (p50, p95, p99)
- Error rate
- Container CPU utilization
- Container memory utilization
- Billable instance time

**Access Metrics:**
```bash
# Cloud Console
https://console.cloud.google.com/run/detail/europe-west2/members/metrics

# Or via gcloud
gcloud monitoring dashboards list
```

### Logging

**View Logs:**
```bash
# Real-time logs
gcloud run services logs read members \
  --region=europe-west2 \
  --limit=50 \
  --follow

# Filter by severity
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="members" AND severity>=ERROR' \
  --limit=50 \
  --format=json
```

**Common Log Queries:**

```bash
# Authentication errors
severity>=ERROR AND textPayload=~"OIDC"

# Performance issues
httpRequest.latency > 1s

# 5xx errors
httpRequest.status >= 500
```

### Alerting

Create alerts for:
- Error rate > 5%
- Request latency p99 > 2s
- CPU utilization > 80%
- Memory utilization > 80%

See: `gcp/operations/MONITORING_SETUP.md`

---

## Troubleshooting

### Common Issues

#### Issue: Container fails to start

**Symptoms**: Service shows "Revision failed"

**Check:**
```bash
# View deployment logs
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="members"' \
  --limit=20 \
  --format=json

# Common causes:
# - PORT environment variable mismatch
# - Missing dependencies in package.json
# - Application crash on startup
```

**Fix:**
```bash
# Ensure PORT is set correctly
gcloud run services update members \
  --region=europe-west2 \
  --set-env-vars="PORT=8080"

# Rebuild and redeploy
docker build -t ${IMAGE_PATH} .
docker push ${IMAGE_PATH}
gcloud run deploy members --image=${IMAGE_PATH} --region=europe-west2
```

---

#### Issue: 401/403 errors from ZITADEL

**Symptoms**: Login fails, OIDC errors in logs

**Check:**
```bash
# Verify ZITADEL configuration
curl https://zitadel-ymzrguoifa-nw.a.run.app/.well-known/openid-configuration

# Check redirect URI
echo $SERVICE_URL/callback

# Verify in ZITADEL Console:
# Projects > Samstaða Voting > Applications > Members > Redirect URIs
```

**Fix:**
- Add exact redirect URI to ZITADEL
- Ensure client ID matches: 338586423189856794
- Check CORS allowed origins

---

#### Issue: Session not persisting

**Symptoms**: User gets logged out immediately

**Check:**
```bash
# Verify session secret is set
gcloud run services describe members \
  --region=europe-west2 \
  --format='value(spec.template.spec.containers[0].env)'

# Check cookie settings in logs
gcloud run services logs read members --region=europe-west2 | grep -i cookie
```

**Fix:**
```bash
# Ensure session secret is configured
gcloud run services update members \
  --region=europe-west2 \
  --set-secrets="SESSION_SECRET=members-session-secret:latest"

# Verify cookie configuration in code:
# - httpOnly: true
# - secure: true
# - sameSite: 'lax'
```

---

#### Issue: High latency / Slow responses

**Symptoms**: Requests take > 2 seconds

**Check:**
```bash
# Check Cloud Run metrics
gcloud run services describe members \
  --region=europe-west2 \
  --format='value(status.traffic)'

# View latency metrics in console
# Or check cold start times
```

**Fix:**
```bash
# Increase min instances (reduces cold starts)
gcloud run services update members \
  --region=europe-west2 \
  --min-instances=1

# Increase CPU/memory
gcloud run services update members \
  --region=europe-west2 \
  --cpu=2 \
  --memory=1Gi
```

---

## Deployment Commands Reference

### Quick Deploy (After First Deployment)

```bash
# Build, push, deploy in one go
cd members
PROJECT_ID=$(gcloud config get-value project)
IMAGE_PATH="europe-west2-docker.pkg.dev/${PROJECT_ID}/ekklesia-images/members:$(git rev-parse --short HEAD)"

docker build -t ${IMAGE_PATH} .
docker push ${IMAGE_PATH}

gcloud run deploy members \
  --image=${IMAGE_PATH} \
  --region=europe-west2
```

### Environment-Specific Deploys

```bash
# Development
gcloud run deploy members-dev \
  --image=${IMAGE_PATH} \
  --region=europe-west2 \
  --set-env-vars="NODE_ENV=development"

# Production
gcloud run deploy members \
  --image=${IMAGE_PATH} \
  --region=europe-west2 \
  --set-env-vars="NODE_ENV=production" \
  --min-instances=1
```

---

## Next Steps

### After Milestone 1 (Hello-World)

1. ✅ Service deployed and accessible
2. ✅ Health check working
3. ⏭️ Proceed to Milestone 2: OIDC Authentication
4. ⏭️ Read: `/docs/specifications/members-oidc-v1.0.md`
5. ⏭️ Implement authentication routes
6. ⏭️ Test with production ZITADEL

### After Milestone 2 (OIDC Auth)

1. ✅ Login with Kenni.is working
2. ✅ Session management functional
3. ⏭️ Proceed to Milestone 3: Profile Page
4. ⏭️ Implement profile display
5. ⏭️ Connect to membership database (future)

---

## Related Documentation

- **OIDC Specification**: `/docs/specifications/members-oidc-v1.0.md`
- **Architecture**: `/docs/architecture/identity.md`
- **Infrastructure**: `/docs/architecture/TECHNICAL_SOLUTION.md`
- **Operations**: `/gcp/operations/RUNBOOKS.md`
- **Monitoring**: `/gcp/operations/MONITORING_SETUP.md`

---

**Document Version**: 1.0.0
**Last Updated**: 2025-10-03
**Next Review**: After each milestone deployment
