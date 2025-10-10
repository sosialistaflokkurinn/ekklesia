-- Elections Service MVP - Initial Schema
-- Database: ekklesia-db (PostgreSQL 15)
-- Schema: elections (separate from events schema)
-- Created: 2025-10-09
-- Purpose: Anonymous ballot recording for Prófunarkosning 2025

-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS elections;

-- Set search path
SET search_path TO elections, public;

-- =====================================================
-- Voting Tokens (registered by Events service via S2S)
-- =====================================================

CREATE TABLE IF NOT EXISTS voting_tokens (
    token_hash VARCHAR(64) PRIMARY KEY,  -- SHA-256 hash from Events service
    registered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    used BOOLEAN NOT NULL DEFAULT FALSE,
    used_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT valid_token_hash CHECK (length(token_hash) = 64)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_voting_tokens_used ON voting_tokens(used);
CREATE INDEX IF NOT EXISTS idx_voting_tokens_registered_at ON voting_tokens(registered_at);

-- =====================================================
-- Ballots (anonymous, append-only)
-- =====================================================

CREATE TABLE IF NOT EXISTS ballots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash VARCHAR(64) NOT NULL,

    -- Answer for MVP (yes/no/abstain for single hardcoded question)
    answer VARCHAR(20) NOT NULL,

    -- Timestamp (rounded to nearest minute for anonymity)
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT date_trunc('minute', NOW()),

    -- Constraints
    CONSTRAINT unique_token_ballot UNIQUE(token_hash),  -- One vote per token
    CONSTRAINT valid_answer CHECK (answer IN ('yes', 'no', 'abstain')),
    CONSTRAINT fk_token FOREIGN KEY (token_hash) REFERENCES voting_tokens(token_hash) ON DELETE CASCADE
);

-- Indexes for performance (results tabulation)
CREATE INDEX IF NOT EXISTS idx_ballots_answer ON ballots(answer);
CREATE INDEX IF NOT EXISTS idx_ballots_submitted_at ON ballots(submitted_at);
CREATE INDEX IF NOT EXISTS idx_ballots_token_hash ON ballots(token_hash);

-- =====================================================
-- Audit Log (system events only, no PII)
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    action VARCHAR(100) NOT NULL,  -- 'register_token', 'record_ballot', 'fetch_results'
    success BOOLEAN NOT NULL,
    details JSONB,  -- Never contains PII, only token_hash prefix for debugging

    -- Performance constraint (future: partition by year)
    CONSTRAINT recent_audit CHECK (timestamp >= NOW() - INTERVAL '1 year')
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_success ON audit_log(success) WHERE success = FALSE;

-- =====================================================
-- Comments and Documentation
-- =====================================================

COMMENT ON SCHEMA elections IS 'Elections Service MVP - Anonymous ballot recording (no PII)';
COMMENT ON TABLE voting_tokens IS 'One-time voting tokens registered by Events service (S2S only)';
COMMENT ON TABLE ballots IS 'Anonymous ballots - no member identity, only token hash';
COMMENT ON TABLE audit_log IS 'System audit trail - no PII, token hash prefix only';

COMMENT ON COLUMN voting_tokens.token_hash IS 'SHA-256 hash from Events service (64 hex chars)';
COMMENT ON COLUMN voting_tokens.used IS 'TRUE after member votes, prevents double voting';
COMMENT ON COLUMN ballots.answer IS 'MVP: yes/no/abstain for single question (Prófunarkosning 2025)';
COMMENT ON COLUMN ballots.submitted_at IS 'Rounded to nearest minute for anonymity';

-- =====================================================
-- Verification Queries (for testing)
-- =====================================================

-- Count registered tokens
-- SELECT COUNT(*) as total_tokens, COUNT(*) FILTER (WHERE used) as used_tokens FROM voting_tokens;

-- Count ballots by answer
-- SELECT answer, COUNT(*) as count FROM ballots GROUP BY answer ORDER BY answer;

-- Check audit log
-- SELECT timestamp, action, success FROM audit_log ORDER BY timestamp DESC LIMIT 10;

-- =====================================================
-- End of Migration
-- =====================================================

-- Reset search path
SET search_path TO public;

-- Grant permissions (adjust as needed)
-- GRANT USAGE ON SCHEMA elections TO elections_service_user;
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA elections TO elections_service_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA elections TO elections_service_user;
