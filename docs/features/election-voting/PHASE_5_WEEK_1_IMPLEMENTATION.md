# Phase 5 Week 1 Implementation Plan - Epic #24

**Epic**: Admin Election Lifecycle Management (#24)
**Branch**: `feature/epic-24-admin-lifecycle`
**Duration**: 1 week (5 business days)
**Status**: 🟡 Ready to Start
**Target**: Complete API skeleton + database migrations by end of Week 1

---

## Week 1 Overview

Week 1 focuses on **backend infrastructure** that all other Phase 5 features depend on:

1. **Database Migrations** - Add admin audit logging and status tracking columns
2. **Admin API Skeleton** - Implement remaining endpoints with proper error handling
3. **Audit Logging** - Complete audit trail infrastructure
4. **Testing Infrastructure** - Unit tests and smoke tests

By end of Week 1:
- ✅ Database schema complete and verified
- ✅ All admin endpoints implemented and tested
- ✅ Audit logging functional
- ✅ Ready for Epic #43 (Membership Sync) integration
- ✅ Ready for Epic #87 (Member UI) integration

---

## Daily Breakdown

### Monday - Database & Schema Preparation

**Objective**: Complete database schema setup and verification

**Tasks**:

1. **Review Current Schema** (30 min)
   ```bash
   # Examine current elections schema
   psql "$DEV_CONN_URI" -c "SELECT * FROM information_schema.columns WHERE table_schema = 'elections' ORDER BY table_name, ordinal_position;"

   # Document current state
   cat > /tmp/elections_schema_baseline.sql << 'EOF'
   SELECT
     table_name,
     column_name,
     data_type,
     is_nullable,
     column_default
   FROM information_schema.columns
   WHERE table_schema = 'elections'
   ORDER BY table_name, ordinal_position;
   EOF
   ```

2. **Create Migration SQL** (2 hours)
   - Create `services/events/migrations/005_admin_audit_logging.sql`
   - Add columns to elections table:
     - `admin_id` (VARCHAR 255) - Firebase UID
     - `voting_start_time` (TIMESTAMP) - When voting begins
     - `voting_end_time` (TIMESTAMP) - When voting ends
     - `published_at` (TIMESTAMP) - Results publication time
     - `created_by` (VARCHAR 255) - Creator's Firebase UID
   - Create `admin_audit_log` table
   - Add indexes for admin queries

3. **Test Migration Locally** (1 hour)
   ```bash
   # Connect to dev database
   export DEV_CONN_URI="postgresql://postgres:password@localhost:5432/ekklesia_dev"

   # Run migration
   psql "$DEV_CONN_URI" -f services/events/migrations/004_move_to_elections_schema.sql
   psql "$DEV_CONN_URI" -f services/events/migrations/005_admin_audit_logging.sql

   # Verify
   psql "$DEV_CONN_URI" -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'elections' ORDER BY ordinal_position;"
   ```

4. **Document Schema Changes** (30 min)
   - Update `docs/features/election-voting/DATABASE_SCHEMA.md`
   - Add ER diagram
   - Document migration timeline

**Deliverables**:
- [ ] Migration file: `services/events/migrations/005_admin_audit_logging.sql`
- [ ] Schema documentation updated
- [ ] Migration tested on dev environment
- [ ] Commit: "Add admin audit logging schema migration"

---

### Tuesday - API Endpoints Implementation

**Objective**: Complete admin API endpoint implementation

**Current Status Analysis**:
- ✅ `POST /api/admin/elections` - Create election (implemented)
- ✅ `GET /api/admin/elections` - List elections (implemented)
- ✅ `GET /api/admin/elections/:id` - Get election (implemented)
- ✅ `PATCH /api/admin/elections/:id/draft` - Edit draft (implemented)
- ✅ `POST /api/admin/elections/:id/publish` - Publish election (implemented)
- ✅ `POST /api/admin/elections/:id/close` - Close voting (implemented)
- ✅ `POST /api/admin/elections/:id/pause` - Pause voting (implemented)
- ✅ `POST /api/admin/elections/:id/resume` - Resume voting (implemented)
- ✅ `POST /api/admin/elections/:id/archive` - Archive (implemented)
- ✅ `DELETE /api/admin/elections/:id` - Soft delete (implemented)
- ⏳ `POST /api/admin/elections/:id/open` - Open voting (NEEDS IMPLEMENTATION)
- ⏳ `GET /api/admin/elections/:id/status` - Election statistics (NEEDS IMPLEMENTATION)
- ⏳ `GET /api/admin/elections/:id/results` - Results summary (NEEDS IMPLEMENTATION)
- ⏳ `GET /api/admin/elections/:id/tokens` - Token distribution (NEEDS IMPLEMENTATION)

**Tasks**:

1. **Implement POST /api/admin/elections/:id/open** (2 hours)
   ```javascript
   // Transitions: draft → open
   // Actions:
   // 1. Fetch eligible members from membership table
   // 2. Generate voting tokens for each member
   // 3. Store tokens in elections.voting_tokens
   // 4. Update election status
   // 5. Log audit event

   router.post('/elections/:id/open', async (req, res) => {
     // TODO: Implementation
     // See: EPIC_24_ADMIN_LIFECYCLE.md for detailed spec
   });
   ```

2. **Implement GET /api/admin/elections/:id/status** (1.5 hours)
   ```javascript
   // Returns:
   // - Election metadata
   // - Current status
   // - Voting period info
   // - Member counts (eligible, voted, not voted)
   // - Token generation time
   // - Last updated timestamp
   ```

3. **Implement GET /api/admin/elections/:id/results** (2 hours)
   ```javascript
   // Returns:
   // - Question text
   // - Vote counts by answer
   // - Percentage breakdown
   // - Total votes cast
   // - Eligible voters
   // - Participation rate
   ```

4. **Implement GET /api/admin/elections/:id/tokens** (1 hour)
   ```javascript
   // Returns:
   // - Total tokens generated
   // - Tokens used (ballots cast)
   // - Tokens unused
   // - Tokens expired
   // - Distribution timeline
   ```

5. **Error Handling Improvements** (1 hour)
   - Add proper error messages for all endpoints
   - Validate election status transitions
   - Prevent invalid operations (e.g., publishing draft)

**Deliverables**:
- [ ] All admin endpoints implemented and functional
- [ ] Request/response schemas documented
- [ ] Error handling complete
- [ ] Commit: "Implement admin statistics and token management endpoints"

---

### Wednesday - Audit Logging Implementation

**Objective**: Complete audit logging infrastructure

**Current Status**:
- ⏳ Database table created (`admin_audit_log`)
- ⏳ Audit logging middleware needs implementation
- ⏳ All endpoints need audit integration

**Tasks**:

1. **Create Audit Logging Middleware** (1.5 hours)
   ```javascript
   // File: services/events/src/middleware/auditLog.js
   // Logs all admin actions:
   // - Admin UID
   // - Action type (create/update/open/close/publish)
   // - Election ID
   // - Changes made (before/after diff)
   // - Timestamp
   // - IP address (masked for privacy)
   ```

2. **Integrate Audit Logging to Endpoints** (2 hours)
   - Wrap each POST/PATCH/DELETE operation
   - Log successful changes
   - Log failed attempts with error reason
   - Example:
     ```javascript
     await logAdminAction(req.user.uid, 'create_election', {
       election_id: result.rows[0].id,
       title: req.body.title,
       created_at: new Date().toISOString()
     });
     ```

3. **Create Audit Log Query Endpoints** (1.5 hours)
   ```javascript
   // GET /api/admin/elections/:id/audit
   // Lists all actions taken on election
   // Role: meeting_election_manager, developer only
   // Returns: Array of audit events with timestamps
   ```

4. **Documentation** (30 min)
   - Document audit logging schema
   - Create troubleshooting guide
   - Document retention policy (30 days default)

**Deliverables**:
- [ ] Audit logging middleware implemented
- [ ] All endpoints integrated with audit logging
- [ ] Audit query endpoint working
- [ ] Commit: "Add comprehensive audit logging for all admin operations"

---

### Thursday - Testing & Integration

**Objective**: Complete testing and prepare for integration with other epics

**Tasks**:

1. **Unit Tests** (2 hours)
   ```javascript
   // File: services/events/src/routes/__tests__/admin.test.js
   // Tests:
   // - Creating election with valid data
   // - Rejecting invalid data (missing fields, wrong types)
   // - Authorization checks (non-admins rejected)
   // - Status transitions (draft → open → closed)
   // - Audit log creation for each action
   ```

2. **Integration Tests** (2 hours)
   ```bash
   # Test full election lifecycle:
   # 1. Create election
   # 2. Verify in draft status
   # 3. Open voting (generate tokens)
   # 4. Check token count matches eligible members
   # 5. Close voting
   # 6. Publish results
   # 7. Verify audit log complete
   ```

3. **Load Testing** (1 hour)
   - Test with 100 eligible members
   - Test with 1000 eligible members
   - Measure token generation performance
   - Document any bottlenecks

4. **Documentation** (1 hour)
   - Write API documentation for each endpoint
   - Create cURL examples
   - Document error responses

**Deliverables**:
- [ ] Unit tests all passing
- [ ] Integration tests all passing
- [ ] Load test results documented
- [ ] Commit: "Add comprehensive tests for admin endpoints"

---

### Friday - Integration & Sprint Close

**Objective**: Prepare for Epic #43 integration and close out Week 1

**Tasks**:

1. **Integration Readiness** (1.5 hours)
   - Review Epic #43 (Membership Sync) requirements
   - Identify dependencies: Does Epic #24 need Epic #43 data?
   - Plan handoff: How do endpoints communicate?
   - Document assumptions about membership table structure

2. **Documentation** (1.5 hours)
   - Update [PHASE_5_OVERVIEW.md](../../roadmap/PHASE_5_OVERVIEW.md)
   - Document Week 1 completion
   - Create Week 2 plan
   - Update epic status in EPIC_24_ADMIN_LIFECYCLE.md

3. **Code Review Preparation** (1 hour)
   - Ensure all code follows project style guide
   - Run linter and fix issues
   - Prepare commit messages

4. **Deploy to Dev** (30 min)
   ```bash
   # Merge all Week 1 changes to dev environment
   git push origin feature/epic-24-admin-lifecycle

   # Deploy to Cloud Run dev environment
   gcloud run deploy events-service-dev \
     --source=services/events \
     --region=europe-west2 \
     --project=ekklesia-dev-2025
   ```

**Deliverables**:
- [ ] All Week 1 code merged and tested
- [ ] Integration plan documented
- [ ] Dev environment updated
- [ ] Documentation complete
- [ ] Sprint closed with summary

---

## Testing Strategy

### Unit Tests
- Location: `services/events/src/routes/__tests__/`
- Framework: Jest + Supertest
- Coverage: >90% for admin endpoints
- Command: `npm run test:admin`

### Integration Tests
- Full election lifecycle
- Multiple user roles
- Concurrent operations
- Error conditions

### Load Tests
- 100+ members
- Measure token generation time
- API response times under load

### Security Tests
- Verify admin-only access enforcement
- Test invalid role rejection
- Test SQL injection prevention
- Test request validation

---

## Success Criteria

### Week 1 Completion Checklist

**Database** ✅
- [ ] Schema migration created and tested
- [ ] All columns added to elections table
- [ ] admin_audit_log table created
- [ ] Indexes created for performance
- [ ] Migration file committed

**API Endpoints** ✅
- [ ] POST /api/admin/elections/:id/open implemented
- [ ] GET /api/admin/elections/:id/status implemented
- [ ] GET /api/admin/elections/:id/results implemented
- [ ] GET /api/admin/elections/:id/tokens implemented
- [ ] All endpoints return correct data format
- [ ] All endpoints validate authorization

**Audit Logging** ✅
- [ ] Middleware created
- [ ] All endpoints integrated
- [ ] Audit queries working
- [ ] Retention policy documented

**Testing** ✅
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Load testing complete
- [ ] 90%+ code coverage

**Documentation** ✅
- [ ] API endpoints documented
- [ ] Error responses documented
- [ ] cURL examples provided
- [ ] Week 2 plan created

---

## Dependencies & Blockers

### Internal Dependencies
- **Database Schema Migration**: Must complete Monday
- **Elections table exists**: ✅ Already in place
- **Voting tokens table exists**: ✅ Already in place
- **Members table structure**: Needed for Epic #43

### External Dependencies
- **Django backend API**: Needed for membership sync (Epic #43)
- **Firebase setup**: ✅ Already complete
- **Cloud SQL access**: ✅ Already available

### Potential Blockers
1. **Membership table schema** - If Epic #43 defines different structure, will need coordination
   - *Resolution*: Review Epic #43 spec; coordinate with Epic #43 lead

2. **Token generation performance** - If 1000+ members, might need optimization
   - *Resolution*: Implement batch token generation; consider async job queue

3. **Admin role definition** - If roles differ from Kenni.is backend
   - *Resolution*: Verify role claims in Firebase tokens

---

## Development Environment Setup

### Prerequisites
```bash
# Ensure you have:
- Node.js 18+
- PostgreSQL client tools (psql)
- Docker (for local database)
- Cloud SQL Proxy (for dev environment)
```

### Local Setup
```bash
# 1. Start Cloud SQL Proxy
./cloud-sql-proxy.linux.amd64 -dir=/tmp/cloudsql ekklesia-prod-10-2025:europe-west2:ekklesia-db &

# 2. Connect to dev environment
export DEV_CONN_URI="postgresql://postgres:password@localhost:5432/ekklesia_dev"

# 3. Install dependencies
cd services/events
npm install

# 4. Run migrations
npm run migrate:dev

# 5. Start development server
npm run dev
```

### Testing Local API
```bash
# Health check
curl http://localhost:8080/health

# List elections (requires auth token)
curl -H "Authorization: Bearer $FIREBASE_TOKEN" http://localhost:8080/api/admin/elections

# Create election
curl -X POST http://localhost:8080/api/admin/elections \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Election", "question": "Your choice?", "answers": ["Yes", "No"]}'
```

---

## Code Style & Standards

- **JavaScript**: ESLint rules enforced (see `.eslintrc.js`)
- **Async/Await**: Prefer over callbacks/promises
- **Error Handling**: Try/catch with proper HTTP status codes
- **Logging**: JSON structured logs with correlation IDs
- **SQL**: Parameterized queries only (prevent SQL injection)

---

## Communication & Escalation

**Daily Stand-up**: 10:00 UTC
- What did you complete?
- What are you working on?
- Any blockers?

**Status Updates**:
- Update epic status daily in Slack
- Report progress in Friday sprint review
- Escalate blockers immediately

**Code Review**:
- All PRs require review from 1 other team member
- Use semantic commits: `feat:`, `fix:`, `test:`, `docs:`
- Reference issue numbers in commit messages

---

## Next Steps (Week 2 Preview)

After Week 1, you'll move to:
1. **API Integration with Frontend** (Epic #87)
2. **Membership Sync Service** (Epic #43) - May start in parallel
3. **Full Integration Testing**
4. **Load Testing & Optimization**

The API you build this week will be the foundation for everything else.

---

**Epic Status**: 🟡 Week 1 Ready to Start
**Last Updated**: 2025-10-22
**Branch**: `feature/epic-24-admin-lifecycle`
