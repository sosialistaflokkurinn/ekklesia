-- Events Service - Seed Election for October 2025 Integration Tests
-- Purpose: Provide deterministic election data for Phase 5 validation scenarios
-- Database: Cloud SQL PostgreSQL 15 (ekklesia-db)
-- Date: 2025-10-10

BEGIN;

-- Reset state to ensure integration tests start with a clean slate
DELETE FROM voting_tokens;
DELETE FROM election;

-- Insert October 2025 municipal election with deterministic UUID and timeline
INSERT INTO election (
    id,
    title,
    description,
    question_text,
    status,
    voting_starts_at,
    voting_ends_at,
    created_at,
    updated_at
) VALUES (
    'b322b1fd-83f6-4ff8-9ac5-1e5c6efa8b84',
    'Kannanleik kosning October 2025',
    'Practical end-to-end rehearsal for the Sósíalistaflokkurinn voting platform ahead of the municipal election window in late October 2025.',
    'Samþykkir þú að ráðast í prófunarútfærslu á rafrænu kosningakerfi flokksins með stafrænum atkvæðaseðlum?',
    'published',
    TIMESTAMPTZ '2025-10-18 09:00:00+00',
    TIMESTAMPTZ '2025-10-20 21:00:00+00',
    TIMESTAMPTZ '2025-09-30 12:00:00+00',
    TIMESTAMPTZ '2025-09-30 12:00:00+00'
)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    question_text = EXCLUDED.question_text,
    status = EXCLUDED.status,
    voting_starts_at = EXCLUDED.voting_starts_at,
    voting_ends_at = EXCLUDED.voting_ends_at,
    updated_at = NOW();

COMMIT;

-- Verification:
-- SELECT id, title, status, voting_starts_at, voting_ends_at FROM election;
-- SELECT COUNT(*) AS token_count FROM voting_tokens;
