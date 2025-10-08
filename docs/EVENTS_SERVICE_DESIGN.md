# Events Service Design Document

**Component**: Events System (`Atburðir`)
**Status**: 🔨 Design Phase
**Last Updated**: 2025-10-07
**Purpose**: Election administration, voting token issuance, and eligibility management

---

## Overview

The Events service is the central coordination component that:
- Manages election lifecycle (creation, publication, closure)
- Determines member eligibility for each election
- Issues one-time voting tokens to eligible members
- Coordinates server-to-server communication with the Voting service
- Displays election results to authorized members

---

## Architecture Principles

### Separation of Concerns
- **Events service**: Knows about members and elections (PII exists here)
- **Voting service**: Knows only about tokens and ballots (no PII)
- **Communication**: Server-to-server only (no direct member access to Voting)

### Security Model
- JWT authentication from Firebase (Members service)
- Role-based access control (member vs admin)
- Audit logging for all sensitive operations
- One-time voting tokens (cryptographically secure, non-guessable)

### Data Sovereignty
- All PII stays in Events service
- Voting tokens are hashed before being sent to Voting service
- Audit trail links member → token → ballot without exposing identity

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

### Database Schema

```sql
-- Elections
CREATE TABLE elections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    election_type VARCHAR(50) NOT NULL, -- 'officer', 'referendum', 'board'
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'published', 'active', 'paused', 'closed', 'archived'

    -- Eligibility rules
    requires_membership BOOLEAN NOT NULL DEFAULT TRUE,
    requires_paid_dues BOOLEAN NOT NULL DEFAULT TRUE,
    allowed_roles JSONB, -- null = all members, or ['board', 'officer']

    -- Timeline
    publish_at TIMESTAMP,
    voting_starts_at TIMESTAMP NOT NULL,
    voting_ends_at TIMESTAMP NOT NULL,

    -- Metadata
    created_by VARCHAR(255) NOT NULL, -- kennitala of creator
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(255), -- kennitala of last updater

    -- Voting service integration
    voting_service_election_id UUID, -- ID in Voting service

    CONSTRAINT valid_timeline CHECK (voting_starts_at < voting_ends_at)
);

CREATE INDEX idx_elections_status ON elections(status);
CREATE INDEX idx_elections_voting_dates ON elections(voting_starts_at, voting_ends_at);

-- Questions/Ballots
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,

    question_text TEXT NOT NULL,
    question_order INT NOT NULL,

    -- Ballot configuration
    ballot_type VARCHAR(50) NOT NULL, -- 'yes_no', 'single_choice', 'ranked_choice'
    ballot_schema JSONB NOT NULL, -- Options, candidates, etc.

    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE(election_id, question_order)
);

-- Voting Tokens (audit trail)
CREATE TABLE voting_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,

    -- Member identification (PII)
    kennitala VARCHAR(11) NOT NULL, -- Who was issued this token

    -- Token details
    token_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of the actual token
    issued_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,

    -- Usage tracking
    used BOOLEAN NOT NULL DEFAULT FALSE,
    used_at TIMESTAMP,

    -- Audit
    ip_address INET,
    user_agent TEXT,

    UNIQUE(election_id, kennitala), -- One token per member per election
    UNIQUE(token_hash) -- Each token is unique
);

CREATE INDEX idx_voting_tokens_election ON voting_tokens(election_id);
CREATE INDEX idx_voting_tokens_kennitala ON voting_tokens(kennitala);
CREATE INDEX idx_voting_tokens_hash ON voting_tokens(token_hash);

-- Audit Log
CREATE TABLE audit_log (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Who
    actor_kennitala VARCHAR(11), -- null for system actions
    actor_role VARCHAR(50),

    -- What
    action VARCHAR(100) NOT NULL, -- 'create_election', 'publish_election', 'issue_token', etc.
    resource_type VARCHAR(50) NOT NULL, -- 'election', 'question', 'token'
    resource_id UUID,

    -- Context
    details JSONB,
    ip_address INET,
    user_agent TEXT
);

CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_log_actor ON audit_log(actor_kennitala);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
```

---

## API Design

### Authentication
All requests require Firebase ID token in `Authorization: Bearer <token>` header.

Token claims:
- `uid`: Firebase user ID
- `kennitala`: Icelandic national ID
- `roles`: Array of roles (from Firestore)
- `membership_status`: Active/inactive
- `dues_paid`: Boolean

### Member Endpoints

```
GET    /api/elections
       List all published/active elections (filtered by eligibility)

GET    /api/elections/:id
       Get election details + questions

POST   /api/elections/:id/request-token
       Request a one-time voting token
       Returns: { token, voting_url, expires_at }

       Flow:
       1. Verify member eligibility (membership, dues, roles, timeline)
       2. Check if token already issued (one per election)
       3. Generate cryptographically secure token (32 bytes, hex)
       4. Store token_hash in voting_tokens table
       5. Call Voting service S2S to register token
       6. Return token to member

GET    /api/elections/:id/my-status
       Check participation status (token issued? used?)

GET    /api/elections/:id/results
       Get results (only if election closed + member has permission)
```

### Admin Endpoints

```
POST   /api/admin/elections
       Create draft election
       Requires: 'admin' or 'election_officer' role

PUT    /api/admin/elections/:id
       Update draft election

POST   /api/admin/elections/:id/questions
       Add question to election

PUT    /api/admin/elections/:id/questions/:qid
       Update question

DELETE /api/admin/elections/:id/questions/:qid
       Delete question (soft delete)

POST   /api/admin/elections/:id/publish
       Publish election (validate, create in Voting service)

       Flow:
       1. Validate election (has questions, valid timeline)
       2. Call Voting service S2S to create election
       3. Store voting_service_election_id
       4. Update status to 'published'
       5. Log audit trail

POST   /api/admin/elections/:id/pause
       Pause active election

POST   /api/admin/elections/:id/resume
       Resume paused election

POST   /api/admin/elections/:id/close
       Close election (fetch results from Voting service)

       Flow:
       1. Call Voting service S2S to close election
       2. Fetch results from Voting service
       3. Store results snapshot
       4. Update status to 'closed'
       5. Log audit trail

GET    /api/admin/elections/:id/audit-log
       Get full audit trail for election

GET    /api/admin/elections/:id/tokens
       List all issued tokens (for verification)
       Shows: kennitala, issued_at, used, used_at
```

---

## Eligibility Logic

### Member Eligibility Check

```javascript
async function checkEligibility(election, memberClaims) {
  const errors = [];

  // Check membership status
  if (election.requires_membership && memberClaims.membership_status !== 'active') {
    errors.push('Membership must be active');
  }

  // Check dues payment
  if (election.requires_paid_dues && !memberClaims.dues_paid) {
    errors.push('Membership dues must be paid');
  }

  // Check role requirements
  if (election.allowed_roles && election.allowed_roles.length > 0) {
    const hasRole = election.allowed_roles.some(role =>
      memberClaims.roles.includes(role)
    );
    if (!hasRole) {
      errors.push(`Must have one of these roles: ${election.allowed_roles.join(', ')}`);
    }
  }

  // Check timeline
  const now = new Date();
  if (now < new Date(election.voting_starts_at)) {
    errors.push('Voting has not started yet');
  }
  if (now > new Date(election.voting_ends_at)) {
    errors.push('Voting has ended');
  }

  // Check if token already issued
  const existingToken = await db.query(
    'SELECT id, used FROM voting_tokens WHERE election_id = $1 AND kennitala = $2',
    [election.id, memberClaims.kennitala]
  );
  if (existingToken.rows.length > 0) {
    if (existingToken.rows[0].used) {
      errors.push('You have already voted in this election');
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

## Voting Token Flow

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
    INSERT INTO voting_tokens
      (election_id, kennitala, token_hash, expires_at, ip_address, user_agent)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [
    election.id,
    memberClaims.kennitala,
    tokenHash,
    expiresAt,
    req.ip,
    req.get('user-agent')
  ]);

  // 5. Register token with Voting service (S2S)
  await votingServiceClient.registerToken({
    election_id: election.voting_service_election_id,
    token_hash: tokenHash,
    expires_at: expiresAt
  });

  // 6. Log audit trail
  await logAudit({
    actor_kennitala: memberClaims.kennitala,
    action: 'issue_voting_token',
    resource_type: 'token',
    resource_id: election.id,
    details: { election_title: election.title }
  });

  // 7. Return token to member
  return {
    token,
    voting_url: `${VOTING_SERVICE_URL}/vote/${token}`,
    expires_at: expiresAt,
    election_id: election.id
  };
}
```

---

## Server-to-Server Integration

### Voting Service API Client

```javascript
class VotingServiceClient {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async createElection(election, questions) {
    const response = await fetch(`${this.baseUrl}/api/s2s/elections`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        external_election_id: election.id,
        title: election.title,
        voting_starts_at: election.voting_starts_at,
        voting_ends_at: election.voting_ends_at,
        questions: questions.map(q => ({
          external_question_id: q.id,
          question_text: q.question_text,
          ballot_type: q.ballot_type,
          ballot_schema: q.ballot_schema
        }))
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create election in Voting service: ${response.statusText}`);
    }

    const data = await response.json();
    return data.election_id; // Voting service's internal ID
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
      throw new Error(`Failed to register token in Voting service: ${response.statusText}`);
    }

    return response.json();
  }

  async closeElection(election_id) {
    const response = await fetch(`${this.baseUrl}/api/s2s/elections/${election_id}/close`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to close election in Voting service: ${response.statusText}`);
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
      throw new Error(`Failed to fetch results from Voting service: ${response.statusText}`);
    }

    return response.json();
  }
}
```

---

## Deployment Architecture

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
│ Cloud Run: events-service                                    │
│ URL: https://events-ymzrguoifa-nw.a.run.app                  │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ Express.js API                                         │  │
│ │ - Member endpoints (list, request-token, status)       │  │
│ │ - Admin endpoints (CRUD elections, publish, close)     │  │
│ │ - Firebase auth middleware                             │  │
│ │ - Eligibility logic                                    │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ Voting Service Client (S2S)                            │  │
│ │ - Create election                                      │  │
│ │ - Register tokens                                      │  │
│ │ - Fetch results                                        │  │
│ └────────────────────────────────────────────────────────┘  │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
         ┌─────────────────┐
         │ Cloud SQL        │
         │ PostgreSQL 15   │
         │ ekklesia-db     │
         │                 │
         │ - elections     │
         │ - questions     │
         │ - voting_tokens │
         │ - audit_log     │
         └─────────────────┘
```

---

## Security Considerations

### Token Security
- **Entropy**: 32 bytes (256 bits) = cryptographically secure
- **Hashing**: SHA-256 before storage/transmission
- **Expiration**: 24 hours or election end
- **One-time use**: Database constraint enforces single redemption

### PII Protection
- **Events service**: Contains PII (kennitala, member data)
- **Voting service**: No PII (only token hashes and ballots)
- **Audit trail**: Links member → token hash → ballot (without exposing identity to Voting service)

### Access Control
- **Members**: Can only see their own data + eligible elections
- **Admins**: Role-based access (checked via Firebase custom claims)
- **S2S**: API key authentication for Voting service communication

### Audit Logging
- All sensitive actions logged (create, publish, close, token issuance)
- Immutable audit_log table
- Includes actor, timestamp, action, resource, IP, user agent

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
- [ ] Set up Node.js/Express project structure
- [ ] Configure Cloud SQL connection
- [ ] Create database schema (migrations)
- [ ] Firebase Admin SDK integration
- [ ] Deploy to Cloud Run (hello world)

### Phase 2: Member Experience (Week 2)
- [ ] Implement Firebase auth middleware
- [ ] GET /api/elections (list elections)
- [ ] GET /api/elections/:id (election details)
- [ ] Eligibility check logic
- [ ] POST /api/elections/:id/request-token (token issuance)
- [ ] GET /api/elections/:id/my-status

### Phase 3: Admin Interface (Week 3)
- [ ] Role-based access control middleware
- [ ] POST /api/admin/elections (create draft)
- [ ] PUT /api/admin/elections/:id (update)
- [ ] POST /api/admin/elections/:id/questions (add question)
- [ ] Audit logging implementation

### Phase 4: Voting Service Integration (Week 4)
- [ ] Voting service S2S client
- [ ] POST /api/admin/elections/:id/publish (S2S create election)
- [ ] Token registration (S2S)
- [ ] POST /api/admin/elections/:id/close (S2S fetch results)
- [ ] GET /api/elections/:id/results

### Phase 5: Testing & Deployment (Week 5)
- [ ] Integration tests
- [ ] End-to-end testing with Voting service
- [ ] Security audit
- [ ] Production deployment
- [ ] Documentation

---

## Related Documentation

- [docs/SYSTEM_ARCHITECTURE_OVERVIEW.md](SYSTEM_ARCHITECTURE_OVERVIEW.md) - Overall system vision
- [members/README.md](../members/README.md) - Members service (authentication)
- [docs/VOTING_SERVICE_DESIGN.md](VOTING_SERVICE_DESIGN.md) - Voting service design (to be created)
- GitHub Issues: Epic #17 (Member Experience), Epic #24 (Admin)

---

## Open Questions

1. **Technology choice**: Node.js vs Python?
   - **Decision**: Node.js (matches Firebase Functions, faster prototyping)

2. **Database migrations**: Alembic (Python) vs node-pg-migrate?
   - **Decision**: node-pg-migrate (matches Node.js choice)

3. **Frontend**: Build admin UI or API-only?
   - **Decision**: API-only initially, admin UI in Phase 6

4. **Result caching**: Store results snapshot or fetch on-demand?
   - **Decision**: Store snapshot (performance, audit trail)

5. **Token format**: JWT vs random string?
   - **Decision**: Random string (simpler, no signature verification overhead)

6. **Multi-question elections**: One token for all questions or one per question?
   - **Decision**: One token per election (member votes on all questions in one session)
