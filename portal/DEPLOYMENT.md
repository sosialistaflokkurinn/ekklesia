# Ekklesia Portal - Cloud Run Deployment Guide

## Prerequisites

- Google Cloud Project: `ekklesia-prod-10-2025`
- Region: `europe-west2` (London)
- Cloud SQL PostgreSQL 15 instance
- Artifact Registry repository: `ekklesia`
- Secrets in Secret Manager

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

## Infrastructure Components

### 1. Cloud SQL Database
- **Instance**: `ekklesia-db`
- **Version**: PostgreSQL 15
- **Tier**: db-f1-micro (shared CPU, 614 MB RAM)
- **Storage**: 10 GB HDD with auto-increase
- **Backups**: Daily at 02:00 UTC
- **Maintenance**: Sundays at 03:00 UTC

### 2. Cloud Run Service
- **Name**: `portal`
- **Memory**: 512 MB
- **CPU**: 1
- **Timeout**: 300 seconds
- **Concurrency**: 80 requests
- **Scaling**: 0 to 10 instances

### 3. Secrets (Secret Manager)
- `portal-db-password`: Database user password
- `portal-session-secret`: Browser session encryption key

## Deployment Steps

### Step 1: Wait for Cloud SQL Instance

```bash
# Check instance status
gcloud sql instances describe ekklesia-db \
    --project=ekklesia-prod-10-2025 \
    --format="value(state)"

# Wait until state is RUNNABLE (typically 5-10 minutes)
```

### Step 2: Set up Database

```bash
cd /home/gudro/Development/projects/ekklesia/portal

# Run database setup script
./setup-database.sh
```

This creates:
- Database: `ekklesia_portal`
- User: `ekklesia_portal`
- Grants all privileges

### Step 3: Build and Deploy

```bash
# Deploy Portal service to Cloud Run
./deploy-to-cloud-run.sh
```

This will:
1. Build Docker image from source
2. Push to Artifact Registry
3. Deploy to Cloud Run with Cloud SQL connection

### Step 4: Run Database Migrations

```bash
# Run Alembic migrations
./run-migrations.sh
```

This executes all Alembic migrations to set up the database schema.

### Step 5: Verify Deployment

```bash
# Get service URL
gcloud run services describe portal \
    --project=ekklesia-prod-10-2025 \
    --region=europe-west2 \
    --format="value(status.url)"

# Test health endpoint
curl https://portal-<hash>-ew.a.run.app/health
```

## Configuration

### Environment Variables

Set via Cloud Run deployment:

- `EKKLESIA_PORTAL_CONFIG`: Path to config file (`/app/config.production.yml`)
- `DB_NAME`: Database name (`ekklesia_portal`)
- `CLOUD_SQL_CONNECTION`: Cloud SQL connection string

### Secrets (from Secret Manager)

- `DB_PASSWORD`: Database password
- `SESSION_SECRET_KEY`: Session encryption key

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

### Database Connection Issues

1. Check Cloud SQL instance is RUNNABLE
2. Verify secrets are accessible
3. Check Cloud Run service has Cloud SQL connection configured
4. Review service logs for connection errors

### Migration Failures

1. Check database user has correct privileges
2. Verify migration files are in the container
3. Run migrations with verbose output
4. Check Alembic version table

### Service Won't Start

1. Check container logs for Python errors
2. Verify config file is valid YAML
3. Ensure all required environment variables are set
4. Check memory/CPU limits are sufficient

## Next Steps

1. Configure Firebase Auth integration
2. Set up custom domain
3. Configure CDN for static assets
4. Set up monitoring and alerting
5. Configure backup retention policies
