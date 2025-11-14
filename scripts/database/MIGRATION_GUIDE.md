# Database Migration Quick Reference

**Last Updated**: 2025-11-10
**Issue**: #248 - Discovered during migration 004 deployment

---

## ⚡ Quick Start - Run Migration

```bash
# 1. Start proxy with --gcloud-auth flag (IMPORTANT!)
cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:ekklesia-db \
  --port 5433 \
  --gcloud-auth &

# 2. Wait for proxy to start
sleep 4

# 3. Run migration
./scripts/database/psql-cloud.sh -f services/elections/migrations/XXX_your_migration.sql

# 4. Verify migration
./scripts/database/psql-cloud.sh -c "\d elections.your_table"

# 5. Stop proxy when done
pkill -f "cloud-sql-proxy.*5433"
```

---

## ❗ Critical: Always Use --gcloud-auth

**Why**: Application Default Credentials (ADC) may have wrong `quota_project_id`, causing 403 permission errors.

**Without flag** (❌ FAILS):
```bash
cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:ekklesia-db --port 5433
# Error: 403 NOT_AUTHORIZED - cloudsql.instances.get permission denied
```

**With --gcloud-auth** (✅ WORKS):
```bash
cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:ekklesia-db --port 5433 --gcloud-auth
# Authorizing with gcloud user credentials
# The proxy has started successfully!
```

---

## 🔍 Troubleshooting 403 Errors

### Symptom
```
failed to get instance metadata: googleapi: Error 403: boss::NOT_AUTHORIZED:
Not authorized to access resource. Possibly missing permission cloudsql.instances.get
```

### Root Cause
ADC file at `~/.config/gcloud/application_default_credentials.json` has wrong `quota_project_id`:
```json
{
  "quota_project_id": "fedora-setup-secrets",  // ❌ Wrong project!
  ...
}
```

### Solution 1: Use --gcloud-auth (Recommended)
```bash
cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:ekklesia-db \
  --port 5433 \
  --gcloud-auth
```

### Solution 2: Fix ADC Permanently
```bash
# Edit ADC file
nano ~/.config/gcloud/application_default_credentials.json

# Change quota_project_id to:
"quota_project_id": "ekklesia-prod-10-2025"
```

---

## 📋 Complete Migration Workflow

### Step 1: Pre-Migration Checks
```bash
# Verify gcloud authentication
gcloud auth list
gcloud config get-value project  # Should show: ekklesia-prod-10-2025

# Check current database schema
./scripts/database/start-proxy.sh  # Uses --gcloud-auth automatically
./scripts/database/psql-cloud.sh
postgres=> \dn                     # List schemas
postgres=> \dt elections.*         # List tables
postgres=> \q
```

### Step 2: Test Migration Locally (Optional)
```bash
# Run migration on local test database first
psql -h localhost -p 5432 -U postgres -d test_db -f services/elections/migrations/XXX_migration.sql

# Verify locally
psql -h localhost -p 5432 -U postgres -d test_db -c "\d elections.your_table"
```

### Step 3: Run Production Migration
```bash
# Start proxy (already updated to use --gcloud-auth)
./scripts/database/start-proxy.sh

# Or start manually:
cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:ekklesia-db --port 5433 --gcloud-auth &
sleep 4

# Run migration
./scripts/database/psql-cloud.sh -f services/elections/migrations/XXX_migration.sql

# Expected output:
# SET
# ALTER TABLE
# CREATE INDEX
# CREATE FUNCTION
# ...
```

### Step 4: Verify Migration
```bash
# Check table structure
./scripts/database/psql-cloud.sh -c "\d elections.your_table"

# Check indexes
./scripts/database/psql-cloud.sh -c "\di elections.*"

# Check functions
./scripts/database/psql-cloud.sh -c "\df elections.*"

# Test with sample query
./scripts/database/psql-cloud.sh -c "SELECT COUNT(*) FROM elections.your_table;"
```

### Step 5: Cleanup
```bash
# Stop proxy
pkill -f "cloud-sql-proxy.*5433"

# Commit migration file (if new)
git add services/elections/migrations/XXX_migration.sql
git commit -m "feat(elections): Add migration XXX - Description"
```

---

## 📝 Migration Best Practices

### DO ✅
- Always use `--gcloud-auth` flag with cloud-sql-proxy
- Test migrations on local database first
- Use `IF NOT EXISTS` for idempotent migrations
- Add comments to migration SQL for documentation
- Verify migration with `\d` commands before closing connection
- Use transactions for complex multi-step migrations

### DON'T ❌
- Don't rely on ADC credentials (use --gcloud-auth)
- Don't run migrations without testing first
- Don't forget to verify after migration completes
- Don't leave proxy running when not in use
- Don't run destructive migrations without backups

### Migration SQL Template
```sql
-- Migration: XXX - Description
-- Database: ekklesia-db (PostgreSQL 15)
-- Schema: elections
-- Created: YYYY-MM-DD
-- Purpose: Brief description

-- Set search path
SET search_path TO elections, public;

-- Use IF NOT EXISTS for idempotency
ALTER TABLE your_table
ADD COLUMN IF NOT EXISTS new_column VARCHAR(128);

-- Add comments
COMMENT ON COLUMN your_table.new_column IS 'Description of purpose';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_name
ON your_table(new_column);

-- Reset search path
SET search_path TO public;
```

---

## 🔗 Related Documentation

- [Full Database Scripts README](./README.md) - Complete documentation
- [Elections Service Migrations](../../services/elections/migrations/) - All migration files
- [Operational Procedures](../../docs/operations/OPERATIONAL_PROCEDURES.md) - Deployment workflows

---

## 📚 Historical Context

This guide was created after encountering 403 permission errors during migration 004 deployment (Issue #248). The root cause was Application Default Credentials having `quota_project_id` set to a different GCP project (`fedora-setup-secrets` instead of `ekklesia-prod-10-2025`).

**Deep Investigation Results**:
1. User had OWNER role on project ✓
2. `gcloud auth` was authenticated ✓
3. ADC had wrong quota_project_id ✗
4. Solution: `--gcloud-auth` flag forces use of gcloud user credentials

This documentation ensures we don't need another deep investigation for future migrations.
