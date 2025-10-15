# 🗺️ Ekklesia Platform - Master Documentation Map

**Version**: 6.4.0
**Last Updated**: 2025-10-15
**Status**: ✅ Phase 5 Complete - Full Voting System Operational (Members ✅ + Events ✅ + Elections ✅) + Security Improvements + Frontend Architecture Refactor

---

## 📍 Quick Navigation

### 🚀 **Getting Started**
- [Project Overview](#project-overview)
- [Current Status](#current-status)
- [Documentation Structure](#documentation-structure)
- [Quick Links by Role](#quick-links-by-role)

### 📚 **Documentation Directories**
- [/docs/ - Architecture & Plans](#docs-directory)
- [/members/ - Members Service](#members-directory)
- [/events/ - Events Service](#events-directory)
- [/elections/ - Elections Service](#elections-directory)
- [/archive/ - Archived Code](#archive-directory)

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
  - See: `archive/docs/docs-2025-10-13/docs/status/PHASE_5_INTEGRATION_COMPLETE.md`
- **Phase 6**: Next phase (load testing)
  - 300 votes/second spike test
  - Cloud Run auto-scaling verification
  - Database connection pool testing
  - See: `docs/USAGE_CONTEXT.md`, `docs/ARCHITECTURE_DESIGN_PHASE6.md`

### 📋 Recent Milestones (October 2025)

**Oct 15, 2025 - Members Frontend Architecture Refactor Complete**
- ✅ Introduced shared Firebase service layer (`members/public/firebase/app.js`)
- ✅ Converted session/auth logic into pure modules (`members/public/session/`)
- ✅ Added validated DOM + navigation helpers (`members/public/ui/`)
- ✅ Refactored all portal pages to modular architecture (`*.new.js` → `*.js`)
- 📄 Documentation: `members/public/ARCHITECTURE_REFACTOR.md`, `members/public/FRONTEND_AUDIT_2025-10-15.md`

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
- 📄 Documentation: `docs/security/FIREBASE_APP_CHECK_RESEARCH.md` (replaces 3 legacy docs)

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
- 📄 Documentation: `archive/docs/docs-2025-10-13/docs/status/SECURITY_HARDENING_PLAN.md`, `archive/research/security/CLOUDFLARE_SETUP.md`

**Oct 11, 2025 - Documentation Cleanup & Code Audit Complete**
- ✅ Code audit completed comparing implementation vs documentation
- ✅ Documentation cleanup: 5 files archived to organized structure
- ✅ Status documents updated with archive references
- ✅ Archive README and status/README created
- ✅ All cross-references validated
- 📄 Documentation: `archive/docs/docs-2025-10-13/docs/status/CODE_AUDIT_2025-10-11_REVISED.md`
- 📄 Documentation: `archive/docs/docs-2025-10-13/docs/status/AUDIT_SUMMARY.md`

**Oct 10, 2025 - Phase 5: Elections + Events Integration Complete**
- ✅ Elections S2S client implemented (token registration + results fetching)
- ✅ Events service updated with S2S integration
- ✅ Test page enhanced with voting interface
- ✅ End-to-end voting flow tested and verified
- ✅ Production deployment complete (events-service-00002-dj7)
- ✅ Comprehensive documentation created
- 📄 Documentation: `archive/docs/docs-2025-10-13/docs/status/PHASE_5_INTEGRATION_COMPLETE.md`

**Oct 9, 2025 - Elections Service MVP Deployed to Production**
 📄 Documentation: `archive/ops/deployments/ELECTIONS_SERVICE_DEPLOYMENT.md`

 📄 Documentation: `archive/ops/testing-logs/EVENTS_SERVICE_TESTING_LOG.md`
 📄 Documentation: `archive/ops/deployments/DATABASE_SECURITY_HARDENING.md`
- ✅ Security posture documented
 📄 Documentation: `archive/ops/migrations/FIREBASE_MIGRATION_STATUS.md`
- ✅ Multi-page portal: dashboard, profile, test pages
- ✅ Documentation deep review and validation
- 📄 Documentation: `docs/status/CURRENT_PRODUCTION_STATUS.md`

**Oct 7, 2025 - Return to Original Vision**
- ✅ Ekklesia platform evaluated and archived (472 files)
- ✅ Events service design document created
- ✅ Original election-focused architecture restored
- 📄 Documentation: `docs/SYSTEM_ARCHITECTURE_OVERVIEW.md`

**Oct 6-7, 2025 - Firebase Migration (ZITADEL Removed)**
- ✅ Migrated from ZITADEL to Firebase/Identity Platform
- ✅ Direct Kenni.is OAuth PKCE integration
- ✅ Custom token authentication with kennitala claims
- ✅ Members service operational with Firebase auth
- ✅ ZITADEL infrastructure decommissioned
- ✅ Cost savings: $135/month → $7-10/month
- 📄 Documentation: `archive/ops/migrations/FIREBASE_MIGRATION_STATUS.md`

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
│   │       • Full history archived at `archive/docs/docs-2025-10-13/docs/status/`
│   │
│   ├── security/                     � Security runbooks & research
│   │   ├── CREDENTIAL_MIGRATION_PLAN.md        Credentials migration strategy
│   │   └── FIREBASE_APP_CHECK_RESEARCH.md      📚 Comprehensive research paper (67K, 62 pages)
│   │       • All other security docs archived at `archive/research/security/`
│   │
│   ├── debugging/                    🧪 Debug notes (placeholder directory)
│   │
│   └── archived-snapshot/            🗄️ Legacy reference set (Oct 13, 2025)
│       • Location: `archive/docs/docs-2025-10-13/docs/`
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

### 🏗️ Architecture Documents

| Document | Purpose | Status |
|----------|---------|--------|
| `ARCHITECTURE_DESIGN_PHASE6.md` | Phase 6 architecture design (5 challenges, ADRs, roadmap) | ✅ Current (Oct 13) |
| `SYSTEM_ARCHITECTURE_OVERVIEW.md` | Primary architectural vision (3-service architecture) | ✅ Active (Oct 10) |
| `USAGE_CONTEXT.md` | Load patterns and capacity planning (300 votes/sec) | ✅ Active (Oct 9) |
| `OPERATIONAL_PROCEDURES.md` | Meeting day operations manual (scaling, monitoring) | ✅ Active (Oct 9) |
| `DATABASE_REFERENCE.md` | Complete database reference (schemas, tables, security) | ✅ Active (Oct 9) |

### 📊 Status & Deployment Documents

| Document | Purpose | Status |
|----------|---------|--------|
| `status/CURRENT_PRODUCTION_STATUS.md` | Production infrastructure status (all services) | ✅ Current (Oct 15) |
| `docs/status/README.md` | Status documents guide | ✅ Current (Oct 11) |

### 🧪 Testing Documentation

| Document | Purpose | Status |
|----------|---------|--------|
| `docs/testing/END_TO_END_VOTING_FLOW_TEST.md` | End-to-end production voting flow validation (Oct 15, 2025) | ✅ Current (Oct 15) |

### 📦 Archived Status Documents

| Document | Archived Date | Reason | Location |
|----------|---------------|--------|----------|
| `PHASE_5_INTEGRATION_COMPLETE.md` | Oct 13 | Historical integration log | `archive/docs/docs-2025-10-13/docs/status/` |
| `PR28_AGUST_COMPLETE_REVIEW.md` | Oct 13 | Historical PR review | `archive/docs/docs-2025-10-13/docs/status/` |
| `CODE_AUDIT_2025-10-11_REVISED.md` | Oct 13 | Historical code audit | `archive/docs/docs-2025-10-13/docs/status/` |
| `AUDIT_SUMMARY.md` | Oct 13 | Historical audit summary | `archive/docs/docs-2025-10-13/docs/status/` |
| `CLEANUP_PLAN.md` | Oct 13 | Historical cleanup plan | `archive/docs/docs-2025-10-13/docs/status/` |
| `ELECTIONS_SERVICE_DEPLOYMENT.md` | Oct 11 | Historical deployment log | `archive/ops/deployments/` |
| `EVENTS_SERVICE_TESTING_LOG.md` | Oct 11 | Historical testing log | `archive/ops/testing-logs/` |
| `DATABASE_SECURITY_HARDENING.md` | Oct 11 | Historical hardening log | `archive/ops/deployments/` |
| `FIREBASE_MIGRATION_STATUS.md` | Oct 11 | Historical migration log | `archive/ops/migrations/` |
| `CODE_AUDIT_2025-10-11.md` | Oct 11 | Superseded by revised version | `archive/ops/audits/` |

### 🔨 Service Design Documents

| Document | Purpose | Status |
|----------|---------|--------|
| `archive/docs/docs-2025-10-13/docs/design/EVENTS_SERVICE_MVP.md` | Events service MVP design (token issuance, S2S) | 📦 Archived snapshot (Oct 13) |
| `archive/docs/docs-2025-10-13/docs/design/ELECTIONS_SERVICE_MVP.md` | Elections service MVP design (anonymous ballots, S2S) | 📦 Archived snapshot (Oct 13) |

### 📖 Implementation Guides
| Document | Purpose | Status |
**Automation**: `docs/guides/summarize-guides.sh` regenerates `docs/guides/INDEX.md` and summary tables.

|----------|---------|--------|
| `docs/guides/INDEX.md` | Master index of all guide documentation | ✅ Current (Oct 15) |
| `docs/guides/GITHUB_PR_REVIEW_REPLY_WORKFLOW.md` | GitHub PR review response workflow | ✅ Production-Tested (Oct 15) |
| `docs/guides/PR29_CAMPAIGN_LEARNINGS.md` | PR#29 review campaign best practices | ✅ Current (Oct 15) |
| `docs/guides/GITHUB_PR_MANAGEMENT.md` | Complete PR management guide for gh CLI workflows | ✅ Current (Oct 15) |
| `docs/guides/GITHUB_PR_QUICK_REFERENCE.md` | One-page gh CLI cheat sheet for PR commands | ✅ Current (Oct 15) |
| `docs/guides/GITHUB_PROJECT_MANAGEMENT.md` | GitHub Project management with CLI | ✅ Current (Oct 15) |
| `docs/guides/GITHUB_PROJECT_MANAGEMENT.SUMMARY.md` | One-page summary of the GitHub Project management workflow | ✅ Current (Oct 15) |
| `archive/docs/docs-2025-10-13/docs/guides/GITHUB_MCP_GUIDE.md` | GitHub MCP integration | 📦 Archived snapshot (Oct 13) |
| `archive/docs/docs-2025-10-13/docs/guides/MEMBERS_DEPLOYMENT_GUIDE.md` | Members service deployment | 📦 Archived snapshot (Oct 13) |
| `archive/docs/docs-2025-10-13/docs/guides/BRANCH_STRATEGY.md` | Git branching strategy | 📦 Archived snapshot (Oct 13) |
| `archive/docs/docs-2025-10-13/docs/guides/SECRET_MANAGER.md` | Secret Manager usage | 📦 Archived snapshot (Oct 13) |
| `archive/docs/docs-2025-10-13/docs/guides/VSCODE_DATABASE_SETUP.md` | VS Code PostgreSQL extension setup | 📦 Archived snapshot (Oct 13) |
| `archive/docs/docs-2025-10-13/docs/guides/DATABASE_QUICK_REFERENCE.md` | Database one-page cheat sheet | 📦 Archived snapshot (Oct 13) |

### 📝 Security & Planning Documents

| Document | Purpose | Status |
|----------|---------|--------|
| `docs/security/CREDENTIAL_MIGRATION_PLAN.md` | Credentials migration strategy | ✅ Current |
| `docs/ARCHITECTURE_RECOMMENDATIONS.md` | Architecture recommendations (AI analysis) | ✅ Current (Oct 15) |

### 💬 Prompt Templates

| Document | Purpose | Status |
|----------|---------|--------|
| `docs/prompts/BRANCH_DIFF_DOCUMENTATION_AUDIT.md` | Checklist prompt for auditing documentation changes in PR diffs | ✅ Current (Oct 15) |

### �📝 Future Plans

| Document | Purpose | Status | Estimated Effort |
|----------|---------|--------|------------------|
| `archive/docs/docs-2025-10-13/docs/plans/GOOGLE_AUTH_LINKING_PLAN.md` | Migrate to Google login after Kenni.is | � Archived snapshot (Oct 13) | 2-3 days |

### 📦 Archived Documentation

**Status Documents** (archived Oct 11, 2025):
- `archive/ops/audits/CODE_AUDIT_2025-10-11.md` - Initial audit (superseded)
- `archive/ops/deployments/ELECTIONS_SERVICE_DEPLOYMENT.md` - Elections deployment log
- `archive/ops/deployments/DATABASE_SECURITY_HARDENING.md` - Database hardening log
- `archive/ops/testing-logs/EVENTS_SERVICE_TESTING_LOG.md` - Events testing log
- `archive/ops/migrations/FIREBASE_MIGRATION_STATUS.md` - Firebase migration log
 - `archive/docs/docs-2025-10-13/docs/status/CLEANUP_PLAN.md` - Documentation cleanup plan
 - `archive/docs/docs-2025-10-13/docs/status/PR28_AGUST_COMPLETE_REVIEW.md` - PR #28 review (23 comments)
 - `archive/docs/docs-2025-10-13/docs/status/DEBUGGING_2025-10-13_CORS_AND_TOKEN_ERRORS.md` - Debug session log (CORS & tokens)
 - `archive/docs/docs-2025-10-13/docs/status/CLOUDFLARE_SETUP_PLAN.md` - Cloudflare setup plan

**ZITADEL-era documents** (deprecated Oct 6-/home/gudro/Development/projects/ekklesia/validate_documentation_map.py7, 2025):
- `archive/docs/docs-2025-10-13/legacy-docs-2025-10-03/TECHNICAL_SOLUTION.md` - ZITADEL architecture
- `archive/docs/docs-2025-10-13/legacy-docs-2025-10-03/HYBRID_ARCHITECTURE.md` - OIDC Bridge design
- `archive/docs/docs-2025-10-13/legacy-docs-2025-10-03/GCP_MIGRATION_PLAN.md` - Original GCP migration plan
- `archive/docs/docs-2025-10-13/docs/specifications/MEMBERS_OIDC_SPEC.md` - ZITADEL-based OIDC spec
 - `archive/docs/docs-2025-10-13/docs/specifications/members-oidc-v1.0.md` - ZITADEL-based OIDC spec (legacy version)

**Ekklesia Platform Evaluation** (archived Oct 7, 2025):
- `archive/projects/ekklesia-platform-evaluation/README.md` - Why Ekklesia was not used
- `archive/projects/ekklesia-platform-evaluation/portal/` - Ekklesia Portal codebase (400+ files)
- `archive/projects/ekklesia-platform-evaluation/voting/` - Ekklesia Voting codebase (60+ files)

**See**: `archive/README.md` for complete archive listing with rationale

### 📋 PR Review Documentation

| Document | Purpose | Status |
|----------|---------|--------|
| `docs/reviews/PR29_REVIEW_INDEX.md` | PR#29 review index (78 comments) | ✅ Current (Oct 15) |
| `docs/reviews/PR28_AUDIT_REPORT.md` | Post-merge audit report for PR #28 | ✅ Current |
| `docs/reviews/PR29_AUDIT_REPORT.md` | Post-merge audit report for PR #29 | ✅ Current |

**Note**: Individual review responses are st/home/gudro/Development/projects/ekklesia/validate_documentation_map.pyored locally in `/tmp/batch*_response_*.md` during review campaigns.

### 🔗 Integration Documentation

| Document | Purpose | Status |
|----------|---------|--------|
| `docs/integration/DJANGO_TO_EKKLESIA_MIGRATION.md` | Django to Ekklesia migration guide | ✅ Current |
| `docs/integration/DJANGO_SYNC_IMPLEMENTATION.md` | Django sync implementation details | ✅ Current |

### 🗄️ Legacy Documentation

| Document | Purpose | Status |
|----------|---------|--------|
| `docs/legacy/DJANGO_LEGACY_SYSTEM.md` | Django legacy system documentation | 📚 Reference |

---

## /members/ Directory

**Purpose**: Members service - Production application (Firebase Hosting + Cloud Functions)

### Key Files

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `members/functions/main.py` | Cloud Functions (handleKenniAuth, verifyMembership) | ✅ Production |
| `members/functions/requirements.txt` | Python dependencies for Cloud Functions | ✅ Production |
| `members/public/` | Static assets (HTML, CSS, JS) | ✅ Production |
| `members/public/test-events.html` | Events service test page (with voting interface) | ✅ Production (Oct 10) |
| `members/public/styles/` | Component CSS (global, nav, page, login, events-test) | ✅ Production |
| `members/public/firebase/app.js` | Shared Firebase initialization layer | ✅ Production (Oct 15) |
| `members/public/session/` | Pure session/auth modules (`auth.js`, `init.js`, `pkce.js`) | ✅ Production (Oct 15) |
| `members/public/ui/` | Validated DOM + navigation helpers | ✅ Production (Oct 15) |
| `members/public/js/login.js` | OAuth login module (PKCE) | ✅ Production |
| `members/public/js/dashboard.js` | Dashboard page module | ✅ Production |
| `members/public/js/profile.js` | Profile page module | ✅ Production |
| `members/public/js/test-events.js` | Test events page module | ✅ Production |
| `members/public/i18n/` | Icelandic internationalization | ✅ Production |
| `members/public/i18n/README.md` | Translation management notes | ✅ Current |
| `members/data/kennitalas.txt` | Verified member kennitalas (not in git) | ✅ Production |
| `members/firebase.json` | Firebase configuration | ✅ Production |
| `members/README.md` | Service overview and architecture | ✅ Current |

### Service Documentation

| Document | Purpose | Audience |
|----------|---------|----------|
| `members/README.md` | Service overview | All |
| `archive/projects/members-service/documentation/FIREBASE_KENNI_SETUP.md` | Firebase + Kenni.is setup (legacy) | Developers, DevOps |

### Frontend Architecture Documentation

- `members/public/ARCHITECTURE_REFACTOR.md` – Detailed old vs new architecture comparison and migration plan (Oct 15)
- `members/public/FRONTEND_AUDIT_2025-10-15.md` – Audit of portal pages after refactor
- `members/public/CRITICAL_FIXES.md` – High-priority fixes and follow-ups
- `members/public/TESTING_GUIDE.md` – Browser testing steps for login/dashboard/profile/test-events

---

## /events/ Directory

**Purpose**: Events service - Production application (Cloud Run, Node.js + Express)

### Key Files

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `events/src/index.js` | Express server entry point | ✅ Production (Oct 10) |
| `events/src/services/electionsClient.js` | Elections S2S client (Phase 5) | ✅ Production (Oct 10) |
| `events/src/services/tokenService.js` | Token generation with S2S registration | ✅ Production (Oct 10) |
| `events/src/routes/election.js` | Election endpoints with S2S results | ✅ Production (Oct 10) |
| `events/src/config/database.js` | Cloud SQL connection pool | ✅ Production |
| `events/src/config/firebase.js` | Firebase Admin SDK | ✅ Production |
| `events/src/middleware/auth.js` | JWT authentication middleware | ✅ Production |
| `events/migrations/` | Database migrations (public schema) | ✅ Production |
| `events/migrations/README.md` | Migration documentation | ✅ Current |
| `events/migrations/run-migration.sh` | Migration runner helper | ✅ Current |
| `events/deploy.sh` | Cloud Run deployment script | ✅ Production (Oct 10) |
| `events/Dockerfile` | Container image definition | ✅ Production |
| `events/README.md` | Service documentation | ✅ Current |

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
| `elections/src/index.js` | Express server entry point | ✅ Production (Oct 9) |
| `elections/src/routes/elections.js` | Public + S2S endpoints | ✅ Production |
| `elections/src/services/auditService.js` | Audit logging utilities | ✅ Production |
| `elections/src/config/database.js` | Cloud SQL connection pool | ✅ Production |
| `elections/src/middleware/s2sAuth.js` | S2S API key authentication | ✅ Production |
| `elections/src/middleware/appCheck.js` | Optional App Check enforcement | ✅ Current |
| `elections/migrations/` | Database migrations (elections schema) | ✅ Production |
| `elections/migrations/README.md` | Migration history | ✅ Current |
| `elections/deploy.sh` | Cloud Run deployment script | ✅ Production |
| `elections/Dockerfile` | Container image definition | ✅ Production |
| `elections/README.md` | Service documentation | ✅ Current |

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

**See**: `archive/projects/ekklesia-platform-evaluation/README.md` for complete evaluation details

---

## Quick Links by Role

### 👨‍💻 **Developer - Building Features**

**Getting Started:**
1. Read: `docs/SYSTEM_ARCHITECTURE_OVERVIEW.md` (3-service architecture)
2. Review: `archive/docs/docs-2025-10-13/docs/design/EVENTS_SERVICE_MVP.md` (Events service)
3. Review: `archive/docs/docs-2025-10-13/docs/design/ELECTIONS_SERVICE_MVP.md` (Elections service)
4. Setup: `archive/docs/docs-2025-10-13/docs/guides/MEMBERS_DEPLOYMENT_GUIDE.md` (deployment)
5. Study: `docs/ARCHITECTURE_DESIGN_PHASE6.md` (Phase 6 design and roadmap)

**Current Work:**
- Members Service (Production): `members/`
- Events Service (Production): `events/`
- Elections Service (Production): `elections/`
- Phase 6 (Next): Load testing (see `docs/USAGE_CONTEXT.md`, `docs/ARCHITECTURE_DESIGN_PHASE6.md`)

### 🚀 **DevOps - Deploying & Operating**

**Getting Started:**
1. Read: `docs/status/CURRENT_PRODUCTION_STATUS.md` (production status)
2. Review: `docs/SYSTEM_ARCHITECTURE_OVERVIEW.md` (architecture)
3. Deploy Members: `firebase deploy --only hosting,functions` (from members/)
4. Deploy Events: `./deploy.sh` (from events/)
5. Deploy Elections: `./deploy.sh` (from elections/)

**Operations:**
- Operations Manual: `docs/OPERATIONAL_PROCEDURES.md`
- Database Reference: `archive/docs/docs-2025-10-13/docs/DATABASE_REFERENCE.md`
- Load Patterns: `docs/USAGE_CONTEXT.md`

**Daily Work:**
- Production Status: `docs/status/CURRENT_PRODUCTION_STATUS.md`
- Phase 5 Status: `archive/docs/docs-2025-10-13/docs/status/PHASE_5_INTEGRATION_COMPLETE.md`

### 🏗️ **Architect - System Design**

**Getting Started:**
1. Read: `docs/SYSTEM_ARCHITECTURE_OVERVIEW.md` (primary architecture)
2. Review: `archive/docs/docs-2025-10-13/docs/design/EVENTS_SERVICE_MVP.md` (Events service design)
3. Review: `archive/docs/docs-2025-10-13/docs/design/ELECTIONS_SERVICE_MVP.md` (Elections service design)
4. Study: `docs/USAGE_CONTEXT.md` (load patterns and capacity planning)
5. Study: `docs/ARCHITECTURE_DESIGN_PHASE6.md` (Phase 6 design and roadmap)
6. Study: `archive/docs/docs-2025-10-13/docs/status/PHASE_5_INTEGRATION_COMPLETE.md` (S2S integration)

**Daily Work:**
- Architecture: `docs/SYSTEM_ARCHITECTURE_OVERVIEW.md`
- Load Planning: `docs/USAGE_CONTEXT.md`
- Operations: `docs/OPERATIONAL_PROCEDURES.md`
- Database: `archive/docs/docs-2025-10-13/docs/DATABASE_REFERENCE.md`
- Future Plans: `archive/docs/docs-2025-10-13/docs/plans/GOOGLE_AUTH_LINKING_PLAN.md`

### 🆘 **On-Call - Handling Incidents**

**Emergency Quick Start:**
1. **Status**: `docs/status/CURRENT_PRODUCTION_STATUS.md` (what's running)
2. **Services**: Check Cloud Run services in GCP Console
   - Events: https://events-service-521240388393.europe-west2.run.app
   - Elections: https://elections-service-521240388393.europe-west2.run.app
3. **Logs**: Cloud Logging → Filter by service
4. **Firebase**: Firebase Console → Authentication → Users
5. **Database**: Cloud SQL Console → ekklesia-db

**Operational Procedures**: `docs/OPERATIONAL_PROCEDURES.md`

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
~/bin/cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:ekklesia-db --port 5433 &

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
| **After Each Deployment** | docs/status/CURRENT_PRODUCTION_STATUS.md | DevOps |
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
- Operational procedures: `docs/OPERATIONAL_PROCEDURES.md`

---

**Document Version**: 6.3.0
**Last Reviewed**: 2025-10-15
**Changes**: Added guides section (PR29_CAMPAIGN_LEARNINGS, GITHUB_PR_REVIEW_REPLY_WORKFLOW, GITHUB_PROJECT_MANAGEMENT); added reviews, integration, legacy sections; updated status docs (removed archived files)
**Validated With**: validate_documentation_map.py
**Next Review**: 2026-01-15 (Quarterly)
