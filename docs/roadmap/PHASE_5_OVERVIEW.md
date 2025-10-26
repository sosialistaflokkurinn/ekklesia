# Phase 5: Feature Development & Deployment Planning

**Phase**: 5
**Status**: 🟡 Planning & Ready for Implementation
**Target**: November 2025
**Duration**: 4 weeks (assumed)

---

## Vision

Phase 5 transforms Ekklesia from an infrastructure project into a fully functional voting system. After Phase 4's security hardening, Phase 5 focuses on:

1. **Admin Interface** - Administrators can create and manage elections
2. **Member Experience** - Members can discover and vote in elections
3. **Membership Management** - Automatic synchronization with Django backend

This phase enables the first full end-to-end voting cycle: create election → members vote → publish results.

---

## Phase 5 Epics

### Epic #24: Admin Election Lifecycle Management
**Branch**: `feature/epic-24-admin-lifecycle`
**Status**: 🟡 Specification Complete, Ready for Implementation
**Documentation**: [EPIC_24_ADMIN_LIFECYCLE.md](../features/election-voting/EPIC_24_ADMIN_LIFECYCLE.md)

#### Overview
Administrators can create, configure, schedule, and manage the complete election lifecycle:
- Create elections with questions and voting periods
- Open voting (generate member eligibility list and tokens)
- Close voting (stop accepting ballots)
- Publish results (make results visible to members)

#### Key Deliverables
- Admin REST API endpoints (/api/admin/elections/*)
- Role-based access control (admin role only)
- Election state management (draft → open → closed → published)
- Complete audit logging of admin actions
- Database schema for election metadata

#### Dependencies
- ✅ Elections service MVP (Phase 4)
- ✅ Events service MVP (Phase 4)
- ⏳ Database schema migration (#84)

#### Success Criteria
- [ ] Admin can create election with title, description, questions
- [ ] Admin can open voting and generate member tokens
- [ ] Admin can close voting
- [ ] Admin can publish results
- [ ] All operations logged to audit trail
- [ ] Role-based access control enforced

#### Implementation Timeline
- **Week 1**: Database schema + API skeleton
- **Week 2**: Full API implementation + tests
- **Week 3**: Integration testing + load testing
- **Week 4**: Documentation + nice-to-haves

---

### Epic #87: Member Election Discovery & Voting Interface
**Branch**: `archive/epic-87-election-discovery-2025-10-22` (archived)
**Status**: ✅ Complete - Merged to main (2025-10-22)
**Documentation**: [EPIC_87_ELECTION_DISCOVERY.md](../features/election-voting/EPIC_87_ELECTION_DISCOVERY.md)

#### Overview
Members can discover, view details, and participate in elections:
- View list of all eligible elections
- View election details (questions, voting period)
- Cast ballot (submit vote once)
- View results after voting closes

#### Delivered
- Frontend separation to `apps/members-portal/`
- i18n system with R.string pattern (75 strings, Icelandic)
- BEM CSS methodology (650 lines)
- Elections API client and mock API
- Elections list page (responsive)
- Election detail page with voting form
- Vote submission flow
- Results display
- Error handling and retry logic

#### Dependencies
- ✅ Members service frontend (Phase 4) - Complete
- ✅ Frontend separation - Complete
- ✅ i18n system - Complete
- ⏳ Epic #24 (admin must create real elections) - In progress
- ⏳ Epic #43 (membership eligibility required) - Planned

#### Success Criteria
- [x] Member can discover all eligible elections
- [x] Member can view election details and questions
- [x] Member can cast ballot and receive confirmation
- [x] Results display correctly after voting closes
- [x] UI responsive on mobile and desktop
- [x] All error cases handled gracefully
- [x] i18n support (Icelandic)
- [x] BEM CSS methodology established

#### Implementation Timeline
- **Completed**: 2025-10-22
- Foundation ready for Epic #24 admin UI development

---

### Epic #43: Membership Sync with Django Backend
**Branch**: `feature/epic-43-membership-sync`
**Status**: 🟡 Specification Complete, Ready for Implementation
**Documentation**: [EPIC_43_MEMBERSHIP_SYNC.md](../features/election-voting/EPIC_43_MEMBERSHIP_SYNC.md)

#### Overview
Automatic membership synchronization ensures elections always use current membership data:
- Hourly sync from Django backend
- Add new members (can vote after sync)
- Remove ineligible members (can't vote after sync)
- Complete audit trail of membership changes
- Manual trigger for admin before creating election

#### Key Deliverables
- New membership-sync Cloud Run service
- Django API client integration
- Membership delta calculation
- Cloud Scheduler for hourly sync
- Audit logging (sync_log table)
- Member eligibility view
- Integration with Elections/Events services

#### Dependencies
- ✅ Cloud SQL (Phase 4)
- ⏳ Django backend API (external dependency)
- ⏳ Epic #24 (elections require current membership)
- ⏳ Epic #87 (voting requires accurate membership)

#### Success Criteria
- [ ] New members can vote within 1 hour of being added
- [ ] Removed members can't vote within 1 hour of removal
- [ ] All sync operations logged
- [ ] Sync failures trigger alerts
- [ ] Zero impact on active voting
- [ ] Audit trail shows all membership changes

#### Implementation Timeline
- **Week 1**: Database schema + sync service setup
- **Week 2**: Integration with Elections/Events services
- **Week 3**: Testing + monitoring setup
- **Week 4**: Documentation + polish

---

## Implementation Dependencies

### Current Status (Updated 2025-10-22)

**Completed:**
```
Phase 4 (Complete)
├── Elections Service MVP ✅
├── Events Service MVP ✅
└── Members Service Frontend ✅
    │
    └─→ Epic #87: Member Discovery & Voting UI ✅ (Merged to main 2025-10-22)
        └─→ Frontend separation to apps/members-portal/
        └─→ i18n system (R.string pattern)
        └─→ BEM CSS methodology
        └─→ Elections API client patterns
```

**In Progress:**
```
Epic #24: Admin Lifecycle (Current focus)
├── Leverages Epic #87 frontend structure
├── Uses Epic #87 i18n system for admin strings
└── Follows Epic #87 BEM CSS patterns
```

**Planned:**
```
Epic #43: Membership Sync (Week 2-3)
└─→ Enables accurate member eligibility for both #24 and #87
```

### Updated Implementation Order

1. **Epic #87** ✅ Complete (2025-10-22)
   - Provides frontend foundation for admin UI
   - i18n system ready for admin strings
   - BEM CSS patterns established

2. **Epic #24** (Current - Week 1-4)
   - Build admin API for election lifecycle
   - Leverage Epic #87 patterns for admin UI
   - Foundation ready from Epic #87

3. **Epic #43** (Week 2-4)
   - Build membership sync infrastructure
   - Can start parallel with Epic #24 completion
   - Integration with Epic #24 and #87

---

## Technical Architecture (Phase 5 Complete)

### System Diagram
```
┌────────────────────────────────────────────────────────────────┐
│ Members (Desktop/Mobile)                                       │
│ - Login (Kenni.is)                                            │
│ - View Elections (/elections) ← Epic #87                      │
│ - Cast Vote (/elections/:id)                                  │
│ - View Results                                                │
└──────────┬───────────────────────────────────────────────────┘
           │ HTTP/HTTPS
           │
┌──────────▼──────────────────────────────────────────────────────┐
│ Firebase Hosting (Members Service)                              │
│ https://ekklesia-prod-10-2025.web.app                          │
│ - Static HTML/CSS/JS                                           │
│ - ES6 modules (features-based organization)                    │
└──────────┬───────────────────────────────────────────────────────┘
           │
           ├──────────────────────────┐
           │                          │
           ▼                          ▼
    ┌─────────────┐          ┌──────────────┐
    │   Events    │          │  Elections   │
    │  Service    │          │   Service    │
    │ Cloud Run   │          │  Cloud Run   │
    └──────┬──────┘          └──────┬───────┘
           │ S2S                    │ S2S
           └──────────┬─────────────┘
                      │
                      ▼
            ┌──────────────────────┐
            │ Cloud SQL PostgreSQL │
            │ (ekklesia-db)        │
            │                      │
            │ Schema:              │
            │ - public (shared)    │
            │ - elections (voting) │
            └──────────┬───────────┘
                       │
┌──────────────────────┼──────────────────────┐
│                      │                      │
▼                      ▼                      ▼
Elections       Membership          Events Audit
Table          Sync Log Table       Log Table
(#24)          (#43)                (#24)
```

### Service Additions in Phase 5

#### 1. Membership Sync Service (NEW)
```
Language: Node.js 18 + Express
URL: https://membership-sync-SERVICE.run.app
Purpose: Hourly sync with Django backend
Triggers: Cloud Scheduler (hourly) + Webhook (real-time optional)
```

### Service Updates in Phase 5

#### 1. Events Service
```
Updates:
- POST /api/admin/elections              Create election (#24)
- PATCH /api/admin/elections/:id         Update election (#24)
- POST /api/admin/elections/:id/open     Open voting (#24)
- POST /api/admin/elections/:id/close    Close voting (#24)
- POST /api/admin/elections/:id/publish  Publish results (#24)
- GET /api/elections                     List elections (#87)
- GET /api/elections/:id                 Election details (#87)
- POST /api/elections/:id/token          Request token (#87)
```

#### 2. Elections Service
```
Updates:
- Member eligibility checks (from sync_log) (#43)
- Vote validation checks
- Results calculation (already implemented MVP)
```

---

## Key Decisions & Trade-offs

### Decision 1: Frontend Separation to apps/members-portal/ ✅
- **Decision**: Separate member-facing UI to `apps/members-portal/`
- **Rationale**: Clean separation between member and admin functionality
- **Status**: ✅ Complete (Epic #87)
- **Implementation**: Created apps/members-portal/ directory with elections features
- **Benefits Delivered**:
  - Clear separation of concerns
  - Reusable component structure
  - i18n system established (R.string pattern)
  - BEM CSS methodology
- **Implication**: Admin UI can now follow same patterns

### Decision 2: Hourly Membership Sync
- **Decision**: Cloud Scheduler triggers hourly sync
- **Rationale**: Acceptable for monthly meetings, cost-efficient
- **Alternative Considered**: Real-time webhooks from Django
- **Why Not**: Adds complexity, not needed for infrequent meetings
- **Implication**: 1-hour maximum delay before new members can vote

### Decision 3: Separate Membership Sync Service
- **Decision**: New Cloud Run service (membership-sync) for syncing
- **Rationale**: Separation of concerns, scalability, independent deployments
- **Alternative Considered**: Add sync logic to Events service
- **Why Not**: Events service is voting-critical, don't want to couple with external API
- **Implication**: Requires 3 services total (events, elections, membership-sync)

---

## Success Metrics (Phase 5 Progress)

### Functional Success
- [ ] Admin can create election and open voting (Epic #24 - In progress)
- [x] Members can discover and vote in elections (Epic #87 - Complete)
- [x] Results displayed after voting closes (Epic #87 - Complete)
- [ ] New members can vote within 1 hour of being added (Epic #43 - Planned)
- [ ] Membership syncs automatically hourly (Epic #43 - Planned)
- [ ] Zero voting data loss on failures

### Non-Functional Success
- [ ] System handles 300 concurrent votes/sec (load test)
- [ ] 99.9% availability during voting spike
- [ ] <300ms response time for vote submission (p95)
- [ ] <5% error rate during peak voting
- [ ] Complete audit trail for all operations (Epic #24 - In progress)

### User Experience Success
- [x] Members report voting process is intuitive (Epic #87 - UI complete)
- [ ] Admin can create election in <5 minutes (Epic #24 - In progress)
- [x] Mobile voting experience is smooth (Epic #87 - Responsive design)
- [x] Error messages are helpful (Epic #87 - Error handling implemented)
- [ ] All flows tested with real users

---

## Open Questions for Team

### Admin Interface
1. How will admins get the admin role claim? (Manual/CLI/Web UI)
2. Should results publish automatically or manually?
3. Can elections be edited after voting starts?

### Member Experience
1. Should results be real-time or after voting closes?
2. How detailed should vote confirmation be?
3. Should voting history be visible to members?

### Membership Sync
1. Is Django API available 24/7?
2. Is 1-hour sync frequency acceptable?
3. What auth method for Django API access?

### Phase 5.5 (Post-Phase 5)
1. Admin web UI or CLI only?
2. Email notifications for members?
3. Real-time result visualization?

---

## Risk Management

### High-Risk Items
| Risk | Mitigation | Owner |
|------|-----------|-------|
| Django API unavailable | Retry logic + alerts | Phase 5 Dev |
| New members not voting | Sync verification tests | Phase 5 QA |
| Voting performance | Load testing before launch | Phase 5 Dev |

### Medium-Risk Items
| Risk | Mitigation | Owner |
|------|-----------|-------|
| UI complexity | Early user testing | Phase 5 Dev |
| Network latency | Client-side retry logic | Phase 5 Dev |
| Audit logging impact | Log rotation + archival | Phase 5 Dev |

### Low-Risk Items
| Risk | Mitigation | Owner |
|------|-----------|-------|
| Admin role management | Clear documentation | Phase 5 Ops |
| Timezone issues | Use UTC + test timezones | Phase 5 Dev |
| Browser compatibility | Test on modern browsers | Phase 5 QA |

---

## Resource Requirements

### Team Size
- 1 Backend Developer (Events + Elections services, #24)
- 1 Frontend Developer (Members service, #87)
- 1 Full-Stack Developer (Membership sync, #43)
- 1 QA Engineer (Testing across all epics)
- 0.5 DevOps (Cloud infrastructure, monitoring)

### Time Estimate
- **Base Implementation**: 12 weeks (3 developers × 4 weeks each)
- **Realistic Estimate**: 16 weeks (with integration, testing, rework)
- **Optimistic Estimate**: 10 weeks (if everything goes smoothly)

### Infrastructure
- ✅ Cloud SQL (exists, may need upgrade)
- ✅ Cloud Run (exists for services)
- ✅ Firebase (exists for frontend)
- ⏳ Cloud Scheduler (new, for sync jobs)
- ⏳ membership-sync service (new)

---

## Phase Boundary (Phase 5 → Phase 6)

### At End of Phase 5
- ✅ End-to-end voting works (create → vote → results)
- ✅ Members can discover and vote in elections
- ✅ Membership automatically syncs
- ✅ All operations audited
- ✅ Production ready for first election

### Phase 5.5 (Optional, Not Phase 5)
- Admin web UI dashboard (instead of API calls)
- Email notifications to members
- Real-time result visualization
- Bulk import elections
- Election templates

### Phase 6 (Future)
- Advanced voting types (ranked choice, etc.)
- Recurring elections
- Multi-language support (beyond Icelandic)
- Advanced analytics
- Mobile app (native iOS/Android)

---

## Documentation & Handoff

### Epic Documentation
- ✅ [EPIC_24_ADMIN_LIFECYCLE.md](../features/election-voting/EPIC_24_ADMIN_LIFECYCLE.md)
- ✅ [EPIC_87_ELECTION_DISCOVERY.md](../features/election-voting/EPIC_87_ELECTION_DISCOVERY.md)
- ✅ [EPIC_43_MEMBERSHIP_SYNC.md](../features/election-voting/EPIC_43_MEMBERSHIP_SYNC.md)

### Developer Guides
- ✅ [docs/development/guides/](../development/guides/) - All available
- ✅ [docs/architecture/](../architecture/) - System design docs
- ✅ [docs/operations/](../operations/) - Deployment procedures

### Test Plans
- To be created during Phase 5 implementation
- Load testing procedures
- Integration testing procedures
- User acceptance testing (UAT)

---

## Conclusion

Phase 5 represents the transition from infrastructure to functionality. The three epics (#24, #43, #87) work together to create a complete voting system:

- **#87**: ✅ Member capability to participate (Complete - Merged to main 2025-10-22)
- **#24**: Admin capability to manage elections (In progress)
- **#43**: Accurate membership for eligibility (Planned)

**Progress Update (2025-10-22):**

Epic #87 completion provides a strong foundation:
- Frontend structure established (`apps/members-portal/`)
- i18n system ready (R.string pattern, 75 strings)
- BEM CSS methodology documented (650 lines)
- Elections API client patterns available
- Member voting UI complete and tested

Epic #24 can now leverage Epic #87's infrastructure for admin UI development. The repository structure provides clear separation of concerns and proven patterns for the remaining work.

**Status**: 🟢 Epic #87 Complete | 🟡 Epic #24 In Progress | ⏳ Epic #43 Planned

---

**Last Updated**: 2025-10-22
**Author**: Phase 5 Planning (Opus + Haiku + Sonnet)
**Next Review**: Epic #24 Week 1 completion
