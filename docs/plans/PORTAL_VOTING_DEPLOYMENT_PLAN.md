# Portal & Voting Services - Deployment Plan

**Version:** 1.0.0
**Date:** 2025-10-05
**Status:** 📋 Planned (Not Started)
**Priority:** Medium
**Estimated Effort:** 4-5 days
**Blockers:** None (code is ready, needs infrastructure setup)

---

## Overview

Deploy the Ekklesia Portal and Voting Python applications to Google Cloud Run. Both services use Nix for reproducible builds and require PostgreSQL databases.

**Current Status:**
- ✅ Code committed to repository (`feature/portal-voting-services` branch)
- ✅ Nix build system configured
- ✅ Docker image definitions exist (`nix/docker.nix`)
- ⏳ Not yet deployed to GCP

---

## Architecture

### Portal Service
```
┌──────────┐     ┌────────────────┐     ┌─────────────────┐
│ Browser  │────▶│ Portal (8080)  │────▶│ Cloud SQL       │
└──────────┘     │ - Morepath     │     │ (PostgreSQL 15) │
                 │ - Bootstrap 4  │     └─────────────────┘
                 │ - htmx         │
                 └────────────────┘
```

**Purpose:** Motion portal Web UI, public API, admin interface
**Tech:** Python 3.11, Morepath, PyPugJS, Bootstrap 4
**Database:** PostgreSQL 15 (separate instance from Members)

### Voting Service
```
┌──────────┐     ┌────────────────┐     ┌─────────────────┐
│ Browser  │────▶│ Voting (8080)  │────▶│ Cloud SQL       │
└──────────┘     │ - Morepath     │     │ (PostgreSQL 15) │
                 │ - Bootstrap 4  │     └─────────────────┘
                 │ - Pseudonymous │
                 └────────────────┘
```

**Purpose:** Pseudonymous ballot voting interface
**Tech:** Python 3.11, Morepath, PyPugJS, Bootstrap 4
**Database:** PostgreSQL 15 (separate instance for security)

---

## Prerequisites

### Infrastructure
- [x] GCP Project: ekklesia-prod-10-2025
- [ ] Cloud SQL instances for Portal and Voting
- [ ] Secret Manager secrets for database credentials
- [ ] Container Registry enabled
- [ ] Cloud Run API enabled

### Local Development
- [ ] Nix with Flakes enabled
- [ ] Cachix binary cache configured (optional, speeds up builds)
- [ ] Docker or Podman installed
- [ ] gcloud CLI authenticated

### Configuration Files Needed
- [ ] Portal: `config.yml` (database, OIDC, etc.)
- [ ] Voting: `config.yml` (database, OIDC, etc.)
- [ ] Environment variables for secrets

---

## Deployment Steps

### Phase 1: Database Setup (Day 1)

**1.1 Create Cloud SQL Instance for Portal**
```bash
# Create PostgreSQL 15 instance
gcloud sql instances create portal-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=europe-west2 \
  --storage-type=SSD \
  --storage-size=10GB \
  --backup \
  --enable-bin-log \
  --database-flags=max_connections=100

# Create database
gcloud sql databases create ekklesia_portal \
  --instance=portal-db

# Create user
gcloud sql users create portal_user \
  --instance=portal-db \
  --password=<generate-strong-password>
```

**1.2 Create Cloud SQL Instance for Voting**
```bash
# Create separate instance for security isolation
gcloud sql instances create voting-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=europe-west2 \
  --storage-type=SSD \
  --storage-size=10GB \
  --backup \
  --enable-bin-log \
  --database-flags=max_connections=50

# Create database
gcloud sql databases create ekklesia_voting \
  --instance=voting-db

# Create user
gcloud sql users create voting_user \
  --instance=voting-db \
  --password=<generate-strong-password>
```

**1.3 Store Database Credentials in Secret Manager**
```bash
# Portal database URL
echo "postgresql://portal_user:<password>@/ekklesia_portal?host=/cloudsql/ekklesia-prod-10-2025:europe-west2:portal-db" | \
  gcloud secrets create portal-database-url --data-file=-

# Voting database URL
echo "postgresql://voting_user:<password>@/ekklesia_voting?host=/cloudsql/ekklesia-prod-10-2025:europe-west2:voting-db" | \
  gcloud secrets create voting-database-url --data-file=-
```

### Phase 2: Build Docker Images with Nix (Day 2)

**2.1 Install Nix (if not already installed)**
```bash
# Install Nix with Flakes support
curl -L https://nixos.org/nix/install | sh -s -- --daemon

# Enable Flakes
mkdir -p ~/.config/nix
echo "experimental-features = nix-command flakes" >> ~/.config/nix/nix.conf
```

**2.2 Set Up Cachix (Optional - Speeds Up Builds)**
```bash
# Install cachix
nix-env -iA cachix -f https://cachix.org/api/v1/install

# Use Ekklesia cache
cachix use ekklesiademocracy
```

**2.3 Build Portal Docker Image**
```bash
cd portal

# Build image using Nix
nix build .#packages.x86_64-linux.docker

# Load into Docker
docker load < result

# Tag for GCR
docker tag ekklesia-portal:latest gcr.io/ekklesia-prod-10-2025/portal:latest

# Push to GCR
docker push gcr.io/ekklesia-prod-10-2025/portal:latest
```

**2.4 Build Voting Docker Image**
```bash
cd ../voting

# Build image using Nix
nix build .#packages.x86_64-linux.docker

# Load into Docker
docker load < result

# Tag for GCR
docker tag ekklesia-voting:latest gcr.io/ekklesia-prod-10-2025/voting:latest

# Push to GCR
docker push gcr.io/ekklesia-prod-10-2025/voting:latest
```

### Phase 3: Configuration Files (Day 2-3)

**3.1 Create Portal Configuration**
```yaml
# portal/config.production.yml
app:
  title: "Samstaða - Félagasvæði"
  instance_name: "ekklesia-portal-prod"

database:
  uri: "env:PORTAL_DATABASE_URL"
  # Migrations run automatically on startup

ekklesia_auth:
  enabled: true
  issuer: "https://oidc-bridge-proxy-ymzrguoifa-ew2.a.run.app"
  client_id: "ekklesia-portal"
  client_secret: "env:OIDC_CLIENT_SECRET"
  redirect_uri: "https://portal-<hash>.run.app/callback"

# Additional portal-specific settings
```

**3.2 Create Voting Configuration**
```yaml
# voting/config.production.yml
app:
  title: "Samstaða - Atkvæðagreiðsla"
  instance_name: "ekklesia-voting-prod"

database:
  uri: "env:VOTING_DATABASE_URL"

ekklesia_auth:
  enabled: true
  issuer: "https://oidc-bridge-proxy-ymzrguoifa-ew2.a.run.app"
  client_id: "ekklesia-voting"
  client_secret: "env:OIDC_CLIENT_SECRET"
  redirect_uri: "https://voting-<hash>.run.app/callback"
```

**3.3 Store Secrets**
```bash
# Generate OIDC client secrets for Portal and Voting
openssl rand -base64 32 | gcloud secrets create portal-oidc-secret --data-file=-
openssl rand -base64 32 | gcloud secrets create voting-oidc-secret --data-file=-
```

### Phase 4: Run Database Migrations (Day 3)

**4.1 Portal Migrations**
```bash
# Connect to Portal Cloud SQL via proxy
cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:portal-db &

# Run Alembic migrations
cd portal
export DATABASE_URL="postgresql://portal_user:<password>@localhost/ekklesia_portal"
alembic upgrade head
```

**4.2 Voting Migrations**
```bash
# Connect to Voting Cloud SQL via proxy
cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:voting-db &

# Run Alembic migrations
cd voting
export DATABASE_URL="postgresql://voting_user:<password>@localhost/ekklesia_voting"
alembic upgrade head
```

### Phase 5: Deploy to Cloud Run (Day 4)

**5.1 Deploy Portal Service**
```bash
gcloud run deploy portal \
  --image gcr.io/ekklesia-prod-10-2025/portal:latest \
  --region europe-west2 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --min-instances 0 \
  --max-instances 3 \
  --cpu 1 \
  --memory 512Mi \
  --timeout 300 \
  --add-cloudsql-instances ekklesia-prod-10-2025:europe-west2:portal-db \
  --set-secrets PORTAL_DATABASE_URL=portal-database-url:latest,OIDC_CLIENT_SECRET=portal-oidc-secret:latest \
  --set-env-vars CONFIG_FILE=/app/config.production.yml
```

**5.2 Deploy Voting Service**
```bash
gcloud run deploy voting \
  --image gcr.io/ekklesia-prod-10-2025/voting:latest \
  --region europe-west2 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --min-instances 0 \
  --max-instances 2 \
  --cpu 1 \
  --memory 512Mi \
  --timeout 300 \
  --add-cloudsql-instances ekklesia-prod-10-2025:europe-west2:voting-db \
  --set-secrets VOTING_DATABASE_URL=voting-database-url:latest,OIDC_CLIENT_SECRET=voting-oidc-secret:latest \
  --set-env-vars CONFIG_FILE=/app/config.production.yml
```

**5.3 Configure OIDC Bridge**
```bash
# Add Portal and Voting as allowed clients in OIDC Bridge
# Update oidc-bridge-proxy.js to include:
# - portal client_id
# - voting client_id
# - portal redirect_uri
# - voting redirect_uri

# Redeploy OIDC Bridge
cd gcp/deployment
./deploy_proxy.sh
```

### Phase 6: Testing (Day 4-5)

**6.1 Portal Service Tests**
- [ ] Service responds to health check
- [ ] Homepage loads
- [ ] Database connection works
- [ ] Login flow with OIDC Bridge
- [ ] User can view propositions
- [ ] User can create proposition (if authorized)
- [ ] Admin interface accessible

**6.2 Voting Service Tests**
- [ ] Service responds to health check
- [ ] Homepage loads
- [ ] Database connection works
- [ ] Login flow with OIDC Bridge
- [ ] User can view ballots
- [ ] User can cast vote
- [ ] Vote is pseudonymous

**6.3 Integration Tests**
- [ ] Portal → Voting navigation
- [ ] Shared authentication (same session)
- [ ] User roles propagate correctly

### Phase 7: Monitoring & Documentation (Day 5)

**7.1 Set Up Cloud Logging**
```bash
# Create log sink for Portal
gcloud logging sinks create portal-logs \
  storage.googleapis.com/ekklesia-logs \
  --log-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="portal"'

# Create log sink for Voting
gcloud logging sinks create voting-logs \
  storage.googleapis.com/ekklesia-logs \
  --log-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="voting"'
```

**7.2 Update Documentation**
- Update DOCUMENTATION_MAP.md with Portal and Voting URLs
- Document database schema
- Create runbook for common operations
- Add troubleshooting guide

---

## Configuration Details

### Portal Environment Variables
```bash
PORTAL_DATABASE_URL=<from-secret-manager>
OIDC_CLIENT_SECRET=<from-secret-manager>
CONFIG_FILE=/app/config.production.yml
PYTHONUNBUFFERED=1
```

### Voting Environment Variables
```bash
VOTING_DATABASE_URL=<from-secret-manager>
OIDC_CLIENT_SECRET=<from-secret-manager>
CONFIG_FILE=/app/config.production.yml
PYTHONUNBUFFERED=1
```

---

## Cost Estimates

### Cloud SQL
- **Portal DB** (db-f1-micro): ~$10/month
- **Voting DB** (db-f1-micro): ~$10/month
- **Total Database**: ~$20/month

### Cloud Run
- **Portal** (low traffic): ~$5/month
- **Voting** (low traffic): ~$5/month
- **Total Compute**: ~$10/month

### Total Monthly Cost: ~$30/month

---

## Rollback Plan

**If Portal deployment fails:**
```bash
gcloud run services delete portal --region europe-west2
gcloud sql instances delete portal-db
```

**If Voting deployment fails:**
```bash
gcloud run services delete voting --region europe-west2
gcloud sql instances delete voting-db
```

**Restore from backup:**
```bash
# Cloud SQL automatically backs up daily
gcloud sql backups list --instance=portal-db
gcloud sql backups restore <BACKUP_ID> --backup-instance=portal-db
```

---

## Alternative Approach: Poetry-Based Dockerfile

If Nix builds are too complex, we can create traditional Dockerfiles:

```dockerfile
# portal/Dockerfile.simple
FROM python:3.11-slim

WORKDIR /app

# Install Poetry
RUN pip install poetry

# Copy dependency files
COPY pyproject.toml poetry.lock ./

# Install dependencies
RUN poetry config virtualenvs.create false \
    && poetry install --no-dev --no-interaction --no-ansi

# Copy application code
COPY . .

# Run migrations and start server
CMD ["sh", "-c", "alembic upgrade head && gunicorn ekklesia_portal.app:app"]
```

**Note:** This may not work perfectly due to complex Nix-managed dependencies. Use as last resort.

---

## Blockers & Dependencies

**None currently** - All requirements are met:
- ✅ Code is ready
- ✅ Nix build system configured
- ✅ Docker definitions exist
- ✅ GCP project set up
- ⏳ Just needs execution time (4-5 days)

---

## Success Criteria

- [ ] Portal service deployed and accessible
- [ ] Voting service deployed and accessible
- [ ] Both services connect to their databases
- [ ] Authentication via OIDC Bridge works
- [ ] Users can login and see personalized content
- [ ] Database migrations successful
- [ ] Monitoring and logging configured
- [ ] Documentation updated

---

## References

- **Portal README:** `portal/README.md`
- **Voting README:** `voting/README.md`
- **Nix Build:** `portal/flake.nix`, `voting/flake.nix`
- **Docker Configs:** `portal/nix/docker.nix`, `voting/nix/docker.nix`
- **Ekklesia Docs:** https://docs.ekklesiademocracy.org

---

## Next Steps

1. **Schedule 5-day sprint** for deployment
2. **Set up Cloud SQL instances**
3. **Build Docker images with Nix**
4. **Deploy to Cloud Run**
5. **Test thoroughly**
6. **Update documentation**

**Status:** Ready for implementation when prioritized
**Priority:** Medium (Members service is working, Portal/Voting can wait)
