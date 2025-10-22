# Epic #43: Membership Sync with Django Backend

**Epic ID**: #43
**Status**: 🟡 In Planning
**Target Release**: Phase 5 (November 2025)
**Priority**: HIGH (Required for accurate member eligibility)

---

## Overview

Epic #43 implements automatic membership synchronization between the external Django-based member management system and the Ekklesia voting system. This ensures elections always use current membership data and prevents ineligible members from voting.

## Problem Statement

Currently, the Ekklesia system uses a static membership list (kennitalas.txt, 2,273 members from January 2025):
- ❌ **No automatic sync** - Manual updates required
- ❌ **Stale data** - Members added/removed after January 2025 not reflected
- ❌ **No audit trail** - Can't track when membership changed
- ❌ **Django isolation** - Membership changes in Django not visible to voting system

This means:
1. New members can't vote (ineligible even though they should be)
2. Removed members can vote (eligible even though they shouldn't be)
3. Voting accuracy depends on manual updates

Epic #43 solves this by continuously syncing membership with the Django backend.

---

## Goals

### Primary Goals
1. **Automatic Sync** - Regular synchronization with Django backend
2. **Real-time Updates** - Membership changes reflected within hours
3. **Audit Trail** - Track all membership changes with timestamps
4. **Error Recovery** - Automatic retry on sync failures
5. **No Voting Impact** - Sync doesn't interfere with active elections

### Secondary Goals
1. **Webhook Support** - Real-time updates via Django webhooks
2. **Manual Trigger** - Admin can force sync before creating election
3. **Sync Reports** - See what changed in each sync run
4. **Conflict Resolution** - Handle membership conflicts gracefully

### Nice to Have (Phase 5.5+)
1. **Django Admin UI** - Membership management interface
2. **API Keys** - Restrict access to sync endpoint
3. **Rate Limiting** - Prevent abuse of sync endpoint
4. **Bulk Import** - Import from external HR system via Django

---

## Acceptance Criteria

### Must Have (MVP)
- [ ] Sync fetches latest members from Django backend hourly
- [ ] New members can vote in elections (after sync)
- [ ] Removed members can't vote (after sync)
- [ ] All sync operations logged to audit trail
- [ ] Sync failures logged with retry mechanism
- [ ] Manual trigger works (forces immediate sync)
- [ ] Zero downtime (voting continues during sync)

### Should Have (Phase 5)
- [ ] Webhook support for real-time updates
- [ ] Sync reports showing changes (added/removed)
- [ ] Verify member eligibility includes sync status
- [ ] Error notifications to admins
- [ ] Sync history viewable in logs

### Nice to Have (Phase 5.5+)
- [ ] Admin dashboard showing sync status
- [ ] Dry-run option before applying changes
- [ ] Rollback capability (revert to previous membership)
- [ ] Bidirectional sync (Ekklesia → Django)

---

## Technical Specification

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│ External Django Backend (Member Management System)      │
│ - Central source of truth for membership                │
│ - Manages member profiles, roles, permissions           │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ 1. Sync API Request
                     │    (GET /api/members/eligible)
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ Cloud Run: Membership Sync Service (NEW)                │
│ - Scheduled job (hourly)                                │
│ - Webhook receiver (real-time)                          │
│ - Fetches members from Django                           │
│ - Calculates membership delta                           │
│ - Updates member eligibility list                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ 2. Update Member Eligibility
                     │    (INSERT/UPDATE/DELETE members)
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ Cloud SQL: Ekklesia Voting Database                     │
│ - members table (kennitala, status, synced_at)          │
│ - sync_log table (sync operations, results)             │
│ - member_eligibility view (for election voting)         │
└─────────────────────────────────────────────────────────┘
```

### API Endpoints

#### Sync Service (Internal/Webhook Only)
```
POST   /api/sync/trigger         Force immediate sync
GET    /api/sync/status          Get current sync status
GET    /api/sync/logs            View sync history
```

#### Django Backend (Expected)
```
GET    /api/members/eligible     List all eligible members
       Headers: Authorization: Bearer <api-key>
       Response: { members: [{ kennitala, name, email, ... }] }
```

### Database Schema Changes

#### Members Table
```sql
-- Add sync metadata
ALTER TABLE members ADD COLUMN (
  status VARCHAR(50) DEFAULT 'active',    -- active/suspended/removed
  synced_at TIMESTAMP,                    -- Last sync timestamp
  source VARCHAR(50) DEFAULT 'django',    -- Source system
  sync_id UUID                            -- Link to sync run
);

-- Index for quick eligibility checks
CREATE INDEX idx_members_status_synced
  ON members(status, synced_at);
```

#### Sync Log Table
```sql
CREATE TABLE IF NOT EXISTS membership_sync_log (
  id UUID PRIMARY KEY,
  sync_time TIMESTAMP NOT NULL,
  source VARCHAR(50),                     -- 'scheduled' or 'webhook'
  status VARCHAR(50),                     -- 'success'/'partial'/'failed'
  members_fetched INT,
  members_added INT,
  members_removed INT,
  members_updated INT,
  errors JSONB,
  duration_ms INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for quick log queries
CREATE INDEX idx_sync_log_time ON membership_sync_log(sync_time DESC);
```

#### Member Eligibility View
```sql
CREATE OR REPLACE VIEW member_eligibility AS
SELECT
  kennitala,
  name,
  email,
  status,
  CASE WHEN status = 'active' THEN TRUE ELSE FALSE END as eligible,
  synced_at
FROM members
WHERE status IN ('active', 'suspended');
```

### Membership Sync Service (New Cloud Run Service)

#### Language: Node.js 18 + Express (Consistent with Events/Elections)

```javascript
// services/membership-sync/src/index.js

const express = require('express');
const { Pool } = require('pg');
const admin = require('firebase-admin');

const app = express();

// 1. Fetch members from Django backend
async function fetchMembersFromDjango() {
  const apiUrl = process.env.DJANGO_MEMBERS_API_URL;
  const apiKey = process.env.DJANGO_API_KEY;

  const response = await fetch(`${apiUrl}/api/members/eligible`, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });

  if (!response.ok) throw new Error(`Django API error: ${response.status}`);
  return response.json();
}

// 2. Calculate membership delta
async function calculateDelta(dbMembers, djangoMembers) {
  const dbSet = new Set(dbMembers.map(m => m.kennitala));
  const djangoSet = new Set(djangoMembers.map(m => m.kennitala));

  return {
    added: djangoMembers.filter(m => !dbSet.has(m.kennitala)),
    removed: dbMembers.filter(m => !djangoSet.has(m.kennitala)),
    updated: djangoMembers.filter(m => dbSet.has(m.kennitala))
  };
}

// 3. Apply membership changes to database
async function applyMembershipChanges(delta, pool, syncId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Add new members
    for (const member of delta.added) {
      await client.query(
        'INSERT INTO members (kennitala, name, email, status, synced_at, sync_id) VALUES ($1, $2, $3, $4, NOW(), $5)',
        [member.kennitala, member.name, member.email, 'active', syncId]
      );
    }

    // Remove members (soft delete - mark as removed)
    for (const member of delta.removed) {
      await client.query(
        'UPDATE members SET status = $1, synced_at = NOW(), sync_id = $2 WHERE kennitala = $3',
        ['removed', syncId, member.kennitala]
      );
    }

    // Update existing members
    for (const member of delta.updated) {
      await client.query(
        'UPDATE members SET status = $1, synced_at = NOW(), sync_id = $2 WHERE kennitala = $3',
        ['active', syncId, member.kennitala]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// 4. Main sync function
async function syncMembership(source = 'scheduled') {
  const syncId = uuid.v4();
  const startTime = Date.now();

  try {
    // Fetch from Django
    const { members: djangoMembers } = await fetchMembersFromDjango();

    // Fetch from database
    const result = await pool.query('SELECT * FROM members WHERE status != $1', ['removed']);
    const dbMembers = result.rows;

    // Calculate delta
    const delta = await calculateDelta(dbMembers, djangoMembers);

    // Apply changes
    await applyMembershipChanges(delta, pool, syncId);

    // Log success
    await pool.query(
      `INSERT INTO membership_sync_log
       (id, sync_time, source, status, members_fetched, members_added, members_removed, members_updated, duration_ms)
       VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8)`,
      [syncId, source, 'success', djangoMembers.length,
       delta.added.length, delta.removed.length, delta.updated.length,
       Date.now() - startTime]
    );

    return { success: true, syncId, delta };
  } catch (err) {
    // Log failure
    await pool.query(
      `INSERT INTO membership_sync_log
       (id, sync_time, source, status, errors, duration_ms)
       VALUES ($1, NOW(), $2, $3, $4, $5)`,
      [syncId, source, 'failed', JSON.stringify({ error: err.message }),
       Date.now() - startTime]
    );

    throw err;
  }
}

// 5. Express endpoints
app.post('/api/sync/trigger', async (req, res) => {
  try {
    const result = await syncMembership('webhook');
    res.json({ success: true, syncId: result.syncId, changes: result.delta });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sync/status', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM membership_sync_log ORDER BY sync_time DESC LIMIT 1'
    );
    res.json(result.rows[0] || { status: 'never_synced' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sync/logs', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM membership_sync_log ORDER BY sync_time DESC LIMIT 100'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Scheduled job (Cloud Scheduler)
// Triggers POST /api/sync/trigger every hour
```

### Cloud Scheduler Configuration

```bash
# Create hourly sync job
gcloud scheduler jobs create http sync-membership \
  --schedule="0 * * * *" \
  --uri="https://membership-sync-SERVICE.run.app/api/sync/trigger" \
  --http-method=POST \
  --time-zone="Atlantic/Reykjavik" \
  --project=ekklesia-prod-10-2025 \
  --headers="Authorization=Bearer ${SYNC_API_KEY}"
```

### Member Eligibility Check (In Elections/Events)

```javascript
// services/events/src/services/membershipService.js

async function isMemberEligible(kennitala) {
  const result = await pool.query(
    'SELECT eligible FROM member_eligibility WHERE kennitala = $1 LIMIT 1',
    [kennitala]
  );

  if (!result.rows.length) return false;
  return result.rows[0].eligible;
}
```

---

## Implementation Plan

### Phase 5a: Foundation (Week 1)
1. **Database Schema**
   - Add sync columns to members table
   - Create sync_log table
   - Create member_eligibility view
   - Create indexes

2. **Membership Sync Service Setup**
   - Create new Cloud Run service (membership-sync)
   - Implement Django API client
   - Implement delta calculation
   - Add error handling and retry logic

### Phase 5b: Integration (Week 2)
1. **Member Eligibility Integration**
   - Update Elections service to use member_eligibility view
   - Update Events service for eligibility checks
   - Test with membership changes

2. **Sync Triggering**
   - Set up Cloud Scheduler for hourly sync
   - Implement manual trigger endpoint
   - Add webhook receiver (for Django to call us)

### Phase 5c: Testing & Monitoring (Week 3)
1. **Testing**
   - Unit tests for sync logic
   - Integration tests with Django mock
   - Test delta calculation with sample data
   - Test concurrent sync and voting

2. **Monitoring**
   - Set up sync logging
   - Create alerts for sync failures
   - Dashboard showing sync status

### Phase 5d: Documentation (Week 4)
1. **User Documentation**
   - Admin guide for manual sync trigger
   - Troubleshooting guide for sync failures

2. **Developer Documentation**
   - API documentation
   - Django integration guide
   - Architecture decision document

---

## Related Epics

| Epic | Title | Dependency | Status |
|------|-------|-----------|--------|
| #24 | Admin Election Lifecycle | Independent | Planned |
| #87 | Member Election Discovery | **Depends on #43** | Planned |
| #88 | Token Generation | **Depends on #43** | Planned |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-----------|--------|-----------|
| Django API unavailable | Low | Medium | Retry with exponential backoff |
| Sync removes active members | Very Low | Critical | Always verify before removal, audit log |
| Stale data between syncs | Low | Low | 1-hour sync window acceptable |
| Webhook security | Low | High | API key auth + IP whitelist |
| Membership conflicts | Very Low | High | Manual conflict resolution process |

---

## Success Criteria

- [ ] New members can vote within 1 hour of being added to Django
- [ ] Removed members can't vote within 1 hour of removal
- [ ] All sync operations logged
- [ ] Sync failures trigger alerts
- [ ] Manual sync trigger works for admin
- [ ] Zero impact on active voting
- [ ] Audit trail shows all membership changes

---

## Questions for Opus/Team

1. **Django API Availability**: Is Django always available 24/7?
   - Option A: Yes (production standard)
   - Option B: No (scheduled maintenance required)
   - Option C: Unknown (need to verify)

2. **Sync Frequency**: Is 1-hour sync acceptable or need real-time?
   - Option A: Hourly is fine (current proposal)
   - Option B: Need real-time via webhooks
   - Option C: Daily is acceptable

3. **Membership Conflicts**: What if member exists in both systems but with different names?
   - Option A: Update to Django version (source of truth)
   - Option B: Log conflict and require manual resolution
   - Option C: Keep local version (don't override)

4. **API Authentication**: What auth method for Django API?
   - Option A: API key (current proposal)
   - Option B: OAuth 2.0
   - Option C: mTLS certificates
   - Option D: Other

---

## Implementation Checklist

### Database
- [ ] Schema migration script written and tested
- [ ] Indexes created for performance
- [ ] Rollback procedure documented
- [ ] member_eligibility view created

### Sync Service
- [ ] Cloud Run service created (membership-sync)
- [ ] Django API client implemented
- [ ] Delta calculation logic implemented
- [ ] Database update logic implemented
- [ ] Error handling and retry implemented
- [ ] Logging and audit trail implemented

### Integration
- [ ] Elections service uses member_eligibility view
- [ ] Events service checks membership status
- [ ] Cloud Scheduler configured for hourly sync
- [ ] Manual trigger endpoint working
- [ ] Webhook receiver working (optional Phase 5.5)

### Testing
- [ ] Unit tests for sync logic
- [ ] Integration tests with mock Django
- [ ] Concurrent sync + voting test
- [ ] Failure recovery test
- [ ] End-to-end test

### Monitoring
- [ ] Sync logs stored in membership_sync_log
- [ ] Alerts for sync failures
- [ ] Alerts for membership changes
- [ ] Dashboard showing sync status

### Documentation
- [ ] Admin guide for manual sync
- [ ] Troubleshooting guide
- [ ] API documentation
- [ ] Django integration guide

---

## Timeline

| Week | Milestone | Status |
|------|-----------|--------|
| Week 1 | Database schema + sync service setup | Planned |
| Week 2 | Integration with Elections/Events | Planned |
| Week 3 | Testing + monitoring setup | Planned |
| Week 4 | Documentation + polish | Planned |

---

## Related Issues

- #88-#92: Token generation and membership requirements
- #80-#82: Audit logging for admin operations
- #84: Database migration for elections

---

**Last Updated**: 2025-10-22
**Author**: Phase 5 Planning
**Status**: 🟡 Ready for Implementation
