# Security Hardening Plan - Deep Dive

**Created**: 2025-10-12
**Branch**: feature/security-hardening
**Status**: 🔨 In Progress
**Issues**: #30, #31, #32, #33

---

## Current State Audit (Oct 12, 2025)

### ✅ Verified via CLI

**Authentication**:
- Project: `ekklesia-prod-10-2025` (521240388393)
- Authenticated: `gudrodur@sosialistaflokkurinn.is`
- Region: `europe-west2`

**Active Services**:
```
SERVICE            URL
elections-service  https://elections-service-521240388393.europe-west2.run.app
events-service     https://events-service-521240388393.europe-west2.run.app
handlekenniauth    https://handlekenniauth-521240388393.europe-west2.run.app
verifymembership   https://verifymembership-521240388393.europe-west2.run.app
```

**Firestore Database**:
- Type: FIRESTORE_NATIVE
- Location: europe-west2
- Edition: STANDARD (Free tier)
- Point-in-time recovery: DISABLED
- Delete protection: DISABLED

---

## Security Issues - Current Assessment

### Issue #31: Rate Limiting for Cloud Functions

**Status**: ❌ NOT IMPLEMENTED

**Current State**:
- ✅ `handlekenniauth` (Cloud Function Gen 2) - No rate limiting
- ✅ `verifymembership` (Cloud Function Gen 2) - No rate limiting
- ⚠️ `events-service` (Cloud Run) - No rate limiting
- ⚠️ `elections-service` (Cloud Run) - No rate limiting

**Vulnerability Assessment**:
```python
# members/functions/main.py:69-264
@https_fn.on_request()
def handleKenniAuth(req: https_fn.Request):
    # NO RATE LIMITING
    # Can be called unlimited times from same IP
    # Potential for:
    # - Brute force attacks on OAuth flow
    # - Token generation abuse
    # - Resource exhaustion
```

**Attack Scenarios**:
1. **OAuth Brute Force**: Attacker sends 1000 requests/sec to `/handleKenniAuth`
   - Impact: OAuth token pool exhaustion, service degradation
   - Cost: Cloud Functions invocations (unbounded)

2. **Membership Verification Spam**: Attacker calls `verifyMembership` repeatedly
   - Impact: Cloud Storage API quota exhaustion
   - Cost: Storage read operations (potentially expensive)

3. **Events API Abuse**: Unlimited token requests
   - Impact: Database connection pool exhaustion
   - Risk: See USAGE_CONTEXT.md - 300 votes/sec spike is legitimate, but 10,000/sec is attack

**Solution Options**:

#### Option A: Cloud Armor (Recommended for Production)
```bash
# Pros: GCP-native, DDoS protection, layer 7 firewall
# Cons: $0.75/policy/month + $0.0075/million requests
# Timeline: 2-3 hours setup

gcloud compute security-policies create ekklesia-rate-limit \
  --project ekklesia-prod-10-2025

# Rate limit: 100 requests/minute per IP for Cloud Functions
gcloud compute security-policies rules create 1000 \
  --security-policy ekklesia-rate-limit \
  --expression "origin.ip == '[ENTER IP]'" \
  --action "rate-based-ban" \
  --rate-limit-threshold-count 100 \
  --rate-limit-threshold-interval-sec 60 \
  --ban-duration-sec 600 \
  --project ekklesia-prod-10-2025
```

#### Option B: Firebase App Check (Recommended for Free Tier)
```javascript
// Pros: Free, easy setup, mobile + web support
// Cons: Requires client SDK changes, bypass-able with effort
// Timeline: 1-2 hours

// Enable App Check for Cloud Functions
// members/public/index.html
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const app = initializeApp(firebaseConfig);
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('YOUR-RECAPTCHA-SITE-KEY'),
  isTokenAutoRefreshEnabled: true
});
```

#### Option C: Application-Level Rate Limiting
```python
# Pros: Fine-grained control, free
# Cons: Must implement per-function, state management needed
# Timeline: 4-6 hours

# Use Cloud Memorystore (Redis) or Firestore for rate limit tracking
from datetime import datetime, timedelta

def check_rate_limit(ip: str, limit: int = 10, window: int = 60) -> bool:
    """Check if IP has exceeded rate limit"""
    db = firestore.client()
    rate_limit_ref = db.collection('rate_limits').document(ip)

    doc = rate_limit_ref.get()
    if doc.exists:
        data = doc.to_dict()
        if data['count'] >= limit and datetime.now() < data['reset_at']:
            return False  # Rate limited

    # Update or create rate limit entry
    rate_limit_ref.set({
        'count': firestore.Increment(1),
        'reset_at': datetime.now() + timedelta(seconds=window)
    }, merge=True)

    return True  # Allowed
```

**Recommendation**: **Option B (Firebase App Check)** for MVP
- Free tier compatible
- Easy to implement
- Sufficient for current scale (300 members)
- Can upgrade to Cloud Armor if needed

---

### Issue #33: CSRF Protection (State Parameter)

**Status**: ❌ NOT IMPLEMENTED

**Current State**:
```bash
# Searched members/public/*.html and *.js for CSRF state parameter
grep -r "state" members/public/
# Result: NO STATE PARAMETER FOUND
```

**Vulnerability Assessment**:
```javascript
// members/public/index.html (OAuth flow)
// MISSING: state parameter in OAuth URL
const authUrl = `${KENNI_ISSUER}/oidc/authorize?...`;
// ❌ No state parameter
// ❌ No state validation on callback
```

**Attack Scenario**:
1. Attacker creates malicious authorization request
2. Victim clicks attacker's link (contains attacker's auth code)
3. Victim's session linked to attacker's Kenni.is account
4. Attacker gains access to victim's Ekklesia account

**OWASP Reference**: A07:2021 – Identification and Authentication Failures

**Solution**:

```javascript
// Step 1: Generate state parameter (frontend)
function generateState() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Step 2: Store state in sessionStorage
const state = generateState();
sessionStorage.setItem('oauth_state', state);

// Step 3: Add to OAuth URL
const authUrl = `${KENNI_ISSUER}/oidc/authorize?` +
  `response_type=code&` +
  `client_id=${CLIENT_ID}&` +
  `redirect_uri=${REDIRECT_URI}&` +
  `scope=openid%20profile%20national_id&` +
  `state=${state}&` +  // ← Add state
  `code_challenge=${codeChallenge}&` +
  `code_challenge_method=S256`;

// Step 4: Validate state on callback
const urlParams = new URLSearchParams(window.location.search);
const returnedState = urlParams.get('state');
const storedState = sessionStorage.getItem('oauth_state');

if (returnedState !== storedState) {
  throw new Error('CSRF attack detected: state mismatch');
}
sessionStorage.removeItem('oauth_state');
```

**Timeline**: 30 minutes
**Priority**: HIGH (security vulnerability)

---

### Issue #32: Idempotency for User Creation

**Status**: ⚠️ PARTIAL IMPLEMENTATION

**Current State**:
```python
# members/functions/main.py:203-208
else:
    # Create new user
    print(f"INFO: Creating new user for kennitala {normalized_kennitala[:7]}****")
    new_user = auth.create_user(display_name=full_name)  # ← NOT IDEMPOTENT
    auth_uid = new_user.uid
```

**Vulnerability Assessment**:
- ✅ Firestore query checks for existing user (line 181-182)
- ❌ Race condition possible: Two simultaneous logins for same kennitala
- ❌ Firebase Auth `create_user` throws exception if user exists
- ❌ No transaction wrapper around user creation

**Attack Scenario**:
1. User opens two browser tabs
2. Both tabs complete OAuth at same time
3. Both Cloud Functions try to create user simultaneously
4. One succeeds, one fails with 500 error
5. User sees error, retries, gets confused

**Real-World Impact**: Low probability (unlikely two simultaneous first logins), but poor UX

**Solution Options**:

#### Option A: Try/Catch Around create_user (Quick Fix)
```python
# Catch AlreadyExistsError and retry query
try:
    new_user = auth.create_user(display_name=full_name)
    auth_uid = new_user.uid
except firebase_admin.exceptions.AlreadyExistsError:
    # User was created by concurrent request, retry query
    print(f"WARN: User already exists (race condition), retrying query")
    query = users_ref.where('kennitala', '==', normalized_kennitala).limit(1)
    existing_users = list(query.stream())
    if existing_users:
        auth_uid = existing_users[0].id
    else:
        raise Exception("User creation race condition unresolved")
```

**Timeline**: 15 minutes

#### Option B: Firestore Transaction (Robust)
```python
@firestore.transactional
def create_user_idempotent(transaction, kennitala, full_name):
    """Atomically check and create user"""
    query = users_ref.where('kennitala', '==', kennitala).limit(1)
    existing_users = list(query.stream())

    if existing_users:
        return existing_users[0].id

    # Create in transaction
    new_user = auth.create_user(display_name=full_name)
    user_ref = users_ref.document(new_user.uid)
    transaction.set(user_ref, {
        'fullName': full_name,
        'kennitala': kennitala,
        # ...
    })
    return new_user.uid
```

**Timeline**: 1 hour

**Recommendation**: **Option A** for MVP (quick, sufficient)
- Low risk scenario
- Easy to implement
- Minimal code changes

---

### Issue #30: Firestore Security Rules Review

**Status**: ⚠️ RULES NOT DEFINED (Using defaults)

**Current State**:
```bash
# No firestore.rules file found in repository
ls members/firestore.rules
# Result: No such file

# No rules defined in firebase.json
cat members/firebase.json
# Result: No "firestore" section
```

**Firestore Database Info**:
```yaml
Database: (default)
Type: FIRESTORE_NATIVE
Location: europe-west2
Delete Protection: DISABLED  # ⚠️ Can be deleted accidentally
PITR: DISABLED               # ⚠️ No point-in-time recovery
```

**Vulnerability Assessment**:
**CRITICAL**: Without security rules, Firestore may have:
1. ❌ Open read access (anyone can read user data)
2. ❌ Open write access (anyone can modify data)
3. ❌ No field-level validation

**Current Collections** (Inferred from code):
```
/users/{uid}
  - kennitala (PII)
  - email (PII)
  - phoneNumber (PII)
  - fullName
  - role
  - isMember
  - createdAt
  - lastLogin
  - membershipVerifiedAt
```

**Solution**:

#### Step 1: Check Current Rules via Console
```bash
# Cannot check via CLI, must use Firebase Console
echo "https://console.firebase.google.com/project/ekklesia-prod-10-2025/firestore/rules"
```

#### Step 2: Define Secure Rules
```javascript
// members/firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    function hasValidKennitala() {
      return isAuthenticated() &&
             request.auth.token.kennitala != null &&
             request.auth.token.kennitala.matches('^[0-9]{6}-?[0-9]{4}$');
    }

    // Users collection
    match /users/{userId} {
      // Read: Only own profile
      allow read: if isOwner(userId);

      // Create: Only Cloud Functions (via Admin SDK)
      allow create: if false;  // ← Admin SDK bypasses this

      // Update: Only own profile, limited fields
      allow update: if isOwner(userId) &&
                       request.resource.data.diff(resource.data)
                         .affectedKeys()
                         .hasOnly(['photoURL', 'lastLogin']);

      // Delete: Never (soft delete via admin only)
      allow delete: if false;
    }

    // Default: Deny all
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

#### Step 3: Add to firebase.json
```json
{
  "functions": [...],
  "hosting": {...},
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

#### Step 4: Deploy Rules
```bash
cd members/
firebase deploy --only firestore:rules --project ekklesia-prod-10-2025
```

**Timeline**: 1-2 hours (includes testing)
**Priority**: CRITICAL (data exposure risk)

---

## Implementation Plan

### Phase 1: Critical Security Fixes (Day 1, 4-5 hours)

**Priority Order**:

1. **Firestore Security Rules** (#30) - 2 hours
   - ✅ Most critical (data exposure)
   - Create firestore.rules file
   - Deploy and test rules
   - Verify in Console

2. **CSRF Protection** (#33) - 1 hour
   - Add state parameter to OAuth flow
   - Validate on callback
   - Test with production

3. **Idempotency Fix** (#32) - 30 minutes
   - Add try/catch around create_user
   - Test concurrent login scenario

4. **Rate Limiting (Quick Win)** (#31) - 1-2 hours
   - Implement Firebase App Check
   - Add reCAPTCHA v3
   - Test with production

**Testing Strategy**:
```bash
# 1. Firestore Rules Testing
firebase emulators:start --only firestore
# Run unit tests against rules

# 2. CSRF Testing
# - Test with valid state
# - Test with invalid state
# - Test with missing state

# 3. Idempotency Testing
# - Simulate concurrent requests with curl

# 4. Rate Limiting Testing
# - Use curl with App Check token
# - Attempt without token (should fail)
```

### Phase 2: Enhanced Security (Day 2-3, 6-8 hours)

1. **Advanced Rate Limiting** (if needed)
   - Evaluate App Check effectiveness
   - Consider Cloud Armor if attacks detected
   - Monitor Cloud Functions logs

2. **Additional Hardening**:
   - Enable Firestore PITR (Point-in-time recovery)
   - Enable delete protection on database
   - Add audit logging for sensitive operations
   - Implement alert notifications

3. **Documentation**:
   - Update security documentation
   - Create runbook for security incidents
   - Document rate limiting policies

---

## Verification & Testing

### Pre-Deployment Checklist

```bash
# 1. Verify Firebase rules
cd members/
firebase deploy --only firestore:rules --project ekklesia-prod-10-2025 --debug

# 2. Test CSRF protection
# Open members service, check Network tab for state parameter

# 3. Test idempotency
# Curl handleKenniAuth twice with same data

# 4. Test rate limiting
# Curl handleKenniAuth 100 times rapidly
for i in {1..100}; do
  curl -X POST https://handlekenniauth-521240388393.europe-west2.run.app \
    -H "Content-Type: application/json" \
    -d '{"kenniAuthCode":"test","pkceCodeVerifier":"test"}' &
done
```

### Monitoring

```bash
# 1. Watch Cloud Functions logs
gcloud logging tail \
  "resource.type=cloud_function resource.labels.function_name=handlekenniauth" \
  --project ekklesia-prod-10-2025

# 2. Monitor Firestore operations
gcloud logging tail \
  "resource.type=firestore_database" \
  --project ekklesia-prod-10-2025

# 3. Check for rate limit violations
gcloud logging read \
  "resource.type=cloud_function AND severity>=WARNING" \
  --limit 50 \
  --project ekklesia-prod-10-2025
```

---

## Cost Impact Analysis

### Current Monthly Cost: ~$7

| Item | Current | With Security | Delta |
|------|---------|---------------|-------|
| Firestore | Free tier | Free tier | $0 |
| Cloud Functions | Free tier | Free tier | $0 |
| Firebase App Check | N/A | Free tier | $0 |
| reCAPTCHA v3 | N/A | Free (1M/month) | $0 |
| Cloud Armor (optional) | N/A | $0.75/month | +$0.75 |
| **Total** | **$7** | **$7-8** | **+$0-1** |

**Conclusion**: Minimal cost impact (<15% increase)

---

## Success Criteria

### Firestore Security Rules (#30)
- ✅ Rules file created and deployed
- ✅ Users can only read own profile
- ✅ Admin SDK operations still work
- ✅ Unauthorized access returns 403

### CSRF Protection (#33)
- ✅ State parameter in OAuth URL
- ✅ State validation on callback
- ✅ Attack scenario blocked (invalid state = error)

### Idempotency (#32)
- ✅ Concurrent logins handled gracefully
- ✅ No 500 errors on race conditions
- ✅ User created exactly once

### Rate Limiting (#31)
- ✅ Firebase App Check enabled
- ✅ Requests without token rejected
- ✅ Legitimate traffic unaffected
- ✅ Attack traffic blocked (>100 req/min from single source)

---

## Next Steps

**Immediate**:
1. Create firestore.rules file
2. Implement CSRF state parameter
3. Add idempotency fix
4. Set up Firebase App Check

**After Security Fixes**:
1. Create PR to main
2. Request Ágúst review
3. Use "Squash and merge" (consistent with project strategy)

**Long-term**:
1. Monitor security metrics
2. Schedule quarterly security audits
3. Keep dependencies updated

---

**Document Version**: 1.0
**Last Updated**: 2025-10-12
**Branch**: feature/security-hardening
**Related Issues**: #30, #31, #32, #33
**Estimated Effort**: 10-13 hours total (Phase 1: 4-5 hours, Phase 2: 6-8 hours)
