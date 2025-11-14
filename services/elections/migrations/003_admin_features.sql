-- Add Admin Features to Elections Table
-- Database: ekklesia-db (PostgreSQL 15)
-- Schema: elections
-- Created: 2025-11-06
-- Purpose: Add hide/unhide (soft delete), voting types, and RBAC support

-- Set search path
SET search_path TO elections, public;

-- =====================================================
-- Add New Columns for Admin Features
-- =====================================================

-- 1. Soft Delete (Hide/Unhide)
-- Instead of using status='deleted', we use a separate hidden flag
-- This allows hiding elections without changing their lifecycle status
ALTER TABLE elections
ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN elections.hidden IS 'Soft delete flag - hidden elections are not shown to members but can be restored';

-- Index for filtering hidden elections
CREATE INDEX IF NOT EXISTS idx_elections_hidden ON elections(hidden);

-- 2. Voting Type (Single-choice vs Multi-choice)
ALTER TABLE elections
ADD COLUMN IF NOT EXISTS voting_type VARCHAR(20) NOT NULL DEFAULT 'single-choice';

ALTER TABLE elections
ADD CONSTRAINT valid_voting_type CHECK (
    voting_type IN ('single-choice', 'multi-choice')
);

COMMENT ON COLUMN elections.voting_type IS 'Voting type: single-choice (radio buttons) or multi-choice (checkboxes)';

-- 3. Max Selections (for multi-choice elections)
ALTER TABLE elections
ADD COLUMN IF NOT EXISTS max_selections INTEGER DEFAULT 1;

-- Fix existing data: Set max_selections = 1 for elections with 0 answers
UPDATE elections
SET max_selections = 1
WHERE jsonb_array_length(answers) = 0;

-- Fix existing data: Set max_selections = answer_count for elections where max > answer_count
UPDATE elections
SET max_selections = jsonb_array_length(answers)
WHERE max_selections > jsonb_array_length(answers);

ALTER TABLE elections
ADD CONSTRAINT valid_max_selections CHECK (
    max_selections >= 1 AND max_selections <= jsonb_array_length(answers)
);

COMMENT ON COLUMN elections.max_selections IS 'Maximum number of selections allowed (for multi-choice elections)';

-- 4. Eligibility (who can vote)
ALTER TABLE elections
ADD COLUMN IF NOT EXISTS eligibility VARCHAR(20) NOT NULL DEFAULT 'members';

ALTER TABLE elections
ADD CONSTRAINT valid_eligibility CHECK (
    eligibility IN ('members', 'admins', 'all')
);

COMMENT ON COLUMN elections.eligibility IS 'Who can vote: members (default), admins, or all';

-- 5. Scheduled Start/End Times
ALTER TABLE elections
ADD COLUMN IF NOT EXISTS scheduled_start TIMESTAMP WITH TIME ZONE;

ALTER TABLE elections
ADD COLUMN IF NOT EXISTS scheduled_end TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN elections.scheduled_start IS 'Scheduled start time (null = start immediately when published)';
COMMENT ON COLUMN elections.scheduled_end IS 'Scheduled end time (null = manual close)';

-- Index for scheduled elections
CREATE INDEX IF NOT EXISTS idx_elections_scheduled_start
ON elections(scheduled_start) WHERE scheduled_start IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_elections_scheduled_end
ON elections(scheduled_end) WHERE scheduled_end IS NOT NULL;

-- 6. Last Modified By (for audit trail)
ALTER TABLE elections
ADD COLUMN IF NOT EXISTS updated_by VARCHAR(128);

COMMENT ON COLUMN elections.updated_by IS 'Firebase UID of user who last modified the election';

-- =====================================================
-- Update Existing Status Constraint
-- =====================================================

-- Migrate old 'open' status to 'published' (if any exist)
UPDATE elections
SET status = 'published'
WHERE status = 'open';

-- Remove the old constraint that included 'deleted' status
ALTER TABLE elections DROP CONSTRAINT IF EXISTS valid_status;

-- Add new constraint without 'deleted' and 'open' (we use hidden flag instead of deleted, and 'published' instead of 'open')
ALTER TABLE elections
ADD CONSTRAINT valid_status CHECK (
    status IN ('draft', 'published', 'paused', 'closed', 'archived')
);

-- =====================================================
-- Function: Validate Multi-choice Settings
-- =====================================================

CREATE OR REPLACE FUNCTION validate_multichoice_settings()
RETURNS TRIGGER AS $$
BEGIN
    -- If single-choice, max_selections must be 1
    IF NEW.voting_type = 'single-choice' AND NEW.max_selections != 1 THEN
        RAISE EXCEPTION 'Single-choice elections must have max_selections = 1';
    END IF;

    -- If multi-choice, max_selections must be <= number of answers
    IF NEW.voting_type = 'multi-choice' THEN
        IF NEW.max_selections > jsonb_array_length(NEW.answers) THEN
            RAISE EXCEPTION 'max_selections cannot exceed number of answers';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate multi-choice settings
CREATE TRIGGER trigger_validate_multichoice
    BEFORE INSERT OR UPDATE ON elections
    FOR EACH ROW
    EXECUTE FUNCTION validate_multichoice_settings();

-- =====================================================
-- Example Queries for Admin Features
-- =====================================================

-- List all elections including hidden (admin view with includeHidden=true)
-- SELECT id, title, status, hidden, created_at FROM elections ORDER BY created_at DESC;

-- List only visible elections (member view)
-- SELECT id, title, status, created_at FROM elections WHERE hidden = FALSE ORDER BY created_at DESC;

-- Hide an election (soft delete)
-- UPDATE elections SET hidden = TRUE, updated_by = 'firebase-uid' WHERE id = 'election-uuid';

-- Unhide an election (restore)
-- UPDATE elections SET hidden = FALSE, updated_by = 'firebase-uid' WHERE id = 'election-uuid';

-- Get multi-choice elections
-- SELECT id, title, voting_type, max_selections, answers FROM elections WHERE voting_type = 'multi-choice';

-- Get scheduled elections
-- SELECT id, title, scheduled_start, scheduled_end FROM elections WHERE scheduled_start IS NOT NULL OR scheduled_end IS NOT NULL;

-- =====================================================
-- Sample Data for Testing
-- =====================================================

-- Single-choice election (traditional yes/no)
INSERT INTO elections (
    title,
    question,
    answers,
    voting_type,
    max_selections,
    created_by,
    status
) VALUES (
    'Test Single-choice Election',
    'Do you support this proposal?',
    '["yes", "no", "abstain"]'::jsonb,
    'single-choice',
    1,
    'test-admin-uid',
    'draft'
) ON CONFLICT DO NOTHING;

-- Multi-choice election (select up to 3)
INSERT INTO elections (
    title,
    question,
    answers,
    voting_type,
    max_selections,
    created_by,
    status
) VALUES (
    'Test Multi-choice Election',
    'Which features should we prioritize? (Select up to 3)',
    '["Feature A", "Feature B", "Feature C", "Feature D", "Feature E"]'::jsonb,
    'multi-choice',
    3,
    'test-admin-uid',
    'draft'
) ON CONFLICT DO NOTHING;

-- =====================================================
-- Verification Queries
-- =====================================================

-- Check if columns were added
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'elections' AND table_name = 'elections'
-- ORDER BY ordinal_position;

-- Check constraints
-- SELECT constraint_name, check_clause
-- FROM information_schema.check_constraints
-- WHERE constraint_schema = 'elections';

-- =====================================================
-- End of Migration
-- =====================================================

-- Reset search path
SET search_path TO public;
