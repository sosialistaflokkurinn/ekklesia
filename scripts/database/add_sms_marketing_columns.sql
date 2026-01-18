-- Add SMS marketing preference columns to membership_comrade
-- Run this migration against Cloud SQL before deploying SMS functions
--
-- Usage:
--   1. Connect to Cloud SQL via proxy:
--      cloud-sql-proxy ekklesia-prod-10-2025:europe-west1:ekklesia-db-eu1 --port 5433 --gcloud-auth
--
--   2. Run migration (set DB password in environment first):
--      psql -h localhost -p 5433 -U socialism -d socialism -f scripts/database/add_sms_marketing_columns.sql

-- Add sms_marketing column (defaults to true for existing members)
ALTER TABLE membership_comrade
ADD COLUMN IF NOT EXISTS sms_marketing BOOLEAN DEFAULT TRUE;

-- Add sms_marketing_updated_at timestamp
ALTER TABLE membership_comrade
ADD COLUMN IF NOT EXISTS sms_marketing_updated_at TIMESTAMP WITH TIME ZONE;

-- Create index for filtering by SMS marketing preference
CREATE INDEX IF NOT EXISTS idx_comrade_sms_marketing
ON membership_comrade (sms_marketing)
WHERE deleted_at IS NULL;

-- Verify the changes
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'membership_comrade'
  AND column_name IN ('sms_marketing', 'sms_marketing_updated_at');

-- Show count of members with SMS marketing enabled/disabled
SELECT
    CASE WHEN sms_marketing THEN 'Enabled' ELSE 'Disabled' END as sms_marketing_status,
    COUNT(*) as member_count
FROM membership_comrade
WHERE deleted_at IS NULL
GROUP BY sms_marketing;
