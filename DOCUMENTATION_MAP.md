# 🗺️ Ekklesia Platform - Master Documentation Map

**Version**: 7.1.0
**Last Updated**: 2025-10-24
**Status**: ✅ Phase 5 Complete - Full Voting System Operational (Members ✅ + Events ✅ + Elections ✅) + Security Improvements + Documentation Quality Audit & Enhancement

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
- **Phase 6**: Next phase (load testing)
  - 300 votes/second spike test
  - Cloud Run auto-scaling verification
  - Database connection pool testing

### 📋 Recent Milestones (October 2025)

**Oct 15, 2025 - Members Frontend Architecture Refactor Complete**
- ✅ Refactored all portal pages to modular architecture (`*.new.js` → `*.js`)

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

**Oct 11, 2025 - Documentation Cleanup & Code Audit Complete**
- ✅ Code audit completed comparing implementation vs documentation
- ✅ Documentation cleanup: 5 files archived to organized structure
- ✅ Status documents updated with archive references
- ✅ Archive README and status/README created
- ✅ All cross-references validated

**Oct 10, 2025 - Phase 5: Elections + Events Integration Complete**
- ✅ Elections S2S client implemented (token registration + results fetching)
- ✅ Events service updated with S2S integration
- ✅ Test page enhanced with voting interface
- ✅ End-to-end voting flow tested and verified
- ✅ Production deployment complete (events-service-00002-dj7)
- ✅ Comprehensive documentation created

**Oct 9, 2025 - Elections Service MVP Deployed to Production**

- ✅ Security posture documented
- ✅ Multi-page portal: dashboard, profile, test pages
- ✅ Documentation deep review and validation

**Oct 7, 2025 - Return to Original Vision**
- ✅ Ekklesia platform evaluated and archived (472 files)
- ✅ Events service design document created
- ✅ Original election-focused architecture restored

**Oct 6-7, 2025 - Firebase Migration (ZITADEL Removed)**
- ✅ Migrated from ZITADEL to Firebase/Identity Platform
- ✅ Direct Kenni.is OAuth PKCE integration
- ✅ Custom token authentication with kennitala claims
- ✅ Members service operational with Firebase auth
- ✅ ZITADEL infrastructure decommissioned
- ✅ Cost savings: $135/month → $7-10/month

---

## Documentation Structure

```
ekklesia/
├── DOCUMENTATION_MAP.md              ⭐ YOU ARE HERE - Master index
├── test-voting-flow.sh               🧪 End-to-end voting flow test script (Oct 2025)
│
├── docs/                             📄 Architecture & Planning Documentation
│   ├── README.md                     📖 Documentation index
│   ├── INDEX.md                      📑 Master documentation index
│   ├── ENVIRONMENT_CLARIFICATION.md  📋 Environment setup clarifications
│   ├── SCRIPT_IMPROVEMENTS_APPLIED.md 📝 Script improvement notes
│   │
│   ├── architecture/                 🏗️ System architecture
│   │   ├── ARCHITECTURE_DESIGN_PHASE6.md     Phase 6 design (5 challenges, ADRs)
│   │   ├── ARCHITECTURE_RECOMMENDATIONS.md   Architecture recommendations
│   │   └── CSS_DESIGN_SYSTEM.md              CSS BEM design system
│   │
│   ├── audits/                       📊 Documentation audits
│   │   ├── README.md                 Audit index and guide
│   │   ├── REORGANIZATION_GUIDE.md   Documentation reorganization guide
│   │   ├── LATEST_AUDIT_LINK.md      Latest audit reference
│   │   ├── current/                  Current audit findings
│   │   ├── historical/               Historical audits (archived)
│   │   ├── planning/                 Audit planning documents
│   │   ├── tools/                    Audit automation tools
│   │   └── workflows/                Audit workflows
│   │
│   ├── design/                       🎨 Service design documents
│   │   └── CSS_DESIGN_SYSTEM.md      CSS architecture guide
│   │
│   ├── development/                  👨‍💻 Developer guides
│   │   └── guides/                   Development guides
│   │       ├── INDEX.md              Guide index
│   │       ├── README.md             Guide overview
│   │       ├── admin/                Admin procedures
│   │       ├── git/                  Git workflows
│   │       ├── github/               GitHub workflows
│   │       ├── infrastructure/       Infrastructure guides
│   │       ├── troubleshooting/      Troubleshooting guides
│   │       └── workflows/            Development workflows
│   │
│   ├── features/                     ✨ Feature documentation
│   │   └── election-voting/         Election voting features
│   │       ├── EPIC_24_ADMIN_LIFECYCLE.md      Admin lifecycle management
│   │       ├── EPIC_87_ELECTION_DISCOVERY.md   Election discovery
│   │       ├── ADMIN_API_REFERENCE.md          Admin API reference
│   │       ├── PHASE_5_WEEK_1_IMPLEMENTATION.md Phase 5 implementation
│   │       ├── PHASE_5_WEEK_1_MEMBER_UI.md     Member UI implementation
│   │       └── development-status.md           Development status
│   │
│   ├── integration/                  🔗 Integration guides
│   │   ├── DJANGO_TO_EKKLESIA_MIGRATION.md  Django migration guide
│   │   └── DJANGO_SYNC_IMPLEMENTATION.md    Django sync implementation
│   │
│   ├── migration/                    🚚 Migration documentation
│   │   ├── FRONTEND_CONSISTENCY_MIGRATION_PLAN.md  Frontend consistency
│   │   ├── HAMBURGER_MENU_IMPLEMENTATION_PLAN.md   Hamburger menu plan
│   │   └── HAIKU_PROMPT_HAMBURGER_MENU.md          Haiku prompt
│   │
│   ├── operations/                   ⚙️ Operations documentation
│   │   ├── INDEX.md                  Operations index
│   │   └── (operational procedures)
│   │
│   ├── reports/                      📋 Reports and audits
│   │   └── DOCUMENTATION_UPDATE_REPORT.md  Documentation updates
│   │
│   ├── roadmap/                      🗺️ Product roadmap
│   │   ├── PHASE_5_OVERVIEW.md       Phase 5 overview
│   │   ├── PHASE_5_WEEK_1_MASTER_PLAN.md  Week 1 master plan
│   │   ├── REPOSITORY_REORGANIZATION_DRAFT_PLAN.md  Reorganization draft
│   │   └── REPO_RESTRUCTURING_PLAN.md     Restructuring plan
│   │
│   ├── security/                     🔐 Security documentation
│   │   ├── INDEX.md                  Security index
│   │   ├── README.md                 Security overview
│   │   ├── current/                  Current security docs
│   │   ├── historical/               Historical security docs
│   │   ├── policies/                 Security policies
│   │   └── responses/                Security incident responses
│   │
│   ├── setup/                        🛠️ Setup guides
│   │   └── INDEX.md                  Setup index
│   │
│   ├── status/                       📊 Production status
│   │   ├── CURRENT_DEVELOPMENT_STATUS.md  Development status
│   │   ├── EPIC24_CURRENT_STATUS.md       Epic 24 status
│   │   ├── EPIC24_FIXES_COMPREHENSIVE_SUMMARY.md  Epic 24 fixes
│   │   ├── EPIC24_MIGRATION_VERIFICATION_PLAN.md  Migration verification
│   │   ├── PHASE_5_WEEK_1_COMPLETION.md   Phase 5 completion
│   │   ├── historical/               Historical status docs
│   │   └── ongoing/                  Ongoing status tracking
│   │
│   ├── testing/                      🧪 Testing documentation
│   │   └── (test reports and guides)
│   │
│   └── troubleshooting/              🔧 Troubleshooting guides
│       ├── ROLE_LOSS_INCIDENT_2025-10-23.md  Role loss incident
│       └── SCHEMA_MISMATCH_EPIC_24_2025-10-23.md  Schema mismatch
│
├── services/                         🚀 Production Services
│   │
│   ├── members/                      👤 Members Service (Firebase Hosting)
│   │   ├── functions/                ☁️ Cloud Functions (Python 3.11)
│   │   │   ├── main.py               handleKenniAuth & verifyMembership & healthz
│   │   │   ├── utils_logging.py      Structured logging
│   │   │   ├── util_jwks.py          JWKS caching
│   │   │   ├── requirements.txt      Python dependencies
│   │   │   └── package.json          Node.js dependencies (Firebase SDK)
│   │   ├── data/                     📊 Membership data
│   │   │   └── kennitalas.txt        Verified member kennitalas (NOT in git)
│   │   ├── scripts/                  🔧 Helper scripts
│   │   │   ├── README.md             Scripts documentation
│   │   │   └── assign-role-to-me.sh  Quick role assignment
│   │   ├── setup-scripts/            ⚙️ Setup automation
│   │   │   └── README.md             Setup scripts documentation
│   │   ├── firebase.json             Firebase configuration
│   │   ├── .firebaserc               Firebase project config
│   │   ├── package.json              Node.js dependencies
│   │   └── README.md                 📖 Service documentation (1,088 lines, Oct 24)
│   │
│   ├── events/                       🎫 Events Service (Cloud Run)
│   │   ├── src/                      💻 Node.js application
│   │   │   ├── index.js              Express server
│   │   │   ├── config/               Configuration modules
│   │   │   ├── middleware/           Express middleware
│   │   │   ├── services/             Business logic
│   │   │   └── routes/               API routes
│   │   ├── migrations/               🗄️ Database migrations
│   │   ├── Dockerfile                🐳 Container image
│   │   ├── deploy.sh                 🚀 Deployment script
│   │   ├── package.json              Dependencies
│   │   └── README.md                 📖 Service documentation (872 lines, Oct 24)
│   │
│   └── elections/                    🗳️ Elections Service (Cloud Run)
│       ├── src/                      💻 Node.js application
│       │   ├── index.js              Express server
│       │   ├── config/               Configuration modules
│       │   ├── middleware/           Express middleware
│       │   ├── services/             Business logic
│       │   └── routes/               API routes
│       ├── migrations/               🗄️ Database migrations
│       ├── Dockerfile                🐳 Container image
│       ├── deploy.sh                 🚀 Deployment script
│       ├── package.json              Dependencies
│       └── README.md                 📖 Service documentation
│
├── apps/                             🎨 Frontend Applications
│   └── members-portal/               👤 Members Portal (Firebase Hosting)
│       ├── index.html                Login page
│       ├── dashboard.html            Member dashboard
│       ├── profile.html              User profile
│       ├── elections.html            Elections list
│       ├── election-detail.html      Election voting
│       ├── election-api-test.html    API testing page
│       ├── events.html               Events page
│       ├── js/                       JavaScript modules
│       │   ├── auth.js               Authentication
│       │   ├── login.js              Login logic
│       │   ├── dashboard.js          Dashboard logic
│       │   ├── profile.js            Profile logic
│       │   ├── elections.js          Elections logic
│       │   ├── election-detail.js    Voting logic
│       │   ├── election-api-test.js  API testing
│       │   ├── events.js             Events logic
│       │   ├── nav.js                Navigation
│       │   ├── page-init.js          Page initialization
│       │   └── api/                  API client modules
│       ├── styles/                   CSS stylesheets
│       │   ├── global.css            Global styles
│       │   ├── elections.css         Elections styles
│       │   ├── events.css            Events styles
│       │   └── components/           Component styles
│       └── i18n/                     Internationalization
│           ├── R.js                  R.string utility
│           └── is.js                 Icelandic translations
│
├── scripts/                          🔧 Automation Scripts
│   └── admin/                        Admin utilities
│       └── validate_documentation_map.py  Documentation validator
│
└── archive/                          📦 Archived Code (NOT in git)
    └── (historical code and documentation)
```

**Note**: The `services/members/public/` directory is actually a **symlink** to `../../apps/members-portal`.

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
| `validate-links.py` | Link validation script for automated link checking | ✅ Current (Oct 20) |

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
| `docs/design/CSS_DESIGN_SYSTEM.md` | CSS BEM design system and component documentation | ✅ Current (Oct 20) |

### 📖 Implementation Guides
| Document | Purpose | Status |

|----------|---------|--------|

### 📝 Security & Planning Documents

| Document | Purpose | Status |
|----------|---------|--------|

### 💬 Prompt Templates

| Document | Purpose | Status |
|----------|---------|--------|

### 📝 Future Plans

| Document | Purpose | Status | Estimated Effort |
|----------|---------|--------|------------------|
| `docs/roadmap/EPIC_24_IMPLEMENTATION_PLAN.md` | Phase 1: Admin member management interface | 📋 Planning (Oct 20) | 3-5 days |

### 📦 Archived Documentation

**Status Documents** (archived Oct 11, 2025):

**ZITADEL-era documents** (deprecated Oct 6-7, 2025):

**Ekklesia Platform Evaluation** (archived Oct 7, 2025):
- `archive/projects/ekklesia-platform-evaluation/portal/` - Ekklesia Portal codebase (400+ files)
- `archive/projects/ekklesia-platform-evaluation/voting/` - Ekklesia Voting codebase (60+ files)


### 📋 PR Review Documentation

| Document | Purpose | Status |
|----------|---------|--------|

**Note**: Individual review responses are stored locally in `/tmp/batch*_response_*.md` during review campaigns.

### 🔗 Integration Documentation

| Document | Purpose | Status |
|----------|---------|--------|
| `docs/integration/DJANGO_TO_EKKLESIA_MIGRATION.md` | Django to Ekklesia migration guide | ✅ Current |
| `docs/integration/DJANGO_SYNC_IMPLEMENTATION.md` | Django sync implementation details | ✅ Current |

### 🗄️ Legacy Documentation

| Document | Purpose | Status |
|----------|---------|--------|

---

## /members/ Directory

**Purpose**: Members service - Production application (Firebase Hosting + Cloud Functions)

### Key Files

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `members/public/` | Static assets (HTML, CSS, JS) | ✅ Production |
| `members/public/i18n/` | Icelandic internationalization | ✅ Production |

### Service Documentation

| Document | Purpose | Audience |
|----------|---------|----------|

### Frontend Architecture Documentation


---

## /events/ Directory

**Purpose**: Events service - Production application (Cloud Run, Node.js + Express)

### Key Files

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `events/migrations/` | Database migrations (public schema) | ✅ Production |
| `events/Dockerfile` | Container image definition | ✅ Production |

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
| `elections/migrations/` | Database migrations (elections schema) | ✅ Production |
| `elections/Dockerfile` | Container image definition | ✅ Production |

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


---

## Quick Links by Role

### 👨‍💻 **Developer - Building Features**

**Getting Started:**

**Current Work:**
- Members Service (Production): `members/`
- Events Service (Production): `events/`
- Elections Service (Production): `elections/`

### 🚀 **DevOps - Deploying & Operating**

**Getting Started:**
3. Deploy Members: `firebase deploy --only hosting,functions` (from members/)
4. Deploy Events: `./deploy.sh` (from events/)
5. Deploy Elections: `./deploy.sh` (from elections/)

**Operations:**

**Daily Work:**

### 🏗️ **Architect - System Design**

**Getting Started:**

**Daily Work:**

### 🆘 **On-Call - Handling Incidents**

**Emergency Quick Start:**
2. **Services**: Check Cloud Run services in GCP Console
   - Events: https://events-service-521240388393.europe-west2.run.app
   - Elections: https://elections-service-521240388393.europe-west2.run.app
3. **Logs**: Cloud Logging → Filter by service
4. **Firebase**: Firebase Console → Authentication → Users
5. **Database**: Cloud SQL Console → ekklesia-db


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

---

**Document Version**: 7.1.0
**Last Reviewed**: 2025-10-24
**Changes**: Removed references to missing files (validated with validate_documentation_map.py)
**Validated With**: validate_documentation_map.py
**Next Review**: 2026-01-15 (Quarterly)
