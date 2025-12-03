-- Events Service - Add Answers Column to Elections Table
-- Purpose: Fix schema mismatch discovered during Epic #24 testing (second missing column)
-- Database: Cloud SQL PostgreSQL 15 (ekklesia-db)
-- Date: 2025-10-23
-- Depends on: migration 006_add_question_column.sql
-- Issue: https://github.com/sosialistaflokkurinn/ekklesia/issues/96

BEGIN;

-- =============================================================================
-- ADD ANSWERS COLUMN TO ELECTIONS TABLE
-- =============================================================================
-- Background:
-- Epic #24 admin API code (services/events/src/routes/admin.js:406) requires an
-- 'answers' column for creating elections, but migration 005 did not create it.
-- This caused POST /api/admin/elections to fail with:
-- "column 'answers' of relation 'elections' does not exist"
--
-- The code stores answers as JSON: JSON.stringify(answers) on line 409.
-- This migration adds the missing column to match the code requirements.

-- Add answers column (JSONB for better performance with JSON data)
-- DEFAULT '[]' allows existing rows to have empty array
-- NOT NULL enforces that future rows must have answers
ALTER TABLE elections.elections
  ADD COLUMN IF NOT EXISTS answers JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Add comment explaining the column
COMMENT ON COLUMN elections.elections.answers IS
  'The list of possible answers for this election, stored as JSON array. Example: ["yes", "no", "abstain"] for a simple vote, or more complex structures for multi-choice elections.';

-- Add index for JSONB queries (optional, for future analytics)
-- CREATE INDEX IF NOT EXISTS idx_elections_answers_gin ON elections.elections USING gin(answers);
-- Note: Uncomment above if JSONB queries on answers are needed

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES (Run manually after migration)
-- =============================================================================

-- Verify column exists
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'elections' AND table_name = 'elections' AND column_name = 'answers';

-- Verify existing data has default empty array
-- SELECT id, title, answers FROM elections.elections;

-- Test insert with answers
-- INSERT INTO elections.elections (title, question, answers, status)
-- VALUES ('Test Election', 'Should we test this?', '["yes", "no"]'::jsonb, 'draft')
-- RETURNING id, title, question, answers;

-- Cleanup test
-- DELETE FROM elections.elections WHERE title = 'Test Election';
