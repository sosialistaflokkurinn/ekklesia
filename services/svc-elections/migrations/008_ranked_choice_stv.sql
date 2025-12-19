-- Add Ranked-Choice Voting (STV/Forgangsröðun) Support
-- Database: ekklesia-db (PostgreSQL 15)
-- Schema: elections
-- Created: 2025-12-10
-- Purpose: Enable Single Transferable Vote (STV) elections with preference ranking
--
-- Background: This implements the voting system used in Iceland's 2010 Constitutional
-- Assembly elections (Stjórnlagaþing), known as "forgangsröðun" or "persónukjör með valkostum"
-- in Icelandic. Voters rank candidates in order of preference (1st, 2nd, 3rd, etc.)
--
-- References:
-- - Lög um stjórnlagaþing (90/2010): https://www.althingi.is/lagas/landskjorstjorn/2010090.html
-- - STV npm library: https://github.com/Applifting/stv

SET search_path TO elections, public;

-- =====================================================
-- Step 1: Add 'ranked-choice' to voting_type
-- =====================================================

-- Drop existing constraint
ALTER TABLE elections DROP CONSTRAINT IF EXISTS valid_voting_type;

-- Add new constraint with 'ranked-choice' option
ALTER TABLE elections
ADD CONSTRAINT valid_voting_type CHECK (
    voting_type IN ('single-choice', 'multi-choice', 'ranked-choice')
);

COMMENT ON COLUMN elections.voting_type IS 'Voting type: single-choice (radio), multi-choice (checkboxes), ranked-choice (STV/forgangsröðun)';

-- =====================================================
-- Step 2: Add seats_to_fill column (for STV elections)
-- =====================================================

-- Number of winners/seats to elect (required for STV quota calculation)
-- Formula: Droop quota = floor(total_votes / (seats + 1)) + 1
ALTER TABLE elections
ADD COLUMN IF NOT EXISTS seats_to_fill INTEGER DEFAULT 1;

-- Constraint: seats_to_fill must be at least 1 and less than number of candidates
ALTER TABLE elections
ADD CONSTRAINT valid_seats_to_fill CHECK (
    seats_to_fill >= 1 AND seats_to_fill < jsonb_array_length(answers)
);

COMMENT ON COLUMN elections.seats_to_fill IS 'Number of seats/winners to elect (used for STV quota: Droop = votes/(seats+1)+1)';

-- =====================================================
-- Step 3: Add ranked_answers column to ballots
-- =====================================================

-- For ranked-choice voting, we store the complete ranking as a JSONB array
-- Example: ["candidate-a", "candidate-c", "candidate-b"] = A is 1st, C is 2nd, B is 3rd
-- The voter doesn't need to rank all candidates - partial rankings are allowed
ALTER TABLE ballots
ADD COLUMN IF NOT EXISTS ranked_answers JSONB;

COMMENT ON COLUMN ballots.ranked_answers IS 'Ordered array of answer IDs for ranked-choice voting (1st preference first)';

-- Index for efficient querying of ranked ballots
CREATE INDEX IF NOT EXISTS idx_ballots_ranked_answers
ON ballots USING GIN (ranked_answers)
WHERE ranked_answers IS NOT NULL;

-- =====================================================
-- Step 4: Update constraint to allow ranked_answers
-- =====================================================

-- Make answer column nullable (ranked-choice ballots don't use it)
ALTER TABLE ballots ALTER COLUMN answer DROP NOT NULL;

-- Drop old answer constraint
ALTER TABLE ballots DROP CONSTRAINT IF EXISTS valid_answer_data;

-- New constraint: must have answer_id, old answer, OR ranked_answers
ALTER TABLE ballots
ADD CONSTRAINT valid_answer_data CHECK (
    (answer_id IS NOT NULL) OR
    (answer IN ('yes', 'no', 'abstain')) OR
    (ranked_answers IS NOT NULL AND jsonb_typeof(ranked_answers) = 'array')
);

-- =====================================================
-- Step 5: Create unique index for ranked-choice ballots
-- =====================================================

-- For ranked-choice, we only allow ONE ballot per member per election
-- (unlike multi-choice which has multiple rows per selection)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ballots_ranked_election_member
ON ballots(election_id, member_uid)
WHERE election_id IS NOT NULL
  AND member_uid IS NOT NULL
  AND ranked_answers IS NOT NULL;

COMMENT ON INDEX idx_ballots_ranked_election_member IS 'Prevents duplicate ranked-choice ballots: one ranking per member per election';

-- =====================================================
-- Step 6: Validation trigger for ranked-choice settings
-- =====================================================

-- Update the validation function to handle ranked-choice
CREATE OR REPLACE FUNCTION validate_multichoice_settings()
RETURNS TRIGGER AS $$
BEGIN
    -- Single-choice: max_selections must be 1
    IF NEW.voting_type = 'single-choice' THEN
        IF NEW.max_selections != 1 THEN
            RAISE EXCEPTION 'Single-choice elections must have max_selections = 1';
        END IF;
        -- seats_to_fill should be 1 for single-choice
        NEW.seats_to_fill := 1;
    END IF;

    -- Multi-choice: max_selections must be <= number of answers
    IF NEW.voting_type = 'multi-choice' THEN
        IF NEW.max_selections > jsonb_array_length(NEW.answers) THEN
            RAISE EXCEPTION 'max_selections cannot exceed number of answers';
        END IF;
        -- seats_to_fill should equal max_selections for multi-choice
        NEW.seats_to_fill := NEW.max_selections;
    END IF;

    -- Ranked-choice (STV): seats_to_fill must be less than candidates
    IF NEW.voting_type = 'ranked-choice' THEN
        IF NEW.seats_to_fill >= jsonb_array_length(NEW.answers) THEN
            RAISE EXCEPTION 'seats_to_fill must be less than number of candidates for ranked-choice';
        END IF;
        -- max_selections = number of candidates (can rank all)
        NEW.max_selections := jsonb_array_length(NEW.answers);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Step 7: Helper function to get ranked ballots
-- =====================================================

CREATE OR REPLACE FUNCTION get_ranked_ballots(p_election_id UUID)
RETURNS TABLE (
    ballot_id UUID,
    member_uid VARCHAR(128),
    preferences TEXT[],
    submitted_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        b.id as ballot_id,
        b.member_uid,
        ARRAY(
            SELECT jsonb_array_elements_text(b.ranked_answers)
        ) as preferences,
        b.submitted_at
    FROM ballots b
    WHERE b.election_id = p_election_id
      AND b.ranked_answers IS NOT NULL
    ORDER BY b.submitted_at;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_ranked_ballots IS 'Get all ranked-choice ballots for an election in STV format';

-- =====================================================
-- Step 8: Create view for STV election data
-- =====================================================

CREATE OR REPLACE VIEW stv_election_data AS
SELECT
    e.id as election_id,
    e.title,
    e.seats_to_fill,
    (
        SELECT jsonb_agg(ans->>'id')
        FROM jsonb_array_elements(e.answers) as ans
    ) as candidate_ids,
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
        SELECT COUNT(*)
        FROM ballots b
        WHERE b.election_id = e.id AND b.ranked_answers IS NOT NULL
    ) as total_ballots
FROM elections e
WHERE e.voting_type = 'ranked-choice';

COMMENT ON VIEW stv_election_data IS 'View for STV election configuration and ballot counts';

-- =====================================================
-- Icelandic Terminology Reference (for i18n)
-- =====================================================
--
-- English              | Icelandic
-- --------------------|-------------------------
-- Ranked-choice       | Forgangsröðun
-- STV                 | Persónukjör með valkostum
-- Preference          | Forgangsröð / Val
-- 1st preference      | 1. val
-- 2nd preference      | 2. val
-- Quota               | Sætishlutur / Kjörþröskuldur
-- Surplus             | Umframatkvæði
-- Transfer            | Færsla / Endurúthlutun
-- Elimination         | Brottfelling
-- Round               | Umferð
-- Elected             | Kjörinn
-- Excluded            | Útilokaður
-- Ballot              | Kjörseðill
-- Seats to fill       | Fjöldi sæta

-- =====================================================
-- Example Queries
-- =====================================================

-- Create a ranked-choice (STV) election
-- INSERT INTO elections (
--     title, question, answers, voting_type, seats_to_fill, created_by, status
-- ) VALUES (
--     'Kjör í stjórn (STV)',
--     'Raðaðu frambjóðendunum í forgangsröð',
--     '[{"id":"anna","text":"Anna"},{"id":"bjorn","text":"Björn"},{"id":"gudrun","text":"Guðrún"},{"id":"einar","text":"Einar"},{"id":"frida","text":"Fríða"}]'::jsonb,
--     'ranked-choice',
--     3,  -- 3 seats to fill
--     'admin-uid',
--     'draft'
-- );

-- Insert a ranked-choice ballot
-- INSERT INTO ballots (
--     election_id, member_uid, ranked_answers, token_hash, submitted_at
-- ) VALUES (
--     'election-uuid',
--     'member-firebase-uid',
--     '["anna", "gudrun", "bjorn"]'::jsonb,  -- Anna 1st, Guðrún 2nd, Björn 3rd
--     'token-hash',
--     NOW()
-- );

-- Get ballots for STV counting
-- SELECT * FROM get_ranked_ballots('election-uuid');

-- Get STV election configuration
-- SELECT * FROM stv_election_data WHERE election_id = 'election-uuid';

-- =====================================================
-- Verification Queries
-- =====================================================

-- Check voting_type constraint
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'elections.elections'::regclass
--   AND conname = 'valid_voting_type';

-- Check seats_to_fill column
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'elections' AND table_name = 'elections' AND column_name = 'seats_to_fill';

-- Check ranked_answers column
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'elections' AND table_name = 'ballots' AND column_name = 'ranked_answers';

-- =====================================================
-- End of Migration
-- =====================================================

SET search_path TO public;
