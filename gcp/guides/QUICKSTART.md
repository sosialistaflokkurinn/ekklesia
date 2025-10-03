# Quick Start - Fixed Deployment

## ✅ What Was Fixed

1. **Machine Type Error**: Changed from `N1_HIGHCPU_8` to `E2_HIGHCPU_8` in cloudbuild.yaml
2. **Region Selection**: Added latency testing script to find best region for Iceland

---

## 🚀 Deploy Now (Updated Process)

**Step 1: Fix Permissions**
```bash
cd /home/gudro/Development/projects/ekklesia/gcp
./fix_permissions.sh
```

**Step 2: Wait for IAM Propagation**
```bash
# IAM changes take 5-10 minutes to propagate
echo "Waiting 5 minutes for permissions to take effect..."
sleep 300
```

**Step 3: Deploy**
```bash
# Option A: Use default region (europe-west1)
./deploy_proxy.sh

# Option B: Use specific region (recommended: London for Iceland)
REGION=europe-west2 ./deploy_proxy.sh
```

---

## ⚠️ Common Issue: Permission Error

If you get `Error 403: storage.objects.get access` after running `fix_permissions.sh`:

**This is normal!** IAM permissions need time to propagate.

**Solution:**
```bash
# Wait 5 minutes and retry
sleep 300
REGION=europe-west2 ./deploy_proxy.sh
```

---

## 🌍 Region Recommendations for Iceland

Based on geography, best regions are likely:

1. **europe-north1** (Finland) - Closest geographically
2. **europe-west1** (Belgium) - Very good connectivity
3. **europe-west2** (London) - Good option
4. **europe-west4** (Netherlands) - Also good

Run `./test_region_latency.sh` to test actual latency from your location.

---

## 📋 What the Scripts Do

### test_region_latency.sh
- Pings GCP endpoints in 14+ regions
- Shows latency in milliseconds
- Ranks regions by speed
- Recommends best region for you

### deploy_proxy.sh
- Builds Docker container
- Deploys to Cloud Run
- Configures environment variables
- Returns service URL

---

## 🔧 Advanced Usage

**Deploy to specific region:**
```bash
REGION=europe-north1 ./deploy_proxy.sh
```

**View deployment logs:**
```bash
gcloud builds list --limit=5
gcloud builds log BUILD_ID
```

**Check service status:**
```bash
gcloud run services describe oidc-bridge-proxy --region=europe-west1
```

---

## ⚡ Quick Deploy Commands

```bash
# From the gcp directory:
cd /home/gudro/Development/projects/ekklesia/gcp

# Test regions (optional but recommended)
./test_region_latency.sh

# Deploy (use default or best region from test)
./deploy_proxy.sh

# Or with specific region:
REGION=europe-north1 ./deploy_proxy.sh
```

---

**Ready? Just run:** `./deploy_proxy.sh` 🚀
