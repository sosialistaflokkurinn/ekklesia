# OIDC Bridge Proxy Deployment Guide

## ✅ DEPLOYMENT SUCCESSFUL!

**Date:** 2025-10-01  
**Service URL:** https://oidc-bridge-proxy-ymzrguoifa-nw.a.run.app  
**Region:** europe-west2 (London)  
**Status:** Running and healthy

---

## 📋 Overview

This guide covers deploying the OIDC Bridge Proxy to Google Cloud Run. This proxy solves the incompatibility between ZITADEL and Kenni.is by acting as an intermediary OIDC provider.

**Deployment Status:** ✅ **COMPLETE**  
**Project:** ekklesia-prod-10-2025  
**Region:** europe-west2 (Belgium - closest to Iceland)

---

## ✅ Prerequisites (All Complete!)

- [x] GCP project created
- [x] Billing enabled
- [x] Required APIs enabled
- [x] Secrets stored in Secret Manager
- [x] IAM permissions configured
- [x] Dockerfile ready
- [x] Proxy code updated for Cloud Run
- [x] Deployment script created
- [x] **Service deployed and running**

---

## 🎯 What Actually Worked

### The Working Deployment Process

1. **Fix Permissions (Required Twice!)**
   ```bash
   ./fix_permissions.sh          # Basic permissions
   ./fix_actAs_permission.sh     # Service Account User role
   ```

2. **Wait for IAM Propagation**
   ```bash
   sleep 300  # 5 minutes - CRITICAL!
   ```

3. **Deploy**
   ```bash
   REGION=europe-west2 ./deploy_proxy.sh
   ```

**Total Time:** ~17 minutes (including wait time)

---

## 🚀 Deployment Steps

### Step 1: Deploy the Proxy

Run the deployment script:

```bash
cd /home/gudro/Development/projects/ekklesia/gcp
./deploy_proxy.sh
```

**What this does:**
1. Builds Docker container from `oidc-bridge-proxy.js`
2. Pushes to Google Container Registry
3. Deploys to Cloud Run
4. Automatically gets the Cloud Run URL
5. Updates environment variable with correct URL
6. Verifies deployment

**Expected time:** 3-5 minutes

**What you'll see:**
```
🚀 Deploying OIDC Bridge Proxy
📦 Step 1: Building and deploying...
[Cloud Build logs]
✅ Initial deployment complete!

🔍 Step 2: Getting Cloud Run URL...
📍 Cloud Run URL: https://oidc-bridge-proxy-xxxxx-ew.a.run.app

🔄 Step 3: Updating PROXY_ISSUER...
✅ PROXY_ISSUER updated!

✅ Deployment Complete!
```

---

### Step 2: Verify Deployment

Test the health endpoint:

```bash
# The deploy script will show you the URL, or get it with:
SERVICE_URL=$(gcloud run services describe oidc-bridge-proxy \
  --region=europe-west1 \
  --format='value(status.url)')

# Test health
curl $SERVICE_URL/health

# Should return:
{
  "status": "healthy",
  "issuer": "https://oidc-bridge-proxy-xxxxx-ew.a.run.app",
  "timestamp": "2025-10-01T...",
  "keys_initialized": true
}
```

Test OIDC discovery:

```bash
curl $SERVICE_URL/.well-known/openid-configuration | jq .
```

Should show complete OIDC configuration with all endpoints.

---

### Step 3: Update ZITADEL Configuration

Once deployed, update your ZITADEL External IdP settings:

1. Go to ZITADEL Console: https://sosi-auth-nocfrq.us1.zitadel.cloud
2. Navigate to: Organization → Identity Providers
3. Select your Kenni.is provider
4. Update configuration:

**Old (development):**
- Issuer: `https://kenni-proxy.si-xj.org`
- Discovery: `https://kenni-proxy.si-xj.org/.well-known/openid-configuration`

**New (production):**
- Issuer: `https://oidc-bridge-proxy-xxxxx-ew.a.run.app`
- Discovery: `https://oidc-bridge-proxy-xxxxx-ew.a.run.app/.well-known/openid-configuration`

**Client credentials remain the same:**
- Client ID: `@sosi-kosningakerfi.is/rafr-nt-kosningakerfi-s-s`
- Client Secret: (from Secret Manager)

---

## 🔧 Troubleshooting

### ⚠️ Permission Error After fix_permissions.sh

**Error:**
```
Error 403: does not have storage.objects.get access to the Google Cloud Storage object
```

**Root Cause:** IAM permissions can take 5-10 minutes to propagate across GCP services.

**Solutions:**

**Option 1: Wait for IAM Propagation (Recommended)**
```bash
# Wait 5-10 minutes, then retry
sleep 300  # 5 minutes
REGION=europe-west2 ./deploy_proxy.sh
```

**Option 2: Use Cloud Build Service Account**
Create a custom service account with immediate permissions:
```bash
# Create service account for Cloud Build
gcloud iam service-accounts create cloud-build-sa \
  --display-name="Cloud Build Service Account"

# Grant necessary roles
PROJECT_ID="ekklesia-prod-10-2025"
SA_EMAIL="cloud-build-sa@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudbuild.builds.builder"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/run.admin"

# Deploy with custom service account
gcloud builds submit --config=cloudbuild.yaml \
  --service-account="projects/${PROJECT_ID}/serviceAccounts/${SA_EMAIL}" \
  --substitutions=_REGION=europe-west2
```

**Option 3: Manual Build (If all else fails)**
```bash
# Build locally
docker build -f Dockerfile.bridge-proxy -t gcr.io/ekklesia-prod-10-2025/oidc-bridge-proxy:latest .

# Push to registry
docker push gcr.io/ekklesia-prod-10-2025/oidc-bridge-proxy:latest

# Deploy directly
gcloud run deploy oidc-bridge-proxy \
  --image gcr.io/ekklesia-prod-10-2025/oidc-bridge-proxy:latest \
  --region europe-west2 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --set-secrets=KENNI_CLIENT_ID=kenni-client-id:latest,KENNI_CLIENT_SECRET=kenni-client-secret:latest \
  --update-env-vars PROXY_ISSUER=$(gcloud run services describe oidc-bridge-proxy --region=europe-west2 --format='value(status.url)' 2>/dev/null || echo "https://temp")
```

---

### Build Fails

**Check logs:**
```bash
gcloud builds list --limit=5
gcloud builds log BUILD_ID
```

**Common issues:**
- Missing files: Ensure you're in `/gcp` directory
- Permission error: Check IAM permissions
- Quota exceeded: Check GCP quotas

### Deployment Fails

**Check Cloud Run logs:**
```bash
gcloud run services logs read oidc-bridge-proxy --region=europe-west1 --limit=50
```

**Common issues:**
- Container won't start: Check environment variables
- Secret access denied: Grant service account access (see below)
- Port mismatch: Ensure PORT=8080 in Dockerfile

### Secret Access Issues

If the service can't read secrets:

```bash
# Get project number
PROJECT_NUM=$(gcloud projects describe ekklesia-prod-10-2025 --format="value(projectNumber)")

# Grant access to secrets
gcloud secrets add-iam-policy-binding kenni-client-secret \
  --member="serviceAccount:${PROJECT_NUM}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding kenni-client-id \
  --member="serviceAccount:${PROJECT_NUM}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 📊 Monitoring

### View Logs
```bash
# Real-time logs
gcloud run services logs tail oidc-bridge-proxy --region=europe-west1

# Recent logs
gcloud run services logs read oidc-bridge-proxy --region=europe-west1 --limit=100
```

### Check Metrics
Visit Cloud Console:
https://console.cloud.google.com/run/detail/europe-west1/oidc-bridge-proxy/metrics?project=ekklesia-prod-10-2025

**Key metrics to watch:**
- Request count
- Request latency
- Error rate
- Container CPU/Memory usage

---

## 🔄 Updates and Rollbacks

### Deploy New Version
```bash
./deploy_proxy.sh
```

### Rollback to Previous Version
```bash
# List revisions
gcloud run revisions list --service=oidc-bridge-proxy --region=europe-west1

# Rollback to specific revision
gcloud run services update-traffic oidc-bridge-proxy \
  --region=europe-west1 \
  --to-revisions=REVISION_NAME=100
```

---

## 💰 Cost Estimate

**Cloud Run Pricing (europe-west1):**
- Free tier: 2 million requests/month
- After free tier: ~$0.40 per million requests
- Memory: ~$2.50/GB-month
- CPU: ~$24/vCPU-month

**Expected monthly cost:**
- Low traffic (<10K requests/month): **FREE**
- Medium traffic (100K requests/month): **< $5/month**
- High traffic (1M requests/month): **< $15/month**

With 512MB memory and 1 vCPU, and low traffic, this will likely stay within free tier!

---

## 🔐 Security Considerations

**Current setup:**
- ✅ Secrets in Secret Manager (not in code)
- ✅ HTTPS enforced by Cloud Run
- ✅ Service uses minimal IAM permissions
- ✅ Container runs as non-root

**Production recommendations:**
- [ ] Enable Cloud Armor (DDoS protection)
- [ ] Set up custom domain with SSL
- [ ] Configure VPC connector (if needed)
- [ ] Enable Cloud Logging
- [ ] Set up monitoring alerts

---

## 📝 What Happens After Deployment

### Immediate Next Steps:
1. ✅ Verify health endpoint responds
2. ✅ Test OIDC discovery endpoint
3. ✅ Update ZITADEL configuration
4. ✅ Test authentication flow end-to-end

### Future Steps:
5. Set up PostgreSQL for ZITADEL
6. Deploy self-hosted ZITADEL
7. Configure DNS for production domains
8. Migrate applications
9. Decommission development setup

---

## 🆘 Need Help?

**View Service Status:**
```bash
gcloud run services describe oidc-bridge-proxy --region=europe-west1
```

**Get Service URL:**
```bash
gcloud run services describe oidc-bridge-proxy \
  --region=europe-west1 \
  --format='value(status.url)'
```

**Check Service Health:**
```bash
curl $(gcloud run services describe oidc-bridge-proxy \
  --region=europe-west1 \
  --format='value(status.url)')/health
```

---

## ✅ Success Criteria

Your deployment is successful when:
- [ ] Health endpoint returns `"status": "healthy"`
- [ ] Discovery endpoint returns complete OIDC config
- [ ] JWKS endpoint returns public keys
- [ ] ZITADEL can connect to the proxy
- [ ] Users can authenticate through Kenni.is
- [ ] Tokens are properly re-signed

---

**Ready to deploy?** Run `./deploy_proxy.sh` to get started! 🚀
