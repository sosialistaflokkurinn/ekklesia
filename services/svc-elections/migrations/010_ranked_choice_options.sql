-- Migration 010: Add ranked-choice configuration options
--
-- Adds two new columns to elections table:
-- - ranked_method: 'stv' (full STV with vote transfers) or 'simple' (just count first preferences)
-- - quota_type: 'droop', 'hare', or 'none' (determines threshold calculation)
--
-- This allows flexible configuration of ranked-choice elections.

SET search_path TO elections, public;

-- =====================================================
-- Step 1: Add ranked_method column
-- =====================================================
-- Values:
--   'stv' - Full STV algorithm with surplus transfer and elimination
--   'simple' - Just count first preferences, no vote transfers

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'elections'
        AND table_name = 'elections'
        AND column_name = 'ranked_method'
    ) THEN
        ALTER TABLE elections.elections
        ADD COLUMN ranked_method VARCHAR(20) DEFAULT 'stv';
    END IF;
END $$;

COMMENT ON COLUMN elections.elections.ranked_method IS 'Ranking method: stv (full STV with vote transfers) or simple (just count first preferences)';

-- =====================================================
-- Step 2: Add quota_type column
-- =====================================================
-- Values:
--   'droop' - Droop quota: floor(votes/(seats+1)) + 1
--   'hare' - Hare quota: votes/seats
--   'none' - No quota (for simple ranking)

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'elections'
        AND table_name = 'elections'
        AND column_name = 'quota_type'
    ) THEN
        ALTER TABLE elections.elections
        ADD COLUMN quota_type VARCHAR(20) DEFAULT 'droop';
    END IF;
END $$;

COMMENT ON COLUMN elections.elections.quota_type IS 'Quota type for ranked-choice: droop, hare, or none';

-- =====================================================
-- Step 3: Add constraints
-- =====================================================

-- Constraint for ranked_method
ALTER TABLE elections.elections
DROP CONSTRAINT IF EXISTS valid_ranked_method;

ALTER TABLE elections.elections
ADD CONSTRAINT valid_ranked_method CHECK (
    ranked_method IS NULL OR ranked_method IN ('stv', 'simple')
);

-- Constraint for quota_type
ALTER TABLE elections.elections
DROP CONSTRAINT IF EXISTS valid_quota_type;

ALTER TABLE elections.elections
ADD CONSTRAINT valid_quota_type CHECK (
    quota_type IS NULL OR quota_type IN ('droop', 'hare', 'none')
);

-- =====================================================
-- Step 4: Update trigger to validate combinations
-- =====================================================

CREATE OR REPLACE FUNCTION elections.validate_ranked_options()
RETURNS TRIGGER AS $$
BEGIN
    -- Only validate for ranked-choice elections
    IF NEW.voting_type = 'ranked-choice' THEN
        -- Default ranked_method to 'stv' if not set
        IF NEW.ranked_method IS NULL THEN
            NEW.ranked_method := 'stv';
        END IF;

        -- Default quota_type to 'droop' for stv, 'none' for simple
        IF NEW.quota_type IS NULL THEN
            IF NEW.ranked_method = 'simple' THEN
                NEW.quota_type := 'none';
            ELSE
                NEW.quota_type := 'droop';
            END IF;
        END IF;

        -- If simple method, quota should be 'none'
        IF NEW.ranked_method = 'simple' AND NEW.quota_type != 'none' THEN
            RAISE WARNING 'Simple ranked method does not use quota - setting quota_type to none';
            NEW.quota_type := 'none';
        END IF;
    ELSE
        -- Non-ranked elections don't need these fields
        NEW.ranked_method := NULL;
        NEW.quota_type := NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if not exists
DROP TRIGGER IF EXISTS validate_ranked_options_trigger ON elections.elections;
CREATE TRIGGER validate_ranked_options_trigger
    BEFORE INSERT OR UPDATE ON elections.elections
    FOR EACH ROW
    EXECUTE FUNCTION elections.validate_ranked_options();

-- =====================================================
-- Step 5: Update existing ranked-choice elections
-- =====================================================
-- Set defaults for any existing ranked-choice elections

UPDATE elections.elections
SET
    ranked_method = COALESCE(ranked_method, 'stv'),
    quota_type = COALESCE(quota_type, 'droop')
WHERE voting_type = 'ranked-choice';

-- =====================================================
-- Verification
-- =====================================================
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'elections'
--   AND table_name = 'elections'
--   AND column_name IN ('ranked_method', 'quota_type');
