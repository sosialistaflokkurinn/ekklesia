# IAM Permissions Troubleshooting Guide

## ✅ RESOLVED - Deployment Successful!

**Status:** All permission issues resolved  
**Date:** 2025-10-01  
**Service URL:** https://oidc-bridge-proxy-ymzrguoifa-nw.a.run.app

---

## 🎯 What Worked (Final Solution)

### Step 1: Grant Basic Permissions
```bash
./fix_permissions.sh
```
Grants:
- `roles/cloudbuild.builds.builder`
- `roles/storage.admin`
- `roles/secretmanager.secretAccessor`
- `roles/run.admin`

### Step 2: Grant Service Account User Permission
```bash
./fix_actAs_permission.sh
```
Grants:
- `roles/iam.serviceAccountUser` (CRITICAL!)

### Step 3: Wait for IAM Propagation
```bash
sleep 300  # 5 minutes
```

### Step 4: Deploy
```bash
REGION=europe-west2 ./deploy_proxy.sh
```

**Result:** ✅ SUCCESS in ~2 minutes!

---

## 🔴 Common Errors (Now Resolved)

```
ERROR: (gcloud.builds.submit) INVALID_ARGUMENT: could not resolve source: 
googleapi: Error 403: 521240388393-compute@developer.gserviceaccount.com 
does not have storage.objects.get access to the Google Cloud Storage object. 
Permission 'storage.objects.get' denied on resource (or it may not exist)., forbidden
```

---

## 🧠 Understanding the Problem

### What's Happening?
1. Cloud Build needs to upload source code to Cloud Storage
2. The default compute service account needs permissions
3. IAM permission changes take **5-10 minutes** to propagate across GCP
4. Even after running `fix_permissions.sh`, you must wait

### Why the Delay?
- GCP uses distributed systems globally
- Permission changes need to sync across all regions
- Cache invalidation takes time
- This is normal GCP behavior

---

## ✅ Solution 1: Wait and Retry (Recommended)

**This is the simplest and most reliable approach:**

```bash
# After running fix_permissions.sh:
echo "Waiting for IAM propagation (5 minutes)..."
sleep 300

# Then deploy
REGION=europe-west2 ./deploy_proxy.sh
```

**Why this works:**
- ✅ Permissions are already granted
- ✅ Just needs time to propagate
- ✅ No additional setup needed
- ✅ Most reliable long-term

---

## ✅ Solution 2: Enable Cloud Build API Properly

Sometimes the Cloud Build API needs to be re-enabled:

```bash
# Disable and re-enable Cloud Build
gcloud services disable cloudbuild.googleapis.com --force
sleep 30
gcloud services enable cloudbuild.googleapis.com

# Wait for propagation
sleep 120

# Try deployment again
REGION=europe-west2 ./deploy_proxy.sh
```

---

## ✅ Solution 3: Use Cloud Build Service Account

Create a dedicated service account with immediate effect:

```bash
# Create dedicated service account
gcloud iam service-accounts create ekklesia-cloudbuild \
  --display-name="Ekklesia Cloud Build Account" \
  --project=ekklesia-prod-10-2025

# Get the email
SA_EMAIL="ekklesia-cloudbuild@ekklesia-prod-10-2025.iam.gserviceaccount.com"

# Grant all necessary roles at once
for ROLE in \
  "roles/cloudbuild.builds.builder" \
  "roles/storage.admin" \
  "roles/run.admin" \
  "roles/iam.serviceAccountUser" \
  "roles/secretmanager.secretAccessor"
do
  gcloud projects add-iam-policy-binding ekklesia-prod-10-2025 \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="${ROLE}"
done

# Deploy with this service account
gcloud builds submit \
  --config=cloudbuild.yaml \
  --service-account="projects/ekklesia-prod-10-2025/serviceAccounts/${SA_EMAIL}" \
  --substitutions=_REGION=europe-west2
```

---

## ✅ Solution 4: Manual Docker Build

Bypass Cloud Build entirely:

### Step 1: Build Locally
```bash
cd /home/gudro/Development/projects/ekklesia/gcp

# Build container
docker build -f Dockerfile.bridge-proxy \
  -t gcr.io/ekklesia-prod-10-2025/oidc-bridge-proxy:latest .
```

### Step 2: Configure Docker for GCR
```bash
gcloud auth configure-docker gcr.io
```

### Step 3: Push to Registry
```bash
docker push gcr.io/ekklesia-prod-10-2025/oidc-bridge-proxy:latest
```

### Step 4: Deploy to Cloud Run
```bash
gcloud run deploy oidc-bridge-proxy \
  --image gcr.io/ekklesia-prod-10-2025/oidc-bridge-proxy:latest \
  --region europe-west2 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --set-secrets=KENNI_CLIENT_ID=kenni-client-id:latest,KENNI_CLIENT_SECRET=kenni-client-secret:latest \
  --set-env-vars=PROXY_ISSUER=https://placeholder

# Get the service URL
SERVICE_URL=$(gcloud run services describe oidc-bridge-proxy \
  --region=europe-west2 \
  --format='value(status.url)')

# Update with correct URL
gcloud run services update oidc-bridge-proxy \
  --region=europe-west2 \
  --set-env-vars=PROXY_ISSUER=${SERVICE_URL}

echo ""
echo "✅ Deployed to: $SERVICE_URL"
```

---

## ✅ Solution 5: Check Storage Bucket Permissions

Sometimes the Cloud Storage bucket itself needs permissions:

```bash
# List buckets
gsutil ls

# Grant permissions to the bucket
BUCKET="gs://ekklesia-prod-10-2025_cloudbuild"
SA="521240388393-compute@developer.gserviceaccount.com"

gsutil iam ch \
  serviceAccount:${SA}:objectAdmin \
  ${BUCKET}
```

---

## 📊 Verification Commands

### Check Current Permissions
```bash
# Check service account roles
gcloud projects get-iam-policy ekklesia-prod-10-2025 \
  --flatten="bindings[].members" \
  --filter="bindings.members:521240388393-compute@developer.gserviceaccount.com" \
  --format="table(bindings.role)"
```

### Check Cloud Build Status
```bash
# Check if API is enabled
gcloud services list --enabled | grep cloudbuild

# Check recent builds
gcloud builds list --limit=5
```

### Check Storage Access
```bash
# List Cloud Build bucket contents
gsutil ls gs://ekklesia-prod-10-2025_cloudbuild/

# Check bucket IAM
gsutil iam get gs://ekklesia-prod-10-2025_cloudbuild/
```

---

## 🎯 Recommended Approach

**For most users:**

1. ✅ Run `./fix_permissions.sh`
2. ⏰ Wait 5-10 minutes (get coffee ☕)
3. 🚀 Run `REGION=europe-west2 ./deploy_proxy.sh`

**If you're impatient or it still fails:**

1. 🔧 Use Solution 4 (Manual Docker Build)
2. 📝 Document what worked for future reference

---

## 📝 What We Learned

### IAM Propagation Times
- **Immediate**: Permission granted in IAM console
- **1-2 minutes**: Visible in API
- **5-10 minutes**: Fully propagated and usable
- **Rare cases**: Up to 15 minutes

### Best Practices
- ✅ Grant permissions before starting deployment
- ✅ Use `sleep` commands to wait for propagation
- ✅ Have a backup plan (manual build)
- ✅ Document what worked for your project

---

## 🆘 Still Not Working?

If none of these solutions work:

1. **Check Project Permissions**
   ```bash
   gcloud projects get-iam-policy ekklesia-prod-10-2025
   ```

2. **Verify APIs are Enabled**
   ```bash
   gcloud services list --enabled
   ```

3. **Check Quotas**
   ```bash
   gcloud compute project-info describe --project=ekklesia-prod-10-2025
   ```

4. **Contact GCP Support** (if you have support plan)
   - Describe: IAM permission propagation issue
   - Include: Project ID, service account email, error message
   - Ask: How to force IAM cache refresh

---

## ✅ Success Criteria

You know permissions are working when:

- [ ] `gcloud builds submit` starts uploading files
- [ ] No storage.objects.get errors
- [ ] Build logs appear in Cloud Console
- [ ] Container image is created in GCR
- [ ] Cloud Run service is deployed

---

**Most Common Solution:** Wait 5-10 minutes after `fix_permissions.sh` 🕐
