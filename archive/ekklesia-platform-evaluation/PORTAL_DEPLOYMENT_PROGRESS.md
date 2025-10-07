# Ekklesia Portal - Deployment Progress Report

**Date**: 2025-10-07
**Status**: 🟡 Partially Complete - Portal Running, Migrations Blocked

## ✅ Successfully Completed

### 1. Infrastructure
- ✅ Cloud SQL PostgreSQL 15 instance created (`ekklesia-db`)
- ✅ Database `ekklesia_portal` created
- ✅ User `ekklesia_portal` created
- ✅ Secrets created in Secret Manager
- ✅ Artifact Registry ready

### 2. Portal Service Deployment
- ✅ Dockerfile created with Python 3.11
- ✅ Container image built successfully
- ✅ Portal service deployed to Cloud Run
- ✅ **Service URL**: https://portal-ymzrguoifa-nw.a.run.app

### 3. Configuration
- ✅ Production config file ([portal/config.production.yml](portal/config.production.yml))
- ✅ Deployment scripts created
- ✅ Documentation created

## 🟡 In Progress / Blocked

### Database Migrations
- **Status**: Blocked by dependency issues
- **Issue**: Portal uses Poetry with a complex dependency tree
- **Root Cause**: ekklesia-common has many transitive dependencies (pypugjs, case-conversion, pytest, etc.)
- **Current Approach**: Manually installing dependencies in Dockerfile
- **Dependencies Resolved**: pyyaml, pytz, zope.sqlalchemy
- **Dependencies Missing**: case-conversion (and likely more)

### Migration Error
```
File "/usr/local/lib/python3.11/site-packages/ekklesia_common/cell.py", line 6, in <module>
    import case_conversion
ModuleNotFoundError: No module named 'case_conversion'
```

## 📊 Current State

### Cloud SQL Database
```
Instance: ekklesia-db
Status: RUNNABLE
Version: PostgreSQL 15
Tier: db-f1-micro (614 MB RAM)
Region: europe-west2
Connection: ekklesia-prod-10-2025:europe-west2:ekklesia-db
```

### Portal Service
```
Name: portal
Status: DEPLOYED
URL: https://portal-ymzrguoifa-nw.a.run.app
Image: europe-west2-docker.pkg.dev/ekklesia-prod-10-2025/ekklesia/portal:latest
Memory: 512 MB
CPU: 1
Region: europe-west2
```

### Database Schema
```
Status: NOT MIGRATED
Alembic Migrations: 24 pending
Tables: 0 (empty database)
```

## 🔧 Next Steps

### Option 1: Continue Manual Dependency Resolution (Current Approach)
1. Add case-conversion to Dockerfile
2. Redeploy and test migrations
3. Repeat for any additional missing dependencies
4. **Time Estimate**: 30-60 minutes (many dependency iterations)

### Option 2: Use Poetry Properly
1. Fix poetry.lock to use PyYAML 6.0+
2. Use `poetry export` to generate requirements.txt
3. Install from requirements.txt in Dockerfile
4. **Time Estimate**: 15-30 minutes

### Option 3: Copy Working Nix Build
1. Use the existing [portal/nix/docker.nix](portal/nix/docker.nix)
2. Build container locally with Nix
3. Push to Artifact Registry
4. Deploy to Cloud Run
5. **Time Estimate**: 45-60 minutes (requires Nix setup)

### Option 4: Skip Migrations for Now
1. Test Portal service without database (static pages)
2. Focus on Members/Portal integration first
3. Return to migrations later with proper dependency resolution
4. **Time Estimate**: Immediate

## 💡 Recommendation

**Option 2** is the cleanest long-term solution:
- Properly handle all Poetry dependencies
- Generate clean requirements.txt
- Faster builds (no git clones)
- Easier to maintain

**Immediate Next Steps**:
```bash
# 1. Fix poetry.lock locally (if you have poetry installed)
poetry lock --no-update

# 2. Export to requirements.txt
poetry export -f requirements.txt --output requirements.txt --without-hashes --only main

# 3. Update Dockerfile to use requirements.txt:
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 4. Redeploy
./deploy-to-cloud-run.sh
```

## 📁 Files Modified

### New Files (Committed)
- [portal/Dockerfile](portal/Dockerfile) - Production container (simplified, needs work)
- [portal/.dockerignore](portal/.dockerignore)
- [portal/entrypoint.sh](portal/entrypoint.sh)
- [portal/config.production.yml](portal/config.production.yml)
- [portal/.env.production.example](portal/.env.production.example)
- [portal/deploy-to-cloud-run.sh](portal/deploy-to-cloud-run.sh)
- [portal/setup-database.sh](portal/setup-database.sh)
- [portal/run-migrations.sh](portal/run-migrations.sh)
- [portal/DEPLOYMENT.md](portal/DEPLOYMENT.md)
- [PORTAL_DEPLOYMENT_STATUS.md](PORTAL_DEPLOYMENT_STATUS.md)

### Modified (Not Committed)
- [portal/Dockerfile](portal/Dockerfile) - Multiple iterations for dependency fixes

## 🎯 Success Criteria

To consider Portal deployment complete, we need:
- ✅ Portal service running on Cloud Run
- ❌ Database schema migrated (24 Alembic migrations)
- ❌ Portal accessible and serving pages
- ❌ Authentication integration with Members service
- ❌ Health check passing

## 📝 Lessons Learned

1. **Poetry + Cloud Build = Complex**: Poetry's dependency resolution can be tricky in containerized environments
2. **PyYAML 5.4.1 Issue**: Common problem - doesn't support PEP 517 builds
3. **Transitive Dependencies**: ekklesia-common has many unlisted dependencies
4. **Nix Build Works**: The original Nix-based build likely handles all dependencies correctly
5. **Test Locally First**: Should have tested Docker build locally before deploying

## 💰 Costs So Far

- Cloud SQL: ~$7-10/month (db-f1-micro)
- Cloud Run Portal: $0/month so far (no traffic, within free tier)
- Cloud Build: ~$0.01 (multiple builds)
- **Total**: ~$7-10/month estimated

## 🔗 Resources

- Portal Service: https://portal-ymzrguoifa-nw.a.run.app
- Cloud Console: https://console.cloud.google.com/run/detail/europe-west2/portal?project=ekklesia-prod-10-2025
- Ekklesia Portal Repo: https://github.com/edemocracy/ekklesia-portal
- Ekklesia Common Repo: https://github.com/edemocracy/ekklesia-common
