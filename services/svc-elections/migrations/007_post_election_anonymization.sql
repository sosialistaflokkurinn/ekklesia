-- Migration 007: Post-Election Member UID Anonymization
-- Issue #255: Implement Post-Election Member UID Anonymization
--
-- Security Enhancement:
-- - After election closes, replace member_uid with irreversible one-way hash
-- - Prevents reconstruction of voting history (even with DB access)
-- - Preserves vote deduplication (consistent hash)
-- - Results aggregation unaffected
--
-- Trade-offs:
-- ⚠️ Irreversible - cannot audit "did member X vote?" after anonymization
-- ⚠️ Cannot provide voter receipts post-anonymization
--
-- Created: 2025-11-11
-- Epic #251: Voting System Security & Anonymity Enhancements

-- ============================================================
-- Step 1: Create Anonymization Function
-- ============================================================

-- Anonymize closed election ballots by hashing member_uid
-- This operation is IRREVERSIBLE
CREATE OR REPLACE FUNCTION elections.anonymize_closed_election(
  p_election_id UUID,
  p_secret_salt VARCHAR(64)
)
RETURNS TABLE(
  anonymized_count INTEGER,
  election_status VARCHAR(50)
)
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs as function owner (has full access)
SET search_path = elections, public
AS $$
DECLARE
  v_status VARCHAR(50);
  v_count INTEGER;
BEGIN
  -- Check election status
  SELECT status INTO v_status
  FROM elections.elections
  WHERE id = p_election_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Election not found: %', p_election_id;
  END IF;

  -- Only allow anonymization for closed/archived elections
  IF v_status NOT IN ('closed', 'archived') THEN
    RAISE EXCEPTION 'Election must be closed before anonymization (current status: %)', v_status;
  END IF;

  -- Hash member_uid (irreversible)
  -- Formula: SHA256(member_uid || election_id || secret_salt)
  -- - Includes election_id to prevent cross-election correlation
  -- - Includes secret_salt to prevent rainbow table attacks
  -- - encode(sha256(...), 'hex') produces 64-character hex string
  UPDATE elections.ballots
  SET member_uid = encode(
    sha256(
      (member_uid || p_election_id::TEXT || p_secret_salt)::bytea
    ),
    'hex'
  )
  WHERE election_id = p_election_id
    -- Skip sentinel token used for S2S token-based voting (backwards compatibility)
    AND member_uid != '0000000000000000000000000000000000000000000000000000000000000000'
    -- Only anonymize if not already hashed (idempotent - safe to run multiple times)
    AND length(member_uid) != 64;  -- Firebase UIDs are 28 chars, SHA256 hashes are 64 chars

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Return results for logging/verification
  RETURN QUERY SELECT v_count, v_status;
END;
$$;

-- Add documentation comment
COMMENT ON FUNCTION elections.anonymize_closed_election(UUID, VARCHAR) IS
  'Anonymize ballots for closed election by hashing member_uid. IRREVERSIBLE. '
  'After anonymization, cannot link votes to specific members. '
  'Results aggregation and vote deduplication still work.';

-- ============================================================
-- Step 2: Grant Permissions
-- ============================================================

-- NOTE: Like migration 006, this assumes postgres user (no separate elections_service role)
-- When using separate service account:
-- GRANT EXECUTE ON FUNCTION elections.anonymize_closed_election TO elections_service;

-- ============================================================
-- Verification
-- ============================================================

-- To test anonymization function:
--
-- 1. Create and close test election
-- SELECT id FROM elections.elections WHERE status = 'closed' LIMIT 1;
--
-- 2. Check current member_uid values (before anonymization)
-- SELECT member_uid, length(member_uid) FROM elections.ballots WHERE election_id = 'YOUR_ELECTION_ID' LIMIT 3;
-- Expected: Firebase UIDs (28 characters)
--
-- 3. Run anonymization
-- SELECT * FROM elections.anonymize_closed_election(
--   'YOUR_ELECTION_ID'::UUID,
--   'test-salt-DO-NOT-USE-IN-PRODUCTION'
-- );
-- Expected: {anonymized_count: N, election_status: 'closed'}
--
-- 4. Verify member_uid is hashed (after anonymization)
-- SELECT member_uid, length(member_uid) FROM elections.ballots WHERE election_id = 'YOUR_ELECTION_ID' LIMIT 3;
-- Expected: SHA256 hashes (64 hex characters)
--
-- 5. Test idempotency (safe to run multiple times)
-- SELECT * FROM elections.anonymize_closed_election('YOUR_ELECTION_ID'::UUID, 'test-salt');
-- Expected: {anonymized_count: 0, ...} (already anonymized, no updates)

-- ============================================================
-- Rollback (if needed)
-- ============================================================

-- ⚠️ WARNING: Anonymization is IRREVERSIBLE by design
-- Cannot restore original member_uid values after hashing
--
-- To rollback migration (remove function only):
-- DROP FUNCTION IF EXISTS elections.anonymize_closed_election(UUID, VARCHAR);
--
-- Existing hashed member_uid values will remain hashed
