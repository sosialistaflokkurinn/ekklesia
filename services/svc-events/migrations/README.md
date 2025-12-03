# Events Service - Database Migrations

This directory contains database migration scripts for the Events service.

## Overview

- **Database**: Cloud SQL PostgreSQL 15 (ekklesia-db)
- **IP Address**: 34.147.159.80
- **Project**: ekklesia-prod-10-2025
- **Region**: europe-west2 (London)
- **MVP Strategy**: Option A (Standalone) - No Elections service dependency

## Migration Files

### 001_initial_schema.sql (✅ Applied: 2025-10-09 11:44 UTC)
Initial database schema for Events service MVP (Option A: Standalone):
- `election` table: Stores election details (title, description, question, timeline)
- `voting_tokens` table: Stores one-time voting tokens with audit trail (kennitala → token_hash)
- Indexes for performance
- Seed data: One sample election for testing ("Prófunarkosning 2025")

**Applied using**: Local `psql` client with PGPASSWORD environment variable

### 002_remove_elections_service_id.sql (📋 Optional cleanup)
Remove Elections service integration field (Option A: Standalone):
- Removes `elections_service_id` column from `election` table (if it exists)
- This field is not needed for MVP (standalone mode)
- Elections service integration deferred to Phase 2

**Note**: This migration is optional - the field is nullable and unused in MVP.

### 003_seed_october_2025_election.sql (✅ Applied: 2025-10-19 19:44 UTC)
Seed deterministic election data for October 2025 integration tests:
- Clears previous seed state (`election` and `voting_tokens` tables)
- Inserts October 2025 rehearsal election with fixed UUID/timeline
- Ensures repeatable validation runs for Phase 5 ticket #84
- **Election ID**: `b322b1fd-83f6-4ff8-9ac5-1e5c6efa8b84`
- **Title**: "Kannanleik kosning October 2025"
- **Status**: published
- **Voting period**: 2025-10-18 09:00 UTC → 2025-10-20 21:00 UTC

**Applied using**: Cloud SQL Proxy + local `psql` client with PGPASSWORD from Secret Manager
**Run after**: `001_initial_schema.sql` (required) and `002_remove_elections_service_id.sql` (if applicable)

## How We Actually Ran Migrations (2025-10-09)

**Method Used**: Direct `psql` from local machine (gcloud CLI + psql installed)

### Prerequisites
1. Install PostgreSQL client:
   ```bash
   sudo dnf install postgresql -y  # Fedora
   ```

2. Authenticate with gcloud:
   ```bash
   gcloud auth login
   ```

3. Set postgres password and store in Secret Manager:
   ```bash
   PASSWORD=$(openssl rand -base64 32)
   gcloud sql users set-password postgres \
     --instance=ekklesia-db \
     --password="${PASSWORD}" \
     --project=ekklesia-prod-10-2025

   echo -n "${PASSWORD}" | gcloud secrets create postgres-password \
     --data-file=- \
     --project=ekklesia-prod-10-2025
   ```

### Running Migrations

```bash
# Set password from Secret Manager
PGPASSWORD='<password-from-secret-manager>'

# Run migration
PGPASSWORD="${PGPASSWORD}" psql \
  -h 34.147.159.80 \
  -U postgres \
  -d postgres \
  < events/migrations/001_initial_schema.sql

# Verify tables created
PGPASSWORD="${PGPASSWORD}" psql \
  -h 34.147.159.80 \
  -U postgres \
  -d postgres \
  -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
```

**Result**:
```
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
INSERT 0 1
```

### Alternative: GCP Cloud Shell (Not Used)

If you prefer Cloud Shell:
```bash
# Connect to Cloud SQL
gcloud sql connect ekklesia-db \
  --user=postgres \
  --project=ekklesia-prod-10-2025

# Run migration
\i 001_initial_schema.sql

# Verify
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
SELECT * FROM election;
```

## Verification Queries

After running migration, verify setup:

```sql
-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check election row
SELECT id, title, status, voting_starts_at, voting_ends_at
FROM election;

-- Check indexes
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Check constraints
SELECT conname, contype, conrelid::regclass
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
ORDER BY conrelid::regclass::text;

-- Check voting_tokens table (should be empty)
SELECT COUNT(*) FROM voting_tokens;
```

## Schema Details

### election Table
- Single election for MVP (one row inserted by migration)
- Status: 'draft', 'published', 'closed'
- Timeline: voting_starts_at, voting_ends_at
- **Note**: elections_service_id field removed (not needed for Option A: Standalone)

### voting_tokens Table
- One token per member (unique kennitala constraint)
- Token hash stored (SHA-256 of 32-byte random token)
- Audit trail: kennitala → token_hash mapping
- Expiration tracking
- Voted flag (updated by Elections service in Phase 2)

## Next Phase

After migration completes:
- **Phase 2**: Implement Node.js/Express API
- **Phase 3**: Testing with Firebase tokens
- **Phase 4**: Deploy to Cloud Run
