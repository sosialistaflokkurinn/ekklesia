# GCP Quickstart - ZITADEL Production Setup

## 🎉 You Have GCP Access!

With your `gudrodur@sosialistaflokkurinn.is` account and $300 free credits, you can now set up the production infrastructure.

## Immediate Actions

### 1. Click "Select a project" → "New Project"
- Project name: `ekklesia-voting`
- Organization: sosialistaflokkurinn.is
- Click "Create"

### 2. Install gcloud CLI (if not installed)
```bash
# Fedora
sudo dnf install google-cloud-cli
```

### 3. Authenticate
```bash
gcloud auth login
# This will open browser for authentication
```

### 4. Set project
```bash
gcloud config set project ekklesia-voting
```

### 5. Enable APIs (from Cloud Console is easier)
Go to "APIs & Services" → "Enable APIs" and enable:
- Compute Engine API
- Cloud Run API  
- Secret Manager API
- Cloud SQL Admin API

## Priority Tasks

### Phase 1 - Today (Basics)
1. ✅ Create project
2. Enable billing (required even for free trial)
3. Enable APIs
4. Create service account for ZITADEL

### Phase 2 - Migrate Secrets
```bash
# From your .env.zitadel file
gcloud secrets create kenni-client-secret --data-file=- <<< "m7m2NA1qwC52eU1ullDTyiDkVZC0bpxh"
gcloud secrets create kenni-client-id --data-file=- <<< "@sosi-kosningakerfi.is/rafr-nt-kosningakerfi-s-s"
```

### Phase 3 - Deploy Bridge Proxy
1. Containerize the Node.js proxy
2. Deploy to Cloud Run
3. Get public URL

### Phase 4 - Setup ZITADEL
1. Create VM or use Cloud Run
2. Install ZITADEL
3. Configure with Kenni.is

## Budget Management

### Free Tier Resources (Monthly)
- 1 e2-micro VM (730 hours)
- 30 GB standard persistent disk
- 5 GB Cloud Storage
- 1 GB Cloud SQL (with restrictions)

### Set Billing Alerts
Go to Billing → Budgets & alerts → Create budget
- Alert at: $50, $100, $150, $200

## Quick VM Creation (for ZITADEL)
```bash
gcloud compute instances create zitadel-vm \
  --machine-type=e2-micro \
  --zone=europe-west1-b \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --tags=http-server,https-server
```

## Next Steps After Setup

1. Update GitHub issue comments with progress
2. Commit GCP configuration to feature branch
3. Test migration from ZITADEL Cloud
4. Document the production endpoints

## Resources
- [ZITADEL Self-hosting Guide](https://zitadel.com/docs/self-hosting/deploy)
- [Cloud Run Quickstart](https://cloud.google.com/run/docs/quickstarts)
- [GCP Free Tier](https://cloud.google.com/free/docs/free-cloud-features)

## Support
- GCP Console: https://console.cloud.google.com
- ZITADEL Docs: https://zitadel.com/docs
- Your migration plan: `/docs/GCP_MIGRATION_PLAN.md`