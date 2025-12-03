-- Events Service - Drop Old Status Constraint
-- Purpose: Remove obsolete valid_status constraint that blocks 'open' status
-- Database: Cloud SQL PostgreSQL 15 (ekklesia-db)
-- Date: 2025-10-23
-- Depends on: migration 010_fix_correlation_id_type.sql
-- Issue: Epic #24 open voting endpoint failing due to conflicting status constraints

BEGIN;

-- =============================================================================
-- DROP OBSOLETE STATUS CONSTRAINT
-- =============================================================================
-- Background:
-- POST /elections/:id/open was failing with:
-- "new row for relation elections violates check constraint valid_status"
--
-- Root cause:
-- - Old constraint 'valid_status' allows only: ['draft', 'published', 'closed']
-- - New constraint 'valid_admin_status' allows: ['draft', 'published', 'open', 'closed', 'paused', 'archived', 'deleted']
-- - PostgreSQL checks BOTH constraints
-- - 'open' status fails the old constraint
--
-- Solution: Drop old constraint, keep new comprehensive one

-- Drop the old constraint
ALTER TABLE elections.elections
  DROP CONSTRAINT IF EXISTS valid_status;

-- Verify only valid_admin_status remains
COMMENT ON CONSTRAINT valid_admin_status ON elections.elections IS
  'Valid status values for elections. Replaces old valid_status constraint.';

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES (Run manually after migration)
-- =============================================================================

-- Verify old constraint is gone
-- SELECT con.conname
-- FROM pg_constraint con
-- INNER JOIN pg_class rel ON rel.oid = con.conrelid
-- INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
-- WHERE nsp.nspname = 'elections'
--   AND rel.relname = 'elections'
--   AND con.contype = 'c';
-- Expected: valid_timeline, valid_admin_status (NO valid_status)

-- Test that 'open' status now works
-- INSERT INTO elections.elections (title, description, question, answers, status, created_by)
-- VALUES ('Test Open Status', 'Testing', 'Test?', '["yes", "no"]'::jsonb, 'open', 'test_uid')
-- RETURNING id, status;

-- Cleanup test
-- DELETE FROM elections.elections WHERE title = 'Test Open Status';
