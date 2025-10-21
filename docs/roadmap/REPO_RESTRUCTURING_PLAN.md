# Repository Restructuring Plan for Ekklesia Growth

**Created**: 2025-10-21
**Purpose**: Prepare repository structure for sustainable growth from MVP (Phase 5) through production scaling (Phase 6+)
**Scope**: Local repository reorganization for improved developer experience, scalability, and maintainability
**Methodology**: Multi-Agent Workflow (Human → Sonnet → Haiku → Sonnet)

---

## 📊 Executive Summary

The Ekklesia repository is transitioning from Phase 4 (security hardening MVP) to Phase 5 (events & elections feature expansion) and beyond. Current structure works for single-service deployment but will become unwieldy with:

- 3+ backend services (Members, Events, Elections, future services)
- Multiple frontend applications (Members portal, Admin UI, public voting interface)
- Complex feature development (admin election lifecycle, membership sync, RBAC)
- Parallel development workflows (multiple teams/contractors)

**Proposed restructuring**:
1. Organize services by domain, not by infrastructure type
2. Consolidate documentation with clear ownership
3. Enable multi-team parallel development
4. Support future migrations and integrations
5. Implement clear separation of concerns

**Estimated effort**: 4-6 hours (Haiku execution via multi-agent workflow)
**Risk level**: Medium (extensive file moves, but backed by git)
**Timeline**: Single focused session after Sonnet critique

---

## 🎯 Goals

### Primary Goals
1. **Scalability**: Support 6-10+ services without chaos
2. **Clarity**: New developers understand structure in <30 minutes
3. **Parallelization**: Enable 3+ teams to work independently
4. **Maintainability**: Easy to find code, docs, tests, configs
5. **Growth-ready**: Prepared for Phase 5-6 features and beyond

### Secondary Goals
1. Reduce cognitive load on developers
2. Simplify CI/CD configuration
3. Enable faster feature delivery
4. Support better documentation discoverability
5. Facilitate code reviews and quality gates

---

## 📈 Growth Projection

### Current State (Phase 4, Oct 2025)
- **Services**: 3 (Members, Events, Elections)
- **Features**: MVP voting flow
- **Teams**: Solo or small team
- **CI/CD**: Manual deployment

### Phase 5 (Nov 2025 - planned)
- **New features**:
  - Member election discovery
  - Admin election lifecycle (draft → publish → close)
  - Election catalog with rules/timeline
  - Roles & permissions system
- **New services**: None yet, but significant features in existing ones
- **Teams**: 1-2 developers

### Phase 6-7 (Dec 2025 - Q1 2026 - projected)
- **New services**:
  - Admin API service (election management)
  - Membership sync service (Django integration)
  - Audit logging service (compliance)
  - Public voting interface (separate frontend)
- **New features**:
  - RBAC with field-level permissions
  - Audit logging with retention policies
  - Monitoring & alerting dashboard
  - Admin UI for election management
  - Weekly membership synchronization
- **Teams**: 2-4 developers (possible contractor onboarding)
- **Scale**: 10-100+ elections per year

---

## 🏗️ Current Structure Analysis

### What Works Well
✅ Clear service boundaries (members/, events/, elections/)
✅ Consolidated documentation (docs/)
✅ Git-based workflow
✅ Phase-based development tracking

### What Needs Improvement
❌ Documentation scattered across 8+ categories without clear ownership
❌ No feature-branch documentation (hard to onboard on specific features)
❌ Mixed concerns in `/docs/guides/` (git, github, admin, troubleshooting)
❌ No clear "getting started" path for new developers
❌ Design docs separate from feature tracking
❌ Testing documentation not co-located with tests
❌ No service-specific documentation structure
❌ Archive/Legacy not clearly separated

### Growth Challenges (if unchanged)
- Adding 5+ new services will make root directory confusing
- Feature documentation won't scale (all mixed in docs/)
- New developers can't quickly find service-specific guides
- Testing strategy not visible in docs structure
- Audit/compliance documentation scattered

---

## 📋 Proposed Structure

### High-Level Organization

```
ekklesia/
├── services/                          # All backend services
│   ├── members/                      # Members Portal + Auth
│   ├── events/                       # Event/Election Voting API
│   ├── elections/                    # Election Result Recording
│   ├── admin/ (Phase 6+)             # Admin Election Management
│   ├── membership-sync/ (Phase 6+)   # Django → Ekklesia sync
│   └── shared/                       # Shared utilities, SDKs
│
├── apps/                             # Frontend applications
│   ├── members-portal/               # Current Members UI (Firefox hosted)
│   ├── admin-dashboard/ (Phase 6+)   # Admin election management UI
│   └── public-voting/ (Phase 7+)     # Public voting interface
│
├── docs/                             # Comprehensive documentation
│   ├── features/                     # Feature-specific docs & user stories
│   ├── architecture/                 # System design & decisions
│   ├── operations/                   # DevOps, deployment, monitoring
│   ├── development/                  # Developer guides, workflows
│   ├── security/                     # Security policies, hardening
│   └── reference/                    # API specs, database schemas
│
├── infrastructure/                   # Infrastructure-as-Code
│   ├── terraform/                    # GCP resources (Phase 6+)
│   ├── cloud-run/                    # Cloud Run configs
│   └── sql/                          # Database migrations & schemas
│
├── testing/                          # Centralized test utilities
│   ├── e2e/                          # End-to-end tests
│   ├── fixtures/                     # Test data & mocks
│   └── scripts/                      # Test automation
│
├── scripts/                          # Utility & automation scripts
│   ├── deployment/                   # CI/CD helpers
│   ├── database/                     # Database utilities
│   ├── monitoring/                   # Health check scripts
│   └── admin/                        # Admin utilities
│
├── .github/
│   ├── workflows/                    # GitHub Actions
│   └── ISSUE_TEMPLATE/               # Issue templates
│
└── archive/                          # Historical / deprecated
    ├── phase-1-3-notes/
    ├── zitadel-legacy/
    └── migration-notes/
```

---

## 🔄 Migration Strategy: Phase-by-Phase

### Phase 0: Backup & Verification (CRITICAL)
```
Goal: Create complete backup before any changes
Steps:
1. Git commit all current work
2. Create backup tarball of entire repo
3. Verify backup integrity
4. Document pre-migration state (directory tree, file counts)
```

### Phase 1: Create Root Structure
```
Actions:
- Create /services, /apps, /infrastructure, /testing directories
- Create /docs subdirectory structure (features, architecture, operations, etc.)
- Create /scripts subdirectories
- Verify all directories created
```

### Phase 2: Consolidate Services
```
Current: services in root (members/, events/, elections/)
Action: Move to services/ subdirectory (using git mv to preserve history)
Result: services/{members,events,elections}/ with full git history intact
```

### Phase 3: Reorganize Documentation
```
Goal: Categorize docs by purpose, not by topic

New structure:
docs/
├── features/
│   ├── election-discovery/          # Feature #87 docs
│   ├── admin-election-lifecycle/    # Feature #24 docs
│   ├── membership-sync/             # Feature #43 docs
│   └── election-voting/             # Core voting feature
│
├── architecture/
│   ├── system-design.md
│   ├── service-mesh/
│   ├── database-schema/
│   └── security-model/
│
├── operations/
│   ├── deployment/
│   ├── monitoring/
│   ├── incident-response/
│   └── backup-recovery/
│
├── development/
│   ├── getting-started.md
│   ├── development-setup.md
│   ├── coding-standards.md
│   ├── git-workflow.md
│   ├── testing-strategy.md
│   └── troubleshooting/
│
├── security/
│   ├── policies/
│   ├── audit-logging/
│   └── compliance/
│
└── reference/
    ├── api-endpoints.md
    ├── database-schema.md
    └── glossary.md
```

### Phase 4: Migrate Feature Documentation
```
Current: Scattered across status/, design/, guides/
Action:
- Analyze all open issues (Epic #24, #87, #43, etc.)
- Create feature/ subdirectories for each major feature
- Move related docs to feature directories
- Create index in each feature directory

Result: Each feature self-contained with:
- User stories & requirements
- Technical design
- Implementation status
- Test plan
- Deployment checklist
```

### Phase 5: Consolidate Scripts
```
Current: scripts/ in root (mixed admin, deployment, audit)
Action:
- Create scripts/{deployment,database,monitoring,admin}/
- Move scripts to appropriate subdirectories
- Create scripts/README.md with directory guide

Result: Easy to find and run maintenance scripts
```

### Phase 6: Finalize Archive
```
Action:
- Move docs/legacy/ → archive/
- Move docs/audits/ → archive/ (for local only, per .gitignore)
- Create archive/README.md explaining contents
- Verify nothing critical left in archive
```

### Phase 7: Create Documentation Index
```
Actions:
- Create docs/README.md (entry point for all docs)
- Create docs/QUICK_START.md (for new developers)
- Create docs/DIRECTORY.md (detailed directory guide)
- Create service-specific README.md in each services/{name}/

Result: Clear entry point for navigation
```

### Phase 8: Verify & Commit
```
Verification:
- All services accessible in new locations
- All documentation discoverable
- Git history preserved for all moved files
- No broken references in markdown links
- Repository size unchanged (no data loss)

Commits:
1. "refactor: reorganize services into /services directory"
2. "docs: reorganize documentation by purpose"
3. "refactor: consolidate and categorize scripts"
4. "docs: add comprehensive documentation index"
```

---

## 📁 Specific Reorganization Details

### Services Migration

**Current**:
```
ekklesia/
├── members/          → services/members/
├── events/           → services/events/
└── elections/        → services/elections/
```

**Benefits**:
- Clear "services" container for scaling to 5+ services
- Easier to create new services (template in services/)
- Shared utilities naturally go in services/shared/
- CI/CD can easily iterate over services/*/

### Documentation Reorganization

**By Feature** (tied to issues/epics):
```
docs/features/
├── election-discovery/          # Issue #87, Stories #25-#27
│   ├── user-stories.md
│   ├── technical-design.md
│   ├── api-specification.md
│   ├── test-plan.md
│   └── deployment-checklist.md
│
├── admin-election-lifecycle/    # Issue #24, Issues #71-#79
│   ├── requirements.md
│   ├── technical-design.md
│   ├── admin-endpoints.md
│   ├── rbac-model.md
│   └── implementation-status.md
│
└── membership-sync/             # Issue #43, Issues #88-#92
    ├── overview.md
    ├── django-api-spec.md
    ├── sync-strategy.md
    ├── error-handling.md
    └── monitoring-plan.md
```

**By Domain** (architecture):
```
docs/architecture/
├── system-overview.md
├── service-mesh/
│   ├── members-service.md
│   ├── events-service.md
│   └── elections-service.md
├── database/
│   ├── schema-diagram.md
│   ├── migration-strategy.md
│   └── performance.md
└── security/
    ├── authentication-flow.md
    ├── authorization-model.md
    └── audit-logging.md
```

### Root-Level Services Structure

**Phase 5 (current)**:
```
services/
├── members/
│   ├── public/              # Firebase Hosting static files
│   ├── functions/
│   │   ├── handleKenniAuth/
│   │   └── verifyMembership/
│   ├── tests/
│   └── README.md
│
├── events/
│   ├── src/
│   ├── tests/
│   ├── Dockerfile
│   ├── package.json
│   └── README.md
│
├── elections/
│   ├── src/
│   ├── tests/
│   ├── Dockerfile
│   ├── package.json
│   └── README.md
│
└── shared/                  # NEW: Shared utilities
    ├── auth/               # Firebase Admin SDK wrappers
    ├── db/                 # Database connection pooling
    ├── logging/            # Standardized logging
    ├── testing/            # Test utilities
    └── npm-packages.json   # Shared dependencies
```

**Phase 6+ (projected)**:
```
services/
├── admin/                   # NEW: Admin election management
│   ├── src/
│   ├── tests/
│   └── README.md
│
├── membership-sync/         # NEW: Django integration
│   ├── src/
│   ├── tests/
│   └── README.md
│
├── audit-logging/           # NEW: Compliance & audit
│   ├── src/
│   ├── tests/
│   └── README.md
│
└── [existing services...]
```

---

## 🚀 Expected Outcomes

### Developer Experience
- **New developers**: Can navigate repo structure in <30 minutes
- **Feature work**: Can find all related docs/code for a feature quickly
- **Service additions**: Can clone service template and get started immediately
- **Documentation**: Clear index + breadcrumbs = easy navigation

### Code Organization
- **Scalability**: Adding 5+ new services won't create chaos
- **Parallel development**: Multiple teams can work independently
- **Code review**: Clear separation of concerns
- **Testing**: Unified test strategy easily visible

### DevOps & Operations
- **Deployment**: Scripts clearly organized by purpose
- **Monitoring**: Centralized monitoring guides
- **Recovery**: Clear backup/disaster recovery procedures
- **Documentation**: Ops team can find necessary info quickly

---

## ⚠️ Risk Mitigation

### Risk 1: Broken Git History
**Mitigation**: Use `git mv` exclusively, never `mv`
- Preserves full commit history for every file
- `git blame` and `git log` still work perfectly
- Can verify with: `git log --follow [filename]`

### Risk 2: Broken Markdown Links
**Mitigation**: Automated verification after migration
- Search for `[text](../docs/old-path.md)` patterns
- Use script to find and fix broken links
- Verify all links in verification phase

### Risk 3: Documentation Redundancy
**Mitigation**: Create clear ownership in each doc
- Add "Primary owner" and "Related docs" at top of each file
- Link to related docs, don't duplicate
- Regular review to identify redundancy

### Risk 4: Lost Files or Confusion During Migration
**Mitigation**: Phase-by-phase approach with verification
- Each phase has clear success criteria
- Never delete, only move
- Keep detailed migration log
- Can rollback to any phase if needed

---

## 📊 Success Criteria

### Phase Completion Checklist
```
Phase 0 (Backup):
✅ Git status clean (no uncommitted changes)
✅ Backup tarball created and verified
✅ Pre-migration state documented

Phase 1 (Root Structure):
✅ All new directories created
✅ Directory tree matches plan
✅ No files misplaced

Phase 2 (Services):
✅ services/{members,events,elections}/ all present
✅ Git history preserved for all files
✅ No files lost or duplicated
✅ tests/ directory accessible

Phase 3 (Docs Structure):
✅ docs/{features,architecture,operations,development,security,reference}/ all present
✅ Old docs/*.md still exist (will consolidate in Phase 4)
✅ New directory structure matches plan

Phase 4 (Feature Docs):
✅ Each major feature has feature/ subdirectory
✅ User stories linked to feature directories
✅ Technical docs co-located with feature
✅ No orphaned documentation

Phase 5 (Scripts):
✅ scripts/{deployment,database,monitoring,admin}/ organized
✅ All scripts functional
✅ scripts/README.md documents each category

Phase 6 (Archive):
✅ Deprecated docs moved to archive/
✅ archive/README.md explains contents
✅ .gitignore still excludes archive/

Phase 7 (Index):
✅ docs/README.md is clear entry point
✅ docs/QUICK_START.md works for onboarding
✅ docs/DIRECTORY.md provides navigation
✅ Each service has README.md

Phase 8 (Verify & Commit):
✅ No broken markdown links
✅ Git history clean (7 commits, all tagged)
✅ Repository size same as before
✅ All services accessible
✅ Ready to push to main
```

### Quality Metrics
```
After restructuring:
- Broken links: 0
- Missing files: 0
- Duplicate content: <5% (acceptable, with linking strategy)
- Documentation discoverability: New dev finds any info in <5 minutes
- Git history: 100% preserved (no data loss)
- Repository size: Unchanged
- Time to add new service: <30 minutes (using template)
- Time to understand feature: <10 minutes (with feature/ directory)
```

---

## 🔄 Multi-Agent Workflow Implementation

### Phase 1: Analysis (You → Sonnet)
**Deliverable needed**: This document (what you're reading)
- Situation: MVP repo needs restructuring for growth
- Current: 3 services scattered, docs mixed, scripts unclear
- Future: 6+ services, multiple teams, 2+ apps
- Goal: Create clear, scalable structure

### Phase 2: Critique & Refinement (Sonnet)
**Expected from Sonnet**:
- Risk assessment of proposed structure
- Improvements to directory organization
- Detailed 8-phase execution plan
- Specific `git mv` commands for Haiku

### Phase 3: Execution (You → Haiku with Sonnet's prompt)
**What Haiku will do**:
- Execute migration in 8 phases (2-3 hours)
- Create git commits at each milestone
- Verify no data loss
- Generate final verification report

### Phase 4: QA & Fixes (You → Sonnet with Haiku's results)
**What Sonnet will do**:
- Verify all success criteria met
- Check for broken links
- Review git history integrity
- Score quality (target: 95/100)

---

## 📚 Next Steps

1. **Share this plan** with team for feedback
2. **Send to Sonnet** for critique and refinement (separate chat)
3. **Get Sonnet's execution prompt** with exact git commands
4. **Run with Haiku** for fast, precise execution (separate chat)
5. **Review results** with Sonnet for QA sign-off
6. **Push to feature branch** for final review

---

## 📖 Related Documentation

- **Current structure**: `/home/gudro/Development/projects/ekklesia/`
- **Multi-agent workflow**: `docs/guides/workflows/MULTI_AGENT_WORKFLOW.md`
- **Open issues**: GitHub issues #24, #43, #87 (major features)
- **Phase roadmap**: `docs/roadmap/` (overall project timeline)

---

## 👤 Ownership

**Document Owner**: Human (project lead)
**Initial Plan**: Human
**Critique & Refinement**: Sonnet (to be scheduled)
**Execution**: Haiku (to be scheduled)
**QA & Verification**: Sonnet (to be scheduled)

---

**Status**: ✏️ Draft (Ready for Sonnet critique)
**Last Updated**: 2025-10-21
**Next Action**: Schedule Sonnet review for critique and execution plan refinement
