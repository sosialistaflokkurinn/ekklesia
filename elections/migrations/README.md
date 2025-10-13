# Elections Service Database Migrations

**Database**: ekklesia-db (Cloud SQL PostgreSQL 15)
**Schema**: elections (separate from events schema)
**Purpose**: Anonymous ballot recording

---

## Running Migrations

### Local Development (via Cloud SQL Proxy)

```bash
# 1. Start Cloud SQL Proxy (if not already running)
~/bin/cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:ekklesia-db --port 5433

# 2. Get database password from Secret Manager
export PGPASSWORD=$(gcloud secrets versions access latest \
  --secret=postgres-password \
  --project=ekklesia-prod-10-2025)

# 3. Run migration
psql -h 127.0.0.1 -p 5433 -U postgres -d postgres \
  -f migrations/001_initial_schema.sql

# 4. Verify schema created
psql -h 127.0.0.1 -p 5433 -U postgres -d postgres \
  -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'elections';"
```

### Production (Direct Connection)

```bash
# Get database password
export PGPASSWORD=$(gcloud secrets versions access latest \
  --secret=postgres-password \
  --project=ekklesia-prod-10-2025)

# Run migration (requires authorized network or Cloud SQL Proxy)
psql -h 34.147.159.80 -U postgres -d postgres \
  -f migrations/001_initial_schema.sql
```

---

## Migrations

### 001_initial_schema.sql

**Status**: ✅ Ready
**Created**: 2025-10-09
**Purpose**: Initial Elections service schema

**Tables**:
- `elections.voting_tokens` - One-time tokens from Events service
- `elections.ballots` - Anonymous ballot records
- `elections.audit_log` - System audit trail (no PII)

**Key Features**:
- Separate schema (elections) for isolation from events schema
- UNIQUE constraint on token_hash (one vote per token)
- CHECK constraint on answer (yes/no/abstain only)
- Foreign key to ensure token exists before ballot
- Timestamp rounding (nearest minute for anonymity)
- Indexes for performance (used flag, answer counts)

---

## Verification

### Check Schema Exists

```sql
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name = 'elections';
```

### Check Tables

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'elections';
```

**Expected**: `voting_tokens`, `ballots`, `audit_log`

### Check Indexes

```sql
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'elections';
```

### Sample Data (Testing Only)

```sql
-- Register test token (simulate S2S call from Events)
INSERT INTO elections.voting_tokens (token_hash)
VALUES ('a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef');

-- Submit test ballot
INSERT INTO elections.ballots (token_hash, answer)
VALUES ('a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef', 'yes');

-- Mark token as used
UPDATE elections.voting_tokens
SET used = TRUE, used_at = NOW()
WHERE token_hash = 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef';

-- Verify
SELECT * FROM elections.voting_tokens;
SELECT * FROM elections.ballots;
```

---

## Rollback (If Needed)

```sql
-- Drop schema and all tables
DROP SCHEMA IF EXISTS elections CASCADE;
```

**Warning**: This deletes all ballots! Only use in development.

---

## Schema Isolation

The Elections service uses a separate schema (`elections`) to isolate data from the Events service:

- **Events schema**: `public` (default) - election metadata, token audit trail, member audit
- **Elections schema**: `elections` - voting tokens, ballots (no PII)

**Benefits**:
- Logical separation (different services)
- Easier access control (GRANT on schema level)
- Same database instance (cost optimization)
- Clear data ownership

---

## Performance Notes

### Indexes

All critical queries are indexed:
- `voting_tokens.used` - Fast lookup for available tokens
- `ballots.answer` - Fast results tabulation (GROUP BY answer)
- `ballots.token_hash` - Fast duplicate check
- `audit_log.timestamp DESC` - Fast recent logs query

### Constraints

- `UNIQUE(token_hash)` on ballots - Prevents double voting at database level
- `CHECK(answer IN (...))` - Ensures valid answers only
- `FOREIGN KEY` to voting_tokens - Ensures token exists

### Connection Pool

Elections service should use **2 connections per Cloud Run instance**:
- 1 for read queries (token validation, results)
- 1 for write transactions (ballot submission)

With 100 max instances = 200 total connections (requires db-g1-small for large meetings)

---

## Related Documentation

- [docs/design/ELECTIONS_SERVICE_MVP.md](../../docs/design/ELECTIONS_SERVICE_MVP.md) - Service design
- [docs/USAGE_CONTEXT.md](../../docs/USAGE_CONTEXT.md) - Load patterns (300 votes/sec)
- [docs/OPERATIONAL_PROCEDURES.md](../../docs/OPERATIONAL_PROCEDURES.md) - Meeting day operations
