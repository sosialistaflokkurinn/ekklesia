# How to Apply Migration 006

**Migration**: 006_add_question_column.sql
**Purpose**: Add missing `question` column to elections table
**Status**: ⏳ Ready to apply
**Discovered**: 2025-10-23 during Epic #24 testing

---

## Quick Apply (Cloud Console - Easiest)

1. Go to: https://console.cloud.google.com/sql/instances/ekklesia-db/query?project=ekklesia-prod-10-2025

2. Copy the SQL from `006_add_question_column.sql`:

```sql
BEGIN;

ALTER TABLE elections.elections
  ADD COLUMN IF NOT EXISTS question TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN elections.elections.question IS
  'The main question being asked in this election (e.g., "Should we approve the budget?")';

COMMIT;
```

3. Click "Run" in Cloud Console

4. Verify:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'elections' AND table_name = 'elections' AND column_name = 'question';
```

Should return: `question`

---

## Via Cloud SQL Proxy (Recommended for local development)

### Option 1: If proxy is already running

```bash
PGPASSWORD="ZmUmDgn3Gz4KMofqDgO6SPba/miLApDsIN9JggFP2Ic=" \
  psql -h 127.0.0.1 -p 5433 -U postgres -d postgres \
  -f services/events/migrations/006_add_question_column.sql
```

### Option 2: Start proxy first

```bash
# Start Cloud SQL Proxy
/home/gudro/bin/cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:ekklesia-db \
  --port 5433 > /tmp/cloud-sql-proxy.log 2>&1 &

# Wait for it to be ready
sleep 3

# Apply migration
PGPASSWORD="ZmUmDgn3Gz4KMofqDgO6SPba/miLApDsIN9JggFP2Ic=" \
  psql -h 127.0.0.1 -p 5433 -U postgres -d postgres \
  -f services/events/migrations/006_add_question_column.sql
```

**If you get authentication errors:**
```bash
# Refresh Application Default Credentials
gcloud auth application-default login
```

---

## Verify Migration Worked

### Test 1: Check column exists
```bash
PGPASSWORD="ZmUmDgn3Gz4KMofqDgO6SPba/miLApDsIN9JggFP2Ic=" \
  psql -h 127.0.0.1 -p 5433 -U postgres -d postgres \
  -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'elections' AND table_name = 'elections' AND column_name = 'question';"
```

Expected output:
```
 column_name | data_type
-------------+-----------
 question    | text
```

### Test 2: Create election via API
```bash
curl -X POST "https://events-service-ymzrguoifa-nw.a.run.app/api/admin/elections" \
  -H "Authorization: Bearer YOUR_DEVELOPER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Post-Migration",
    "description": "Verify migration 006 worked",
    "question": "Did the migration work?",
    "answers": ["yes", "no"]
  }' | jq '.'
```

Expected: Should return election object with ID (not 500 error)

---

## Troubleshooting

### Error: "connection to server ... failed: Connection timed out"
**Cause**: Direct IP connection not allowed (requires SSL certificates)
**Solution**: Use Cloud SQL Proxy (see above)

### Error: "invalid_grant", "reauth related error"
**Cause**: Application Default Credentials expired
**Solution**: Run `gcloud auth application-default login`

### Error: "column 'question' of relation 'elections' does not exist" (after migration)
**Cause**: Migration not applied yet or applied to wrong database
**Solution**:
1. Verify you're connected to the right database: `SELECT current_database();`
2. Check if column exists: `\d elections.elections`
3. Re-apply migration if needed

---

## After Migration

1. **Test Epic #24 create endpoint** - should now work
2. **Update status** in `docs/troubleshooting/SCHEMA_MISMATCH_EPIC_24_2025-10-23.md`
3. **Git commit** migration 006 if not already committed
4. **Close GitHub issue** or update with migration applied

---

**Created**: 2025-10-23
**Related**:
- [Schema Mismatch Doc](../../../docs/troubleshooting/SCHEMA_MISMATCH_EPIC_24_2025-10-23.md)
- [GitHub Issue #96](https://github.com/sosialistaflokkurinn/ekklesia/issues/96)
- [Migration 006](./006_add_question_column.sql)
