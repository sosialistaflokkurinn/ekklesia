-- Add Nomination Committee Voting Support
-- Database: ekklesia-db (PostgreSQL 15)
-- Schema: elections
-- Created: 2025-12-10
-- Purpose: Enable non-anonymous voting for nomination committees with justifications
--
-- Background: This implements a specialized voting system for the Socialist Party's
-- nomination committee (uppstillingarnefnd) to rank candidates for municipal elections.
-- Unlike regular elections, these votes are NOT anonymous - voter identity is preserved
-- permanently for transparency within the committee.
--
-- Key Features:
-- - Non-anonymous voting (preserve_voter_identity = true)
-- - Justification text for top N candidates
-- - Multiple formal voting rounds
-- - Committee member access control via UID list

SET search_path TO elections, public;

-- =====================================================
-- Step 1: Add 'nomination-committee' to voting_type
-- =====================================================

-- Drop existing constraint
ALTER TABLE elections DROP CONSTRAINT IF EXISTS valid_voting_type;

-- Add new constraint with 'nomination-committee' option
ALTER TABLE elections
ADD CONSTRAINT valid_voting_type CHECK (
    voting_type IN ('single-choice', 'multi-choice', 'ranked-choice', 'nomination-committee')
);

COMMENT ON COLUMN elections.voting_type IS 'Voting type: single-choice (radio), multi-choice (checkboxes), ranked-choice (STV/forgangsröðun), nomination-committee (named voting with justifications)';

-- =====================================================
-- Step 2: Add 'committee' to eligibility
-- =====================================================

-- Drop existing constraint if any
ALTER TABLE elections DROP CONSTRAINT IF EXISTS valid_eligibility;

-- Add constraint with 'committee' option
ALTER TABLE elections
ADD CONSTRAINT valid_eligibility CHECK (
    eligibility IS NULL OR eligibility IN ('all', 'members', 'admins', 'committee')
);

COMMENT ON COLUMN elections.eligibility IS 'Who can vote: all (anyone), members (authenticated), admins (admin role), committee (specific UIDs)';

-- =====================================================
-- Step 3: Add committee_member_uids column
-- =====================================================

-- JSONB array of Firebase UIDs who are committee members
ALTER TABLE elections
ADD COLUMN IF NOT EXISTS committee_member_uids JSONB;

COMMENT ON COLUMN elections.committee_member_uids IS 'Array of Firebase UIDs allowed to vote when eligibility="committee"';

-- =====================================================
-- Step 4: Add preserve_voter_identity column
-- =====================================================

-- When true, member_uid is NEVER anonymized after election closes
ALTER TABLE elections
ADD COLUMN IF NOT EXISTS preserve_voter_identity BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN elections.preserve_voter_identity IS 'When true, voter identity is preserved permanently (not anonymized after close)';

-- =====================================================
-- Step 5: Add justification settings
-- =====================================================

-- Whether justifications are required for this election
ALTER TABLE elections
ADD COLUMN IF NOT EXISTS requires_justification BOOLEAN DEFAULT FALSE;

-- How many top candidates require justification (default 3)
ALTER TABLE elections
ADD COLUMN IF NOT EXISTS justification_required_for_top_n INTEGER DEFAULT 3;

COMMENT ON COLUMN elections.requires_justification IS 'Whether voters must provide justification text for their top choices';
COMMENT ON COLUMN elections.justification_required_for_top_n IS 'Number of top-ranked candidates requiring justification (default 3)';

-- =====================================================
-- Step 6: Add round tracking
-- =====================================================

-- Current round number (starts at 1)
ALTER TABLE elections
ADD COLUMN IF NOT EXISTS round_number INTEGER DEFAULT 1;

-- Link to parent election (for subsequent rounds)
ALTER TABLE elections
ADD COLUMN IF NOT EXISTS parent_election_id UUID REFERENCES elections(id) ON DELETE SET NULL;

COMMENT ON COLUMN elections.round_number IS 'Current voting round number (starts at 1)';
COMMENT ON COLUMN elections.parent_election_id IS 'Links subsequent rounds to the original election';

-- Index for finding related rounds
CREATE INDEX IF NOT EXISTS idx_elections_parent
ON elections(parent_election_id)
WHERE parent_election_id IS NOT NULL;

-- =====================================================
-- Step 7: Create ballot_justifications table
-- =====================================================

CREATE TABLE IF NOT EXISTS elections.ballot_justifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ballot_id UUID NOT NULL REFERENCES elections.ballots(id) ON DELETE CASCADE,
    election_id UUID NOT NULL REFERENCES elections.elections(id) ON DELETE CASCADE,
    candidate_id VARCHAR(100) NOT NULL,  -- Links to answer.id from election
    rank_position INTEGER NOT NULL,       -- 1 = first choice, 2 = second, etc.
    justification_text TEXT NOT NULL,     -- The actual justification
    member_uid VARCHAR(128) NOT NULL,     -- Firebase UID (stored PERMANENTLY)
    member_name VARCHAR(255) NOT NULL,    -- Display name for results
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Each member can only have one justification per candidate per election
    CONSTRAINT unique_justification_per_candidate
        UNIQUE (election_id, member_uid, candidate_id)
);

-- Comments
COMMENT ON TABLE elections.ballot_justifications IS 'Stores justification text for nomination committee votes (non-anonymous)';
COMMENT ON COLUMN elections.ballot_justifications.candidate_id IS 'Links to answer.id in the election answers array';
COMMENT ON COLUMN elections.ballot_justifications.rank_position IS 'Position in voter ranking: 1=first, 2=second, etc.';
COMMENT ON COLUMN elections.ballot_justifications.member_uid IS 'Firebase UID - stored permanently (no anonymization)';
COMMENT ON COLUMN elections.ballot_justifications.member_name IS 'Display name of voter for results display';

-- =====================================================
-- Step 8: Create indexes for efficient queries
-- =====================================================

-- For fetching all justifications per election
CREATE INDEX IF NOT EXISTS idx_justifications_election
ON elections.ballot_justifications(election_id);

-- For "who voted?" queries
CREATE INDEX IF NOT EXISTS idx_justifications_member
ON elections.ballot_justifications(member_uid);

-- For "who voted for this candidate?" queries
CREATE INDEX IF NOT EXISTS idx_justifications_candidate
ON elections.ballot_justifications(election_id, candidate_id);

-- For fetching by ballot
CREATE INDEX IF NOT EXISTS idx_justifications_ballot
ON elections.ballot_justifications(ballot_id);

-- =====================================================
-- Step 9: Update validation trigger
-- =====================================================

-- Update the validation function to handle nomination-committee
CREATE OR REPLACE FUNCTION validate_multichoice_settings()
RETURNS TRIGGER AS $$
BEGIN
    -- Single-choice: max_selections must be 1
    IF NEW.voting_type = 'single-choice' THEN
        IF NEW.max_selections != 1 THEN
            RAISE EXCEPTION 'Single-choice elections must have max_selections = 1';
        END IF;
        NEW.seats_to_fill := 1;
    END IF;

    -- Multi-choice: max_selections must be <= number of answers
    IF NEW.voting_type = 'multi-choice' THEN
        IF NEW.max_selections > jsonb_array_length(NEW.answers) THEN
            RAISE EXCEPTION 'max_selections cannot exceed number of answers';
        END IF;
        NEW.seats_to_fill := NEW.max_selections;
    END IF;

    -- Ranked-choice (STV): seats_to_fill must be less than candidates
    IF NEW.voting_type = 'ranked-choice' THEN
        IF NEW.seats_to_fill >= jsonb_array_length(NEW.answers) THEN
            RAISE EXCEPTION 'seats_to_fill must be less than number of candidates for ranked-choice';
        END IF;
        NEW.max_selections := jsonb_array_length(NEW.answers);
    END IF;

    -- Nomination-committee: similar to ranked-choice
    IF NEW.voting_type = 'nomination-committee' THEN
        -- Must use committee eligibility
        IF NEW.eligibility IS NULL OR NEW.eligibility != 'committee' THEN
            NEW.eligibility := 'committee';
        END IF;

        -- Must preserve voter identity
        NEW.preserve_voter_identity := TRUE;

        -- Max selections = all candidates (can rank all)
        NEW.max_selections := jsonb_array_length(NEW.answers);

        -- Validate committee_member_uids is set
        IF NEW.committee_member_uids IS NULL OR jsonb_array_length(NEW.committee_member_uids) = 0 THEN
            RAISE EXCEPTION 'nomination-committee elections must have committee_member_uids set';
        END IF;

        -- Validate justification settings
        IF NEW.requires_justification = TRUE THEN
            IF NEW.justification_required_for_top_n < 1 THEN
                NEW.justification_required_for_top_n := 3;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Step 10: Create view for nomination committee results
-- =====================================================

CREATE OR REPLACE VIEW elections.nomination_committee_results AS
SELECT
    e.id as election_id,
    e.title,
    e.round_number,
    e.parent_election_id,
    e.status,
    e.seats_to_fill,
    e.created_at,
    e.closed_at,
    (
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', ans->>'id',
                'text', ans->>'text'
            )
        )
        FROM jsonb_array_elements(e.answers) as ans
    ) as candidates,
    (
        SELECT COUNT(DISTINCT b.member_uid)
        FROM elections.ballots b
        WHERE b.election_id = e.id AND b.ranked_answers IS NOT NULL
    ) as votes_cast,
    (
        SELECT jsonb_array_length(e.committee_member_uids)
    ) as committee_size
FROM elections.elections e
WHERE e.voting_type = 'nomination-committee';

COMMENT ON VIEW elections.nomination_committee_results IS 'Summary view for nomination committee elections';

-- =====================================================
-- Step 11: Helper function to get named ballots
-- =====================================================

CREATE OR REPLACE FUNCTION elections.get_named_ballots(p_election_id UUID)
RETURNS TABLE (
    ballot_id UUID,
    member_uid VARCHAR(128),
    member_name VARCHAR(255),
    preferences TEXT[],
    justifications JSONB,
    submitted_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.id as ballot_id,
        b.member_uid,
        COALESCE(
            (SELECT j.member_name FROM elections.ballot_justifications j
             WHERE j.ballot_id = b.id LIMIT 1),
            'Unknown'
        ) as member_name,
        ARRAY(
            SELECT jsonb_array_elements_text(b.ranked_answers)
        ) as preferences,
        COALESCE(
            (SELECT jsonb_agg(
                jsonb_build_object(
                    'candidate_id', j.candidate_id,
                    'rank', j.rank_position,
                    'text', j.justification_text
                ) ORDER BY j.rank_position
            )
            FROM elections.ballot_justifications j
            WHERE j.ballot_id = b.id),
            '[]'::jsonb
        ) as justifications,
        b.submitted_at
    FROM elections.ballots b
    JOIN elections.elections e ON b.election_id = e.id
    WHERE b.election_id = p_election_id
      AND e.voting_type = 'nomination-committee'
      AND b.ranked_answers IS NOT NULL
    ORDER BY b.submitted_at;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION elections.get_named_ballots IS 'Get all named ballots with justifications for a nomination committee election';

-- =====================================================
-- Step 12: Function to calculate average rankings
-- =====================================================

CREATE OR REPLACE FUNCTION elections.calculate_average_rankings(p_election_id UUID)
RETURNS TABLE (
    candidate_id TEXT,
    candidate_name TEXT,
    average_rank NUMERIC(5,2),
    first_place_votes INTEGER,
    total_votes INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH ranked_votes AS (
        SELECT
            b.id as ballot_id,
            ordinality as rank_position,
            candidate::text as candidate_id
        FROM elections.ballots b
        CROSS JOIN LATERAL jsonb_array_elements_text(b.ranked_answers) WITH ORDINALITY as candidate
        WHERE b.election_id = p_election_id
          AND b.ranked_answers IS NOT NULL
    ),
    candidate_stats AS (
        SELECT
            rv.candidate_id,
            AVG(rv.rank_position) as avg_rank,
            COUNT(*) FILTER (WHERE rv.rank_position = 1) as first_votes,
            COUNT(*) as vote_count
        FROM ranked_votes rv
        GROUP BY rv.candidate_id
    )
    SELECT
        cs.candidate_id,
        COALESCE(ans->>'text', cs.candidate_id) as candidate_name,
        ROUND(cs.avg_rank, 2) as average_rank,
        cs.first_votes::integer as first_place_votes,
        cs.vote_count::integer as total_votes
    FROM candidate_stats cs
    LEFT JOIN elections.elections e ON e.id = p_election_id
    LEFT JOIN LATERAL (
        SELECT a FROM jsonb_array_elements(e.answers) a
        WHERE a->>'id' = cs.candidate_id
    ) ans ON true
    ORDER BY cs.avg_rank ASC, cs.first_votes DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION elections.calculate_average_rankings IS 'Calculate average ranking and first-place votes for each candidate';

-- =====================================================
-- Icelandic Terminology Reference (for i18n)
-- =====================================================
--
-- English                    | Icelandic
-- --------------------------|-------------------------
-- Nomination Committee       | Uppstillingarnefnd
-- Candidate                  | Frambjóðandi
-- Ranking                    | Röðun / Forgangsröðun
-- Justification              | Rökstuðningur
-- Round                      | Umferð
-- Open round                 | Opna umferð
-- Close round                | Loka umferð
-- Average rank               | Meðalröðun
-- First choice               | 1. val
-- Committee member           | Nefndarmaður
-- Submit vote                | Skrá atkvæði
-- Previous rounds            | Fyrri umferðir
-- Results                    | Niðurstöður

-- =====================================================
-- End of Migration
-- =====================================================

SET search_path TO public;
