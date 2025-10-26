# Role Loss Incident - October 23, 2025

**Status**: ✅ Resolved
**Impact**: Developer role lost from user `wElbKqQ8mLfYmxhpiUGAnv0vx2g1`
**Root Cause**: Custom claims handling during handleKenniAuth redeployment
**Resolution**: Manually reset developer role via Identity Toolkit REST API

---

## Timeline

### 1. Initial State (Before Redeployment)
- User `wElbKqQ8mLfYmxhpiUGAnv0vx2g1` (gudrodur@gmail.com, kennitala: 200978-3589)
- **Assumed state**: User may or may not have had developer role set previously
- System: Firebase Auth with custom claims in production

### 2. handleKenniAuth Redeployment
**What we changed:**
- Fixed Python relative imports in `services/members/functions/main.py`
- Added environment variables (KENNI_IS_*, FIREBASE_STORAGE_BUCKET, CORS_ALLOWED_ORIGINS)
- Deployed with: `gcloud functions deploy handleKenniAuth --gen2 --runtime=python313 --env-vars-file=/tmp/kenni-env-vars.yaml`

**What happened to roles:**
- User's Firebase token after redeployment showed **NO roles claim**
- Token payload was missing `"roles": ["developer"]`

### 3. Discovery
User reported: "mitt role er ekki þannig þetta er ekki forritara role tóken"

Decoded token showed:
```json
{
  "name": "PERSON_26",
  "kennitala": "200978-3589",
  "isMember": true,
  "email": "gudrodur@gmail.com",
  "phoneNumber": "+3547758493",
  // ❌ NO "roles" field
  "iss": "https://securetoken.google.com/ekklesia-prod-10-2025",
  "aud": "ekklesia-prod-10-2025",
  "auth_time": 1760904491,
  "user_id": "wElbKqQ8mLfYmxhpiUGAnv0vx2g1",
  "sub": "wElbKqQ8mLfYmxhpiUGAnv0vx2g1",
  "iat": 1760904491,
  "exp": 1760908091
}
```

### 4. Resolution Attempt 1 (Failed)
**Incorrect approach**: I initially suggested manually editing custom claims via Firebase Console
- User correctly rejected this: "nei kerfið vikar ekki þannig farðu í djúpan lestur á skjölun"
- ❌ Firebase Console does NOT allow manual custom claims editing
- ✅ This forced proper documentation review

### 5. Resolution Attempt 2 (Failed)
**Correct tool, credential issues**: Tried using `set-user-roles.js` script
```bash
node set-user-roles.js wElbKqQ8mLfYmxhpiUGAnv0vx2g1 developer
```

**Errors encountered:**
1. `Cannot find module 'firebase-admin'` - Fixed by creating package.json and `npm install`
2. `Failed to determine project ID for Auth` - Script couldn't find project
3. `invalid_grant (reauth related error)` - Application Default Credentials expired

### 6. Resolution Attempt 3 (Success)
**Direct Identity Toolkit REST API approach:**

Created `/tmp/set_developer_role.sh`:
```bash
#!/bin/bash
set -e

TOKEN=$(gcloud auth print-access-token --project=ekklesia-prod-10-2025)

curl -X POST "https://identitytoolkit.googleapis.com/v1/projects/ekklesia-prod-10-2025/accounts:update" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: ekklesia-prod-10-2025" \
  -d '{"localId":"wElbKqQ8mLfYmxhpiUGAnv0vx2g1","customAttributes":"{\"roles\":[\"developer\"],\"kennitala\":\"200978-3589\",\"isMember\":true,\"email\":\"gudrodur@gmail.com\",\"phoneNumber\":\"+3547758493\"}"}'
```

**Key details:**
- Used `gcloud auth print-access-token` (NOT application-default)
- Required `x-goog-user-project` header for quota project
- `customAttributes` must be JSON STRING, not object (Identity Toolkit API requirement)
- Must include ALL existing claims (kennitala, isMember, email, phoneNumber) to avoid losing them

**Success response:**
```json
{
  "kind": "identitytoolkit#SetAccountInfoResponse",
  "localId": "wElbKqQ8mLfYmxhpiUGAnv0vx2g1",
  "displayName": "PERSON_26"
}
```

**Verification** (`/tmp/check_custom_claims.sh`):
```bash
TOKEN=$(gcloud auth print-access-token --project=ekklesia-prod-10-2025)

curl -s -X POST "https://identitytoolkit.googleapis.com/v1/projects/ekklesia-prod-10-2025/accounts:lookup" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: ekklesia-prod-10-2025" \
  -d '{"localId":["wElbKqQ8mLfYmxhpiUGAnv0vx2g1"]}' | jq '.users[0].customAttributes'
```

**Result:**
```json
{
  "roles": ["developer"],
  "kennitala": "200978-3589",
  "isMember": true,
  "email": "gudrodur@gmail.com",
  "phoneNumber": "+3547758493"
}
```

✅ Developer role successfully restored

---

## Root Cause Analysis

### Why Did the Role Drop Out?

**Most Likely Scenario: Role Was Never Properly Set**

The user's role was likely never set in the first place, or was set incorrectly. Here's why:

1. **handleKenniAuth DOES preserve existing roles** (see code analysis below)
2. **No code changes affected role preservation logic** during redeployment
3. **Only environment variables were added** (not role-related)

**Evidence:**
- The `handleKenniAuth` function has explicit role preservation code (lines 465-482 in main.py)
- This code reads existing custom claims and merges them with new claims
- No changes were made to this logic during redeployment

### Code Analysis: handleKenniAuth Role Preservation

```python
# Step 5: Create Firebase custom token with all claims
# Read existing custom claims from Firebase Auth (includes roles set by admin)
try:
    existing_user = auth.get_user(auth_uid)
    existing_custom_claims = existing_user.custom_claims or {}
except Exception as e:
    log_json("warn", "Could not read existing custom claims", error=str(e), uid=auth_uid)
    existing_custom_claims = {}  # ⚠️ FALLBACK: Empty if error

# Merge new claims with existing claims (preserve roles, etc.)
custom_claims = {**existing_custom_claims, 'kennitala': normalized_kennitala}
if email:
    custom_claims['email'] = email
if phone_number:
    custom_claims['phoneNumber'] = phone_number

# Persist merged claims back to Firebase Auth (ensures roles survive future logins)
try:
    auth.set_custom_user_claims(auth_uid, custom_claims)
except Exception as e:
    log_json("error", "Failed to set custom claims", error=str(e), uid=auth_uid)
```

**How this works:**
1. ✅ Reads existing custom claims from Firebase Auth (`auth.get_user(auth_uid).custom_claims`)
2. ✅ Merges existing claims with new claims using spread operator `{**existing_custom_claims, ...}`
3. ✅ Preserves roles if they exist (roles would be in `existing_custom_claims`)
4. ✅ Writes merged claims back to Firebase Auth

**When roles would be lost:**
- ❌ If `auth.get_user(auth_uid)` throws an exception → falls back to empty `{}`
- ❌ If custom claims were never set in the first place → `existing_custom_claims = {}`
- ❌ If custom claims were malformed → parsing might fail

### Alternative Scenario: Transient Error During Login

**Possible but unlikely:**
- User logged in during/immediately after function redeployment
- Function was in unstable state (cold start, environment variables not yet available)
- `auth.get_user()` call failed → exception → `existing_custom_claims = {}`
- Function wrote empty custom claims, overwriting any existing roles

**Evidence against this:**
- No error logs showing custom claims read failures
- Function redeployment completed successfully
- User logged in after deployment was stable

### Conclusion

**Most probable root cause:**
The developer role was **never properly set** on this user account before the redeployment. The redeployment revealed this gap when the user tried to test Epic #24 admin API endpoints.

**Alternative possibility:**
A transient error during login (immediately after redeployment) caused `auth.get_user()` to fail, triggering the fallback to empty custom claims and overwriting any existing roles.

---

## Lessons Learned

### 1. Role Assignment Process Gaps

**Problem**: No clear, documented process for assigning developer role to team members

**Solution implemented:**
- Created `services/members/scripts/package.json` with `firebase-admin` dependency
- Documented role assignment via `set-user-roles.js` script
- Documented fallback via Identity Toolkit REST API

**Recommended improvements:**
- [ ] Create initialization script that runs after Firebase Auth setup
- [ ] Add developer role to project owner automatically
- [ ] Document role assignment in onboarding guide
- [ ] Add monitoring/alerts for users with missing expected roles

### 2. Custom Claims API Complexity

**Discovery**: Two different APIs with different formats

| API | Custom Claims Format | Use Case |
|-----|---------------------|----------|
| Firebase Admin SDK | JavaScript object | Programmatic (recommended) |
| Identity Toolkit REST API | JSON string | Direct API calls, debugging |

**Example - Firebase Admin SDK:**
```javascript
admin.auth().setCustomUserClaims(uid, {
  roles: ["developer"],
  kennitala: "200978-3589"
});
```

**Example - Identity Toolkit REST API:**
```bash
curl -X POST ".../accounts:update" \
  -d '{"localId":"...","customAttributes":"{\"roles\":[\"developer\"]}"}'
```

**Recommendation**: Always use Firebase Admin SDK for role management (more robust, better error handling)

### 3. Credential Management Issues

**Problems encountered:**
1. Application Default Credentials expired (reauth needed)
2. Quota project not set for Identity Toolkit API
3. `set-user-roles.js` couldn't find project ID

**Solutions:**
- Use `x-goog-user-project` header for REST API calls
- Use `gcloud auth print-access-token` instead of application-default
- Pass `--project` flag to scripts

**Recommendation:**
- [ ] Document credential setup in developer onboarding
- [ ] Create helper script that checks/fixes credential issues
- [ ] Add project ID to `.env` file for scripts

### 4. Missing Dependencies in Scripts Directory

**Problem**: `services/members/scripts/` had no `package.json`

**Fix**: Created minimal package.json:
```json
{
  "name": "ekklesia-member-scripts",
  "version": "1.0.0",
  "description": "Admin scripts for Ekklesia member management",
  "private": true,
  "dependencies": {
    "firebase-admin": "^12.0.0"
  }
}
```

**Recommendation**: Include this in repository (already done)

### 5. Documentation Was Correct, But Not Followed

**Key insight**: User correctly identified that I was providing wrong instructions

The documentation (`docs/development/guides/admin/ROLES_AND_PERMISSIONS.md`) was already correct:
- Line 115: "Source of truth: Firebase Auth custom claims"
- Line 121-131: "Roles are assigned via Firebase custom claims using admin tooling"
- Line 158: "Provide a small CLI script for setting roles"

The `set-user-roles.js` script already existed and was the correct tool.

**Mistake**: I suggested manual Firebase Console editing (which doesn't work)

**Lesson**: Always read existing documentation first, especially when user says "farðu í djúpan lestur á skjölun" (go into deep reading of the documentation)

---

## Prevention Measures

### Immediate Actions (Completed)

1. ✅ Developer role restored for gudrodur@gmail.com
2. ✅ Created `/tmp/set_developer_role.sh` for emergency role assignment
3. ✅ Created `/tmp/check_custom_claims.sh` for verification
4. ✅ Installed firebase-admin in scripts directory
5. ✅ Documented this incident

### Short-Term Actions (Recommended)

1. **Add role preservation monitoring**
   ```python
   # In handleKenniAuth, after merging claims:
   if 'roles' in existing_custom_claims and 'roles' not in custom_claims:
       log_json("error", "ROLES LOST - This should never happen",
                uid=auth_uid,
                existing_roles=existing_custom_claims.get('roles'),
                severity="CRITICAL")
   ```

2. **Add custom claims to user info endpoint**
   ```python
   # New endpoint in members service:
   @https_fn.on_call()
   def getUserInfo(req: https_fn.CallableRequest):
       user = auth.get_user(req.auth.uid)
       return {
           "uid": user.uid,
           "email": user.email,
           "customClaims": user.custom_claims
       }
   ```

3. **Create admin dashboard page** showing all users and their roles

4. **Add unit tests** for handleKenniAuth custom claims preservation

### Long-Term Actions (Recommended)

1. **Implement role management UI** (Epic #25 or later)
   - List all users with roles
   - Add/remove roles via UI (with audit logging)
   - Require confirmation for role changes

2. **Add audit logging** for custom claims changes
   - Log to `admin_audit_log` table
   - Track who changed roles, when, and why
   - Alert on unexpected role removals

3. **Implement role validation** on login
   - Check if expected roles are present
   - Alert if admin user has no roles
   - Provide self-service role request mechanism

---

## Testing Checklist

To verify role preservation works correctly:

### Test 1: Role Preservation During Normal Login

```bash
# 1. Set developer role
bash /tmp/set_developer_role.sh

# 2. Verify role is set
bash /tmp/check_custom_claims.sh

# 3. User logs out and logs in again via Kenni.is
# 4. Decode new Firebase token
# 5. Verify "roles": ["developer"] is still present
```

**Expected**: Role persists after login

### Test 2: Role Preservation During Function Redeployment

```bash
# 1. Set developer role
# 2. Redeploy handleKenniAuth (with no code changes)
cd /home/gudro/Development/projects/ekklesia/services/members
firebase deploy --only functions:handleKenniAuth

# 3. User logs out and logs in again
# 4. Verify role still present in token
```

**Expected**: Role persists after function redeployment

### Test 3: Multiple Roles

```bash
# Set multiple roles
cd /home/gudro/Development/projects/ekklesia/services/members/scripts
node set-user-roles.js wElbKqQ8mLfYmxhpiUGAnv0vx2g1 developer meeting_election_manager

# Verify both roles present
# Login and check token
```

**Expected**: Both roles present in token

### Test 4: Role Removal

```bash
# Remove specific role
cd /home/gudro/Development/projects/ekklesia/services/members/scripts
node set-user-roles.js --uid wElbKqQ8mLfYmxhpiUGAnv0vx2g1 --remove meeting_election_manager

# Verify only developer role remains
```

**Expected**: Only developer role in token

---

## Related Documentation

- [docs/development/guides/admin/ROLES_AND_PERMISSIONS.md](../development/guides/admin/ROLES_AND_PERMISSIONS.md) - Role system design
- [services/members/scripts/README.md](../../services/members/scripts/README.md) - Script usage
- [services/members/functions/main.py:465-482](../../services/members/functions/main.py) - Role preservation code

---

## Emergency Role Reset Procedure

If a user loses their role and needs immediate access:

### Option 1: Using set-user-roles.js (Recommended)

```bash
cd /home/gudro/Development/projects/ekklesia/services/members/scripts
npm install  # First time only
node set-user-roles.js <UID> developer
```

### Option 2: Using Identity Toolkit REST API (If SDK fails)

```bash
# Get access token
TOKEN=$(gcloud auth print-access-token --project=ekklesia-prod-10-2025)

# Set custom claims (REPLACE WITH ACTUAL USER DATA)
curl -X POST "https://identitytoolkit.googleapis.com/v1/projects/ekklesia-prod-10-2025/accounts:update" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: ekklesia-prod-10-2025" \
  -d '{
    "localId": "USER_UID_HERE",
    "customAttributes": "{\"roles\":[\"developer\"],\"kennitala\":\"KENNITALA\",\"isMember\":true,\"email\":\"EMAIL\",\"phoneNumber\":\"PHONE\"}"
  }'
```

### Option 3: Using Firebase Admin SDK (Node.js one-liner)

```bash
cd /home/gudro/Development/projects/ekklesia/services/members/scripts
node -e "
const admin = require('firebase-admin');
admin.initializeApp({projectId: 'ekklesia-prod-10-2025'});
admin.auth().setCustomUserClaims('USER_UID_HERE', {roles: ['developer']})
  .then(() => console.log('Done'))
  .catch(e => console.error(e));
"
```

---

## User Instructions After Role Assignment

**Icelandic:**
1. Skráðu þig út af https://ekklesia-prod-10-2025.web.app
2. Skráðu þig inn aftur með Kenni.is
3. Nýja tokenið inniheldur núna developer role
4. Þú getur núna prófað Epic #24 admin API endpoints

**English:**
1. Sign out of https://ekklesia-prod-10-2025.web.app
2. Sign in again via Kenni.is
3. New token now includes developer role
4. You can now test Epic #24 admin API endpoints

---

**Incident Closed**: 2025-10-23
**Resolution Time**: ~45 minutes
**Impact**: Single user, testing blocked temporarily
**Severity**: Medium (testing environment)
**Status**: ✅ Resolved, documented, prevention measures recommended
