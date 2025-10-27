# Phase 5 Week 1 Master Implementation Plan

**Period**: October 28 - November 1, 2025
**Status**: 🟡 Ready to Launch
**Target**: Complete foundation for Epics #24, #43, and begin #87

---

## Executive Summary

Phase 5 Week 1 kicks off three parallel epics that will transform Ekklesia from infrastructure into a fully functional voting system:

- **Epic #24** (Admin Lifecycle): Backend API for election management
- **Epic #43** (Membership Sync): Hourly member synchronization service
- **Epic #87** (Member UI): Preparation for member voting interface

All three epics run **in parallel**, with careful dependency management.

---

## Pre-Phase 5 Checklist

**Target Completion**: Friday, October 25, 2025 (before Monday kickoff)

Complete these tasks before Phase 5 Week 1 starts to ensure smooth execution.

### Infrastructure Verification (Owner: DevOps)

- [ ] Verify all services healthy
  ```bash
  # Check Elections service
  curl -s https://elections-service-ymzrguoifa-nw.a.run.app/health | jq

  # Check Events service
  curl -s https://events-service-ymzrguoifa-nw.a.run.app/health | jq

  # Check Members service
  curl -s https://ekklesia-prod-10-2025.web.app/
  ```

- [ ] Confirm Cloud SQL accessible
  ```bash
  # Test connection
  gcloud sql instances describe ekklesia-db \
    --project=ekklesia-prod-10-2025

  # Verify backup schedule
  gcloud sql instances describe ekklesia-db \
    --project=ekklesia-prod-10-2025 \
    --format="value(settings.backupConfiguration)"
  ```

- [ ] Verify Firebase project access
  ```bash
  firebase projects:list
  firebase use ekklesia-prod-10-2025
  ```

- [ ] Test Cloud Scheduler permissions
  ```bash
  gcloud scheduler jobs list \
    --project=ekklesia-prod-10-2025
  ```

### External Dependencies (Owner: Project Manager)

- [ ] Confirm Django API endpoint availability
  - Endpoint: `[TBD - insert URL]`
  - Format: JSON array with `kennitala`, `name`, `email`, `phone`
  - Test: `curl -s [URL] | jq '.[0]'`

- [ ] Get API credentials for membership sync
  - API key or OAuth token needed
  - Store in Secret Manager (not in code!)

- [ ] Schedule Django team sync call
  - Date: Before Friday, October 25
  - Attendees: Epic #43 lead + Django backend lead
  - Agenda: API contract, rate limits, error handling

### Development Environment (Owner: Each Developer)

- [ ] Fix SessionStart hooks (if applicable)
  - File: `.claude/settings.local.json`
  - Update paths:
    - `docs/guides/workflows/` → `docs/development/guides/workflows/`
    - `docs/maintenance/` → `docs/operations/`
  - See: `/tmp/SESSION_HOOK_ERROR_ANALYSIS.md`

- [ ] Clone repository + fetch all branches
  ```bash
  git clone https://github.com/sosialistaflokkurinn/ekklesia.git
  cd ekklesia
  git fetch --all

  # Check out your epic branch
  git checkout feature/epic-24-admin-lifecycle  # or epic-43 or epic-87
  ```

- [ ] Install dependencies
  ```bash
  # For Elections/Events services
  cd services/elections  # or events
  npm install

  # For Members service
  cd services/members
  npm install
  cd functions
  npm install
  ```

- [ ] Test local development environment
  ```bash
  # Start local service
  npm run dev

  # Verify it runs without errors
  curl http://localhost:8080/health
  ```

### Database Preparation (Owner: Database Admin)

- [ ] Run migration dry-run on dev snapshot
  - See: `docs/status/ongoing/ELECTIONS_SCHEMA_MIGRATION_CHECKLIST.md`
  - SQL: `services/elections/migrations/004_move_to_elections_schema.sql`
  - Verify: No errors, transaction committed

- [ ] Verify backup schedule
  - Daily backups enabled
  - Retention: 7 days minimum
  - Test restore procedure documented

- [ ] Document rollback procedure
  ```bash
  # If migration fails, rollback command:
  git log services/elections/migrations/ --oneline -5

  # Restore from backup if needed:
  gcloud sql backups list \
    --instance=ekklesia-db \
    --project=ekklesia-prod-10-2025
  ```

### Team Preparation (Owner: Tech Lead)

- [ ] Review all epic plans
  - Epic #24: `docs/features/election-voting/PHASE_5_WEEK_1_IMPLEMENTATION.md`
  - Epic #43: `docs/features/election-voting/PHASE_5_WEEK_1_MEMBERSHIP_SYNC.md`
  - Epic #87: `docs/features/election-voting/PHASE_5_WEEK_1_MEMBER_UI.md`

- [ ] Assign epic leads
  - Epic #24 Lead: [Name]
  - Epic #43 Lead: [Name]
  - Epic #87 Lead: [Name]

- [ ] Schedule Week 1 kickoff meeting
  - Date: Monday, October 28, 2025 @ 09:00 UTC
  - Duration: 1 hour
  - Agenda:
    - Overview of Phase 5 goals
    - Epic introductions (10 min each)
    - Q&A + dependencies discussion
    - Confirm daily standup time (10:00 UTC)

### Success Criteria

All checklist items complete ✅ = Ready for Monday Phase 5 Week 1 kickoff!

---

## At a Glance

| Epic | Focus | Team Size | Dependencies | Status |
|------|-------|-----------|--------------|--------|
| **#24** | Admin API + database | 2 devs | Database schema | 🟡 Week 1 starts |
| **#43** | Membership sync svc | 2 devs | Django API | 🟡 Week 1 starts |
| **#87** | Member UI prep | 1 dev | Design mockups | 🟡 Prep phase |

### Timeline View
```
Week 1 (Oct 28 - Nov 1)
├─ Epic #24 (Admin API) ──────────────────────→ Week 4
├─ Epic #43 (Member Sync) ────────────────────→ Week 4
└─ Epic #87 (Member UI - Prep) → Week 2 (actual coding starts)

Week 2 (Nov 4 - 8)
├─ Epic #24 (Integration testing)
├─ Epic #43 (Django integration)
└─ Epic #87 (Implementation starts - using #24 & #43 APIs)
```

---

## Epic #24: Admin Election Lifecycle

**Objective**: Complete admin API for election management
**Lead**: [Assign]
**Team**: 2 developers
**Effort**: 4 weeks (Full implementation)

### Week 1 Focus
- ✅ Database schema migration
- ✅ Implement missing endpoints (open, status, results, tokens)
- ✅ Complete audit logging infrastructure
- ✅ Unit tests + integration tests

### Key Deliverables
- Migration SQL: `services/events/migrations/005_admin_audit_logging.sql`
- Endpoints: `/api/admin/elections/:id/open`, `/status`, `/results`, `/tokens`
- Audit logging middleware integrated
- Test coverage >90%

### Resource Needs
- Cloud SQL dev access ✅
- Firebase project ✅
- GitHub actions for CI/CD ✅

### Documentation
- **Detailed Plan**: See `docs/features/election-voting/PHASE_5_WEEK_1_IMPLEMENTATION.md` (in feature/epic-24-admin-lifecycle branch)
- **Daily Breakdown**: Database (Mon), APIs (Tue), Audit (Wed), Testing (Thu), Integration (Fri)

---

## Epic #43: Membership Sync with Django Backend

**Objective**: Create membership synchronization service
**Lead**: [Assign]
**Team**: 2 developers
**Effort**: 4 weeks (Full implementation)

### Week 1 Focus
- ✅ Create membership-sync service scaffold
- ✅ Database schema for members + sync_log
- ✅ Django API client implementation
- ✅ Cloud Scheduler integration (staging)

### Key Deliverables
- New service: `services/membership-sync/`
- Tables: `public.members`, `public.sync_log`
- Django API client working
- Endpoints: `/sync`, `/sync/dry-run`, `/sync/status`, `/sync/logs`

### Resource Needs
- Django backend API endpoint (required by Friday)
- Cloud SQL dev access ✅
- Cloud Scheduler ✅

### Documentation
- **Detailed Plan**: See `docs/features/election-voting/PHASE_5_WEEK_1_MEMBERSHIP_SYNC.md` (in feature/epic-43-membership-sync branch)
- **Daily Breakdown**: Service setup (Mon-Tue), Django integration (Wed), Endpoints (Thu), Testing (Fri)

---

## Epic #87: Member Election Discovery & Voting Interface

**Objective**: Preparation for member voting UI
**Lead**: [Assign]
**Team**: 1 developer + 1 designer
**Effort**: 4 weeks (Full implementation, starts Week 2)

### Week 1 Focus (Preparation - NOT coding yet)
- ✅ UI mockups for 3 pages
- ✅ Component architecture design
- ✅ API integration planning
- ✅ Development environment setup

### Week 2+ Focus (After #24 & #43 foundation)
- Implementation of elections list page
- Voting form and confirmation
- Results display page

### Key Deliverables (Week 1)
- Design mockups (Figma/Sketch)
- Component hierarchy diagram
- API integration documentation
- Mock API for development

### Resource Needs
- Design tool (Figma) ✅
- React 18+ environment ✅
- Firebase auth ✅

### Documentation
- **Detailed Plan**: See `docs/features/election-voting/PHASE_5_WEEK_1_MEMBER_UI.md` (in feature/epic-87-election-discovery branch)
- **Focus**: Design (Mon-Tue), Architecture (Wed), API planning (Thu), Setup (Fri)

---

## Daily Timeline (Week 1)

### Monday, October 28

**Epic #24 (Admin API)**
- [ ] Review current schema
- [ ] Create migration SQL file
- [ ] Test migration locally

**Epic #43 (Membership Sync)**
- [ ] Create service directory structure
- [ ] Initialize Node.js project
- [ ] Create database schema migration

**Epic #87 (Member UI)**
- [ ] Designer: Create election list mockup
- [ ] Designer: Create voting page mockup
- [ ] Designer: Create results page mockup

### Tuesday, October 29

**Epic #24 (Admin API)**
- [ ] Implement `/api/admin/elections/:id/open` endpoint
- [ ] Implement `/api/admin/elections/:id/status` endpoint
- [ ] Implement `/api/admin/elections/:id/results` endpoint

**Epic #43 (Membership Sync)**
- [ ] Create Django API client class
- [ ] Implement member fetching logic
- [ ] Test Django API integration locally

**Epic #87 (Member UI)**
- [ ] Complete all mockups
- [ ] Create design system documentation
- [ ] Designer: Prepare for architecture review

### Wednesday, October 30

**Epic #24 (Admin API)**
- [ ] Implement `/api/admin/elections/:id/tokens` endpoint
- [ ] Create audit logging middleware
- [ ] Integrate audit logging into all endpoints

**Epic #43 (Membership Sync)**
- [ ] Create sync logic (delta calculation)
- [ ] Implement database update logic
- [ ] Add transaction handling

**Epic #87 (Member UI)**
- [ ] Developer: Document component architecture
- [ ] Developer: Create folder structure
- [ ] Developer: Plan state management

### Thursday, October 31

**Epic #24 (Admin API)**
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Load testing with 1000+ members
- [ ] Fix test failures

**Epic #43 (Membership Sync)**
- [ ] Create sync endpoints
- [ ] Implement Cloud Scheduler configuration
- [ ] Create dry-run endpoint
- [ ] Test endpoint authentication

**Epic #87 (Member UI)**
- [ ] Developer: Document API integration points
- [ ] Developer: Create mock API
- [ ] Developer: Set up development environment

### Friday, November 1

**Epic #24 (Admin API)**
- [ ] Code review preparation
- [ ] Sprint close documentation
- [ ] Deploy to dev environment
- [ ] Epic status update

**Epic #43 (Membership Sync)**
- [ ] API documentation
- [ ] Integration planning with #24
- [ ] Staging environment deployment
- [ ] Sprint close documentation

**Epic #87 (Member UI)**
- [ ] Team kickoff meeting
- [ ] Design approval
- [ ] Architecture documentation
- [ ] Sprint close + Week 2 planning

---

## Success Criteria for Week 1

### Epic #24 ✅
- [ ] All admin endpoints implemented
- [ ] Audit logging functional
- [ ] >90% test coverage
- [ ] Database migration tested
- [ ] Ready for integration with #87

### Epic #43 ✅
- [ ] Service created and deployable
- [ ] Django API client working
- [ ] Sync logic functional
- [ ] Database tables created
- [ ] Ready for production scheduling (Week 2+)

### Epic #87 ✅
- [ ] Design mockups complete
- [ ] Component architecture documented
- [ ] API integration plan detailed
- [ ] Dev environment ready
- [ ] Ready to start implementation Week 2

---

## Critical Dependencies

### External Dependencies
1. **Django Backend API** (for Epic #43)
   - **What**: Member list endpoint with pagination
   - **Format**: `{ "results": [{ "id", "kennitala", "name", "email" }] }`
   - **When Needed**: By Friday, Oct 31
   - **Blocker Risk**: HIGH - Affects Epic #43 testing
   - **Mitigation**: Mock API ready by Wednesday if real API not available

2. **Design Approval** (for Epic #87)
   - **What**: Sign-off on UI mockups
   - **When Needed**: By Friday, Nov 1
   - **Blocker Risk**: MEDIUM - Only delays #87 Week 2 start
   - **Mitigation**: Proceed with current mockups; revise if needed

### Internal Dependencies
1. **Epic #24 → Epic #87**
   - Epic #24 API must be working for Epic #87 to test voting
   - **Timeline**: Testing starts Week 2, when #24 foundation ready
   - **Risk**: LOW - Dependency well-managed

2. **Epic #43 → Epic #24**
   - Membership data required for token generation
   - **Timeline**: Both finish Week 1; coordinate Monday (deadline for member import)
   - **Risk**: LOW - Both teams aware

---

## Team Coordination

### Daily Stand-ups
- **Time**: 10:00 UTC
- **Duration**: 15 minutes
- **Format**: Quick status update + blockers
- **Attendees**: All 5 developers + project lead

### Weekly Sync (Friday)
- **Time**: 14:00 UTC
- **Duration**: 1 hour
- **Format**: Sprint review + next week planning
- **Attendees**: All team members + stakeholders

### Communication Channels
- **Slack**: #phase-5-epics (daily updates)
- **GitHub**: Issues for blockers, PRs for code review
- **GitHub Discussions**: Technical design questions

### Escalation Path
1. Blocker reported in standup
2. If unresolved in 2 hours: escalate to tech lead
3. If blocking entire team: escalate to project lead
4. Critical blockers: email + Slack notification

---

## Testing & Quality Gates

### Code Quality
- ESLint: All code must pass linting
- Unit tests: >90% coverage for new code
- Integration tests: All critical paths tested
- Code review: All PRs require 1 approval

### Performance
- API response time: <500ms (p95)
- Database queries: Optimized, <100ms (p95)
- Token generation: 1000 tokens/second minimum
- Sync operation: <5 minutes for 10,000 members

### Security
- SQL injection: Parameterized queries only
- Authentication: Firebase tokens verified
- Authorization: Role checks on all endpoints
- Audit logging: Complete trail of all actions
- Secrets: No secrets in code, use environment variables

---

## Risk Assessment

### High Risk
1. **Django API not ready** (Epic #43)
   - Impact: Cannot test membership sync with real data
   - Probability: MEDIUM
   - Mitigation: Mock API ready; plan to integrate real API Week 2

2. **Database performance** (Epic #24)
   - Impact: Admin API slow with large member counts
   - Probability: MEDIUM
   - Mitigation: Load test Friday; optimize indexes if needed

### Medium Risk
1. **Token generation speed** (Epic #24)
   - Impact: Cannot open elections with many members
   - Probability: LOW
   - Mitigation: Implement batching if needed

2. **Design delays** (Epic #87)
   - Impact: Week 2 implementation delayed
   - Probability: LOW
   - Mitigation: Start with current mockups; iterate

### Low Risk
1. **Team member absence**
   - Mitigation: Cross-training; pair programming setup
2. **Git conflicts**
   - Mitigation: Different feature branches; merge Monday before Phase 5 starts

---

## Resource Requirements

### Cloud Infrastructure
- ✅ Cloud SQL database (dev + prod)
- ✅ Cloud Run (for services)
- ✅ Cloud Scheduler (for sync jobs)
- ✅ Cloud Logging (for monitoring)
- ✅ Firebase project

### Development Tools
- ✅ GitHub (code repository)
- ✅ Node.js 18+ (environment)
- ✅ PostgreSQL client tools
- ✅ Figma (design tool)
- ✅ Jest (testing framework)

### Team Capacity
- 2 developers on Epic #24 (100% allocation)
- 2 developers on Epic #43 (100% allocation)
- 1 developer on Epic #87 (50% this week, 100% next week)
- 1 designer on Epic #87 (100% this week)
- 1 project lead (management only)

---

## What's Done Before Week 1

✅ Phase 4 complete (infrastructure stable)
✅ Repository restructured (services/ folder)
✅ Security hardening complete (8.5/10 rating)
✅ All documentation paths updated
✅ Three feature branches created:
  - feature/epic-24-admin-lifecycle
  - feature/epic-43-membership-sync
  - feature/epic-87-election-discovery
✅ Epic specifications complete (305, 546, 421 lines)

---

## What Happens After Week 1

### Week 2 (Nov 4-8)
- Epic #24: Integration testing, frontend API integration
- Epic #43: Django API integration, production scheduler
- Epic #87: Implementation starts (elections list page)

### Week 3 (Nov 11-15)
- Epic #24: Code complete, load testing
- Epic #43: Completed, monitoring setup
- Epic #87: Voting page + form implementation

### Week 4 (Nov 18-22)
- Epic #24: All testing complete, ready for UAT
- Epic #43: UAT + production deployment
- Epic #87: Results page, final testing

### Week 5+ (Post-Phase 5)
- UAT with stakeholders
- Bug fixes
- Production deployment
- Long-term maintenance

---

## Communication Channels

### Daily Communication (Developers)

**Standup Meeting**
- Time: 10:00 UTC (every weekday)
- Duration: 15 minutes
- Platform: Google Meet / Zoom / Slack Huddle
- Format:
  - What I did yesterday
  - What I'm doing today
  - Any blockers?

**Chat Channels**
- **#phase-5-development**: General development discussion
- **#phase-5-blockers**: Urgent blockers (tag @tech-lead)
- **#phase-5-epic-24**: Epic #24 specific discussion
- **#phase-5-epic-43**: Epic #43 specific discussion
- **#phase-5-epic-87**: Epic #87 specific discussion

**Response Time Expectations**
- Blockers: <1 hour response
- Questions: <4 hours response
- Code reviews: <24 hours response

### Weekly Communication (Full Team)

**Sprint Review**
- Time: Friday 14:00 UTC
- Duration: 1 hour
- Attendees: All developers + project manager
- Format:
  - Demo completed features
  - Review metrics (velocity, test coverage)
  - Identify blockers for next week

**Retrospective**
- Time: Friday 15:00 UTC
- Duration: 30 minutes
- Attendees: All developers
- Format:
  - What went well?
  - What could improve?
  - Action items for next sprint

**Sprint Planning**
- Time: Friday 15:30 UTC
- Duration: 30 minutes
- Attendees: All developers + tech lead
- Format:
  - Review next week's tasks
  - Assign work items
  - Confirm dependencies

### Ad-hoc Communication (As Needed)

**Code Review**
- Platform: GitHub Pull Requests
- Process:
  1. Create PR with clear description
  2. Tag 1-2 reviewers
  3. Address comments within 24 hours
  4. Merge after approval

**Technical Questions**
- Platform: Slack #phase-5-technical
- When to use:
  - Architecture questions
  - Design decisions
  - API contracts
  - Database schema questions

**Urgent Issues**
- Platform: Slack with @tech-lead mention
- When to use:
  - Production issues
  - Blocking bugs
  - Security concerns
  - Deployment failures

### Documentation

**Epic Plans** (Primary Reference)
- Epic #24: `feature/epic-24-admin-lifecycle` branch
- Epic #43: `feature/epic-43-membership-sync` branch
- Epic #87: `feature/epic-87-election-discovery` branch

**Meeting Notes**
- Location: Google Docs (link TBD)
- Owner: Rotating weekly
- Format: Date, attendees, decisions, action items

**Decision Log**
- Location: `docs/status/ongoing/PHASE_5_DECISIONS.md`
- Format:
  ```markdown
  ## [Date] - [Decision Title]

  **Context**: Why this decision needed
  **Options Considered**: 2-3 options
  **Decision**: What we chose
  **Rationale**: Why we chose it
  **Consequences**: Trade-offs accepted
  ```

### Escalation Path

**Level 1**: Ask in Slack channel
**Level 2**: Tag epic lead
**Level 3**: Tag tech lead
**Level 4**: Schedule sync call

**Example**:
```
Level 1: "How do we handle auth token expiry?" → #phase-5-epic-24
Level 2: "Blocked on Django API" → @epic-43-lead in #phase-5-blockers
Level 3: "Database migration failed" → @tech-lead in #phase-5-blockers
Level 4: "Major architecture decision needed" → Schedule 30-min call
```

---

## Reference Documents

Each epic has a detailed Week 1 implementation plan:

1. **Epic #24 (Admin API)**
   - Location: `docs/features/election-voting/PHASE_5_WEEK_1_IMPLEMENTATION.md`
   - Branch: `feature/epic-24-admin-lifecycle`
   - Focus: Database, endpoints, audit logging, testing

2. **Epic #43 (Membership Sync)**
   - Location: `docs/features/election-voting/PHASE_5_WEEK_1_MEMBERSHIP_SYNC.md`
   - Branch: `feature/epic-43-membership-sync`
   - Focus: Service creation, Django integration, scheduling

3. **Epic #87 (Member UI)**
   - Location: `docs/features/election-voting/PHASE_5_WEEK_1_MEMBER_UI.md`
   - Branch: `feature/epic-87-election-discovery`
   - Focus: Design, architecture, API planning, environment setup

---

## Key Contacts

**Project Lead**: [Name]
- Escalations: major blockers, timeline changes

**Tech Lead**: [Name]
- Architecture decisions, code review guidance

**Epic #24 Lead**: [Name]
- Admin API questions, database schema

**Epic #43 Lead**: [Name]
- Membership sync questions, Django integration

**Epic #87 Lead**: [Name]
- UI/UX questions, component design

---

## Final Checklist Before Monday

- [ ] All team members assigned
- [ ] All team members have code access
- [ ] Feature branches created and protected
- [ ] Cloud SQL dev environment ready
- [ ] Firebase project configured
- [ ] CI/CD pipeline ready (GitHub Actions)
- [ ] Slack channels created (#phase-5-epics)
- [ ] Documentation reviewed by team
- [ ] Dependency list confirmed with stakeholders
- [ ] First standup scheduled (Monday 10:00 UTC)

---

**Master Plan Created**: 2025-10-22
**Phase 5 Starts**: 2025-10-28
**Week 1 Ends**: 2025-11-01
