-- Events Service - Remove elections_service_id column (Option A: Standalone)
-- Purpose: Remove Elections service integration field (deferred to Phase 2)
-- Database: Cloud SQL PostgreSQL 15 (ekklesia-db)
-- Date: 2025-10-09

-- Remove elections_service_id column (not needed for MVP)
ALTER TABLE election DROP COLUMN IF EXISTS elections_service_id;

-- Verification: Show election table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'election'
ORDER BY ordinal_position;
