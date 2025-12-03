-- Events Service - Add Question Column to Elections Table
-- Purpose: Fix schema mismatch discovered during Epic #24 testing
-- Database: Cloud SQL PostgreSQL 15 (ekklesia-db)
-- Date: 2025-10-23
-- Depends on: migration 005_admin_audit_logging.sql
-- Issue: https://github.com/sosialistaflokkurinn/ekklesia/issues/96

BEGIN;

-- =============================================================================
-- ADD QUESTION COLUMN TO ELECTIONS TABLE
-- =============================================================================
-- Background:
-- Epic #24 admin API code (services/events/src/routes/admin.js) requires a
-- 'question' column for creating elections, but migration 005 did not create it.
-- This caused POST /api/admin/elections to fail with:
-- "column 'question' of relation 'elections' does not exist"
--
-- This migration adds the missing column to match the code requirements.

-- Add question column
-- DEFAULT '' allows existing rows to have empty question
-- NOT NULL enforces that future rows must have a question
ALTER TABLE elections.elections
  ADD COLUMN IF NOT EXISTS question TEXT NOT NULL DEFAULT '';

-- Add comment explaining the column
COMMENT ON COLUMN elections.elections.question IS
  'The main question being asked in this election (e.g., "Should we approve the budget?", "Who should be elected as treasurer?"). This is the primary prompt shown to voters.';

-- Create index for question text search (optional, for future full-text search)
-- CREATE INDEX IF NOT EXISTS idx_elections_question_trgm ON elections.elections USING gin(question gin_trgm_ops);
-- Note: Uncomment above if pg_trgm extension is enabled and full-text search is needed

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES (Run manually after migration)
-- =============================================================================

-- Verify column exists
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'elections' AND table_name = 'elections' AND column_name = 'question';

-- Verify existing data has default empty string
-- SELECT id, title, question FROM elections.elections;

-- Test insert with question
-- INSERT INTO elections.elections (title, question, answers, status)
-- VALUES ('Test Election', 'Should we test this?', '["yes", "no"]', 'draft')
-- RETURNING id, title, question;

-- Cleanup test
-- DELETE FROM elections.elections WHERE title = 'Test Election';
