-- Events Service - External Events Migration
-- Purpose: Store Facebook events synced from Sósíalistaflokkurinn page
-- Database: Cloud SQL PostgreSQL 15 (ekklesia-db)
-- Date: 2025-12-14

-- =============================================================================
-- EXTERNAL EVENTS TABLE
-- =============================================================================
-- Stores Facebook events synced from page
-- Primary data source for events page
-- Synced every 6 hours from Facebook API

CREATE TABLE IF NOT EXISTS external_events (
    id SERIAL PRIMARY KEY,

    -- Facebook identifiers
    facebook_id VARCHAR(100) UNIQUE NOT NULL,
    -- Facebook event ID

    -- Event details
    title VARCHAR(500) NOT NULL,
    description TEXT,

    -- Timing
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,

    -- Location (structured JSON for flexibility)
    location_name VARCHAR(500),
    location_street VARCHAR(500),
    location_city VARCHAR(100),
    location_country VARCHAR(100),
    is_online BOOLEAN DEFAULT FALSE,

    -- Geocoded coordinates (from Staðfangaskrá)
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),

    -- Links
    facebook_url VARCHAR(1000),
    image_url VARCHAR(1000),

    -- Admin features
    is_featured BOOLEAN DEFAULT FALSE,

    -- Sync metadata
    synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for upcoming events queries
CREATE INDEX IF NOT EXISTS idx_external_events_start_time ON external_events(start_time);

-- Index for featured event lookup
CREATE INDEX IF NOT EXISTS idx_external_events_featured ON external_events(is_featured) WHERE is_featured = TRUE;

-- Index for Facebook ID lookup during sync
CREATE INDEX IF NOT EXISTS idx_external_events_facebook_id ON external_events(facebook_id);

-- =============================================================================
-- SYNC STATUS TABLE
-- =============================================================================
-- Track Facebook sync status for monitoring

CREATE TABLE IF NOT EXISTS external_events_sync_log (
    id SERIAL PRIMARY KEY,

    sync_type VARCHAR(50) NOT NULL,
    -- 'facebook_sync', 'geocode'

    status VARCHAR(50) NOT NULL,
    -- 'success', 'error', 'partial'

    events_count INTEGER DEFAULT 0,
    error_message TEXT,

    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Index for latest sync lookup
CREATE INDEX IF NOT EXISTS idx_sync_log_type_started ON external_events_sync_log(sync_type, started_at DESC);

-- =============================================================================
-- TRIGGER FOR UPDATED_AT
-- =============================================================================

CREATE OR REPLACE FUNCTION update_external_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_external_events_updated_at ON external_events;
CREATE TRIGGER trigger_external_events_updated_at
    BEFORE UPDATE ON external_events
    FOR EACH ROW
    EXECUTE FUNCTION update_external_events_updated_at();

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================
-- Run these after migration to verify setup

-- Check tables exist
-- SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'external%';

-- Check indexes
-- SELECT indexname, tablename FROM pg_indexes WHERE tablename LIKE 'external%';
