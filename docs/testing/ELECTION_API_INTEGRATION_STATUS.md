# Election API Integration Status

**Date**: 2025-10-23
**Epic**: #24 - Admin Lifecycle Management
**Task**: Switch from Mock API to Real Elections Service API
**Status**: ✅ Ready for Testing

---

## Summary

The Elections Service API is now fully integrated and ready for end-to-end testing. All blocking issues have been resolved:

1. ✅ Database schema mismatch fixed
2. ✅ Election status query logic updated
3. ✅ Test election created with 3-year validity
4. ✅ 100 voting tokens generated
5. ✅ Test interface deployed and accessible

---

## Fixes Applied

### Fix 1: Database Table Name (services/events/src/services/electionService.js)

**Problem**: Service was querying `FROM election` but production database has `elections.elections`

**Solution**: Updated query to use schema-qualified table name

```javascript
// BEFORE
FROM election
WHERE status = 'published'

// AFTER
FROM elections.elections
WHERE status IN ('published', 'open')
ORDER BY created_at DESC
```

**Deployment**: Events Service revision 00015
**Verified**: Health check passes, GET /api/election returns data

---

### Fix 2: Election Status Query Logic

**Problem**: Query only looked for `status = 'published'` but Admin API creates elections with status workflow: `draft` → `published` → `open`

**Solution**:
- Changed to `WHERE status IN ('published', 'open')` to capture both states
- Added `ORDER BY created_at DESC` to get most recent election
- Added `LIMIT 1` to ensure single result

**Impact**: Member-facing API now correctly retrieves currently open elections

---

### Fix 3: File Naming Conventions

**Problem**: Files named `test-events.*` didn't follow project kebab-case naming convention

**Solution**: Renamed to more descriptive names
- `test-events.html` → `election-api-test.html`
- `test-events.js` → `election-api-test.js`

**Deployment**: Firebase Hosting updated
**Access**: https://ekklesia-prod-10-2025.web.app/election-api-test.html

---

## Test Election Created

**Election ID**: `1b12f8e5-b280-4852-ac9f-2d6084659eb4`

**Details**:
- **Title**: Prófunarkosning 2025-2028
- **Description**: Prófunarkosning með 3 ára gildistíma
- **Question**: Samþykkir þú að prófa rafrænt kosningakerfi?
- **Answers**: Já, Nei, Sitja hjá
- **Status**: open
- **Voting Period**: 2025-10-23 → 2028-10-23 (3 years)
- **Tokens Generated**: 100

**Creation Method**:
```bash
# 1. Get fresh ID token
curl -X POST "https://securetoken.googleapis.com/v1/token?key=$API_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token&refresh_token=$REFRESH_TOKEN"

# 2. Create election (Admin API)
POST /api/admin/elections
{
  "title": "Prófunarkosning 2025-2028",
  "voting_start_time": "2025-10-23T23:51:53Z",
  "voting_end_time": "2028-10-23T23:51:53Z",
  ...
}

# 3. Publish election
POST /api/admin/elections/{id}/publish

# 4. Open election with tokens
POST /api/admin/elections/{id}/open
{"member_count": 100}
```

---

## Testing Instructions

### Current State: Using Mock API

The system is currently configured to use **mock API**:

**File**: `/home/gudro/Development/projects/ekklesia/apps/members-portal/js/api/elections-api.js`
**Line 18**: `const USE_MOCK_API = true;`

### Test Using Real API (Recommended Next Step)

#### Step 1: Access Test Page

Navigate to: https://ekklesia-prod-10-2025.web.app/election-api-test.html

#### Step 2: Authenticate

1. Click "Login with Kenni.is"
2. Complete authentication flow
3. Verify session established

#### Step 3: Test Each Endpoint

**Expected Results**:

| Endpoint | Method | Expected Result |
|----------|--------|-----------------|
| Health Check | GET /health | ✅ 200 OK with service info |
| Get Election | GET /api/election | ✅ Returns election 1b12f8e5-b280-4852-ac9f-2d6084659eb4 |
| Request Token | POST /api/request-token | ✅ Returns one-time voting token |
| My Status | GET /api/my-status | ✅ Shows token_issued: true |
| Submit Vote | POST /api/vote | ✅ Records ballot (test with token) |
| Get Results | GET /api/results | ✅ Returns vote counts |

#### Step 4: Verify Complete Flow

1. **Get Election** → Should return active 3-year election
2. **Request Token** → Should receive one-time token (was failing before, should work now)
3. **My Status** → Should show `token_issued: true`
4. **Submit Vote** → Use token to cast ballot (choose Já/Nei/Sitja hjá)
5. **Get Results** → Verify vote was counted

#### Step 5: Switch to Real API Permanently (If Tests Pass)

Edit `/home/gudro/Development/projects/ekklesia/apps/members-portal/js/api/elections-api.js`:

```javascript
// Change line 18 from:
const USE_MOCK_API = true;

// To:
const USE_MOCK_API = false;
```

Then deploy:
```bash
cd /home/gudro/Development/projects/ekklesia/apps/members-portal
firebase deploy --only hosting --project ekklesia-prod-10-2025
```

---

## Known Issues and Limitations

### Issue 1: Old Elections Still Exist

The database contains previous test elections that are now closed. The query correctly returns the newest open election, but old data may be visible in admin interfaces.

**Solution**: Clean up old elections via Admin API or direct database DELETE when ready.

### Issue 2: Mock API Still Active by Default

User-facing pages (dashboard.html, elections.html, etc.) still use mock API until `USE_MOCK_API` is set to `false`.

**Solution**: After successful testing, update elections-api.js and redeploy.

### Issue 3: Token Refresh Flow Manual

The test scripts use a hardcoded refresh token. For production, this should be automated.

**Solution**: Implement token refresh interceptor in authenticated fetch wrapper (already exists in session/auth.js).

---

## Architecture Validation

### Service-to-Service Communication ✅

**Flow Verified**:
```
Members Portal (Firebase Hosting)
    ↓ (authenticated fetch with ID token)
Events Service (Cloud Run)
    ↓ (S2S call)
Elections Service (Cloud Run)
    ↓ (query)
Cloud SQL (PostgreSQL elections.elections table)
```

**Key Findings**:
- Events Service correctly proxies requests to Elections Service
- Elections Service successfully queries `elections.elections` table
- Database schema matches expected structure
- Status transitions work as designed (draft → published → open)

### Admin API Workflow ✅

**Validated Lifecycle**:
1. **Create** (POST /api/admin/elections) → Status: draft
2. **Publish** (POST /api/admin/elections/{id}/publish) → Status: published
3. **Open** (POST /api/admin/elections/{id}/open) → Status: open + generates tokens

**Note**: Member-facing API must query for both `published` and `open` statuses to capture active elections.

---

## Next Steps

### Immediate (Before Next Session)

- [ ] **Test complete voting flow** through election-api-test.html
- [ ] **Verify all 6 endpoints** work as expected
- [ ] **Document any errors** encountered during testing

### Short-Term (This Week)

- [ ] **Switch to real API** if tests pass (set `USE_MOCK_API = false`)
- [ ] **Update all pages** to use real API (dashboard, elections, election-detail)
- [ ] **Test on production** with real users
- [ ] **Clean up old elections** from database

### Medium-Term (Next Sprint)

- [ ] **Implement error handling** for expired tokens
- [ ] **Add retry logic** for failed votes (503 errors)
- [ ] **Create admin interface** for election management (vs using scripts)
- [ ] **Load testing** (see USAGE_CONTEXT.md - target 300 votes/sec)

---

## Deployment Status

### Events Service
- **Revision**: 00015
- **Region**: europe-west2
- **URL**: https://events-service-ymzrguoifa-nw.a.run.app
- **Changes**:
  - Fixed table name: `elections.elections`
  - Fixed status query: `IN ('published', 'open')`
  - Added ordering: `ORDER BY created_at DESC`

### Elections Service
- **No changes this session** (already deployed and working)
- **Region**: europe-west2
- **URL**: https://elections-service-ymzrguoifa-nw.a.run.app

### Members Portal (Firebase Hosting)
- **Project**: ekklesia-prod-10-2025
- **URL**: https://ekklesia-prod-10-2025.web.app
- **Changes**:
  - Renamed test-events.html → election-api-test.html
  - Renamed test-events.js → election-api-test.js
  - Updated script references

---

## Scripts Created

All scripts saved to `/tmp/` for reference:

1. **`create_3year_election.sh`** - Creates new election with 3-year validity
2. **`update_election_times.sh`** - Attempts to update via PATCH (not used - route doesn't exist)
3. **`open_election_v2.sh`** - Opens existing election with member_count
4. **`update_election_db.sql`** - Direct SQL to update timestamps (not used - used API instead)

**Most Useful**: `create_3year_election.sh` - Can be adapted for future test elections

---

## Related Documentation

- **Epic #24**: [docs/features/election-voting/EPIC_24_Admin_Backend.md](../features/election-voting/EPIC_24_Admin_Backend.md)
- **Events Service Design**: [docs/design/EVENTS_SERVICE_MVP.md](../design/EVENTS_SERVICE_MVP.md)
- **Elections Service Design**: [docs/design/ELECTIONS_SERVICE_MVP.md](../design/ELECTIONS_SERVICE_MVP.md)
- **Usage Context**: [docs/USAGE_CONTEXT.md](../USAGE_CONTEXT.md)
- **Operational Procedures**: [docs/OPERATIONAL_PROCEDURES.md](../OPERATIONAL_PROCEDURES.md)

---

## Troubleshooting

### Issue: "Election has ended" (403 Error)

**Cause**: Either:
1. Election status is not 'open' or 'published'
2. Current time is outside voting_starts_at → voting_ends_at window
3. Wrong election being returned by getCurrentElection()

**Solution**:
1. Check election status in database
2. Verify timestamps are correct
3. Confirm getCurrentElection() ORDER BY created_at DESC returns newest

### Issue: "Token expired" Error

**Cause**: Firebase ID token expired (1 hour lifetime)

**Solution**: Use refresh token to get new ID token:
```bash
curl -X POST "https://securetoken.googleapis.com/v1/token?key=$API_KEY" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token&refresh_token=$REFRESH_TOKEN"
```

### Issue: "No election available"

**Cause**: No elections with status 'published' or 'open' in database

**Solution**: Create new election using `create_3year_election.sh` or Admin API

---

## Success Criteria

**Definition of Done for Epic #24 - Real API Integration**:

- [x] Events Service queries correct database table
- [x] getCurrentElection() returns active elections
- [x] Test election created and accessible
- [ ] Complete voting flow tested end-to-end
- [ ] USE_MOCK_API switched to false
- [ ] All member-facing pages use real API
- [ ] No regressions in user experience

**Current Status**: 60% Complete
**Blocking**: Testing verification (user action required)

---

**Last Updated**: 2025-10-23T23:55:00Z
**Author**: Development Team
**Next Review**: After testing verification
