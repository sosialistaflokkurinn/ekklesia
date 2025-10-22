-- Events Service - Move election tables into dedicated schema
-- Purpose: Align runtime SQL with schema-qualified queries used by admin API
-- Database: Cloud SQL PostgreSQL 15 (ekklesia-db)
-- Date: 2025-10-20 (dry-run prep)

BEGIN;

CREATE SCHEMA IF NOT EXISTS elections AUTHORIZATION postgres;

ALTER TABLE IF EXISTS public.election SET SCHEMA elections;
ALTER TABLE IF EXISTS public.voting_tokens SET SCHEMA elections;

GRANT USAGE ON SCHEMA elections TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA elections TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA elections
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO postgres;

COMMIT;

-- Verification queries (run manually after migration)
-- SELECT table_schema, table_name FROM information_schema.tables
--   WHERE table_schema = 'elections' ORDER BY table_name;
-- SELECT * FROM elections.election LIMIT 1;
-- SELECT * FROM elections.voting_tokens LIMIT 1;
