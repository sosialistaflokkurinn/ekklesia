# Cloud SQL Migration: europe-west2 → europe-west1

**Date:** 2025-12-21
**Author:** Guðrún (via Claude Code)
**Status:** REQUIRES ACTION

## Summary

The Django Cloud SQL database has been migrated from `europe-west2` (London) to `europe-west1` (Belgium) to enable domain mapping for `starf.sosialistaflokkurinn.is`.

## What Changed

| Component | Old Value | New Value |
|-----------|-----------|-----------|
| Cloud SQL Instance | `ekklesia-db` | `ekklesia-db-eu1` |
| Region | `europe-west2` (London) | `europe-west1` (Belgium) |
| Connection String | `ekklesia-prod-10-2025:europe-west2:ekklesia-db` | `ekklesia-prod-10-2025:europe-west1:ekklesia-db-eu1` |

## Why This Was Done

- GCP Domain Mapping is not supported in `europe-west2` (London)
- The custom domain `starf.sosialistaflokkurinn.is` requires `europe-west1`
- Cloud Run (Django) was already in `europe-west1`, but Cloud SQL was in `europe-west2`
- Cross-region Cloud SQL socket connections don't work

## Action Required

### 1. Update `scripts/deployment/set-env.sh`

```bash
# Change FROM:
export REGION="europe-west2"
export DB_INSTANCE="ekklesia-db"

# Change TO:
export REGION="europe-west1"
export DB_INSTANCE="ekklesia-db-eu1"
```

### 2. Files That May Need Review

The following files reference `ekklesia-db` or `europe-west2`:

**Critical (update connection strings):**
- `scripts/deployment/set-env.sh` - Central config
- `services/svc-events/deploy.sh` - Events service deployment
- `services/svc-events/src/config/config-database.js` - Database config

**Documentation (update for accuracy):**
- `CLAUDE.md` - Line 39: "Cloud SQL PostgreSQL (europe-west2)"
- `docs/ARCHITECTURE.md`
- `docs/PATTERNS-GCP.md`

### 3. Test After Update

```bash
# Start proxy with new connection
source scripts/deployment/set-env.sh
cloud-sql-proxy $DB_CONNECTION_NAME --port 5433 --gcloud-auth

# Verify connection
psql -h 127.0.0.1 -p 5433 -U socialism -d socialism -c "SELECT 1;"
```

## Old Instance Status

The old instance `ekklesia-db` in `europe-west2` should be deleted after confirming everything works:

```bash
gcloud sql instances delete ekklesia-db --project=ekklesia-prod-10-2025
```

## Backup

Migration export file preserved at:
```
gs://ekklesia-prod-10-2025-db-backups/migration_20251221_0210.sql
```

## Related

- Django CLAUDE.md updated with correct region
- Cloud Run `django-socialism` updated to use new connection
- Domain `starf.sosialistaflokkurinn.is` now works correctly
