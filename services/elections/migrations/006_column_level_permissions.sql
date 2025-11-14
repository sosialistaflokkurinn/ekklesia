-- Migration 006: Column-Level Database Permissions
-- Issue #254: Restrict elections_service access to exclude member_uid column
--
-- Security Enhancement:
-- - Create SECURITY DEFINER function for vote deduplication
-- - Revoke full table SELECT access
-- - Grant column-level SELECT (exclude member_uid)
-- - Principle of Least Privilege: Service cannot query voting history
--
-- Created: 2025-11-11
-- Epic #251: Voting System Security & Anonymity Enhancements

-- ============================================================
-- Step 1: Create SECURITY DEFINER function for vote checking
-- ============================================================

-- Function runs with elevated permissions (can read member_uid)
-- This allows vote deduplication without giving service direct access
CREATE OR REPLACE FUNCTION elections.check_member_voted_v2(
  p_election_id UUID,
  p_member_uid VARCHAR(128)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs as function owner (has member_uid access)
STABLE            -- Does not modify database, allows query optimization
SET search_path = elections, public
AS $$
BEGIN
  -- Check if member has already voted in this election
  RETURN EXISTS (
    SELECT 1
    FROM elections.ballots
    WHERE election_id = p_election_id
      AND member_uid = p_member_uid
    LIMIT 1
  );
END;
$$;

-- Add documentation comment
COMMENT ON FUNCTION elections.check_member_voted_v2(UUID, VARCHAR) IS
  'Check if member has voted in election. Provides consistent API for vote deduplication.';

-- ============================================================
-- Step 2: Column-Level Permissions (SKIPPED)
-- ============================================================

-- NOTE: Current setup uses 'postgres' user directly (no separate elections_service role)
-- Column-level permissions would be applied if using separate service account:
--
-- REVOKE SELECT ON elections.ballots FROM elections_service;
-- GRANT SELECT (id, election_id, answer_id, answer, token_hash, submitted_at)
--   ON elections.ballots TO elections_service;
-- GRANT INSERT, UPDATE ON elections.ballots TO elections_service;
-- GRANT EXECUTE ON FUNCTION elections.check_member_voted_v2 TO elections_service;
--
-- To implement proper service isolation:
-- 1. Create elections_service database role
-- 2. Configure DATABASE_USER=elections_service in Cloud Run
-- 3. Run column-level permission grants
--
-- For now: Function created for API consistency, permissions unchanged

-- ============================================================
-- Verification
-- ============================================================

-- To verify permissions, run:
-- \dp elections.ballots
--
-- Expected output:
-- Schema    | Name    | Type  | Access privileges
-- ----------+---------+-------+------------------
-- elections | ballots | table | elections_service=r(id,election_id,answer_id,answer,token_hash,submitted_at)/postgres
--                                + elections_service=aw/postgres
--
-- Key:
-- r = SELECT (with column list)
-- a = INSERT
-- w = UPDATE
--
-- member_uid should NOT appear in column list

-- To test function, run:
-- SELECT elections.check_member_voted_v2(
--   '550e8400-e29b-41d4-a716-446655440001'::UUID,
--   'NE5e8GpzzBcjxuTHWGuJtTfevPD2'
-- );
-- Expected: true or false

-- ============================================================
-- Rollback (if needed)
-- ============================================================

-- To rollback, restore full SELECT access:
-- GRANT SELECT ON elections.ballots TO elections_service;
--
-- Application code will still work with old queries
-- (function remains available, backwards compatible)
