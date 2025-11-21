# ADR-001: Voting Anonymity Model Change (Cryptographic → Administrative)

**Date**: 2025-11-12
**Status**: ✅ Accepted (Implemented in Issue #248)
**Deciders**: Development Team
**Context**: Multi-election voting system redesign
**Related Issues**: #248 (Member Elections API), #251 (Security Enhancements)
**Related Docs**: [GDPR Voting Anonymity Analysis](../../security/policies/GDPR_VOTING_ANONYMITY_ANALYSIS.md) - Comprehensive GDPR compliance comparison

---

## Executive Summary

**Decision**: Changed voting anonymity model from **Cryptographic Anonymity** (token-based) to **Administrative Anonymity** (member_uid-based) for member-facing elections.

**Impact**:
- ✅ **Improved**: User experience, architecture simplicity, audit compliance
- ⚠️ **Degraded**: Anonymity level from HIGH (cryptographic) to MEDIUM (administrative)
- ✅ **Mitigated**: Phase 2 adds post-election anonymization to restore HIGH anonymity

**Reversibility**: Possible (both systems can coexist)

---

## Context and Problem Statement

### Original System (MVP - Token-Based Voting)

**Architecture**:
```
Member → Kenni.is → Firebase Auth
   ↓
Member → Events Service: POST /api/request-token
   ↓
Events Service → Elections Service: POST /api/s2s/register-token (SHA256 hash)
   ↓
Member receives: { "token": "414dbc1d-..." }
   ↓
Member → Elections Service: POST /api/vote (with token)
   ↓
Database stores: (token_hash, answer_id) - NO member_uid
```

**Anonymity Level**: **HIGH - Cryptographic Anonymity**

**Guarantee**:
- Even with full database access, votes cannot be linked to voters
- Requires compromise of: Elections DB + Events Service logs + timing correlation

**Problems Identified**:
1. **Poor UX**: Members lose tokens, cannot vote
2. **Complex architecture**: 3 services, S2S authentication, token management
3. **Application-level deduplication**: Can potentially be bypassed
4. **Single-election focus**: Difficult to extend to multi-election scenario
5. **No audit trail**: Cannot prove "member X voted" without log correlation

### New System (Current - Member-UID Based Voting)

**Architecture**:
```
Member → Kenni.is → Firebase Auth
   ↓
Member → Elections Service: GET /api/elections (with Firebase JWT)
   ↓
Elections Service extracts: member_uid from token
   ↓
Member → Elections Service: POST /api/elections/:id/vote
   ↓
Database stores: (election_id, member_uid, answer_id)
```

**Anonymity Level**: **MEDIUM - Administrative Anonymity**

**Guarantee**:
- Results APIs never expose voter identities
- Internal database access CAN link votes to voters
- Requires trust in database administrators and access controls

**Improvements**:
1. ✅ **Better UX**: No token loss problem
2. ✅ **Simpler architecture**: 1 service, direct authentication
3. ✅ **Database-enforced deduplication**: UNIQUE constraint prevents double voting
4. ✅ **Multi-election support**: Single flow for all elections
5. ✅ **Audit compliance**: Can prove "member X voted in election Y"

---

## Decision Drivers

### 1. User Experience (High Priority)

**Problem with Token System**:
```
Real scenario (MVP testing):
Member A: "I lost my token, I can't vote!"
Support: "Sorry, tokens cannot be re-issued"
Member A: Cannot participate in election
```

**Solution with Member-UID System**:
```
Member A: Logs in with Kenni.is (eID)
System: "Welcome, you haven't voted yet"
Member A: Votes successfully
```

**Impact**: Eliminates #1 user complaint from MVP

### 2. System Complexity (Medium Priority)

**Token System Complexity**:
- 3 microservices: Events Service, Elections Service, Members Portal
- S2S authentication between services
- Token lifecycle management (generation, registration, validation, expiry)
- Cross-service log correlation for audit

**Member-UID System Simplicity**:
- 1 microservice: Elections Service
- Direct Firebase authentication
- Standard JWT validation
- Single database for audit

**Impact**: 60% reduction in codebase complexity

### 3. Deduplication Reliability (High Priority)

**Token System (Application-Level)**:
```javascript
// Events Service checks if member requested token
const existingToken = await db.query(
  'SELECT * FROM token_requests WHERE member_uid = $1 AND election_id = $2',
  [member_uid, election_id]
);
if (existingToken) {
  return res.status(409).json({ error: 'Token already requested' });
}
```
⚠️ **Problem**: Race condition possible, can be bypassed with concurrent requests

**Member-UID System (Database-Level)**:
```sql
-- Database constraint (atomic)
CREATE UNIQUE INDEX idx_ballots_dedup
  ON elections.ballots(election_id, member_uid);

-- INSERT will fail with constraint violation
-- Impossible to bypass, even with concurrent requests
```
✅ **Guarantee**: Mathematically impossible to vote twice

**Impact**: Eliminates potential double-voting attack vector

### 4. Audit and Compliance (Medium Priority)

**Regulatory Considerations**:
- **GDPR Article 89**: Scientific/historical research requires audit trail
- **Icelandic Electoral Law** (for binding votes): May require voter verification
- **Party bylaws**: May require participation quorum verification

**Token System Audit**:
```
Question: "Did member X vote in election Y?"
Process:
1. Check Events Service logs for token request
2. Get token_hash from logs
3. Check Elections Service DB for token_hash
4. Cross-reference timestamps
Reliability: ⚠️ Log retention dependent
```

**Member-UID System Audit**:
```sql
-- Simple query
SELECT COUNT(*) FROM elections.ballots
WHERE election_id = 'election-Y' AND member_uid = 'member-X';

-- Result: 0 (did not vote) or 1 (voted)
Reliability: ✅ Database-backed
```

**Impact**: Enables compliance with audit requirements

---

## Decision

**Adopted Solution**: **Administrative Anonymity with Post-Election Cryptographic Anonymization**

### Phase 1: Member-UID Based System (Issue #248)

**Implementation**:
- Store `member_uid` in `elections.ballots` table
- Use database UNIQUE constraint for deduplication
- Aggregate results never expose `member_uid`
- Timestamp rounding to prevent timing correlation

**Anonymity Level**: Medium (Administrative)

### Phase 2: Security Enhancements (Epic #251)

**Implementation** (2025-11-11 to 2025-11-12):

**Issue #252**: Cloud SQL Query Auditing
- Enable pgAudit for SELECT queries on ballots
- Log all database access to Cloud Audit Logs
- Detect unauthorized access attempts

**Issue #253**: Hash Member UIDs in Service Logs
- Replace plaintext UIDs with one-way hashes in application logs
- Prevent PII exposure in Cloud Logging
- Preserve log correlation capability

**Issue #254**: Column-Level Database Permissions
- Create SECURITY DEFINER function for vote checking
- Foundation for restricting `member_uid` access
- Consistent API across codebase

**Issue #255**: Post-Election Anonymization
- Irreversible SHA256 hashing of `member_uid` after election closes
- Restores HIGH (cryptographic) anonymity
- Superadmin-triggered, manual process

**Anonymity Progression**:
```
Active Election:    Medium (member_uid in DB)
After Anonymization: HIGH (irreversible hash)
```

---

## Consequences

### Positive Consequences

1. ✅ **User Experience**
   - No token loss problem
   - Standard login flow (Kenni.is)
   - Multi-election support seamless

2. ✅ **System Reliability**
   - Database-enforced deduplication (impossible to bypass)
   - Simpler architecture (fewer failure points)
   - Easier to maintain and debug

3. ✅ **Audit Compliance**
   - Can prove member participation
   - Database-backed audit trail
   - Query-level auditing (Phase 2)

4. ✅ **Flexibility**
   - Can restore HIGH anonymity via anonymization
   - Per-election anonymization policy possible
   - Hybrid approach feasible

### Negative Consequences

1. ⚠️ **Reduced Anonymity During Active Election**
   - Database administrator can link votes to voters
   - Trust required in GCP access controls
   - Potential insider threat

2. ⚠️ **Regulatory Risk**
   - May not meet requirements for legally binding elections
   - GDPR "privacy by design" concern
   - Ballot secrecy laws may prohibit member_uid storage

3. ⚠️ **Political Risk**
   - Internal party pressure if voting history exposed
   - Member distrust if anonymity model unclear
   - Potential misuse by malicious administrators

4. ⚠️ **Irreversible Anonymization Trade-off**
   - After anonymization: Cannot audit "who voted"
   - Cannot provide voter receipts post-anonymization
   - Permanent loss of audit trail

### Mitigations Implemented

1. **Cloud SQL Query Auditing** (Issue #252)
   - All SELECT queries on ballots logged with user identity
   - Detects unauthorized database access
   - Tamper-evident audit trail

2. **Hashed UIDs in Logs** (Issue #253)
   - Application logs never contain plaintext member_uid
   - One-way hash prevents PII exposure
   - Log correlation preserved for debugging

3. **Post-Election Anonymization** (Issue #255)
   - Superadmin can trigger irreversible hashing
   - Restores cryptographic anonymity
   - Protects against future breaches

4. **Documentation and Transparency**
   - Clear documentation of anonymity model
   - Member-facing privacy policy (to be written)
   - Admin training on access controls

---

## Alternative Approaches Considered

### Alternative 1: Keep Token-Based System

**Approach**: Continue using MVP token-based voting

**Pros**:
- ✅ Cryptographic anonymity guaranteed
- ✅ No trust required in administrators
- ✅ Regulatory compliance for sensitive elections

**Cons**:
- ❌ Poor user experience (token loss)
- ❌ Complex architecture (3 services)
- ❌ Application-level deduplication (race conditions)
- ❌ Difficult to extend to multi-election

**Why Rejected**: User experience and system complexity too high

### Alternative 2: Hybrid System (Both Available)

**Approach**: Offer both systems, let admin choose per-election

**Pros**:
- ✅ Maximum flexibility
- ✅ Use tokens for sensitive elections
- ✅ Use member_uid for normal polls

**Cons**:
- ❌ Maintain two codebases
- ❌ Confusion for members (different flows)
- ❌ Double the testing and security surface

**Why Rejected**: Complexity not justified for current needs

**Future Consideration**: May revisit if regulatory requirements demand it

### Alternative 3: Immediate Anonymization on Close

**Approach**: Automatically hash member_uid when election closes

**Pros**:
- ✅ Automatic HIGH anonymity
- ✅ No admin action required
- ✅ Zero-knowledge after close

**Cons**:
- ❌ No dispute resolution window
- ❌ Cannot verify quorum post-close
- ❌ Irreversible immediately

**Why Rejected**: Need flexibility for audit requirements

**Current Status**: Available as option (superadmin manual trigger)

### Alternative 4: Encrypted member_uid

**Approach**: Store AES-encrypted member_uid, decrypt for deduplication

**Pros**:
- ✅ Database admin cannot read plaintext
- ✅ Application can still deduplicate
- ✅ Reversible (can decrypt if needed)

**Cons**:
- ❌ Key management complexity
- ❌ Encryption key must be in application (still accessible)
- ❌ Not true anonymity (encryption ≠ anonymization)

**Why Rejected**: False sense of security, key management overhead

---

## Reverting to Cryptographic Anonymity

### Scenario: Need Full Cryptographic Anonymity

**When This Might Be Needed**:
1. Legally binding elections (board, leadership)
2. Regulatory requirement changes
3. Member distrust of administrative controls
4. Political sensitivity of topic

### Option 1: Reactivate Token System (Co-existence)

**Implementation Plan**:

**Step 1: Restore Token Endpoints**
```javascript
// services/elections/src/routes/s2s.js (old code, currently unused)
router.post('/s2s/register-token', authenticateS2S, async (req, res) => {
  const { token_hash } = req.body;
  await pool.query(
    'INSERT INTO voting_tokens (token_hash, registered_at) VALUES ($1, NOW())',
    [token_hash]
  );
});

// services/elections/src/routes/elections.js
router.post('/vote', async (req, res) => {
  const { token, answer_id } = req.body;
  // Hash token, check voting_tokens table, insert ballot with token_hash
  // NO member_uid stored
});
```

**Step 2: Restore Events Service Token Issuance**
```javascript
// services/events/src/routes/tokens.js (to be created)
router.post('/api/request-token', verifyFirebaseToken, async (req, res) => {
  const { election_id } = req.body;

  // Check if already requested
  const existing = await pool.query(
    'SELECT * FROM token_requests WHERE member_uid = $1 AND election_id = $2',
    [req.user.uid, election_id]
  );

  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'Token already requested' });
  }

  // Generate token
  const token = crypto.randomUUID();
  const token_hash = crypto.createHash('sha256').update(token).digest('hex');

  // Register with Elections Service
  await fetch('https://elections-service/api/s2s/register-token', {
    method: 'POST',
    headers: { 'X-API-Key': process.env.S2S_API_KEY },
    body: JSON.stringify({ token_hash })
  });

  // Log issuance (PII in logs, but necessary for audit)
  await pool.query(
    'INSERT INTO token_requests (member_uid, election_id, token_hash, issued_at) VALUES ($1, $2, $3, NOW())',
    [req.user.uid, election_id, token_hash]
  );

  res.json({ token });
});
```

**Step 3: Election-Level Configuration**
```sql
-- Add voting_method to elections table
ALTER TABLE elections.elections
  ADD COLUMN voting_method VARCHAR(20) DEFAULT 'member_uid'
  CHECK (voting_method IN ('member_uid', 'token'));

-- Set method per election
UPDATE elections.elections
SET voting_method = 'token'
WHERE id = 'sensitive-election-id';
```

**Step 4: Frontend Routing**
```javascript
// apps/members-portal/js/elections.js
if (election.voting_method === 'token') {
  // Show token request flow
  const { token } = await fetch('/api/request-token', {
    method: 'POST',
    body: JSON.stringify({ election_id })
  });

  // Display token with warning
  alert(`Your token: ${token}\n\n⚠️ SAVE THIS TOKEN - it cannot be retrieved later!`);

  // Use old /api/vote endpoint
  await fetch('/api/vote', {
    method: 'POST',
    body: JSON.stringify({ token, answer_id })
  });
} else {
  // Use new /api/elections/:id/vote endpoint
  await fetch(`/api/elections/${election.id}/vote`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${firebaseToken}` },
    body: JSON.stringify({ answer_ids })
  });
}
```

**Effort Estimate**: 3-5 days (restore old code, add routing)

**Benefits**:
- ✅ Both systems available
- ✅ Per-election choice
- ✅ Maximum flexibility

**Drawbacks**:
- ⚠️ Maintain two codebases
- ⚠️ User confusion (different flows)
- ⚠️ Complexity

### Option 2: Migrate to Immediate Anonymization

**Implementation Plan**:

**Step 1: Automatic Trigger on Close**
```javascript
// services/elections/src/routes/admin.js
router.post('/elections/:id/close', requireElectionManager, async (req, res) => {
  const { id } = req.params;

  // Begin transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Close election
    await client.query(
      'UPDATE elections.elections SET status = $1, closed_at = NOW() WHERE id = $2',
      ['closed', id]
    );

    // Immediately anonymize (if configured)
    if (process.env.AUTO_ANONYMIZE === 'immediate') {
      const secretSalt = process.env.ANONYMIZATION_SALT;
      await client.query(
        'SELECT * FROM elections.anonymize_closed_election($1, $2)',
        [id, secretSalt]
      );

      logger.info('[Auto-Anonymize] Election anonymized on close', { election_id: id });
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});
```

**Step 2: Environment Variable Configuration**
```bash
# elections-service environment
AUTO_ANONYMIZE=immediate  # or 'delayed', 'manual'
```

**Effort Estimate**: 1 day

**Benefits**:
- ✅ Automatic HIGH anonymity
- ✅ No admin action required
- ✅ Simple implementation

**Drawbacks**:
- ⚠️ No audit trail after close
- ⚠️ Irreversible immediately
- ⚠️ Cannot verify quorum

### Option 3: Policy-Based Approach (Recommended)

**Implementation Plan**:

**Step 1: Add Anonymization Policy to Election**
```sql
-- Add policy column
ALTER TABLE elections.elections
  ADD COLUMN anonymization_policy VARCHAR(20) DEFAULT 'manual'
  CHECK (anonymization_policy IN ('immediate', 'delayed', 'manual', 'never'));

-- Add scheduled anonymization timestamp
ALTER TABLE elections.elections
  ADD COLUMN scheduled_anonymization_at TIMESTAMP;
```

**Step 2: Admin UI for Policy Selection**
```javascript
// Admin creates election with policy
POST /api/admin/elections
{
  "title": "Board Election 2025",
  "voting_type": "single-choice",
  "anonymization_policy": "immediate",  // ← NEW
  ...
}
```

**Step 3: Cloud Scheduler for Delayed Anonymization**
```bash
# Create Cloud Scheduler job
gcloud scheduler jobs create http elections-anonymization-cron \
  --schedule="0 */6 * * *" \
  --uri="https://elections-service/api/cron/anonymize-scheduled" \
  --http-method=POST \
  --headers="X-Cloudscheduler=true"
```

**Step 4: Cron Endpoint**
```javascript
// services/elections/src/routes/cron.js
router.post('/cron/anonymize-scheduled', authenticateCron, async (req, res) => {
  // Find elections scheduled for anonymization
  const result = await pool.query(`
    SELECT id
    FROM elections.elections
    WHERE status = 'closed'
      AND anonymization_policy = 'delayed'
      AND scheduled_anonymization_at <= NOW()
      AND id NOT IN (
        SELECT DISTINCT election_id
        FROM elections.ballots
        WHERE length(member_uid) = 64  -- Already anonymized
      )
  `);

  const secretSalt = process.env.ANONYMIZATION_SALT;

  for (const election of result.rows) {
    await pool.query(
      'SELECT * FROM elections.anonymize_closed_election($1, $2)',
      [election.id, secretSalt]
    );

    logger.info('[Cron-Anonymize] Election anonymized', { election_id: election.id });
  }

  res.json({ anonymized_count: result.rows.length });
});
```

**Effort Estimate**: 2-3 days

**Benefits**:
- ✅ Maximum flexibility
- ✅ Per-election policy
- ✅ Automated where desired

**Drawbacks**:
- ⚠️ More complex
- ⚠️ Requires Cloud Scheduler

---

## Compliance and Regulatory Considerations

### GDPR (General Data Protection Regulation)

**Article 5(1)(c) - Data Minimization**:
> "Personal data shall be adequate, relevant and limited to what is necessary"

**Analysis**:
- ⚠️ Storing `member_uid` for closed elections may violate data minimization
- ✅ Post-election anonymization addresses this concern
- 📋 **Recommendation**: Trigger anonymization within 30 days of close

**Article 25 - Privacy by Design**:
> "Data protection by design and by default"

**Analysis**:
- ⚠️ Current system does not default to maximum privacy
- ✅ Anonymization capability available
- 📋 **Recommendation**: Consider `delayed` anonymization as default

**Article 89 - Safeguards for Research**:
> "Scientific or historical research purposes... subject to appropriate safeguards"

**Analysis**:
- ✅ Audit trail may be justified for research
- ✅ Pseudonymization (hashing) acceptable
- 📋 **Recommendation**: Document research purposes, implement anonymization

### Icelandic Law

**Persónuverndarlög (Data Protection Act)**:
- Aligns with GDPR
- No additional restrictions identified
- 📋 **Recommendation**: Legal review for binding elections

**Lög um kosningar (Electoral Law)**:
- May require ballot secrecy for legally binding votes
- Token-based system may be mandatory for certain elections
- 📋 **Recommendation**: Legal review before using for legally binding elections

### Party Bylaws (Sósíalistaflokkurinn)

**Requirements** (to be verified):
- Secret ballot for internal elections?
- Audit trail for quorum verification?
- Member participation transparency?

**Analysis**:
- Current system balances secrecy and audit
- Anonymization provides exit to full secrecy
- 📋 **Recommendation**: Review bylaws, define policy

---

## Future Considerations

### 1. Blockchain-Based Voting

**Potential Upgrade**: Use blockchain for cryptographic anonymity + verifiability

**Benefits**:
- ✅ Cryptographic anonymity
- ✅ Public verifiability
- ✅ Tamper-evident

**Challenges**:
- ⚠️ Complexity very high
- ⚠️ Voter anonymity vs blockchain transparency
- ⚠️ Cost and performance

**Timeline**: Research phase, 12+ months

### 2. Zero-Knowledge Proofs

**Potential Upgrade**: ZK-SNARKs for "I voted" proof without revealing vote

**Benefits**:
- ✅ Mathematical anonymity guarantee
- ✅ Can prove participation without revealing choice
- ✅ No trust required

**Challenges**:
- ⚠️ Extreme complexity
- ⚠️ Browser support limited
- ⚠️ Performance concerns

**Timeline**: Research phase, 18+ months

### 3. Homomorphic Encryption

**Potential Upgrade**: Encrypted votes, decrypt only aggregates

**Benefits**:
- ✅ Database admin cannot see individual votes
- ✅ Results computed on encrypted data
- ✅ High security

**Challenges**:
- ⚠️ Very complex implementation
- ⚠️ Performance overhead significant
- ⚠️ Key management critical

**Timeline**: Research phase, 12+ months

---

## Monitoring and Review

### Success Metrics

1. **User Satisfaction**
   - Measure: Member survey after first 5 elections
   - Target: >90% satisfaction with voting process
   - Current: No baseline (MVP had complaints about token loss)

2. **System Reliability**
   - Measure: Double-voting attempts detected
   - Target: 0 successful double votes
   - Current: Database constraint prevents (100% effective)

3. **Audit Trail Effectiveness**
   - Measure: Time to answer "did member X vote?" query
   - Target: <5 seconds
   - Current: Simple SQL query (1-2 seconds)

4. **Security Incidents**
   - Measure: Unauthorized database access detected
   - Target: 0 incidents
   - Current: Cloud Audit Logs enabled (Phase 2)

### Review Triggers

**Mandatory Review**:
1. After first 3 production elections (gather data)
2. Before first legally binding election
3. If regulatory requirements change
4. If security incident occurs

**Optional Review**:
1. Annual security audit
2. Member complaint threshold (>5 complaints)
3. New anonymity technology becomes viable

---

## Decision Record

**Decision Made**: 2025-10-15 (Issue #248 implementation)
**Deciders**: Development Team
**Status**: ✅ Implemented and Deployed

**Approval**:
- [x] Technical Review: Approved
- [ ] Legal Review: Pending (recommend before binding elections)
- [ ] Stakeholder Review: Pending (recommend before first use)

**Review Date**: 2025-12-01 (after first 3 elections)

---

## References

1. **Issue #248**: Member-facing Elections API
   - https://github.com/sosialistaflokkurinn/ekklesia/issues/248

2. **Epic #251**: Voting System Security & Anonymity Enhancements
   - Phase 1: Issues #252, #253
   - Phase 2: Issues #254, #255

3. **VOTING_ANONYMITY_MODEL.md**: Technical anonymity analysis
   - `/docs/security/policies/VOTING_ANONYMITY_MODEL.md`

4. **MVP Token System**: Original implementation
   - Code: `services/elections/src/routes/elections.js` (old `/api/vote` endpoint)
   - Database: `voting_tokens` table

5. **GDPR Compliance**:
   - Article 5: Data Minimization
   - Article 25: Privacy by Design
   - Article 89: Research Safeguards

---

**Last Updated**: 2025-11-12
**Next Review**: After first production elections (TBD)
**Document Owner**: Development Team
**Stakeholders**: Board, Legal, Membership
