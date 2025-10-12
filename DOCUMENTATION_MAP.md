# 🗺️ Ekklesia Platform - Master Documentation Map

**Version**: 6.1.0
**Last Updated**: 2025-10-11
**Status**: ✅ Phase 5 Complete - Full Voting System Operational (Members ✅ + Events ✅ + Elections ✅)

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
| **Events Service** | ✅ Production | https://events-service-521240388393.europe-west2.run.app |
| **Elections Service** | ✅ Production | https://elections-service-521240388393.europe-west2.run.app |
| **Cloud SQL** | ✅ Production | ekklesia-db (PostgreSQL 15, 2 schemas) |

**Cost**: ~$7-13/month (Members $0, Events $0-3, Elections $0-3, Cloud SQL ~$7)

### 🔨 Current Work

- **Phase 5**: ✅ Complete (Oct 10, 2025)
  - S2S integration between Events and Elections services
  - Token registration via S2S API
  - Results fetching via S2S API
  - End-to-end voting flow operational
  - See: `docs/status/PHASE_5_INTEGRATION_COMPLETE.md`
- **Phase 6**: Next phase (load testing)
  - 300 votes/second spike test
  - Cloud Run auto-scaling verification
  - Database connection pool testing
  - See: `docs/USAGE_CONTEXT.md`

### 📋 Recent Milestones (October 2025)

**Oct 11, 2025 - Documentation Cleanup & Code Audit Complete**
- ✅ Code audit completed comparing implementation vs documentation
- ✅ Documentation cleanup: 5 files archived to organized structure
- ✅ Status documents updated with archive references
- ✅ Archive README and status/README created
- ✅ All cross-references validated
- 📄 Documentation: `docs/status/CODE_AUDIT_2025-10-11_REVISED.md`
- 📄 Documentation: `docs/status/AUDIT_SUMMARY.md`

**Oct 10, 2025 - Phase 5: Elections + Events Integration Complete**
- ✅ Elections S2S client implemented (token registration + results fetching)
- ✅ Events service updated with S2S integration
- ✅ Test page enhanced with voting interface
- ✅ End-to-end voting flow tested and verified
- ✅ Production deployment complete (events-service-00002-dj7)
- ✅ Comprehensive documentation created
- 📄 Documentation: `docs/status/PHASE_5_INTEGRATION_COMPLETE.md`

**Oct 9, 2025 - Elections Service MVP Deployed to Production**
- ✅ Phase 1-4 complete (Database, API, Testing, Deployment)
- ✅ S2S endpoints operational (register-token, results)
- ✅ Anonymous ballot recording (no PII)
- ✅ Two-schema security model (public + elections)
- ✅ SHA-256 token hashing with one-time use enforcement
- ✅ Audit logging (no PII)
- ✅ Complete deployment in 1 day
- 📄 Documentation: `archive/deployments/ELECTIONS_SERVICE_DEPLOYMENT.md`

**Oct 9, 2025 - Events Service MVP Deployed to Production**
- ✅ Database migration complete (election + voting_tokens tables)
- ✅ 5 API endpoints operational (health, election, request-token, my-status, my-token)
- ✅ Firebase JWT authentication working
- ✅ SHA-256 token hashing with audit trail
- ✅ Production test page with CSS components
- ✅ Integrated with Members dashboard
- ✅ Complete deployment in 1 day (4 phases)
- 📄 Documentation: `archive/testing-logs/EVENTS_SERVICE_TESTING_LOG.md`

**Oct 9, 2025 - Database Security Hardening**
- ✅ pgaudit extension enabled (Cloud SQL audit logging)
- ✅ Backup retention extended (7 → 30 days)
- ✅ Security posture documented
- 📄 Documentation: `archive/deployments/DATABASE_SECURITY_HARDENING.md`

**Oct 8, 2025 - Membership Verification Complete**
- ✅ Kennitala normalization implemented (handles hyphen variants)
- ✅ 2,273 members verified from January 2025 roster
- ✅ Firebase Storage integration (kennitalas.txt, 24.47 KiB)
- ✅ UI improvements: Icelandic i18n, socialist red theme
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
- 📄 Documentation: `archive/migrations/FIREBASE_MIGRATION_STATUS.md`

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
│   ├── DATABASE_REFERENCE.md         📚 Complete database reference (600+ lines)
│   │
│   ├── status/                       📊 Production status & deployment logs
│   │   ├── CURRENT_PRODUCTION_STATUS.md        📊 Production infrastructure status
│   │   ├── PHASE_5_INTEGRATION_COMPLETE.md     ✅ Phase 5 integration documentation
│   │   ├── PR28_AGUST_COMPLETE_REVIEW.md       ✅ PR #28 review (23 comments)
│   │   ├── CODE_AUDIT_2025-10-11_REVISED.md    📋 Code audit (Oct 11)
│   │   ├── AUDIT_SUMMARY.md                    📋 Audit executive summary
│   │   ├── CLEANUP_PLAN.md                     📋 Documentation cleanup plan
│   │   └── README.md                           📖 Status docs guide
│   │
│   ├── design/                       🔨 Service design documents
│   │   ├── EVENTS_SERVICE_MVP.md     ✅ Events service design (production)
│   │   └── ELECTIONS_SERVICE_MVP.md  ✅ Elections service design (production)
│   │
│   ├── specifications/               📋 Technical specifications
│   │   ├── MEMBERS_OIDC_SPEC.md      ⚠️ Legacy (ZITADEL-based)
│   │   └── members-oidc-v1.0.md      ⚠️ Legacy (ZITADEL-based)
│   │
│   ├── guides/                       📖 Implementation guides
│   │   ├── GITHUB_MCP_GUIDE.md       GitHub MCP integration
│   │   ├── MEMBERS_DEPLOYMENT_GUIDE.md       Members service deployment
│   │   ├── BRANCH_STRATEGY.md        Git branching strategy
│   │   ├── SECRET_MANAGER.md         Secret Manager usage
│   │   ├── VSCODE_DATABASE_SETUP.md  VS Code PostgreSQL extension setup
│   │   └── DATABASE_QUICK_REFERENCE.md       Database one-page cheat sheet
│   │
│   └── plans/                        📝 Future feature plans
│       └── GOOGLE_AUTH_LINKING_PLAN.md      Migration to Google login
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
| `SYSTEM_ARCHITECTURE_OVERVIEW.md` | Primary architectural vision (3-service architecture) | ✅ Active (Oct 10) |
| `USAGE_CONTEXT.md` | Load patterns and capacity planning (300 votes/sec) | ✅ Active (Oct 9) |
| `OPERATIONAL_PROCEDURES.md` | Meeting day operations manual (scaling, monitoring) | ✅ Active (Oct 9) |
| `DATABASE_REFERENCE.md` | Complete database reference (schemas, tables, security) | ✅ Active (Oct 9) |

### 📊 Status & Deployment Documents

| Document | Purpose | Status |
|----------|---------|--------|
| `status/CURRENT_PRODUCTION_STATUS.md` | Production infrastructure status (all services) | ✅ Current (Oct 11) |
| `status/PHASE_5_INTEGRATION_COMPLETE.md` | Phase 5 integration documentation (S2S) | ✅ Current (Oct 10) |
| `status/PR28_AGUST_COMPLETE_REVIEW.md` | PR #28 complete review (23 comments from Ágúst) | ✅ Current (Oct 10) |
| `status/CODE_AUDIT_2025-10-11_REVISED.md` | Code audit with evidence-based findings | ✅ Current (Oct 11) |
| `status/AUDIT_SUMMARY.md` | Executive summary for stakeholders | ✅ Current (Oct 11) |
| `status/CLEANUP_PLAN.md` | Documentation cleanup strategy | ✅ Current (Oct 11) |
| `status/README.md` | Status documents guide | ✅ Current (Oct 11) |

### 📦 Archived Status Documents

| Document | Archived Date | Reason | Location |
|----------|---------------|--------|----------|
| `ELECTIONS_SERVICE_DEPLOYMENT.md` | Oct 11 | Historical deployment log | `archive/deployments/` |
| `EVENTS_SERVICE_TESTING_LOG.md` | Oct 11 | Historical testing log | `archive/testing-logs/` |
| `DATABASE_SECURITY_HARDENING.md` | Oct 11 | Historical hardening log | `archive/deployments/` |
| `FIREBASE_MIGRATION_STATUS.md` | Oct 11 | Historical migration log | `archive/migrations/` |
| `CODE_AUDIT_2025-10-11.md` | Oct 11 | Superseded by revised version | `archive/audits/` |

### 🔨 Service Design Documents

| Document | Purpose | Status |
|----------|---------|--------|
| `design/EVENTS_SERVICE_MVP.md` | Events service MVP design (token issuance, S2S) | ✅ Production (Oct 9-10) |
| `design/ELECTIONS_SERVICE_MVP.md` | Elections service MVP design (anonymous ballots, S2S) | ✅ Production (Oct 9-10) |

### 📖 Implementation Guides

| Document | Purpose | Status |
|----------|---------|--------|
| `guides/GITHUB_MCP_GUIDE.md` | GitHub MCP integration | ✅ Current |
| `guides/MEMBERS_DEPLOYMENT_GUIDE.md` | Members service deployment | ✅ Current |
| `guides/BRANCH_STRATEGY.md` | Git branching strategy | ✅ Current |
| `guides/SECRET_MANAGER.md` | Secret Manager usage | ✅ Current |
| `guides/VSCODE_DATABASE_SETUP.md` | VS Code PostgreSQL extension setup | ✅ Current (Oct 9) |
| `guides/DATABASE_QUICK_REFERENCE.md` | Database one-page cheat sheet | ✅ Current (Oct 9) |

### 📝 Future Plans

| Document | Purpose | Status | Estimated Effort |
|----------|---------|--------|------------------|
| `plans/GOOGLE_AUTH_LINKING_PLAN.md` | Migrate to Google login after Kenni.is | 📋 Planned | 2-3 days |

### 📦 Archived Documentation

**Status Documents** (archived Oct 11, 2025):
- `archive/audits/CODE_AUDIT_2025-10-11.md` - Initial audit (superseded)
- `archive/deployments/ELECTIONS_SERVICE_DEPLOYMENT.md` - Elections deployment log
- `archive/deployments/DATABASE_SECURITY_HARDENING.md` - Database hardening log
- `archive/testing-logs/EVENTS_SERVICE_TESTING_LOG.md` - Events testing log
- `archive/migrations/FIREBASE_MIGRATION_STATUS.md` - Firebase migration log

**ZITADEL-era documents** (deprecated Oct 6-7, 2025):
- `archive/documentation/TECHNICAL_SOLUTION.md` - ZITADEL architecture
- `archive/documentation/HYBRID_ARCHITECTURE.md` - OIDC Bridge design
- `archive/documentation/GCP_MIGRATION_PLAN.md` - Original GCP migration plan
- `docs/specifications/MEMBERS_OIDC_SPEC.md` - ZITADEL-based OIDC spec

**Ekklesia Platform Evaluation** (archived Oct 7, 2025):
- `archive/ekklesia-platform-evaluation/README.md` - Why Ekklesia was not used
- `archive/ekklesia-platform-evaluation/portal/` - Ekklesia Portal codebase (400+ files)
- `archive/ekklesia-platform-evaluation/voting/` - Ekklesia Voting codebase (60+ files)

**See**: `archive/README.md` for complete archive listing with rationale

---

## /members/ Directory

**Purpose**: Members service - Production application (Firebase Hosting + Cloud Functions)

### Key Files

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `functions/main.py` | Cloud Functions (handleKenniAuth, verifyMembership) | ✅ Production |
| `public/` | Static assets (HTML, CSS, JS) | ✅ Production |
| `public/test-events.html` | Events service test page (with voting interface) | ✅ Production (Oct 10) |
| `public/styles/` | Component CSS (global, nav, page, login, events-test) | ✅ Production |
| `public/js/auth.js` | Firebase authentication module | ✅ Production |
| `public/i18n/` | Icelandic internationalization | ✅ Production |
| `data/kennitalas.txt` | Verified member kennitalas (not in git) | ✅ Production |
| `firebase.json` | Firebase configuration | ✅ Production |
| `README.md` | Service overview and architecture | ✅ Current |

### Service Documentation

| Document | Purpose | Audience |
|----------|---------|----------|
| `README.md` | Service overview | All |
| `archive/members-service/documentation/FIREBASE_KENNI_SETUP.md` | Firebase + Kenni.is setup (legacy) | Developers, DevOps |

---

## /events/ Directory

**Purpose**: Events service - Production application (Cloud Run, Node.js + Express)

### Key Files

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `src/index.js` | Express server entry point | ✅ Production (Oct 10) |
| `src/services/electionsClient.js` | Elections S2S client (Phase 5) | ✅ Production (Oct 10) |
| `src/services/tokenService.js` | Token generation with S2S registration | ✅ Production (Oct 10) |
| `src/routes/election.js` | Election endpoints with S2S results | ✅ Production (Oct 10) |
| `src/config/database.js` | Cloud SQL connection pool | ✅ Production |
| `src/config/firebase.js` | Firebase Admin SDK | ✅ Production |
| `src/middleware/auth.js` | JWT authentication middleware | ✅ Production |
| `migrations/` | Database migrations (public schema) | ✅ Production |
| `deploy.sh` | Cloud Run deployment script | ✅ Production (Oct 10) |
| `Dockerfile` | Container image definition | ✅ Production |
| `README.md` | Service documentation | ✅ Current |

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
| `src/index.js` | Express server entry point | ✅ Production (Oct 9) |
| `src/services/ballotService.js` | Anonymous ballot recording | ✅ Production |
| `src/services/tokenService.js` | Token validation and management | ✅ Production |
| `src/routes/vote.js` | Public voting endpoints | ✅ Production |
| `src/routes/s2s.js` | S2S endpoints (register-token, results) | ✅ Production (Oct 10) |
| `src/config/database.js` | Cloud SQL connection pool | ✅ Production |
| `src/middleware/auth.js` | Token-based authentication | ✅ Production |
| `src/middleware/s2sAuth.js` | S2S API key authentication | ✅ Production (Oct 10) |
| `migrations/` | Database migrations (elections schema) | ✅ Production |
| `deploy.sh` | Cloud Run deployment script | ✅ Production |
| `Dockerfile` | Container image definition | ✅ Production |
| `README.md` | Service documentation | ✅ Current |

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

**See**: `archive/ekklesia-platform-evaluation/README.md` for complete evaluation details

---

## Quick Links by Role

### 👨‍💻 **Developer - Building Features**

**Getting Started:**
1. Read: `docs/SYSTEM_ARCHITECTURE_OVERVIEW.md` (3-service architecture)
2. Review: `docs/design/EVENTS_SERVICE_MVP.md` (Events service)
3. Review: `docs/design/ELECTIONS_SERVICE_MVP.md` (Elections service)
4. Setup: `docs/guides/MEMBERS_DEPLOYMENT_GUIDE.md` (deployment)

**Current Work:**
- Members Service (Production): `members/`
- Events Service (Production): `events/`
- Elections Service (Production): `elections/`
- Phase 6 (Next): Load testing (see `docs/USAGE_CONTEXT.md`)

### 🚀 **DevOps - Deploying & Operating**

**Getting Started:**
1. Read: `docs/status/CURRENT_PRODUCTION_STATUS.md` (production status)
2. Review: `docs/SYSTEM_ARCHITECTURE_OVERVIEW.md` (architecture)
3. Deploy Members: `firebase deploy --only hosting,functions` (from members/)
4. Deploy Events: `./deploy.sh` (from events/)
5. Deploy Elections: `./deploy.sh` (from elections/)

**Operations:**
- Operations Manual: `docs/OPERATIONAL_PROCEDURES.md`
- Database Reference: `docs/DATABASE_REFERENCE.md`
- Load Patterns: `docs/USAGE_CONTEXT.md`

**Daily Work:**
- Production Status: `docs/status/CURRENT_PRODUCTION_STATUS.md`
- Phase 5 Status: `docs/status/PHASE_5_INTEGRATION_COMPLETE.md`

### 🏗️ **Architect - System Design**

**Getting Started:**
1. Read: `docs/SYSTEM_ARCHITECTURE_OVERVIEW.md` (primary architecture)
2. Review: `docs/design/EVENTS_SERVICE_MVP.md` (Events service design)
3. Review: `docs/design/ELECTIONS_SERVICE_MVP.md` (Elections service design)
4. Study: `docs/USAGE_CONTEXT.md` (load patterns and capacity planning)
5. Study: `docs/status/PHASE_5_INTEGRATION_COMPLETE.md` (S2S integration)

**Daily Work:**
- Architecture: `docs/SYSTEM_ARCHITECTURE_OVERVIEW.md`
- Load Planning: `docs/USAGE_CONTEXT.md`
- Operations: `docs/OPERATIONAL_PROCEDURES.md`
- Database: `docs/DATABASE_REFERENCE.md`
- Future Plans: `docs/plans/GOOGLE_AUTH_LINKING_PLAN.md`

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

**Document Version**: 6.1.0
**Last Reviewed**: 2025-10-11
**Changes**: Documentation cleanup complete - 5 files archived, code audit added, archive structure organized
**Validated With**: gcloud CLI, firebase CLI, gsutil (production infrastructure)
**Next Review**: 2026-01-11 (Quarterly)
