# Repository Reorganization Draft Plan

**Status**: Draft
**Created**: 2025-10-21
**Purpose**: Prepare repository structure for Phase 5-6 growth (Epic #24 → Multi-Tenancy)

> **Status**: COMPLETED 2025-10-21 (Commit f3ecc28)
> This was a draft plan. The actual restructuring has been completed.
> See [Repository Structure](../../DOCUMENTATION_MAP.md#-repository-structure) for current structure.
**Effort**: 40-60 hours (2-3 weeks with Haiku + Sonnet workflow)
**Risk Level**: Medium-High (impacts all developers, git operations involved)

---

## Executive Summary

The ekklesia repository is transitioning from **MVP (single hardcoded election)** to **Production Platform (dynamic multi-election, admin APIs, multi-tenancy roadmap)**. The current structure works for MVP but creates friction for:

1. **Epic #24 (Admin APIs)**: Adding 15 new issues around dynamic elections, RBAC, audit logging
2. **Phase 6 (Scaling)**: Multi-tenancy, observability, load testing infrastructure
3. **Developer Experience**: Unclear service boundaries, mixed concerns in docs/scripts
4. **Testing & QA**: Minimal test structure, no clear integration/E2E patterns
5. **Onboarding**: New developers struggle with scattered documentation and ambiguous file organization

**Proposed Approach**: Reorganize into **service-centric structure** with clear separation of concerns, enabling:
- Easier to add new services (6+ potential services in Phase 6 roadmap)
- Better developer tooling and scripts
- Comprehensive testing infrastructure
- Clear deployment and operations patterns
- Foundation for multi-tenancy

---

## Current State Analysis

### Today's Structure (MVP - Working Fine)

```
ekklesia/
├── members/                    # Firebase Hosting + 2 Cloud Functions
├── events/                     # Node.js Cloud Run service
├── elections/                  # Node.js Cloud Run service
├── docs/                       # Mixed: status, design, ops, guides, security
│   ├── status/                 # Production status tracking
│   ├── design/                 # Architecture decisions
│   ├── guides/                 # Operational procedures
│   ├── security/               # Security research & hardening
│   ├── roadmap/                # Epic planning
│   ├── testing/                # E2E test documentation
│   └── SYSTEM_ARCHITECTURE_OVERVIEW.md
├── scripts/                    # Mixed: deployment, ops, testing
│   ├── deploy*.sh              # Deployment scripts
│   ├── update-dns-records.sh   # DNS operations
│   └── comprehensive-docs-audit.py
├── tests/                      # Minimal: E2E tests, admin reset
│   ├── test-voting-flow.sh
│   └── admin-reset/
├── archive/                    # Old code: ZITADEL, Portal, legacy evaluations
├── DOCUMENTATION_MAP.md        # Master documentation index
└── README.md                   # Top-level overview
```

**Issues with Current Structure:**

| Issue | Impact | Example |
|-------|--------|---------|
| **Services mixed at root** | Unclear what's a service vs utility | Is `members/` a service or just functions? |
| **Cloud Functions unclear** | Functions live inside `members/`, hard to find | `handleKenniAuth` buried in `members/functions/` |
| **Docs organization chaotic** | Hard to find what you need | Status vs guides vs design vs roadmap all at same level |
| **Scripts unclear purpose** | Don't know if safe to run | Mix of prod deployment and local testing |
| **Tests scattered** | No clear test infrastructure | Test files in various locations, ad-hoc |
| **No shared utilities** | Code duplication across services | Auth, logging, DB patterns repeated |
| **Archive not organized** | Legacy code hard to reference | ZITADEL, Portal, misc evaluations all mixed |
| **Growing pains visible** | Hard to add new services/functions | Epic #24 will add significant new code |

---

## Growth Trajectory (Next 12 Months)

### Phase 5 (Now → 6 weeks)
- ✅ MVP complete (3 services, end-to-end voting)
- 📋 Epic #24: Dynamic elections admin API (15 issues)
- 📋 Infrastructure improvements (connection pooling, observability)

### Phase 6 (6 weeks → 3 months)
- **Service Expansion**:
  - Admin portal (separate from Members)
  - Audit logging service
  - Notification service (email/SMS for meeting reminders)
  - Analytics service
  - Webhook service (for external integrations)
- **Infrastructure**:
  - Multi-tenancy layer
  - Advanced observability (tracing, dashboards)
  - Load testing infrastructure
  - CI/CD automation
- **Testing**:
  - Comprehensive test suite
  - Performance benchmarks
  - Chaos engineering scenarios

### Phase 7 (3 months → 6 months)
- **Feature Services**:
  - Member directory service
  - Communication service
  - File storage service
- **Operations**:
  - Disaster recovery procedures
  - Blue/green deployment automation
  - Cost attribution and billing

**Implication**: Repository will grow from **3 services** to **9-12 services** + shared libraries.

---

## Proposed New Structure

### Overview

```
ekklesia/                                # Root project
├── services/                            # All microservices
│   ├── members/                         # Member portal & authentication
│   ├── events/                          # Election administration & token issuance
│   ├── elections/                       # Anonymous ballot recording
│   ├── admin-portal/                    # NEW: Election admin UI
│   ├── audit-log-service/               # NEW: Structured audit logging
│   ├── notifications-service/           # NEW: Email/SMS notifications
│   ├── analytics-service/               # NEW: Vote analysis & reporting
│   └── webhooks-service/                # NEW: External integrations
│
├── functions/                           # Standalone Cloud Functions
│   ├── handleKenniAuth/                 # OAuth token exchange
│   ├── verifyMembership/                # Membership verification
│   ├── authMiddleware/                  # NEW: Shared auth function
│   ├── auditLogger/                     # NEW: Audit event processing
│   └── webhookDispatcher/               # NEW: Webhook event router
│
├── shared/                              # Shared libraries & utilities
│   ├── auth/                            # Authentication utilities
│   │   ├── firebase-client.js
│   │   ├── jwt-validator.js
│   │   └── hmac-signer.js
│   ├── db/                              # Database utilities
│   │   ├── connection-pool.js
│   │   ├── queries/
│   │   └── migrations/
│   ├── logging/                         # Structured logging
│   │   ├── logger.js
│   │   ├── audit-schema.json
│   │   └── metrics.js
│   ├── types/                           # TypeScript/JSDoc types
│   │   ├── elections.d.ts
│   │   ├── members.d.ts
│   │   ├── events.d.ts
│   │   └── audit.d.ts
│   ├── constants/                       # Shared constants
│   ├── utils/                           # Helper functions
│   │   ├── pagination.js
│   │   ├── validation.js
│   │   └── formatting.js
│   ├── errors/                          # Custom error classes
│   └── testing/                         # Test utilities & fixtures
│
├── tests/                               # Comprehensive test suite
│   ├── unit/                            # Unit tests (per service)
│   │   ├── events/
│   │   ├── elections/
│   │   ├── members/
│   │   └── shared/
│   ├── integration/                     # Service-to-service tests
│   │   ├── events-elections-s2s.test.js
│   │   ├── members-events-auth.test.js
│   │   └── audit-logging.test.js
│   ├── e2e/                             # End-to-end scenarios
│   │   ├── voting-flow.test.js
│   │   ├── election-lifecycle.test.js
│   │   ├── admin-operations.test.js
│   │   └── rbac-enforcement.test.js
│   ├── security/                        # Security-specific tests
│   │   ├── csrf-protection.test.js
│   │   ├── s2s-authentication.test.js
│   │   ├── rate-limiting.test.js
│   │   └── sql-injection.test.js
│   ├── performance/                     # Load & performance tests
│   │   ├── spike-scenarios.js           # 300 votes/sec test
│   │   ├── concurrent-elections.js
│   │   └── database-stress.js
│   ├── fixtures/                        # Test data & utilities
│   │   ├── users.json
│   │   ├── elections.json
│   │   └── helpers.js
│   └── README.md                        # Test infrastructure guide
│
├── scripts/                             # Operations & development
│   ├── deployment/                      # Deployment automation
│   │   ├── deploy-service.sh            # Deploy specific service
│   │   ├── deploy-all.sh                # Deploy all services
│   │   ├── rollback.sh                  # Rollback procedure
│   │   └── cloud-build-trigger.sh       # GCP Cloud Build setup
│   ├── operations/                      # Day-to-day operations
│   │   ├── meeting-day-checklist.sh     # Pre-meeting validation
│   │   ├── database-backup.sh           # Database operations
│   │   ├── export-results.sh            # Export voting results
│   │   ├── member-import.sh             # Import member list
│   │   └── health-check.sh              # Service health monitoring
│   ├── maintenance/                     # Maintenance & cleanup
│   │   ├── cleanup-old-data.sh          # Archive old elections
│   │   ├── migrate-schema.sh            # Database migrations
│   │   ├── refresh-permissions.sh       # Update RBAC policies
│   │   └── audit-cleanup.sh             # Archive audit logs
│   ├── testing/                         # Test automation
│   │   ├── run-unit-tests.sh            # Run unit tests
│   │   ├── run-integration-tests.sh     # Run integration tests
│   │   ├── run-e2e-tests.sh             # Run E2E tests
│   │   ├── run-load-tests.sh            # Run performance tests
│   │   ├── run-security-tests.sh        # Run security tests
│   │   └── test-report.sh               # Generate test reports
│   ├── development/                     # Developer tools
│   │   ├── setup-dev-env.sh             # Local dev setup
│   │   ├── run-local.sh                 # Run services locally
│   │   ├── seed-database.sh             # Seed test data
│   │   └── generate-types.sh            # Generate TypeScript types
│   └── README.md                        # Scripts guide
│
├── docs/                                # Architecture & operations docs
│   ├── architecture/                    # System design
│   │   ├── SYSTEM_OVERVIEW.md           # High-level architecture
│   │   ├── SERVICE_BOUNDARIES.md        # Service responsibilities
│   │   ├── DATA_FLOW.md                 # Data flow diagrams
│   │   ├── DATABASE_SCHEMA.md           # DB structure reference
│   │   └── DEPLOYMENT_ARCHITECTURE.md   # Cloud infrastructure
│   ├── design/                          # Design decisions & ADRs
│   │   ├── ARCHITECTURE_DECISION_RECORDS.md  # All ADRs
│   │   ├── PHASE_5_DESIGN.md            # Current phase design
│   │   ├── PHASE_6_ROADMAP.md           # Future roadmap
│   │   ├── MULTI_TENANCY_DESIGN.md      # Multi-tenancy architecture
│   │   └── RBAC_MODEL.md                # Role-based access control
│   ├── operations/                      # Day-to-day operations
│   │   ├── OPERATIONAL_PROCEDURES.md    # Standard procedures
│   │   ├── MEETING_DAY_RUNBOOK.md       # Election day operations
│   │   ├── INCIDENT_RESPONSE.md         # Incident handling
│   │   ├── DATABASE_OPERATIONS.md       # DB maintenance
│   │   ├── BACKUP_RESTORE.md            # Disaster recovery
│   │   └── MONITORING_ALERTS.md         # Monitoring setup
│   ├── security/                        # Security & compliance
│   │   ├── SECURITY_OVERVIEW.md         # Security architecture
│   │   ├── THREAT_MODEL.md              # Threat analysis
│   │   ├── SECURITY_CHECKLIST.md        # Security requirements
│   │   ├── AUDIT_LOGGING.md             # Audit procedures
│   │   ├── SECRET_MANAGEMENT.md         # Credential handling
│   │   └── INCIDENT_LOG.md              # Historical incidents
│   ├── guides/                          # How-to guides
│   │   ├── GETTING_STARTED.md           # Developer onboarding
│   │   ├── LOCAL_DEVELOPMENT.md         # Local dev setup
│   │   ├── SERVICE_DEPLOYMENT.md        # How to deploy
│   │   ├── ADDING_NEW_SERVICE.md        # Template for new services
│   │   ├── ADDING_NEW_FUNCTION.md       # Template for new functions
│   │   ├── TESTING_GUIDE.md             # How to write tests
│   │   ├── DEBUG_GUIDE.md               # Debugging procedures
│   │   └── MULTI_AGENT_WORKFLOW.md      # Multi-agent workflow
│   ├── roadmap/                         # Planning & roadmap
│   │   ├── EPIC_24_PLAN.md              # Admin API epic (40h)
│   │   ├── PHASE_6_PLAN.md              # Phase 6 features (roadmap)
│   │   ├── PHASE_7_PLAN.md              # Phase 7 features (future)
│   │   └── REPOSITORY_REORGANIZATION.md # This plan (final version)
│   ├── status/                          # Operational status tracking
│   │   ├── CURRENT_PRODUCTION_STATUS.md # Live status
│   │   ├── PERFORMANCE_METRICS.md       # Performance tracking
│   │   ├── COST_ANALYSIS.md             # Cost tracking
│   │   └── DEPLOYMENT_HISTORY.md        # Deployment log
│   ├── DOCUMENTATION_MAP.md             # Master index (updated)
│   └── DECISIONS.md                     # Quick decision reference
│
├── infrastructure/                      # Infrastructure as Code
│   ├── terraform/                       # Terraform modules
│   │   ├── main.tf
│   │   ├── services.tf
│   │   ├── database.tf
│   │   ├── networking.tf
│   │   ├── monitoring.tf
│   │   └── variables.tf
│   ├── gcp/                             # GCP-specific configs
│   │   ├── cloud-run-service-template.yaml
│   │   ├── cloud-function-template.yaml
│   │   └── firestore-security-rules.json
│   ├── k8s/                             # Kubernetes configs (future)
│   │   ├── services/
│   │   ├── deployments/
│   │   └── kustomization.yaml
│   └── README.md                        # Infrastructure guide
│
├── tools/                               # Developer tools & utilities
│   ├── cli/                             # Custom CLI tools
│   │   ├── ekklesia-cli.js
│   │   ├── commands/
│   │   └── README.md
│   └── docker/                          # Docker configurations
│       ├── Dockerfile.dev               # Local development
│       ├── Dockerfile.test              # Testing
│       ├── docker-compose.yml           # Multi-service compose
│       └── README.md
│
├── archive/                             # Historical reference
│   ├── zitadel-legacy/                  # Old auth system
│   ├── portal-evaluation/               # Old portal code
│   ├── migration-logs/                  # Historical logs
│   └── README.md                        # Archive guide
│
├── .github/                             # GitHub configuration
│   ├── workflows/                       # CI/CD workflows
│   │   ├── test.yml                     # Test automation
│   │   ├── deploy.yml                   # Deployment automation
│   │   ├── security-scan.yml            # Security scanning
│   │   └── coverage.yml                 # Code coverage
│   └── ISSUE_TEMPLATE/                  # Issue templates
│
├── .gitignore                           # Updated for new structure
├── DOCUMENTATION_MAP.md                 # MASTER INDEX (updated)
├── README.md                            # Root overview (updated)
├── package.json                         # Monorepo root (if using)
├── docker-compose.yml                   # Local dev environment
└── CONTRIBUTING.md                      # Contribution guide (new)
```

---

## Detailed Reorganization Breakdown

### Phase 1: Service Structure (1 week)

**Goal**: Prepare for Epic #24 (Admin APIs) by establishing clear service boundaries

**Tasks**:

1. **Create `services/` directory** and reorganize:
   - Move `members/` → `services/members/`
   - Move `events/` → `services/events/`
   - Move `elections/` → `services/elections/`
   - Create structure for 6 future services (templates)

2. **Create `functions/` directory**:
   - Extract Cloud Functions from `members/functions/` → `functions/handleKenniAuth/`
   - Extract Cloud Functions → `functions/verifyMembership/`
   - Create function deployment automation

3. **Create `shared/` directory** with utilities:
   - `shared/auth/` - Firebase client, JWT validation, HMAC signing
   - `shared/db/` - PostgreSQL connection pooling, query builders
   - `shared/logging/` - Structured JSON logger, audit schema
   - `shared/types/` - TypeScript types for all services
   - `shared/constants/` - Shared enums, constants

**Effort**: ~8 hours (moving files, updating imports)

**Risk**: High (affects imports across all services)

**Mitigation**:
- Create backup before starting
- Update imports in careful phases
- Test each service after moving

---

### Phase 2: Testing Infrastructure (1 week)

**Goal**: Build comprehensive test suite for Epic #24 (RBAC, audit logging, admin operations)

**Tasks**:

1. **Create `tests/` structure**:
   - `tests/unit/` - Per-service unit tests
   - `tests/integration/` - Cross-service tests (S2S auth, audit flow)
   - `tests/e2e/` - Full voting flow, admin operations
   - `tests/security/` - CSRF, injection, S2S auth
   - `tests/performance/` - Spike scenarios (300 votes/sec)

2. **Create test utilities** (`tests/fixtures/`):
   - Mock data for elections, members, votes
   - Test helpers (database seeding, cleanup)
   - Test database connection

3. **Add CI/CD workflows** (`.github/workflows/`):
   - `test.yml` - Run all tests on every PR
   - `security-scan.yml` - Security scanning
   - `coverage.yml` - Code coverage reporting

**Effort**: ~12 hours (writing test infrastructure, not all tests)

**Deliverables**:
- Test framework ready
- CI/CD pipeline configured
- ~10 example tests as template

---

### Phase 3: Documentation Reorganization (1 week)

**Goal**: Make documentation easier to navigate for Epic #24 developers

**Tasks**:

1. **Reorganize `docs/`**:
   - Split `design/` into focused ADR files
   - Move operational docs to `operations/`
   - Consolidate security docs
   - Create `guides/` for how-to articles
   - Keep status tracking separate

2. **Create master navigation**:
   - Update `DOCUMENTATION_MAP.md` with new structure
   - Create quick-reference decision guide
   - Add cross-links between related docs

3. **Add developer guides**:
   - `GETTING_STARTED.md` - Onboarding for new developers
   - `LOCAL_DEVELOPMENT.md` - Local dev setup
   - `SERVICE_DEPLOYMENT.md` - How to deploy
   - `ADDING_NEW_SERVICE.md` - Template for new services

**Effort**: ~8 hours (reorganizing, rewriting guides)

**Deliverables**:
- Clear documentation navigation
- Reduced onboarding time
- Developer guides for common tasks

---

### Phase 4: Scripts & Operations (1 week)

**Goal**: Make scripts clear and organized for both developers and operators

**Tasks**:

1. **Organize `scripts/`**:
   - `scripts/deployment/` - Service deployment automation
   - `scripts/operations/` - Day-to-day operations
   - `scripts/maintenance/` - Periodic maintenance
   - `scripts/testing/` - Test automation
   - `scripts/development/` - Developer tools

2. **Create script documentation**:
   - Add header comments to all scripts explaining purpose
   - Create `scripts/README.md` with descriptions
   - Add safety checks (backups before destructive operations)

3. **Add helper utilities**:
   - `scripts/lib/common.sh` - Shared functions
   - `scripts/lib/colors.sh` - Output formatting
   - `scripts/lib/validation.sh` - Input validation

**Effort**: ~6 hours (organizing, documenting)

**Deliverables**:
- Clear script organization
- Self-documenting scripts
- Safer operations automation

---

### Phase 5: Infrastructure & Deployment (1 week)

**Goal**: Establish IaC and deployment patterns for future services

**Tasks**:

1. **Create `infrastructure/`**:
   - Terraform modules for common patterns
   - GCP configuration templates
   - Cloud Run service templates
   - Cloud Function templates

2. **Document deployment architecture**:
   - Service deployment flow
   - Database schema management
   - Secret management
   - Monitoring configuration

3. **Create CI/CD automation**:
   - Cloud Build triggers
   - Deployment pipelines
   - Rollback procedures

**Effort**: ~10 hours (infrastructure setup, documentation)

**Deliverables**:
- IaC foundation for services
- Deployment automation
- Clear deployment process

---

### Phase 6: Archive & Cleanup (1 week)

**Goal**: Organize legacy code for reference without cluttering main repo

**Tasks**:

1. **Organize `archive/`**:
   - Group legacy code by age/component
   - Add README to each archive section
   - Create index of what was replaced/why

2. **Clean up root directory**:
   - Move loose files to appropriate locations
   - Remove deprecated configurations
   - Update `.gitignore`

3. **Add top-level guides**:
   - Update root `README.md` with new structure
   - Create `CONTRIBUTING.md` for contributors
   - Add quick links to getting started

**Effort**: ~6 hours (organizing, cleaning, documenting)

**Deliverables**:
- Clean root directory
- Well-organized archive
- Clear contribution guidelines

---

## Implementation Timeline & Effort

### Approach Options

#### Option A: Sequential (Traditional)
- **Timeline**: 5-6 weeks (one person, one phase per week)
- **Cost**: High token usage
- **Risk**: Changes sit longer, more merge conflicts
- **Quality**: Good (time for thorough testing)

#### Option B: Multi-Agent Workflow (Recommended)
- **Timeline**: 2-3 weeks (Haiku + Sonnet in parallel)
- **Cost**: 30-40% lower than Option A
- **Risk**: Reduced (parallel validation, QA phase)
- **Quality**: Excellent (strategic planning + execution + review)

**Recommended**: Option B using the Multi-Agent Workflow:

```
Week 1 (Sonnet Analysis + Planning):
  - Analyze current structure
  - Identify dependencies
  - Create detailed reorganization prompt

Week 1-2 (Haiku Execution):
  - Phase 1: Service structure (files, imports)
  - Phase 2: Testing infrastructure
  - Phase 3: Documentation reorganization
  - Phase 4: Scripts organization
  - Phase 5: Infrastructure setup

Week 2 (Sonnet QA):
  - Verify all imports correct
  - Check git status clean
  - Run tests pass
  - Validate documentation links
```

**Total Effort Estimate**:
- Planning & Analysis: 6-8 hours (Sonnet)
- Execution: 40-50 hours (Haiku)
- QA & Fixes: 6-8 hours (Sonnet)
- **Total**: 52-66 hours (~2-3 weeks with multi-agent)

---

## Success Criteria

### Before Reorganization
```
✗ Epic #24 blocked by unclear service structure
✗ No clear testing patterns for 15 new issues
✗ Developers can't find things in docs
✗ Scripts purpose unclear
✗ Hard to onboard new contributors
✗ No foundation for multi-tenancy
```

### After Reorganization
```
✓ Clear service boundaries for Epic #24 work
✓ Comprehensive testing infrastructure ready
✓ Developers can navigate docs easily
✓ Scripts well-organized and documented
✓ New contributors can get started in < 2 hours
✓ Multi-tenancy foundation established
✓ Repository scales to 9+ services
✓ Zero broken references
✓ All tests pass
✓ Git history clean
```

### Verification Checklist
- [ ] All services in `services/` with proper isolation
- [ ] All Cloud Functions in `functions/` directory
- [ ] `shared/` library provides reusable utilities
- [ ] All imports updated and working
- [ ] Test suite complete with CI/CD integration
- [ ] Documentation navigation improved
- [ ] Scripts organized and documented
- [ ] Infrastructure patterns established
- [ ] All links (relative/documentation) working
- [ ] Git log shows clean, logical commits
- [ ] Repository size tracked (should decrease or stay same)
- [ ] All tests passing
- [ ] Zero broken service deployments

---

## Risks & Mitigations

### High Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Import breaks across services** | Services fail to start | Use multi-agent workflow: test each phase, systematic QA |
| **Documentation links broken** | Developers lost | Automated link checking, QA verification |
| **Merge conflicts** | Hours wasted resolving | Work in parallel phases, sequential commits to main |
| **Git history complexity** | Hard to track changes | Clean, logical commits per phase |
| **Services go down during migration** | Outage during work | Run during low-traffic window, quick rollback plan |

### Medium Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Tests fail after move** | Unclear if structure change broke things | Run full test suite after each phase |
| **Developer confusion** | People not sure where things are | Clear guides, README updates, team communication |
| **Incomplete migration** | Some code left in old locations | Systematic phase completion with verification |

### Mitigations

1. **Backup-First Approach** (Phase 0)
   - Full tarball backup before starting
   - Ability to restore in minutes

2. **Phased Execution**
   - Complete one phase fully before next
   - Test each phase independently
   - Merge to main after each phase success

3. **Multi-Agent Workflow**
   - Sonnet does analysis + strategic planning
   - Haiku does execution with exact commands
   - Sonnet does systematic QA verification
   - Reduces errors by 2-3x vs single-agent

4. **Parallel Verification**
   - Tests run after each phase
   - Documentation links checked
   - Imports validated
   - Git status clean

5. **Communication & Documentation**
   - Team notification before starting
   - Regular status updates
   - Clear documentation of changes
   - Rollback plan if needed

---

## Post-Reorganization Benefits

### Immediate (Epic #24 Ready)
- Clear structure for 15 new admin API issues
- Testing patterns established
- Shared utilities reduce code duplication
- Documentation easy to navigate
- Developers unblock quickly

### Short-term (Phase 6 Ready)
- Ready to add 5+ new services without refactoring
- Multi-tenancy foundation in place
- Infrastructure patterns established
- CI/CD automation ready
- Observability infrastructure ready

### Long-term (Multi-Tenant Platform)
- Scale to 9-12 services without restructuring
- Support multiple organizations
- Maintain code quality as platform grows
- Attract contributors (clear structure)
- Enterprise-grade operations

---

## Decision Points for Implementation

### Before Starting

1. **Timing**: Run after Phase 5 is stable? (Recommended: Yes, before Epic #24 starts)
2. **Team Communication**: Notify all developers? (Recommended: Yes)
3. **Backup Strategy**: Full tarball or git-based? (Recommended: Both)
4. **Workflow Approach**: Single-agent or multi-agent? (Recommended: Multi-agent for speed/quality)

### During Execution

1. **Rollback Plan**: If critical issue found, abort and restore? (Recommended: Yes)
2. **Testing Gates**: Require all tests pass before proceeding? (Recommended: Yes)
3. **Code Review**: Require review of changes? (Recommended: Yes)
4. **Deployment**: Deploy to production immediately or wait? (Recommended: Deploy after QA passes)

---

## Next Steps

1. **Get Team Agreement**
   - Present this draft plan to team
   - Get feedback on structure
   - Adjust based on priorities

2. **Detailed Planning** (Sonnet Analysis)
   - Full dependency analysis
   - Detailed file move list
   - Import update script
   - Rollback procedure

3. **Create Execution Prompt** (Sonnet → Haiku)
   - Detailed instructions per phase
   - Exact commands to run
   - Verification steps after each phase
   - Success criteria

4. **Execute & Review**
   - Haiku does systematic execution
   - Sonnet does QA verification
   - Deploy when QA passes

---

## Questions for Team

1. Is the proposed structure clear and aligned with your vision?
2. Any services missing from the future roadmap?
3. Should we expand infrastructure/IaC planning?
4. Are there other shared utilities we should include?
5. Should we use monorepo tools (Lerna, Nx) or keep simpler?
6. Timeline: Start after Phase 5 stabilization?
7. Preferred testing framework (Jest, Mocha, other)?
8. Should we add TypeScript to the migration?

---

## Related Documents

- [Epic #24 Implementation Plan](./EPIC_24_IMPLEMENTATION_PLAN.md) - Admin API work (depends on this)
- [Architecture Design Phase 6](../design/ARCHITECTURE_DESIGN_PHASE6.md) - Infrastructure roadmap
- [Multi-Agent Workflow](../guides/MULTI_AGENT_WORKFLOW.md) - Execution methodology
- [Current Production Status](../status/CURRENT_PRODUCTION_STATUS.md) - Baseline for changes

---

**Version**: 1.0 Draft
**Last Updated**: 2025-10-21
**Author**: Analysis based on exploration of issues, roadmap, and current structure
**Status**: Ready for team review and decision
**Next Action**: Get team feedback, finalize approach, begin detailed planning
