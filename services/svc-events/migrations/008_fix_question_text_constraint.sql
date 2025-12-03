-- Events Service - Fix question_text NOT NULL Constraint
-- Purpose: Allow question_text to be nullable since admin.js uses 'question' column
-- Database: Cloud SQL PostgreSQL 15 (ekklesia-db)
-- Date: 2025-10-23
-- Depends on: migration 007_add_answers_column.sql
-- Issue: https://github.com/sosialistaflokkurinn/ekklesia/issues/96

BEGIN;

-- =============================================================================
-- MAKE question_text NULLABLE
-- =============================================================================
-- Background:
-- The elections.elections table has TWO question-related columns:
-- 1. question_text (from earlier migration) - NOT NULL required
-- 2. question (from migration 006) - used by admin.js code
--
-- Epic #24 admin API code (admin.js:406) inserts into 'question' but NOT 'question_text'.
-- This caused: "null value in column 'question_text' violates not-null constraint"
--
-- Options considered:
-- A) Make question_text nullable (this migration)
-- B) Modify admin.js to insert into both columns (code change)
-- C) Remove question_text entirely (risky if other code uses it)
--
-- Chose option A for minimal impact. Future cleanup can consolidate to one column.

-- Remove NOT NULL constraint from question_text
ALTER TABLE elections.elections
  ALTER COLUMN question_text DROP NOT NULL;

-- Add default empty string for consistency
ALTER TABLE elections.elections
  ALTER COLUMN question_text SET DEFAULT '';

-- Update comment to clarify relationship with 'question' column
COMMENT ON COLUMN elections.elections.question_text IS
  'DEPRECATED: Legacy question text column from earlier schema. New code uses the ''question'' column instead. This column is kept for backward compatibility but may be NULL for elections created via Epic #24 admin API.';

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES (Run manually after migration)
-- =============================================================================

-- Verify question_text is now nullable
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'elections' AND table_name = 'elections'
--   AND column_name IN ('question', 'question_text')
-- ORDER BY column_name;

-- Test insert without question_text (should now work)
-- INSERT INTO elections.elections (title, description, question, answers, status)
-- VALUES ('Test Election', 'Testing nullable question_text', 'Should this work?', '["yes", "no"]'::jsonb, 'draft')
-- RETURNING id, title, question, question_text;

-- Cleanup test
-- DELETE FROM elections.elections WHERE title = 'Test Election';
