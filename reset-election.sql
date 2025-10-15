-- Reset Election Data for Testing
-- Run this script to allow testing the voting flow again
--
-- Usage (recommended - retrieves password from Secret Manager):
-- ./scripts/psql-cloud.sh -f reset-election.sql
--
-- Alternative (manual password retrieval):
-- PGPASSWORD=$(./scripts/get-secret.sh postgres-password) psql -h 127.0.0.1 -p 5433 -U postgres -d postgres -f reset-election.sql
--
-- Or via Cloud Console SQL editor (authenticated via console)

BEGIN;

-- Step 1: Show current state
SELECT 'BEFORE RESET - Events Service (public schema):' as status;
SELECT kennitala, LEFT(token_hash, 16) as token_prefix, issued_at, voted
FROM public.voting_tokens
WHERE kennitala = '200978-3589';

SELECT 'BEFORE RESET - Elections Service (elections schema):' as status;
SELECT COUNT(*) as total_tokens FROM elections.voting_tokens;
SELECT COUNT(*) as total_ballots FROM elections.ballots;
SELECT answer, COUNT(*) as count FROM elections.ballots GROUP BY answer;

-- Step 2: Delete your specific voting token from Events service
DELETE FROM public.voting_tokens
WHERE kennitala = '200978-3589';

SELECT 'Deleted token for kennitala 200978-3589 from Events service' as action;

-- Step 3: Reset Elections service (clear all data)
-- WARNING: This clears ALL voting data, not just yours!
TRUNCATE TABLE elections.ballots CASCADE;
TRUNCATE TABLE elections.voting_tokens CASCADE;

SELECT 'Cleared all Elections service data' as action;

-- Step 4: Show final state
SELECT 'AFTER RESET - Events Service:' as status;
SELECT COUNT(*) as remaining_tokens FROM public.voting_tokens;

SELECT 'AFTER RESET - Elections Service:' as status;
SELECT COUNT(*) as total_tokens FROM elections.voting_tokens;
SELECT COUNT(*) as total_ballots FROM elections.ballots;

COMMIT;

SELECT 'Election reset complete! You can now request a new token and vote again.' as message;
