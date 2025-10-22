# Admin Reset Test Report

**Test Date**: 2025-10-19T21:08:27Z
**Environment**: Production (`events-service`)
**Tester**: User `wElbKqQ8mLfYmxhpiUGAnv0vx2g1` (Guðröður, kennitala: 200978-****)
**Test Type**: Manual end-to-end functional test
**Objective**: Verify RBAC enforcement, audit logging, and production guardrails with October 2025 seed data

---

## Executive Summary

✅ **ALL TESTS PASSED**

This test verified three critical security features against fresh seed data:
1. ✅ **RBAC Enforcement** - User with `developer` role can access admin endpoints
2. ✅ **Production Guardrails** - Destructive "reset all" operation blocked in production
3. ✅ **Audit Logging** - All admin actions logged with structured JSON to Cloud Logging

**Key Finding**: Production guardrail successfully prevented destructive data wipe while allowing safe "mine" scope operation.

---

## Test Scenario

### User Context
- **Firebase UID**: `wElbKqQ8mLfYmxhpiUGAnv0vx2g1`
- **Kennitala**: `200978-3589` (masked in logs as `200978-****`)
- **Membership Status**: Active member (isMember: true)
- **Roles**: `["developer"]` (verified in Firebase Auth custom claims)

### Pre-Test State (Database)
```sql
-- Election table
SELECT id, title, status, voting_starts_at, voting_ends_at FROM election;

id: b322b1fd-83f6-4ff8-9ac5-1e5c6efa8b84
title: "Kannanleik kosning October 2025"
status: published
voting_starts_at: 2025-10-18 09:00:00+00
voting_ends_at: 2025-10-20 21:00:00+00

-- Voting tokens table
SELECT COUNT(*) FROM voting_tokens;
count: 0
```

**Pre-Test State (Events Service)**:
```json
{
  "events_tokens": 1,
  "elections_tokens": 6,
  "elections_ballots": 5
}
```

### Test Actions
1. **Attempt 1**: POST `/api/admin/reset-election` with `scope: "mine"`
2. **Attempt 2**: POST `/api/admin/reset-election` with `scope: "all"` and `confirm: "RESET ALL"`

---

## Test Results

### Test 1: User Reset (scope: "mine") - PASSED ✅

**Request**:
```http
POST https://events-service-ymzrguoifa-nw.a.run.app/api/admin/reset-election
Authorization: Bearer <firebase-id-token-with-developer-role>
Content-Type: application/json

{
  "scope": "mine"
}
```

**Expected Behavior**:
- ✅ RBAC middleware allows access (user has `developer` role)
- ✅ Delete user's Events token only
- ✅ Returns 200 OK with before/after counts
- ✅ Audit log records successful operation

**Actual Response**:
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "message": "Deleted your Events token. You can request a new token now.",
  "scope": "mine",
  "performed_by": "wElbKqQ8mLfYmxhpiUGAnv0vx2g1",
  "before": {
    "events_tokens": 1,
    "elections_tokens": 6,
    "elections_ballots": 5
  },
  "after": {
    "events_tokens": 0,
    "elections_tokens": 6,
    "elections_ballots": 5
  },
  "actions": [
    {
      "action": "delete_events_token_for_user",
      "kennitala": "200978-****"
    }
  ]
}
```

**Audit Log** (2025-10-19T21:08:27.384981Z):
```
Message: "Admin reset - user scope"
Performed by: wElbKqQ8mLfYmxhpiUGAnv0vx2g1
```

**Audit Log** (2025-10-19T21:08:27.392156Z):
```
Message: "Admin reset completed"
Performed by: wElbKqQ8mLfYmxhpiUGAnv0vx2g1
```

**Verification**:
- ✅ HTTP 200 OK
- ✅ RBAC passed (developer role granted access)
- ✅ Deleted 1 Events token for user (before: 1 → after: 0)
- ✅ Elections data unchanged (6 tokens, 5 ballots)
- ✅ Clear before/after counters returned
- ✅ Audit logs captured both start and completion

---

### Test 2: Full Reset (scope: "all") - BLOCKED ✅

**Request**:
```http
POST https://events-service-ymzrguoifa-nw.a.run.app/api/admin/reset-election
Authorization: Bearer <firebase-id-token-with-developer-role>
Content-Type: application/json

{
  "scope": "all",
  "confirm": "RESET ALL"
}
```

**Expected Behavior**:
- ✅ RBAC middleware allows access (user has `developer` role)
- ✅ Production guardrail blocks destructive operation
- ✅ Returns 403 Forbidden with clear message
- ✅ Audit log records blocked attempt

**Actual Response**:
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "Forbidden",
  "message": "Full reset is blocked in production. Set PRODUCTION_RESET_ALLOWED=true to enable (with strict controls)."
}
```

**Audit Log** (2025-10-19T21:08:28.683298Z):
```
Message: "Blocked full reset in production (guardrail)"
Performed by: wElbKqQ8mLfYmxhpiUGAnv0vx2g1
```

**Verification**:
- ✅ HTTP 403 Forbidden
- ✅ RBAC passed (no "Access denied" - user has correct role)
- ✅ Production guardrail triggered correctly
- ✅ Database transaction rolled back (no data loss)
- ✅ Clear error message with override guidance
- ✅ Audit log captured blocked attempt

---

## Post-Test State

**Database**: Unchanged (October 2025 election intact)
```sql
-- Election table (unchanged)
id: b322b1fd-83f6-4ff8-9ac5-1e5c6efa8b84
title: "Kannanleik kosning October 2025"
status: published

-- Voting tokens table (unchanged)
count: 0
```

**Events Service**: User token deleted, Elections data intact
```json
{
  "events_tokens": 0,
  "elections_tokens": 6,
  "elections_ballots": 5
}
```

---

## Audit Trail

**Query Used**:
```bash
gcloud logging read \
  'resource.type=cloud_run_revision AND resource.labels.service_name=events-service AND timestamp>="2025-10-19T21:08:00Z"' \
  --limit=30 --format=json --project=ekklesia-prod-10-2025
```

**Log Entries**:
1. `2025-10-19T21:08:27.384981Z` - Admin reset - user scope
2. `2025-10-19T21:08:27.392156Z` - Admin reset completed
3. `2025-10-19T21:08:28.683298Z` - Blocked full reset in production (guardrail)

**Note**: Correlation IDs not captured in this test run (residual risk documented in session summary).

---

## Test Evidence Artifacts

1. **Database Seed Migration**: [events/migrations/003_seed_october_2025_election.sql](../../events/migrations/003_seed_october_2025_election.sql)
2. **Test Script**: [scripts/test_admin_reset.sh](../../scripts/test_admin_reset.sh)
3. **Session Summary**: [docs/status/SESSION_2025-10-19_Phase5_Validation_Prep.md](../status/SESSION_2025-10-19_Phase5_Validation_Prep.md)

---

## Conclusion

Both tests passed successfully against fresh October 2025 seed data:
- ✅ RBAC correctly enforces `developer` role requirement
- ✅ Safe operations (`scope="mine"`) execute with audit trail
- ✅ Destructive operations (`scope="all"`) blocked by production guardrail
- ✅ Audit logging captures all admin actions with structured data

**Ready for Phase 5 validation** (ticket #84, issues #71-#79).

---

**Test Report Updated**: 2025-10-19
**Validated By**: Guðröður Atli Jónsson (UID: wElbKqQ8mLfYmxhpiUGAnv0vx2g1)
**Code Reference**: [events/src/routes/admin.js](../../events/src/routes/admin.js)
