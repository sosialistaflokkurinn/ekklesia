# GCloud CLI Commands Reference

**Project**: ekklesia-prod-10-2025
**Date**: 2025-10-02
**User**: gudrodur@sosialistaflokkurinn.is

## ✅ Deployment Status

**OIDC Bridge Proxy:** ✅ **DEPLOYED AND RUNNING**
- **Service URL:** https://oidc-bridge-proxy-ymzrguoifa-nw.a.run.app
- **Region:** europe-west2 (London)
- **Container:** gcr.io/ekklesia-prod-10-2025/oidc-bridge-proxy:latest
- **Status:** Healthy

**ZITADEL:** ✅ **DEPLOYED AND ACCESSIBLE**
- **Service URL:** https://zitadel-ymzrguoifa-nw.a.run.app
- **Console:** https://zitadel-ymzrguoifa-nw.a.run.app/ui/console
- **Login:** https://zitadel-ymzrguoifa-nw.a.run.app/ui/login/
- **Region:** europe-west2 (London)
- **Container:** gcr.io/ekklesia-prod-10-2025/zitadel:latest
- **Database:** zitadel2 on Cloud SQL (zitadel-db)
- **Status:** Fully operational

**Quick Tests:**
```bash
# OIDC Bridge health check
curl https://oidc-bridge-proxy-ymzrguoifa-nw.a.run.app/health

# OIDC Discovery
curl https://oidc-bridge-proxy-ymzrguoifa-nw.a.run.app/.well-known/openid-configuration

# ZITADEL console (check returns 200)
curl -I https://zitadel-ymzrguoifa-nw.a.run.app/ui/console
```

---

This document records all gcloud CLI commands run during the GCP setup process, with explanations of what each command does and why it's needed.

---

## 🔒 Security Note

**Sensitive values in this document are partially masked:**
- Client secrets: First 8 characters shown, rest masked with `***`
- Project numbers: First 7 digits shown, rest masked with `*****`
- IDs: Partial masking to maintain recognizability while protecting full values
- Public identifiers (client IDs, domains): Shown in full as they're non-sensitive

Actual values are securely stored in GCP Secret Manager and should never be committed to version control or shared publicly.

---

## 📋 Table of Contents
1. [Project Setup & Permissions](#project-setup--permissions)
2. [Billing Configuration](#billing-configuration)
3. [API Enablement](#api-enablement)
4. [Secret Management](#secret-management)
5. [Verification Commands](#verification-commands)
6. [Useful Ongoing Commands](#useful-ongoing-commands)

---

## Project Setup & Permissions

### Check Your IAM Role
```bash
gcloud projects get-iam-policy ekklesia-prod-10-2025 \
  --flatten="bindings[].members" \
  --format="table(bindings.role)" \
  --filter="bindings.members:gudrodur@sosialistaflokkurinn.is"
```

**What it does:** Checks what role/permissions you have in the project  
**Result:** Shows `roles/owner` - full administrative access  
**Why:** Verify you have necessary permissions before making changes

---

### Add Co-Owner (Agúst)
```bash
gcloud projects add-iam-policy-binding ekklesia-prod-10-2025 \
  --member="user:agust@sosialistaflokkurinn.is" \
  --role="roles/owner"
```

**What it does:** Grants Owner role to another team member  
**Result:** Both gudrodur and agust now have full project access  
**Why:** Redundancy - prevents single point of failure if one admin is unavailable

---

## Billing Configuration

### Link Billing Account to Project
```bash
gcloud billing projects link ekklesia-prod-10-2025 \
  --billing-account=01EC55-5777F9-F0ED3F
```

**What it does:** Associates a billing account with the project  
**Result:** `billingEnabled: false` initially - account linked but not activated  
**Why:** Required before you can use paid GCP services

---

### Check Billing Status
```bash
gcloud billing projects describe ekklesia-prod-10-2025
```

**What it does:** Shows current billing configuration and status  
**Result:** After enabling in Console, shows `billingEnabled: true`  
**Output:**
```
billingAccountName: billingAccounts/01EC55-5777F9-F0ED3F
billingEnabled: true
name: projects/ekklesia-prod-10-2025/billingInfo
projectId: ekklesia-prod-10-2025
```

**Why:** Verify billing is active before enabling APIs (APIs won't enable without billing)

---

## API Enablement

### Enable All Required APIs
```bash
gcloud services enable \
  secretmanager.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  compute.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com
```

**What it does:** Activates GCP services needed for the project  
**Result:** `Operation "operations/acf.p2-5212403*****-..." finished successfully`

**Each API explained:**
- `secretmanager` - Store credentials securely (passwords, API keys)
- `run` - Deploy containerized applications (OIDC bridge proxy)
- `cloudbuild` - Build Docker containers automatically
- `compute` - Create and manage virtual machines (for ZITADEL)
- `sqladmin` - Manage PostgreSQL databases (ZITADEL's data)
- `artifactregistry` - Store and manage container images

**Why:** These services must be explicitly enabled before you can use them

---

## Secret Management

### Store Secrets in Secret Manager
```bash
./setup_secrets.sh
```

**What it does:** Reads credentials from `.env.zitadel` and creates secrets in GCP  
**Result:** 5 secrets created successfully

**Secrets created:**
```
NAME                 CREATED
kenni-client-id      2025-10-01T16:15:52
kenni-client-secret  2025-10-01T16:15:56
kenni-issuer         2025-10-01T16:16:01
zitadel-org-id       2025-10-01T16:16:05
zitadel-project-id   2025-10-01T16:16:08
```

**Manual equivalent commands:**
```bash
# Create each secret individually (values masked for security)
echo -n "@sosi-kosningakerfi.is/rafr-nt-kosningakerfi-s-s" | \
  gcloud secrets create kenni-client-id --data-file=-

echo -n "m7m2NA1q*********************" | \
  gcloud secrets create kenni-client-secret --data-file=-

echo -n "https://idp.kenni.is/sosi-kosningakerfi.is" | \
  gcloud secrets create kenni-issuer --data-file=-

echo -n "3382663656********" | \
  gcloud secrets create zitadel-org-id --data-file=-

echo -n "3385827759********" | \
  gcloud secrets create zitadel-project-id --data-file=-
```

**Note:** Secret values are masked with `***` for security. Actual values are stored in GCP Secret Manager.

**Why:** Keeps sensitive credentials out of code and config files. Services can access them securely at runtime.

---

## Service Account Permissions

### Fix Cloud Build Permissions
```bash
./fix_permissions.sh
```

**What it does:** Grants necessary IAM roles to Cloud Build service account  
**Result:** Service account can now build, push, and deploy containers  
**Why needed:** Cloud Build needs access to Storage, Secrets, and Cloud Run

**Roles granted:**
- `roles/cloudbuild.builds.builder` - Build containers
- `roles/storage.admin` - Upload/download from Cloud Storage
- `roles/secretmanager.secretAccessor` - Read secrets at runtime
- `roles/run.admin` - Deploy to Cloud Run

**Manual equivalent commands:**
```bash
PROJECT_ID="ekklesia-prod-10-2025"
SA="5212403*****-compute@developer.gserviceaccount.com"

# Grant Cloud Build role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA}" \
  --role="roles/cloudbuild.builds.builder"

# Grant Storage Admin
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA}" \
  --role="roles/storage.admin"

# Grant Secret Manager Accessor
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA}" \
  --role="roles/secretmanager.secretAccessor"

# Grant Cloud Run Admin
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA}" \
  --role="roles/run.admin"
```

**⚠️ Important:** IAM permission changes take 5-10 minutes to propagate across GCP.  
**Recommendation:** Wait 5 minutes after running `fix_permissions.sh` before deploying.

```bash
# Wait for IAM propagation
sleep 300  # 5 minutes
```

---

## Deployment Commands (Successful!)

### Deploy OIDC Bridge Proxy
```bash
REGION=europe-west2 ./deploy_proxy.sh
```

**What it does:** Builds, pushes, and deploys OIDC bridge proxy to Cloud Run  
**Result:** Service deployed successfully at https://oidc-bridge-proxy-ymzrguoifa-nw.a.run.app  
**Why:** Provides OIDC bridge between ZITADEL and Kenni.is

**Manual equivalent:**
```bash
# Build and push
gcloud builds submit --config=cloudbuild.yaml --substitutions=_REGION=europe-west2

# Get service URL
SERVICE_URL=$(gcloud run services describe oidc-bridge-proxy \
  --region=europe-west2 \
  --format='value(status.url)')

# Update environment variable
gcloud run services update oidc-bridge-proxy \
  --region=europe-west2 \
  --set-env-vars=PROXY_ISSUER=${SERVICE_URL}
```

---

### View Cloud Run Service
```bash
gcloud run services describe oidc-bridge-proxy --region=europe-west2
```

**What it does:** Shows detailed information about deployed service  
**Result:** Service details including URL, status, container, resources  
**Why:** Verify deployment and get service configuration

---

### View Service Logs
```bash
gcloud run services logs read oidc-bridge-proxy --region=europe-west2 --limit=50
```

**What it does:** Shows recent log entries from the service  
**Result:** Application logs, requests, errors  
**Why:** Debug issues and monitor activity

---

### Tail Service Logs (Real-time)
```bash
gcloud run services logs tail oidc-bridge-proxy --region=europe-west2
```

**What it does:** Shows live log stream from the service  
**Result:** Real-time logs as requests come in  
**Why:** Monitor authentication flows and troubleshoot issues

---

## Verification Commands

### Check gcloud Version
```bash
gcloud version
```
**What it does:** Shows installed gcloud CLI version  
**Why:** Ensure CLI is installed and working

---

### Check Authentication Status
```bash
gcloud auth list
```
**What it does:** Shows which Google account is currently authenticated  
**Why:** Verify you're using the correct organizational account

---

### Get Current Project
```bash
gcloud config get-value project
```
**What it does:** Shows the currently active project  
**Result:** `ekklesia-prod-10-2025`  
**Why:** Ensure commands run against the correct project

---

### List All Enabled APIs
```bash
gcloud services list --enabled
```
**What it does:** Shows all currently active APIs in the project  
**Why:** Verify required services are enabled

---

### List All Secrets
```bash
gcloud secrets list
```
**What it does:** Shows all secrets in Secret Manager  
**Why:** Verify secrets were created successfully

---

### View a Secret Value
```bash
gcloud secrets versions access latest --secret="kenni-client-id"
```
**What it does:** Retrieves the actual secret value  
**Result:** Shows the secret content (e.g., `@sosi-kosningakerfi.is/rafr...`)  
**Why:** Test access, verify correct values stored  
**Warning:** Use carefully! Secret values are sensitive - don't log or share them

---

## Useful Ongoing Commands

### Set Default Project (If Needed)
```bash
gcloud config set project ekklesia-prod-10-2025
```
**What it does:** Makes this project the default for all gcloud commands  
**Why:** Avoid having to specify `--project` flag every time

---

### Set Default Region
```bash
gcloud config set compute/region europe-west1
```
**What it does:** Sets default region for compute resources  
**Why:** Keep resources in Europe for lower latency to Iceland

---

### Grant Secret Access to Service Account
```bash
gcloud secrets add-iam-policy-binding kenni-client-secret \
  --member='serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com' \
  --role='roles/secretmanager.secretAccessor'
```
**What it does:** Allows Cloud Run service to read a specific secret  
**Why:** Services need explicit permission to access secrets  
**Note:** Replace `PROJECT_NUMBER` with your actual project number (get it with `gcloud projects describe`)

**Example with actual project number (masked):**
```bash
gcloud secrets add-iam-policy-binding kenni-client-secret \
  --member='serviceAccount:5212403*****-compute@developer.gserviceaccount.com' \
  --role='roles/secretmanager.secretAccessor'
```

---

### Get Project Number
```bash
gcloud projects describe ekklesia-prod-10-2025 --format="value(projectNumber)"
```
**What it does:** Shows the numeric project ID  
**Why:** Needed for service account names and some configurations

---

### View Project IAM Policy (All Members)
```bash
gcloud projects get-iam-policy ekklesia-prod-10-2025
```
**What it does:** Shows all users and their roles in the project  
**Why:** Audit who has access and what permissions they have

---

### Update a Secret
```bash
echo -n "new-secret-value" | \
  gcloud secrets versions add kenni-client-secret --data-file=-
```
**What it does:** Creates a new version of an existing secret  
**Why:** Rotate credentials without deleting the secret  
**Note:** Old versions remain accessible until explicitly destroyed

---

### List Secret Versions
```bash
gcloud secrets versions list kenni-client-secret
```
**What it does:** Shows all versions of a secret  
**Why:** Track secret rotation history, roll back if needed

---

### Delete a Secret (Careful!)
```bash
gcloud secrets delete kenni-client-secret
```
**What it does:** Permanently deletes a secret and all its versions  
**Why:** Remove unused secrets (rarely needed)  
**Warning:** This is irreversible!

---

### View Cloud Run Services
```bash
gcloud run services list --region=europe-west1
```
**What it does:** Lists all deployed Cloud Run services  
**Why:** Check what's deployed, get service URLs

---

### View Compute Engine Instances
```bash
gcloud compute instances list
```
**What it does:** Lists all VM instances  
**Why:** Check running VMs (for ZITADEL deployment)

---

### View Cloud SQL Instances
```bash
gcloud sql instances list
```
**What it does:** Lists all database instances  
**Why:** Check database status, connection info

---

### View Build History
```bash
gcloud builds list --limit=10
```
**What it does:** Shows recent Cloud Build operations  
**Why:** Check deployment history, debug build failures

---

### View Billing Budgets
```bash
gcloud billing budgets list --billing-account=01EC55-5777F9-F0ED3F
```
**What it does:** Lists configured budget alerts  
**Why:** Monitor spending alerts

---

### Create Budget Alert
```bash
gcloud billing budgets create \
  --billing-account=01EC55-5777F9-F0ED3F \
  --display-name="Ekklesia Monthly Budget" \
  --budget-amount=100USD \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100
```
**What it does:** Sets up spending alerts at 50%, 90%, and 100% of budget  
**Why:** Get notified before costs spiral out of control  
**Recommended:** Set this up to avoid surprise bills

---

## Alternative Billing Account

If you need to switch to the other billing account:

```bash
gcloud billing projects link ekklesia-prod-10-2025 \
  --billing-account=0109F7-299F92-BEDC9F
```

**Available billing accounts:**
- `01EC55-5777F9-F0ED3F` (currently active) ✅
- `0109F7-299F92-BEDC9F` (alternative available)

---

## Common Issues & Solutions

### "Billing account not open" Error
**Problem:** APIs won't enable even though billing is linked  
**Solution:** Enable billing in Console: https://console.cloud.google.com/billing?project=ekklesia-prod-10-2025  
**Verify:** Run `gcloud billing projects describe ekklesia-prod-10-2025` - should show `billingEnabled: true`

---

### "Permission Denied" Errors
**Problem:** Can't perform operations even as owner  
**Solution:** Verify role with:
```bash
gcloud projects get-iam-policy ekklesia-prod-10-2025 \
  --flatten="bindings[].members" \
  --filter="bindings.members:$(gcloud config get-value account)"
```

---

### Secret Access Denied in Cloud Run
**Problem:** Container can't read secrets  
**Solution:** Grant service account access:
```bash
# Get project number first
PROJECT_NUM=$(gcloud projects describe ekklesia-prod-10-2025 --format="value(projectNumber)")

# Grant access
gcloud secrets add-iam-policy-binding SECRET_NAME \
  --member="serviceAccount:${PROJECT_NUM}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Quick Reference Summary

### Essential Commands You'll Use Often
```bash
# Check current project
gcloud config get-value project

# List services
gcloud run services list

# View secrets
gcloud secrets list

# Check billing
gcloud billing projects describe ekklesia-prod-10-2025

# View logs (for debugging)
gcloud run services logs read oidc-bridge-proxy --region=europe-west1

# List enabled APIs
gcloud services list --enabled
```

---

## Next Steps

After completing this setup, you're ready to:

1. **Deploy OIDC Bridge Proxy**
   ```bash
   gcloud builds submit --config=cloudbuild.yaml
   ```

2. **Create PostgreSQL Database**
   ```bash
   gcloud sql instances create zitadel-db \
     --database-version=POSTGRES_14 \
     --tier=db-g1-small \
     --region=europe-west1
   ```

3. **Deploy ZITADEL** (See GCP_MIGRATION_PLAN.md for details)

---

## Resources

- **GCP Console**: https://console.cloud.google.com/
- **Project Dashboard**: https://console.cloud.google.com/home/dashboard?project=ekklesia-prod-10-2025
- **Cloud Run**: https://console.cloud.google.com/run?project=ekklesia-prod-10-2025
- **Secret Manager**: https://console.cloud.google.com/security/secret-manager?project=ekklesia-prod-10-2025
- **Billing**: https://console.cloud.google.com/billing?project=ekklesia-prod-10-2025

---

**Last Updated**: 2025-10-01  
**Status**: GCP foundation complete ✅ - Ready for deployment 🚀

---

## 🔐 Accessing Actual Secret Values

All sensitive credentials are stored in GCP Secret Manager. To access them:

```bash
# List all secrets
gcloud secrets list

# View a specific secret value
gcloud secrets versions access latest --secret="SECRET_NAME"

# Examples:
gcloud secrets versions access latest --secret="kenni-client-secret"
gcloud secrets versions access latest --secret="zitadel-org-id"
```

**Security Best Practices:**
- ✅ Never commit secrets to git
- ✅ Never log secret values
- ✅ Use Secret Manager for all sensitive data
- ✅ Grant minimal necessary permissions
- ✅ Rotate credentials regularly
- ✅ Use environment variables or Secret Manager in applications

---

## ZITADEL Deployment Commands

### Create Cloud SQL Database for ZITADEL
```bash
# Create PostgreSQL instance
gcloud sql instances create zitadel-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025

# Create database
gcloud sql databases create zitadel2 \
  --instance=zitadel-db \
  --project=ekklesia-prod-10-2025

# Check database status
gcloud sql databases list --instance=zitadel-db --project=ekklesia-prod-10-2025
```

**What it does:** Creates a PostgreSQL database for ZITADEL
**Why zitadel2:** Fresh database to avoid domain mismatch from previous initialization

### Build ZITADEL Docker Image
```bash
# Build from official ZITADEL image
cd zitadel-deploy
gcloud builds submit --config=cloudbuild.yaml .
```

**What it does:** Pulls official ZITADEL image and tags it for GCR
**Result:** Image at gcr.io/ekklesia-prod-10-2025/zitadel:latest

### Deploy ZITADEL to Cloud Run
```bash
gcloud run deploy zitadel \
  --image=gcr.io/ekklesia-prod-10-2025/zitadel:latest \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025 \
  --set-cloudsql-instances=ekklesia-prod-10-2025:europe-west2:zitadel-db \
  --set-secrets=ZITADEL_DATABASE_POSTGRES_USER_PASSWORD=zitadel-db-password:latest,ZITADEL_DATABASE_POSTGRES_ADMIN_PASSWORD=zitadel-postgres-admin-password:latest \
  --update-annotations="run.googleapis.com/invoker-iam-disabled=true" \
  --max-instances=3 \
  --memory=512Mi \
  --cpu=1 \
  --timeout=300s \
  --command="/app/zitadel" \
  --args="start-from-init" \
  --args="--masterkey=MasterkeyNeedsToHave32Characters" \
  --args="--tlsMode=disabled" \
  --set-env-vars="ZITADEL_DATABASE_POSTGRES_HOST=/cloudsql/ekklesia-prod-10-2025:europe-west2:zitadel-db,ZITADEL_DATABASE_POSTGRES_PORT=5432,ZITADEL_DATABASE_POSTGRES_DATABASE=zitadel2,ZITADEL_DATABASE_POSTGRES_USER_USERNAME=zitadel,ZITADEL_DATABASE_POSTGRES_USER_SSL_MODE=disable,ZITADEL_DATABASE_POSTGRES_ADMIN_USERNAME=postgres,ZITADEL_DATABASE_POSTGRES_ADMIN_SSL_MODE=disable,ZITADEL_EXTERNALDOMAIN=zitadel-ymzrguoifa-nw.a.run.app,ZITADEL_EXTERNALPORT=443,ZITADEL_EXTERNALSECURE=true,ZITADEL_TLS_ENABLED=false,ZITADEL_FIRSTINSTANCE_ORG_NAME=Ekklesia" \
  --allow-unauthenticated
```

**Important Notes:**
- ✅ **Command:** `/app/zitadel` (binary is at /app, not in PATH)
- ✅ **Args:** `start-from-init` initializes and starts ZITADEL
- ✅ **Domain:** Must match Cloud Run URL for instance initialization
- ✅ **Public Access:** `run.googleapis.com/invoker-iam-disabled=true` bypasses IAM
- ✅ **Database:** Uses `zitadel2` (fresh database)

### Common ZITADEL Issues & Fixes

**Issue 1: "Instance not found" / Domain Mismatch**
```bash
# Problem: ZITADEL initialized with wrong domain
# Solution: Use fresh database and correct EXTERNALDOMAIN

# Delete old database
gcloud sql databases delete zitadel --instance=zitadel-db --quiet

# Create new database
gcloud sql databases create zitadel2 --instance=zitadel-db

# Redeploy with correct domain (see deploy command above)
```

**Issue 2: Container fails with "executable 'zitadel' not found"**
```bash
# Problem: Binary is at /app/zitadel, not in PATH
# Solution: Use --command="/app/zitadel" in deployment
```

**Issue 3: 403 Forbidden on public access**
```bash
# Problem: Missing IAM annotation
# Solution: Add invoker-iam-disabled annotation
gcloud run services update zitadel \
  --region=europe-west2 \
  --update-annotations="run.googleapis.com/invoker-iam-disabled=true" \
  --project=ekklesia-prod-10-2025
```

### Monitor ZITADEL Logs
```bash
# View recent logs
gcloud run services logs read zitadel \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025 \
  --limit=50

# Follow logs in real-time
gcloud run services logs tail zitadel \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025

# Search for errors
gcloud run services logs read zitadel \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025 \
  --limit=100 | grep -i "error\|fatal\|fail"
```

### Check ZITADEL Service Status
```bash
# Describe service
gcloud run services describe zitadel \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025

# List revisions
gcloud run revisions list \
  --service=zitadel \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025

# Get environment variables
gcloud run services describe zitadel \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025 \
  --format="yaml(spec.template.spec.containers[0].env)"
```

---
