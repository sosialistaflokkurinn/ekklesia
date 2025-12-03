-- Fix Multi-Choice Ballot Unique Constraint
-- Database: ekklesia-db (PostgreSQL 15)
-- Schema: elections
-- Created: 2025-11-25
-- Purpose: Allow multiple ballot rows per member per election for multi-choice voting
--
-- Problem: Migration 004 created a unique index on (election_id, member_uid) which
-- prevents members from inserting multiple ballots for multi-choice elections.
-- When selecting 2 candidates in a multi-choice election, the second INSERT fails.
--
-- Solution: Change unique constraint to (election_id, member_uid, answer_id)
-- This allows one ballot per answer per member per election.

SET search_path TO elections, public;

-- =====================================================
-- Step 1: Drop the problematic unique index
-- =====================================================

DROP INDEX IF EXISTS idx_ballots_election_member_dedup;

-- =====================================================
-- Step 2: Create new unique index that allows multi-choice
-- =====================================================

-- New constraint: One ballot per answer per member per election
-- This allows a member to select multiple answers in multi-choice elections
CREATE UNIQUE INDEX IF NOT EXISTS idx_ballots_election_member_answer_dedup
ON ballots(election_id, member_uid, answer_id)
WHERE election_id IS NOT NULL AND member_uid IS NOT NULL AND answer_id IS NOT NULL;

COMMENT ON INDEX idx_ballots_election_member_answer_dedup IS 'Prevents duplicate votes: one ballot per answer per member per election (allows multi-choice)';

-- =====================================================
-- Step 3: Update check_member_voted function (optional improvement)
-- =====================================================

-- The existing check_member_voted function still works correctly
-- It just counts ballots for the (election_id, member_uid) combination
-- For multi-choice, it will return TRUE if any ballot exists

-- =====================================================
-- Step 4: Add helper function to check_member_voted_v2 with SECURITY DEFINER
-- =====================================================

-- This version uses SECURITY DEFINER for secure member-only access
-- It's already defined in 006_column_level_permissions.sql if that migration exists
-- But we'll create/replace it here if needed

CREATE OR REPLACE FUNCTION check_member_voted_v2(
    p_election_id UUID,
    p_member_uid VARCHAR(128)
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = elections, public
AS $$
DECLARE
    vote_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO vote_count
    FROM ballots
    WHERE election_id = p_election_id
      AND member_uid = p_member_uid;

    RETURN vote_count > 0;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_member_voted_v2 IS 'Check if member has voted in election (SECURITY DEFINER version)';

-- Grant execute to elections_member_role
GRANT EXECUTE ON FUNCTION check_member_voted_v2 TO elections_member_role;

-- =====================================================
-- Verification Queries
-- =====================================================

-- Check the new index exists
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'elections' AND tablename = 'ballots' AND indexname LIKE '%dedup%';

-- Test multi-choice voting (should work after this migration):
-- INSERT INTO ballots (election_id, member_uid, answer_id, answer, token_hash, submitted_at)
-- VALUES
--   ('test-uuid', 'test-member', 'answer-1', 'Answer 1', '0000...', NOW()),
--   ('test-uuid', 'test-member', 'answer-2', 'Answer 2', '0000...', NOW());
-- Both inserts should succeed now

-- =====================================================
-- End of Migration
-- =====================================================

SET search_path TO public;
