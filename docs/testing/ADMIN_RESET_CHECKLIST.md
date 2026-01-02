# Admin Reset Test Checklist - October 2025 Election

**Purpose**: Validate admin reset functionality against fresh seed data (migration 003)
**Target**: Phase 5 validation for ticket #84 (issues #71-#79)
**Election**: "Kannanleik kosning October 2025" (ID: `b322b1fd-83f6-4ff8-9ac5-1e5c6efa8b84`)
**Test Date**: ________________
**Tester**: ________________

---

## Pre-Test Verification

### 1. Verify Database State
Run these queries to confirm the seed data is in place:

```bash
# Start Cloud SQL Proxy (if not already running)
cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:ekklesia-db --port 5432 &

# Set password from Secret Manager
export PGPASSWORD="$(gcloud secrets versions access latest --secret=postgres-password --project=ekklesia-prod-10-2025)"

# Check election data
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "
SELECT id, title, status, voting_starts_at, voting_ends_at
FROM election;
"

# Check voting_tokens (should be 0)
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "
SELECT COUNT(*) as token_count FROM voting_tokens;
"
```

**Expected Results**:
```
Election:
- ID: b322b1fd-83f6-4ff8-9ac5-1e5c6efa8b84
- Title: "Kannanleik kosning October 2025"
- Status: published
- Voting period: 2025-10-18 09:00:00+00 → 2025-10-20 21:00:00+00

Voting Tokens: 0
```

**Actual Results** (fill in):
```
Election ID: ___________________________________
Title: _________________________________________
Status: ________________________________________
Token count: ___________________________________
```

---

## Test Execution

### 2. Get Fresh Firebase ID Token

Open your browser's Developer Console on the production site and run:

```javascript
// Get current user's ID token
firebase.auth().currentUser.getIdToken(true).then(token => {
  console.log('Token:', token);
  // Copy this token for use in curl commands below
});
```

**Token obtained at**: ________________ (timestamp)
**Token expires in**: 60 minutes

---

### 3. Test Case 1: Reset with scope="mine" (SHOULD SUCCEED)

This tests that the endpoint works for a user's own data.

```bash
FIREBASE_TOKEN="<paste-your-token-here>"

curl -X POST https://events-service-ymzrguoifa-nw.a.run.app/api/admin/reset-election \
  -H "Authorization: Bearer ${FIREBASE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "scope": "mine"
  }' \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected Response**:
```json
HTTP/1.1 200 OK
{
  "message": "Election reset successful (scope: mine)",
  "deleted": {
    "events_tokens": 0,
    "elections_tokens": 0,
    "elections_ballots": 0
  }
}
```

**Actual Response** (paste here):
```


```

**Verification Checklist**:
- [ ] HTTP status is 200 OK
- [ ] Response shows `scope: mine`
- [ ] Deleted counts are correct (likely 0 for fresh seed)
- [ ] No errors in response

---

### 4. Test Case 2: Reset with scope="all" (SHOULD BE BLOCKED)

This tests the production guardrail that prevents destructive operations.

```bash
FIREBASE_TOKEN="<paste-your-token-here>"

curl -X POST https://events-service-ymzrguoifa-nw.a.run.app/api/admin/reset-election \
  -H "Authorization: Bearer ${FIREBASE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "scope": "all",
    "confirm": "RESET ALL"
  }' \
  -w "\nHTTP Status: %{http_code}\n"
```

**Expected Response**:
```json
HTTP/1.1 403 Forbidden
{
  "error": "Forbidden",
  "message": "Full reset is blocked in production. Set PRODUCTION_RESET_ALLOWED=true to enable (with strict controls)."
}
```

**Actual Response** (paste here):
```


```

**Verification Checklist**:
- [ ] HTTP status is 403 Forbidden
- [ ] Error message mentions production guardrail
- [ ] No data was deleted (verify in step 5)
- [ ] Clear guidance for override (PRODUCTION_RESET_ALLOWED)

---

### 5. Verify Database State After Tests

Run the same queries from step 1 to confirm:
- `scope="mine"` didn't delete the election (it should only clear user-specific tokens)
- `scope="all"` was blocked and didn't delete anything

```bash
# Check election still exists
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "
SELECT id, title, status FROM election;
"

# Check voting_tokens count (should still be 0 or match pre-test)
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "
SELECT COUNT(*) as token_count FROM voting_tokens;
"
```

**Post-Test Results**:
```
Election exists: [ ] Yes  [ ] No
Election ID matches: [ ] Yes  [ ] No
Token count unchanged: [ ] Yes  [ ] No
```

---

## Audit Log Verification

### 6. Capture Audit Logs

Retrieve structured audit logs from Cloud Logging for both test cases:

```bash
# Get logs for the last 10 minutes
gcloud logging read "
  resource.type=cloud_run_revision
  AND resource.labels.service_name=events-service
  AND jsonPayload.action=reset_election
  AND timestamp>=\"$(date -u -d '10 minutes ago' '+%Y-%m-%dT%H:%M:%SZ')\"
" \
  --limit=50 \
  --format=json \
  --project=ekklesia-prod-10-2025 \
  > /tmp/admin_reset_audit_logs.json

# Pretty-print the logs
cat /tmp/admin_reset_audit_logs.json | jq '.[] | {
  timestamp: .timestamp,
  action: .jsonPayload.action,
  scope: .jsonPayload.scope,
  performed_by: .jsonPayload.performed_by,
  outcome: .jsonPayload.outcome,
  message: .textPayload
}'
```

**Audit Log Checklist**:
- [ ] Log entry for `scope="mine"` test (outcome: success)
- [ ] Log entry for `scope="all"` test (outcome: blocked)
- [ ] Both logs include `performed_by` (Firebase UID)
- [ ] Both logs include `kennitala` (masked: `XXXXXX-****`)
- [ ] Both logs include `correlation_id` for tracing
- [ ] Timestamps match test execution times

**Paste audit log summary** (timestamp, action, outcome):
```


```

---

## Test Report Update

### 7. Update ADMIN_RESET_TEST_REPORT.md

Copy the following information into [docs/testing/ADMIN_RESET_TEST_REPORT.md](ADMIN_RESET_TEST_REPORT.md):

1. **Update test date** (line 3): Current timestamp
2. **Update pre-test state** (lines 33-40): New election data from step 1
3. **Update Test 1 response** (lines 72-79): Actual response from step 3
4. **Update Test 1 audit log** (lines 82-90): Audit log from step 6
5. **Update Test 2 response** (lines 125-132): Actual response from step 4
6. **Update Test 2 audit log** (lines 135-143): Audit log from step 6
7. **Update post-test state** (lines 165-172): Database state from step 5

### 8. Commit Test Results

```bash
# Add updated test report
git add docs/testing/ADMIN_RESET_TEST_REPORT.md

# Commit with descriptive message
git commit -m "test: rerun admin reset validation against October 2025 seed data

Update ADMIN_RESET_TEST_REPORT.md with fresh test evidence for Phase 5
validation (ticket #84, issues #71-#79).

Test Results:
✅ scope='mine' reset successful (deleted 0 user tokens)
✅ scope='all' reset blocked by production guardrail
✅ Audit logs captured for both tests
✅ Database state verified before and after

Election: Kannanleik kosning October 2025 (b322b1fd-83f6-4ff8-9ac5-1e5c6efa8b84)
Test Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)
Tester: [Your name/Firebase UID]
"

# Push to remote
git push origin feature/security-hardening
```

---

## Success Criteria

All checks must pass:

- [x] Pre-test database state matches expected seed data
- [ ] Test Case 1 (`scope="mine"`) returns 200 OK
- [ ] Test Case 2 (`scope="all"`) returns 403 Forbidden
- [ ] Post-test database state unchanged (election still exists)
- [ ] Audit logs captured for both tests with complete metadata
- [ ] Test report updated and committed to git
- [ ] No data loss or unexpected side effects

---

## Troubleshooting

### Firebase Token Issues
If you get 401 Unauthorized:
```bash
# Token may have expired (60 min lifetime)
# Get a fresh token from browser console
```

### Cloud SQL Proxy Issues
If psql can't connect:
```bash
# Check proxy is running
ps aux | grep cloud-sql-proxy

# Restart proxy if needed
pkill cloud-sql-proxy
cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:ekklesia-db --port 5432 &
```

### Audit Logs Not Found
If gcloud logging returns no results:
```bash
# Increase time window to 30 minutes
gcloud logging read "..." --format=json | jq '.'

# Or check Cloud Console: Logging > Logs Explorer
# Filter: resource.labels.service_name="events-service"
```

---

## Related Documentation

- [ADMIN_RESET_TEST_REPORT.md](ADMIN_RESET_TEST_REPORT.md) - Full test report with evidence
- [AUDIT_LOGGING.md](../guides/AUDIT_LOGGING.md) - Audit logging format specification
- [svc-events/migrations/003_seed_october_2025_election.sql](../../services/svc-events/migrations/003_seed_october_2025_election.sql) - Seed data migration
- [svc-events/src/routes/admin.js](../../services/svc-events/src/routes/admin.js) - Admin reset endpoint implementation

---

**Checklist completed by**: ________________
**Date**: ________________
**All tests passed**: [ ] Yes  [ ] No (explain: _______________)
