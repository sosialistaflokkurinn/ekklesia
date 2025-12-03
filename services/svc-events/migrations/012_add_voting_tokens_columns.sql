-- Events Service - Add Missing voting_tokens Columns
-- Purpose: Add issued_at and expires_at columns for Epic #24 open voting endpoint
-- Database: Cloud SQL PostgreSQL 15 (ekklesia-db)
-- Date: 2025-10-23
-- Depends on: migration 011_drop_old_status_constraint.sql
-- Issue: Epic #24 POST /elections/:id/open failing due to missing columns

BEGIN;

-- =============================================================================
-- ADD MISSING COLUMNS TO voting_tokens
-- =============================================================================
-- Background:
-- POST /elections/:id/open tries to INSERT:
--   (election_id, token_hash, issued_at, expires_at, used)
--
-- But voting_tokens table has:
--   - registered_at (instead of issued_at)
--   - No expires_at column
--
-- Root cause: Table was created for Epic #87 (Elections service) but
-- Epic #24 admin API (Events service) expects different column names.
--
-- Solution: Add the missing columns and keep registered_at for backward compat

-- Add issued_at column (alias for registered_at)
ALTER TABLE elections.voting_tokens
  ADD COLUMN IF NOT EXISTS issued_at TIMESTAMP WITH TIME ZONE;

-- Set issued_at to registered_at for existing rows
UPDATE elections.voting_tokens
  SET issued_at = registered_at
  WHERE issued_at IS NULL;

-- Make issued_at NOT NULL and default to NOW()
ALTER TABLE elections.voting_tokens
  ALTER COLUMN issued_at SET DEFAULT NOW(),
  ALTER COLUMN issued_at SET NOT NULL;

-- Add expires_at column
ALTER TABLE elections.voting_tokens
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Set default expires_at to 24 hours after issued_at for existing rows
UPDATE elections.voting_tokens
  SET expires_at = registered_at + INTERVAL '24 hours'
  WHERE expires_at IS NULL;

-- Add comments
COMMENT ON COLUMN elections.voting_tokens.issued_at IS
  'When the voting token was issued to the member. Semantically equivalent to registered_at.';

COMMENT ON COLUMN elections.voting_tokens.expires_at IS
  'When the voting token expires. Typically 24 hours after issuance.';

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES (Run manually after migration)
-- =============================================================================

-- Verify columns exist
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'elections'
--   AND table_name = 'voting_tokens'
--   AND column_name IN ('issued_at', 'expires_at', 'registered_at');

-- Test insert with new columns
-- INSERT INTO elections.voting_tokens (election_id, token_hash, issued_at, expires_at, used)
-- VALUES (gen_random_uuid(), repeat('a', 64), NOW(), NOW() + INTERVAL '24 hours', false)
-- RETURNING *;

-- Cleanup test
-- DELETE FROM elections.voting_tokens WHERE token_hash = repeat('a', 64);
