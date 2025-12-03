-- Events Service - Fix voting_starts_at and voting_ends_at NOT NULL Constraints
-- Purpose: Allow draft elections to be created without voting times
-- Database: Cloud SQL PostgreSQL 15 (ekklesia-db)
-- Date: 2025-10-23
-- Depends on: migration 008_fix_question_text_constraint.sql
-- Issue: https://github.com/sosialistaflokkurinn/ekklesia/issues/96

BEGIN;

-- =============================================================================
-- MAKE VOTING TIMES NULLABLE
-- =============================================================================
-- Background:
-- Epic #24 admin API allows creating draft elections without voting times.
-- The voting times are set later when the election transitions from 'draft' to 'published'.
--
-- Current schema requires NOT NULL for:
-- - voting_starts_at
-- - voting_ends_at
--
-- This caused: "null value in column 'voting_starts_at' violates not-null constraint"
--
-- Solution: Make these columns nullable for draft elections.
-- They will be validated as NOT NULL when status changes to 'published'.

-- Remove NOT NULL constraints
ALTER TABLE elections.elections
  ALTER COLUMN voting_starts_at DROP NOT NULL;

ALTER TABLE elections.elections
  ALTER COLUMN voting_ends_at DROP NOT NULL;

-- Update comments to clarify when these should be set
COMMENT ON COLUMN elections.elections.voting_starts_at IS
  'When voting opens for this election. May be NULL for draft elections. Must be set before publishing.';

COMMENT ON COLUMN elections.elections.voting_ends_at IS
  'When voting closes for this election. May be NULL for draft elections. Must be set before publishing.';

-- Note: The existing check constraint "valid_timeline" (voting_starts_at < voting_ends_at)
-- will still be enforced when both values are non-NULL, which is correct.

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES (Run manually after migration)
-- =============================================================================

-- Verify voting times are now nullable
-- SELECT column_name, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'elections' AND table_name = 'elections'
--   AND column_name IN ('voting_starts_at', 'voting_ends_at')
-- ORDER BY column_name;

-- Test insert without voting times (draft election)
-- INSERT INTO elections.elections (title, description, question, answers, status)
-- VALUES ('Draft Election', 'Testing nullable voting times', 'Should this work?', '["yes", "no"]'::jsonb, 'draft')
-- RETURNING id, title, status, voting_starts_at, voting_ends_at;

-- Cleanup test
-- DELETE FROM elections.elections WHERE title = 'Draft Election';
