# Epic #24: Admin Election Lifecycle Management

**Epic ID**: #24
**Status**: 🟡 In Planning
**Target Release**: Phase 5 (November 2025)
**Priority**: HIGH (Required for member-facing voting features)

---

## Overview

Epic #24 implements the complete admin lifecycle for elections - allowing administrators to create, configure, schedule, open, close, and publish results for elections. This is the backend infrastructure required for all member-facing voting features (Epic #87).

## Problem Statement

Currently, the system has:
- ✅ Members authentication (Kenni.is + Firebase)
- ✅ Voting infrastructure (Elections service)
- ❌ **No admin interface for election lifecycle**
- ❌ **No way to create elections**
- ❌ **No way to manage election timing**

This means elections must be created manually in the database. Phase 5 requires a complete admin API.

---

## Goals

### Primary Goals
1. **Create Elections API** - Full CRUD operations for elections
2. **Role-Based Access Control** - Restrict to admin role only
3. **Election State Management** - Voting open/closed/published states
4. **Results Management** - Calculate and publish results
5. **Audit Logging** - Complete trail of admin actions

### Secondary Goals
1. **Admin Web UI** (Phase 5.5) - User-friendly admin dashboard
2. **Bulk Operations** - Create multiple elections at once
3. **Election Templates** - Reusable election configurations
4. **Notifications** - Alert members when voting opens

---

## Acceptance Criteria

### Must Have (MVP)
- [ ] Admin can create election with title, description, questions
- [ ] Admin can set voting start/end times
- [ ] Admin can open voting (generate member eligibility list)
- [ ] Admin can close voting (stop accepting ballots)
- [ ] Admin can publish results (make results visible to members)
- [ ] All operations logged to audit trail
- [ ] Role-based access control (admin only)
- [ ] Firestore security rules enforce admin restriction

### Should Have (Phase 5)
- [ ] Admin can edit election before voting starts
- [ ] Admin can cancel election (delete before voting starts)
- [ ] Admin can regenerate token list (if members added)
- [ ] Email notification when voting opens
- [ ] Email notification when voting closes

### Nice to Have (Phase 5.5+)
- [ ] Web UI for admin dashboard
- [ ] Bulk import elections from CSV
- [ ] Election templates
- [ ] Schedule elections for future
- [ ] Automatic notification triggers

---

## Technical Specification

### API Endpoints (Events Service)

#### Election CRUD
```
POST   /api/admin/elections              Create election
GET    /api/admin/elections              List all elections
GET    /api/admin/elections/:id          Get election details
PATCH  /api/admin/elections/:id          Update election (before voting)
DELETE /api/admin/elections/:id          Delete election (before voting)
```

#### Election Lifecycle
```
POST   /api/admin/elections/:id/open     Open voting (generate tokens)
POST   /api/admin/elections/:id/close    Close voting (stop ballots)
POST   /api/admin/elections/:id/publish  Publish results
```

#### Admin Queries
```
GET    /api/admin/elections/:id/status   Election state and stats
GET    /api/admin/elections/:id/tokens   Token distribution stats
GET    /api/admin/elections/:id/results  Results summary
```

### Database Schema Changes

#### Elections Table Extension
```sql
ALTER TABLE elections ADD COLUMN (
  admin_id VARCHAR(255) NOT NULL,        -- Firebase UID of admin
  status VARCHAR(50) DEFAULT 'draft',    -- draft/open/closed/published
  voting_start_time TIMESTAMP,           -- When voting begins
  voting_end_time TIMESTAMP,             -- When voting ends
  published_at TIMESTAMP,                -- When results published
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Audit table
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id SERIAL PRIMARY KEY,
  admin_id VARCHAR(255) NOT NULL,
  action VARCHAR(255),                   -- create/update/open/close/publish
  election_id INT,
  details JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

### Security Requirements

1. **Authentication**: Firebase custom token with admin role claim
2. **Authorization**: Firestore security rules + endpoint-level checks
3. **Audit Logging**: All admin actions logged with admin ID and timestamp
4. **Rate Limiting**: 100 requests/10 sec per admin (Cloudflare)
5. **Input Validation**: Schema validation for all inputs
6. **Error Handling**: No PII in error messages, graceful failures

### Firestore Security Rules

```javascript
match /admins/{document=**} {
  allow read, write: if request.auth != null &&
    request.auth.token.roles.contains('admin');
}
```

---

## Implementation Plan

### Phase 5a: Backend Infrastructure (Week 1-2)
1. **Database Schema Migration** (#84)
   - Add admin-specific columns to elections table
   - Create admin_audit_log table
   - Create indexes for admin queries

2. **Admin API Implementation** (#71-#79)
   - Create /api/admin/elections CRUD endpoints
   - Implement role-based access control
   - Add audit logging to all operations
   - Add security validations

3. **Token Generation** (#88)
   - Implement member eligibility check
   - Generate voting tokens for election
   - Store token metadata for tracking

### Phase 5b: Integration & Testing (Week 2-3)
1. **Elections Service Integration**
   - Update Elections service to accept tokens from token generation
   - Implement /api/s2s/results endpoint for admin query

2. **End-to-End Testing**
   - Test complete election lifecycle
   - Test role-based access control
   - Test audit logging
   - Load testing with 300+ members

### Phase 5c: UI & Documentation (Week 3-4)
1. **Admin Web UI** (if time permits)
   - Dashboard showing all elections
   - Create/Edit election forms
   - Election status and statistics

2. **Documentation**
   - API documentation (OpenAPI/Swagger)
   - Admin guide (how to create and manage elections)
   - Troubleshooting guide

---

## Related Epics

| Epic | Title | Dependency | Status |
|------|-------|-----------|--------|
| #87 | Member Election Discovery | **Depends on #24** | Planned |
| #43 | Membership Sync (Django) | **Depends on #24** | Planned |
| #88 | Token Generation for Elections | **Depends on #24** | Planned |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-----------|--------|-----------|
| Database migration fails | Low | High | Test migration in staging first |
| Role-based access control bypass | Very Low | Critical | Security review + penetration testing |
| Audit log performance impact | Low | Medium | Implement log rotation + archival |
| Admin UI complexity | Medium | Medium | Start with CLI commands, add UI later |

---

## Success Criteria

- [ ] Admin can create, read, update, delete elections
- [ ] Admin can open voting (generate tokens for members)
- [ ] Admin can close voting and publish results
- [ ] All operations logged to audit trail
- [ ] Role-based access control enforced
- [ ] End-to-end test passes (create → vote → results)
- [ ] Load test passes (100+ concurrent members)
- [ ] Documentation complete

---

## Questions for Opus/Team

1. **Admin Role Assignment**: How will admins get the admin role claim?
   - Option A: Manual Firebase Console
   - Option B: CLI command (scripts/admin/set-admin-role.js)
   - Option C: Self-service from admin panel

2. **Token Generation Timing**: When should voting tokens be generated?
   - Option A: When admin opens voting (immediate)
   - Option B: One hour before voting opens (advance prep)
   - Option C: Configurable by admin per election

3. **Results Publication**: Should results be automatic or manual?
   - Option A: Manual - admin explicitly publishes
   - Option B: Automatic - published when voting closes
   - Option C: Scheduled - published at specified time

4. **Member Eligibility**: How often should membership be synced?
   - Option A: Every election (slow, authoritative)
   - Option B: Daily background job (fast, eventual consistency)
   - Option C: On-demand from admin action

---

## Implementation Checklist

### Database
- [ ] Schema migration script written and tested
- [ ] Indexes created for admin queries
- [ ] Rollback procedure documented

### API Endpoints
- [ ] POST /api/admin/elections (create)
- [ ] GET /api/admin/elections (list)
- [ ] GET /api/admin/elections/:id (get)
- [ ] PATCH /api/admin/elections/:id (update)
- [ ] DELETE /api/admin/elections/:id (delete)
- [ ] POST /api/admin/elections/:id/open (open voting)
- [ ] POST /api/admin/elections/:id/close (close voting)
- [ ] POST /api/admin/elections/:id/publish (publish results)

### Security
- [ ] Firestore rules enforcing admin-only access
- [ ] Input validation on all endpoints
- [ ] Error handling without PII leakage
- [ ] Audit logging on all operations
- [ ] Rate limiting tested

### Testing
- [ ] Unit tests for all endpoints
- [ ] Integration tests with Elections service
- [ ] Role-based access control tests
- [ ] Load testing (100+ concurrent)
- [ ] End-to-end test (create → vote → results)

### Documentation
- [ ] API documentation (OpenAPI spec)
- [ ] Admin guide (step-by-step)
- [ ] Troubleshooting guide
- [ ] Architecture decisions documented

---

## Timeline

| Week | Milestone | Status |
|------|-----------|--------|
| Week 1 | Database schema + API skeleton | Planned |
| Week 2 | Full API implementation + tests | Planned |
| Week 3 | Integration testing + load testing | Planned |
| Week 4 | Documentation + nice-to-haves | Planned |

---

## Related Issues

- #71-#79: Admin API endpoints
- #80-#82: Audit logging and election schema
- #84: Database migration for elections
- #88-#92: Token generation and membership sync

---

**Last Updated**: 2025-10-22
**Author**: Phase 5 Planning
**Status**: 🟡 Ready for Implementation
