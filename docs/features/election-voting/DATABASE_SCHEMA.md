# Elections Database Schema Reference

**Database**: ekklesia-db (Cloud SQL PostgreSQL 15)
**Schema**: `elections`
**Service**: Elections Service (Cloud Run)
**Created**: 2025-10-09
**Last Updated**: 2025-11-11
**Status**: ✅ Production

---

## Overview

The Elections service uses a dedicated `elections` schema for logical separation from the Events service. This schema supports both:
- **Member-based voting**: Firebase authenticated members (member_uid)
- **Anonymous voting**: Token-based voting system (token_hash)

### Schema Purpose

- **Logical separation**: Different services, different schemas
- **Access control**: GRANT permissions at schema level
- **Clear ownership**: Elections service owns elections schema
- **Cost optimization**: Same PostgreSQL instance, multiple schemas

---

## Tables

### 1. elections.elections

Election metadata, configuration, and lifecycle management.

#### Schema

```sql
CREATE TABLE elections.elections (
  -- Primary Key
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic Information
  title                VARCHAR(255) NOT NULL,
  description          TEXT,
  question             TEXT NOT NULL DEFAULT '',
  question_text        TEXT DEFAULT '',              -- Legacy field

  -- Lifecycle Status
  status               VARCHAR(50) NOT NULL DEFAULT 'draft',
  hidden               BOOLEAN NOT NULL DEFAULT false,

  -- Voting Configuration
  voting_type          VARCHAR(20) NOT NULL DEFAULT 'single-choice',
  max_selections       INTEGER DEFAULT 1,
  eligibility          VARCHAR(20) NOT NULL DEFAULT 'members',
  answers              JSONB NOT NULL DEFAULT '[]',

  -- Timestamps (Scheduled)
  scheduled_start      TIMESTAMP WITH TIME ZONE,
  scheduled_end        TIMESTAMP WITH TIME ZONE,

  -- Timestamps (Legacy - use scheduled_* instead)
  voting_starts_at     TIMESTAMP WITH TIME ZONE,
  voting_ends_at       TIMESTAMP WITH TIME ZONE,
  voting_start_time    TIMESTAMP WITHOUT TIME ZONE,
  voting_end_time      TIMESTAMP WITHOUT TIME ZONE,

  -- Lifecycle Timestamps
  created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  published_at         TIMESTAMP WITHOUT TIME ZONE,
  closed_at            TIMESTAMP WITHOUT TIME ZONE,
  archived_at          TIMESTAMP WITHOUT TIME ZONE,
  deleted_at           TIMESTAMP WITHOUT TIME ZONE,

  -- Audit Fields
  created_by           VARCHAR(255),                 -- Firebase UID
  updated_by           VARCHAR(128),                 -- Firebase UID
  admin_id             VARCHAR(255),                 -- Legacy field

  -- Integration
  elections_service_id UUID,

  -- Constraints
  CONSTRAINT valid_status
    CHECK (status IN ('draft', 'published', 'paused', 'closed', 'archived')),
  CONSTRAINT valid_voting_type
    CHECK (voting_type IN ('single-choice', 'multi-choice')),
  CONSTRAINT valid_eligibility
    CHECK (eligibility IN ('members', 'admins', 'all')),
  CONSTRAINT valid_max_selections
    CHECK (max_selections >= 1 AND max_selections <= jsonb_array_length(answers)),
  CONSTRAINT valid_timeline
    CHECK (voting_starts_at < voting_ends_at)
);
```

#### Indexes

```sql
-- Performance indexes
CREATE INDEX idx_elections_status ON elections (status);
CREATE INDEX idx_elections_hidden ON elections (hidden);
CREATE INDEX idx_elections_created_by ON elections (created_by);
CREATE INDEX idx_elections_scheduled_start ON elections (scheduled_start)
  WHERE scheduled_start IS NOT NULL;
CREATE INDEX idx_elections_scheduled_end ON elections (scheduled_end)
  WHERE scheduled_end IS NOT NULL;
```

#### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Primary key (auto-generated) |
| `title` | VARCHAR(255) | Yes | Election title displayed to users |
| `description` | TEXT | No | Detailed description of the election |
| `question` | TEXT | Yes | The question being voted on |
| `status` | VARCHAR(50) | Yes | Lifecycle status (draft → published → closed) |
| `hidden` | BOOLEAN | Yes | If true, election not visible to members |
| `voting_type` | VARCHAR(20) | Yes | 'single-choice' or 'multi-choice' |
| `max_selections` | INTEGER | No | Max answers member can select (multi-choice only) |
| `eligibility` | VARCHAR(20) | Yes | Who can vote: 'members', 'admins', 'all' |
| `answers` | JSONB | Yes | Array of answer objects: `[{"id": "str", "text": "str"}]` |
| `scheduled_start` | TIMESTAMPTZ | No | When voting opens (recommended field) |
| `scheduled_end` | TIMESTAMPTZ | No | When voting closes (recommended field) |
| `created_by` | VARCHAR(255) | No | Firebase UID of creator |
| `updated_by` | VARCHAR(128) | No | Firebase UID of last updater |

#### Answers JSONB Format

```json
[
  {
    "id": "yes",
    "text": "Yes, I approve"
  },
  {
    "id": "no",
    "text": "No, I reject"
  },
  {
    "id": "abstain",
    "text": "Abstain from voting"
  }
]
```

**Requirements:**
- Minimum 2 answers
- Each answer must have unique `id`
- `text` field is displayed to users
- `id` field is stored in ballots.answer_id

#### Status Lifecycle

```
draft → published → (paused) → closed → archived
  ↓
deleted (soft delete)
```

**Status Meanings:**
- `draft`: Being created, not visible to members
- `published`: Live, members can vote
- `paused`: Temporarily suspended
- `closed`: Voting ended, results available
- `archived`: Historical record

---

### 2. elections.ballots

Individual ballot records (votes cast by members or anonymous tokens).

#### Schema

```sql
CREATE TABLE elections.ballots (
  -- Primary Key
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Vote Data
  election_id  UUID,                        -- Which election
  answer_id    VARCHAR(128),                -- Selected answer ID
  answer       VARCHAR(20) NOT NULL,        -- Legacy: yes/no/abstain

  -- Voter Identity (mutually exclusive)
  member_uid   VARCHAR(128),                -- Firebase UID (member voting)
  token_hash   VARCHAR(64) NOT NULL,        -- SHA256 hash (anonymous voting)

  -- Timestamp (rounded for anonymity)
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL
               DEFAULT date_trunc('minute', NOW()),

  -- Foreign Keys
  CONSTRAINT fk_election
    FOREIGN KEY (election_id)
    REFERENCES elections.elections(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_token
    FOREIGN KEY (token_hash)
    REFERENCES elections.voting_tokens(token_hash)
    ON DELETE CASCADE,

  -- Data Validation
  CONSTRAINT valid_answer_data
    CHECK (answer_id IS NOT NULL OR
           answer IN ('yes', 'no', 'abstain'))
);
```

#### Indexes

```sql
-- Deduplication index (one vote per member per election)
CREATE UNIQUE INDEX idx_ballots_election_member_dedup
  ON ballots(election_id, member_uid)
  WHERE election_id IS NOT NULL AND member_uid IS NOT NULL;

-- Performance indexes
CREATE INDEX idx_ballots_election_id ON ballots(election_id)
  WHERE election_id IS NOT NULL;
CREATE INDEX idx_ballots_member_election ON ballots(member_uid, election_id)
  WHERE member_uid IS NOT NULL AND election_id IS NOT NULL;
CREATE INDEX idx_ballots_election_answer ON ballots(election_id, answer_id)
  WHERE election_id IS NOT NULL AND answer_id IS NOT NULL;
CREATE INDEX idx_ballots_token_hash ON ballots(token_hash);
CREATE INDEX idx_ballots_submitted_at ON ballots(submitted_at);
```

#### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Primary key (auto-generated) |
| `election_id` | UUID | No | References elections.id |
| `answer_id` | VARCHAR(128) | No* | Selected answer ID from elections.answers |
| `answer` | VARCHAR(20) | Yes | Legacy field (yes/no/abstain) |
| `member_uid` | VARCHAR(128) | No | Firebase UID for authenticated votes |
| `token_hash` | VARCHAR(64) | Yes | SHA256 hash (64 chars) |
| `submitted_at` | TIMESTAMPTZ | Yes | Rounded to nearest minute for anonymity |

**Note:** Either `answer_id` (new system) OR `answer` (legacy) must be provided.

#### Voting Systems

**Member-Based Voting** (Authenticated):
```sql
INSERT INTO elections.ballots
  (election_id, member_uid, answer_id, answer, token_hash, submitted_at)
VALUES
  ('550e8400-...', 'NE5e8GpzzBc...', 'js', 'JavaScript',
   '0000000000000000000000000000000000000000000000000000000000000000',
   date_trunc('minute', NOW()));
```

**Anonymous Voting** (Token-Based):
```sql
INSERT INTO elections.ballots
  (token_hash, answer, submitted_at)
VALUES
  ('a1b2c3d4e5f6...', 'yes', date_trunc('minute', NOW()));
```

#### Sentinel Token for Member Voting

**Token Hash**: `0000000000000000000000000000000000000000000000000000000000000000` (64 zeros)

**Purpose**: Satisfies foreign key constraint while distinguishing member votes from anonymous votes.

**Migration Required**:
```sql
INSERT INTO elections.voting_tokens (token_hash, election_id, issued_at, expires_at)
VALUES ('0000000000000000000000000000000000000000000000000000000000000000', NULL, NOW(), NULL)
ON CONFLICT (token_hash) DO NOTHING;
```

---

### 3. elections.voting_tokens

One-time tokens for anonymous voting system.

#### Schema

```sql
CREATE TABLE elections.voting_tokens (
  -- Primary Key
  token_hash    VARCHAR(64) PRIMARY KEY,

  -- Token Lifecycle
  registered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  issued_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMP WITH TIME ZONE,
  used          BOOLEAN NOT NULL DEFAULT false,
  used_at       TIMESTAMP WITH TIME ZONE,

  -- Association
  election_id   UUID,

  -- Constraints
  CONSTRAINT valid_token_hash
    CHECK (length(token_hash) = 64)
);
```

#### Indexes

```sql
CREATE INDEX idx_voting_tokens_used ON voting_tokens(used);
CREATE INDEX idx_voting_tokens_registered_at ON voting_tokens(registered_at);
```

#### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token_hash` | VARCHAR(64) | Yes | SHA256 hash of voting token |
| `registered_at` | TIMESTAMPTZ | Yes | When token was created |
| `issued_at` | TIMESTAMPTZ | Yes | When token was issued to voter |
| `expires_at` | TIMESTAMPTZ | No | When token expires (optional) |
| `used` | BOOLEAN | Yes | Whether token has been used |
| `used_at` | TIMESTAMPTZ | No | When vote was cast with this token |
| `election_id` | UUID | No | Associated election (optional) |

#### Token Lifecycle

```
1. Token generated → token_hash stored
2. Token issued to voter → registered_at set
3. Voter submits ballot → used = TRUE, used_at = NOW()
```

**Security**: Only SHA256 hash is stored, never the plaintext token.

---

## Relationships

```
elections.elections (1) ──→ (0..*) elections.ballots
    ↑                              ↓
    │                              │
    │                       (FK: election_id)
    │
    └── Referenced by ballots for election metadata

elections.voting_tokens (1) ──→ (0..1) elections.ballots
    ↑                                   ↓
    │                                   │
    │                            (FK: token_hash)
    │
    └── One token = one vote (uniqueness enforced)
```

---

## Common Queries

### Check if Member Has Voted

```sql
SELECT COUNT(*) as has_voted
FROM elections.ballots
WHERE election_id = '550e8400-e29b-41d4-a716-446655440001'
  AND member_uid = 'NE5e8GpzzBcjxuTHWGuJtTfevPD2';
```

### Get Election Results

```sql
SELECT
  answer_id,
  COUNT(*) as votes,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM elections.ballots
WHERE election_id = '550e8400-e29b-41d4-a716-446655440001'
  AND answer_id IS NOT NULL
GROUP BY answer_id
ORDER BY votes DESC;
```

### List Member's Elections with Vote Status

```sql
SELECT
  e.id,
  e.title,
  e.question,
  e.status,
  e.scheduled_start,
  e.scheduled_end,
  EXISTS(
    SELECT 1
    FROM elections.ballots b
    WHERE b.election_id = e.id
      AND b.member_uid = 'FIREBASE_UID'
  ) as has_voted
FROM elections.elections e
WHERE e.status = 'published'
  AND e.hidden = false
ORDER BY e.scheduled_start DESC;
```

### Get Total Votes for Election

```sql
SELECT COUNT(*) as total_votes
FROM elections.ballots
WHERE election_id = '550e8400-e29b-41d4-a716-446655440001';
```

---

## Migrations

### Applied Migrations

1. **001_initial_schema.sql** (2025-10-09)
   - Created `voting_tokens`, `ballots`, `audit_log` tables
   - Anonymous voting system

2. **002_elections_table.sql** (2025-10-19)
   - Created `elections` table
   - Election metadata and lifecycle

3. **003_admin_features.sql** (2025-11-06)
   - Admin enhancements
   - Additional indexes

4. **004_ballots_multi_election.sql** (2025-11-10)
   - Member voting support
   - `election_id`, `member_uid`, `answer_id` fields
   - Deduplication index

### Migration Files Location

`services/elections/migrations/`

**See**: [services/elections/migrations/README.md](../../../services/elections/migrations/README.md) for migration instructions.

---

## Performance Considerations

### Connection Pooling

Elections service uses connection pool:
- **Min connections**: 2 per Cloud Run instance
- **Max connections**: 5 per Cloud Run instance
- **Total capacity**: 100 instances × 5 = 500 connections
- **Database tier**: db-g1-small (sufficient for 300 votes/sec)

### Query Optimization

All critical queries are indexed:
- Vote deduplication: `idx_ballots_election_member_dedup` (UNIQUE)
- Results counting: `idx_ballots_election_answer`
- Has voted check: `idx_ballots_member_election`
- Token validation: `voting_tokens_pkey` (PRIMARY KEY)

### Anonymity Protection

**Timestamp rounding**: All votes rounded to nearest minute
```sql
submitted_at = date_trunc('minute', NOW())
```

**Purpose**: Prevents timing-based voter identification

---

## Security

### Data Protection

- **No PII in ballots**: Only member_uid (opaque Firebase ID)
- **Hashed tokens**: Only SHA256 hash stored, never plaintext
- **Deduplication**: Database-level constraint prevents double voting
- **Cascade deletes**: Deleting election removes all ballots

### Access Control

Schema-level permissions:
```sql
GRANT SELECT, INSERT ON elections.ballots TO elections_service;
GRANT SELECT, UPDATE ON elections.voting_tokens TO elections_service;
GRANT ALL ON elections.elections TO elections_service;
```

### Audit Trail

- `created_by` / `updated_by`: Track who modified elections
- `created_at` / `updated_at`: Track when elections changed
- Lifecycle timestamps: `published_at`, `closed_at`, `archived_at`

---

## Backup & Recovery

### Cloud SQL Automated Backups

- **Frequency**: Daily at 03:00 UTC
- **Retention**: 7 days
- **Point-in-time recovery**: Enabled (7 days)

### Manual Backup Before Changes

```bash
# Export elections schema
gcloud sql export sql ekklesia-db \
  gs://ekklesia-backups/manual/elections-$(date +%Y%m%d).sql \
  --database=postgres \
  --offload
```

---

## Related Documentation

- [Elections Service README](../../../services/elections/README.md) - Service overview
- [Migrations README](../../../services/elections/migrations/README.md) - Migration guide
- [Admin API Reference](ADMIN_API_REFERENCE.md) - API endpoints
- [Cloud SQL Documentation](https://cloud.google.com/sql/docs/postgres) - Database platform

---

**Last Updated**: 2025-11-11
**Schema Version**: 4 (004_ballots_multi_election.sql)
**Status**: ✅ Active (Beta)
**Next Review**: 2026-02-11 (Quarterly)
