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
**Branch**: `feature/epic-87-election-discovery`
**Status**: 🟡 Specification Complete, Ready for Implementation
**Documentation**: [EPIC_87_ELECTION_DISCOVERY.md](../features/election-voting/EPIC_87_ELECTION_DISCOVERY.md)

#### Overview
Members can discover, view details, and participate in elections:
- View list of all eligible elections
- View election details (questions, voting period)
- Cast ballot (submit vote once)
- View results after voting closes

#### Key Deliverables
- Elections list page (responsive, filterable)
- Election detail page with voting form
- Results display with visualizations
- Member-focused API endpoints
- Voting confirmation flow
- Error handling and retry logic

#### Dependencies
- ✅ Members service frontend (Phase 4)
- ⏳ Epic #24 (admin must create elections first)
- ⏳ Epic #43 (membership eligibility required)

#### Success Criteria
- [ ] Member can discover all eligible elections
- [ ] Member can view election details and questions
- [ ] Member can cast ballot and receive confirmation
- [ ] Results display correctly after voting closes
- [ ] UI responsive on mobile and desktop
- [ ] All error cases handled gracefully

#### Implementation Timeline
- **Week 1**: UI structure + API integration
- **Week 2**: Voting logic + results display
- **Week 3**: Testing + performance optimization
- **Week 4**: Documentation + polish

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

### Sequential Dependencies (Must Complete In Order)
```
Phase 4 (Complete)
├── Elections Service MVP ✅
├── Events Service MVP ✅
└── Members Service Frontend ✅
    │
    └─→ Epic #24: Admin Lifecycle (Week 1-4)
        └─→ Epic #87: Member Discovery (Week 1-4, depends on #24)

Epic #43: Membership Sync (Week 1-4, parallel with #24/#87)
└─→ Enables accurate member eligibility for both #24 and #87
```

### Parallel Work Possible
- **Epic #24 and #43 can run in parallel** - They don't directly depend on each other
- **Epic #87 depends on both #24 and #43** - Needs working admin interface and accurate membership

### Recommended Execution Order
1. **Start #24 and #43 simultaneously** (Week 1)
   - #24: Build admin API for election lifecycle
   - #43: Build membership sync infrastructure
2. **Complete #24 and #43 before #87** (Week 1-3)
   - Need working admin interface to create elections
   - Need accurate membership for eligibility checks
3. **Start #87 after #24 and #43 foundation** (Week 2-3)
   - #24 foundation done: can test with real elections
   - #43 foundation done: accurate membership

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

### Decision 1: Keep Frontend in apps/members-portal/
- **Decision**: Maintain Firebase standard structure (apps/members-portal/)
- **Rationale**: Firebase conventions, zero risk to deployment
- **Alternative Considered**: Separate to apps/members-portal/
- **Why Not**: Would break Firebase CLI expectations, 6-8 hours for unclear benefit
- **Implication**: Organize member features within public/features/elections/

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

## Success Metrics (Phase 5 Complete)

### Functional Success
- [ ] Admin can create election and open voting
- [ ] Members can discover and vote in elections
- [ ] Results displayed after voting closes
- [ ] New members can vote within 1 hour of being added
- [ ] Membership syncs automatically hourly
- [ ] Zero voting data loss on failures

### Non-Functional Success
- [ ] System handles 300 concurrent votes/sec (load test)
- [ ] 99.9% availability during voting spike
- [ ] <300ms response time for vote submission (p95)
- [ ] <5% error rate during peak voting
- [ ] Complete audit trail for all operations

### User Experience Success
- [ ] Members report voting process is intuitive
- [ ] Admin can create election in <5 minutes
- [ ] Mobile voting experience is smooth
- [ ] Error messages are helpful (no PII leakage)
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

- **#24**: Admin capability to manage elections
- **#43**: Accurate membership for eligibility
- **#87**: Member capability to participate

The repository restructuring (completed before Phase 5) provides a solid foundation with clear separation of concerns and room for future growth. The system is ready for this phase of development.

**Status**: 🟡 Specifications Complete, Ready for Team Kickoff

---

**Last Updated**: 2025-10-22
**Author**: Phase 5 Planning (Opus + Haiku)
**Next Review**: Week 1 of Phase 5 implementation kickoff
