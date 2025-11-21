-- Add Multi-Election Support to Ballots Table
-- Database: ekklesia-db (PostgreSQL 15)
-- Schema: elections
-- Created: 2025-11-10
-- Purpose: Enable member voting across multiple elections with Firebase UID deduplication

-- Set search path
SET search_path TO elections, public;

-- =====================================================
-- Migration Strategy
-- =====================================================
-- This migration adds support for:
-- 1. Multiple elections (election_id foreign key)
-- 2. Firebase UID deduplication (member_uid instead of token_hash)
-- 3. Dynamic answer selection (answer_id references elections.answers JSONB)
--
-- Note: The old voting_tokens system (anonymous tokens) will remain for
-- legacy support but new votes will use Firebase authentication.

-- =====================================================
-- Step 1: Add New Columns to Ballots Table
-- =====================================================

-- Add election_id (foreign key to elections table)
ALTER TABLE ballots
ADD COLUMN IF NOT EXISTS election_id UUID;

-- Add member_uid (Firebase UID for deduplication)
ALTER TABLE ballots
ADD COLUMN IF NOT EXISTS member_uid VARCHAR(128);

-- Add answer_id (references answer ID in elections.answers JSONB)
-- For backwards compatibility, we'll keep the old 'answer' column
ALTER TABLE ballots
ADD COLUMN IF NOT EXISTS answer_id VARCHAR(128);

COMMENT ON COLUMN ballots.election_id IS 'References elections.id - which election this ballot is for';
COMMENT ON COLUMN ballots.member_uid IS 'Firebase UID - used for deduplication only (one vote per member per election)';
COMMENT ON COLUMN ballots.answer_id IS 'Answer ID from elections.answers JSONB array';

-- =====================================================
-- Step 2: Add Foreign Key Constraint
-- =====================================================

-- Add foreign key to elections table (with CASCADE delete)
ALTER TABLE ballots
ADD CONSTRAINT fk_election
FOREIGN KEY (election_id)
REFERENCES elections(id)
ON DELETE CASCADE;

-- =====================================================
-- Step 3: Update Unique Constraint
-- =====================================================

-- Drop old unique constraint (token_hash only)
-- This prevents the same member from voting twice in the same election
ALTER TABLE ballots
DROP CONSTRAINT IF EXISTS unique_token_ballot;

-- Add new composite unique constraint for multi-election voting
-- Allows same member to vote in different elections
-- Prevents same member from voting twice in the same election
CREATE UNIQUE INDEX IF NOT EXISTS idx_ballots_election_member_dedup
ON ballots(election_id, member_uid)
WHERE election_id IS NOT NULL AND member_uid IS NOT NULL;

COMMENT ON INDEX idx_ballots_election_member_dedup IS 'Prevents duplicate votes: one vote per member per election';

-- =====================================================
-- Step 4: Add Performance Indexes
-- =====================================================

-- Index for listing ballots by election (for results counting)
CREATE INDEX IF NOT EXISTS idx_ballots_election_id
ON ballots(election_id)
WHERE election_id IS NOT NULL;

-- Index for checking if member has voted (has_voted queries)
CREATE INDEX IF NOT EXISTS idx_ballots_member_election
ON ballots(member_uid, election_id)
WHERE member_uid IS NOT NULL AND election_id IS NOT NULL;

-- Index for answer aggregation (results counting)
CREATE INDEX IF NOT EXISTS idx_ballots_election_answer
ON ballots(election_id, answer_id)
WHERE election_id IS NOT NULL AND answer_id IS NOT NULL;

-- =====================================================
-- Step 5: Update Answer Constraint
-- =====================================================

-- Drop old answer constraint (hardcoded yes/no/abstain)
ALTER TABLE ballots
DROP CONSTRAINT IF EXISTS valid_answer;

-- Add new constraint: answer_id OR old answer must be present
-- (backwards compatibility with old token-based system)
ALTER TABLE ballots
ADD CONSTRAINT valid_answer_data CHECK (
    (answer_id IS NOT NULL) OR (answer IN ('yes', 'no', 'abstain'))
);

-- =====================================================
-- Step 6: Migration of Existing Data (if any)
-- =====================================================

-- If there are existing ballots from the old single-election system,
-- we'll leave them as-is (they have token_hash and answer='yes/no/abstain')
-- New ballots will use election_id + member_uid + answer_id

-- Count old ballots (for verification)
-- SELECT COUNT(*) as old_ballots FROM ballots WHERE election_id IS NULL;

-- Count new ballots (for verification)
-- SELECT COUNT(*) as new_ballots FROM ballots WHERE election_id IS NOT NULL;

-- =====================================================
-- Step 7: Add Helper Function for Vote Deduplication
-- =====================================================

CREATE OR REPLACE FUNCTION check_member_voted(
    p_election_id UUID,
    p_member_uid VARCHAR(128)
)
RETURNS BOOLEAN AS $$
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

COMMENT ON FUNCTION check_member_voted IS 'Check if member has already voted in election (returns true if voted)';

-- =====================================================
-- Step 8: Add Helper Function for Results Counting
-- =====================================================

CREATE OR REPLACE FUNCTION get_election_results(p_election_id UUID)
RETURNS TABLE (
    answer_id VARCHAR(128),
    votes BIGINT,
    percentage NUMERIC(5,2)
) AS $$
DECLARE
    total_votes BIGINT;
BEGIN
    -- Count total votes for this election
    SELECT COUNT(*)
    INTO total_votes
    FROM ballots
    WHERE election_id = p_election_id;

    -- If no votes, return empty
    IF total_votes = 0 THEN
        RETURN;
    END IF;

    -- Return results grouped by answer_id
    RETURN QUERY
    SELECT
        b.answer_id,
        COUNT(*)::BIGINT as votes,
        ROUND((COUNT(*)::NUMERIC / total_votes::NUMERIC) * 100, 2) as percentage
    FROM ballots b
    WHERE b.election_id = p_election_id
      AND b.answer_id IS NOT NULL
    GROUP BY b.answer_id
    ORDER BY votes DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_election_results IS 'Get vote counts and percentages for an election';

-- =====================================================
-- Example Queries for Multi-Election Voting
-- =====================================================

-- Check if member has voted in election
-- SELECT check_member_voted('election-uuid', 'firebase-uid');

-- Get results for election
-- SELECT * FROM get_election_results('election-uuid');

-- Count votes by election
-- SELECT election_id, COUNT(*) as total_votes
-- FROM ballots
-- WHERE election_id IS NOT NULL
-- GROUP BY election_id
-- ORDER BY total_votes DESC;

-- List all members who voted in a specific election (admin only)
-- SELECT DISTINCT member_uid, submitted_at
-- FROM ballots
-- WHERE election_id = 'election-uuid'
-- ORDER BY submitted_at DESC;

-- =====================================================
-- Verification Queries
-- =====================================================

-- Check new columns exist
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'elections' AND table_name = 'ballots'
-- ORDER BY ordinal_position;

-- Check indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'elections' AND tablename = 'ballots';

-- Check constraints
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'elections.ballots'::regclass;

-- Test vote deduplication function
-- SELECT check_member_voted('00000000-0000-0000-0000-000000000000', 'test-uid');

-- Test results function (will return empty if no votes)
-- SELECT * FROM get_election_results('00000000-0000-0000-0000-000000000000');

-- =====================================================
-- Sample Data for Testing (Optional)
-- =====================================================

-- Uncomment to insert test data:

-- -- Get a test election ID (or create one)
-- -- Assumes elections table has at least one published election
-- DO $$
-- DECLARE
--     test_election_id UUID;
--     test_answer_id VARCHAR(128);
-- BEGIN
--     -- Get first published election
--     SELECT id INTO test_election_id
--     FROM elections
--     WHERE status = 'published'
--     LIMIT 1;

--     -- If no published election found, skip test data
--     IF test_election_id IS NULL THEN
--         RAISE NOTICE 'No published elections found - skipping test data insertion';
--         RETURN;
--     END IF;

--     -- Get first answer ID from the election
--     SELECT jsonb_array_elements(answers)->>'id' INTO test_answer_id
--     FROM elections
--     WHERE id = test_election_id
--     LIMIT 1;

--     -- Insert test ballots
--     INSERT INTO ballots (election_id, member_uid, answer_id, submitted_at)
--     VALUES
--         (test_election_id, 'test-member-1', test_answer_id, NOW()),
--         (test_election_id, 'test-member-2', test_answer_id, NOW()),
--         (test_election_id, 'test-member-3', test_answer_id, NOW())
--     ON CONFLICT DO NOTHING;

--     RAISE NOTICE 'Inserted test ballots for election %', test_election_id;
-- END $$;

-- =====================================================
-- End of Migration
-- =====================================================

-- Reset search path
SET search_path TO public;
