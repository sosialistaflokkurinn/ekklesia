# Voting Service Design Document

**Component**: Voting System (`Kosning`)
**Status**: 📋 Design Phase
**Last Updated**: 2025-10-07
**Purpose**: Anonymous ballot recording and tabulation

---

## Overview

The Voting service is the secure, anonymous ballot recording component that:
- Validates one-time voting tokens (issued by Events service)
- Records ballots anonymously (no PII)
- Enforces one-token-one-vote constraint
- Provides ballot confirmation to voters
- Tabulates results on election closure
- Supports multiple voting methods (yes/no, single choice, ranked choice)

---

## Architecture Principles

### Anonymity First
- **No PII**: Service knows nothing about members (only token hashes)
- **No tracking**: Cannot link ballot to member identity
- **Append-only**: Ballots are immutable once recorded

### Security Model
- One-time tokens (cryptographically verified)
- Database constraints prevent double voting
- S2S authentication for Events service communication
- Audit trail without identity exposure

### Reliability
- Queue-based ballot processing (Pub/Sub)
- Idempotent writes (safe retry)
- Dead letter queue for poison messages
- High availability, auto-scaling

---

## Technology Stack

### Runtime
**Decision**: Node.js + Express
**Rationale**:
- Matches Events service (consistent stack)
- Fast async I/O for queue processing
- Good Pub/Sub client library support
- Lightweight, scalable

### Database
**Decision**: Cloud SQL PostgreSQL 15 (ekklesia-db instance, separate schema)
**Rationale**:
- Strong ACID guarantees (critical for voting)
- Unique constraints prevent double voting
- Reliable transaction support
- Same instance as Events (cost optimization), separate schema (data isolation)

### Message Queue
**Decision**: Google Cloud Pub/Sub
**Rationale**:
- Managed service (no infrastructure)
- At-least-once delivery guarantee
- Dead letter queue support
- Built-in monitoring and alerting
- Decouples ballot acceptance from persistence

### Deployment
**Decision**: Cloud Run
**Rationale**:
- Serverless, auto-scaling (handles traffic spikes)
- No min instances = cost efficient
- Matches Events/Members deployment model

---

## Data Model

### Database Schema

```sql
-- Elections (minimal metadata, no PII)
CREATE TABLE elections (
    id UUID PRIMARY KEY,
    external_election_id UUID NOT NULL, -- Events service's election ID

    title VARCHAR(255) NOT NULL,
    voting_starts_at TIMESTAMP NOT NULL,
    voting_ends_at TIMESTAMP NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'closed'

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMP,

    UNIQUE(external_election_id)
);

-- Questions
CREATE TABLE questions (
    id UUID PRIMARY KEY,
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    external_question_id UUID NOT NULL, -- Events service's question ID

    question_text TEXT NOT NULL,
    question_order INT NOT NULL,

    ballot_type VARCHAR(50) NOT NULL, -- 'yes_no', 'single_choice', 'ranked_choice'
    ballot_schema JSONB NOT NULL, -- Options, candidates, etc.

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE(election_id, external_question_id)
);

-- Voting Tokens (no PII, only token hashes)
CREATE TABLE voting_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,

    token_hash VARCHAR(64) NOT NULL, -- SHA-256 hash from Events service
    expires_at TIMESTAMP NOT NULL,

    -- Usage tracking (no PII)
    used BOOLEAN NOT NULL DEFAULT FALSE,
    used_at TIMESTAMP,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE(token_hash) -- Each token is globally unique
);

CREATE INDEX idx_voting_tokens_election ON voting_tokens(election_id);
CREATE INDEX idx_voting_tokens_hash ON voting_tokens(token_hash);

-- Ballots (anonymous, append-only)
CREATE TABLE ballots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL, -- Links to voting_tokens (but no PII)

    -- Ballot content
    answers JSONB NOT NULL, -- Array of {question_id, answer}

    -- Timestamps
    submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Idempotency key for queue processing
    idempotency_key VARCHAR(64) NOT NULL,

    UNIQUE(token_hash), -- One ballot per token (enforces one-vote-per-token)
    UNIQUE(idempotency_key) -- Prevents duplicate writes from queue retries
);

CREATE INDEX idx_ballots_election ON ballots(election_id);
CREATE INDEX idx_ballots_submitted_at ON ballots(submitted_at);

-- Results Cache (computed on election close)
CREATE TABLE results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,

    -- Tabulated results
    results_json JSONB NOT NULL, -- {option: count} or ranked choice results

    -- Metadata
    computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    total_ballots INT NOT NULL,

    UNIQUE(election_id, question_id)
);

-- Audit Log (system events only, no PII)
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),

    -- What
    action VARCHAR(100) NOT NULL, -- 'create_election', 'validate_token', 'record_ballot', 'close_election'
    resource_type VARCHAR(50) NOT NULL, -- 'election', 'token', 'ballot'
    resource_id UUID,

    -- Context
    details JSONB,
    success BOOLEAN NOT NULL
);

CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
```

---

## API Design

### Public Endpoints (Token-based)

```
POST   /api/vote/:token
       Submit a ballot using one-time token
       Body: { answers: [{question_id, answer}, ...] }

       Flow:
       1. Extract token from URL
       2. Hash token (SHA-256)
       3. Validate token (exists, not expired, not used, election active)
       4. Validate ballot schema (all questions answered, valid options)
       5. Publish ballot to Pub/Sub queue (for async persistence)
       6. Return confirmation immediately

       Returns: { success: true, confirmation_id: UUID }

GET    /api/vote/:token/status
       Check if token is valid (for pre-flight check)

       Returns: { valid: true, election_id, election_title, expires_at }

GET    /api/confirmation/:confirmation_id
       Check if ballot was persisted (idempotent status check)

       Returns: { status: 'pending' | 'recorded' | 'failed' }
```

### Server-to-Server Endpoints (Events service only)

```
POST   /api/s2s/elections
       Create election in Voting service
       Body: { external_election_id, title, voting_starts_at, voting_ends_at, questions }

       Auth: Bearer token (API key)

POST   /api/s2s/tokens
       Register voting token
       Body: { election_id, token_hash, expires_at }

       Auth: Bearer token (API key)

POST   /api/s2s/elections/:id/close
       Close election, compute results

       Flow:
       1. Update election status to 'closed'
       2. Tabulate results for all questions
       3. Store in results table
       4. Return results

       Auth: Bearer token (API key)

       Returns: { election_id, total_ballots, results: [...] }

GET    /api/s2s/elections/:id/results
       Fetch results (after election closed)

       Auth: Bearer token (API key)

       Returns: { election_id, total_ballots, results: [...] }
```

---

## Ballot Processing Flow

### Overview

```
Member submits ballot
         │
         ▼
   ┌──────────────┐
   │ POST /vote   │ ◄── Validate token & schema
   └──────┬───────┘
          │
          │ Publish message
          ▼
   ┌──────────────┐
   │  Pub/Sub     │ ◄── Decouple acceptance from persistence
   │  Topic       │
   └──────┬───────┘
          │
          │ At-least-once delivery
          ▼
   ┌──────────────┐
   │ Subscriber   │ ◄── Worker processes messages
   │ (Cloud Run)  │
   └──────┬───────┘
          │
          │ Idempotent write
          ▼
   ┌──────────────┐
   │ PostgreSQL   │ ◄── UNIQUE constraint (token_hash, idempotency_key)
   │ ballots      │
   └──────────────┘
```

### 1. Ballot Submission (POST /api/vote/:token)

```javascript
async function submitBallot(req, res) {
  const token = req.params.token;
  const { answers } = req.body;

  // 1. Hash token
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // 2. Validate token
  const tokenRecord = await db.query(
    'SELECT * FROM voting_tokens WHERE token_hash = $1',
    [tokenHash]
  );

  if (tokenRecord.rows.length === 0) {
    return res.status(404).json({ error: 'Invalid token' });
  }

  const tokenData = tokenRecord.rows[0];

  if (tokenData.used) {
    return res.status(409).json({ error: 'Token already used' });
  }

  if (new Date() > new Date(tokenData.expires_at)) {
    return res.status(410).json({ error: 'Token expired' });
  }

  // 3. Validate election is active
  const election = await db.query(
    'SELECT * FROM elections WHERE id = $1 AND status = $2',
    [tokenData.election_id, 'active']
  );

  if (election.rows.length === 0) {
    return res.status(400).json({ error: 'Election is not active' });
  }

  // 4. Validate ballot schema
  const questions = await db.query(
    'SELECT * FROM questions WHERE election_id = $1 ORDER BY question_order',
    [tokenData.election_id]
  );

  const validationResult = validateBallot(answers, questions.rows);
  if (!validationResult.valid) {
    return res.status(400).json({ error: validationResult.error });
  }

  // 5. Generate idempotency key (for queue processing)
  const idempotencyKey = crypto.randomBytes(16).toString('hex');

  // 6. Publish to Pub/Sub queue
  const messageData = {
    token_hash: tokenHash,
    election_id: tokenData.election_id,
    answers,
    idempotency_key: idempotencyKey,
    submitted_at: new Date().toISOString()
  };

  await pubSubClient.topic('ballot-submissions').publish(
    Buffer.from(JSON.stringify(messageData))
  );

  // 7. Mark token as used (optimistic)
  await db.query(
    'UPDATE voting_tokens SET used = TRUE, used_at = NOW() WHERE token_hash = $1',
    [tokenHash]
  );

  // 8. Return confirmation immediately
  res.json({
    success: true,
    confirmation_id: idempotencyKey,
    message: 'Ballot accepted for processing'
  });

  // Audit log
  await logAudit({
    action: 'submit_ballot',
    resource_type: 'ballot',
    resource_id: tokenData.election_id,
    details: { token_hash: tokenHash },
    success: true
  });
}
```

### 2. Ballot Processing (Pub/Sub Subscriber)

```javascript
async function processBallotMessage(message) {
  const data = JSON.parse(message.data.toString());
  const { token_hash, election_id, answers, idempotency_key, submitted_at } = data;

  try {
    // Idempotent write (UNIQUE constraint on idempotency_key)
    await db.query(`
      INSERT INTO ballots (token_hash, election_id, answers, idempotency_key, submitted_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (idempotency_key) DO NOTHING
    `, [token_hash, election_id, answers, idempotency_key, submitted_at]);

    // Verify write succeeded
    const result = await db.query(
      'SELECT id FROM ballots WHERE idempotency_key = $1',
      [idempotency_key]
    );

    if (result.rows.length > 0) {
      console.log(`Ballot ${idempotency_key} persisted successfully`);
      message.ack(); // Acknowledge message
    } else {
      // Should never happen (constraint would throw error)
      console.warn(`Ballot ${idempotency_key} not found after insert`);
      message.nack(); // Retry
    }

  } catch (error) {
    // Log error
    console.error(`Failed to process ballot ${idempotency_key}:`, error);
    await logAudit({
      action: 'process_ballot_queue',
      resource_type: 'ballot',
      resource_id: idempotency_key,
      details: { error: error.message },
      success: false
    });

    // Check if it's a constraint violation (already exists)
    if (error.code === '23505') { // Unique violation
      console.log(`Ballot ${idempotency_key} already exists (idempotent)`);
      message.ack(); // Safe to acknowledge
    } else {
      // Other error, retry
      message.nack();
    }
  }
}

// Subscribe to Pub/Sub topic
pubSubClient
  .subscription('ballot-submissions-sub')
  .on('message', processBallotMessage);
```

---

## Result Tabulation

### Close Election & Compute Results

```javascript
async function closeElection(electionId) {
  // 1. Update election status
  await db.query(
    'UPDATE elections SET status = $1, closed_at = NOW() WHERE id = $2',
    ['closed', electionId]
  );

  // 2. Get all questions
  const questions = await db.query(
    'SELECT * FROM questions WHERE election_id = $1 ORDER BY question_order',
    [electionId]
  );

  // 3. Get all ballots
  const ballots = await db.query(
    'SELECT answers FROM ballots WHERE election_id = $1',
    [electionId]
  );

  const totalBallots = ballots.rows.length;

  // 4. Tabulate results for each question
  const results = [];

  for (const question of questions.rows) {
    let tabulatedResults;

    if (question.ballot_type === 'yes_no') {
      tabulatedResults = tabulateYesNo(ballots.rows, question.id);
    } else if (question.ballot_type === 'single_choice') {
      tabulatedResults = tabulateSingleChoice(ballots.rows, question.id);
    } else if (question.ballot_type === 'ranked_choice') {
      tabulatedResults = tabulateRankedChoice(ballots.rows, question.id);
    }

    // Store results
    await db.query(`
      INSERT INTO results (election_id, question_id, results_json, total_ballots)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (election_id, question_id) DO UPDATE
      SET results_json = EXCLUDED.results_json,
          total_ballots = EXCLUDED.total_ballots,
          computed_at = NOW()
    `, [electionId, question.id, tabulatedResults, totalBallots]);

    results.push({
      question_id: question.id,
      question_text: question.question_text,
      results: tabulatedResults,
      total_ballots: totalBallots
    });
  }

  // 5. Log audit trail
  await logAudit({
    action: 'close_election',
    resource_type: 'election',
    resource_id: electionId,
    details: { total_ballots: totalBallots },
    success: true
  });

  return {
    election_id: electionId,
    total_ballots: totalBallots,
    results
  };
}
```

### Tabulation Algorithms

```javascript
// Yes/No
function tabulateYesNo(ballots, questionId) {
  const results = { yes: 0, no: 0, abstain: 0 };

  for (const ballot of ballots) {
    const answer = ballot.answers.find(a => a.question_id === questionId);
    if (answer) {
      results[answer.answer] = (results[answer.answer] || 0) + 1;
    }
  }

  return results;
}

// Single Choice
function tabulateSingleChoice(ballots, questionId) {
  const results = {};

  for (const ballot of ballots) {
    const answer = ballot.answers.find(a => a.question_id === questionId);
    if (answer) {
      results[answer.answer] = (results[answer.answer] || 0) + 1;
    }
  }

  return results;
}

// Ranked Choice (Instant Runoff Voting)
function tabulateRankedChoice(ballots, questionId) {
  // Extract rankings for this question
  const rankings = ballots.map(ballot => {
    const answer = ballot.answers.find(a => a.question_id === questionId);
    return answer ? answer.ranking : []; // [candidateA, candidateB, candidateC]
  }).filter(r => r.length > 0);

  // Implement IRV algorithm
  let remainingCandidates = [...new Set(rankings.flat())];
  const rounds = [];

  while (remainingCandidates.length > 1) {
    // Count first-choice votes
    const firstChoiceCounts = {};
    for (const candidate of remainingCandidates) {
      firstChoiceCounts[candidate] = 0;
    }

    for (const ranking of rankings) {
      const firstChoice = ranking.find(c => remainingCandidates.includes(c));
      if (firstChoice) {
        firstChoiceCounts[firstChoice]++;
      }
    }

    rounds.push({ ...firstChoiceCounts });

    // Check for majority winner
    const totalVotes = Object.values(firstChoiceCounts).reduce((a, b) => a + b, 0);
    const majorityThreshold = totalVotes / 2;

    for (const [candidate, count] of Object.entries(firstChoiceCounts)) {
      if (count > majorityThreshold) {
        return { winner: candidate, rounds };
      }
    }

    // Eliminate candidate with fewest votes
    const minVotes = Math.min(...Object.values(firstChoiceCounts));
    const eliminatedCandidate = Object.entries(firstChoiceCounts)
      .find(([_, count]) => count === minVotes)[0];

    remainingCandidates = remainingCandidates.filter(c => c !== eliminatedCandidate);
  }

  return {
    winner: remainingCandidates[0],
    rounds
  };
}
```

---

## Deployment Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Cloud Run: voting-service                                    │
│ URL: https://voting-ymzrguoifa-nw.a.run.app                  │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ Express.js API                                         │  │
│ │ - POST /api/vote/:token                                │  │
│ │ - GET  /api/vote/:token/status                         │  │
│ │ - GET  /api/confirmation/:id                           │  │
│ │ - POST /api/s2s/elections (S2S)                        │  │
│ │ - POST /api/s2s/tokens (S2S)                           │  │
│ │ - POST /api/s2s/elections/:id/close (S2S)              │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ Pub/Sub Subscriber (Background Worker)                 │  │
│ │ - Process ballot queue                                 │  │
│ │ - Idempotent writes                                    │  │
│ │ - Error handling & retry                               │  │
│ └────────────────────────────────────────────────────────┘  │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
         ┌─────────────────┐
         │ Cloud SQL        │
         │ PostgreSQL 15   │
         │ ekklesia-db     │
         │                 │
         │ Schema: voting  │
         │ - elections     │
         │ - questions     │
         │ - voting_tokens │
         │ - ballots       │
         │ - results       │
         │ - audit_log     │
         └─────────────────┘

                   ▲
                   │
                   │ Pub/Sub messages
                   │
         ┌─────────────────┐
         │ Pub/Sub Topic   │
         │ ballot-submissions
         │                 │
         │ Subscription:   │
         │ ballot-sub      │
         │ (DLQ enabled)   │
         └─────────────────┘
```

---

## Security Considerations

### Token Validation
- **Hashing**: SHA-256 before lookup (token never stored in plain text)
- **Expiration**: Time-based expiration enforced
- **One-time use**: Database constraint + optimistic locking

### Anonymity Guarantees
- **No PII**: Service never receives member identity
- **No IP logging**: Intentionally omit IP address from ballot records
- **No timestamps linking**: Ballot submission time is rounded to nearest minute
- **Unlinkability**: No way to connect ballot to member (only Events service has that mapping)

### S2S Authentication
- **API key**: Shared secret between Events and Voting services
- **HTTPS only**: TLS 1.3
- **Key rotation**: Support for multiple valid keys (graceful rotation)

### Database Constraints
- **UNIQUE(token_hash)**: Prevents double voting
- **UNIQUE(idempotency_key)**: Prevents duplicate writes from queue retries
- **Foreign key constraints**: Data integrity

---

## Monitoring & Observability

### Metrics
- Ballot submission rate (requests/sec)
- Queue processing latency (p50, p95, p99)
- Queue depth (backlog size)
- Error rate (validation errors, processing errors)
- Database connection pool usage

### Alerts
- Queue depth > 1000 messages (scaling issue)
- Dead letter queue > 10 messages (poison messages)
- Error rate > 5% (validation or processing issues)
- Database connection pool exhausted

### Logging
- Audit log: All sensitive actions (no PII)
- Application log: Errors, warnings, performance
- GCP Cloud Logging integration

---

## Cost Estimation

### GCP Resources
- **Cloud Run**: $0.00002400/vCPU-second, $0.00000250/GiB-second
  - Estimate: 1 vCPU, 512 MiB, 1000 requests/day avg
  - Cost: ~$2/month
- **Cloud SQL**: Shared with Events service
  - Additional cost: ~$0 (same instance)
- **Pub/Sub**: $0.40/million messages
  - Estimate: 30,000 ballots/month
  - Cost: ~$0.01/month
- **Cloud Storage** (audit logs): $0.02/GB/month
  - Estimate: 1 GB/month
  - Cost: ~$0.02/month

**Total**: ~$2/month (low traffic), ~$10/month (high traffic with 10k ballots/month)

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
- [ ] Set up Node.js/Express project
- [ ] Configure Cloud SQL connection (voting schema)
- [ ] Create database schema (migrations)
- [ ] Deploy to Cloud Run (hello world)

### Phase 2: Token Validation (Week 2)
- [ ] GET /api/vote/:token/status
- [ ] Token validation logic (hash, expiration, used)
- [ ] S2S endpoint: POST /api/s2s/elections
- [ ] S2S endpoint: POST /api/s2s/tokens

### Phase 3: Ballot Submission (Week 3)
- [ ] POST /api/vote/:token (accept ballot)
- [ ] Ballot schema validation
- [ ] Pub/Sub topic creation
- [ ] Publish ballot to queue

### Phase 4: Ballot Processing (Week 4)
- [ ] Pub/Sub subscriber (background worker)
- [ ] Idempotent ballot persistence
- [ ] Dead letter queue configuration
- [ ] Error handling & retry logic

### Phase 5: Result Tabulation (Week 5)
- [ ] Tabulation algorithms (yes/no, single choice, ranked choice)
- [ ] S2S endpoint: POST /api/s2s/elections/:id/close
- [ ] S2S endpoint: GET /api/s2s/elections/:id/results
- [ ] Results caching

### Phase 6: Testing & Deployment (Week 6)
- [ ] Integration tests (Events ↔ Voting)
- [ ] Load testing (queue processing)
- [ ] Security audit (anonymity verification)
- [ ] Production deployment

---

## Related Documentation

- [docs/SYSTEM_ARCHITECTURE_OVERVIEW.md](SYSTEM_ARCHITECTURE_OVERVIEW.md) - Overall system vision
- [docs/EVENTS_SERVICE_DESIGN.md](EVENTS_SERVICE_DESIGN.md) - Events service (token issuance)
- GitHub Issues: Epic #18 (Voting Core), Epic #19 (Writer & Queue)

---

## Open Questions

1. **Ballot schema validation**: JSON Schema or custom validator?
   - **Decision**: JSON Schema (standard, well-tested)

2. **Queue message ordering**: FIFO or best-effort?
   - **Decision**: Best-effort (FIFO not required, idempotency handles duplicates)

3. **Dead letter queue threshold**: How many retries before DLQ?
   - **Decision**: 5 retries with exponential backoff

4. **Result caching strategy**: Store in database or Cloud Storage?
   - **Decision**: Database (easier querying, consistent with schema)

5. **Ranked choice algorithm**: Instant Runoff Voting (IRV) or other?
   - **Decision**: IRV initially, extensible design for other methods

6. **Anonymous ballot timestamps**: Round to nearest minute or remove entirely?
   - **Decision**: Round to nearest minute (helps with debugging without exposing exact timing)

7. **Schema isolation**: Separate database or separate schema in ekklesia-db?
   - **Decision**: Separate schema (cost optimization, logical isolation maintained)
