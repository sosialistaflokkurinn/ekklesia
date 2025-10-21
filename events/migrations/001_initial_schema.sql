-- Events Service - Initial Schema Migration
-- Purpose: Election administration and voting token issuance
-- Database: Cloud SQL PostgreSQL 15 (ekklesia-db)
-- Date: 2025-10-09

-- =============================================================================
-- ELECTION TABLE
-- =============================================================================
-- Stores a single election with voting timeline and question
-- MVP: One election only (hardcoded row inserted below)
-- Future: Multiple elections supported by design

CREATE TABLE IF NOT EXISTS election (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Election details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    question_text TEXT NOT NULL,

    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    -- Valid statuses: 'draft', 'published', 'closed'

    -- Voting timeline
    voting_starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
    voting_ends_at TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('draft', 'published', 'closed')),
    CONSTRAINT valid_timeline CHECK (voting_starts_at < voting_ends_at)
);

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_election_status ON election(status);

-- Index for timeline queries
CREATE INDEX IF NOT EXISTS idx_election_timeline ON election(voting_starts_at, voting_ends_at);

-- =============================================================================
-- VOTING TOKENS TABLE
-- =============================================================================
-- Stores one-time voting tokens with audit trail
-- Links kennitala (PII) to token_hash for audit purposes
-- Token hash is sent to Elections service (Phase 2), kennitala stays here

CREATE TABLE IF NOT EXISTS voting_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Member identification (PII - stays in Events service)
    kennitala VARCHAR(11) NOT NULL,
    -- Format: DDMMYY-NNNN (Icelandic national ID)

    -- Token details
    token_hash VARCHAR(64) NOT NULL,
    -- SHA-256 hash of the 32-byte random token

    -- Timestamps
    issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Usage tracking (updated by Elections service via S2S in Phase 2)
    voted BOOLEAN NOT NULL DEFAULT FALSE,
    voted_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT unique_kennitala UNIQUE (kennitala),
    -- One token per member (enforced at database level)

    CONSTRAINT unique_token_hash UNIQUE (token_hash),
    -- Each token must be globally unique

    CONSTRAINT valid_kennitala_format CHECK (kennitala ~ '^\d{6}-\d{4}$'),
    -- Validate kennitala format: DDMMYY-NNNN

    CONSTRAINT valid_expiration CHECK (expires_at > issued_at),
    -- Token must expire after issuance

    CONSTRAINT voted_requires_timestamp CHECK (
        (voted = FALSE AND voted_at IS NULL) OR
        (voted = TRUE AND voted_at IS NOT NULL)
    )
    -- If voted, must have timestamp; if not voted, no timestamp
);

-- Index for kennitala lookups (checking if token already issued)
CREATE INDEX IF NOT EXISTS idx_voting_tokens_kennitala ON voting_tokens(kennitala);

-- Index for token_hash lookups (validation from Elections service)
CREATE INDEX IF NOT EXISTS idx_voting_tokens_hash ON voting_tokens(token_hash);

-- Index for voted status queries
CREATE INDEX IF NOT EXISTS idx_voting_tokens_voted ON voting_tokens(voted);

-- Index for expiration queries (cleanup of expired tokens)
CREATE INDEX IF NOT EXISTS idx_voting_tokens_expires ON voting_tokens(expires_at);

-- =============================================================================
-- SEED DATA (MVP - Hardcoded Election)
-- =============================================================================
-- Insert a sample election for MVP testing
-- This will be the only election in the MVP

INSERT INTO election (
    title,
    description,
    question_text,
    status,
    voting_starts_at,
    voting_ends_at
) VALUES (
    'Prófunarkosning 2025',
    'Þetta er prófunarkosning fyrir Samstaða Ekklesia kerfið. Kosningin er ætluð til prófunar á atkvæðagreiðslukerfinu.',
    'Samþykkir þú innleiðingu á nýju rafrænni atkvæðagreiðslukerfi fyrir Samstaða?',
    'published',
    NOW(),  -- Voting starts immediately
    NOW() + INTERVAL '30 days'  -- Voting ends in 30 days
) ON CONFLICT DO NOTHING;
-- ON CONFLICT ensures idempotent migration (safe to re-run)

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================
-- Run these after migration to verify setup

-- Check tables exist
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

-- Check election row
-- SELECT id, title, status, voting_starts_at, voting_ends_at FROM election;

-- Check indexes
-- SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;

-- Check constraints
-- SELECT conname, contype, conrelid::regclass FROM pg_constraint WHERE connamespace = 'public'::regnamespace ORDER BY conrelid::regclass::text;
