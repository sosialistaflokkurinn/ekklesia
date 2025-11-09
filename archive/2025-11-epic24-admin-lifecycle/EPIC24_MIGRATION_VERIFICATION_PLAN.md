# Epic #24 Migration Verification Plan

**Status**: Ready to Execute
**Date**: 2025-10-22
**Migration File**: `services/events/migrations/005_admin_audit_logging.sql`
**Purpose**: Verify all fixes work against real PostgreSQL 15 database

---

## Executive Summary

This document provides the exact steps to verify that the Epic #24 migration (with all critical fixes) successfully applies to the development database and creates the correct schema.

**Timeline**: 15-20 minutes to complete all verification steps

**Success Criteria**:
- ✅ Migration executes without errors
- ✅ All tables created
- ✅ All columns present and correct types
- ✅ All constraints enforced
- ✅ All indexes created
- ✅ Foreign keys work correctly
- ✅ Default values applied

---

## Phase 1: Pre-Migration Verification

### Step 1.1: Verify PostgreSQL Connection
```bash
# Test connection to development database
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "SELECT version();"
```

**Expected Output**:
```
PostgreSQL 15.1 (Debian 15.1-1.pgdg120+1) on x86_64-pc-linux-gnu, compiled by gcc (Debian 12.2.0-19) 12.2.0, 64-bit
```

**If Connection Fails**:
- Verify PostgreSQL is running: `sudo systemctl status postgresql`
- Check port 5432 is accessible: `nc -zv 127.0.0.1 5432`
- Verify credentials in `services/events/src/config/database.js`

---

### Step 1.2: Verify Current Schema
```bash
# List current tables in elections schema
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "\
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'elections'
  ORDER BY table_name;"
```

**Expected Tables Before Migration**:
- `elections` (from migration 004)
- `questions` (from migration 004)

**Save Pre-Migration State**:
```bash
# Export current schema structure for comparison
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "\
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'elections' AND table_name IN ('elections', 'questions')
  ORDER BY table_name, ordinal_position;" > /tmp/schema_before.txt

cat /tmp/schema_before.txt
```

---

### Step 1.3: Verify Elections Table Current State
```bash
# Check elections table columns
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "\
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'elections' AND table_name = 'elections'
  ORDER BY ordinal_position;"
```

**Expected Columns Before Migration**:
- `id` (INTEGER, PRIMARY KEY)
- `title` (VARCHAR)
- `description` (TEXT)
- `created_at` (TIMESTAMP)

---

## Phase 2: Execute Migration

### Step 2.1: Run Migration File
```bash
# Execute migration with transaction
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres \
  -f services/events/migrations/005_admin_audit_logging.sql
```

**Expected Output**:
```
BEGIN
ALTER TABLE
CREATE CONSTRAINT
CREATE INDEX
CREATE TABLE
GRANT
COMMIT
```

**If Migration Fails**:
- Check error message carefully
- Verify file syntax: `cat services/events/migrations/005_admin_audit_logging.sql | head -50`
- Run with `-v ON_ERROR_STOP=1` for early error detection:
  ```bash
  psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -f services/events/migrations/005_admin_audit_logging.sql
  ```

---

### Step 2.2: Verify No Errors
```bash
# Check PostgreSQL logs for errors
tail -50 /var/log/postgresql/postgresql*.log | grep -i error
```

**Expected**: No error messages related to the migration

---

## Phase 3: Post-Migration Verification

### Step 3.1: Verify Tables Created

```bash
# List all tables in elections schema
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "\
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'elections'
  ORDER BY table_name;"
```

**Expected Tables After Migration**:
```
admin_audit_log
ballots
elections
questions
voting_tokens
```

✅ **Verification**: Should have 5 tables (2 from migration 004 + 3 new + 2 extended)

---

### Step 3.2: Verify Elections Table Columns

```bash
# Check all columns in elections table
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "\
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'elections' AND table_name = 'elections'
  ORDER BY ordinal_position;"
```

**Expected Columns After Migration**:
```
id                    | integer
title                 | character varying
description           | text
created_at            | timestamp without time zone
admin_id              | character varying
status                | character varying (DEFAULT 'draft')
voting_start_time     | timestamp without time zone
voting_end_time       | timestamp without time zone
published_at          | timestamp without time zone
closed_at             | timestamp without time zone
archived_at           | timestamp without time zone
deleted_at            | timestamp without time zone
created_by            | character varying
```

✅ **Verification**: All 13 columns present with correct types and defaults

---

### Step 3.3: Verify Voting Tokens Columns

```bash
# Check voting_tokens table columns
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "\
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'elections' AND table_name = 'voting_tokens'
  ORDER BY ordinal_position;"
```

**Expected Columns After Migration**:
```
token_hash         | character varying
issued_at          | timestamp without time zone
expires_at         | timestamp without time zone
election_id        | integer
member_id          | character varying
used               | boolean (DEFAULT false)
created_at         | timestamp without time zone (DEFAULT now())
```

✅ **Verification**: All 7 columns present

---

### Step 3.4: Verify Admin Audit Log Table

```bash
# Check admin_audit_log table definition
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "\
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'elections' AND table_name = 'admin_audit_log'
  ORDER BY ordinal_position;"
```

**Expected Columns**:
```
id                  | integer (PRIMARY KEY)
action_type         | character varying
performed_by        | character varying
election_id         | integer
election_title      | character varying
details             | jsonb
ip_address          | inet
timestamp           | timestamp without time zone (DEFAULT now())
correlation_id      | character varying
```

✅ **Verification**: All 9 columns present with JSONB and INET types

---

### Step 3.5: Verify Ballots Table

```bash
# Check ballots table definition
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "\
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'elections' AND table_name = 'ballots'
  ORDER BY ordinal_position;"
```

**Expected Columns**:
```
id              | integer (PRIMARY KEY)
election_id     | integer (NOT NULL)
answer          | character varying (NOT NULL)
token_hash      | character varying
cast_at         | timestamp without time zone (DEFAULT now())
```

✅ **Verification**: All 5 columns present

---

### Step 3.6: Verify Constraints

```bash
# List all constraints in elections schema
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "\
  SELECT conname, contype, conrelid::regclass
  FROM pg_constraint
  WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'elections')
  ORDER BY conrelid::regclass::text, conname;"
```

**Expected Constraints**:
```
admin_audit_log         | pk (PRIMARY KEY)
voting_tokens           | fk_voting_tokens_election_id (FOREIGN KEY)
voting_tokens           | unique_election_member_token (UNIQUE)
elections               | valid_admin_status (CHECK)
admin_audit_log         | fk_audit_election_id (FOREIGN KEY)
ballots                 | fk_ballots_election_id (FOREIGN KEY)
```

✅ **Verification**: All 6 constraints present

---

### Step 3.7: Verify Indexes

```bash
# List all indexes in elections schema
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "\
  SELECT indexname, tablename
  FROM pg_indexes
  WHERE schemaname = 'elections'
  ORDER BY tablename, indexname;"
```

**Expected Indexes**:
```
idx_elections_created_at              | elections
idx_elections_created_by              | elections
idx_elections_status                  | elections
idx_elections_admin                   | elections
idx_elections_voting_period           | elections
idx_voting_tokens_election_id         | voting_tokens
idx_voting_tokens_member_id           | voting_tokens
idx_voting_tokens_used                | voting_tokens
idx_voting_tokens_election_used       | voting_tokens
idx_audit_log_admin                   | admin_audit_log
idx_audit_log_election                | admin_audit_log
idx_audit_log_action                  | admin_audit_log
idx_audit_log_timestamp               | admin_audit_log
idx_audit_log_correlation             | admin_audit_log
idx_audit_log_admin_election_time     | admin_audit_log
idx_ballots_election                  | ballots
idx_ballots_election_answer           | ballots
idx_ballots_token_hash                | ballots
idx_ballots_cast_at                   | ballots
```

✅ **Verification**: All 20 indexes present

---

### Step 3.8: Verify Default Values

```bash
# Check status constraint on elections table
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "\
  SELECT conname, pg_get_constraintdef(oid)
  FROM pg_constraint
  WHERE conrelid = 'elections.elections'::regclass
    AND conname = 'valid_admin_status';"
```

**Expected**:
```
valid_admin_status | CHECK ((status = ANY (ARRAY['draft'::character varying, 'published'::character varying, 'open'::character varying, 'closed'::character varying, 'paused'::character varying, 'archived'::character varying, 'deleted'::character varying])))
```

✅ **Verification**: Status constraint enforces valid values

---

### Step 3.9: Test Foreign Key Constraints

```bash
# Test FK constraint: elections → admin_audit_log
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "\
  INSERT INTO elections.admin_audit_log (action_type, performed_by, election_id)
  VALUES ('test', 'user123', 99999);"
```

**Expected Error**:
```
ERROR: insert or update on table "admin_audit_log" violates foreign key constraint "fk_audit_election_id"
DETAIL: Key (election_id)=(99999) is not present in table "elections".
```

✅ **Verification**: Foreign key constraint enforced correctly

---

### Step 3.10: Test Type Consistency

```bash
# Verify election_id types are consistent
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "\
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'elections'
    AND column_name = 'election_id'
  ORDER BY table_name;"
```

**Expected Output**:
```
admin_audit_log     | election_id  | integer
ballots             | election_id  | integer
voting_tokens       | election_id  | integer
```

✅ **Verification**: All election_id columns are INTEGER type

---

## Phase 4: Endpoint Testing (Quick Smoke Test)

### Step 4.1: Start Events Service Locally (Optional)

If you want to test the endpoints:

```bash
# Install dependencies
cd services/events
npm install

# Set environment variables for local testing
export DATABASE_HOST=127.0.0.1
export DATABASE_PORT=5432
export DATABASE_NAME=postgres
export DATABASE_USER=postgres
export DATABASE_PASSWORD=yourpassword

# Start service
npm start
```

---

### Step 4.2: Test Token Generation Endpoint

```bash
# Get test token from Firebase (if available)
TOKEN="eyJhbGciOiJSUzI1NiIsImtpZCI6IjlkMjEzMGZl..."

# Create election first
curl -X POST http://localhost:3000/api/admin/elections \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Election",
    "description": "Testing token generation",
    "answers": ["Yes", "No"]
  }'

# Response should have election ID, e.g., id: 1

# Open voting with token generation
curl -X POST http://localhost:3000/api/admin/elections/1/open \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "member_count": 5
  }'
```

**Expected Response**:
```json
{
  "message": "Election opened for voting",
  "election": {
    "id": 1,
    "status": "open",
    "voting_start_time": "2025-10-22T16:30:00Z"
  },
  "tokens_generated": 5,
  "tokens": [
    {
      "token": "aBc123XyZ...",
      "expires_at": "2025-10-23T16:30:00Z"
    },
    ...
  ]
}
```

✅ **Verification**: Tokens returned in response

---

### Step 4.3: Verify Audit Logging

```bash
# Check audit log was created
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "\
  SELECT action_type, performed_by, election_id, details, ip_address
  FROM elections.admin_audit_log
  ORDER BY timestamp DESC
  LIMIT 5;"
```

**Expected Output**:
```
action_type | performed_by | election_id | details | ip_address
create      | user123      | 1           | {...}   | 127.0.0.1
open        | user123      | 1           | {...}   | 127.0.0.1
```

✅ **Verification**: Audit logs written to database

---

## Phase 5: Cleanup & Documentation

### Step 5.1: Delete Test Data (Optional)

```bash
# Clean up test data
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "\
  DELETE FROM elections.admin_audit_log;
  DELETE FROM elections.ballots;
  DELETE FROM elections.voting_tokens;
  DELETE FROM elections.elections;"
```

---

### Step 5.2: Save Verification Results

```bash
# Export schema after migration
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "\
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'elections'
  ORDER BY table_name, ordinal_position;" > /tmp/schema_after.txt

# Compare before and after
diff /tmp/schema_before.txt /tmp/schema_after.txt
```

---

### Step 5.3: Document Migration Success

Create a migration verification report:

```bash
cat > docs/status/EPIC24_MIGRATION_VERIFICATION_RESULTS.md << 'EOF'
# Epic #24 Migration Verification Results

**Date**: $(date -u +%Y-%m-%d)
**Migration File**: 005_admin_audit_logging.sql
**Database**: PostgreSQL 15.1 (ekklesia-db)
**Status**: ✅ VERIFIED

## Summary
All migration verification steps completed successfully:
- [x] Migration executed without errors
- [x] All 5 tables created (admin_audit_log, ballots, elections, questions, voting_tokens)
- [x] All columns created with correct types
- [x] All constraints enforced (6 total)
- [x] All indexes created (20 total)
- [x] Foreign key relationships working
- [x] Default values applied

## Schema Verification
EOF
cat /tmp/schema_after.txt >> docs/status/EPIC24_MIGRATION_VERIFICATION_RESULTS.md
```

---

## Troubleshooting Guide

### Problem: Connection Refused
```
psql: error: could not connect to server: Connection refused
```

**Solution**:
1. Start PostgreSQL: `sudo systemctl start postgresql`
2. Check port: `sudo ss -tulpn | grep 5432`
3. Verify credentials

### Problem: Migration Syntax Error
```
ERROR:  syntax error at or near "("
```

**Solution**:
1. Migration has invalid SQL syntax
2. Check file: `head -50 services/events/migrations/005_admin_audit_logging.sql`
3. Re-run with debug: `psql ... -v ON_ERROR_STOP=1`
4. Verify against error location in file

### Problem: Table Already Exists
```
ERROR:  table "admin_audit_log" already exists
```

**Solution**:
1. Migration was already applied
2. Verify: `psql ... -c "\dt elections.*"`
3. If need to re-run:
   ```bash
   # Drop tables and re-apply (⚠️ CAUTION: Data loss!)
   psql ... -c "DROP TABLE elections.admin_audit_log, elections.ballots CASCADE;"
   psql ... -f services/events/migrations/005_admin_audit_logging.sql
   ```

### Problem: Foreign Key Constraint Fails
```
ERROR: insert or update on table "voting_tokens" violates foreign key constraint
```

**Solution**:
1. Check type mismatch between election_id columns
2. Verify: `psql ... -c "SELECT column_name, data_type FROM information_schema.columns WHERE column_name = 'election_id'"`
3. All should be INTEGER

---

## Success Checklist

Print this and mark off each step as you complete it:

```
PRE-MIGRATION
□ PostgreSQL connection working
□ Current schema verified
□ Pre-migration state saved

MIGRATION
□ Migration file executed successfully
□ No errors in PostgreSQL logs

POST-MIGRATION
□ All 5 tables created
□ Elections table has 13 columns
□ Voting tokens table has 7 columns
□ Admin audit log table has 9 columns
□ Ballots table has 5 columns
□ All 6 constraints enforced
□ All 20 indexes created
□ Foreign keys working (tested)
□ Type consistency verified
□ Default values applied

ENDPOINT TESTING (OPTIONAL)
□ Token generation endpoint working
□ Audit logs written to database
□ Test data cleaned up

DOCUMENTATION
□ Verification results saved
□ Schema comparison completed
□ Migration marked as verified
```

---

## Next Steps After Verification

1. **Deploy to Staging** (if verification passes)
   ```bash
   gcloud sql instances patch ekklesia-db \
     --project=ekklesia-prod-10-2025 \
     --enable-bin-log  # For replication/backup
   ```

2. **Run Integration Tests**
   - Test all 8 admin endpoints
   - Verify transaction behavior
   - Verify audit logging for all actions

3. **Load Testing**
   - Test 300 votes/second spike
   - Monitor connection pool
   - Monitor database performance

4. **Code Review**
   - Review fixed admin.js
   - Verify token return implementation
   - Verify audit logging integration

---

**Document**: EPIC24_MIGRATION_VERIFICATION_PLAN.md
**Status**: Ready to Execute
**Last Updated**: 2025-10-22
