# Elections Service MVP Design Document

**Component**: Elections System (`Kosningar`)
**Status**: ✅ Phase 5 Complete - Full Integration with Events Service
**Last Updated**: 2025-10-10
**Production URL**: https://elections-service-521240388393.europe-west2.run.app
**Purpose**: Anonymous ballot recording for the Events Service MVP

---

## Overview

The Elections service is the secure, anonymous ballot recording component that:
- Validates one-time voting tokens (issued by Events service via S2S)
- Records ballots anonymously (no PII, no member information)
- Enforces one-token-one-vote constraint
- Returns results to Events service (S2S)
- Supports yes/no/abstain voting (MVP scope)

**Key Principle**: This service has **zero knowledge** of member identities. It only knows about token hashes.

**⚠️ Critical Design Constraint**: This service must handle **300 votes/second spike** during the first 3 seconds of voting. See [USAGE_CONTEXT.md](../USAGE_CONTEXT.md) for full load characteristics.

---

## MVP Scope (Aligned with Events Service MVP)

### What's Included:
✅ One election (Prófunarkosning 2025)
✅ One question (hardcoded, yes/no/abstain)
✅ Accept voting tokens via S2S from Events
✅ Record anonymous ballots
✅ One vote per token (database constraint)
✅ Return results via S2S to Events
✅ Simple synchronous processing (no queue)

### What's Deferred (Future Phases):
⏸️ Multiple elections
⏸️ Multiple questions per election
⏸️ Question table (hardcoded for MVP)
⏸️ Pub/Sub queue (not needed for low traffic MVP)
⏸️ Ranked choice voting
⏸️ Single choice voting
⏸️ Complex ballot schemas

---

## Architecture Principles

### Anonymity First
- **No PII**: Service knows nothing about members (only token hashes)
- **No tracking**: Cannot link ballot to member identity
- **No authentication**: Members use one-time tokens only
- **Append-only**: Ballots are immutable once recorded

### Security Model
- One-time tokens (SHA-256 hashed by Events, sent to Elections via S2S)
- Database constraints prevent double voting (UNIQUE token_hash)
- S2S authentication for Events service communication (API key)
- Audit trail without identity exposure

### Simplicity (YAGNI)
- Synchronous processing (no message queue for MVP)
- Hardcoded election/question for MVP
- Direct database writes (ACID guarantees)
- Minimal dependencies

---

## Technology Stack

### Runtime
**Decision**: Node.js 18 + Express
**Rationale**:
- Matches Events service (consistent stack)
- Fast async I/O
- Lightweight, scalable
- Team familiarity

### Database
**Decision**: Cloud SQL PostgreSQL 15 (ekklesia-db instance, separate schema)
**Rationale**:
- Strong ACID guarantees (critical for voting)
- Unique constraints prevent double voting
- Reliable transaction support
- Same instance as Events (cost optimization)
- Separate schema (data isolation)

### Deployment
**Decision**: Cloud Run
**Rationale**:
- Serverless, auto-scaling
- No min instances = cost efficient
- Matches Events/Members deployment model
- Simple deployment via deploy.sh script

---

## Data Model (MVP Simplified)

### Database Schema

```sql
-- Elections Service schema (separate from Events schema)
-- MVP: Hardcoded election, no elections table needed yet

-- Voting Tokens (registered by Events via S2S)
CREATE TABLE voting_tokens (
    token_hash VARCHAR(64) PRIMARY KEY,  -- SHA-256 from Events service
    registered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    used BOOLEAN NOT NULL DEFAULT FALSE,
    used_at TIMESTAMP WITH TIME ZONE,

    -- No PII, no member info, just token hash
    CONSTRAINT valid_token_hash CHECK (length(token_hash) = 64)
);

CREATE INDEX idx_voting_tokens_used ON voting_tokens(used);

-- Ballots (anonymous, append-only)
CREATE TABLE ballots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash VARCHAR(64) NOT NULL,

    -- Answer for MVP (yes/no/abstain for single hardcoded question)
    answer VARCHAR(20) NOT NULL,

    -- Timestamp (rounded to nearest minute for anonymity)
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT
        date_trunc('minute', NOW()),

    -- Constraints
    UNIQUE(token_hash),  -- One vote per token
    CONSTRAINT valid_answer CHECK (answer IN ('yes', 'no', 'abstain')),
    FOREIGN KEY (token_hash) REFERENCES voting_tokens(token_hash)
);

CREATE INDEX idx_ballots_answer ON ballots(answer);
CREATE INDEX idx_ballots_submitted_at ON ballots(submitted_at);

-- Audit Log (system events only, no PII)
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    action VARCHAR(100) NOT NULL,  -- 'register_token', 'record_ballot', 'fetch_results'
    success BOOLEAN NOT NULL,
    details JSONB,  -- Never contains PII, only token_hash prefix for debugging

    -- Performance index
    CHECK (timestamp >= NOW() - INTERVAL '1 year')  -- Partition by year in future
);

CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_log_action ON audit_log(action);
```

---

## API Design

### Server-to-Server Endpoints (Events Service Only)

All S2S endpoints require authentication via `X-API-Key` header.

```
POST   /api/s2s/register-token
       Register voting token (called by Events when member requests token)

       Headers: X-API-Key: <shared-secret>
       Body: { token_hash: string }

       Returns: { success: true, token_hash: string }
       Errors: 409 (token already registered), 400 (invalid hash)

GET    /api/s2s/results
       Fetch election results (called by Events after election closes)

       Headers: X-API-Key: <shared-secret>

       Returns: {
         total_ballots: number,
         results: {
           yes: number,
           no: number,
           abstain: number
         }
       }
```

### Public Endpoints (Token-based, No Auth)

```
POST   /api/vote
       Submit a ballot using one-time token

       Headers: Authorization: Bearer <token-from-events>
       Body: { answer: 'yes' | 'no' | 'abstain' }

       Flow:
       1. Extract token from Authorization header
       2. Hash token (SHA-256)
       3. Validate token (exists, not used)
       4. Validate answer (yes/no/abstain)
       5. Insert ballot (atomic transaction)
       6. Mark token as used
       7. Return confirmation

       Returns: { success: true, ballot_id: UUID }
       Errors:
         - 401 (missing/invalid token)
         - 404 (token not registered)
         - 409 (token already used)
         - 400 (invalid answer)

GET    /api/token-status
       Check if token is valid (pre-flight check)

       Headers: Authorization: Bearer <token-from-events>

       Returns: {
         valid: true,
         used: false,
         election_title: 'Prófunarkosning 2025'
       }
       Errors: 401, 404

GET    /health
       Health check endpoint

       Returns: {
         status: 'healthy',
         service: 'elections-service',
         version: '1.0.0',
         timestamp: ISO8601
       }
```

---

## Ballot Processing Flow (MVP - Synchronous)

### Overview

```
Member submits ballot
         │
         ▼
   ┌──────────────┐
   │ POST /vote   │ ◄── Validate token & answer
   │              │
   │ 1. Hash      │
   │ 2. Validate  │
   │ 3. Insert    │ ◄── Atomic transaction (ACID)
   │ 4. Mark used │
   └──────┬───────┘
          │
          │ Return confirmation
          ▼
       Success
```

**Note**: No message queue for MVP. Synchronous processing is sufficient for expected traffic (< 3000 votes).

### Implementation

```javascript
async function submitBallot(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const token = authHeader.split('Bearer ')[1];
  const { answer } = req.body;

  // 1. Validate answer
  if (!['yes', 'no', 'abstain'].includes(answer)) {
    return res.status(400).json({ error: 'Invalid answer. Must be yes, no, or abstain' });
  }

  // 2. Hash token
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // 3. Database transaction (atomic)
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check token exists and not used
    const tokenResult = await client.query(
      'SELECT used FROM voting_tokens WHERE token_hash = $1 FOR UPDATE',
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Token not registered' });
    }

    if (tokenResult.rows[0].used) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Token already used' });
    }

    // Insert ballot
    const ballotResult = await client.query(`
      INSERT INTO ballots (token_hash, answer, submitted_at)
      VALUES ($1, $2, date_trunc('minute', NOW()))
      RETURNING id
    `, [tokenHash, answer]);

    const ballotId = ballotResult.rows[0].id;

    // Mark token as used
    await client.query(
      'UPDATE voting_tokens SET used = TRUE, used_at = NOW() WHERE token_hash = $1',
      [tokenHash]
    );

    await client.query('COMMIT');

    // Audit log (async, no PII)
    logAudit({
      action: 'record_ballot',
      success: true,
      details: { token_hash_prefix: tokenHash.substring(0, 8), answer }
    });

    res.json({ success: true, ballot_id: ballotId });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ballot submission error:', error);

    logAudit({
      action: 'record_ballot',
      success: false,
      details: { error: error.message }
    });

    res.status(500).json({ error: 'Failed to record ballot' });
  } finally {
    client.release();
  }
}
```

---

## Result Tabulation (Simple Count)

### Compute Results (S2S Endpoint)

```javascript
async function getResults(req, res) {
  // Verify S2S authentication
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.S2S_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Count ballots by answer
    const result = await pool.query(`
      SELECT
        answer,
        COUNT(*) as count
      FROM ballots
      GROUP BY answer
    `);

    const results = {
      yes: 0,
      no: 0,
      abstain: 0
    };

    result.rows.forEach(row => {
      results[row.answer] = parseInt(row.count);
    });

    const totalBallots = results.yes + results.no + results.abstain;

    // Audit log
    await logAudit({
      action: 'fetch_results',
      success: true,
      details: { total_ballots: totalBallots }
    });

    res.json({
      total_ballots: totalBallots,
      results
    });

  } catch (error) {
    console.error('Results fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
}
```

---

## Deployment Architecture

```
┌────────────────────────────────────────────────────┐
│ Cloud Run: elections-service                       │
│ URL: https://elections-service-....run.app         │
│                                                    │
│ Scaling Config (CRITICAL):                         │
│ - max-instances: 100   (300 votes/sec spike)       │
│ - concurrency: 50      (database-bound)            │
│ - startup-cpu-boost    (fast cold start)           │
│ - timeout: 5s          (fail fast)                 │
│                                                    │
│ ┌────────────────────────────────────────────┐    │
│ │ Express.js API                             │    │
│ │                                            │    │
│ │ Public Endpoints (Token-based):            │    │
│ │ - POST /api/vote                           │    │
│ │ - GET  /api/token-status                   │    │
│ │ - GET  /health                             │    │
│ │                                            │    │
│ │ S2S Endpoints (API Key):                   │    │
│ │ - POST /api/s2s/register-token             │    │
│ │ - GET  /api/s2s/results                    │    │
│ └────────────────────────────────────────────┘    │
└────────────────┬───────────────────────────────────┘
                 │
                 │ Connection Pool: 2 per instance
                 │ (100 instances × 2 = 200 connections)
                 ▼
       ┌─────────────────┐
       │ Cloud SQL        │
       │ PostgreSQL 15   │
       │ ekklesia-db     │
       │                 │
       │ Must support:   │
       │ - 200+ conns    │
       │ - 300 TPS       │
       │ - Row locking   │
       │                 │
       │ Schema:         │
       │ elections       │
       │ - voting_tokens │
       │ - ballots       │
       │ - audit_log     │
       └─────────────────┘
```

---

## Security Considerations

### Token Validation
- **Hashing**: SHA-256 before lookup (token never stored in plain text)
- **One-time use**: Database UNIQUE constraint + transaction lock (FOR UPDATE)
- **No expiration check**: Events service handles expiration before issuing token

### Anonymity Guarantees
- **No PII**: Service never receives member identity
- **No IP logging**: Intentionally omit IP address from logs
- **Timestamp rounding**: Ballot submission time rounded to nearest minute
- **Unlinkability**: No way to connect ballot to member (only Events has that mapping)

### S2S Authentication
- **API key**: Shared secret between Events and Elections services
- **HTTPS only**: TLS 1.3
- **Header-based**: `X-API-Key` header (not query param)
- **Key rotation**: Environment variable, easy to rotate via Cloud Run deployment

### Database Constraints
- **UNIQUE(token_hash)**: Prevents double voting
- **Foreign key**: Ensures token exists before ballot
- **CHECK constraint**: Only valid answers (yes/no/abstain)
- **Transaction isolation**: SERIALIZABLE for ballot submission

### Performance Optimization (Critical for 300 votes/sec Spike)
- **Fast transactions**: Target <10ms transaction time
- **Fail-fast locking**: Use `FOR UPDATE NOWAIT` instead of waiting for locks
- **Connection pooling**: 2 connections per instance (minimal contention)
- **503 Retry response**: Return retry status if pool exhausted (not 500)
- **Startup CPU boost**: Enabled for fast cold start during scaling
- **Load testing required**: Must test 300 votes/sec before production

See [USAGE_CONTEXT.md](../USAGE_CONTEXT.md) for detailed load characteristics.

---

## Integration with Events Service

### Flow Diagram

```
Events Service                    Elections Service
--------------                    -----------------

1. Member requests token
   ↓
2. Events creates token
   (plain text)
   ↓
3. Events hashes token
   (SHA-256)
   ↓
4. Events stores hash ───────────→ POST /api/s2s/register-token
   in audit trail                   { token_hash }
   ↓                                      ↓
5. Events returns plain          Elections stores hash
   token to member               in voting_tokens table
   ↓
6. Member clicks "Vote"
   ↓
7. Member redirected to
   Elections service UI
   (with token in URL)
   ↓                                      ↓
8. Member submits vote ─────────→ POST /api/vote
   (token + answer)                { answer: 'yes' }
                                         ↓
                                   Elections verifies token,
                                   records ballot, marks used
                                         ↓
                                   Returns success
   ↓                                     ↓
9. Member redirected back
   to Events service
   ↓
10. Events fetches results ──────→ GET /api/s2s/results
    (after election closes)
                                   Returns aggregated counts
```

---

## Cost Estimation

### GCP Resources
- **Cloud Run**: $0.00002400/vCPU-second, $0.00000250/GiB-second
  - Estimate: 1 vCPU, 512 MiB, 3000 votes over 2 weeks
  - Cost: ~$0.50/month (mostly idle)
- **Cloud SQL**: Shared with Events service
  - Additional cost: ~$0 (same instance, minimal storage increase)
- **Cloud Logging**: Audit logs < 1 GB/month
  - Cost: Free tier

**Total**: ~$0.50/month for MVP (within Cloud Run free tier)

---

## Implementation Phases

### Phase 1: Database Setup (Day 1) ✅ COMPLETE
- [x] Design simplified MVP schema
- [x] Create migration scripts (001_initial_schema.sql)
- [x] Run migrations on Cloud SQL (elections schema)
- [x] Seed test data (register 2 test tokens)

### Phase 2: Core API (Day 2) ✅ COMPLETE
- [x] Set up Node.js/Express project (elections/)
- [x] Configure Cloud SQL connection
- [x] Implement POST /api/s2s/register-token
- [x] Implement POST /api/vote
- [x] Implement GET /api/token-status
- [x] Implement GET /api/s2s/results
- [x] Add S2S authentication middleware
- [x] Add audit logging

### Phase 3: Local Testing (Day 3) ✅ COMPLETE
- [x] Test token registration (S2S call from Events)
- [x] Test ballot submission (with valid token)
- [x] Test error cases (invalid token, already used, invalid answer)
- [x] Test results endpoint (S2S call from Events)
- [x] Verify anonymity (no PII in logs/database)

### Phase 4: Deployment (Day 4) ✅ COMPLETE
- [x] Create Dockerfile
- [x] Create deploy.sh script
- [x] Deploy to Cloud Run (Oct 9, 2025 20:52 UTC)
- [x] Configure Cloud SQL Unix socket connection
- [x] Test production endpoints (health, S2S register-token, S2S results)
- [ ] Update Events service to call Elections S2S endpoints (Phase 5)

### Phase 5: Integration Testing (Day 5) ✅ COMPLETE (Oct 10, 2025)
- [x] Events service updated to call Elections S2S endpoints
- [x] End-to-end flow: Member request token → Events → Elections → Vote → Results
- [x] Test with production Firebase authentication
- [x] Verify audit trail works correctly
- [x] Web-based voting interface deployed (test-events.html)
- [x] Integration documentation complete (PHASE_5_INTEGRATION_COMPLETE.md)
- [ ] **Load test: 300 votes/sec spike (CRITICAL)** - See [USAGE_CONTEXT.md](../USAGE_CONTEXT.md) - Deferred to pre-production

**Total Implementation Time**: 5 days (Oct 9-10, 2025)

**Status**: ✅ Phase 5 complete - Full integration operational
**Next**: Load testing with 300 votes/sec **required** before first large meeting with >300 attendees

---

## Monitoring & Observability

### Metrics (Cloud Run Built-in)
- Request count (votes/hour)
- Request latency (p50, p95, p99)
- Error rate (4xx, 5xx)
- Database connection pool usage

### Alerts
- Error rate > 5% (validation or database issues)
- Request latency > 1s p95 (database slow)
- Database connection pool exhausted

### Logging
- Audit log: All token registrations and ballot submissions (no PII)
- Application log: Errors and warnings only (no debug in production)
- GCP Cloud Logging integration (structured JSON logs)

---

## Related Documentation

- **[docs/USAGE_CONTEXT.md](../USAGE_CONTEXT.md)** - **CRITICAL: Load patterns and capacity planning**
- [docs/SYSTEM_ARCHITECTURE_OVERVIEW.md](../SYSTEM_ARCHITECTURE_OVERVIEW.md) - Overall system vision
- [docs/design/EVENTS_SERVICE_MVP.md](EVENTS_SERVICE_MVP.md) - Events service (token issuance)
- [docs/status/CURRENT_PRODUCTION_STATUS.md](../status/CURRENT_PRODUCTION_STATUS.md) - Production infrastructure
- GitHub Issues: Epic #18 (Voting Core), Epic #19 (Writer & Queue)

---

## MVP Decisions Log

### ✅ Decisions Made:

1. **No message queue (Pub/Sub)**: Synchronous processing sufficient for MVP traffic
2. **No questions table**: Hardcoded single question for MVP
3. **No elections table**: Hardcoded election metadata for MVP
4. **Simple yes/no/abstain**: No ranked choice or single choice for MVP
5. **Shared Cloud SQL instance**: Use ekklesia-db with separate schema
6. **Timestamp rounding**: Round to nearest minute (anonymity + debugging)
7. **S2S API key**: Simple shared secret (can upgrade to JWT later)
8. **No result caching**: Query directly from ballots table (MVP only)

### ⏸️ Deferred to Future Phases:

1. Multiple elections support
2. Multiple questions per election
3. Pub/Sub queue for high-traffic scenarios
4. Ranked choice voting algorithms
5. Single choice voting
6. Complex ballot schemas (JSON Schema validation)
7. Dead letter queue for error handling
8. Result caching in separate table
9. Real-time result streaming
10. Admin UI for election management

---

## Open Questions (Resolved for MVP)

1. **Q**: Pub/Sub queue or synchronous processing?
   **A**: Synchronous (YAGNI for MVP, < 3000 votes)

2. **Q**: Store election metadata in database?
   **A**: Hardcode for MVP (1 election only)

3. **Q**: Support multiple question types?
   **A**: No, only yes/no/abstain for MVP

4. **Q**: Separate database or shared instance?
   **A**: Shared instance, separate schema (cost optimization)

5. **Q**: Token expiration check in Elections service?
   **A**: No, Events handles expiration (single responsibility)

6. **Q**: Real-time results or on-demand?
   **A**: On-demand (S2S endpoint, only after election closes)

7. **Q**: Audit log retention?
   **A**: Keep forever for MVP (add partitioning in future)

---

**Status**: ✅ Phase 5 Complete - Full Integration Operational
**Deployment Dates**:
- Phase 4 (Elections Service): October 9, 2025 20:52 UTC
- Phase 5 (Events Integration): October 10, 2025 02:07 UTC
**Service URL**: https://elections-service-521240388393.europe-west2.run.app
**Integration Documentation**: [docs/status/PHASE_5_INTEGRATION_COMPLETE.md](../status/PHASE_5_INTEGRATION_COMPLETE.md)
**Next Step**: Load testing before first large meeting (>300 attendees)

---

## Deployment Notes (Oct 9, 2025)

### Successful Deployment
- **Revision**: elections-service-00003-m6n
- **Image**: gcr.io/ekklesia-prod-10-2025/elections-service:latest
- **Health Check**: ✅ Passing
- **S2S Endpoints**: ✅ Tested and working
- **Database**: ✅ Connected via Unix socket (elections schema)

### Issues Resolved During Deployment
1. **SSL Connection Error**: Disabled SSL for Cloud SQL Unix socket (Unix sockets don't support SSL)
2. **CORS Environment Variable**: Changed separator from comma to caret (`,` → `^`) to avoid gcloud parsing issues
3. **PORT Environment Variable**: Removed from config (Cloud Run sets this automatically)
4. **S2S API Key Secret**: Created elections-s2s-api-key in Secret Manager (version 2 without trailing newline)

### Configuration
- Max instances: 100 (handles 300 votes/sec spike)
- Concurrency: 50 (database-bound workload)
- CPU boost: Enabled (fast cold start)
- Memory: 512 MB
- Timeout: 5s (fail fast)
- Connection pool: min=2, max=5 per instance

### Verified Endpoints (Phase 5 Testing - Oct 10, 2025)
- ✅ `GET /health` - Returns healthy status
- ✅ `POST /api/s2s/register-token` - Token registration working (called by Events service)
- ✅ `GET /api/s2s/results` - Results tabulation working (called by Events service)
- ✅ `POST /api/vote` - Ballot submission tested (via test-events.html)
- ✅ `GET /api/token-status` - Token validation tested

### Integration Complete (Oct 10, 2025)
1. ✅ Events service registers tokens with Elections (S2S) - events-service-00002-dj7
2. ✅ End-to-end voting flow tested via web interface (test-events.html)
3. ✅ S2S API key shared between services (elections-s2s-api-key, version 2)
4. ✅ Full integration documented (PHASE_5_INTEGRATION_COMPLETE.md)
5. ⏸️ Load test with 300 votes/sec spike - Deferred to pre-production
