-- Events Service - Fix correlation_id Type in Admin Audit Log
-- Purpose: Change correlation_id from UUID to TEXT to match middleware output
-- Database: Cloud SQL PostgreSQL 15 (ekklesia-db)
-- Date: 2025-10-23
-- Depends on: migration 009_fix_voting_times_constraint.sql
-- Issue: Epic #24 admin API silently failing due to correlation_id type mismatch

BEGIN;

-- =============================================================================
-- FIX CORRELATION_ID TYPE MISMATCH
-- =============================================================================
-- Background:
-- Epic #24 admin API was returning 201 success but NOT persisting elections.
-- Root cause: writeAuditLog() was failing due to correlation_id type mismatch:
-- - Column type: UUID
-- - Actual value: VARCHAR/TEXT (from correlation middleware)
-- - PostgreSQL aborts transaction on type error
-- - writeAuditLog catches error but doesn't throw (line 76)
-- - COMMIT becomes implicit ROLLBACK
-- - API returns success with data from INSERT, but transaction was rolled back!
--
-- Impact: admin_audit_log table was completely empty (0 rows)
-- Impact: No elections were ever successfully created via Epic #24 API

-- Change correlation_id from UUID to TEXT
ALTER TABLE elections.admin_audit_log
  ALTER COLUMN correlation_id TYPE TEXT;

-- Update comment
COMMENT ON COLUMN elections.admin_audit_log.correlation_id IS
  'Request correlation ID from middleware (string format, not UUID). Used for tracing requests across services.';

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES (Run manually after migration)
-- =============================================================================

-- Verify column type changed
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'elections'
--   AND table_name = 'admin_audit_log'
--   AND column_name = 'correlation_id';

-- Test insert with string correlation_id
-- INSERT INTO elections.admin_audit_log
--   (action_type, performed_by, election_id, election_title, details, ip_address, correlation_id)
-- VALUES
--   ('test_action', 'test_user', gen_random_uuid(), 'Test Election', '{"test": true}'::jsonb, '127.0.0.1'::inet, 'abc123def456')
-- RETURNING id, correlation_id;

-- Cleanup test
-- DELETE FROM elections.admin_audit_log WHERE action_type = 'test_action';
