# Ekklesia Portal - Deployment Status

**Date**: 2025-10-07
**Status**: 🟡 Infrastructure Setup In Progress

## ✅ Completed Tasks

### 1. Portal Application Configuration
- ✅ Created production Dockerfile ([portal/Dockerfile](portal/Dockerfile))
- ✅ Created .dockerignore for efficient builds
- ✅ Created entrypoint.sh with support for serve/migrate/shell commands
- ✅ Created production config template ([portal/config.production.yml](portal/config.production.yml))
- ✅ Created environment variables example ([portal/.env.production.example](portal/.env.production.example))

### 2. Deployment Scripts
- ✅ [portal/deploy-to-cloud-run.sh](portal/deploy-to-cloud-run.sh) - Main deployment script
- ✅ [portal/setup-database.sh](portal/setup-database.sh) - Database initialization
- ✅ [portal/run-migrations.sh](portal/run-migrations.sh) - Alembic migrations
- ✅ [portal/DEPLOYMENT.md](portal/DEPLOYMENT.md) - Complete deployment guide

### 3. Secrets Created (Secret Manager)
- ✅ `portal-db-password` - Database user password (Qi7tk8mawhTxP9SSGEwnEXvm7blaF+25)
- ✅ `portal-session-secret` - Session encryption key (6rnZDsCdYUhXcHzXnf9DG3hfAdoFovEVthGePDjdr3c=)

### 4. Artifact Registry
- ✅ Repository exists: `europe-west2-docker.pkg.dev/ekklesia-prod-10-2025/ekklesia`
- ✅ Ready to accept Portal container images

## 🟡 In Progress

### Cloud SQL PostgreSQL Instance
- **Instance Name**: `ekklesia-db`
- **Status**: `PENDING_CREATE` (creating for ~10 minutes)
- **IP Address**: 34.147.159.80 (assigned)
- **Version**: PostgreSQL 15
- **Tier**: db-f1-micro (614 MB RAM, shared CPU)
- **Region**: europe-west2 (London)
- **Storage**: 10 GB HDD with auto-increase

**Creation Command**:
```bash
gcloud sql instances create ekklesia-db \
    --project=ekklesia-prod-10-2025 \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=europe-west2 \
    --storage-type=HDD \
    --storage-size=10GB \
    --storage-auto-increase \
    --backup-start-time=02:00 \
    --maintenance-window-day=SUN \
    --maintenance-window-hour=03 \
    --database-flags=max_connections=100
```

**Check Status**:
```bash
gcloud sql instances describe ekklesia-db \
    --project=ekklesia-prod-10-2025 \
    --format="value(state)"
```

Expected state: `RUNNABLE` (when ready)

## ⏳ Pending Tasks

Once Cloud SQL instance is `RUNNABLE`, execute in order:

### 1. Database Setup
```bash
cd /home/gudro/Development/projects/ekklesia/portal
./setup-database.sh
```

Creates:
- Database: `ekklesia_portal`
- User: `ekklesia_portal`
- Grants privileges

### 2. Build and Deploy Portal Service
```bash
cd /home/gudro/Development/projects/ekklesia/portal
./deploy-to-cloud-run.sh
```

This will:
- Build Docker image with all Portal code
- Push to Artifact Registry
- Deploy to Cloud Run with:
  - 512 MB memory
  - 1 CPU
  - Cloud SQL connection
  - Environment variables and secrets
  - Auto-scaling 0-10 instances

### 3. Run Database Migrations
```bash
cd /home/gudro/Development/projects/ekklesia/portal
./run-migrations.sh
```

Executes all 24 Alembic migrations to set up:
- User and authentication tables
- Propositions and ballots
- Voting phase tables
- Document and page tables
- Full-text search configuration

### 4. Test Deployment
```bash
# Get service URL
gcloud run services describe portal \
    --project=ekklesia-prod-10-2025 \
    --region=europe-west2 \
    --format="value(status.url)"

# Test health endpoint
curl <service-url>/health
```

## 📋 Architecture Overview

```
┌──────────────────────────────────────────────────┐
│            Ekklesia Platform (GCP)               │
│                                                  │
│  ┌─────────────┐        ┌──────────────┐        │
│  │   Firebase  │        │  Cloud Run   │        │
│  │   Hosting   │        │              │        │
│  │             │        │  ┌────────┐  │        │
│  │  Members    │───────►│  │ Portal │  │        │
│  │  Service    │  Auth  │  │ Service│  │        │
│  │  (test.html)│        │  └────┬───┘  │        │
│  └─────────────┘        │       │      │        │
│                         │       │      │        │
│  ┌─────────────┐        │       │      │        │
│  │ Cloud       │        │       │      │        │
│  │ Functions   │        │       │      │        │
│  │             │        │       ▼      │        │
│  │ handleKenni │        │  ┌────────┐  │        │
│  │ Auth        │        │  │ Cloud  │  │        │
│  │ (OAuth)     │        │  │  SQL   │  │        │
│  └─────────────┘        │  │ Postgre│  │        │
│                         │  │  SQL   │  │        │
│                         │  └────────┘  │        │
│                         └──────────────┘        │
│                                                  │
│  External:                                       │
│  Kenni.is (National eID) ──► handleKenniAuth    │
│                                                  │
└──────────────────────────────────────────────────┘
```

## 💰 Cost Estimate

### Current (Members only)
- Firebase Free Tier: $0/month
- Cloud Functions: $0/month (within free tier)
- Total: **$0/month**

### With Portal (after deployment)
- Firebase Free Tier: $0/month
- Cloud Functions: $0/month (within free tier)
- Cloud Run Portal: ~$0-5/month (depends on traffic)
- Cloud SQL db-f1-micro: ~$7-10/month
- Artifact Registry: ~$0.10/month
- Total: **~$7-15/month**

## 🔐 Security Configuration

### Secrets (Secret Manager)
- `portal-db-password` - PostgreSQL user password
- `portal-session-secret` - Flask session encryption key
- `kenni-client-secret` - Kenni.is OAuth client secret (existing)

### Database Access
- Cloud SQL uses Unix socket within Cloud Run
- No public IP access required
- Connection string: `/cloudsql/ekklesia-prod-10-2025:europe-west2:ekklesia-db`

### Authentication Flow
1. User visits Portal
2. Clicks "Login with Kenni.is"
3. Redirects to Firebase test.html OAuth flow
4. handleKenniAuth validates with Kenni.is
5. Returns custom Firebase token
6. Portal validates Firebase token
7. User is authenticated

## 📊 Next Steps After Deployment

1. **Custom Domain**: Map ekklesia.sosialistaflokkurinn.is to Portal
2. **Firebase Integration**: Connect Portal to Members service
3. **Voting Service**: Deploy voting service alongside Portal
4. **Data Migration**: Import existing members and propositions
5. **Testing**: Full end-to-end OAuth and voting flow
6. **Monitoring**: Set up Cloud Logging alerts

## 📝 Technical Details

### Portal Technology Stack
- **Framework**: Morepath (Python web framework)
- **Language**: Python 3.11
- **Database**: PostgreSQL 15
- **ORM**: SQLAlchemy 1.4
- **Migrations**: Alembic
- **Templates**: PyPugJS + Jinja2
- **Frontend**: Bootstrap 4 + htmx
- **Server**: Gunicorn (2 workers, 4 threads)

### Database Schema (24 migrations)
- User authentication and profiles
- Departments and groups
- Propositions and proposition types
- Arguments and argument relations
- Ballots and voting phases
- Voting modules (vvvote integration)
- Pages and customizable text
- Documents and uploads
- Full-text search (PostgreSQL tsvector)

### Container Configuration
- Base: python:3.11-slim
- User: ekklesia-portal (UID 10000)
- Port: 8080
- Health check: /health endpoint
- Entrypoint: Multi-command (serve/migrate/shell)
- Memory: 512 MB
- Timeout: 300 seconds
- Concurrency: 80 requests

## 🚨 Important Notes

1. **Cloud SQL Creation Time**: Typically 5-10 minutes, currently in progress
2. **First Deployment**: Will take ~5-10 minutes to build Docker image
3. **Database Migrations**: Run AFTER deployment succeeds
4. **Test Before Production**: Use test.html for initial authentication tests
5. **Backup Strategy**: Daily automated backups at 02:00 UTC

## 📞 Support Resources

- [Ekklesia Portal Documentation](https://docs.ekklesiademocracy.org)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud SQL Documentation](https://cloud.google.com/sql/docs)
- [PostgreSQL 15 Documentation](https://www.postgresql.org/docs/15/)
