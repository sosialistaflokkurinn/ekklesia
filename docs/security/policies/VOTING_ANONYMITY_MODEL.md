# Voting Flow & Anonymity Analysis

**Date**: 2025-11-11
**Status**: 📋 Documentation - Future Enhancement Roadmap
**Purpose**: Compare MVP token-based flow vs current member-based flow, evaluate anonymity implications
**Context**: Continued from Issue #248 implementation

---

## Executive Summary

The Ekklesia voting system has evolved from a **token-based anonymous voting system** (MVP) to a **member-authenticated voting system with anonymized results** (current implementation).

**Key Findings**:
- ✅ **Anonymity in Results**: Vote aggregation never exposes individual voter identities
- ⚠️ **Database-Level Linkability**: `member_uid` stored in ballots allows linking votes to Firebase accounts
- ⚠️ **Audit Trail**: System can determine "who voted" (but not "how they voted" without admin access)
- ✅ **Deduplication**: Prevents double voting effectively
- ⚠️ **Trust Model Changed**: From "no one can link votes to voters" to "admins with DB access can link votes to voters"

---

## Original MVP Flow (Token-Based Anonymous Voting)

### Flow Diagram
```
1. Member → Kenni.is (eID) → Firebase Authentication
   ↓
2. Member → Events Service: POST /api/request-token
   Headers: Authorization: Bearer <Firebase JWT>
   ↓
3. Events Service validates:
   - Firebase token valid ✅
   - Member hasn't requested token already ✅
   - Election is active ✅
   ↓
4. Events Service generates: UUID token (e.g., "414dbc1d-5ef4-4a7f-a3ac-d1b49f6fb945")
   ↓
5. Events Service → Elections Service: POST /api/s2s/register-token
   Body: { "token_hash": "sha256(token)" }
   Auth: X-API-Key (service-to-service)
   ↓
6. Elections Service stores:
   INSERT INTO voting_tokens (token_hash) VALUES ('a1b2c3d4...')
   ↓
7. Events Service → Member: { "token": "414dbc1d-..." }
   ⚠️ Member must save token (cannot retrieve later)
   ↓
8. Member → Elections Service: POST /api/vote
   Body: { "token": "414dbc1d-...", "answer": "yes" }
   ↓
9. Elections Service:
   - Hashes token → checks voting_tokens table ✅
   - Marks token as used (used = TRUE) ✅
   - Inserts ballot:
     INSERT INTO ballots (token_hash, answer, submitted_at)
     VALUES ('a1b2c3d4...', 'yes', NOW())
   ↓
10. Result: Anonymous ballot stored (no member_uid)
```

### Key Characteristics

**Who Issues Tokens**: **Events Service**

**Anonymity Level**: **High**
- No `member_uid` stored in ballots
- Only `token_hash` (SHA256 of random UUID)
- Impossible to link ballot to voter without Events Service token issuance log

**Deduplication**: One token per member per election (enforced by Events Service)

**Database Tables**:
```sql
-- voting_tokens table
token_hash   | used | registered_at
-------------|------|---------------
a1b2c3d4...  | TRUE | 2025-10-15 19:45:30

-- ballots table (MVP)
id          | token_hash  | answer | submitted_at
------------|-------------|--------|---------------
uuid-1234   | a1b2c3d4... | yes    | 2025-10-15 19:46:00
```

**Audit Trail**:
- Events Service logs: "kennitala X requested token at TIME" (PII in logs)
- Elections Service logs: "token_hash Y voted at TIME" (no PII)
- Linking requires: Access to both service logs + token issuance records

---

## Current Flow (Member-Based Authenticated Voting)

### Flow Diagram
```
1. Member → Kenni.is (eID) → Firebase Authentication
   ↓
2. Member → Elections Service: GET /api/elections
   Headers: Authorization: Bearer <Firebase JWT>
   ↓
3. Elections Service verifies Firebase token:
   - Extracts member_uid from token ✅
   - Checks eligibility ✅
   - Returns elections with has_voted flag
   ↓
4. Member → Elections Service: POST /api/elections/:id/vote
   Headers: Authorization: Bearer <Firebase JWT>
   Body: { "answer_ids": ["answer-1"] }
   ↓
5. Elections Service (atomic transaction):
   - BEGIN TRANSACTION
   - SELECT * FROM elections WHERE id = $1 FOR UPDATE (lock row)
   - Check member hasn't voted:
     SELECT COUNT(*) FROM ballots
     WHERE election_id = $1 AND member_uid = $2
   - If voted → ROLLBACK + 409 Conflict
   - Insert ballot(s):
     INSERT INTO elections.ballots
       (election_id, member_uid, answer_id, answer, token_hash, submitted_at)
     VALUES
       ($election_id, $firebase_uid, $answer_id, $answer_text, $sentinel_token, NOW())
   - COMMIT TRANSACTION
   ↓
6. Result: Ballot stored with member_uid
```

### Key Characteristics

**Who Issues Tokens**: **No tokens issued** (direct Firebase authentication)

**Anonymity Level**: **Partial**
- ✅ **Results are anonymized**: Aggregation never returns member_uid
- ⚠️ **Database contains member_uid**: Direct link between Firebase UID and ballot
- ⚠️ **Timestamp rounded**: `date_trunc('minute', NOW())` prevents timing-based identification

**Deduplication**: `UNIQUE INDEX (election_id, member_uid)` - database-enforced

**Database Tables**:
```sql
-- ballots table (current)
id          | election_id | member_uid           | answer_id | token_hash    | submitted_at
------------|-------------|----------------------|-----------|---------------|---------------
uuid-5678   | uuid-0001   | NE5e8GpzzBcjxuTH... | js        | 000...000 (64)| 2025-11-11 15:37:00

-- Note: token_hash uses sentinel value (64 zeros) for FK constraint satisfaction
```

**Audit Trail**:
- Elections Service logs: "uid: NE5e8GpzzBc... voted in election uuid-0001 at TIME"
- Database ballots: Direct linkage `(election_id, member_uid, answer_id)`

---

## Anonymity Comparison

| Aspect | MVP (Token-Based) | Current (Member-UID) |
|--------|-------------------|----------------------|
| **Voter Identity in Ballots** | ❌ No (only token_hash) | ✅ Yes (member_uid stored) |
| **Results Expose Voters** | ❌ No | ❌ No (aggregation only) |
| **DB Admin Can Link Vote to Voter** | ⚠️ Difficult (requires service logs) | ✅ Yes (direct column) |
| **Timing-Based Identification** | ⚠️ Possible (exact timestamp) | ✅ Prevented (rounded to minute) |
| **Token Loss Recovery** | ❌ No (token cannot be retrieved) | ✅ N/A (uses authentication) |
| **Deduplication Enforcement** | ⚠️ Application-level (Events Service) | ✅ Database-level (UNIQUE constraint) |
| **Service Complexity** | ⚠️ High (3 services, S2S calls) | ✅ Low (direct authentication) |
| **Anonymity Level** | **High** | **Medium** |

---

## Anonymity Evaluation: Current System

### ✅ Protections in Place

1. **Results Aggregation Function**:
```sql
CREATE FUNCTION elections.get_election_results(p_election_id uuid)
RETURNS TABLE(answer_id VARCHAR, votes BIGINT, percentage NUMERIC)
```
- ✅ Returns only: `(answer_id, vote_count, percentage)`
- ✅ Never returns `member_uid` or `ballot_id`
- ✅ Pure aggregation - cannot reverse-engineer individual votes

2. **API Response Filtering**:
```javascript
// services/elections/src/routes/elections.js:465
const results = resultsData.rows.map(row => ({
  answer_id: row.answer_id,
  text: answer.text,
  votes: parseInt(row.votes, 10),
  percentage: parseFloat(row.percentage),
}));
// ✅ No member_uid or ballot_id returned
```

3. **Timestamp Rounding**:
```javascript
// services/elections/src/routes/elections.js:323
submitted_at = date_trunc('minute', NOW())
// Rounds to: 2025-11-11 15:37:00 (not 15:37:42.123)
```
- ✅ Prevents timing correlation attacks
- ✅ Multiple voters in same minute are indistinguishable by timestamp

4. **Unique Constraint Deduplication**:
```sql
CREATE UNIQUE INDEX idx_ballots_election_member_dedup
  ON ballots(election_id, member_uid);
```
- ✅ Database-level enforcement (cannot bypass in application code)
- ✅ Atomic transaction with row locking prevents race conditions

5. **Eligibility Filtering**:
```javascript
// Only eligible members see elections
if (!isEligible(election, req)) {
  return res.status(403);
}
```
- ✅ Admin-only elections hidden from members
- ✅ Member role verified via Firebase token

### ⚠️ Anonymity Weaknesses

1. **Database Administrator Access**:
```sql
-- Admin with DB access can run:
SELECT
  e.title,
  e.question,
  b.member_uid,
  b.answer_id,
  b.submitted_at
FROM elections.ballots b
JOIN elections.elections e ON b.election_id = e.id
WHERE b.member_uid = 'NE5e8GpzzBcjxuTHWGuJtTfevPD2';

-- Result: Complete voting history for specific member
```
- ⚠️ **Implication**: Anyone with `SELECT` on `elections.ballots` can link votes to voters
- ⚠️ **Who has access**:
  - GCP project OWNER role (currently: gudro@socialist.is)
  - Cloud SQL database roles with `GRANT SELECT ON elections.ballots`

2. **Service Logs Contain member_uid**:
```javascript
// services/elections/src/routes/elections.js:334
logger.info('[Member API] Vote submitted', {
  uid: req.user.uid,  // ⚠️ Firebase UID logged
  election_id: id,
  ballot_ids: ballotIds,
});
```
- ⚠️ **Implication**: Cloud Logging contains `(uid, election_id, timestamp)` tuples
- ⚠️ **Who has access**:
  - GCP project OWNER
  - Users with `roles/logging.viewer`

3. **No Encryption at Rest for member_uid**:
- ⚠️ Database backups contain plaintext `member_uid`
- ⚠️ Point-in-time recovery snapshots contain voting history

4. **Correlation via has_voted Flag**:
```javascript
// GET /api/elections response includes:
{
  "id": "election-001",
  "has_voted": true  // ⚠️ Reveals member voted in this election
}
```
- ⚠️ **Implication**: Member's own API calls reveal they voted (but not how)
- ⚠️ **Attack vector**: Phishing/social engineering to extract has_voted status

### 🚨 Critical Scenarios

**Scenario 1: Database Breach**
- **Risk**: Attacker with DB access exports entire `ballots` table
- **Exposed**: Complete voting history for all members (member_uid → answer_id mapping)
- **Mitigation**: None (design limitation)

**Scenario 2: Insider Threat**
- **Risk**: Malicious DB admin queries individual voting records
- **Exposed**: Specific member's vote history
- **Mitigation**:
  - Audit logging (Cloud Audit Logs track DB queries)
  - Principle of least privilege (restrict DB access)

**Scenario 3: Backup Restoration**
- **Risk**: Historical voting data restored from backup
- **Exposed**: Past votes with member_uid intact
- **Mitigation**: Backup encryption (already enabled on Cloud SQL)

---

## Design Decision Rationale (from Issue #248)

From the issue description:

> "Unlike the old single-election `/api/vote` endpoint (which uses anonymous tokens), this endpoint uses **Firebase UID for deduplication** but **anonymizes in results**."

> "**Vote Deduplication Strategy**: Uses Firebase UID (not anonymous tokens like old system)"

> "**Security Notes**: UID is stored for deduplication only (one vote per member per election). UID is never exposed in results (anonymized aggregation)."

### Why the Change?

**Advantages of Member-UID System**:
1. ✅ **Simplified architecture**: No token issuance service needed
2. ✅ **Better UX**: No "lost token" problem
3. ✅ **Database-enforced deduplication**: Impossible to vote twice (vs application-level)
4. ✅ **Multi-election support**: Single flow for all elections
5. ✅ **Audit compliance**: Can prove member voted (without revealing vote content)

**Trade-offs**:
1. ⚠️ **Reduced anonymity**: DB admins can link votes to voters
2. ⚠️ **Trust model shift**: From "cryptographic anonymity" to "administrative anonymity"
3. ⚠️ **Regulatory risk**: GDPR/privacy laws may require higher anonymity for certain elections

---

## Anonymity Model: Before vs After

### MVP Model: "Cryptographic Anonymity"
- **Guarantee**: Even with full database access, votes cannot be linked to voters without service logs
- **Trust Required**: None (cryptographically enforced)
- **Attack Surface**: Must compromise both Elections Service DB + Events Service logs + timing correlation

### Current Model: "Administrative Anonymity"
- **Guarantee**: Results APIs never expose voter identities; internal access required to link votes
- **Trust Required**: Trust in database administrators and GCP access controls
- **Attack Surface**: Single database query can link votes to voters

---

## Recommendations

### 1. Document Trust Model

**Action**: Update security documentation to explicitly state:
- ✅ "Members cannot see each other's votes"
- ⚠️ "Database administrators can link votes to voters"
- ✅ "Election results are aggregated and anonymous"

**Status**: ✅ **Completed** (this document)

### 2. Implement Query Auditing

**Action**: Enable Cloud Audit Logs for database queries
```sql
-- Track all SELECT queries on ballots table
ALTER DATABASE ekklesia SET log_statement = 'all';
```

**Benefit**: Detect unauthorized access to voting records

**Status**: ⏳ **Future Enhancement**

### 3. Consider Removing member_uid After Election Closes

**Action**: Implement post-election anonymization
```sql
-- After election closes, hash member_uid for deduplication preservation
UPDATE elections.ballots
SET member_uid = sha256(member_uid || election_id || secret_salt)
WHERE election_id = $closed_election_id;
```

**Trade-off**:
- ✅ Increases anonymity (one-way hash)
- ⚠️ Prevents audit queries like "did member X vote in election Y?"

**Status**: ⏳ **Future Enhancement** (evaluate need)

### 4. Restrict Database Access

**Action**: Create read-only service account for Elections Service
```bash
# Create service account with minimal permissions
gcloud iam service-accounts create elections-service-readonly
gcloud sql users create elections-service-readonly

# Grant SELECT on elections table, but NOT on ballots.member_uid
GRANT SELECT (id, election_id, answer_id, submitted_at) ON elections.ballots TO elections_service;
REVOKE SELECT (member_uid) ON elections.ballots FROM elections_service;
```

**Benefit**: Even if Elections Service is compromised, cannot query member_uid

**Status**: ⏳ **Future Enhancement**

### 5. Add Ballot Encryption (Future Enhancement)

**Action**: Encrypt `answer_id` field at application level
```javascript
// Before insert:
const encryptedAnswer = encrypt(answer_id, election_key);

// After election closes:
const decryptedAnswer = decrypt(ballot.answer_id, election_key);
```

**Benefit**: Database admin cannot see vote content without decryption key

**Status**: ⏳ **Future Enhancement** (major architectural change)

---

## Use Case Analysis

### Socialist Party Iceland Context

**Question**: Is the current anonymity level acceptable?

**Considerations**:
1. **Internal party elections**: Members may expect full anonymity
2. **Transparency requirements**: Party may need to verify "member X voted" for quorum
3. **Legal requirements**: Icelandic privacy laws (Persónuverndarlög)
4. **Political sensitivity**: Voting record linkage could be used for internal pressure

**Recommendation**:
- ✅ Current system is acceptable for **non-binding polls** and **public votes**
- ⚠️ Consider reverting to token-based system for **binding elections** or **sensitive topics**

---

## Conclusion

### Summary Table

| Requirement | MVP System | Current System | Meets Requirement? |
|-------------|-----------|----------------|-------------------|
| Prevent double voting | ✅ | ✅ | Yes (both) |
| Members cannot see others' votes | ✅ | ✅ | Yes (both) |
| Public results aggregation | ✅ | ✅ | Yes (both) |
| Admins cannot link votes to voters | ✅ | ❌ | **No (regressed)** |
| Audit trail for "who voted" | ⚠️ (requires logs) | ✅ | **Improved** |
| User experience (no token loss) | ❌ | ✅ | **Improved** |

### Final Assessment

**Anonymity Level**: **Medium (Administrative Anonymity)**

**Acceptable for**:
- ✅ Public opinion polls
- ✅ Non-binding votes
- ✅ Elections where "who voted" transparency is required

**Not recommended for**:
- ❌ Legally binding elections requiring ballot secrecy
- ❌ Highly sensitive political decisions
- ❌ Scenarios where database administrator is not trusted

### Next Steps

1. **Short-term**: ✅ Document current trust model in security docs (completed)
2. **Medium-term**: ⏳ Implement query auditing and access restrictions
3. **Long-term**: ⏳ Evaluate need for post-election anonymization or reversion to token-based system

---

## Related Documentation

- [Database Schema](../../features/election-voting/DATABASE_SCHEMA.md) - Elections database schema reference
- [Admin API Reference](../../features/election-voting/ADMIN_API_REFERENCE.md) - API endpoints documentation
- [PII Guidelines](../PII_GUIDELINES.md) - Personal data handling policies
- [Issue #248](https://github.com/sosialistaflokkurinn/ekklesia/issues/248) - Member-facing Elections API implementation

---

**Document Status**: ✅ Documented for future review
**Last Updated**: 2025-11-11
**Next Review**: When planning sensitive/binding elections
**Action Required**: Decision on anonymity enhancements for production use
