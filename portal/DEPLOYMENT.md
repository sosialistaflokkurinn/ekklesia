# Ekklesia Portal - Cloud Run Deployment Guide

**Status**: 🟡 Deployed but Database Not Migrated
**Last Verified**: 2025-10-07

## Prerequisites

✅ All prerequisites met:
- Google Cloud Project: `ekklesia-prod-10-2025` (521240388393)
- Region: `europe-west2` (London)
- Cloud SQL PostgreSQL 15 instance: `ekklesia-db` (RUNNABLE)
- Artifact Registry repository: `ekklesia` (1.27 GB)
- Secrets in Secret Manager: `portal-db-password`, `portal-session-secret`

## Architecture

```
┌─────────────────────┐
│   Cloud Run         │
│   Portal Service    │
│   (Python/Morepath) │
└──────────┬──────────┘
           │
           ├─────────► Cloud SQL PostgreSQL
           │           (ekklesia-db)
           │
           └─────────► Firebase Auth
                       (Members Service)
```

## Infrastructure Components (Verified)

### 1. Cloud SQL Database ✅
- **Instance**: `ekklesia-db`
- **Version**: PostgreSQL 15
- **Tier**: db-f1-micro (shared CPU, 614 MB RAM)
- **Storage**: 10 GB PD_HDD with auto-increase
- **Backups**: Daily at 02:00 UTC
- **Maintenance**: Sundays (day 7) at 03:00 UTC
- **State**: RUNNABLE
- **Database**: `ekklesia_portal` (UTF8, created but empty)
- **User**: `ekklesia_portal` (created)

### 2. Cloud Run Service ✅
- **Name**: `portal`
- **URL**: https://portal-ymzrguoifa-nw.a.run.app
- **Memory**: 512 MB (512Mi)
- **CPU**: 1
- **Timeout**: 300 seconds
- **Concurrency**: 80 requests
- **Scaling**: Not explicitly set (defaults: min 0, max 100)
- **Status**: 🔴 503 Error (dependencies missing, see Troubleshooting)

### 3. Secrets (Secret Manager) ✅
- `portal-db-password`: Created 2025-10-07 17:22:55 (automatic replication)
- `portal-session-secret`: Created 2025-10-07 17:23:07 (automatic replication)

## Deployment Steps

### Step 1: Wait for Cloud SQL Instance ✅ COMPLETED

```bash
# Check instance status
gcloud sql instances describe ekklesia-db \
    --project=ekklesia-prod-10-2025 \
    --format="value(state)"
# Output: RUNNABLE
```

### Step 2: Set up Database ✅ COMPLETED

```bash
cd /home/gudro/Development/projects/ekklesia/portal

# Run database setup script
./setup-database.sh
```

**Status**: Completed successfully
- ✅ Database: `ekklesia_portal` (created, UTF8)
- ✅ User: `ekklesia_portal` (created)
- ⚠️ Privileges: Partially granted (psql not available, manual grant needed)

### Step 3: Build and Deploy ✅ COMPLETED

```bash
# Deploy Portal service to Cloud Run
./deploy-to-cloud-run.sh
```

**Status**: Completed successfully
- ✅ Docker image built and pushed to Artifact Registry
- ✅ Service deployed to Cloud Run
- ✅ Cloud SQL connection configured
- ✅ Environment variables set
- ✅ Secrets configured

**Actual Service URL**: https://portal-ymzrguoifa-nw.a.run.app

### Step 4: Run Database Migrations ❌ BLOCKED

```bash
# Run Alembic migrations
./run-migrations.sh
```

**Status**: ❌ BLOCKED - Dependency Resolution Issue
- **Issue**: Python dependencies missing (case-conversion, pytz, zope.sqlalchemy, etc.)
- **Root Cause**: ekklesia-common has many transitive dependencies
- **Current Approach**: Manually adding dependencies to Dockerfile
- **Recommended Fix**: Export requirements.txt from poetry.lock

**See**: [PORTAL_DEPLOYMENT_PROGRESS.md](../PORTAL_DEPLOYMENT_PROGRESS.md) for detailed analysis and resolution options.

### Step 5: Verify Deployment 🟡 PARTIAL

```bash
# Get service URL
gcloud run services describe portal \
    --project=ekklesia-prod-10-2025 \
    --region=europe-west2 \
    --format="value(status.url)"
# Output: https://portal-ymzrguoifa-nw.a.run.app

# Test service endpoint
curl -I https://portal-ymzrguoifa-nw.a.run.app
# Output: HTTP/1.1 503 Service Unavailable (dependency issues)
```

**Current Status**:
- ✅ Service deployed
- ✅ URL accessible
- ❌ Service returns 503 (container crashes due to missing dependencies)
- ❌ Database schema not migrated (0 tables)

## Configuration (Verified)

### Environment Variables ✅

Verified via Cloud Run service:

- `EKKLESIA_PORTAL_CONFIG`: `/app/config.production.yml`
- `DB_NAME`: `ekklesia_portal`
- `CLOUD_SQL_CONNECTION`: `ekklesia-prod-10-2025:europe-west2:ekklesia-db`

### Secrets (from Secret Manager) ✅

Configured and accessible:

- `DB_PASSWORD`: From `portal-db-password:latest`
- `SESSION_SECRET_KEY`: From `portal-session-secret:latest`

### Configuration File

The `config.production.yml` contains:
- Database connection settings
- App configuration (title, languages, timezone)
- Session settings
- Firebase Auth integration (optional)
- Feature flags

## Database Management

### Connect to Database

```bash
# Via Cloud SQL Proxy
gcloud sql connect ekklesia-db \
    --project=ekklesia-prod-10-2025 \
    --user=ekklesia_portal \
    --database=ekklesia_portal
```

### Run Migrations Manually

```bash
# Build the container
docker build -t portal-migrate .

# Run migrations locally (requires Cloud SQL Proxy)
docker run --rm \
    -e EKKLESIA_PORTAL_CONFIG=/app/config.production.yml \
    portal-migrate \
    alembic upgrade head
```

### Backup Database

```bash
# Create backup
gcloud sql backups create \
    --instance=ekklesia-db \
    --project=ekklesia-prod-10-2025

# List backups
gcloud sql backups list \
    --instance=ekklesia-db \
    --project=ekklesia-prod-10-2025
```

## Monitoring

### View Logs

```bash
# Portal service logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=portal" \
    --project=ekklesia-prod-10-2025 \
    --limit=50 \
    --format=json

# Database logs
gcloud sql operations list \
    --instance=ekklesia-db \
    --project=ekklesia-prod-10-2025
```

### Check Service Health

```bash
# Service status
gcloud run services describe portal \
    --project=ekklesia-prod-10-2025 \
    --region=europe-west2

# Recent revisions
gcloud run revisions list \
    --service=portal \
    --project=ekklesia-prod-10-2025 \
    --region=europe-west2
```

## Costs

Estimated monthly costs (Free Tier):

- **Cloud Run**: $0/month (2M requests free)
- **Cloud SQL**: ~$7-10/month (db-f1-micro)
- **Artifact Registry**: ~$0.10/month
- **Secret Manager**: $0.06/month

**Total**: ~$7-10/month

## Troubleshooting

### Current Issue: Service 503 Error ⚠️

**Symptom**: Portal service returns HTTP 503
**Root Cause**: Container crashes on startup due to missing Python dependencies

**Error in logs**:
```
Traceback (most recent call last):
  File "/usr/local/bin/gunicorn", line 8, in <module>
    sys.exit(run())
             ^^^^^
  [Container crashes due to missing dependencies]
```

**Resolution Options**:
1. **Recommended**: Export requirements.txt from poetry.lock
   ```bash
   poetry export -f requirements.txt --output requirements.txt --without-hashes --only main
   # Update Dockerfile to use requirements.txt
   COPY requirements.txt ./
   RUN pip install --no-cache-dir -r requirements.txt
   ```

2. **Alternative**: Continue manually adding dependencies to Dockerfile
   - Already added: pyyaml, pytz, zope.sqlalchemy, case-conversion, attrs
   - May require additional packages

3. **Build with Nix**: Use existing nix/docker.nix (requires Nix setup)

**See**: [PORTAL_DEPLOYMENT_PROGRESS.md](../PORTAL_DEPLOYMENT_PROGRESS.md) for detailed analysis

### Database Connection Issues ✅

**Status**: No issues detected
1. ✅ Cloud SQL instance is RUNNABLE
2. ✅ Secrets are accessible
3. ✅ Cloud Run service has Cloud SQL connection configured
4. ⚠️ Cannot test connection until service starts

### Migration Failures ❌

**Status**: Migrations not attempted yet
1. ⚠️ Database user privileges partially granted (psql not available)
2. ✅ Migration files are in the container
3. ❌ Cannot run migrations until service starts
4. ❌ Alembic version table does not exist (no migrations run)

**Manual privilege grant needed**:
```sql
-- Connect with postgres user
GRANT ALL PRIVILEGES ON DATABASE ekklesia_portal TO ekklesia_portal;
ALTER DATABASE ekklesia_portal OWNER TO ekklesia_portal;
```

### Service Won't Start ⚠️

**Current Diagnosis**:
1. ✅ Container logs show Python dependency errors
2. ✅ Config file is valid YAML
3. ✅ All required environment variables are set
4. ✅ Memory/CPU limits are sufficient (512MB/1CPU)

## Next Steps (Priority Order)

### Immediate (Critical)
1. **Fix Dependency Issues** - Use poetry export to generate requirements.txt
2. **Redeploy Service** - Deploy with complete dependencies
3. **Run Database Migrations** - Execute 24 Alembic migrations
4. **Verify Service Health** - Ensure Portal responds with 200 OK

### Short-term
5. **Grant Database Privileges** - Manual SQL grant if needed
6. **Test Authentication Flow** - Verify Firebase Auth integration
7. **Configure Monitoring** - Set up Cloud Logging alerts for errors
8. **Document Working Deployment** - Update guides with successful steps

### Long-term
9. **Set up Custom Domain** - Map to Cloud Run service
10. **Configure CDN** - For static assets
11. **Backup Strategy** - Configure retention policies
12. **Performance Tuning** - Optimize database queries
13. **Integration Testing** - End-to-end Portal + Members flow

## Related Documentation

- [PORTAL_DEPLOYMENT_PROGRESS.md](../PORTAL_DEPLOYMENT_PROGRESS.md) - Detailed deployment status
- [CURRENT_PRODUCTION_STATUS.md](../CURRENT_PRODUCTION_STATUS.md) - Overall system status
- [Portal README.md](README.md) - Application documentation
