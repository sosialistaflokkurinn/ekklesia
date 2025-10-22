# Ekklesia Repository Directory Structure

**Last Updated**: 2025-10-21 (Restructuring Phase)

This document provides a complete overview of the repository organization after the Phase 4-5 restructuring.

---

## 📂 Root Level Structure

```
ekklesia/
├── services/                    ← Backend services (members, events, elections)
├── apps/                        ← Frontend applications
├── docs/                        ← Project documentation
├── infrastructure/              ← Infrastructure-as-Code (Terraform, Cloud Run)
├── testing/                     ← E2E tests & test utilities
├── scripts/                     ← Deployment & maintenance scripts
├── archive/                     ← Deprecated/historical code
├── .github/                     ← GitHub workflows & templates
├── README.md                    ← Project overview
├── DIRECTORY.md                 ← This file
└── [config files]               ← .gitignore, package.json, etc.
```

---

## 🏢 Services (`/services/`)

Core backend microservices for Ekklesia voting platform.

### `services/members/`
**Members Portal + Authentication Service**
- Location: `/services/members/`
- Runtime: Firebase Hosting + Cloud Functions
- Purpose: User authentication (Kenni.is OAuth), profile management
- Key Files:
  - `public/` - Firebase Hosting static assets (HTML/CSS/JS)
  - `functions/` - Cloud Functions (handleKenniAuth, verifyMembership)
  - `setup-scripts/` - Deployment helpers
- Dependencies: Firebase SDK, Node.js 18
- Status: ✅ Production (Phase 4)

### `services/events/`
**Events Service - Voting API**
- Location: `/services/events/`
- Runtime: Node.js 18 + Express on Cloud Run
- Purpose: Manage elections, issue voting tokens, track participation
- Key Files:
  - `src/` - Express.js application code
  - `migrations/` - Database migration scripts
  - `Dockerfile` - Cloud Run container config
  - `deploy.sh` - Deployment script
- Dependencies: Node.js 18, PostgreSQL 15, Firebase Admin SDK
- Status: ✅ Production (Phase 5 MVP)

### `services/elections/`
**Elections Service - Ballot Recording**
- Location: `/services/elections/`
- Runtime: Node.js 18 + Express on Cloud Run
- Purpose: Record anonymous ballots, prevent double-voting, calculate results
- Key Files:
  - `src/` - Express.js application code
  - `migrations/` - Database schema
  - `Dockerfile` - Cloud Run container
  - `deploy.sh` - Deployment script
- Dependencies: Node.js 18, PostgreSQL 15
- Status: ✅ Production (Phase 5 MVP)

### `services/shared/` (Future)
**Shared Utilities & Libraries** (Phase 6+)
- Purpose: Shared code across services (auth wrappers, logging, testing utilities)
- Expected: Database utilities, logging framework, shared SDKs

---

## 🎨 Applications (`/apps/`)

Frontend user interfaces for Ekklesia.

### `apps/members-portal/` (Planned)
**Members Portal UI**
- Current Location: `apps/members-portal/` (will consolidate)
- Purpose: Member dashboard, profile, election discovery, voting interface
- Technology: HTML5, ES6 JavaScript, CSS3 (BEM methodology)
- Hosted: Firebase Hosting (ekklesia-prod-10-2025.web.app)
- Status: ✅ Active (in services/members - to be moved)

### `apps/admin-dashboard/` (Phase 6)
**Admin Election Management UI**
- Purpose: Admin interface for creating/managing elections
- Technology: React/Vue (TBD)
- Status: 📋 Planned

### `apps/public-voting/` (Phase 7)
**Public Voting Interface**
- Purpose: Public voting page (non-members, if applicable)
- Status: 📋 Planned

---

## 📚 Documentation (`/docs/`)

Comprehensive project documentation organized by purpose.

### `docs/architecture/`
**System Design & Architecture**
- `SYSTEM_ARCHITECTURE_OVERVIEW.md` - Complete system design
- `ARCHITECTURE_DESIGN_PHASE6.md` - Scaling plans for Phase 6+
- `ARCHITECTURE_RECOMMENDATIONS.md` - Technical recommendations
- `EVENTS_SERVICE_MVP.md` - Events service design
- `CSS_DESIGN_SYSTEM.md` - UI/UX component library

### `docs/features/`
**Feature Documentation** (tied to GitHub Issues/Epics)
- `election-discovery/` - Issue #87 (member election discovery)
- `admin-election-lifecycle/` - Issue #24 (admin election management)
- `membership-sync/` - Issue #43 (Django integration)
- `election-voting/` - Core voting flow

Each feature folder contains:
- User stories & requirements
- Technical design
- API specifications
- Test plans
- Implementation status

### `docs/development/`
**Developer Guides & Workflows**
- `guides/github/` - GitHub workflow (issues, PRs, project management)
- `guides/git/` - Git workflow (branching, commits, history)
- `guides/admin/` - Admin operations (deployments, backups, monitoring)
- `guides/infrastructure/` - GCP setup and configuration
- `guides/troubleshooting/` - Common issues and solutions
- `guides/workflows/` - Development processes (multi-agent workflow, etc.)

### `docs/operations/`
**DevOps & Deployment** (Phase 6)
- `deployment/` - Cloud Run deployment procedures
- `monitoring/` - Health checks and alerting
- `incident-response/` - Emergency procedures
- `backup-recovery/` - Disaster recovery plans

### `docs/security/`
**Security & Compliance**
- `policies/` - Security standards and requirements
- Audit logging configuration
- Threat models & defense analysis
- Compliance documentation (GDPR, audit trails, etc.)

### `docs/reference/`
**Technical Reference** (Phase 5+)
- `api-endpoints.md` - All service API documentation
- `database-schema.md` - PostgreSQL schema (auto-generated)
- `glossary.md` - Terms and definitions

### `docs/status/`
**Project Status & Tracking**
- `CURRENT_PRODUCTION_STATUS.md` - Live system status
- `ongoing/` - Active work in progress
- `historical/` - Historical records by date

### `docs/roadmap/`
**Phase Planning & Roadmaps**
- `REPO_RESTRUCTURING_PLAN.md` - Repository reorganization plan
- `PHASE_5_ROADMAP.md` - Phase 5 timeline and features
- Other phase plans

### `docs/design/` (Legacy)
**Legacy Design Documents**
- INDEX.md - Index of remaining design docs
- Other design-specific documents
- ⚠️ Being consolidated into architecture/

### `docs/guides/` (Being Reorganized)
- Currently in transition to `docs/development/guides/`

### `docs/testing/`
**Testing Documentation & Reports**
- Test plans and procedures
- Test execution reports
- E2E test documentation

### `docs/integration/`
**External Integration Docs**
- Kenni.is integration guide
- Firebase integration documentation
- Third-party API documentation

### `docs/maintenance/`
**Maintenance & Utilities**
- Database maintenance procedures
- Backup/restore utilities
- Migration scripts documentation

---

## 🏗️ Infrastructure (`/infrastructure/`)

Infrastructure-as-Code and deployment configuration.

```
infrastructure/
├── terraform/          ← Terraform configurations (Phase 6+)
├── cloud-run/          ← Cloud Run service configurations
│   ├── events-service.yaml
│   ├── elections-service.yaml
│   └── members-service.yaml
└── sql/                ← Database configurations
    ├── migrations/     ← SQL migration scripts
    └── schemas/        ← Schema definitions
```

### Current Infrastructure
- **Hosting**: Firebase Hosting (members portal)
- **Compute**: Cloud Run (events, elections services)
- **Functions**: Cloud Functions (handleKenniAuth, verifyMembership)
- **Database**: Cloud SQL PostgreSQL 15 (europe-west2)
- **Auth**: Firebase Authentication + Kenni.is OAuth
- **Storage**: Firebase Storage (membership list)

---

## 🧪 Testing (`/testing/`)

Centralized test utilities, fixtures, and E2E tests.

```
testing/
├── e2e/                ← End-to-end test scripts
├── fixtures/           ← Test data & mocks
└── scripts/            ← Test automation & runners
```

---

## 🛠️ Scripts (`/scripts/`)

Deployment, maintenance, and utility scripts organized by function.

```
scripts/
├── admin/              ← Admin utilities (audits, documentation fixes)
├── database/           ← Database operations (psql wrappers, backups)
├── deployment/         ← Deployment helpers (Cloud Run, git hooks)
├── monitoring/         ← Health checks, monitoring scripts
├── git-hooks/          ← Git pre-commit hooks
└── README.md           ← Script documentation
```

### Key Scripts
- `deployment/install-git-hooks.sh` - Setup pre-commit hooks
- `deployment/get-secret.sh` - Retrieve secrets from Secret Manager
- `database/psql-cloud.sh` - Connect to Cloud SQL
- `admin/*.py` - Documentation audits and validation

---

## 📦 Archive (`/archive/`)

Historical, deprecated, and legacy code (not tracked in production).

```
archive/
├── docs-legacy/        ← Deprecated documentation
├── docs-reviews/       ← Code review reports
├── projects/           ← Legacy projects (Ekklesia Platform evaluation)
└── phase-1-3/         ← Historical project notes
```

### Contents
- Legacy ZITADEL authentication (deprecated)
- Old Portal service (deprecated)
- Historical project notes
- Evaluation reports

---

## .github/

GitHub-specific configuration and workflows.

```
.github/
├── workflows/          ← GitHub Actions workflows (CI/CD)
└── ISSUE_TEMPLATE/     ← Issue templates for bug reports, features, etc.
```

---

## 📋 Configuration Files (Root)

| File | Purpose |
|------|---------|
| `.gitignore` | Git ignore rules (excludes docs/audits, scripts local-only, etc.) |
| `.gitignore.example` | Example gitignore for reference |
| `package.json` | Project metadata & shared dependencies |
| `package-lock.json` | Dependency lock file |
| `README.md` | Project overview & getting started |
| `DOCUMENTATION_MAP.md` | Complete documentation index |
| `.env.example` | Environment variable template |
| `.code-rules` | Claude Code configuration (local only) |

---

## 🗂️ File Naming Conventions

### Documentation Files
- **Format**: `UPPERCASE_WITH_UNDERSCORES.md`
- **Examples**:
  - `SYSTEM_ARCHITECTURE_OVERVIEW.md` ✅
  - `EVENTS_SERVICE_MVP.md` ✅
  - `CURRENT_PRODUCTION_STATUS.md` ✅
  - `Getting Started.md` ❌ (wrong - should be GETTING_STARTED.md)

### Scripts
- **Shell scripts**: `lowercase-with-dashes.sh`
  - `install-git-hooks.sh` ✅
  - `get-secret.sh` ✅
- **Python scripts**: `lowercase_with_underscores.py`
  - `audit_documentation.py` ✅
  - `validate_links.py` ✅
- **JavaScript files**: `camelCase.js` or `kebab-case.js`
  - `config.js` or `database-config.js` ✅

### Directories
- **Format**: `lowercase-with-dashes/`
- **Examples**:
  - `services/` ✅
  - `git-hooks/` ✅
  - `cloud-run/` ✅
  - `database-config/` ❌ (should be at root level, not nested)

---

## 🔄 Phase Evolution

### Phase 4 (Current - Oct 2025)
- ✅ Members service (Firebase)
- ✅ Events service (MVP)
- ✅ Elections service (MVP)
- ✅ Security hardening
- ✅ Repository restructuring

### Phase 5 (Nov 2025)
- Admin election lifecycle
- Member election discovery
- RBAC implementation
- Audit logging

### Phase 6 (Dec 2025 - Q1 2026)
- Admin API service
- Membership sync service
- Public voting interface
- Monitoring & alerting

### Phase 7+ (Future)
- Advanced RBAC
- Analytics dashboard
- Multi-language support
- API versioning

---

## 🔗 Quick Navigation

**I want to...**
- Understand the system → [SYSTEM_ARCHITECTURE_OVERVIEW.md](./docs/architecture/SYSTEM_ARCHITECTURE_OVERVIEW.md)
- Contribute code → [Git Workflow](./docs/development/guides/git/README.md)
- Deploy a service → [Infrastructure Guide](./docs/development/guides/infrastructure/README.md)
- Find a specific feature → [Features Directory](./docs/features/)
- Report a security issue → [Security Policies](./docs/security/policies/)
- Check production status → [CURRENT_PRODUCTION_STATUS.md](./docs/status/CURRENT_PRODUCTION_STATUS.md)

---

**Last Updated**: 2025-10-21 (Post-Restructuring)
**Maintained By**: Ekklesia Development Team
**Repository**: [github.com/sosialistaflokkurinn/ekklesia](https://github.com/sosialistaflokkurinn/ekklesia)
