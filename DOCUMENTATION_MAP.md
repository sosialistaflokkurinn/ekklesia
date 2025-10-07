# 🗺️ Ekklesia Platform - Master Documentation Map

**Version**: 4.0.0
**Last Updated**: 2025-10-07
**Status**: ✅ Firebase Migration Complete - Production Operational

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
| **Members Service** | Node.js (Express) | ✅ Production |
| **Portal Service** | Python (Morepath) | 🟡 Deployed (DB not migrated) |
| **Voting Service** | Python (Morepath) | 📦 Ready to Deploy |
| **Database** | Cloud SQL PostgreSQL 15 | ✅ Production |
| **Cloud Functions** | Python 3.11 | ✅ Production |
| **Infrastructure** | GCP Cloud Run | ✅ Production |
| **Region** | europe-west2 (London) | ✅ Production |

---

## Current Status

### ✅ Production Services (October 7, 2025)

**Firebase Migration Complete** - Direct Kenni.is Integration (Oct 6-7, 2025)

| Component | Status | URL/Service |
|-----------|--------|-------------|
| **Firebase/Identity Platform** | ✅ Production | ekklesia-prod-10-2025 (Free Tier) |
| **Firebase Hosting** | ✅ Production | https://ekklesia-prod-10-2025.web.app |
| **handleKenniAuth** | ✅ Production | Cloud Function (512 MB) |
| **verifyMembership** | ✅ Production | Cloud Function (256 MB) |
| **Members Service** | ✅ Production | https://members-ymzrguoifa-nw.a.run.app |
| **Portal Service** | 🟡 Deployed | https://portal-ymzrguoifa-nw.a.run.app (503) |
| **Cloud SQL** | ✅ Production | ekklesia-db (PostgreSQL 15) |
| **Voting Service** | 📦 Ready | Code committed, ready to deploy |

**Cost**: $7-10/month (down from $135/month with ZITADEL)

### 🔨 Current Issues

- **Portal Service**: Container deployed but returns 503 (dependency resolution issues)
  - See: `portal/DEPLOYMENT.md` and `PORTAL_DEPLOYMENT_PROGRESS.md`
- **Database Migration**: 24 Alembic migrations pending (blocked by Portal 503)

### 📋 Recent Milestones (October 2025)

**Oct 7, 2025 - Portal Deployment Attempt**
- ✅ Cloud SQL instance created (ekklesia-db)
- ✅ Portal service deployed to Cloud Run
- ❌ Service returns 503 (Python dependency issues)
- 📄 Documentation: `PORTAL_DEPLOYMENT_PROGRESS.md`

**Oct 6-7, 2025 - Firebase Migration (ZITADEL Removed)**
- ✅ Migrated from ZITADEL to Firebase/Identity Platform
- ✅ Direct Kenni.is OAuth PKCE integration
- ✅ Custom token authentication with kennitala claims
- ✅ Members service operational with Firebase auth
- ✅ ZITADEL infrastructure decommissioned
- ✅ Cost savings: $135/month → $7-10/month
- 📄 Documentation: `docs/FIREBASE_MIGRATION_STATUS.md`

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
├── CURRENT_PRODUCTION_STATUS.md      📊 Production infrastructure status
├── PORTAL_DEPLOYMENT_PROGRESS.md     🟡 Portal deployment status & issues
│
├── docs/                             📄 Architecture & Plans
│   ├── DOCUMENTATION_INDEX.md        📇 Complete docs directory index
│   ├── FIREBASE_MIGRATION_STATUS.md  ✅ Firebase migration summary
│   ├── specifications/               📋 Technical specifications
│   │   └── MEMBERS_OIDC_SPEC.md      ⚠️ Legacy (ZITADEL-based)
│   ├── architecture/                 🏗️ System design (archived)
│   │   └── identity.md               ⚠️ Legacy (ZITADEL-based)
│   ├── guides/                       📖 Implementation guides
│   │   └── GITHUB_MCP_GUIDE.md       GitHub MCP integration
│   ├── plans/                        📝 Future feature plans
│   │   ├── GOOGLE_AUTH_LINKING_PLAN.md      Migration to Google login
│   │   └── PORTAL_VOTING_DEPLOYMENT_PLAN.md Portal & Voting deployment
│   └── archive/                      📦 Historical documents
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
├── portal/                           🌐 Portal Service (Deployed - Issues)
│   ├── ekklesia_portal/              💻 Application code
│   ├── alembic/                      🗄️ Database migrations (24 pending)
│   ├── nix/                          ❄️ Nix build configuration
│   ├── deploy-to-cloud-run.sh        🚀 Deployment script
│   ├── setup-database.sh             🗄️ Database setup script
│   ├── run-migrations.sh             📝 Migration runner
│   ├── Dockerfile                    🐳 Container definition
│   ├── pyproject.toml                📦 Poetry dependencies
│   ├── DEPLOYMENT.md                 📖 Deployment guide & status
│   └── README.md                     📖 Service documentation
│
└── voting/                           🗳️ Voting Service (Ready)
    ├── ekklesia_voting/              💻 Application code
    ├── alembic/                      🗄️ Database migrations
    ├── nix/                          ❄️ Nix build configuration
    └── README.md                     📖 Service documentation
```

---

## /docs/ Directory

**Purpose**: Architecture documentation, plans, and archived ZITADEL-era docs

### 📊 Current Status Documents

| Document | Purpose | Status |
|----------|---------|--------|
| `DOCUMENTATION_INDEX.md` | Complete documentation index | ✅ Current (Oct 7) |
| `FIREBASE_MIGRATION_STATUS.md` | Firebase migration summary | ✅ Current (Oct 6-7) |

### 📝 Future Plans

| Document | Purpose | Status | Estimated Effort |
|----------|---------|--------|------------------|
| `plans/GOOGLE_AUTH_LINKING_PLAN.md` | Migrate to Google login after Kenni.is | 📋 Planned | 2-3 days |
| `plans/PORTAL_VOTING_DEPLOYMENT_PLAN.md` | Deploy Portal & Voting to Cloud Run | 📋 In Progress | 4-5 days |

### 📖 Implementation Guides

| Document | Purpose | Status |
|----------|---------|--------|
| `guides/GITHUB_MCP_GUIDE.md` | GitHub MCP integration | ✅ Current |

### 📦 Archived Documentation

**ZITADEL-era documents** (deprecated Oct 6-7, 2025):
- `archive/TECHNICAL_SOLUTION.md` - ZITADEL architecture
- `archive/HYBRID_ARCHITECTURE.md` - OIDC Bridge design
- `archive/GCP_MIGRATION_PLAN.md` - Original GCP migration plan
- `specifications/MEMBERS_OIDC_SPEC.md` - ZITADEL-based OIDC spec
- `architecture/identity.md` - ZITADEL identity architecture

**See**: `docs/DOCUMENTATION_INDEX.md` for complete archive listing

---

## /gcp/ Directory

**Purpose**: Infrastructure reference documentation (mostly archived)

⚠️ **Note**: Most GCP documentation is ZITADEL-era and archived. Current production infrastructure is documented in:
- `CURRENT_PRODUCTION_STATUS.md` (root)
- `docs/DOCUMENTATION_INDEX.md`
- `portal/DEPLOYMENT.md`

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
| `members/docs/FIREBASE_KENNI_SETUP.md` | Setup guide | ✅ Current |
| `members/docs/KENNI_QUICKSTART.md` | Quick start guide | ✅ Current |

### Service Documentation

| Document | Purpose | Audience |
|----------|---------|----------|
| `README.md` | Service overview | All |
| `members/docs/FIREBASE_KENNI_SETUP.md` | Firebase + Kenni.is setup | Developers, DevOps |
| `members/docs/KENNI_QUICKSTART.md` | Quick start (no prerequisites) | Developers |

---

## /portal/ Directory

**Purpose**: Portal service - Deployed but not operational

### Current Status

🟡 **Deployed but Database Not Migrated** (Oct 7, 2025)

- Container: ✅ Deployed to Cloud Run
- Database: ✅ Created (ekklesia_portal, empty)
- Service: ❌ Returns 503 (dependency issues)
- Migrations: ❌ Not run (24 pending)

**See**: `portal/DEPLOYMENT.md` and `PORTAL_DEPLOYMENT_PROGRESS.md` for details

### Key Files

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `ekklesia_portal/` | Application code (Morepath) | ✅ Ready |
| `alembic/` | Database migrations (24 total) | ⏳ Pending |
| `deploy-to-cloud-run.sh` | Deployment script | ✅ Used (Oct 7) |
| `setup-database.sh` | Database setup | ✅ Run (Oct 7) |
| `run-migrations.sh` | Migration runner | ⏳ Blocked (503) |
| `Dockerfile` | Container definition | 🔧 Needs fix (dependencies) |
| `DEPLOYMENT.md` | Deployment guide & status | ✅ Current |

---

## Quick Links by Role

### 👨‍💻 **Developer - Building Features**

**Getting Started:**
1. Read: `members/docs/FIREBASE_KENNI_SETUP.md` (current architecture)
2. Review: `CURRENT_PRODUCTION_STATUS.md` (production services)
3. Setup: `members/docs/KENNI_QUICKSTART.md` (local development)

**Daily Work:**
- Members Code: `members/src/`
- Cloud Functions: `members/functions/`
- Portal Code: `portal/ekklesia_portal/`
- Voting Code: `voting/ekklesia_voting/`

### 🚀 **DevOps - Deploying & Operating**

**Getting Started:**
1. Read: `CURRENT_PRODUCTION_STATUS.md` (production status)
2. Review: `docs/DOCUMENTATION_INDEX.md` (all infrastructure)
3. Deploy Members: `members/scripts/deploy-stage-3-functions.sh`
4. Deploy Portal: `portal/DEPLOYMENT.md` (with current issues)

**Daily Work:**
- Production Status: `CURRENT_PRODUCTION_STATUS.md`
- Portal Issues: `PORTAL_DEPLOYMENT_PROGRESS.md`
- Members Deployment: `members/docs/FIREBASE_KENNI_SETUP.md`

### 🏗️ **Architect - System Design**

**Getting Started:**
1. Read: `docs/DOCUMENTATION_INDEX.md` (complete architecture overview)
2. Review: `CURRENT_PRODUCTION_STATUS.md` (current infrastructure)
3. Study: `docs/FIREBASE_MIGRATION_STATUS.md` (migration details)
4. Plan: `docs/plans/PORTAL_VOTING_DEPLOYMENT_PLAN.md` (next steps)

**Daily Work:**
- Architecture: `docs/DOCUMENTATION_INDEX.md`
- Future Plans: `docs/plans/`
- Cost Analysis: `CURRENT_PRODUCTION_STATUS.md` (Cost section)

### 🆘 **On-Call - Handling Incidents**

**Emergency Quick Start:**
1. **Status**: `CURRENT_PRODUCTION_STATUS.md` (what's running)
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
| **After Each Deployment** | CURRENT_PRODUCTION_STATUS.md | DevOps |
| **After Service Changes** | Service README.md files | Developers |
| **After Architecture Changes** | DOCUMENTATION_INDEX.md | Architects |
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

**Document Version**: 4.0.0
**Last Reviewed**: 2025-10-07
**Next Review**: 2026-01-07 (Quarterly)
