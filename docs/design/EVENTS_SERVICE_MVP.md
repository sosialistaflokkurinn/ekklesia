# Events Service MVP Design Document

**Component**: Events System (`Atburðir`)
**Status**: 🔨 MVP Design Phase
**Last Updated**: 2025-10-08
**Purpose**: Election administration and voting token issuance
**MVP Scope**: One election, one question - manage election lifecycle and issue voting tokens
**Architecture**: This service works with Members (✅ production) and will hand off to Elections (`Kosningar`) service

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
         voting_ends_at,
         elections_service_url  // URL to Elections service for voting
       }

POST   /api/request-token
       Request a one-time voting token
       Returns: {
         token,  // Plain token (sent once to member)
         voting_url,  // URL to Elections service: https://elections-service/vote/:token
         expires_at
       }

       Flow:
       1. Verify member has active membership
       2. Check if token already issued (one per member)
       3. Check election is published and within voting period
       4. Generate secure token (32 bytes hex)
       5. Hash token (SHA-256)
       6. Store token_hash in voting_tokens table (with kennitala)
       7. Send token_hash to Elections service via S2S (register token)
       8. Return plain token + voting_url to member

GET    /api/my-status
       Check participation status
       Returns: { token_issued: boolean, voted: boolean }

GET    /api/results
       Get results from Elections service (only if election closed)
       Returns: { yes: number, no: number, abstain: number, total: number }

       Flow:
       1. Check election status is 'closed'
       2. Fetch results from Elections service via S2S
       3. Return results to member
```

**Note**: Voting happens on Elections (`Kosningar`) service, not here. Member is redirected with their token.

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

  // 5. Register token with Elections service (S2S)
  await electionsServiceClient.registerToken({
    election_id: election.elections_service_id,
    token_hash: tokenHash,
    expires_at: expiresAt
  });

  // 6. Return token + voting URL to member
  const votingUrl = `${ELECTIONS_SERVICE_URL}/vote/${token}`;
  return {
    token,
    voting_url: votingUrl,
    expires_at: expiresAt
  };
}
```

### Elections Service Client (S2S Communication)

```javascript
class ElectionsServiceClient {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async registerToken({ election_id, token_hash, expires_at }) {
    const response = await fetch(`${this.baseUrl}/api/s2s/tokens`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        election_id,
        token_hash,
        expires_at
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to register token: ${response.statusText}`);
    }

    return response.json();
  }

  async getResults(election_id) {
    const response = await fetch(`${this.baseUrl}/api/s2s/elections/${election_id}/results`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch results: ${response.statusText}`);
    }

    return response.json();
  }

  async notifyVoteSubmitted(token_hash) {
    // Elections service can call this endpoint to notify Events that a vote was cast
    // This updates the 'voted' flag in voting_tokens table
    const response = await fetch(`${this.baseUrl}/api/s2s/vote-notification`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token_hash })
    });

    if (!response.ok) {
      throw new Error(`Failed to notify vote: ${response.statusText}`);
    }

    return response.json();
  }
}
```

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

## Implementation Phases (MVP)

### Phase 1: Database Setup (Day 1)
- [ ] Create database migration script for Events service
- [ ] Create `election` table (single row, hardcoded election)
- [ ] Create `voting_tokens` table (with kennitala for audit)
- [ ] Run migration on Cloud SQL

### Phase 2: Core API (Day 2-3)
- [ ] Set up Node.js/Express project (events-service)
- [ ] Configure Cloud SQL connection
- [ ] Firebase Admin SDK integration
- [ ] Implement auth middleware (verify JWT)
- [ ] GET /api/election
- [ ] POST /api/request-token (with S2S call to Elections service)
- [ ] GET /api/my-status

### Phase 3: S2S & Results (Day 4)
- [ ] Implement Elections service client (S2S)
- [ ] POST /api/s2s/vote-notification endpoint (receives vote confirmations)
- [ ] GET /api/results (fetch from Elections service)
- [ ] Generate S2S API keys (Secret Manager)

### Phase 4: Deployment (Day 5)
- [ ] Create Dockerfile
- [ ] Deploy to Cloud Run (events-service)
- [ ] Configure environment variables (ELECTIONS_SERVICE_URL, S2S_API_KEY)
- [ ] Test with mock Elections service
- [ ] Manual election creation via SQL

**Note**: This phase implements Events service only. Elections service (`Kosningar`) is next phase.

---

## Related Documentation

- [docs/SYSTEM_ARCHITECTURE_OVERVIEW.md](SYSTEM_ARCHITECTURE_OVERVIEW.md) - Overall system vision
- [members/README.md](../members/README.md) - Members service (authentication)

---

## MVP Scope Summary

**What's included** (Events service):
- ✅ One election (Kosning)
- ✅ One question (yes/no/abstain)
- ✅ Firebase JWT authentication
- ✅ Active membership check
- ✅ One-time voting tokens (cryptographically secure)
- ✅ S2S token registration with Elections service
- ✅ Audit trail (kennitala → token_hash)
- ✅ Results fetching from Elections service

**What's deferred** (future phases):
- ❌ Multiple elections
- ❌ Multiple questions per election
- ❌ Admin UI (election created via SQL)
- ❌ Role-based access control (beyond active membership)
- ❌ Complex eligibility rules (dues, roles, etc.)
- ❌ Elections service implementation (next phase)
