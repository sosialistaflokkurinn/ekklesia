-- Elections Management Schema
-- Database: ekklesia-db (PostgreSQL 15)
-- Schema: elections (extends existing schema)
-- Created: 2025-10-19
-- Purpose: Election metadata and lifecycle management for admin endpoints

-- Set search path
SET search_path TO elections, public;

-- =====================================================
-- Elections Table (election metadata and configuration)
-- =====================================================

CREATE TABLE IF NOT EXISTS elections (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Election metadata
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    question TEXT NOT NULL,
    answers JSONB NOT NULL,  -- Array of answer options (e.g., ["yes", "no", "abstain"])

    -- Lifecycle status
    status VARCHAR(20) NOT NULL DEFAULT 'draft',

    -- Audit fields
    created_by VARCHAR(128) NOT NULL,  -- Firebase UID
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Lifecycle timestamps
    published_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    archived_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT valid_status CHECK (
        status IN ('draft', 'published', 'paused', 'closed', 'archived', 'deleted')
    ),
    CONSTRAINT valid_answers CHECK (
        jsonb_typeof(answers) = 'array' AND jsonb_array_length(answers) >= 2
    ),
    CONSTRAINT valid_title CHECK (length(trim(title)) > 0),
    CONSTRAINT valid_question CHECK (length(trim(question)) > 0)
);

-- =====================================================
-- Indexes for Performance
-- =====================================================

-- Status queries (most common filter)
CREATE INDEX IF NOT EXISTS idx_elections_status ON elections(status);

-- Creator lookup
CREATE INDEX IF NOT EXISTS idx_elections_created_by ON elections(created_by);

-- Chronological queries
CREATE INDEX IF NOT EXISTS idx_elections_created_at ON elections(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_elections_updated_at ON elections(updated_at DESC);

-- Lifecycle timestamp queries
CREATE INDEX IF NOT EXISTS idx_elections_published_at ON elections(published_at DESC) WHERE published_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_elections_closed_at ON elections(closed_at DESC) WHERE closed_at IS NOT NULL;

-- Composite index for listing (status + chronology)
CREATE INDEX IF NOT EXISTS idx_elections_status_created ON elections(status, created_at DESC);

-- =====================================================
-- Triggers for Automatic Timestamp Updates
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_elections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on UPDATE
CREATE TRIGGER trigger_update_elections_updated_at
    BEFORE UPDATE ON elections
    FOR EACH ROW
    EXECUTE FUNCTION update_elections_updated_at();

-- =====================================================
-- Comments and Documentation
-- =====================================================

COMMENT ON TABLE elections IS 'Election metadata and lifecycle management (admin-managed)';
COMMENT ON COLUMN elections.id IS 'Unique election identifier (UUID)';
COMMENT ON COLUMN elections.title IS 'Election display title (e.g., "Prófunarkosning 2025")';
COMMENT ON COLUMN elections.description IS 'Optional detailed description of the election';
COMMENT ON COLUMN elections.question IS 'The question being voted on';
COMMENT ON COLUMN elections.answers IS 'Array of valid answer options (JSONB array, min 2 items)';
COMMENT ON COLUMN elections.status IS 'Lifecycle status: draft → published → paused/closed → archived (or deleted)';
COMMENT ON COLUMN elections.created_by IS 'Firebase UID of user who created the election';
COMMENT ON COLUMN elections.created_at IS 'Timestamp when election was created (immutable)';
COMMENT ON COLUMN elections.updated_at IS 'Timestamp when election was last modified (auto-updated)';
COMMENT ON COLUMN elections.published_at IS 'Timestamp when election was published (voting can start)';
COMMENT ON COLUMN elections.closed_at IS 'Timestamp when election was closed (voting ended)';
COMMENT ON COLUMN elections.archived_at IS 'Timestamp when election was archived (read-only)';
COMMENT ON COLUMN elections.deleted_at IS 'Timestamp when draft was soft-deleted (developer only)';

-- =====================================================
-- Example Status Transitions
-- =====================================================

-- draft → published (publish endpoint)
-- published → paused (pause endpoint)
-- paused → published (resume endpoint)
-- published/paused → closed (close endpoint)
-- closed → archived (archive endpoint)
-- draft → deleted (soft delete endpoint, developer only)

-- =====================================================
-- Example Queries
-- =====================================================

-- List all published elections
-- SELECT id, title, question, published_at FROM elections WHERE status = 'published' ORDER BY published_at DESC;

-- List all elections created by a user
-- SELECT id, title, status, created_at FROM elections WHERE created_by = 'firebase-uid' ORDER BY created_at DESC;

-- Count elections by status
-- SELECT status, COUNT(*) as count FROM elections GROUP BY status ORDER BY status;

-- Find elections ready to close (published for >1 hour)
-- SELECT id, title, published_at FROM elections WHERE status = 'published' AND published_at < NOW() - INTERVAL '1 hour';

-- =====================================================
-- Verification Queries (for testing)
-- =====================================================

-- Count elections by status
-- SELECT status, COUNT(*) FROM elections GROUP BY status ORDER BY status;

-- Check recent elections
-- SELECT id, title, status, created_at, updated_at FROM elections ORDER BY created_at DESC LIMIT 10;

-- Check lifecycle transitions
-- SELECT id, title, status, published_at, closed_at, archived_at FROM elections WHERE status IN ('published', 'closed', 'archived');

-- =====================================================
-- End of Migration
-- =====================================================

-- Reset search path
SET search_path TO public;
