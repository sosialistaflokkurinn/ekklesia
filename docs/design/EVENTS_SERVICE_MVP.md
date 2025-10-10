# Events Service MVP Design Document

**Component**: Events System (`Atburðir`)
**Status**: ✅ Phase 5 Complete - Full Integration with Elections Service
**Last Updated**: 2025-10-10
**Production URL**: https://events-service-521240388393.europe-west2.run.app
**Purpose**: Election administration and voting token issuance
**MVP Scope**: One election, one question - manage election lifecycle and issue voting tokens
**Architecture**: Fully integrated with Members (✅ production) and Elections (✅ production, Phase 5 Oct 10, 2025)

---

## ✅ Implementation Complete: Full Integration (Phase 5)

**Status**: Events ↔ Elections S2S integration complete (Oct 10, 2025)

**What's Working**:
- ✅ Events service is independently deployable and testable
- ✅ Token generation and storage working
- ✅ Audit trail (kennitala → token) complete
- ✅ S2S token registration with Elections service
- ✅ S2S results fetching from Elections service
- ✅ Web-based voting interface (test-events.html)
- ✅ End-to-end voting flow tested

**Integration Points**:
1. **Token Issuance**: Events → Elections S2S (`POST /api/s2s/register-token`)
2. **Results Fetching**: Events → Elections S2S (`GET /api/s2s/results`)
3. **Voting**: Members → Elections directly (`POST /api/vote` with token)

---

## Overview

**MVP Scope**: One election (Kosning), one question

The Events service manages elections and determines who can vote:
- Stores election details (title, description, question, timeline)
- Determines member eligibility (active membership required)
- Issues one-time voting tokens to eligible members
- Sends tokens to Elections (`Kosningar`) service via S2S
- Fetches and displays results from Elections service

---

## Architecture Principles (MVP)

### Separation of Concerns
- **Events service** (this): Knows about members and elections (PII exists here)
- **Elections service** (next phase): Knows only about tokens and ballots (no PII)
- **Communication**: Server-to-Server (S2S) - Events → Elections

### Security Model
- JWT authentication from Firebase (Members service)
- Active membership required (no complex eligibility for MVP)
- One-time voting tokens (cryptographically secure, SHA-256 hashed)
- Token sent to both: member (to vote) and Elections service (to validate)

### Data Privacy
- **Events service**: Stores kennitala → token_hash mapping (audit trail)
- **Elections service**: Only receives token_hash, never kennitala
- **Audit**: Events can link member → vote, but Elections cannot

---

## Technology Stack

### Runtime
**Decision**: Node.js + Express
**Rationale**:
- Matches Members service patterns (Firebase Functions)
- Fast prototyping with JavaScript/TypeScript
- Excellent JWT/OAuth library support
- Easy GCP integration

### Database
**Decision**: Cloud SQL PostgreSQL 15 (ekklesia-db instance)
**Rationale**:
- Instance already provisioned
- ACID guarantees for critical election data
- Complex eligibility queries (role-based, membership status)
- Strong consistency for token issuance

### Deployment
**Decision**: Cloud Run
**Rationale**:
- Serverless, auto-scaling
- Matches Members/Portal deployment model
- No infrastructure management
- Pay-per-request pricing

### Authentication
**Decision**: Firebase Admin SDK
**Rationale**:
- Verify Firebase ID tokens from Members service
- Access Firestore for member profile data
- Consistent auth across services

---

## Data Model

### Database Schema (MVP) - Events Service Only

```sql
-- Single Election (managed by Events service)
CREATE TABLE election (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    question_text TEXT NOT NULL,

    -- Simple status
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'published', 'closed'

    -- Timeline
    voting_starts_at TIMESTAMP NOT NULL,
    voting_ends_at TIMESTAMP NOT NULL,

    -- S2S Integration
    elections_service_id UUID, -- ID in Elections (`Kosningar`) service

    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_timeline CHECK (voting_starts_at < voting_ends_at)
);

-- Voting Tokens (audit trail in Events service)
CREATE TABLE voting_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Member identification (PII - stays in Events service)
    kennitala VARCHAR(11) NOT NULL UNIQUE, -- One token per member

    -- Token details
    token_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash
    issued_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,

    -- Usage tracking (updated by Elections service via S2S)
    voted BOOLEAN NOT NULL DEFAULT FALSE,
    voted_at TIMESTAMP
);

CREATE INDEX idx_voting_tokens_kennitala ON voting_tokens(kennitala);
CREATE INDEX idx_voting_tokens_hash ON voting_tokens(token_hash);
```

**Note**: Ballots are stored in Elections (`Kosningar`) service, not here. This maintains separation - Events knows WHO can vote, Elections knows WHAT was voted.

---

## API Design (MVP)

### Authentication
All requests require Firebase ID token in `Authorization: Bearer <token>` header.

Token claims:
- `uid`: Firebase user ID
- `kennitala`: Icelandic national ID
- `membership_status`: Must be 'active'

### Member Endpoints

```
GET    /api/election
       Get the current election details
       Returns: {
         id,
         title,
         description,
         question_text,
         status,
         voting_starts_at,
         voting_ends_at
       }

POST   /api/request-token
       Request a one-time voting token (MVP: store in DB only)
       Returns: {
         token,  // Plain token (sent once to member)
         expires_at,
         message: "Token issued. Save this token - Elections service integration pending."
       }

       Flow (MVP - Option A):
       1. Verify member has active membership
       2. Check if token already issued (one per member)
       3. Check election is published and within voting period
       4. Generate secure token (32 bytes hex)
       5. Hash token (SHA-256)
       6. Store token_hash in voting_tokens table (with kennitala)
       7. Return plain token to member

       Note: ✅ S2S registration with Elections service implemented (Phase 5)

GET    /api/my-status
       Check participation status
       Returns: {
         token_issued: boolean,
         voted: boolean,
         token_issued_at: timestamp (if issued)
       }

GET    /api/my-token
       Retrieve previously issued token (if exists and not expired)
       Returns: {
         token: string,
         issued_at: timestamp,
         expires_at: timestamp
       }

       Note: Only returns if token exists and hasn't expired

GET    /api/results
       Get results (✅ Phase 5: fetches from Elections service via S2S)
       Returns: {
         election_id: UUID,
         total_ballots: number,
         results: { yes: number, no: number, abstain: number },
         fetched_at: timestamp
       }
```

**Note**: ✅ Phase 5 complete. Full Elections service integration operational (Oct 10, 2025).

---

## Eligibility Logic (MVP)

### Simple Eligibility Check

```javascript
async function checkEligibility(election, memberClaims) {
  const errors = [];

  // Check membership status
  if (memberClaims.membership_status !== 'active') {
    errors.push('Membership must be active');
  }

  // Check election is published
  if (election.status !== 'published') {
    errors.push('Election is not published');
  }

  // Check timeline
  const now = new Date();
  if (now < new Date(election.voting_starts_at)) {
    errors.push('Voting has not started yet');
  }
  if (now > new Date(election.voting_ends_at)) {
    errors.push('Voting has ended');
  }

  // Check if token already issued (one per member)
  const existingToken = await db.query(
    'SELECT id, voted FROM voting_tokens WHERE kennitala = $1',
    [memberClaims.kennitala]
  );
  if (existingToken.rows.length > 0) {
    if (existingToken.rows[0].voted) {
      errors.push('You have already voted');
    } else {
      errors.push('Voting token already issued');
    }
  }

  return {
    eligible: errors.length === 0,
    errors
  };
}
```

---

## Voting Token Flow (MVP)

### Token Generation

```javascript
const crypto = require('crypto');

async function issueVotingToken(election, memberClaims) {
  // 1. Check eligibility
  const eligibility = await checkEligibility(election, memberClaims);
  if (!eligibility.eligible) {
    throw new Error(`Not eligible: ${eligibility.errors.join(', ')}`);
  }

  // 2. Generate secure token
  const token = crypto.randomBytes(32).toString('hex'); // 64 characters
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // 3. Set expiration (24 hours or election end, whichever is sooner)
  const expiresAt = new Date(
    Math.min(
      Date.now() + 24 * 60 * 60 * 1000,
      new Date(election.voting_ends_at).getTime()
    )
  );

  // 4. Store in database
  await db.query(`
    INSERT INTO voting_tokens (kennitala, token_hash, expires_at)
    VALUES ($1, $2, $3)
  `, [
    memberClaims.kennitala,
    tokenHash,
    expiresAt
  ]);

  // 5. Register token with Elections service (S2S) - ✅ Phase 5
  try {
    await electionsServiceClient.registerToken({
      token_hash: tokenHash
    });
  } catch (error) {
    console.error('Failed to register token with Elections service:', error);
    // Continue anyway (graceful degradation)
  }

  // 6. Return token to member
  return {
    token,
    expires_at: expiresAt,
    message: 'Token issued successfully. Use this token to vote via Elections service.'
  };
}
```

### Elections Service Client (S2S Communication) - ✅ Phase 5 Implemented

```javascript
// events/src/services/electionsClient.js (Oct 10, 2025)
const ELECTIONS_SERVICE_URL = process.env.ELECTIONS_SERVICE_URL ||
  'https://elections-service-521240388393.europe-west2.run.app';
const S2S_API_KEY = process.env.S2S_API_KEY;

async function registerToken(tokenHash) {
  const response = await fetch(`${ELECTIONS_SERVICE_URL}/api/s2s/register-token`, {
    method: 'POST',
    headers: {
      'X-API-Key': S2S_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ token_hash: tokenHash })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to register token: ${response.status} ${errorText}`);
  }

  return response.json();
}

async function fetchResults() {
  const response = await fetch(`${ELECTIONS_SERVICE_URL}/api/s2s/results`, {
    method: 'GET',
    headers: {
      'X-API-Key': S2S_API_KEY
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch results: ${response.status} ${errorText}`);
  }

  return response.json();
}

module.exports = {
  registerToken,
  fetchResults
};
```

**Deployed**: Oct 10, 2025 02:07 UTC (events-service-00002-dj7)
**S2S API Key**: Stored in Secret Manager (`elections-s2s-api-key`, version 2)

---

## Deployment Architecture (MVP)

```
┌─────────────────────────────────────────────────────────────┐
│ GCP Project: ekklesia-prod-10-2025                          │
│ Region: europe-west2 (London)                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────┐         ┌──────────────────┐
│ Firebase Hosting│◄────────┤ Members (Static) │
│                 │         │ HTML/CSS/JS      │
│ ekklesia-prod-  │         └──────────────────┘
│ 10-2025.web.app │
└────────┬────────┘
         │
         │ OAuth redirect
         ▼
┌─────────────────┐
│ Cloud Functions │
│ handleKenniAuth │
│ verifyMembership│
└────────┬────────┘
         │
         │ Issues JWT token
         ▼
┌──────────────────────────────────────────────────────────────┐
│ Cloud Run: events-service (`Atburðir`)                      │
│ URL: https://events-ymzrguoifa-nw.a.run.app                 │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ Express.js API (Events - MVP)                          │  │
│ │ - GET  /api/election                                   │  │
│ │ - POST /api/request-token                              │  │
│ │ - GET  /api/my-status                                  │  │
│ │ - GET  /api/results (proxies from Elections service)   │  │
│ │                                                        │  │
│ │ - Firebase auth middleware                             │  │
│ │ - Eligibility logic (active membership only)           │  │
│ │ - Token generation and S2S registration                │  │
│ └────────────────────────────────────────────────────────┘  │
└──────────────────┬──────────────┬────────────────────────────┘
                   │              │
                   │              │ S2S (register tokens, get results)
                   │              ▼
         ┌─────────▼───────┐  ┌──────────────────────────────────────┐
         │ Cloud SQL        │  │ Cloud Run: elections-service         │
         │ PostgreSQL 15   │  │ (`Kosningar`) - Next Phase           │
         │ ekklesia-db     │  │                                      │
         │                 │  │ - POST /api/s2s/tokens (register)    │
         │ - election      │  │ - POST /vote/:token (member voting)  │
         │ - voting_tokens │  │ - GET  /api/s2s/results              │
         └─────────────────┘  │                                      │
                              │ Database: ballots table (no PII)     │
                              └──────────────────────────────────────┘
```

---

## Security Considerations (MVP)

### Token Security
- **Entropy**: 32 bytes (256 bits) = cryptographically secure
- **Hashing**: SHA-256 before storage
- **Expiration**: 24 hours or election end
- **One-time use**: Database constraint + voted flag

### Privacy Model
- **Events service**: Stores kennitala → token_hash (audit trail)
- **Elections service**: Only receives token_hash, never kennitala
- **Separation**: Events can audit who voted, Elections cannot identify voters
- **S2S only**: Elections service has no public member-facing auth

### Access Control
- **Members**: Firebase JWT required (active membership checked)
- **S2S**: API key authentication for Events ↔ Elections communication
- **No admin endpoints in MVP**: Election created via database migration
- **Results**: Only visible after election status = 'closed'

---

## Implementation Phases (MVP - All Phases Complete ✅)

### Phase 1: Database Setup (Day 1) ✅ COMPLETE (Oct 9, 2025)
- [x] Create database migration script for Events service
- [x] Create `election` table (single row, hardcoded election)
- [x] Create `voting_tokens` table (with kennitala for audit)
- [x] Run migration on Cloud SQL (ekklesia-db: 34.147.159.80)
- [x] Verify connection from local environment

### Phase 2: Core API (Day 2-3) ✅ COMPLETE (Oct 9, 2025)
- [x] Set up Node.js/Express project (events-service)
- [x] Configure Cloud SQL connection (PostgreSQL 15, ekklesia-db)
- [x] Firebase Admin SDK integration
- [x] Implement auth middleware (verify JWT with kennitala claims)
- [x] GET /api/election (return election details)
- [x] POST /api/request-token (issue token, store in DB)
- [x] GET /api/my-status (check token issuance and voted status)
- [x] GET /api/my-token (return previously issued token if exists)

### Phase 3: Testing & Local Development (Day 4) ✅ COMPLETE (Oct 9, 2025)
- [x] Create test database seeds (sample election)
- [x] Test auth middleware with Firebase custom tokens
- [x] Test eligibility logic (active membership check)
- [x] Test token generation and storage
- [x] Verify token uniqueness constraints
- [x] Test error handling (expired election, duplicate token)

### Phase 4: Cloud Run Deployment (Day 5) ✅ COMPLETE (Oct 9, 2025)
- [x] Create Dockerfile for Node.js/Express
- [x] Deploy to Cloud Run (events-service-521240388393.europe-west2.run.app)
- [x] Configure environment variables (DATABASE_URL, FIREBASE_PROJECT_ID)
- [x] Configure Cloud SQL connection from Cloud Run
- [x] Manual election creation via SQL (INSERT INTO election)
- [x] Test with production Firebase tokens
- [x] Document actual Cloud Run URL

### Phase 5: Elections Service Integration ✅ COMPLETE (Oct 10, 2025)
- [x] Create Elections S2S client (events/src/services/electionsClient.js)
- [x] Update token service to register tokens with Elections (S2S)
- [x] Update results endpoint to fetch from Elections (S2S)
- [x] Configure S2S_API_KEY in deployment
- [x] Deploy updated Events service (events-service-00002-dj7)
- [x] Create test voting interface (members/public/test-events.html)
- [x] Deploy test page to Firebase Hosting
- [x] End-to-end integration testing
- [x] Document Phase 5 completion

**Status**: ✅ All phases complete. Full voting system operational (Oct 10, 2025).
**Documentation**: [docs/status/PHASE_5_INTEGRATION_COMPLETE.md](../status/PHASE_5_INTEGRATION_COMPLETE.md)

---

## Related Documentation

- [docs/SYSTEM_ARCHITECTURE_OVERVIEW.md](SYSTEM_ARCHITECTURE_OVERVIEW.md) - Overall system vision
- [members/README.md](../members/README.md) - Members service (authentication)

---

## MVP Scope Summary - Phase 5 Complete ✅

**What's included** (Events service - Full Integration):
- ✅ One election (Kosning: Prófunarkosning 2025)
- ✅ One question (yes/no/abstain)
- ✅ Firebase JWT authentication
- ✅ Active membership check
- ✅ One-time voting tokens (cryptographically secure, SHA-256 hashed)
- ✅ Token storage in database with audit trail (kennitala → token_hash)
- ✅ Token retrieval endpoint (GET /api/my-token)
- ✅ S2S token registration with Elections service (Phase 5, Oct 10)
- ✅ Results fetching from Elections service via S2S (Phase 5, Oct 10)
- ✅ Web-based voting interface for testing (test-events.html)
- ✅ End-to-end voting flow operational

**What's deferred** (Future phases):
- ⏸️ Multiple elections
- ⏸️ Multiple questions per election
- ⏸️ Admin UI (election created via SQL)
- ⏸️ Role-based access control (beyond active membership)
- ⏸️ Complex eligibility rules (dues, roles, etc.)
- ⏸️ Vote notification callback from Elections to Events (not needed for MVP)

**Deployment Status**:
- **Events Service**: https://events-service-521240388393.europe-west2.run.app (revision 00002-dj7, Oct 10)
- **Elections Service**: https://elections-service-521240388393.europe-west2.run.app (revision 00003-m6n, Oct 9)
- **Members Service**: https://ekklesia-prod-10-2025.web.app (includes test-events.html, Oct 10)
- **Phase 5 Documentation**: [docs/status/PHASE_5_INTEGRATION_COMPLETE.md](../status/PHASE_5_INTEGRATION_COMPLETE.md)
