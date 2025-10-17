-- ⚠️  EXAMPLE ONLY - NOT FOR DIRECT EXECUTION
-- Election Reset Script Template
--
-- SECURITY NOTE: This is a sanitized example. Do not commit actual kennitalas to version control.
-- For actual reset operations, use the admin API endpoint: POST /api/admin/reset-election
--
-- If you must use SQL directly:
-- 1. Copy this file to a private location
-- 2. Replace <YOUR_KENNITALA> with actual value
-- 3. Run via Cloud Console SQL Editor (authenticated)
--
-- Preferred method: Use admin API endpoint with proper authentication and audit trail

BEGIN;

-- Step 1: Show current state (example for specific user)
SELECT 'BEFORE RESET - Events Service:' as status;
SELECT kennitala, LEFT(token_hash, 16) as token_prefix, issued_at, voted
FROM public.voting_tokens
WHERE kennitala = '<YOUR_KENNITALA>';  -- Replace with actual kennitala (format: DDMMYY-XXXX)

SELECT 'BEFORE RESET - Elections Service:' as status;
SELECT COUNT(*) as total_tokens FROM elections.voting_tokens;
SELECT COUNT(*) as total_ballots FROM elections.ballots;

-- Step 2: Delete specific user's token (safe operation)
-- DELETE FROM public.voting_tokens
-- WHERE kennitala = '<YOUR_KENNITALA>';

-- Step 3: Full reset (destructive - requires confirmation)
-- ⚠️  WARNING: This clears ALL voting data, not just one user!
-- ⚠️  Only use in development/testing environments
-- ⚠️  For production, use the admin API endpoint with proper audit trail
-- TRUNCATE TABLE elections.ballots CASCADE;
-- TRUNCATE TABLE elections.voting_tokens CASCADE;
-- DELETE FROM public.voting_tokens;

-- Step 4: Show final state
SELECT 'AFTER RESET - Events Service:' as status;
SELECT COUNT(*) as remaining_tokens FROM public.voting_tokens;

SELECT 'AFTER RESET - Elections Service:' as status;
SELECT COUNT(*) as total_tokens FROM elections.voting_tokens;
SELECT COUNT(*) as total_ballots FROM elections.ballots;

COMMIT;

-- NOTES:
-- - Actual destructive operations are commented out for safety
-- - Use admin API endpoint for production resets (includes audit trail)
-- - API endpoint: POST /api/admin/reset-election
--   - Requires: developer role + environment gate + UID allowlist + confirmation phrase
--   - Returns: before/after counts for verification
-- - For testing only: uncomment destructive operations and run manually
