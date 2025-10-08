# 🗺️ Ekklesia Platform - Master Documentation Map

**Version**: 4.2.0
**Last Updated**: 2025-10-08
**Status**: ✅ Members Service Production - Membership Verification Complete

---

## 📍 Quick Navigation

### 🚀 **Getting Started**
- [Project Overview](#project-overview)
- [Current Status](#current-status)
- [Documentation Structure](#documentation-structure)
- [Quick Links by Role](#quick-links-by-role)

### 📚 **Documentation Directories**
- [/docs/ - Architecture & Plans](#docs-directory)
- [/gcp/ - Infrastructure Reference (Archived)](#gcp-directory)
- [/members/ - Members Service](#members-directory)
- [/portal/ - Portal Service](#portal-directory)

---

## Project Overview

**Ekklesia** is a democratic participation platform for Samstaða (Iceland Social Democratic Party), providing:

- **Secure Authentication**: National eID (Kenni.is) integration via Firebase/Identity Platform
- **Member Portal**: View profile, roles, and participate in party activities
- **Voting System**: Democratic decision-making platform
- **Event Management**: Election and event administration

### Technology Stack

| Component | Technology | Status |
|-----------|-----------|--------|
| **Identity Provider** | Firebase/Identity Platform | ✅ Production (Free Tier) |
| **National eID** | Kenni.is OAuth PKCE | ✅ Production |
| **Members Service** | Firebase Hosting + Python Cloud Functions | ✅ Production |
| **Membership Verification** | Firebase Storage + Cloud Functions | ✅ Production (2,273 members) |
| **Events Service** | Design Complete | 📋 Ready to Implement |
| **Elections Service** | Design Pending | 📋 Next Phase |
| **Database** | Cloud SQL PostgreSQL 15 | ✅ Production (ready for Events) |
| **Cloud Functions** | Python 3.11 (Gen 2) | ✅ Production (2 functions) |
| **Infrastructure** | Firebase + Cloud Run | ✅ Production |
| **Region** | europe-west2 (London) | ✅ Production |

---

## Current Status

### ✅ Production Services (October 7, 2025)

**Firebase Migration Complete** - Ekklesia Platform Archived, Custom Services in Design (Oct 7, 2025)

| Component | Status | URL/Service |
|-----------|--------|-------------|
| **Firebase/Identity Platform** | ✅ Production | ekklesia-prod-10-2025 (Free Tier) |
| **Firebase Hosting** | ✅ Production | https://ekklesia-prod-10-2025.web.app |
| **handleKenniAuth** | ✅ Production | Cloud Function (512 MB) |
| **verifyMembership** | ✅ Production | Cloud Function (256 MB) |
| **Members Service** | ✅ Production | Firebase-based (kennitala auth) |
| **Events Service** | 🔨 Design | Custom election administration |
| **Voting Service** | 📋 Design | Custom anonymous ballot recording |
| **Cloud SQL** | ✅ Production | ekklesia-db (PostgreSQL 15) |

**Cost**: $7-15/month (Members $0, Events ~$5, Voting ~$2, Cloud SQL ~$7)

### 🔨 Current Work

- **Members Service**: ✅ Production operational (Oct 8, 2025)
  - Membership verification with 2,273 members
  - Kennitala normalization implemented
  - Icelandic i18n, socialist red theme
  - See: `docs/status/CURRENT_PRODUCTION_STATUS.md`
- **Events Service**: Design complete, ready for implementation
  - See: `docs/design/EVENTS_SERVICE_MVP.md`
- **Elections Service**: Next phase (design pending)
- **Documentation**: Deep review and validation complete (Oct 8)

### 📋 Recent Milestones (October 2025)

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

**Oct 7, 2025 - Ekklesia Platform Evaluation**
- ✅ Portal service deployed to Cloud Run (503 error)
- ✅ Cloud SQL instance created (ekklesia-db)
- ❌ Decision: Ekklesia platform does not match requirements
- 📄 Documentation: `archive/ekklesia-platform-evaluation/README.md`

**Oct 6-7, 2025 - Firebase Migration (ZITADEL Removed)**
- ✅ Migrated from ZITADEL to Firebase/Identity Platform
- ✅ Direct Kenni.is OAuth PKCE integration
- ✅ Custom token authentication with kennitala claims
- ✅ Members service operational with Firebase auth
- ✅ ZITADEL infrastructure decommissioned
- ✅ Cost savings: $135/month → $7-10/month
- 📄 Documentation: `docs/status/FIREBASE_MIGRATION_STATUS.md`

**Oct 5, 2025 - Milestone 3: Voting Eligibility**
- ✅ Story #14: Secure login with Kenni.is
- ✅ Kennitala verification system (kennitalas.txt)
- ✅ Member verification Cloud Function
- ✅ CSS component architecture
- ✅ Icelandic internationalization (i18n)

**Oct 3, 2025 - Milestone 2: OIDC Authentication**
- ✅ OpenID Connect integration
- ✅ PKCE authentication flow
- ✅ Session management
- ✅ Protected routes

**Oct 3, 2025 - Milestone 1: Hello World Service**
- ✅ Members service deployed to Cloud Run
- ✅ Health endpoint operational
- ✅ Deployment automation established

---

## Documentation Structure

```
ekklesia/
├── DOCUMENTATION_MAP.md              ⭐ YOU ARE HERE - Master index
│
├── docs/                             📄 Architecture & Plans
│   ├── SYSTEM_ARCHITECTURE_OVERVIEW.md 🏗️ Primary architectural vision
│   ├── status/                       📊 Production status
│   │   ├── CURRENT_PRODUCTION_STATUS.md  📊 Production infrastructure status
│   │   └── FIREBASE_MIGRATION_STATUS.md  ✅ Firebase migration summary
│   ├── design/                       🔨 Service design documents
│   │   ├── EVENTS_SERVICE_MVP.md     🔨 Events service design document
│   │   └── VOTING_SERVICE_DESIGN.md  📋 Voting service design document
│   ├── specifications/               📋 Technical specifications
│   │   └── MEMBERS_OIDC_SPEC.md      ⚠️ Legacy (ZITADEL-based)
│   ├── guides/                       📖 Implementation guides
│   │   ├── GITHUB_MCP_GUIDE.md       GitHub MCP integration
│   │   └── MEMBERS_DEPLOYMENT_GUIDE.md   Members service deployment
│   ├── plans/                        📝 Future feature plans
│   │   └── GOOGLE_AUTH_LINKING_PLAN.md      Migration to Google login
│   └── archive/                      📦 Historical documents
│       ├── DOCUMENTATION_INDEX.md    📇 Legacy docs index
│       ├── TECHNICAL_SOLUTION.md     ZITADEL architecture
│       ├── HYBRID_ARCHITECTURE.md    OIDC Bridge architecture
│       └── ... (ZITADEL-era docs)
│
├── gcp/                              ⚙️ Infrastructure Reference (Archived)
│   ├── DOCUMENTATION_INDEX.md        📇 GCP directory index
│   ├── deployment/                   🚀 Deployment scripts (legacy)
│   ├── reference/                    📚 ZITADEL-era reference docs
│   └── archive/                      📦 Historical scripts & docs
│
├── members/                          👤 Members Service (Production)
│   ├── src/                          💻 Application code
│   │   ├── index.js                  Main entry point
│   │   ├── config.js                 Configuration
│   │   └── routes/                   Route handlers
│   ├── auth/                         🔐 Firebase Authentication
│   │   ├── firebase-admin-init.js    Firebase Admin SDK setup
│   │   └── kennitala-verification.js Membership verification
│   ├── functions/                    ☁️ Cloud Functions
│   │   └── index.js                  handleKenniAuth & verifyMembership
│   ├── public/                       🎨 Static assets
│   │   └── styles/                   Component CSS
│   ├── docs/                         📚 Service documentation
│   │   ├── FIREBASE_KENNI_SETUP.md   Setup guide
│   │   └── KENNI_QUICKSTART.md       Quick start
│   ├── scripts/                      🔧 Deployment scripts
│   │   └── deploy-stage-3-functions.sh
│   ├── data/                         📊 Membership data
│   │   └── kennitalas.txt            Verified member kennitalas
│   ├── firebase.json                 Firebase configuration
│   ├── .firebaserc                   Firebase project config
│   ├── package.json                  Node.js dependencies
│   └── README.md                     📖 Service documentation
│
└── archive/                          📦 Archived Code & Evaluations
    ├── ekklesia-platform-evaluation/ 🔍 Ekklesia platform evaluation (Oct 7)
    │   ├── README.md                 Why Ekklesia was not used
    │   ├── portal/                   Ekklesia Portal codebase
    │   ├── voting/                   Ekklesia Voting codebase
    │   └── *.md                      Proposition-based vision docs (archived)
    └── ... (other archived code)
```

---

## /docs/ Directory

**Purpose**: Architecture documentation, plans, and archived ZITADEL-era docs

### 🏗️ Architecture Documents

| Document | Purpose | Status |
|----------|---------|--------|
| `SYSTEM_ARCHITECTURE_OVERVIEW.md` | Primary architectural vision (election-focused) | ✅ Active (Oct 7) |
| `design/EVENTS_SERVICE_MVP.md` | Events service MVP design (election administration) | ✅ Complete (Oct 8) |
| `design/VOTING_SERVICE_DESIGN.md` | Voting service design (anonymous ballot recording) | 📋 Planned |
| `status/CURRENT_PRODUCTION_STATUS.md` | Production infrastructure status | ✅ Current (Oct 8) |
| `status/FIREBASE_MIGRATION_STATUS.md` | Firebase migration summary | ✅ Current (Oct 6-7) |
| `archive/DOCUMENTATION_INDEX.md` | Legacy documentation index | 📦 Archived |

### 📝 Future Plans

| Document | Purpose | Status | Estimated Effort |
|----------|---------|--------|------------------|
| `plans/GOOGLE_AUTH_LINKING_PLAN.md` | Migrate to Google login after Kenni.is | 📋 Planned | 2-3 days |

### 📖 Implementation Guides

| Document | Purpose | Status |
|----------|---------|--------|
| `guides/GITHUB_MCP_GUIDE.md` | GitHub MCP integration | ✅ Current |

### 📦 Archived Documentation

**ZITADEL-era documents** (deprecated Oct 6-7, 2025):
- `docs/archive/TECHNICAL_SOLUTION.md` - ZITADEL architecture
- `docs/archive/HYBRID_ARCHITECTURE.md` - OIDC Bridge design
- `docs/archive/GCP_MIGRATION_PLAN.md` - Original GCP migration plan
- `docs/specifications/MEMBERS_OIDC_SPEC.md` - ZITADEL-based OIDC spec

**Ekklesia Platform Evaluation** (archived Oct 7, 2025):
- `archive/ekklesia-platform-evaluation/README.md` - Why Ekklesia was not used
- `archive/ekklesia-platform-evaluation/portal/` - Ekklesia Portal codebase (400+ files)
- `archive/ekklesia-platform-evaluation/voting/` - Ekklesia Voting codebase (60+ files)
- `archive/ekklesia-platform-evaluation/ABOUT_EKKLESIA_PLATFORM.md` - Platform background
- `archive/ekklesia-platform-evaluation/UPDATED_SYSTEM_VISION.md` - Proposition-based vision (superseded)
- `archive/ekklesia-platform-evaluation/NAMING_CLARIFICATION.md` - Naming confusion analysis

**See**: `docs/DOCUMENTATION_INDEX.md` for complete archive listing

---

## /gcp/ Directory

**Purpose**: Infrastructure reference documentation (mostly archived)

⚠️ **Note**: Most GCP documentation is ZITADEL-era and archived. Current production infrastructure is documented in:
- `docs/CURRENT_PRODUCTION_STATUS.md` (root)
- `docs/DOCUMENTATION_INDEX.md`
- `docs/SYSTEM_ARCHITECTURE_OVERVIEW.md`

### 📚 Reference Documentation (Archived)

All `gcp/reference/` documents are ZITADEL-era and deprecated:
- `PHASE_4_COMPLETE.md` - ZITADEL Phase 4 completion
- `ZITADEL_DEPLOYMENT_SUCCESS.md` - ZITADEL deployment (decommissioned)
- `MEMBERS_OIDC_SUCCESS.md` - OIDC Bridge success (removed)

**See**: `gcp/DOCUMENTATION_INDEX.md` for complete GCP archive listing

---

## /members/ Directory

**Purpose**: Members service - Production application

### Key Files

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `src/` | Application code (Express.js) | ✅ Production |
| `functions/` | Cloud Functions (handleKenniAuth, verifyMembership) | ✅ Production |
| `auth/` | Firebase authentication modules | ✅ Production |
| `public/styles/` | Component CSS | ✅ Production |
| `data/kennitalas.txt` | Verified member kennitalas | ✅ Production |
| `firebase.json` | Firebase configuration | ✅ Production |
| `members/docs/FIREBASE_KENNI_SETUP.md` | Setup guide | ⚠️ Legacy (ZITADEL-era) |
| `members/docs/KENNI_QUICKSTART.md` | Quick start guide | ⚠️ Legacy (ZITADEL-era) |
| `members/README.md` | Service overview and architecture | ✅ Current |
| `members/functions/main.py` | Cloud Functions implementation | ✅ Production |

### Service Documentation

| Document | Purpose | Audience |
|----------|---------|----------|
| `README.md` | Service overview | All |
| `members/docs/FIREBASE_KENNI_SETUP.md` | Firebase + Kenni.is setup | Developers, DevOps |
| `members/docs/KENNI_QUICKSTART.md` | Quick start (no prerequisites) | Developers |

---

## /archive/ Directory

**Purpose**: Archived code and evaluations

### Ekklesia Platform Evaluation

📦 **Archived** (Oct 7, 2025) - 472 files archived

**Reason**: Ekklesia Platform is designed for propositions/motions (policy development), not elections (candidate selection). Mismatch with original vision.

**Contents**:
- `portal/` - Ekklesia Portal codebase (400+ files)
- `voting/` - Ekklesia Voting codebase (60+ files)
- `README.md` - Evaluation summary and decision rationale
- Documentation files (ABOUT_EKKLESIA_PLATFORM.md, etc.)

**See**: `archive/ekklesia-platform-evaluation/README.md` for complete evaluation details

---

## Quick Links by Role

### 👨‍💻 **Developer - Building Features**

**Getting Started:**
1. Read: `docs/SYSTEM_ARCHITECTURE_OVERVIEW.md` (overall vision)
2. Review: `docs/design/EVENTS_SERVICE_MVP.md` (Events service design)
3. Review: `docs/design/VOTING_SERVICE_DESIGN.md` (Voting service design)
4. Setup: `members/docs/FIREBASE_KENNI_SETUP.md` (Firebase + Kenni.is)

**Current Work:**
- Members Service (Production): `members/`
- Events Service (Design): `docs/design/EVENTS_SERVICE_MVP.md`
- Voting Service (Design): `docs/design/VOTING_SERVICE_DESIGN.md`

### 🚀 **DevOps - Deploying & Operating**

**Getting Started:**
1. Read: `docs/status/CURRENT_PRODUCTION_STATUS.md` (production status)
2. Review: `docs/SYSTEM_ARCHITECTURE_OVERVIEW.md` (architecture)
3. Deploy Members: `members/scripts/deploy-stage-3-functions.sh`

**Next Steps:**
- Events Service: Implementation (5 weeks, see design doc)
- Voting Service: Implementation (6 weeks, see design doc)

**Daily Work:**
- Production Status: `docs/status/CURRENT_PRODUCTION_STATUS.md`
- Architecture: `docs/SYSTEM_ARCHITECTURE_OVERVIEW.md`
- Members Deployment: `members/docs/FIREBASE_KENNI_SETUP.md`

### 🏗️ **Architect - System Design**

**Getting Started:**
1. Read: `docs/SYSTEM_ARCHITECTURE_OVERVIEW.md` (primary architectural vision)
2. Review: `docs/design/EVENTS_SERVICE_MVP.md` (Events service design)
3. Review: `docs/design/VOTING_SERVICE_DESIGN.md` (Voting service design)
4. Study: `docs/status/FIREBASE_MIGRATION_STATUS.md` (migration details)

**Daily Work:**
- Architecture: `docs/SYSTEM_ARCHITECTURE_OVERVIEW.md`
- Service Designs: `docs/design/EVENTS_SERVICE_MVP.md`, `docs/design/VOTING_SERVICE_DESIGN.md`
- Future Plans: `docs/plans/GOOGLE_AUTH_LINKING_PLAN.md`
- Cost Analysis: `docs/status/CURRENT_PRODUCTION_STATUS.md` (Cost section)

### 🆘 **On-Call - Handling Incidents**

**Emergency Quick Start:**
1. **Status**: `docs/status/CURRENT_PRODUCTION_STATUS.md` (what's running)
2. **Services**: Check Cloud Run services in GCP Console
3. **Logs**: Cloud Logging → Filter by service
4. **Firebase**: Firebase Console → Authentication → Users

**Common Issues:**
- Portal 503: See `PORTAL_DEPLOYMENT_PROGRESS.md`
- Auth issues: Check Firebase Authentication logs
- Member verification: Check `members/functions/` logs in GCP

---

## Documentation Maintenance

### Update Schedule

| Frequency | What to Update | Responsibility |
|-----------|----------------|----------------|
| **After Each Deployment** | docs/status/CURRENT_PRODUCTION_STATUS.md | DevOps |
| **After Service Changes** | Service README.md files | Developers |
| **After Architecture Changes** | DOCUMENTATION_MAP.md | Architects |
| **Monthly** | Review all status docs | Tech lead |
| **Quarterly** | Full documentation audit | Team |

### Versioning Strategy

**This Document** (`DOCUMENTATION_MAP.md`):
- Major version (4.0.0) for architecture changes (Firebase migration)
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

### Python Frameworks (Portal & Voting)
- Morepath: https://morepath.readthedocs.io/
- SQLAlchemy: https://www.sqlalchemy.org/
- Alembic: https://alembic.sqlalchemy.org/

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

**Document Version**: 4.2.0
**Last Reviewed**: 2025-10-08
**Changes**: Reorganized docs/ into subdirectories (status/, design/, archive/)
**Validated With**: gcloud CLI, firebase CLI, gsutil (production infrastructure)
**Next Review**: 2026-01-08 (Quarterly)
