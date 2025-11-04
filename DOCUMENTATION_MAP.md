# 🗺️ Ekklesia Platform - Master Documentation Map

**Version**: 8.1.0
**Last Updated**: 2025-11-04
**Status**: ✅ Phase 5 Complete - Full Voting System Operational (Members ✅ + Events ✅ + Elections ✅) + Epic #159 Profile & Admin UI Implementation + Comprehensive Documentation Organization (120+ docs indexed)

---

## 📍 Quick Navigation

### 🚀 **Getting Started**
- [Project Overview](#project-overview)
- [Current Status](#current-status)
- [Repository Structure](#-repository-structure) ⭐ **NEW** - Complete repo guide
- [Documentation Structure](#documentation-structure)
- [Quick Links by Role](#quick-links-by-role)

### 📚 **Documentation Directories**
- [/docs/ - Architecture & Plans](#docs-directory)
- [/services/ - Backend Services](#-services-directory-services)
- [/apps/ - Frontend Apps](#-applications-directory-apps)
- [/testing/ - Tests & Reports](#-testing-directory-testing)
- [/scripts/ - Deployment Scripts](#%EF%B8%8F-scripts-directory-scripts)
- [/archive/ - Archived Code](#-archive-directory-archive)

---

## Project Overview

**Ekklesia** is a democratic participation platform for Sósíalistaflokkur Íslands (Socialist Party of Iceland), providing:

- **Secure Authentication**: National eID (Kenni.is) integration via Firebase/Identity Platform
- **Member Portal**: View profile, roles, and participate in party activities
- **Voting System**: Anonymous democratic decision-making platform
- **Event Management**: Election and event administration with voting token issuance
- **Elections Service**: Anonymous ballot recording with S2S integration

### Technology Stack

| Component | Technology | Status |
|-----------|-----------|--------|
| **Identity Provider** | Firebase/Identity Platform | ✅ Production (Free Tier) |
| **National eID** | Kenni.is OAuth PKCE | ✅ Production |
| **Members Service** | Firebase Hosting + Python Cloud Functions | ✅ Production |
| **Membership Verification** | Firebase Storage + Cloud Functions | ✅ Production (2,273 members) |
| **Events Service** | Node.js + Express on Cloud Run | ✅ Production (Oct 9-10) |
| **Elections Service** | Node.js + Express on Cloud Run | ✅ Production (Oct 9-10) |
| **Database** | Cloud SQL PostgreSQL 15 | ✅ Production (2 schemas: public, elections) |
| **Cloud Functions** | Python 3.11 (Gen 2) | ✅ Production (2 functions) |
| **Infrastructure** | Firebase + Cloud Run | ✅ Production |
| **Region** | europe-west2 (London) | ✅ Production |

---

## Current Status

### ✅ Production Services (October 11, 2025)

**Phase 5 Integration Complete** - Full end-to-end voting system operational (Oct 10, 2025)
**Documentation Cleanup Complete** - Status docs archived, code audit completed (Oct 11, 2025)

| Component | Status | URL/Service |
|-----------|--------|-------------|
| **Firebase/Identity Platform** | ✅ Production | ekklesia-prod-10-2025 (Free Tier) |
| **Firebase Hosting** | ✅ Production | https://ekklesia-prod-10-2025.web.app |
| **handleKenniAuth** | ✅ Production | Cloud Function (512 MB) |
| **verifyMembership** | ✅ Production | Cloud Function (256 MB) |
| **Members Service** | ✅ Production | Firebase-based (kennitala auth) |
| **Events Service** | ✅ Production | https://events-service-ymzrguoifa-nw.a.run.app |
| **Elections Service** | ✅ Production | https://elections-service-ymzrguoifa-nw.a.run.app |
| **Cloud SQL** | ✅ Production | ekklesia-db (PostgreSQL 15, 2 schemas) |

**Cost**: ~$7-13/month (Members $0, Events $0-3, Elections $0-3, Cloud SQL ~$7)

### 🔨 Current Work

- **Phase 5**: ✅ Complete (Oct 10, 2025)
  - S2S integration between Events and Elections services
  - Token registration via S2S API
  - Results fetching via S2S API
  - End-to-end voting flow operational
  - See: Phase 5 Integration (archived)
- **Phase 6**: Next phase (load testing)
  - 300 votes/second spike test
  - Cloud Run auto-scaling verification
  - Database connection pool testing
  - See: `docs/development/guides/workflows/USAGE_CONTEXT.md`, `docs/design/ARCHITECTURE_DESIGN_PHASE6.md`

### 📋 Recent Milestones (October 2025)

**Oct 15, 2025 - Members Frontend Architecture Refactor Complete**
- ✅ Introduced shared Firebase service layer (`apps/members-portal/firebase/app.js`)
- ✅ Converted session/auth logic into pure modules (`members/public/session/`)
- ✅ Added validated DOM + navigation helpers (`members/public/ui/`)
- ✅ Refactored all portal pages to modular architecture (`*.new.js` → `*.js`)
- 📄 Documentation: `apps/members-portal/archive/ARCHITECTURE_REFACTOR.md`, `apps/members-portal/archive/FRONTEND_AUDIT_2025-10-15.md`

**Oct 13, 2025 - Firebase App Check Implementation (Members Service Only)**
- ✅ **App Check Deployment**: reCAPTCHA Enterprise integration for **Members service**
  - Members: Full client-side implementation (token acquisition + transmission)
  - Events: Middleware created (`verifyAppCheckOptional`) but NOT actively enforcing
  - Elections: NOT implemented yet (planned for future)
  - Zero-cost security layer for Members (within 10K free tier)
  - Client-side attestation (bot detection, origin validation)
  - CORS configuration for App Check tokens
  - Status: Members in monitoring mode (1-2 weeks before enforcement)
  - Performance impact: +145 ms first login (cached thereafter)
- ✅ **Comprehensive Documentation**: Academic research paper created
  - 62-page technical analysis (FIREBASE_APP_CHECK_RESEARCH.md)
  - Cost-benefit analysis (vs Cloudflare Pro, Cloud LB)
  - Threat model assessment (appropriate for risk profile)
  - Implementation guide with all code listings
  - Lessons learned and deployment troubleshooting
- 📄 Documentation: `docs/security/current/FIREBASE_APP_CHECK_RESEARCH.md` (replaces 3 legacy docs)

**Oct 12, 2025 - Security Hardening Complete (Phase 1-3)**
- ✅ **Phase 1**: Firestore Security Rules deployed (#30)
- ✅ **Phase 1**: CSRF Protection deployed (#33)
- ✅ **Phase 1**: Idempotency Fix deployed (#32)
- ✅ **Phase 2**: Cloudflare rate limiting deployed (#31)
  - Combined rate limiting rule (100 req/10sec across all 4 services)
  - Origin protection middleware (Node.js + Python)
  - DNS configuration via Cloudflare (auth.si-xj.org, api.si-xj.org, vote.si-xj.org, verify.si-xj.org)
  - SSL/TLS Full (strict) encryption
- ✅ **Phase 3**: Automation script created (scripts/cloudflare-setup.sh, 843 lines)
- ✅ **Phase 3**: Git pre-commit hook for rule enforcement
- ✅ All critical security vulnerabilities fixed
- 📄 Documentation: Security hardening plan (archived)

**Oct 11, 2025 - Documentation Cleanup & Code Audit Complete**
- ✅ Code audit completed comparing implementation vs documentation
- ✅ Documentation cleanup: 5 files archived to organized structure
- ✅ Status documents updated with archive references
- ✅ Archive README and status/README created
- ✅ All cross-references validated
- 📄 Documentation: Code audit and summary (archived)

**Oct 10, 2025 - Phase 5: Elections + Events Integration Complete**
- ✅ Elections S2S client implemented (token registration + results fetching)
- ✅ Events service updated with S2S integration
- ✅ Test page enhanced with voting interface
- ✅ End-to-end voting flow tested and verified
- ✅ Production deployment complete (events-service-00002-dj7)
- ✅ Comprehensive documentation created
- 📄 Documentation: Phase 5 Integration Complete (archived)

**Oct 9, 2025 - Elections Service MVP Deployed to Production**
 📄 Documentation: Elections deployment, events testing, database hardening (all archived)
- ✅ Multi-page portal: dashboard, profile, test pages
- ✅ Documentation deep review and validation
- 📄 Documentation: `docs/status/CURRENT_DEVELOPMENT_STATUS.md`

**Oct 7, 2025 - Return to Original Vision**
- ✅ Ekklesia platform evaluated and archived (472 files)
- ✅ Events service design document created
- ✅ Original election-focused architecture restored
- 📄 Documentation: `docs/design/SYSTEM_ARCHITECTURE_OVERVIEW.md`

**Oct 6-7, 2025 - Firebase Migration (ZITADEL Removed)**
- ✅ Migrated from ZITADEL to Firebase/Identity Platform
- ✅ Direct Kenni.is OAuth PKCE integration
- ✅ Custom token authentication with kennitala claims
- ✅ Members service operational with Firebase auth
- ✅ ZITADEL infrastructure decommissioned
- ✅ Cost savings: $135/month → $7-10/month
- 📄 Documentation: Firebase migration status (archived)

---

## 📂 Repository Structure

Complete overview of repository organization (consolidated from DIRECTORY.md).

### Root Level

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
├── DOCUMENTATION_MAP.md         ← This file (master documentation index)
└── [config files]               ← .gitignore, package.json, etc.
```

### 🏢 Services Directory (`/services/`)

**Backend microservices** for Ekklesia voting platform.

#### `services/members/`
- **Purpose**: Members Portal + Authentication Service
- **Runtime**: Firebase Hosting + Cloud Functions
- **Key Features**: Kenni.is OAuth, profile management, membership verification
- **Status**: ✅ Production (Phase 4)

#### `services/events/`
- **Purpose**: Events Service - Election administration & voting token issuance
- **Runtime**: Node.js 18 + Express on Cloud Run
- **Key Features**: Election management, token issuance, audit trail
- **Status**: ✅ Production (Phase 5 MVP)

#### `services/elections/`
- **Purpose**: Elections Service - Anonymous ballot recording
- **Runtime**: Node.js 18 + Express on Cloud Run
- **Key Features**: Anonymous voting, double-vote prevention, result calculation
- **Status**: ✅ Production (Phase 5 MVP)

### 🎨 Applications Directory (`/apps/`)

**Frontend interfaces** for Ekklesia.

#### `apps/members-portal/`
- **Purpose**: Member dashboard, election discovery, voting interface
- **Technology**: HTML5, ES6 JavaScript, CSS3 (BEM methodology)
- **Hosted**: Firebase Hosting (ekklesia-prod-10-2025.web.app)
- **Status**: ✅ Active

### 🛠️ Scripts Directory (`/scripts/`)

**Deployment, maintenance, and utility scripts** organized by function.

```
scripts/
├── admin/              ← Admin utilities (audits, documentation fixes)
├── database/           ← Database operations (psql wrappers, backups)
├── deployment/         ← Deployment helpers (Cloud Run, git hooks)
├── git-hooks/          ← Git pre-commit hooks (security scanning)
└── README.md           ← Script documentation
```

**Key Scripts**:
- `deployment/install-git-hooks.sh` - Setup pre-commit hooks
- `deployment/get-secret.sh` - Retrieve secrets from Secret Manager
- `database/psql-cloud.sh` - Connect to Cloud SQL
- `admin/*.py` - Documentation audits and validation

### 🧪 Testing Directory (`/testing/`)

**Centralized test utilities, fixtures, and E2E tests.**

```
testing/
├── integration/        ← Integration test scripts
├── reports/           ← Test execution reports & checklists
└── INDEX.md           ← Testing documentation index
```

### 🏗️ Infrastructure Directory (`/infrastructure/`)

**Infrastructure-as-Code and deployment configuration.**

```
infrastructure/
├── terraform/          ← Terraform configurations (Phase 6+)
├── cloud-run/          ← Cloud Run service configurations
└── sql/                ← Database configurations & migrations
```

**Current Infrastructure**:
- **Hosting**: Firebase Hosting (members portal)
- **Compute**: Cloud Run (events, elections services)
- **Functions**: Cloud Functions (handleKenniAuth, verifyMembership)
- **Database**: Cloud SQL PostgreSQL 15 (europe-west2)
- **Auth**: Firebase Authentication + Kenni.is OAuth
- **Storage**: Firebase Storage (membership list)

### 📦 Archive Directory (`/archive/`)

**Historical, deprecated, and legacy code** (not in production).

```
archive/
├── docs/               ← Archived documentation (organized by date)
├── research/           ← Research papers and evaluations
└── phase-1-3/         ← Historical project notes
```

### 📋 Configuration Files (Root)

| File | Purpose |
|------|---------|
| `.gitignore` | Git ignore rules (excludes __pycache__, *.pyc, local configs) |
| `package.json` | Project metadata & shared dependencies |
| `README.md` | Project overview & getting started |
| `DOCUMENTATION_MAP.md` | This file - complete documentation index |
| `.code-rules` | Claude Code configuration (local only) |

### 🗂️ File Naming Conventions

**Documentation Files**: `UPPERCASE_WITH_UNDERSCORES.md`
- Examples: `SYSTEM_ARCHITECTURE_OVERVIEW.md`, `CURRENT_PRODUCTION_STATUS.md`

**Shell Scripts**: `lowercase-with-dashes.sh`
- Examples: `install-git-hooks.sh`, `get-secret.sh`

**Python Scripts**: `lowercase_with_underscores.py`
- Examples: `audit_documentation.py`, `validate_links.py`

**Directories**: `lowercase-with-dashes/`
- Examples: `git-hooks/`, `cloud-run/`

---

## Documentation Structure

```
ekklesia/
├── DOCUMENTATION_MAP.md              ⭐ YOU ARE HERE - Master index
├── test-voting-flow.sh               🧪 End-to-end voting flow test script
│
├── docs/                             📄 Architecture & Plans
│   ├── SYSTEM_ARCHITECTURE_OVERVIEW.md 🏗️ Primary architectural vision
│   ├── USAGE_CONTEXT.md              📊 Load patterns and capacity planning
│   ├── OPERATIONAL_PROCEDURES.md     📋 Meeting day operations manual
│   │
│   ├── status/                       📊 Production status & deployment logs
│   │   ├── CURRENT_PRODUCTION_STATUS.md        📊 Production infrastructure status
│   │   └── README.md                           📖 Status docs guide
│   │       • Full history available in archive
│   │
│   ├── security/                     🔐 Security runbooks & research
│   │   ├── CREDENTIAL_MIGRATION_PLAN.md        Credentials migration strategy
│   │   └── FIREBASE_APP_CHECK_RESEARCH.md      📚 Comprehensive research paper (67K, 62 pages)
│   │       • All other security docs available in archive
│   │
│   ├── debugging/                    🧪 Debug notes (placeholder directory)
│   │
│   └── archived-snapshot/            🗄️ Legacy reference set (Oct 13, 2025)
│       • Location: archive directory
│       • Includes design, guides, specifications, plans, and database reference
│
├── members/                          👤 Members Service (Production)
│   ├── src/                          💻 Application code (legacy)
│   ├── functions/                    ☁️ Cloud Functions (Python 3.11)
│   │   └── main.py                   handleKenniAuth & verifyMembership
│   ├── public/                       🎨 Static assets & test pages
│   │   ├── index.html                Login page
│   │   ├── dashboard.html            Member dashboard
│   │   ├── profile.html              Member profile
│   │   ├── test-events.html          Events service test page (with voting)
│   │   ├── styles/                   Component CSS
│   │   ├── js/                       JavaScript modules
│   │   └── i18n/                     Icelandic translations
│   ├── data/                         📊 Membership data
│   │   └── kennitalas.txt            Verified member kennitalas (not in git)
│   ├── firebase.json                 Firebase configuration
│   ├── .firebaserc                   Firebase project config
│   ├── package.json                  Node.js dependencies
│   └── README.md                     📖 Service documentation
│
├── events/                           🎫 Events Service (Production Oct 9-10, 2025)
│   ├── src/                          💻 Node.js application
│   │   ├── index.js                  Express server entry point
│   │   ├── config/                   Configuration modules
│   │   │   ├── database.js           Cloud SQL connection pool
│   │   │   └── firebase.js           Firebase Admin SDK
│   │   ├── middleware/               Express middleware
│   │   │   └── auth.js               JWT authentication middleware
│   │   ├── services/                 Business logic
│   │   │   ├── electionService.js    Election management
│   │   │   ├── tokenService.js       Token generation (with S2S)
│   │   │   └── electionsClient.js    Elections S2S client (Phase 5)
│   │   └── routes/                   API routes
│   │       └── election.js           Election endpoints (with S2S)
│   ├── migrations/                   🗄️ Database migrations
│   │   ├── 001_initial_schema.sql    Initial schema (election + voting_tokens)
│   │   ├── 002_remove_elections_service_id.sql  Cleanup migration
│   │   ├── run-migration.sh          Migration runner
│   │   └── README.md                 Migration documentation
│   ├── Dockerfile                    🐳 Container image definition
│   ├── .dockerignore                 Docker ignore rules
│   ├── deploy.sh                     🚀 Cloud Run deployment script
│   ├── .env.example                  Environment variable template
│   ├── .env                          Local development environment (not in git)
│   ├── package.json                  Node.js dependencies
│   ├── test-production.html          Production test page (legacy)
│   └── README.md                     📖 Service documentation
│
├── elections/                        🗳️ Elections Service (Production Oct 9-10, 2025)
│   ├── src/                          💻 Node.js application
│   │   ├── index.js                  Express server entry point
│   │   ├── config/                   Configuration modules
│   │   │   └── database.js           Cloud SQL connection pool
│   │   ├── middleware/               Express middleware
│   │   │   ├── auth.js               Token-based authentication
│   │   │   └── s2sAuth.js            S2S API key authentication
│   │   ├── services/                 Business logic
│   │   │   ├── ballotService.js      Ballot recording (anonymous)
│   │   │   └── tokenService.js       Token validation and management
│   │   └── routes/                   API routes
│   │       ├── vote.js               Public voting endpoints
│   │       └── s2s.js                S2S endpoints (register-token, results)
│   ├── migrations/                   🗄️ Database migrations
│   │   ├── 001_initial_schema.sql    Elections schema (voting_tokens, ballots, audit_log)
│   │   ├── run-migration.sh          Migration runner
│   │   └── README.md                 Migration documentation
│   ├── Dockerfile                    🐳 Container image definition
│   ├── .dockerignore                 Docker ignore rules
│   ├── deploy.sh                     🚀 Cloud Run deployment script
│   ├── .env.example                  Environment variable template
│   ├── .env                          Local development environment (not in git)
│   ├── package.json                  Node.js dependencies
│   └── README.md                     📖 Service documentation
│
└── archive/                          📦 Archived Code & Documentation
    ├── audits/                       Code audits (superseded versions)
    ├── deployments/                  Historical deployment docs
    ├── migrations/                   Historical migration docs
    ├── testing-logs/                 Historical testing logs
    ├── members-service/              Members development history (Oct 2025)
    ├── documentation/                Historical docs (ZITADEL-era)
    ├── ekklesia-platform-evaluation/ Platform evaluation (Oct 7)
    ├── zitadel-legacy/               ZITADEL infrastructure
    └── README.md                     Archive index and rationale
```

---

## /docs/ Directory

**Purpose**: Architecture documentation, plans, and production status

### 📖 Overview & Reference

**Top-level documentation** providing project context and navigation.

| Document | Purpose | Status |
|----------|---------|--------|
| `README.md` | Documentation hub - entry point with learning paths by role | ✅ Current (Nov 4) |
| `INDEX.md` | Comprehensive documentation index | ✅ Current (Oct 20) |
| `ENVIRONMENT_CLARIFICATION.md` | Production tools vs development system clarification | ✅ Current (Oct 15) |
| `SCRIPT_IMPROVEMENTS_APPLIED.md` | Script improvements and automation enhancements | ✅ Current (Oct 23) |

### 🏗️ Architecture Documents

| Document | Purpose | Status |
|----------|---------|--------|
| `ARCHITECTURE_DESIGN_PHASE6.md` | Phase 6 architecture design (5 challenges, ADRs, roadmap) | ✅ Current (Oct 13) |
| `architecture/ARCHITECTURE_RECOMMENDATIONS.md` | Architecture recommendations from AI analysis and audits | ✅ Current (Oct 15) |
| `SYSTEM_ARCHITECTURE_OVERVIEW.md` | Primary architectural vision (3-service architecture) | ✅ Active (Oct 10) |
| `USAGE_CONTEXT.md` | Load patterns and capacity planning (300 votes/sec) | ✅ Active (Oct 9) |
| `OPERATIONAL_PROCEDURES.md` | Meeting day operations manual (scaling, monitoring) | ✅ Active (Oct 9) |
| `DATABASE_REFERENCE.md` | Complete database reference (schemas, tables, security) | ✅ Active (Oct 9) |
| `design/INDEX.md` | Design documentation master index | ✅ Current (Oct 20) |

### 📐 Code Standards & Style Guides

**Required reading for all developers.** Unified code standards establishing patterns, conventions, and best practices across the Ekklesia codebase.

| Document | Purpose | Status |
|----------|---------|--------|
| `docs/CODE_STANDARDS.md` | **Master index** - Overview of all code standards and quick reference | ✅ Current (Nov 4) |
| `docs/standards/CSS_BEM_GUIDE.md` | CSS methodology with BEM naming, design system, component patterns | ✅ Current (Nov 4) |
| `docs/standards/HTML_GUIDE.md` | Semantic HTML5, accessibility (WCAG 2.1 AA), ARIA patterns | ✅ Current (Nov 4) |
| `docs/standards/JAVASCRIPT_GUIDE.md` | ES6+ standards, async/await, modules, JSDoc conventions | ✅ Current (Nov 4) |
| `docs/standards/I18N_GUIDE.md` | Internationalization with R.string pattern (Android-style XML) | ✅ Current (Nov 4) |
| `docs/standards/DATA_QUALITY_UX.md` | User experience principles, validation, auto-correction patterns | ✅ Current (Nov 4) |
| `docs/standards/DOCUMENTATION_GUIDE.md` | Writing JSDoc, READMEs, ADRs, and code comments | ✅ Current (Nov 4) |
| `docs/standards/GIT_WORKFLOW_GUIDE.md` | Git branching strategy, conventional commits, PR process | ✅ Current (Nov 4) |
| `docs/standards/QUALITY_TESTING_GUIDE.md` | Testing philosophy, unit/integration/E2E, pre-commit hooks | ✅ Current (Nov 4) |

**Tooling**: `.eslintrc.json`, `.prettierrc.json`, `.github/pull_request_template.md`

### 📊 Status & Deployment Documents

| Document | Purpose | Status |
|----------|---------|--------|
| `status/CURRENT_PRODUCTION_STATUS.md` | Production infrastructure status (all services) | ✅ Current (Oct 15) |
| `status/README.md` | Status documents guide and index | ✅ Current (Oct 11) |
| `status/EPIC24_CURRENT_STATUS.md` | Epic #24 current implementation status | ✅ Current (Oct 24) |
| `status/EPIC24_FIXES_COMPREHENSIVE_SUMMARY.md` | Epic #24 fixes comprehensive summary | ✅ Current (Oct 24) |
| `status/EPIC24_MIGRATION_VERIFICATION_PLAN.md` | Epic #24 migration verification plan | ✅ Current (Oct 24) |
| `status/ongoing/README.md` | Ongoing status documents index | ✅ Current (Oct 20) |
| `status/ongoing/ELECTIONS_SCHEMA_MIGRATION_CHECKLIST.md` | Elections schema migration verification | ✅ Current (Oct 20) |
| `status/historical/README.md` | Historical status documents index | ✅ Current (Oct 19) |
| `status/historical/2025-10-16/README.md` | Oct 16 incidents index | ✅ Current (Oct 16) |
| `status/historical/2025-10-16/LOGIN_INCIDENT.md` | Login incident postmortem (Oct 16) | ✅ Current (Oct 16) |
| `status/historical/2025-10-19/README.md` | Oct 19 sessions index | ✅ Current (Oct 19) |
| `status/historical/2025-10-19/SESSION_Phase5_Validation_Prep.md` | Phase 5 validation prep session notes | ✅ Current (Oct 19) |
| `status/historical/2025-10-27-audit/SESSION_AUDIT_2025-10-27.md` | Session audit Oct 27 | ✅ Current (Oct 27) |
| `status/historical/2025-10-27-audit/members-area-audit.md` | Members area audit | ✅ Current (Oct 27) |
| `status/historical/2025-10-27-audit/scripts-audit-report.md` | Scripts audit report | ✅ Current (Oct 27) |
| `status/historical/2025-10-27-audit/security_audit_summary.md` | Security audit summary | ✅ Current (Oct 27) |
| `status/historical/2025-10-27-audit/setup-scripts-audit.md` | Setup scripts audit | ✅ Current (Oct 27) |
| `status/historical/2025-10-27-audit/testing-directory-audit.md` | Testing directory audit | ✅ Current (Oct 27) |

### 🧪 Testing Documentation

| Document | Purpose | Status |
|----------|---------|--------|
| `testing/EPIC_43_MEMBER_SYNC_TEST_REPORT.md` | Epic #43 member sync test report | ✅ Current (Oct 27) |
| `audits/historical/ARCHIVE-INFLATED-CLAIMS/AUDIT_2025-10-20.md` | Comprehensive documentation audit report | ✅ Current (Oct 20) |
| `audits/historical/ARCHIVE-INFLATED-CLAIMS/AUDIT_2025-10-20_DETAILED.md` | Detailed file-by-file audit analysis | ✅ Current (Oct 20) |
| `audits/historical/ARCHIVE-INFLATED-CLAIMS/LINK_VALIDATION_REPORT_2025-10-20.md` | Internal link validation and remediation plan | ✅ Current (Oct 20) |
| `operations/DOCUMENTATION_CHANGELOG.md` | Documentation version control and maintenance | ✅ Current (Oct 20) |
| `validate-links.py` | Link validation script for automated link checking | ✅ Current (Oct 20) |

### 📝 Reports & Documentation Maintenance

| Document | Purpose | Status |
|----------|---------|--------|
| `reports/DOCUMENTATION_UPDATE_REPORT.md` | Documentation update report and changelog | ✅ Current (Oct 21) |

### 📦 Archived Status Documents

| Document | Archived Date | Reason |
|----------|---------------|--------|
| `PHASE_5_INTEGRATION_COMPLETE.md` | Oct 13 | Historical integration log |
| `PR28_AGUST_COMPLETE_REVIEW.md` | Oct 13 | Historical PR review |
| `CODE_AUDIT_2025-10-11_REVISED.md` | Oct 13 | Historical code audit |
| `AUDIT_SUMMARY.md` | Oct 13 | Historical audit summary |
| `CLEANUP_PLAN.md` | Oct 13 | Historical cleanup plan |
| `ELECTIONS_SERVICE_DEPLOYMENT.md` | Oct 11 | Historical deployment log |
| `EVENTS_SERVICE_TESTING_LOG.md` | Oct 11 | Historical testing log |
| `DATABASE_SECURITY_HARDENING.md` | Oct 11 | Historical hardening log |
| `FIREBASE_MIGRATION_STATUS.md` | Oct 11 | Historical migration log |
| `CODE_AUDIT_2025-10-11.md` | Oct 11 | Superseded by revised version |

### 🔨 Service Design Documents

| Document | Purpose | Status |
|----------|---------|--------|
| `docs/architecture/CSS_DESIGN_SYSTEM.md` | CSS BEM design system and component documentation | ✅ Current (Oct 20) |
| `docs/setup/MEMBERS_DEPLOYMENT_GUIDE.md` | Members service deployment guide | ✅ Current (Oct 20) |

### 📖 Implementation Guides

| Document | Purpose | Status |
|----------|---------|--------|
| `docs/development/guides/INDEX.md` | Master index of all guide documentation | ✅ Current (Oct 20) |
| `docs/development/guides/workflows/PR29_CAMPAIGN_LEARNINGS.md` | PR#29 review campaign best practices | ✅ Current (Oct 20) |
| `docs/development/guides/admin/ADMIN_ALERTS.md` | Admin alerting procedures | ✅ Current (Oct 20) |
| `docs/development/guides/admin/AUDIT_LOGGING.md` | Audit logging configuration | ✅ Current (Oct 15) |
| `docs/development/guides/admin/MFA_ENFORCEMENT.md` | Multi-factor authentication setup | ✅ Current (Oct 20) |
| `docs/development/guides/troubleshooting/OAUTH_TROUBLESHOOTING.md` | OAuth troubleshooting guide | ✅ Current (Oct 20) |
| `docs/development/guides/infrastructure/PRIVATE_OPS_REPO.md` | Private operations repository guide | ✅ Current (Oct 20) |
| `docs/development/guides/admin/ROLES_AND_PERMISSIONS.md` | Role-based access control documentation | ✅ Current (Oct 15) |
| `docs/development/guides/github/GITHUB_ISSUE_LABEL_MANAGEMENT.md` | GitHub issue label management | ✅ Current (Oct 15) |
| `docs/development/guides/github/GITHUB_PROJECT_MANAGEMENT.md` | GitHub Project management with CLI | ✅ Current (Oct 15) |
| `docs/development/guides/github/GITHUB_PROJECT_MANAGEMENT.SUMMARY.md` | One-page summary of GitHub Project management | ✅ Current (Oct 20) |
| `docs/development/guides/github/GITHUB_PR_MANAGEMENT.md` | Complete PR management guide for gh CLI workflows | ✅ Current (Oct 15) |
| `docs/development/guides/github/GITHUB_PR_QUICK_REFERENCE.md` | One-page gh CLI cheat sheet for PR commands | ✅ Current (Oct 20) |
| `docs/development/guides/github/GITHUB_PR_REVIEW_REPLY_WORKFLOW.md` | GitHub PR review response workflow | ✅ Production-Tested (Oct 15) |
| `development/DATA_QUALITY_POLICY.md` | Data quality policy and UX principles (now at `standards/DATA_QUALITY_UX.md`) | ⚠️ Relocated (Nov 4) |
| `development/guides/CHROME_REMOTE_DEBUGGING.md` | Chrome DevTools remote debugging guide for Firebase hosting | ✅ Current (Oct 29) |
| `development/guides/CLAUDE_CODE_SETUP.md` | Claude Code AI assistant setup and configuration | ✅ Current (Oct 27) |
| `development/guides/DEBUG_LOGGING.md` | Debug logging strategies and Chrome console monitoring | ✅ Current (Oct 29) |
| `development/guides/GITIGNORE_STRATEGY.md` | Git ignore strategy and .gitignore management | ✅ Current (Oct 30) |
| `development/guides/GIT_IGNORE_STRATEGY.md` | Alternative git ignore strategy guide | ✅ Current (Oct 30) |
| `development/guides/README.md` | Development guides directory index | ✅ Current (Oct 20) |
| `development/guides/admin/README.md` | Admin guides directory index | ✅ Current (Oct 20) |
| `development/guides/git/ADVANCED_GIT_OPERATIONS.md` | Advanced git operations (rebase, squash, cherry-pick) | ✅ Current (Oct 23) |
| `development/guides/git/GIT_TROUBLESHOOTING_GUIDE.md` | Git troubleshooting and error recovery | ✅ Current (Oct 23) |
| `development/guides/git/GIT_WORKFLOW_EXAMPLES.md` | Git workflow examples and common patterns | ✅ Current (Oct 23) |
| `development/guides/infrastructure/README.md` | Infrastructure guides directory index | ✅ Current (Oct 20) |
| `development/guides/troubleshooting/README.md` | Troubleshooting guides directory index | ✅ Current (Oct 20) |
| `development/guides/workflows/MULTI_AGENT_WORKFLOW.md` | Multi-agent AI development workflow | ✅ Current (Oct 21) |
| `development/guides/workflows/README.md` | Workflow guides directory index | ✅ Current (Oct 21) |

### 📝 Security & Planning Documents

| Document | Purpose | Status |
|----------|---------|--------|
| `docs/security/policies/CREDENTIAL_MIGRATION_PLAN.md` | Credentials migration strategy | ✅ Current |
| `docs/security/current/CRITICAL_ACTIONS_LOG.md` | Critical actions audit log | ✅ Current (Oct 20) |
| `docs/security/historical/2025-10-16/CRITICAL_SECURITY_RESPONSE.md` | Critical security incident response | ✅ Current (Oct 20) |
| `docs/security/historical/2025-10-16/FUNCTIONS_AUDIT.md` | Cloud Functions security audit | ✅ Current (Oct 16) |
| `docs/security/policies/HISTORY_PURGE_PLAN.md` | Git history purging procedures | ✅ Current (Oct 20) |
| `docs/security/responses/ISSUES_31-40_SECURITY_REVIEW_RESPONSE.md` | Response to security issues #31-40 | ✅ Current (Oct 20) |
| `docs/security/responses/ISSUES_41-50_CRITICAL_REVIEW.md` | Critical review for security issues #41-50 | ✅ Current (Oct 20) |
| `docs/audits/workflows/reviews/CRITICAL_REVIEW_RESPONSE.md` | Critical review response document | ✅ Current (Oct 15) |

**Security Directory Structure:**
- `security/README.md`, `security/INDEX.md` - Security documentation index
- `security/current/README.md` - Current security issues index
- `security/historical/README.md`, `security/historical/2025-10-16/README.md` - Historical security audits indexes
- `security/policies/README.md` - Security policies index
- `security/responses/README.md` - Security responses index

### 📋 Audits & Quality Documentation

**Comprehensive audits** of code, documentation, and system quality.

**Audit Directory Structure:**
- `audits/README.md` - Main audits index and guide
- `audits/current/README.md`, `audits/current/findings/*`, `audits/current/reference/*`, `audits/current/supplementary/*` - Current audit findings and reports
- `audits/historical/README.md`, `audits/historical/ARCHIVE-INFLATED-CLAIMS/*` - Historical audits and archived claims
- `audits/planning/README.md` - Audit planning and corrective actions
- `audits/tools/README.md` - Audit tooling documentation
- `audits/workflows/README.md`, `audits/workflows/remediation/INDEX.md`, `audits/workflows/reviews/INDEX.md`, `audits/workflows/sessions/INDEX.md` - Audit workflows and processes

**Notable Audit Reports:**
- `audits/FRONTEND_CONSISTENCY_AUDIT_2025-10-23.md` - Frontend consistency audit (Oct 23)
- `audits/HAMBURGER_MENU_CODE_REVIEW_2025-10-23.md` - Hamburger menu code review (Oct 23)
- `audits/NAVIGATION_UPDATE_AUDIT_2025-10-23.md` - Navigation update audit (Oct 23)
- `audits/LATEST_AUDIT_LINK.md` - Link to most recent audit
- `audits/REORGANIZATION_GUIDE.md` - Audit reorganization guide

### 🔧 Setup & Operations Indexes

**Directory indexes** for setup and operations documentation.

| Document | Purpose | Status |
|----------|---------|--------|
| `setup/INDEX.md` | Setup documentation index | ✅ Current (Oct 20) |
| `operations/INDEX.md` | Operations documentation index | ✅ Current (Oct 20) |

### 💬 Prompt Templates

| Document | Purpose | Status |
|----------|---------|--------|

### 🎯 Features & Epics

**Epic-level feature documentation** for major development initiatives across the Ekklesia platform.

#### Election & Voting Features

| Document | Purpose | Status |
|----------|---------|--------|
| `features/election-voting/EPIC_24_ADMIN_LIFECYCLE.md` | Epic #24: Admin election lifecycle management (create, schedule, open, close, publish) | ✅ Current (Oct 22) |
| `features/election-voting/EPIC_43_MEMBER_MANAGEMENT_SYSTEM.md` | Epic #43: Membership sync with Django backend (hourly automatic sync) | ✅ Current (Oct 27) |
| `features/election-voting/EPIC_43_PHASE_2_IMPLEMENTATION.md` | Epic #43 Phase 2: Firestore members collection and Facebook events migration | ✅ Current (Oct 27) |
| `features/election-voting/EPIC_87_ELECTION_DISCOVERY.md` | Epic #87: Member election discovery & voting interface (complete) | ✅ Current (Oct 22) |
| `features/election-voting/PHASE_5_WEEK_1_IMPLEMENTATION.md` | Phase 5 Week 1 implementation details and task breakdown | ✅ Current (Oct 22) |
| `features/election-voting/PHASE_5_WEEK_1_MEMBER_UI.md` | Phase 5 Week 1 member UI implementation guide | ✅ Current (Oct 22) |
| `features/election-voting/ADMIN_API_REFERENCE.md` | Admin API endpoint reference documentation | ✅ Current (Oct 22) |
| `docs/features/election-voting/development-status.md` | Election voting features development status | ✅ Current (Oct 22) |

#### Admin Portal Features

| Document | Purpose | Status |
|----------|---------|--------|
| `features/admin-portal/EPIC_116_MEMBER_DETAIL_EDIT_PLAN.md` | Epic #116: Member detail & edit pages implementation plan | ✅ Current (Oct 29) |
| `features/admin-portal/DJANGO_TOKEN_CLOUD_FUNCTION.md` | Django API token management via Cloud Function | ✅ Current (Oct 27) |

### 📝 Roadmap & Future Plans

| Document | Purpose | Status |
|----------|---------|--------|
| `roadmap/PHASE_5_OVERVIEW.md` | Phase 5 overview: Three parallel epics (Admin UI, Membership Sync, Member Discovery) | ✅ Current (Oct 22) |

### 🐛 Bugfixes & Troubleshooting

**Incident reports, bug documentation, and resolution guides.**

| Document | Purpose | Status |
|----------|---------|--------|
| `bugfixes/MEMBER_EDIT_FORM_BUGS_2025_10_31.md` | Member edit form bugs discovered and fixed (Oct 31) | ✅ Current (Oct 31) |
| `troubleshooting/GIT_IGNORE_ISSUE_RESOLUTION.md` | Git ignore issues and resolution strategies | ✅ Current (Oct 30) |
| `troubleshooting/ROLE_LOSS_INCIDENT_2025-10-23.md` | Role loss incident postmortem (Oct 23) | ✅ Current (Oct 23) |
| `troubleshooting/SCHEMA_MISMATCH_EPIC_24_2025-10-23.md` | Schema mismatch issues in Epic #24 (Oct 23) | ✅ Current (Oct 23) |

### 🔧 Refactoring & Technical Debt

**Refactoring plans, code quality improvements, and technical requirements.**

| Document | Purpose | Status |
|----------|---------|--------|
| `refactoring/ADMIN_CARD_COMPONENT_DUPLICATION.md` | Admin card component duplication analysis and refactoring plan | ✅ Current (Oct 29) |
| `requirements/DJANGO_FOREIGN_ADDRESS_REQUIREMENTS.md` | Django foreign address requirements specification | ✅ Current (Oct 30) |

### 🔄 Migration & Data Management

**Database migrations, data cleanup, and schema changes.**

| Document | Purpose | Status |
|----------|---------|--------|
| `migration/DUPLICATE_SSN_CLEANUP_2025-10-26.md` | Duplicate SSN cleanup procedure (Oct 26) | ✅ Current (Oct 26) |

### 📦 Archived Documentation

**Status Documents** (archived Oct 11, 2025):

**ZITADEL-era documents** (deprecated Oct 6-7, 2025):

**Ekklesia Platform Evaluation** (archived Oct 7, 2025):
- Archive contains Ekklesia Portal and Voting codebase evaluation (400+ files)

**See**: Archive directory for historical code and evaluations

### 📋 PR Review Documentation

| Document | Purpose | Status |
|----------|---------|--------|

**Note**: Individual review responses are stored locally in `/tmp/batch*_response_*.md` during review campaigns.

### 🔗 Integration Documentation

**Django backend integration** - API connectivity, data synchronization, and migration strategies.

| Document | Purpose | Status |
|----------|---------|--------|
| `integration/DJANGO_ADDRESS_SYSTEM_DEEP_DIVE.md` | Complete guide to Django address architecture (1,106 lines) | ✅ Current (Nov 1) |
| `integration/DJANGO_DATABASE_SCHEMA.md` | Complete Django database schema and field mappings | ✅ Current (Oct 29) |
| `integration/DJANGO_API_IMPLEMENTATION.md` | Django API endpoint implementation guide | ✅ Current (Oct 29) |
| `integration/DJANGO_API_UPGRADE_EPIC_116.md` | Django API read/write changes for Epic #116 (includes address sync bug) | ✅ Current (Oct 29) |
| `integration/EPIC_116_MEMBERS_ADMIN_COMPLETION.md` | Epic #116 completion summary - Members admin UI and Django integration | ✅ Current (Nov 1) |
| `integration/DJANGO_TO_EKKLESIA_MIGRATION.md` | Long-term Django to Ekklesia migration strategy | ✅ Current |
| `integration/DJANGO_SYNC_IMPLEMENTATION.md` | Member synchronization process and implementation | ✅ Current |
| `integration/REYKJAVIK_ADDRESS_API_RESEARCH.md` | Research on Reykjavík address validation API | ✅ Current (Oct 30) |

### 🖥️ Systems & Infrastructure Documentation

**External systems, infrastructure, and operational documentation.**

| Document | Purpose | Status |
|----------|---------|--------|
| `systems/DJANGO_BACKEND_SYSTEM.md` | **Comprehensive Django backend system documentation** (1,199 lines) | ✅ Current (Nov 2) |
| `infrastructure/CLOUD_RUN_SERVICES.md` | Cloud Run services configuration and deployment reference (800 lines) | ✅ Current (Nov 1) |
| `operations/GITHUB_WORKFLOWS_STATUS.md` | GitHub Actions workflows status and configuration (563 lines) | ✅ Current (Oct 27) |

### 🗄️ Legacy Documentation

| Document | Purpose | Status |
|----------|---------|--------|

---

## /members/ Directory

**Purpose**: Members service - Production application (Firebase Hosting + Cloud Functions)

### Key Files

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `services/members/functions/main.py` | Cloud Functions (handleKenniAuth, verifyMembership) | ✅ Production |
| `services/members/functions/requirements.txt` | Python dependencies for Cloud Functions | ✅ Production |
| `members/public/` | Static assets (HTML, CSS, JS) | ✅ Production |
| `members/public/styles/` | Component CSS (global, nav, page, login, events-test) | ✅ Production |
| `apps/members-portal/firebase/app.js` | Shared Firebase initialization layer | ✅ Production (Oct 15) |
| `members/public/session/` | Pure session/auth modules (`auth.js`, `init.js`, `pkce.js`) | ✅ Production (Oct 15) |
| `members/public/ui/` | Validated DOM + navigation helpers | ✅ Production (Oct 15) |
| `apps/members-portal/js/login.js` | OAuth login module (PKCE) | ✅ Production |
| `apps/members-portal/js/dashboard.js` | Dashboard page module | ✅ Production |
| `apps/members-portal/js/profile.js` | Profile page module | ✅ Production |
| `apps/members-portal/js/test-events.js` | Test events page module | ✅ Production |
| `members/public/i18n/` | Icelandic internationalization | ✅ Production |
| `apps/members-portal/i18n/README.md` | Translation management notes | ✅ Current |
| `services/services/members/data/kennitalas.txt` | Verified member kennitalas (not in git) | ✅ Production |
| `services/services/members/firebase.json` | Firebase configuration | ✅ Production |
| `services/services/members/README.md` | Service overview and architecture | ✅ Current |
| `services/services/members/scripts/README.md` | Helper scripts documentation | ✅ Current (Oct 20) |
| `services/services/members/scripts/assign-role-to-me.sh` | Quick script to assign developer role to current user | ✅ Current (Oct 20) |
| `services/services/members/functions/test_security.sh` | Security testing script for Cloud Functions | ✅ Current (Oct 20) |

### Service Documentation

| Document | Purpose | Audience |
|----------|---------|----------|
| `services/services/members/README.md` | Service overview | All |

### Frontend Architecture Documentation

- `apps/members-portal/archive/ARCHITECTURE_REFACTOR.md` – Detailed old vs new architecture comparison and migration plan (Oct 15)
- `apps/members-portal/archive/FRONTEND_AUDIT_2025-10-15.md` – Audit of portal pages after refactor
- `apps/members-portal/CRITICAL_FIXES.md` – High-priority fixes and follow-ups
- `apps/members-portal/TESTING_GUIDE.md` – Browser testing steps for login/dashboard/profile/test-events

---

## /events/ Directory

**Purpose**: Events service - Production application (Cloud Run, Node.js + Express)

### Key Files

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `services/services/events/src/index.js` | Express server entry point | ✅ Production (Oct 10) |
| `services/services/events/src/services/electionsClient.js` | Elections S2S client (Phase 5) | ✅ Production (Oct 10) |
| `services/services/events/src/services/tokenService.js` | Token generation with S2S registration | ✅ Production (Oct 10) |
| `services/services/events/src/routes/election.js` | Election endpoints with S2S results | ✅ Production (Oct 10) |
| `services/services/events/src/config/database.js` | Cloud SQL connection pool | ✅ Production |
| `services/services/events/src/config/firebase.js` | Firebase Admin SDK | ✅ Production |
| `services/services/events/src/middleware/auth.js` | JWT authentication middleware | ✅ Production |
| `events/migrations/` | Database migrations (public schema) | ✅ Production |
| `services/services/events/migrations/README.md` | Migration documentation | ✅ Current |
| `services/services/events/migrations/run-migration.sh` | Migration runner helper | ✅ Current |
| `services/services/events/deploy.sh` | Cloud Run deployment script | ✅ Production (Oct 10) |
| `events/Dockerfile` | Container image definition | ✅ Production |
| `services/services/events/README.md` | Service documentation | ✅ Current |

### API Endpoints

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/health` | GET | Health check | ✅ Production |
| `/api/election` | GET | Election details | ✅ Production |
| `/api/request-token` | POST | Issue voting token (with S2S registration) | ✅ Production (Oct 10) |
| `/api/my-status` | GET | Participation status | ✅ Production |
| `/api/my-token` | GET | Retrieve token (disabled for security) | ✅ Production |
| `/api/results` | GET | Fetch results (via S2S from Elections) | ✅ Production (Oct 10) |

---

## /elections/ Directory

**Purpose**: Elections service - Production application (Cloud Run, Node.js + Express)

### Key Files

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `services/services/elections/src/index.js` | Express server entry point | ✅ Production (Oct 9) |
| `services/services/elections/src/routes/elections.js` | Public + S2S endpoints | ✅ Production |
| `services/services/elections/src/services/auditService.js` | Audit logging utilities | ✅ Production |
| `services/services/elections/src/config/database.js` | Cloud SQL connection pool | ✅ Production |
| `services/services/elections/src/middleware/s2sAuth.js` | S2S API key authentication | ✅ Production |
| `services/services/elections/src/middleware/appCheck.js` | Optional App Check enforcement | ✅ Current |
| `elections/migrations/` | Database migrations (elections schema) | ✅ Production |
| `services/services/elections/migrations/README.md` | Migration history | ✅ Current |
| `services/services/elections/deploy.sh` | Cloud Run deployment script | ✅ Production |
| `elections/Dockerfile` | Container image definition | ✅ Production |
| `services/services/elections/README.md` | Service documentation | ✅ Current |

### API Endpoints

| Endpoint | Method | Purpose | Auth | Status |
|----------|--------|---------|------|--------|
| `/health` | GET | Health check | None | ✅ Production |
| `/api/vote` | POST | Submit ballot | Voting token | ✅ Production |
| `/api/token-status` | GET | Check token validity | Voting token | ✅ Production |
| `/api/s2s/register-token` | POST | Register voting token (S2S) | API key | ✅ Production (Oct 10) |
| `/api/s2s/results` | GET | Fetch results (S2S) | API key | ✅ Production (Oct 10) |

### Database Schema (elections)

| Table | Purpose | PII |
|-------|---------|-----|
| `voting_tokens` | Token hash registry (one-time use) | ❌ No |
| `ballots` | Anonymous ballots (yes/no/abstain) | ❌ No |
| `audit_log` | System events (no member data) | ❌ No |

**Security Model**: Elections service has NO access to member identity. Only token hashes.

---

## /archive/ Directory

**Purpose**: Archived code and evaluations (local-only, not in git)

### Ekklesia Platform Evaluation

📦 **Archived** (Oct 7, 2025) - 472 files archived

**Reason**: Ekklesia Platform is designed for propositions/motions (policy development), not elections (candidate selection). Mismatch with original vision.

**Contents**:
- `portal/` - Ekklesia Portal codebase (400+ files)
- `voting/` - Ekklesia Voting codebase (60+ files)
- `README.md` - Evaluation summary and decision rationale

**See**: Archive directory for complete evaluation details

---

## Quick Links by Role

### 👨‍💻 **Developer - Building Features**

**Getting Started:**
1. Read: `docs/design/SYSTEM_ARCHITECTURE_OVERVIEW.md` (3-service architecture)
2. Review: `services/events/README.md` (Events service)
3. Review: `services/elections/README.md` (Elections service)
4. Setup: `docs/setup/MEMBERS_DEPLOYMENT_GUIDE.md` (deployment)
5. Study: `docs/design/ARCHITECTURE_DESIGN_PHASE6.md` (Phase 6 design and roadmap)

**Current Work:**
- Members Service (Production): `members/`
- Events Service (Production): `events/`
- Elections Service (Production): `elections/`
- Phase 6 (Next): Load testing (see `docs/development/guides/workflows/USAGE_CONTEXT.md`, `docs/design/ARCHITECTURE_DESIGN_PHASE6.md`)

### 🚀 **DevOps - Deploying & Operating**

**Getting Started:**
1. Read: `docs/status/CURRENT_DEVELOPMENT_STATUS.md` (production status)
2. Review: `docs/design/SYSTEM_ARCHITECTURE_OVERVIEW.md` (architecture)
3. Deploy Members: `firebase deploy --only hosting,functions` (from members/)
4. Deploy Events: `./deploy.sh` (from events/)
5. Deploy Elections: `./deploy.sh` (from elections/)

**Operations:**
- Operations Manual: `docs/operations/OPERATIONAL_PROCEDURES.md`
- Database Reference: See services/*/migrations/ for schema details
- Load Patterns: `docs/development/guides/workflows/USAGE_CONTEXT.md`

**Daily Work:**
- Production Status: `docs/status/CURRENT_DEVELOPMENT_STATUS.md`
- Phase 5 Status: See `docs/status/PHASE_5_WEEK_1_COMPLETION.md`

### 🏗️ **Architect - System Design**

**Getting Started:**
1. Read: `docs/design/SYSTEM_ARCHITECTURE_OVERVIEW.md` (primary architecture)
2. Review: `services/events/README.md` (Events service design)
3. Review: `services/elections/README.md` (Elections service design)
4. Study: `docs/development/guides/workflows/USAGE_CONTEXT.md` (load patterns and capacity planning)
5. Study: `docs/design/ARCHITECTURE_DESIGN_PHASE6.md` (Phase 6 design and roadmap)
6. Study: `docs/status/PHASE_5_WEEK_1_COMPLETION.md` (Phase 5 completion status)

**Daily Work:**
- Architecture: `docs/design/SYSTEM_ARCHITECTURE_OVERVIEW.md`
- Load Planning: `docs/development/guides/workflows/USAGE_CONTEXT.md`
- Operations: `docs/operations/OPERATIONAL_PROCEDURES.md`
- Database: See services/*/migrations/ for schema details
- Future Plans: `docs/roadmap/EPIC_24_IMPLEMENTATION_PLAN.md`

### 🆘 **On-Call - Handling Incidents**

**Emergency Quick Start:**
1. **Status**: `docs/status/CURRENT_DEVELOPMENT_STATUS.md` (what's running)
2. **Services**: Check Cloud Run services in GCP Console
   - Events: https://events-service-521240388393.europe-west2.run.app
   - Elections: https://elections-service-521240388393.europe-west2.run.app
3. **Logs**: Cloud Logging → Filter by service
4. **Firebase**: Firebase Console → Authentication → Users
5. **Database**: Cloud SQL Console → ekklesia-db

**Operational Procedures**: `docs/operations/OPERATIONAL_PROCEDURES.md`

**Common Issues:**
- Auth issues: Check Firebase Authentication logs
- Member verification: Check `members/functions/` logs in GCP
- Events/Elections issues: Check Cloud Run logs for respective service
- Database issues: Check Cloud SQL logs and connection pool

---

## Testing Tools

### End-to-End Test Script

**File**: `test-voting-flow.sh`

**Purpose**: Automated end-to-end voting flow test

**Usage**:
```bash
# Start Cloud SQL Proxy first
# (This script now uses the DB_CONNECTION_NAME from scripts/deployment/set-env.sh)
./scripts/database/start-proxy.sh

# Run test
./test-voting-flow.sh
```

**Tests**:
1. Cloud SQL Proxy connectivity
2. Token issuance (simulated)
3. S2S token registration (Elections service)
4. Vote submission
5. Vote verification (database)
6. Results fetching (S2S)

### Web Test Interface

**URL**: https://ekklesia-prod-10-2025.web.app/test-events.html

**Features**:
- Firebase authentication with Kenni.is
- Token request button
- Vote submission form (token input + yes/no/abstain dropdown)
- Results display button (fetches from Elections service via S2S)

---

## Documentation Maintenance

### Update Schedule

| Frequency | What to Update | Responsibility |
|-----------|----------------|----------------|
| **After Each Deployment** | docs/status/CURRENT_DEVELOPMENT_STATUS.md | DevOps |
| **After Service Changes** | Service README.md files | Developers |
| **After Architecture Changes** | DOCUMENTATION_MAP.md | Architects |
| **After Integration Work** | docs/status/PHASE_*.md | Developers |
| **Monthly** | Review all status docs | Tech lead |
| **Quarterly** | Full documentation audit | Team |

### Versioning Strategy

**This Document** (`DOCUMENTATION_MAP.md`):
- Major version (6.0.0) for Phase 5 completion (Elections service + S2S integration)
- Minor version for structural changes
- Patch version for content updates

**Status Documents**:
- Add "Last Updated" dates
- Update immediately after infrastructure changes
- Track changes in git commit messages

### Contributing to Documentation

1. **Before deploying**: Update deployment guide
2. **After deploying**: Update production status
3. **After incidents**: Document in service-specific docs
4. **Follow .code-rules**: Mask PII, no AI attribution

---

## External Resources

### Firebase / Identity Platform (Current)
- Identity Platform: https://cloud.google.com/identity-platform/docs
- Firebase Auth: https://firebase.google.com/docs/auth
- Admin SDK: https://firebase.google.com/docs/admin/setup
- Custom Tokens: https://firebase.google.com/docs/auth/admin/create-custom-tokens

### GCP Services
- Cloud Run: https://cloud.google.com/run/docs
- Cloud SQL: https://cloud.google.com/sql/docs/postgres
- Cloud Functions: https://cloud.google.com/functions/docs
- Secret Manager: https://cloud.google.com/secret-manager/docs
- Cloud Build: https://cloud.google.com/build/docs

### Authentication Standards
- OpenID Connect: https://openid.net/specs/openid-connect-core-1_0.html
- OAuth 2.0 PKCE: https://datatracker.ietf.org/doc/html/rfc7636
- Kenni.is: https://idp.kenni.is/

### Project
- GitHub Repository: https://github.com/sosialistaflokkurinn/ekklesia
- GitHub Issues: https://github.com/sosialistaflokkurinn/ekklesia/issues

---

## Support & Contact

### Cloud Services
- **Firebase Support**: https://firebase.google.com/support
- **GCP Support**: GCP Console → Support
- **Kenni.is Support**: https://idp.kenni.is/

### Emergency Contacts
- Production issues: Check GCP Cloud Run logs
- Firebase issues: Firebase Console → Authentication
- Database issues: Cloud SQL Console → ekklesia-db
- Operational procedures: `docs/operations/OPERATIONAL_PROCEDURES.md`

---

**Document Version**: 8.1.0
**Last Reviewed**: 2025-11-04
**Changes**: Major documentation organization update - Added 75+ new document references across 15 new sections: Code Standards (9 docs), Features & Epics (11 docs), Django Integration (8 docs), Systems & Infrastructure (3 docs), Development Guides (15 docs), Bugfixes & Troubleshooting (4 docs), Refactoring & Migration (3 docs), Status Documents (16 docs), Testing & Reports (2 docs), Overview & Reference (4 docs), Audits & Quality (50+ docs with structure), Security & Operations indexes
**Validated With**: validate_documentation_map.py (ongoing)
**Next Review**: 2026-02-04 (Quarterly)
