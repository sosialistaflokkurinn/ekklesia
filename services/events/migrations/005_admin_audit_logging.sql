-- Events Service - Admin Audit Logging Schema Migration
-- Purpose: Add admin-specific columns and audit logging infrastructure
-- Database: Cloud SQL PostgreSQL 15 (ekklesia-db)
-- Date: 2025-10-22
-- Depends on: migration 004_move_to_elections_schema.sql

BEGIN;

-- =============================================================================
-- ELECTIONS TABLE EXTENSIONS
-- =============================================================================
-- Add admin-specific columns for election lifecycle management and auditing
-- Note: Use separate ADD COLUMN statements (PostgreSQL requirement)

ALTER TABLE elections.elections
  ADD COLUMN IF NOT EXISTS admin_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS voting_start_time TIMESTAMP,
  ADD COLUMN IF NOT EXISTS voting_end_time TIMESTAMP,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);

-- Add check constraint for status values (compatible with PostgreSQL < 15)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_admin_status'
      AND conrelid = 'elections.elections'::regclass
  ) THEN
    ALTER TABLE elections.elections
      ADD CONSTRAINT valid_admin_status
      CHECK (status IN ('draft', 'published', 'open', 'closed', 'paused', 'archived', 'deleted'));
  END IF;
END $$;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_elections_status ON elections.elections(status);
CREATE INDEX IF NOT EXISTS idx_elections_admin ON elections.elections(admin_id);
CREATE INDEX IF NOT EXISTS idx_elections_created_by ON elections.elections(created_by);
CREATE INDEX IF NOT EXISTS idx_elections_created_at ON elections.elections(created_at);
CREATE INDEX IF NOT EXISTS idx_elections_voting_period ON elections.elections(voting_start_time, voting_end_time);

-- =============================================================================
-- VOTING TOKENS TABLE EXTENSIONS
-- =============================================================================
-- Add election_id and usage tracking columns
-- Note: election_id type must match elections.elections(id) type (INTEGER or UUID)

ALTER TABLE elections.voting_tokens
  ADD COLUMN IF NOT EXISTS election_id INTEGER,
  ADD COLUMN IF NOT EXISTS member_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS used BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Add foreign key constraint for election_id (compatible with PostgreSQL < 15)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_voting_tokens_election_id'
      AND conrelid = 'elections.voting_tokens'::regclass
  ) THEN
    ALTER TABLE elections.voting_tokens
      ADD CONSTRAINT fk_voting_tokens_election_id
      FOREIGN KEY (election_id) REFERENCES elections.elections(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create unique constraint for one-time use (compatible with PostgreSQL < 15)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_election_member_token'
      AND conrelid = 'elections.voting_tokens'::regclass
  ) THEN
    ALTER TABLE elections.voting_tokens
      ADD CONSTRAINT unique_election_member_token
      UNIQUE (election_id, member_id);
  END IF;
END $$;

-- Create indexes for query optimization
CREATE INDEX IF NOT EXISTS idx_voting_tokens_election_id ON elections.voting_tokens(election_id);
CREATE INDEX IF NOT EXISTS idx_voting_tokens_member_id ON elections.voting_tokens(member_id);
CREATE INDEX IF NOT EXISTS idx_voting_tokens_used ON elections.voting_tokens(used);
CREATE INDEX IF NOT EXISTS idx_voting_tokens_election_used ON elections.voting_tokens(election_id, used);

-- =============================================================================
-- ADMIN AUDIT LOG TABLE
-- =============================================================================
-- Complete audit trail of all administrative actions

CREATE TABLE IF NOT EXISTS elections.admin_audit_log (
    id SERIAL PRIMARY KEY,

    -- Action metadata
    action_type VARCHAR(50) NOT NULL,         -- create, update, open, close, publish, archive, delete, etc.
    performed_by VARCHAR(255) NOT NULL,       -- Firebase UID of admin

    -- Election reference
    election_id INTEGER,                      -- FK to elections.id (must match elections table type)
    election_title VARCHAR(255),              -- Snapshot of election title for audit trail

    -- Change tracking
    details JSONB,                            -- Before/after values, change summary
    ip_address INET,                          -- Admin's IP address (for security audit)

    -- Timestamps
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    correlation_id VARCHAR(36),               -- Request correlation ID for tracing

    -- Constraints
    CONSTRAINT fk_audit_election_id FOREIGN KEY (election_id)
        REFERENCES elections.elections(id) ON DELETE CASCADE
);

-- Create indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON elections.admin_audit_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_election ON elections.admin_audit_log(election_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON elections.admin_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON elections.admin_audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_log_correlation ON elections.admin_audit_log(correlation_id);

-- Composite index for common queries (admin activity by election)
CREATE INDEX IF NOT EXISTS idx_audit_log_admin_election_time ON elections.admin_audit_log(performed_by, election_id, timestamp DESC);

-- =============================================================================
-- BALLOTS TABLE (Results tracking)
-- =============================================================================
-- Track individual votes for result calculations
-- Only created if it doesn't exist already

CREATE TABLE IF NOT EXISTS elections.ballots (
    id SERIAL PRIMARY KEY,

    -- Election reference
    election_id INTEGER NOT NULL,            -- FK to elections.id (must match elections table type)

    -- Vote data
    answer VARCHAR(255) NOT NULL,             -- Selected answer/choice
    token_hash VARCHAR(64),                   -- Token used (for fraud detection)

    -- Metadata
    cast_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT fk_ballots_election_id FOREIGN KEY (election_id)
        REFERENCES elections.elections(id) ON DELETE CASCADE
);

-- Create indexes for result queries
CREATE INDEX IF NOT EXISTS idx_ballots_election ON elections.ballots(election_id);
CREATE INDEX IF NOT EXISTS idx_ballots_election_answer ON elections.ballots(election_id, answer);
CREATE INDEX IF NOT EXISTS idx_ballots_token_hash ON elections.ballots(token_hash);
CREATE INDEX IF NOT EXISTS idx_ballots_cast_at ON elections.ballots(cast_at);

-- =============================================================================
-- PERMISSIONS AND CLEANUP
-- =============================================================================
-- Ensure postgres user can access all new tables

GRANT USAGE ON SCHEMA elections TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA elections TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA elections GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO postgres;

-- Create retention policy comment (for future cleanup job)
-- SELECT * FROM elections.admin_audit_log WHERE timestamp < NOW() - INTERVAL '30 days';
-- DELETE FROM elections.admin_audit_log WHERE timestamp < NOW() - INTERVAL '90 days';

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES (Run manually after migration)
-- =============================================================================

-- Verify new columns exist
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_schema = 'elections' AND table_name IN ('elections', 'voting_tokens')
--   ORDER BY table_name, ordinal_position;

-- Verify new tables exist
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'elections' ORDER BY table_name;

-- Verify all indexes
-- SELECT indexname, tablename FROM pg_indexes
--   WHERE schemaname = 'elections' ORDER BY tablename, indexname;

-- Verify constraints
-- SELECT conname, contype FROM pg_constraint
--   WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'elections')
--   ORDER BY conname;
