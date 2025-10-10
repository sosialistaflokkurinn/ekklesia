# PR #28 Complete Review by Ágúst - All Comments & Action Items

**PR Title**: feat: Firebase Members authentication and Events service design
**PR Number**: #28
**Reviewer**: @agustka (Ágúst Kárason)
**Review Date**: October 10, 2025 06:53 UTC
**Status**: ✅ APPROVED
**Total Comments**: 23 detailed review comments + 1 overall approval

---

## Overall Approval

**Status**: ✅ **APPROVED**

**Original (Icelandic)**:
> Lítur vel út, vel skjalað og spennandi að þetta skuli vera komið á þennan stað

**Translation (English)**:
> "Looks good, well documented and exciting that this has come this far"

---

## Detailed Review Comments (23 Total)

### 1. Documentation Comments (4 comments)

#### Comment 1.1: Member Permissions Clarification
**File**: `docs/SYSTEM_ARCHITECTURE_OVERVIEW.md`
**Context**: Member permissions for participation
**Priority**: Minor ("Lítið")

**Original (Icelandic)**:
> Lítið: réttara væri að segja að það sé hægt að skilgreina hvaða réttindi meðlimurinn þarf að hafa til að fá að taka þátt eða sjá kosninguna/atburinn.
>
> Kanski svona:
>
> Member permission: Which permission(s) (on the user, comes from Members) are required to be allowed to see/vote in an event (election)

**Translation**:
> Minor: it would be more accurate to say that it's possible to define which permissions the member needs to have in order to participate in or see the election/event.
>
> Maybe something like:
>
> Member permission: Which permission(s) (on the user, comes from Members) are required to be allowed to see/vote in an event (election)

**Action Required**:
- [ ] Update `docs/SYSTEM_ARCHITECTURE_OVERVIEW.md` to clarify permission model
- [ ] Emphasize that permissions come from Members service
- [ ] Explain permission requirements for seeing vs voting in elections

---

#### Comment 1.2: Voting System Core Responsibilities
**File**: `docs/SYSTEM_ARCHITECTURE_OVERVIEW.md`
**Context**: Voting service responsibilities
**Priority**: Minor ("Lítið")

**Original (Icelandic)**:
> Lítið: Bæta smá meira við um 3 grunn-ábyrðgir kosningakerfisins:
>
> Kanski bæta þessum atriðum við (endilega stytta):
>
> - Ensuring that each user can vote only once.
> - Correct and irreversible consumption of the voting token upon use.
> - Reliable handling of high-concurrency (surge) situations through a queue-based event intake mechanism.

**Translation**:
> Minor: Add a bit more about the 3 core responsibilities of the voting system:
>
> Maybe add these items (feel free to shorten):
>
> - Ensuring that each user can vote only once.
> - Correct and irreversible consumption of the voting token upon use.
> - Reliable handling of high-concurrency (surge) situations through a queue-based event intake mechanism.

**Action Required**:
- [ ] Update `docs/SYSTEM_ARCHITECTURE_OVERVIEW.md` with 3 core responsibilities
- [ ] Document one-vote-per-user guarantee
- [ ] Document token consumption as irreversible
- [ ] Document queue-based surge handling architecture

**Note**: This is already implemented in Phase 5! We have:
- ✅ One vote per token (database UNIQUE constraint)
- ✅ Token marked as `used` (irreversible)
- ⏸️ Queue architecture deferred to Epic #19 (using synchronous for MVP)

---

#### Comment 1.3: Database Separation Recommendation
**File**: `docs/status/CURRENT_PRODUCTION_STATUS.md`
**Context**: Shared database instance (ekklesia-db)
**Priority**: **Important Question**

**Original (Icelandic)**:
> Væri betra að hafa amk 2 db tilvik? Væri ekki best að amk aðgreina Meðlimi & Atburði frá Kosninga-grunninum?

**Translation**:
> Would it be better to have at least 2 database instances? Wouldn't it be best to at least separate Members & Events from the Elections database?

**Analysis**:
Ágúst is suggesting **separate database instances** for:
1. **DB Instance 1**: Members + Events (with PII)
2. **DB Instance 2**: Elections (no PII, anonymous ballots)

**Current Setup** (Phase 5):
- **1 database instance**: `ekklesia-db` (db-f1-micro, $7/month)
  - `public` schema: Events service (has PII - kennitala)
  - `elections` schema: Elections service (no PII - token hashes only)
- **Members**: Uses Firestore (not PostgreSQL)

**Pros of Current Approach** (Single Instance, Separate Schemas):
- ✅ Cost: $7/month (vs $14/month for 2 instances)
- ✅ Simplicity: One instance to manage
- ✅ Security: Schema-level isolation sufficient for MVP
- ✅ Data separation: Elections schema has zero PII

**Pros of Ágúst's Suggestion** (2 Instances):
- ✅ Stronger isolation: Physical database separation
- ✅ Security: Elections database completely air-gapped from PII
- ✅ Scalability: Independent scaling for high-load Elections service
- ✅ Compliance: Easier to prove anonymity (separate infrastructure)

**Action Required**:
- [ ] **Discuss with Ágúst**: Is schema-level separation sufficient for MVP?
- [ ] **Security analysis**: Document why schema separation provides adequate anonymity
- [ ] **Future consideration**: Plan for 2nd database instance if needed for load/compliance
- [ ] **Cost/benefit**: $7/month additional cost vs stronger isolation

**Recommendation**:
- MVP: Keep current (1 instance, 2 schemas) - cost effective, adequate security
- Future: Split to 2 instances if:
  - Load testing shows need for independent scaling
  - Compliance review requires physical separation
  - Budget allows $14/month instead of $7/month

---

#### Comment 1.4: Idempotency & Surge Handling
**File**: `docs/status/CURRENT_PRODUCTION_STATUS.md`
**Context**: Token issuance and surge architecture
**Priority**: **Important** ("væri kanski gott")

**Original (Icelandic)**:
> Lítið: væri kanski gott að minnast á idempotency og surge virkni hér, þurfum að hanna þetta í kringum bæði:
> 1) 100% bara einn kosningatoken per kosningu og aðila
> 2) verður að geta höndlað skyndilegt áhlaup (200 manns allt í einu), með t.d. queue arkitektúr - notendur munu ýta á alla takkana í einu ef eitthvað er jafnvel örlítið seinlegt og þá er gott að vera með 100% skilvirk kerfi svo enginn kjósi óvart 2x eða oftar og líka bara gera þetta eins vel hannað og hægt er til að taka á svona áhlaupum.

**Translation**:
> Minor: it would maybe be good to mention idempotency and surge handling here, we need to design this around both:
> 1) 100% only one voting token per election and person
> 2) must be able to handle sudden surge (200 people all at once), with e.g. queue architecture - users will press all buttons at once if something is even slightly slow, so it's good to have 100% efficient system so no one votes accidentally 2x or more and also just make this as well designed as possible to handle such surges.

**Action Required**:
- [ ] Update `docs/status/CURRENT_PRODUCTION_STATUS.md` to document:
  - Idempotency guarantees (one token per member per election)
  - Surge handling architecture (300 votes/sec spike - already documented in USAGE_CONTEXT.md)
  - Database constraints preventing duplicate tokens
  - Transaction-level locking (FOR UPDATE)
- [ ] Add cross-reference to `docs/USAGE_CONTEXT.md` (already has 300 votes/sec analysis)
- [ ] Document future queue architecture (Epic #19 - deferred from MVP)

**Note**: This is already extensively documented in Phase 5:
- ✅ `docs/USAGE_CONTEXT.md`: Complete 300 votes/sec surge analysis
- ✅ Database UNIQUE constraints: One token per kennitala
- ✅ Cloud Run scaling: max-instances=100, handles surge
- ⏸️ Queue (Pub/Sub): Deferred to Epic #19 (synchronous sufficient for MVP)

---

### 2. Members Service Implementation (19 comments)

#### Comment 2.1: Member Roster Management
**File**: `members/README.md`
**Context**: How membership list gets into the system
**Priority**: **Important Question** ("Smá spurning")

**Original (Icelandic)**:
> Smá spurning: hvernig koma kennitölurnar (meðlimalistinn) inn í kerfið? Ég hafði hugsað mér að "Meðlimir" kerfið yrði bara hin eina sanna meðlimaskrá en ég held það sé kanski ekki alveg raunhæft til að byrja með því eldra kerfið sem þau nota býður upp á útsendigar á póstum og þannig.

**Translation**:
> Small question: how do the kennitala (member list) get into the system? I had imagined that the "Members" system would be the one true member registry but I think that might not be quite realistic to start with because the old system they use offers mailing lists and such.

**Analysis**:
Ágúst is asking about **membership roster synchronization**:
- **Current approach**: Manual upload to Firebase Storage (`kennitalas.txt`, 2,273 members)
- **Ágúst's vision**: Members system as "single source of truth"
- **Reality**: Legacy system (existing membership database) has features needed (mailing lists, etc.)

**Action Required**:
- [ ] **Document current approach** in `members/README.md`:
  - Manual roster upload (CSV → `kennitalas.txt`)
  - Updated monthly or as needed
  - Source: Legacy membership database export
- [ ] **Create sync plan** for future:
  - Option A: Import from legacy system via API
  - Option B: Manual CSV upload (current)
  - Option C: Build admin UI for roster management
- [ ] **Discuss with Ágúst**: When can Members become "single source of truth"?

**Current Process** (needs documentation):
```bash
# 1. Export from legacy system (monthly)
# 2. Convert to kennitalas.txt format (one kennitala per line)
# 3. Upload to Firebase Storage
gsutil cp kennitalas.txt gs://ekklesia-prod-10-2025.firebasestorage.app/
```

---

#### Comment 2.2: Custom Token Lifetime Control
**File**: `members/README.md`
**Context**: Firebase custom token expiration
**Priority**: Minor question

**Original (Icelandic)**:
> Er hægt að stjórna hversu lengi þessir tokenar lifa?

**Translation**:
> Is it possible to control how long these tokens live?

**Answer**: Yes! Firebase custom tokens have configurable expiration.

**Current Implementation**:
- Default: 1 hour (Firebase default)
- Configurable via `expires_in` parameter in `create_custom_token()`

**Action Required**:
- [ ] Document token lifetime in `members/README.md`
- [ ] Add configuration example:
```python
# Control custom token expiration (seconds)
custom_token = auth.create_custom_token(
    uid,
    developer_claims={'kennitala': kennitala, 'isMember': True},
    # expires_in=3600  # Default: 1 hour
)
```
- [ ] Consider shorter expiration for security (e.g., 30 minutes)

---

#### Comment 2.3: Audit Logging for Membership Verification
**File**: `members/README.md`
**Context**: Membership verification during elections
**Priority**: Important ("væri sennilega gott")

**Original (Icelandic)**:
> Lítið: væri sennilega gott að audit logga þetta, amk þegar þetta er gert í tengslum við kosningu til að auka áreiðanleika

**Translation**:
> Minor: it would probably be good to audit log this, at least when done in connection with elections to increase reliability

**Action Required**:
- [ ] Add audit logging to `verifyMembership` Cloud Function
- [ ] Log events:
  - Membership check timestamp
  - Kennitala (hashed or prefix only - no full PII in logs)
  - Verification result (member: true/false)
  - Context (election_id if related to voting)
- [ ] Use Cloud Logging structured logs:
```python
import json
print(json.dumps({
    'severity': 'INFO',
    'event': 'membership_verification',
    'kennitala_prefix': kennitala[:6] + '-****',  # Mask last 4 digits
    'is_member': is_member,
    'election_context': election_id,  # If applicable
    'timestamp': datetime.utcnow().isoformat()
}))
```
- [ ] Document audit logging in `members/README.md`

---

#### Comment 2.4: Firestore Security Rules
**File**: `members/README.md`
**Context**: Firestore access control
**Priority**: **Critical** ("Það er hægt að gera allskonar sniðuga hluti")

**Original (Icelandic)**:
> Það er hægt að gera allskonar sniðuga hluti með FB reglunum - en í grunninn er það mikilvægasta að notendur geti bara séð upplýsingar sem þeir mega sjá, t.d. aldrei upplýsingar um aðra notendur (nema hafa réttindi)

**Translation**:
> It's possible to do all sorts of clever things with Firebase rules - but basically the most important thing is that users can only see information they're allowed to see, e.g. never information about other users (unless they have permissions)

**Action Required**:
- [ ] **Review current Firestore security rules** (`firestore.rules`)
- [ ] **Ensure**:
  - Users can only read their own profile (`users/{uid}`)
  - Users cannot read other users' profiles
  - Only admins can read all profiles (future: role-based)
  - Write access restricted (user can only update their own profile)

**Example Rules** (needs verification):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection - strict access control
    match /users/{userId} {
      // User can only read their own document
      allow read: if request.auth != null && request.auth.uid == userId;

      // User can only update their own document (limited fields)
      allow update: if request.auth != null
                    && request.auth.uid == userId
                    && !request.resource.data.diff(resource.data).affectedKeys()
                       .hasAny(['kennitala', 'isMember', 'uid']);

      // Only server (Cloud Functions) can create/delete
      allow create, delete: if false;
    }

    // Future: Admin role can read all users
    // match /users/{userId} {
    //   allow read: if request.auth != null
    //               && request.auth.token.admin == true;
    // }
  }
}
```

- [ ] Add security rules documentation to `members/README.md`
- [ ] Test rules with Firebase Emulator before deploying

---

#### Comment 2.5: CSRF Protection (State/Nonce)
**File**: `members/functions/main.py`
**Function**: `handle_kenni_auth`
**Priority**: **Security Critical** ("Þarf að gera meiri nonce og state (CSRF) tékk hér?")

**Original (Icelandic)**:
> Þarf að gera meiri nonce og state (CSRF) tékk hér?

**Translation**:
> Do we need to do more nonce and state (CSRF) checks here?

**Current Implementation**:
- ✅ State parameter used in OAuth flow
- ❓ State validation: **Needs review**

**Action Required**:
- [ ] **Verify state parameter validation** in `handle_kenni_auth`:
  - Is state stored in session before OAuth redirect?
  - Is state validated when callback returns?
  - Is state single-use (prevents replay)?
- [ ] **Add nonce to ID token validation** (if using OIDC):
```python
# Store nonce before redirect
nonce = secrets.token_urlsafe(32)
# ... store nonce in session ...

# Validate nonce in ID token claims
id_token_claims = verify_id_token(id_token)
if id_token_claims.get('nonce') != stored_nonce:
    raise ValueError('Invalid nonce')
```
- [ ] Document CSRF protection in code comments

**Note**: PKCE (code_challenge/code_verifier) already provides strong CSRF protection, but state parameter is additional defense-in-depth.

---

#### Comment 2.6: Client Secret with PKCE
**File**: `members/functions/main.py`
**Context**: OAuth client secret usage
**Priority**: **Security Question**

**Original (Icelandic)**:
> Þurfum við client_secret ef kenni styður public+PKCE?

**Translation**:
> Do we need client_secret if Kenni supports public+PKCE?

**Analysis**:
- **PKCE**: Designed for public clients (no client secret needed)
- **Current setup**: Uses both client_secret AND PKCE

**Action Required**:
- [ ] **Verify with Kenni.is**: Do they require client_secret even with PKCE?
- [ ] **If client_secret not required**:
  - Remove client_secret from token exchange
  - Remove `kenni-client-secret` from Secret Manager
  - Update OAuth configuration to "public client"
- [ ] **If client_secret required** (confidential client):
  - Document why (Kenni.is policy)
  - Keep current implementation

**Recommendation**: Check Kenni.is documentation. Many OIDC providers support PKCE without client_secret for better security (no secret to leak).

---

#### Comment 2.7: Custom Claims Overwriting
**File**: `members/functions/main.py`
**Function**: `verify_membership`
**Priority**: **Bug Risk** ("Yfirskrifar þetta custom_claims?")

**Original (Icelandic)**:
> Yfirskrifar þetta custom_claims sem voru sett í handleKenniAuth (email og sími)?

**Translation**:
> Does this overwrite the custom_claims that were set in handleKenniAuth (email and phone)?

**Analysis**:
If `verify_membership` calls `auth.set_custom_user_claims()` AFTER `handleKenniAuth`, it will **overwrite** previous claims.

**Action Required**:
- [ ] **Review claim setting logic**:
  - Are claims set in `handleKenniAuth`? (email, phone from Kenni.is)
  - Are claims set again in `verify_membership`? (isMember)
  - Do we merge or overwrite?
- [ ] **Fix if overwriting**:
```python
# Get existing claims
user = auth.get_user(uid)
existing_claims = user.custom_claims or {}

# Merge new claims
new_claims = {**existing_claims, 'isMember': is_member}

# Set merged claims
auth.set_custom_user_claims(uid, new_claims)
```
- [ ] Add test to verify claims persist correctly

---

#### Comment 2.8: Cache-Control Header for Tokens
**File**: `members/functions/main.py`
**Function**: Token response
**Priority**: **Security Enhancement**

**Original (Icelandic)**:
> Væri gott að bæta við Cache-Control: no-store svo tokeninn sé ekki cache-aður á client

**Translation**:
> Would be good to add Cache-Control: no-store so the token is not cached on client

**Action Required**:
- [ ] Add Cache-Control header to token response:
```python
response = jsonify({'token': custom_token, 'uid': uid})
response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, private'
response.headers['Pragma'] = 'no-cache'  # HTTP/1.0 compatibility
return response
```
- [ ] Prevents browser from caching tokens
- [ ] Reduces risk of token leakage via browser cache

---

#### Comment 2.9: Membership List Caching
**File**: `members/functions/main.py`
**Function**: `verify_membership` - Firebase Storage read
**Priority**: **Performance** ("Mun þetta fall verða að flöskuhálsi?")

**Original (Icelandic)**:
> Mun þetta fall verða að flöskuhálsi þegar það er áhlaup? Ef svo, kanski bæta við skammlífu cache (í minni)

**Translation**:
> Will this function become a bottleneck when there's a surge? If so, maybe add short-lived cache (in memory)

**Current Implementation**:
- Reads `kennitalas.txt` from Firebase Storage on every call
- 2,273 kennitala list (~24 KiB)

**Performance Analysis**:
- Peak load: 20 logins/minute during meeting start
- Firebase Storage read: ~100ms per request
- **20 req/min * 100ms = not a bottleneck**

**Action Required** (Future Optimization):
- [ ] **For MVP**: No caching needed (low traffic)
- [ ] **Future (if >100 req/min)**:
  - Add in-memory cache with 5-minute TTL:
```python
from functools import lru_cache
from datetime import datetime, timedelta

_membership_cache = None
_cache_expires = None

def get_membership_list():
    global _membership_cache, _cache_expires

    # Check cache
    if _membership_cache and _cache_expires and datetime.now() < _cache_expires:
        return _membership_cache

    # Cache miss - read from Storage
    _membership_cache = read_from_storage()
    _cache_expires = datetime.now() + timedelta(minutes=5)
    return _membership_cache
```
- [ ] Document caching strategy in `members/README.md`

---

#### Comment 2.10: Race Condition on User Creation
**File**: `members/functions/main.py`
**Function**: User creation logic
**Priority**: **Bug Risk - Critical**

**Original (Icelandic)**:
> Ef 2 (eða fleiri) beiðnir koma frá client fyrir sama notanda þá er hætta á að það skráist 2x sami aðili (af því við þurfum að bíða eftir að Firebase segi okkur hvort notandinn sé til eða ekki) - getum við gert eitthvað til að fyrirbyggja það að sami notandi skráist tvisvar, í öllum tilfellum?

**Translation**:
> If 2 (or more) requests come from client for the same user, there's a risk that the same person gets registered 2x (because we need to wait for Firebase to tell us if the user exists or not) - can we do something to prevent the same user from being registered twice, in all cases?

**Race Condition Scenario**:
```
Request A: Check if user exists → No → Create user
Request B: Check if user exists → No → Create user (race!)
```

**Action Required**:
- [ ] **Implement idempotency with kennitala as unique key**:

**Option 1: Use kennitala as Firebase UID** (Recommended)
```python
# Use kennitala hash as deterministic UID
uid = hashlib.sha256(kennitala.encode()).hexdigest()[:28]  # Firebase UID limit

try:
    user = auth.create_user(
        uid=uid,  # Deterministic UID prevents duplicates
        email=email,
        display_name=display_name
    )
except auth.UidAlreadyExistsError:
    # User already exists - this is OK (idempotent)
    user = auth.get_user(uid)
```

**Option 2: Firestore transaction with kennitala document**
```python
# Use Firestore transaction to prevent race
@firestore.transactional
def create_user_if_not_exists(transaction, kennitala):
    doc_ref = db.collection('users_by_kennitala').document(kennitala)
    doc = doc_ref.get(transaction=transaction)

    if doc.exists:
        return doc.to_dict()['uid']  # Already exists

    # Create user atomically
    user = auth.create_user(...)
    transaction.set(doc_ref, {'uid': user.uid, 'created_at': firestore.SERVER_TIMESTAMP})
    return user.uid
```

- [ ] Add retry logic for transient failures
- [ ] Test with concurrent requests (load test)

---

#### Comment 2.11: Membership List Update TODO
**File**: `members/functions/main.py`
**Context**: Static txt file for membership list
**Priority**: **Future Work**

**Original (Icelandic)**:
> Væri gott að setja // TODO og verkefni á þetta - viljum sennilega ekki vera að vísa í static txt skrá sem er fljótt úreld

**Translation**:
> Would be good to add // TODO and task on this - we probably don't want to be referencing a static txt file that quickly becomes outdated

**Action Required**:
- [ ] Add TODO comment in code:
```python
# TODO: Replace static txt file with API integration to membership database
# Current: Manual upload to Firebase Storage (kennitalas.txt)
# Future:
#   - Option A: Import from legacy system API
#   - Option B: Build admin UI for roster management
#   - Option C: Members system becomes "single source of truth"
# Related: PR #28 Comment by @agustka (membership roster sync)
```
- [ ] Create GitHub issue for membership roster synchronization
- [ ] Link to Ágúst's comment about "single source of truth"

---

#### Comment 2.12: Domain Redirect URL TODO
**File**: `members/functions/main.py`
**Context**: OAuth redirect_uri hardcoded
**Priority**: **Pre-Production Task**

**Original (Icelandic)**:
> Gætirðu sett // TODO og vísun í Task um að uppfæra þetta áður en við förum út með lausnina þannig að það vísi á okkar domain

**Translation**:
> Could you add // TODO and reference to Task about updating this before we go out with the solution so it points to our domain

**Action Required**:
- [ ] Add TODO comment:
```python
# TODO: Update redirect_uri to production domain before launch
# Current: https://ekklesia-prod-10-2025.web.app
# Production: https://members.samstada.is (or similar)
# Must also update Kenni.is OAuth configuration with new redirect_uri
```
- [ ] Create task: "Configure production domain and update OAuth redirect_uri"
- [ ] Document domain setup steps in deployment guide

---

#### Comment 2.13: Error Code 4xx vs 500
**File**: `members/functions/main.py`
**Context**: Error handling
**Priority**: **Code Quality**

**Original (Icelandic)**:
> Þetta er sennilega frekar einhver 4xx villa frekar en 500

**Translation**:
> This is probably more like a 4xx error rather than 500

**Action Required**:
- [ ] **Review error handling** - use appropriate HTTP status codes:
  - `400 Bad Request`: Invalid input (malformed kennitala, missing parameters)
  - `401 Unauthorized`: Invalid token, authentication failed
  - `403 Forbidden`: Valid auth but not allowed (not a member)
  - `404 Not Found`: Resource doesn't exist
  - `409 Conflict`: Duplicate resource (user already exists)
  - `429 Too Many Requests`: Rate limit exceeded
  - `500 Internal Server Error`: Unexpected server error only

**Example**:
```python
try:
    # Validate input
    if not kennitala or len(kennitala) != 11:
        return jsonify({'error': 'Invalid kennitala format'}), 400  # Not 500

    # Check membership
    if not is_member:
        return jsonify({'error': 'Not a member'}), 403  # Not 500

except Exception as e:
    # Only unexpected errors should be 500
    logger.error(f'Unexpected error: {e}')
    return jsonify({'error': 'Internal server error'}), 500
```

---

#### Comment 2.14: Environment Variable Validation
**File**: `members/functions/main.py`
**Context**: Configuration
**Priority**: **Fail-Fast**

**Original (Icelandic)**:
> Verum viss um að þetta vísi í rétt env gildi - og fail-fast ef það er rangt með skýrri villu

**Translation**:
> Make sure this points to correct env value - and fail-fast if it's wrong with clear error

**Action Required**:
- [ ] Add environment variable validation at function startup:
```python
import os

# Validate required environment variables at startup
REQUIRED_ENV_VARS = [
    'FIREBASE_PROJECT_ID',
    'KENNI_CLIENT_ID',
    'KENNI_ISSUER',
    'KENNI_CLIENT_SECRET'
]

for var in REQUIRED_ENV_VARS:
    if not os.getenv(var):
        raise ValueError(f'Missing required environment variable: {var}. '
                        f'Check Cloud Function configuration.')

# Validate format (e.g., URLs)
kenni_issuer = os.getenv('KENNI_ISSUER')
if not kenni_issuer.startswith('https://'):
    raise ValueError(f'KENNI_ISSUER must be HTTPS URL, got: {kenni_issuer}')
```

- [ ] Add startup logging:
```python
print(f'Cloud Function initialized with FIREBASE_PROJECT_ID={os.getenv("FIREBASE_PROJECT_ID")}')
```

---

#### Comment 2.15: Use normalize_kennitala Helper
**File**: `members/functions/main.py`
**Context**: Kennitala normalization
**Priority**: **Code Quality**

**Original (Icelandic)**:
> Notum normalize_kennitala fallið

**Translation**:
> Use the normalize_kennitala function

**Action Required**:
- [ ] Ensure `normalize_kennitala()` helper is used consistently:
```python
def normalize_kennitala(kennitala):
    """
    Normalize kennitala to DDMMYY-XXXX format.
    Handles both DDMMYY-XXXX and DDMMYYXXXX formats.
    """
    kennitala = kennitala.strip().replace(' ', '')

    if len(kennitala) == 10:
        # Add hyphen: DDMMYYXXXX -> DDMMYY-XXXX
        return f'{kennitala[:6]}-{kennitala[6:]}'
    elif len(kennitala) == 11 and kennitala[6] == '-':
        # Already normalized
        return kennitala
    else:
        raise ValueError(f'Invalid kennitala format: {kennitala}')

# Use everywhere:
kennitala = normalize_kennitala(request.get('kennitala'))
```

- [ ] Grep for kennitala handling and ensure normalization used

---

#### Comment 2.16: Rate Limiting (Comment 1)
**File**: `members/functions/main.py`
**Function**: Authentication endpoints
**Priority**: **Security - DDoS Protection**

**Original (Icelandic)**:
> Bæta við rate-limit virkni þannig að það sé ekki hægt að drepa okkur (eins auðveldlega)?

**Translation**:
> Add rate-limit functionality so it's not possible to kill us (as easily)?

**Action Required**:
- [ ] **Implement rate limiting** for Cloud Functions:

**Option 1: Cloud Armor (GCP built-in)**
```bash
# Apply rate limiting at load balancer level
gcloud compute security-policies create members-rate-limit \
  --description "Rate limit for Members service"

gcloud compute security-policies rules create 1000 \
  --security-policy members-rate-limit \
  --expression "origin.ip == '[SPECIFY]'" \
  --action "rate-based-ban" \
  --rate-limit-threshold-count 100 \
  --rate-limit-threshold-interval-sec 60
```

**Option 2: Application-level (Redis/Firestore)**
```python
from datetime import datetime, timedelta

def check_rate_limit(ip_address, limit=100, window_seconds=60):
    """
    Check if IP has exceeded rate limit.
    Uses Firestore for distributed rate limiting.
    """
    now = datetime.utcnow()
    window_start = now - timedelta(seconds=window_seconds)

    # Get request count in window
    rate_limit_ref = db.collection('rate_limits').document(ip_address)
    doc = rate_limit_ref.get()

    if doc.exists:
        requests = [r for r in doc.to_dict().get('requests', [])
                   if r > window_start]

        if len(requests) >= limit:
            return False, f'Rate limit exceeded: {len(requests)}/{limit} requests'

        requests.append(now)
        rate_limit_ref.update({'requests': requests})
    else:
        rate_limit_ref.set({'requests': [now]})

    return True, 'OK'

# In endpoint:
allowed, message = check_rate_limit(request.remote_addr)
if not allowed:
    return jsonify({'error': message}), 429
```

- [ ] Document rate limits in API documentation
- [ ] Set conservative limits for MVP (100 req/min per IP)

---

#### Comment 2.17: Rate Limiting (Comment 2 - Duplicate)
**File**: `members/functions/main.py`
**Priority**: **Security - DDoS Protection**

**Original (Icelandic)**:
> Bæta við rate-limit virkni þannig að það sé ekki hægt að drepa okkur (eins auðveldlega)?

**Translation**:
> Add rate-limit functionality so it's not possible to kill us (as easily)?

**Action Required**: Same as Comment 2.16 above (duplicate comment)

---

#### Comment 2.18: Code Organization - Split main.py
**File**: `members/functions/main.py`
**Context**: Code structure
**Priority**: **Code Quality / Maintainability**

**Original (Icelandic)**:
> Kannski væri skýrara að skipta main.py upp í nokkrar minni skrár t.d. helpers.py fyrir hjálparföll, auth_flow.py fyrir innskráningarflæði og membership.py fyrir meðlimaprófanir.

**Translation**:
> Maybe it would be clearer to split main.py into several smaller files, e.g. helpers.py for helper functions, auth_flow.py for login flow and membership.py for membership checks.

**Action Required**:
- [ ] **Refactor `members/functions/` directory structure**:

**Proposed Structure**:
```
members/functions/
├── main.py              # Entry point only (Flask app + routes)
├── auth_flow.py         # OAuth flow (handleKenniAuth logic)
├── membership.py        # Membership verification (verifyMembership logic)
├── helpers.py           # Shared utilities
│   ├── normalize_kennitala()
│   ├── validate_kennitala()
│   └── get_client_ip()
├── config.py            # Environment variable loading & validation
└── requirements.txt
```

**Example main.py**:
```python
from flask import Flask, request, jsonify
from auth_flow import handle_oauth_callback
from membership import verify_membership_status
from config import validate_config

app = Flask(__name__)
validate_config()  # Fail-fast on startup

@app.route('/handleKenniAuth', methods=['POST'])
def handle_kenni_auth():
    return handle_oauth_callback(request)

@app.route('/verifyMembership', methods=['POST'])
def verify_membership():
    return verify_membership_status(request)
```

- [ ] Keep existing functionality intact (just reorganize)
- [ ] Add unit tests for each module
- [ ] Update documentation with new structure

---

#### Comment 2.19: Move server.js to tools/
**File**: `members/server.js`
**Context**: Unused file in production
**Priority**: **Code Cleanup**

**Original (Icelandic)**:
> Þessi skrá er virðist ekki vera notuð fyrir vefsíðuna sem almenningur sér (Firebase Hosting hýsir aðeins statískar skrár). Kanski betra að færa hana í tools/ eða álíka möppu?

**Translation**:
> This file doesn't seem to be used for the website that the public sees (Firebase Hosting only hosts static files). Maybe better to move it to tools/ or similar folder?

**Action Required**:
- [ ] **Move `members/server.js` to `members/tools/local-dev-server.js`**:
```bash
mkdir -p members/tools
git mv members/server.js members/tools/local-dev-server.js
```

- [ ] Update `members/README.md` to document:
```markdown
## Local Development

### Option 1: Firebase Emulator (Recommended)
firebase emulators:start

### Option 2: Simple HTTP Server (Static files only)
node tools/local-dev-server.js
```

- [ ] Add comment in `tools/local-dev-server.js`:
```javascript
/**
 * Local development server for testing static files
 * NOT USED IN PRODUCTION - Firebase Hosting serves static files
 *
 * Usage: node tools/local-dev-server.js
 * Then visit: http://localhost:8080
 */
```

---

## Summary by Priority

### 🔴 Critical (Must Fix Before Production)
1. **Race condition on user creation** (Comment 2.10) - Implement idempotency
2. **Firestore security rules** (Comment 2.4) - Ensure users can't read others' profiles
3. **Rate limiting** (Comments 2.16, 2.17) - DDoS protection
4. **CSRF protection validation** (Comment 2.5) - Verify state parameter handling

### 🟡 Important (Should Fix for MVP)
5. **Database separation** (Comment 1.3) - Discuss with Ágúst: 1 vs 2 instances
6. **Idempotency & surge documentation** (Comment 1.4) - Cross-reference USAGE_CONTEXT.md
7. **Custom claims overwriting** (Comment 2.7) - Merge claims correctly
8. **Member roster sync** (Comment 2.1) - Document current process + future plan
9. **Audit logging** (Comment 2.3) - Add to verifyMembership
10. **Cache-Control headers** (Comment 2.8) - Prevent token caching

### 🟢 Nice to Have (Future Improvements)
11. **Code organization** (Comment 2.18) - Split main.py into modules
12. **Membership list caching** (Comment 2.9) - In-memory cache (if needed)
13. **Client secret removal** (Comment 2.6) - If Kenni supports PKCE without secret
14. **TODOs** (Comments 2.11, 2.12) - Add future work tracking
15. **Error codes** (Comment 2.13) - Use 4xx instead of 500
16. **Environment validation** (Comment 2.14) - Fail-fast on startup
17. **Helper function usage** (Comment 2.15) - Use normalize_kennitala everywhere
18. **File cleanup** (Comment 2.19) - Move server.js to tools/

### 📝 Documentation (Should Update)
19. **Member permissions clarification** (Comment 1.1) - SYSTEM_ARCHITECTURE_OVERVIEW.md
20. **Voting core responsibilities** (Comment 1.2) - Add 3 core responsibilities
21. **Token lifetime** (Comment 2.2) - Document in README

---

## Action Plan

### Phase 1: Critical Fixes (Before Merging PR #28)
- [ ] Implement user creation idempotency (Comment 2.10)
- [ ] Review and document Firestore security rules (Comment 2.4)
- [ ] Verify CSRF protection (state parameter) (Comment 2.5)
- [ ] Add basic rate limiting (Comments 2.16, 2.17)

### Phase 2: Important Updates (Before First Production Meeting)
- [ ] Discuss database separation with Ágúst (Comment 1.3)
- [ ] Update documentation with idempotency & surge (Comment 1.4)
- [ ] Fix custom claims merging (Comment 2.7)
- [ ] Add audit logging (Comment 2.3)
- [ ] Add Cache-Control headers (Comment 2.8)
- [ ] Document member roster sync process (Comment 2.1)

### Phase 3: Code Quality (Post-MVP)
- [ ] Refactor main.py into modules (Comment 2.18)
- [ ] Add all TODOs to code (Comments 2.11, 2.12)
- [ ] Fix error codes (Comment 2.13)
- [ ] Add environment validation (Comment 2.14)
- [ ] Ensure normalize_kennitala used everywhere (Comment 2.15)
- [ ] Move server.js to tools/ (Comment 2.19)

### Phase 4: Documentation Updates (Post-PR-Merge)
- [ ] Update SYSTEM_ARCHITECTURE_OVERVIEW.md (Comments 1.1, 1.2)
- [ ] Document token lifetime control (Comment 2.2)
- [ ] Update all technical documentation with Phase 1-2 changes

---

## Discussion Needed with Ágúst

### Question 1: Database Separation
**Context**: Comment 1.3
**Question**: Is schema-level separation (1 instance, 2 schemas) sufficient for MVP, or do we need 2 separate database instances for stronger isolation?
- Current: $7/month (1 instance)
- Proposed: $14/month (2 instances)
- Trade-off: Cost vs stronger security isolation

### Question 2: Client Secret with PKCE
**Context**: Comment 2.6
**Question**: Does Kenni.is support public client PKCE (without client_secret), or is client_secret required even with PKCE?
- Impact: Could remove `kenni-client-secret` from Secret Manager if not needed

### Question 3: Membership Roster Sync
**Context**: Comment 2.1
**Question**: Timeline for Members system becoming "single source of truth"? Until then, what's preferred sync method?
- Option A: Continue manual CSV upload
- Option B: Build API import from legacy system
- Option C: Build admin UI for roster management

---

## Files to Create

### 1. GitHub Issues
- [ ] Issue: "Implement user creation idempotency to prevent race conditions"
- [ ] Issue: "Add rate limiting to Cloud Functions"
- [ ] Issue: "Review and document Firestore security rules"
- [ ] Issue: "Add audit logging for membership verification"
- [ ] Issue: "Refactor members/functions/main.py into modules"
- [ ] Issue: "Document membership roster synchronization process"
- [ ] Issue: "Discuss: Database separation strategy (1 vs 2 instances)"

### 2. Documentation Updates
- [ ] `members/README.md`: Add sections for:
  - Token lifetime configuration
  - Audit logging
  - Firestore security rules
  - Membership roster sync process
  - Rate limiting details
- [ ] `docs/SYSTEM_ARCHITECTURE_OVERVIEW.md`: Update with:
  - Member permissions clarification (Comment 1.1)
  - Voting core responsibilities (Comment 1.2)

### 3. Code TODOs
- [ ] Add TODO comments to main.py:
  - Membership list static file (Comment 2.11)
  - Domain redirect URL (Comment 2.12)
  - Rate limiting placeholders (Comments 2.16, 2.17)

---

## Related Documentation

- **Original PR #28**: https://github.com/sosialistaflokkurinn/ekklesia/pull/28
- **PR #28 Squash Commit Message**: [PR28_SQUASH_COMMIT_MESSAGE.md](../../PR28_SQUASH_COMMIT_MESSAGE.md)
- **Phase 5 Complete**: [docs/status/PHASE_5_INTEGRATION_COMPLETE.md](PHASE_5_INTEGRATION_COMPLETE.md)
- **Usage Context (300 votes/sec)**: [docs/USAGE_CONTEXT.md](../USAGE_CONTEXT.md)

---

**Status**: 📋 Action items documented - Ready for implementation
**Total Comments**: 23 detailed review comments
**Reviewer**: @agustka (Ágúst Kárason)
**Review Date**: October 10, 2025 06:53 UTC
**Overall Status**: ✅ APPROVED (with suggested improvements)
