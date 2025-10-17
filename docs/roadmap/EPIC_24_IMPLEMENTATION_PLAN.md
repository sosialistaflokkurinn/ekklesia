# Epic #24: Election Management (Admin) - Implementation Plan

**Epic:** [#24](https://github.com/sosialistaflokkurinn/ekklesia/issues/24)  
**Total Tasks:** 15 issues (#71-#85)  
**Estimated Effort:** 40h (10h + 12h + 8h + 10h weekly breakdown)  
**Team Capacity:** 20h/week → 4-week delivery  
**Status:** Foundation Ready (Phase 1 unblocked)

---

## 📦 Epic Dependencies

### Depends On:
- ✅ **Epic #1** (Platform Bootstrap) - 85% complete, infrastructure operational
  - GCP project, Cloud Run, Cloud SQL, Firebase Auth all working
- ✅ **Epic #2** (Member Core) - Authentication and profiles working
  - Firebase Auth integration complete, member verification operational

### Independent Of:
- ⚪ **Epic #3a** (Elections - Member Experience) - Can be implemented in parallel
  - User stories #25, #26, #27 (member-facing features) not required for admin API

### Enables:
- **Epic #3a completion** - Once elections can be created dynamically via admin API, members can view/vote on them
- **Future election types** - Foundation supports multiple election formats beyond Prófunarkosning

---

## 📚 Related Documentation

### Read Before Starting:
- [docs/guides/ROLES_AND_PERMISSIONS.md](../guides/ROLES_AND_PERMISSIONS.md) - Current RBAC model and role definitions
- [docs/SYSTEM_ARCHITECTURE_OVERVIEW.md](../SYSTEM_ARCHITECTURE_OVERVIEW.md) - System architecture and service interactions
- [docs/design/EVENTS_SERVICE_MVP.md](../design/EVENTS_SERVICE_MVP.md) - Events service design and current state
- [docs/DATABASE_REFERENCE.md](../DATABASE_REFERENCE.md) - Database schema reference

### Will Be Created:
- `docs/guides/AUDIT_LOGGING.md` - Audit log format and query patterns (Issue #82)
- `docs/api/ADMIN_ENDPOINTS.md` - Admin API endpoint documentation (Issues #71-79)

### Testing Reference:
- [docs/testing/END_TO_END_VOTING_FLOW_TEST.md](../testing/END_TO_END_VOTING_FLOW_TEST.md) - Existing E2E test (will be extended by #85)

---

## 📋 Task Breakdown by Priority

### 🔥 Critical Blocker (Priority: Critical)
**Must complete FIRST - blocks all admin endpoints:**

- **#83** - RBAC policy finalization & enforcement - A12 (3h) ⚠️ **START HERE**
  - Implement `requireRole()` and `requireAnyRoles()` middleware
  - Apply to all admin endpoints
  - Document role permissions matrix in `docs/guides/ROLES_AND_PERMISSIONS.md`

---

### ⚙️ Foundation (Priority: High)
**Can be done in PARALLEL with #83:**

- **#80** - Eligibility rules schema - A10 (2h)
  - Design database schema for dynamic eligibility rules
  - Support: member status, join date, age restrictions, custom SQL
  
- **#81** - Questions & ballot schema - A9 (2h)
  - Design schema for questions, options, ballot structure
  - Support: multiple questions per election, ranking options
  
- **#82** - Audit logging format & policy - A12 partial (2h)
  - Define structured JSON format for admin actions
  - Document Cloud Logging query patterns
  - Create helper functions for audit log generation

---

### 🔄 Migration (Priority: High)
**Required before dynamic elections:**

- **#84** - Migrate hardcoded election to database (2-3h)
  - Convert `Prófunarkosning 2025` from `electionService.js` to database record
  - Update `getCurrentElection()` to query database
  - Add SQL migration script to `elections/migrations/`
  - **Depends on:** #81 (ballot schema)
  - **Acceptance Criteria:**
    - Hardcoded election exists in `elections` table
    - E2E voting flow still works
    - SQL migration script committed

---

### ✅ Comprehensive Testing (Priority: High)
**End-to-end validation:**

- **#85** - E2E admin lifecycle tests - A12 partial (6-8h)
  - **RBAC test matrix:** 11 endpoints × 4 roles = 44 tests
    - Roles: Super Admin, Election Admin, Moderator, Authenticated User
    - Endpoints: Create, Edit, Preview, Publish, Pause, Resume, Close, Archive, Delete, List
  - **Happy path test:** Full lifecycle (draft → published → closed → archived)
  - **10 error scenarios:**
    - Invalid eligibility rules syntax
    - Publishing with incomplete ballot
    - Editing published election (should fail)
    - Deleting published election (should fail)
    - etc.
  - **Performance test:** Create 100 elections via API (< 5s)
  - **Depends on:** #71-#81, #83

---

### 🛠️ Core CRUD (Priority: Medium)
**Foundation for all lifecycle operations:**

- **#71** - Create draft - A1 (3h)
  - POST `/api/admin/elections`
  - Create election in `draft` state
  - **Depends on:** #81 (ballot schema), #83 (RBAC), #84 (migration)
  
- **#72** - Edit draft - A2 (2h)
  - PATCH `/api/admin/elections/:id`
  - Only allow editing in `draft` state
  - **Depends on:** #71, #83
  
- **#79** - Preview - A3 (2h)
  - GET `/api/admin/elections/:id/preview`
  - Read-only view with validation warnings
  - **Depends on:** #71, #81, #83

---

### 🚀 Lifecycle Management (Priority: Medium)
**Election state transitions:**

- **#73** - Publish - A4 (2h)
  - POST `/api/admin/elections/:id/publish`
  - Validate: ballot complete, eligibility rules valid, dates logical
  - **Depends on:** #71, #72, #84, #83
  
- **#75** - Pause/Resume - A5 (2h)
  - POST `/api/admin/elections/:id/pause`
  - POST `/api/admin/elections/:id/resume`
  - **Depends on:** #73, #83
  
- **#74** - Close - A6 (1.5h)
  - POST `/api/admin/elections/:id/close`
  - Mark election as closed (voting ended)
  - **Depends on:** #73, #83
  
- **#76** - Archive - A7 (1.5h)
  - POST `/api/admin/elections/:id/archive`
  - Move to archive (hidden from main list)
  - **Depends on:** #74, #83
  
- **#77** - Delete draft - A8 (1.5h)
  - DELETE `/api/admin/elections/:id`
  - Only allow deleting `draft` elections
  - **Depends on:** #71, #83

---

### 📊 Admin Views (Priority: Low)
**Utilities for admin users:**

- **#78** - List/filter admin view - A11 (3h)
  - GET `/api/admin/elections?status=...&sort=...`
  - Support pagination, filtering, sorting
  - **Depends on:** #71-#77, #83

---

## 📅 4-Week Implementation Roadmap

### Week 1 - Foundation (10h dev time, 6h elapsed with parallel work)
**Goal:** RBAC enforced, schemas finalized, audit format documented

#### Parallel Track A: RBAC (Critical Path)
- **Mon-Tue:** RBAC policy review meeting (planning, not counted in dev hours)
- **Wed-Thu:** #83 - Implement `requireRole`/`requireAnyRoles` middleware (3h)
- **Fri:** Apply middleware to test endpoint, verify enforcement (1h)
- **Track A total: 4h**

#### Parallel Track B: Schemas
- **Mon-Tue:** #80, #81 - Schema design sessions (4h)
  - #80: Eligibility rules schema (2h)
  - #81: Ballot/questions schema (2h)
- **Wed:** #82 - Document audit log format (2h)
- **Track B total: 6h**

**Week 1 Deliverable:** ✅ RBAC middleware ready, schemas finalized, audit format specified  
**Capacity note:** 10h sequential, 6h elapsed (Track B is bottleneck)

---

### Week 2 - Migration & Core CRUD (12h)
**Goal:** Can create and publish elections via API

- **Mon:** #84 - Migrate hardcoded election to database (3h)
  - Write migration SQL
  - Update `getCurrentElection()` to query DB
  - Verify E2E voting flow still works
  
- **Tue:** #71 - Create draft API (3h)
  - POST `/api/admin/elections` endpoint
  - Validation logic
  
- **Wed:** #72 - Edit draft API (2h)
  - PATCH `/api/admin/elections/:id`
  - State guard (only draft editable)
  
- **Thu:** #79 - Preview API (2h)
  - GET `/api/admin/elections/:id/preview`
  - Validation warnings
  
- **Fri:** #73 - Publish API (2h)
  - POST `/api/admin/elections/:id/publish`
  - Comprehensive validation

**Week 2 Deliverable:** ✅ Full CRUD operational, migration complete, can publish elections

---

### Week 3 - Lifecycle Management (8h)
**Goal:** Complete election lifecycle (pause, close, archive, delete)

**Note:** #74, #75, #77 can be parallelized if multiple developers available

- **Mon:** #75 - Pause/Resume API (2h)
  - POST `/api/admin/elections/:id/pause`
  - POST `/api/admin/elections/:id/resume`
  
- **Tue:** #74 - Close API (1.5h)
  - POST `/api/admin/elections/:id/close`
  
- **Wed:** #76 - Archive API (1.5h)
  - POST `/api/admin/elections/:id/archive`
  
- **Thu:** #77 - Delete draft API (1.5h)
  - DELETE `/api/admin/elections/:id`
  
- **Fri:** Developer smoke testing (1.5h) - informal prep for #85
  - Manual testing: draft → published → paused → resumed → closed → archived
  - Verify audit logs generated correctly

**Week 3 Deliverable:** ✅ Full lifecycle management operational

---

### Week 4 - Admin Views & Comprehensive Testing (10h)
**Goal:** Production-ready admin API with full test coverage

- **Mon:** #78 - List/filter admin view (3h)
  - GET `/api/admin/elections?status=...&sort=...`
  - Pagination, filtering, sorting
  
- **Tue-Fri:** #85 - E2E testing suite (7h)
  - **Day 1:** Happy path test (1h) + error scenario tests (2h)
  - **Day 2:** RBAC matrix tests (3h) - 44 test cases
  - **Day 3:** Performance tests (1h) - 100 elections
  - **Day 4:** Production deployment, smoke tests in production

**Week 4 Deliverable:** ✅ Production-ready admin API with full test coverage

**Total effort:** 10h + 12h + 8h + 10h = **40h** (matches realistic estimate)

---

## 🎯 Critical Path

The longest sequential dependency chain is:

```
Week 1: #83 (RBAC) + #80/#81 (schemas) [4h + 6h = 10h dev, 6h elapsed parallel]
          ↓              ↓
Week 2:  #84 (migration) [needs #81] (3h)
          ↓
Week 2:  #71 (create) [needs #81, #83, #84] (3h)
          ↓
Week 2:  #72 (edit) [needs #71] (2h)
          ↓
Week 2:  #73 (publish) [needs #71, #72, #84] (2h)
          ↓
Week 3:  #74 (close) [needs #73] (1.5h)
          ↓
Week 3:  #76 (archive) [needs #74] (1.5h)
          ↓
Week 4:  #78 (list) [needs #71-#77] (3h)
          ↓
Week 4:  #85 (tests) [needs all] (7h)
```

**Critical path:** 10 sequential tasks  
**Critical path time:** 6h (Week 1 elapsed) + 3h + 3h + 2h + 2h + 1.5h + 1.5h + 3h + 7h = **29h**  
**Parallel paths:** #75 (Pause/Resume) and #77 (Delete) can run alongside #74/#76 in Week 3  
**Total with buffer:** 40h (29h critical + 11h parallel/buffer = 38% buffer)

---

## ✅ Definition of Done

Epic #24 is complete when:

- [ ] **All 15 issues closed** (#71-#85)
- [ ] **RBAC middleware enforced** on all 11 admin endpoints
- [ ] **Audit logging operational** (Cloud Logging structured JSON)
- [ ] **Database schemas finalized:**
  - [ ] Eligibility rules schema (#80)
  - [ ] Questions & ballot schema (#81)
- [ ] **Migration complete:**
  - [ ] Hardcoded election exists in database
  - [ ] `getCurrentElection()` queries database
  - [ ] E2E voting flow verified
- [ ] **E2E tests passing:**
  - [ ] 44 RBAC tests (11 endpoints × 4 roles)
  - [ ] 10 error scenario tests
  - [ ] Performance test (100 elections < 5s)
- [ ] **Documentation complete:**
  - [ ] `docs/guides/ROLES_AND_PERMISSIONS.md` updated (RBAC matrix)
  - [ ] `docs/guides/AUDIT_LOGGING.md` created (log format + examples)
  - [ ] API documentation for 11 admin endpoints
- [ ] **Production deployment successful**
- [ ] **At least one real election created via admin API**
- [ ] **Monitoring configured:** admin action alerts in Cloud Logging

---

## 🚨 Risk Assessment

### 🔴 HIGH RISK

1. **RBAC not completed first (#83)**
   - **Risk:** If developers implement endpoints before RBAC is ready, security becomes afterthought
   - **Impact:** Security debt, potential privilege escalation vulnerabilities
   - **Mitigation:** Make #83 first priority (Critical), block all endpoint work until complete

2. **Schema not finalized (#80, #81)**
   - **Risk:** Cannot implement #71 (create election) without knowing database structure
   - **Impact:** Rework, wasted effort if schema changes mid-implementation
   - **Mitigation:** Complete schema design in Week 1 (parallel with #83)

### 🟡 MEDIUM RISK

3. **Migration not tested (#84)**
   - **Risk:** Hardcoded election may conflict with database-driven elections
   - **Impact:** E2E voting flow breaks after migration
   - **Mitigation:** Dedicated testing phase in #84, run E2E flow before/after

4. **No comprehensive E2E testing (#85)**
   - **Risk:** Individual tests pass but lifecycle has integration bugs
   - **Impact:** Production bugs, edge cases not caught
   - **Mitigation:** Dedicated Week 4 for testing, 44 RBAC tests + error scenarios

### 🟢 LOW RISK

5. **Time estimates optimistic**
   - **Risk:** 27h nominal may become 40h with reviews/debugging
   - **Impact:** Delivery delay by 1-2 weeks
   - **Mitigation:** 25% buffer built into plan (40h total, 4-week timeline)

---

## 🎬 Immediate Next Actions

### This Week:
1. **Schedule RBAC policy review meeting** (finalize role permissions matrix)
2. **Kick off schema design sessions** for #80 (eligibility) and #81 (ballot)
3. **Assign developers** to Week 1 tasks:
   - Developer A: #83 (RBAC) - critical path
   - Developer B: #80, #81 (schemas) - parallel work
   - Developer C: #82 (audit logging) - parallel work

### Week 1 Start:
1. **Implement #83 (RBAC middleware)** - **CRITICAL BLOCKER**
2. **Finalize #80, #81 (schemas)** - foundation work
3. **Document #82 (audit format)** - operational readiness

**Ready to start NOW:** #80, #81, #82, #83 (all unblocked) 🚀

---

## 📚 User Story Coverage

| Issue | User Story | Description | Hours | Dependencies |
|-------|------------|-------------|-------|--------------|
| #71 | A1 | Create election (draft) | 3h | #81, #83, #84 |
| #72 | A2 | Edit draft election | 2h | #71, #83 |
| #79 | A3 | Preview election (read-only) | 2h | #71, #81, #83 |
| #73 | A4 | Publish election | 2h | #71, #72, #84, #83 |
| #75 | A5 | Pause / resume election | 2h | #73, #83 |
| #74 | A6 | Close election | 1.5h | #73, #83 |
| #76 | A7 | Archive election | 1.5h | #74, #83 |
| #77 | A8 | Delete draft election | 1.5h | #71, #83 |
| #81 | A9 | Manage questions & ballot schema | 2h | - |
| #80 | A10 | Define eligibility rules | 2h | - |
| #78 | A11 | List & search elections (admin) | 3h | #71-#77, #83 |
| #82 | A12 | Audit logging (format & policy) | 2h | - |
| #83 | A12 | Access control (RBAC middleware) | 3h | - |
| #85 | A12 | Testing (E2E + deployment) | 7-8h | #71-#83 |
| #84 | - | Migration (bridge MVP → dynamic) | 3h | #81 |
| **Total** | **A1-A12** | **All user stories covered** | **39-40h** | - |

**Note:** User Story A12 (Enforce access control & audit logging) is implemented across three issues:
- #82 defines audit log format
- #83 implements RBAC middleware
- #85 validates both with comprehensive testing

✅ **100% coverage** - All 12 user stories from Epic #24 mapped to implementation tasks

---

## 📖 Related Documentation

- [Epic #24 - Election Management (Admin)](https://github.com/sosialistaflokkurinn/ekklesia/issues/24)
- [System Architecture Overview](../SYSTEM_ARCHITECTURE_OVERVIEW.md)
- [Database Reference](../DATABASE_REFERENCE.md)
- [Roles and Permissions Guide](../guides/ROLES_AND_PERMISSIONS.md)
- [Members Deployment Guide](../guides/MEMBERS_DEPLOYMENT_GUIDE.md)

---

**Last Updated:** October 16, 2025  
**Maintainer:** Development Team  
**Status:** Foundation Ready - Week 1 tasks (#80-#83) unblocked
