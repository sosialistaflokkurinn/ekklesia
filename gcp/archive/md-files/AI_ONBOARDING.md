# 🚀 Project Onboarding: Ekklesia GCP Production Setup

**Date:** 2025-10-02  
**Project:** ekklesia-prod-10-2025  
**Status:** OIDC Bridge Proxy Deployed, Database Setup In Progress  
**User:** Guðröður (gudrodur@sosialistaflokkurinn.is)

---

## 📋 Project Overview

**Goal:** Migrate Ekklesia voting system authentication from development to production using:
- Self-hosted ZITADEL (identity provider)
- Cloud SQL PostgreSQL (ZITADEL database)
- OIDC Bridge Proxy (Kenni.is integration)
- Google Cloud Platform (infrastructure)

**Current Phase:** Database setup for self-hosted ZITADEL

---

## ✅ What Has Been Completed

### 1. GCP Project Setup ✅
- **Project ID:** ekklesia-prod-10-2025
- **Project Number:** 521240388393
- **Billing:** Enabled and linked
- **Location:** europe-west2 (London, UK)
- **Organization:** 570942468109

### 2. APIs Enabled ✅
- Cloud Run API
- Cloud Build API
- Container Registry API
- Secret Manager API
- Cloud SQL Admin API
- Compute Engine API

### 3. Secrets Created ✅
All stored in Secret Manager:
- `kenni-client-id`: Kenni.is OAuth client ID
- `kenni-client-secret`: Kenni.is OAuth client secret
- `kenni-issuer`: https://idp.kenni.is/sosi-kosningakerfi.is
- `zitadel-org-id`: ZITADEL organization ID
- `zitadel-project-id`: ZITADEL project ID

### 4. IAM Permissions Configured ✅
Service account: `521240388393-compute@developer.gserviceaccount.com`

Roles granted:
- `roles/cloudbuild.builds.builder`
- `roles/storage.admin`
- `roles/secretmanager.secretAccessor`
- `roles/run.admin`
- `roles/iam.serviceAccountUser`

### 5. OIDC Bridge Proxy Deployed ✅

**Purpose:** Bridges incompatibility between ZITADEL and Kenni.is OIDC implementations

**Status:** Deployed and running on Cloud Run

**Working URL:** https://oidc-bridge-proxy-521240388393.europe-west2.run.app

**Endpoints:**
- Health: `/health`
- Discovery: `/.well-known/openid-configuration`
- JWKS: `/.well-known/jwks.json`
- Authorization: `/authorize`
- Token: `/token`
- Userinfo: `/userinfo`

**Known Issue:** 
- Service has two URLs, only one works: `https://oidc-bridge-proxy-521240388393.europe-west2.run.app`
- Environment variable `PROXY_ISSUER` needs to be updated to use the working URL
- Public access is enabled but requires using the correct URL

**Container:**
- Image: `gcr.io/ekklesia-prod-10-2025/oidc-bridge-proxy:latest`
- Memory: 512Mi
- CPU: 1 vCPU
- Max instances: 10

---

## 🎯 Current Status: Database Setup for Self-Hosted ZITADEL

**What We're Working On:**
Setting up Cloud SQL PostgreSQL database to host self-hosted ZITADEL instance

**Why:**
- Currently using cloud-hosted ZITADEL: https://sosi-auth-nocfrq.us1.zitadel.cloud
- Need to migrate to self-hosted for production control
- Self-hosted ZITADEL requires PostgreSQL database

---

## 📂 Project Structure

```
/home/gudro/Development/projects/ekklesia/gcp/
├── README.md                           # Project overview
├── DEPLOYMENT_SUCCESS.md               # Detailed deployment summary
├── CURRENT_STATUS.md                   # Status in Icelandic
├── QUICK_REFERENCE.md                  # Quick command reference
├── DEPLOYMENT_GUIDE.md                 # Complete deployment guide
├── GCLOUD_COMMANDS_REFERENCE.md        # All gcloud commands explained
├── IAM_TROUBLESHOOTING.md             # Permission issue solutions
├── FIX_PUBLIC_ACCESS_CONSOLE.md       # Public access setup via Console
├── DOCUMENTATION_INDEX.md              # Guide to all documentation
├── QUICKSTART.md                       # Fast deployment guide
├── GCP_QUICKSTART.md                  # GCP project setup reference
│
├── oidc-bridge-proxy.js               # OIDC proxy application code
├── package.json                        # Node.js dependencies
├── Dockerfile.bridge-proxy             # Container definition
├── cloudbuild.yaml                     # Cloud Build configuration
├── .dockerignore                       # Files to exclude from build
│
├── deploy_proxy.sh                     # Main deployment script
├── fix_permissions.sh                  # Grant IAM permissions
├── fix_actAs_permission.sh            # Grant serviceAccountUser role
├── fix_public_access.sh               # Enable public access (CLI)
├── setup_secrets.sh                    # Create secrets in Secret Manager
├── setup_gcp_project.sh               # Complete project setup
└── test_region_latency.sh             # Test GCP region latency
```

---

## 🔑 Key Information

### Authentication
**Active Account:** gudrodur@sosialistaflokkurinn.is  
**Available Accounts:**
- gudrodur@gmail.com (no permissions on project)
- gudrodur@sosialistaflokkurinn.is (owner role)

**Switch account:**
```bash
gcloud config set account gudrodur@sosialistaflokkurinn.is
```

### User Details
- **Name:** Guðröður
- **System:** Fedora Linux (dnf package manager)
- **Can run sudo:** Yes (user executes sudo commands themselves)
- **Terminal comfort:** High
- **Location:** Reykjavík, Iceland
- **Language preference:** Icelandic (but documentation is in English)

### Important URLs
- **GCP Console:** https://console.cloud.google.com/home/dashboard?project=ekklesia-prod-10-2025
- **Cloud Run Console:** https://console.cloud.google.com/run?project=ekklesia-prod-10-2025
- **OIDC Proxy (working):** https://oidc-bridge-proxy-521240388393.europe-west2.run.app
- **Current ZITADEL:** https://sosi-auth-nocfrq.us1.zitadel.cloud

---

## 📝 Next Steps (In Order)

### Immediate: Fix OIDC Proxy URL Issue
**Problem:** PROXY_ISSUER environment variable points to wrong URL

**Solution:**
```bash
gcloud run services update oidc-bridge-proxy \
  --region=europe-west2 \
  --set-env-vars=PROXY_ISSUER=https://oidc-bridge-proxy-521240388393.europe-west2.run.app
```

**Test after update:**
```bash
curl https://oidc-bridge-proxy-521240388393.europe-west2.run.app/.well-known/openid-configuration | jq .
```

Verify all endpoints use: `https://oidc-bridge-proxy-521240388393.europe-west2.run.app`

---

### Phase 1: Database Setup (Current Phase)

**Goal:** Create Cloud SQL PostgreSQL instance for ZITADEL

**Steps:**
1. Create Cloud SQL PostgreSQL instance
   - Instance name: `zitadel-db`
   - Version: PostgreSQL 15
   - Region: europe-west2
   - Machine type: db-custom-2-7680 (2 vCPU, 7.5GB RAM)
   - Storage: 10GB SSD (auto-scaling enabled)
   
2. Configure instance
   - Enable private IP
   - Set up connection security
   - Create database: `zitadel`
   - Create user: `zitadel`
   
3. Store credentials in Secret Manager
   - `zitadel-db-password`
   - `zitadel-db-connection-string`

**Commands:**
```bash
# Create instance
gcloud sql instances create zitadel-db \
  --database-version=POSTGRES_15 \
  --tier=db-custom-2-7680 \
  --region=europe-west2 \
  --storage-size=10GB \
  --storage-type=SSD \
  --storage-auto-increase \
  --database-flags=max_connections=100

# Create database
gcloud sql databases create zitadel \
  --instance=zitadel-db

# Create user (generate strong password first)
gcloud sql users create zitadel \
  --instance=zitadel-db \
  --password=<GENERATED_PASSWORD>
```

---

### Phase 2: Deploy Self-Hosted ZITADEL

**Options:**

**Option A: Cloud Run (Recommended for simplicity)**
- Pros: Managed, auto-scaling, easy deployment
- Cons: More expensive at scale, less control

**Option B: Compute Engine VM**
- Pros: Full control, cost-effective
- Cons: More management overhead

**Option C: Google Kubernetes Engine**
- Pros: Best for production scale, high availability
- Cons: Most complex setup

**Recommended:** Start with Cloud Run, migrate to GKE if needed

**ZITADEL Requirements:**
- PostgreSQL database (Cloud SQL - Phase 1)
- Persistent storage (Cloud Storage bucket)
- SSL certificate (Cloud Load Balancer + managed cert)
- Domain name (configure DNS)

---

### Phase 3: Configure Production ZITADEL

**Steps:**
1. Access new ZITADEL instance
2. Complete initial setup wizard
3. Create organization: "Socialistaflokkurinn"
4. Create project: "Ekklesia"
5. Configure external IdP: Kenni.is
   - Use OIDC proxy: https://oidc-bridge-proxy-521240388393.europe-west2.run.app
6. Create application for ekklesia
7. Note client ID and secret

---

### Phase 4: Update Applications

**Steps:**
1. Update ekklesia app to use new ZITADEL
2. Update proxy if needed
3. Test authentication flow end-to-end
4. Monitor logs and fix issues

---

### Phase 5: DNS and SSL

**Steps:**
1. Configure custom domain for ZITADEL
2. Set up Cloud Load Balancer
3. Configure managed SSL certificate
4. Update DNS records
5. Test with custom domain

---

## 🚨 Known Issues and Solutions

### Issue 1: OIDC Proxy Has Two URLs, Only One Works
**Problem:** Service returns 403 on `ymzrguoifa-nw.a.run.app` URL  
**Working URL:** https://oidc-bridge-proxy-521240388393.europe-west2.run.app  
**Solution:** Always use the numeric URL (521240388393)

### Issue 2: PROXY_ISSUER Points to Wrong URL
**Problem:** Discovery document references non-working URL  
**Status:** Needs to be fixed (see Phase 1 above)  
**Impact:** ZITADEL won't be able to use the proxy until fixed

### Issue 3: Organization Policy Blocks CLI Public Access
**Problem:** Cannot add `allUsers` via gcloud CLI due to org policy  
**Solution:** Use GCP Console to enable public access  
**Documented In:** FIX_PUBLIC_ACCESS_CONSOLE.md

### Issue 4: IAM Propagation Delay
**Problem:** New permissions take 5-10 minutes to propagate  
**Solution:** Wait 5 minutes after granting permissions before deploying  
**Script:** `fix_permissions.sh` then wait, then `deploy_proxy.sh`

### Issue 5: npm ci vs npm install
**Problem:** `npm ci` requires package-lock.json  
**Solution:** Use `npm install --production` instead  
**Status:** Already fixed in Dockerfile.bridge-proxy

---

## 🛠️ Essential Commands

### View Logs
```bash
# OIDC Proxy logs (real-time)
gcloud run services logs tail oidc-bridge-proxy --region=europe-west2

# Recent logs
gcloud run services logs read oidc-bridge-proxy --region=europe-west2 --limit=50
```

### Service Management
```bash
# Describe service
gcloud run services describe oidc-bridge-proxy --region=europe-west2

# Update environment variable
gcloud run services update oidc-bridge-proxy \
  --region=europe-west2 \
  --set-env-vars=VAR_NAME=value

# Redeploy
REGION=europe-west2 ./deploy_proxy.sh
```

### Database Commands (Once Created)
```bash
# List instances
gcloud sql instances list

# Connect to database
gcloud sql connect zitadel-db --user=zitadel

# View instance details
gcloud sql instances describe zitadel-db
```

### Secret Management
```bash
# List secrets
gcloud secrets list

# View secret value
gcloud secrets versions access latest --secret=secret-name

# Create new secret
echo -n "secret-value" | gcloud secrets create secret-name --data-file=-
```

---

## 📊 Cost Estimates

**Current Monthly Costs (Approximate):**
- Cloud Run (OIDC Proxy): < $1/month (likely free tier)
- Secret Manager: < $1/month
- Container Registry: < $1/month
- **Total Current:** < $5/month

**After Database Setup:**
- Cloud SQL (db-custom-2-7680): ~$100-150/month
- Storage: ~$2-5/month
- **Total After DB:** ~$110-160/month

**After Self-Hosted ZITADEL:**
- Cloud Run (if used): ~$20-50/month
- OR Compute Engine: ~$50-100/month
- Load Balancer: ~$20-30/month
- **Total Production:** ~$150-300/month

---

## 🔐 Security Considerations

**Secrets:**
- All stored in Secret Manager ✅
- Never in code or config files ✅
- Access controlled by IAM ✅

**Network:**
- Cloud Run services on managed GCP infrastructure ✅
- SSL/TLS enforced ✅
- Public OIDC endpoints (standard practice) ✅

**Authentication:**
- Kenni.is handles user authentication ✅
- Client credentials required for token exchange ✅
- ZITADEL manages authorization ✅

**Database (To Be Configured):**
- Private IP preferred
- Automated backups
- Encryption at rest
- Connection via Cloud SQL Proxy

---

## 📚 Key Documentation Files

**Must Read:**
1. **DEPLOYMENT_SUCCESS.md** - What was accomplished, lessons learned
2. **QUICK_REFERENCE.md** - Common commands and tests
3. **IAM_TROUBLESHOOTING.md** - Permission issue solutions

**Reference:**
4. **DEPLOYMENT_GUIDE.md** - Step-by-step deployment
5. **GCLOUD_COMMANDS_REFERENCE.md** - All gcloud commands explained
6. **DOCUMENTATION_INDEX.md** - Guide to all documentation

**Troubleshooting:**
7. **FIX_PUBLIC_ACCESS_CONSOLE.md** - Public access via Console
8. **IAM_TROUBLESHOOTING.md** - Permission problems

---

## 🎯 Success Criteria

**Phase 1 (Database) Complete When:**
- [ ] Cloud SQL instance created and running
- [ ] Database `zitadel` created
- [ ] User `zitadel` created with strong password
- [ ] Credentials stored in Secret Manager
- [ ] Can connect to database

**Phase 2 (ZITADEL) Complete When:**
- [ ] ZITADEL deployed and accessible
- [ ] Initial setup wizard completed
- [ ] Organization and project created
- [ ] External IdP (proxy) configured
- [ ] Test application created

**Phase 3 (Production) Complete When:**
- [ ] Ekklesia app uses new ZITADEL
- [ ] End-to-end authentication works
- [ ] Custom domain configured
- [ ] SSL certificates valid
- [ ] Monitoring and alerting set up

---

## 💡 Important Notes for AI Assistant

1. **User Preferences:**
   - User is comfortable with terminal
   - Prefers absolute paths over relative
   - Can run sudo commands (provide commands, don't execute)
   - Uses Fedora Linux (dnf, not apt)

2. **Authentication:**
   - Always ensure using `gudrodur@sosialistaflokkurinn.is`
   - This account has owner permissions
   - gmail account does NOT have permissions

3. **Region:**
   - Always use `europe-west2` (London)
   - Closest to Iceland for best latency

4. **Documentation:**
   - Maintain all .md files in `/gcp` directory
   - Update CURRENT_STATUS.md after major changes
   - Keep QUICK_REFERENCE.md with latest commands

5. **Scripts:**
   - All bash scripts in `/gcp` directory
   - Make executable: `chmod +x script.sh`
   - Test before running

6. **Known Patterns:**
   - IAM changes take 5-10 minutes to propagate
   - Organization policies may block some CLI operations
   - Use Console for operations blocked by org policy
   - Always verify active gcloud account

---

## 🆘 If Something Goes Wrong

**Authentication Issues:**
```bash
# Check active account
gcloud auth list

# Switch account if needed
gcloud config set account gudrodur@sosialistaflokkurinn.is

# Re-authenticate if tokens expired
gcloud auth login
```

**Permission Issues:**
- Review IAM_TROUBLESHOOTING.md
- Check if organization policy is blocking
- Try operation via Console instead of CLI
- Wait 5-10 minutes after granting permissions

**Service Issues:**
- Check logs: `gcloud run services logs read <service-name> --region=europe-west2`
- Verify secrets are accessible
- Check IAM bindings
- Review recent deployments

**Database Issues (Future):**
- Check instance status: `gcloud sql instances describe zitadel-db`
- Review database logs in Console
- Verify network connectivity
- Check user permissions

---

## 📧 Contact Information

**User:** Guðröður  
**Email:** gudrodur@sosialistaflokkurinn.is  
**Organization:** Socialistaflokkurinn (Socialist Party of Iceland)  
**Project:** Ekklesia (Electronic Voting System)

---

## ✅ Handoff Checklist

Before continuing, verify:
- [ ] Read this entire document
- [ ] Understand current project phase (Database Setup)
- [ ] Know which URL works for OIDC proxy
- [ ] Aware of PROXY_ISSUER issue that needs fixing
- [ ] Understand user preferences and system (Fedora, sudo, etc.)
- [ ] Know which gcloud account to use
- [ ] Reviewed key documentation files
- [ ] Understand next immediate steps

---

**Last Updated:** 2025-10-02  
**Current Phase:** Database Setup for Self-Hosted ZITADEL  
**Status:** Ready to proceed with Phase 1

**Next Task:** Fix PROXY_ISSUER, then create Cloud SQL PostgreSQL instance
