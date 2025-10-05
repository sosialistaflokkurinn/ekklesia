# 🗺️ Ekklesia Platform - Master Documentation Map

**Version**: 3.2.0
**Last Updated**: 2025-10-05
**Status**: ✅ Firebase Migration Complete - Hybrid Architecture Operational

---

## 📍 Quick Navigation

### 🚀 **Getting Started**
- [Project Overview](#project-overview)
- [Current Status](#current-status)
- [Documentation Structure](#documentation-structure)
- [Quick Links by Role](#quick-links-by-role)

### 📚 **Documentation Directories**
- [/docs/ - Architecture & Specifications](#docs-directory)
- [/gcp/ - Infrastructure & Operations](#gcp-directory)
- [/members/ - Members Service](#members-directory)

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
| **Authentication Bridge** | Node.js OIDC Proxy (PKCE) | ✅ Production |
| **National eID** | Kenni.is Integration | ✅ Production |
| **Members Service** | Node.js (Express) | ✅ Production (Firebase Auth) |
| **Portal** | Python (Morepath) | 📦 Ready to Deploy |
| **Voting** | Python (Morepath) | 📦 Ready to Deploy |
| **Infrastructure** | GCP Cloud Run | ✅ Production |
| **Region** | europe-west2 (London) | ✅ Production |

---

## Current Status

### ✅ Completed (Phase 1-5)

**Phase 5 Complete** - Firebase Migration & Hybrid Architecture (Oct 5, 2025)

| Component | Status | URL/Service |
|-----------|--------|-------------|
| **Firebase/Identity Platform** | ✅ Production | ekklesia-prod-10-2025 (Free Tier) |
| **OIDC Bridge** | ✅ Enhanced | https://oidc-bridge-proxy-ymzrguoifa-ew2.a.run.app (PKCE) |
| **Kenni.is IdP** | ✅ Integrated | National eID + Kennitala extraction |
| **Members Service** | ✅ Production | https://members-521240388393.europe-west2.run.app |
| **Portal Service** | 📦 Ready | Code committed, ready to deploy |
| **Voting Service** | 📦 Ready | Code committed, ready to deploy |
| **ZITADEL** | ⚠️ Decommissioned | Saved $135/month (~$1,620/year) |

**Cost Savings**: $135/month by migrating from ZITADEL to Firebase
**Issues Resolved**: 18 total (Issues #2, #3, #4 closed)

### 🔨 In Progress

- **Security Hardening** (High Priority)
  - Move JWT key to Secret Manager
  - Add rate limiting
  - Add Cloud Armor protection

- **Database Migration** (Medium Priority)
  - Migrate kennitalas.txt → Cloud SQL with hashing

### ✅ Recently Completed (October 2025)

- **Phase 5: Firebase Migration** (Oct 5, 2025)
  - ✅ Migrated from ZITADEL to Firebase/Identity Platform
  - ✅ Enhanced OIDC Bridge with PKCE support
  - ✅ Kennitala extraction working (verified)
  - ✅ Members service with Firebase authentication
  - ✅ Portal & Voting services committed to repository
  - ✅ Cost savings: $135/month
  - ✅ ZITADEL infrastructure decommissioned

- **Milestone 3: Voting Eligibility** (Oct 5, 2025)
  - ✅ Story #14: Secure login with Kenni.is
  - ✅ Kennitala verification system
  - ✅ Member verification service
  - ✅ CSS component architecture
  - ✅ Icelandic internationalization

- **Milestone 2: OIDC Authentication** (Oct 3, 2025)
  - ✅ OpenID Connect integration
  - ✅ PKCE authentication flow
  - ✅ Session management
  - ✅ Protected routes

- **Milestone 1: Hello World Service** (Oct 3, 2025)
  - ✅ Members service deployed to Cloud Run
  - Health endpoint operational
  - Deployment automation established

---

## Documentation Structure

```
ekklesia/
├── DOCUMENTATION_MAP.md          ⭐ YOU ARE HERE - Master index
│
├── docs/                         📄 Architecture & Specifications
│   ├── specifications/           📋 Versioned technical specs
│   │   └── members-oidc-v1.0.md
│   ├── architecture/             🏗️ System design documents
│   │   ├── identity.md
│   │   ├── TECHNICAL_SOLUTION.md
│   │   └── ARCHITECTURE_DEV_VS_PROD.md
│   ├── guides/                   📖 Implementation guides
│   │   ├── MEMBERS_DEPLOYMENT_GUIDE.md
│   │   └── GCP_MIGRATION_PLAN.md
│   ├── integration/              🔗 Integration testing
│   │   └── INTEGRATION_TESTS.md
│   └── DOCUMENTATION_INDEX.md    📇 Docs directory index
│
├── gcp/                          ⚙️ Infrastructure & Operations
│   ├── deployment/               🚀 Deployment scripts & configs
│   │   ├── deploy_proxy.sh
│   │   ├── cloudflare-dns.sh
│   │   ├── setup_gcp_project.sh
│   │   ├── setup_secrets.sh
│   │   └── MEMBERS_DEPLOYMENT_SUCCESS.md
│   ├── operations/               📋 Operational runbooks
│   │   ├── RUNBOOKS.md
│   │   ├── MONITORING_SETUP.md
│   │   └── INCIDENT_RESPONSE.md
│   ├── reference/                📚 Reference documentation
│   │   ├── CURRENT_STATUS.md
│   │   ├── GCLOUD_COMMANDS_REFERENCE.md
│   │   ├── LOAD_BALANCER_SETUP.md
│   │   └── KENNI_INTEGRATION_SUCCESS.md
│   ├── archive/                  📦 Historical documents
│   │   ├── md-files/
│   │   └── sh-files/
│   └── DOCUMENTATION_INDEX.md    📇 GCP directory index
│
├── members/                      👤 Members Service (NEW)
│   ├── src/                      💻 Application code
│   ├── Dockerfile                🐳 Container definition
│   ├── package.json              📦 Dependencies
│   └── README.md                 📖 Service documentation
│
└── portal/                       🌐 Portal Service (Future)
    └── (Existing Ekklesia Portal)
```

---

## /docs/ Directory

**Purpose**: Architecture, specifications, and implementation guides

### 📋 Specifications (Versioned)

| Document | Version | Status | Purpose |
|----------|---------|--------|---------|
| `specifications/members-oidc-v1.0.md` | 1.0.0 | ✅ Complete | OIDC integration technical spec |

**Versioning**: Semantic versioning (MAJOR.MINOR.PATCH)
- **MAJOR**: Breaking changes (new authentication method)
- **MINOR**: New features (additional endpoints)
- **PATCH**: Bug fixes, clarifications

### 🏗️ Architecture

| Document | Purpose | Audience |
|----------|---------|----------|
| `architecture/identity.md` | Authentication system design | Developers, Architects |
| `architecture/TECHNICAL_SOLUTION.md` | Production infrastructure | DevOps, Operations |
| `architecture/ARCHITECTURE_DEV_VS_PROD.md` | Environment comparison | All |

### 📖 Implementation Guides

| Document | Purpose | Audience |
|----------|---------|----------|
| `guides/MEMBERS_DEPLOYMENT_GUIDE.md` | Deploy Members service | Developers, DevOps |
| `guides/GCP_MIGRATION_PLAN.md` | Cloud migration strategy | Architects, DevOps |
| `guides/ZITADEL_SETUP_CHECKLIST.md` | ZITADEL configuration | DevOps |

### 🔗 Integration & Testing

| Document | Purpose | Audience |
|----------|---------|----------|
| `integration/INTEGRATION_TESTS.md` | E2E test scenarios | QA, Developers |
| `integration/KENNI_TEST_RESULTS.md` | Kenni.is test outcomes | All |

---

## /gcp/ Directory

**Purpose**: Infrastructure deployment, operations, and reference

### 🚀 Deployment Scripts

| Script/Document | Purpose | Usage |
|--------|---------|-------|
| `deployment/deploy_proxy.sh` | Deploy OIDC bridge | `./deploy_proxy.sh` |
| `deployment/cloudflare-dns.sh` | Manage DNS records | `./cloudflare-dns.sh list` |
| `deployment/setup_gcp_project.sh` | Initial GCP setup | One-time setup |
| `deployment/setup_secrets.sh` | Configure Secret Manager | One-time setup |
| `deployment/MEMBERS_DEPLOYMENT_SUCCESS.md` | Members M1 deployment report | Reference |

### 📋 Operational Runbooks

| Document | Purpose | When to Use |
|----------|---------|-------------|
| `operations/RUNBOOKS.md` | Step-by-step operations | Daily ops, incidents |
| `operations/MONITORING_SETUP.md` | Configure monitoring | Initial setup, audits |
| `operations/INCIDENT_RESPONSE.md` | Handle outages | During incidents |

### 📚 Reference Documentation

| Document | Purpose | Audience |
|----------|---------|----------|
| `reference/CURRENT_STATUS.md` | Production status (Icelandic) | All |
| `reference/GCLOUD_COMMANDS_REFERENCE.md` | All gcloud commands used | DevOps |
| `reference/LOAD_BALANCER_SETUP.md` | LB + DNS configuration | DevOps, Network |
| `reference/KENNI_INTEGRATION_SUCCESS.md` | Kenni.is integration details | Developers |
| `reference/PHASE_4_COMPLETE.md` | Phase 4 summary | All |

---

## /members/ Directory

**Purpose**: Members service application code

### Structure

```
members/
├── src/
│   ├── index.js              # Main entry point
│   ├── config.js             # Configuration
│   ├── oidc.js               # OIDC client
│   ├── routes/
│   │   ├── index.js          # Landing page
│   │   ├── auth.js           # Login/callback/logout
│   │   ├── profile.js        # Profile page
│   │   └── health.js         # /healthz
│   ├── middleware/
│   │   └── auth.js           # requireAuth
│   ├── lib/
│   │   └── pkce.js           # PKCE utilities
│   └── views/
│       ├── index.html
│       ├── profile.html
│       └── error.html
├── Dockerfile
├── package.json
├── cloudbuild.yaml
└── README.md
```

**Documentation**: See `docs/guides/MEMBERS_DEPLOYMENT_GUIDE.md`

---

## Quick Links by Role

### 👨‍💻 **Developer - Building Features**

**Getting Started:**
1. Read: `docs/specifications/members-oidc-v1.0.md` (technical spec)
2. Review: `docs/architecture/identity.md` (authentication design)
3. Follow: `docs/guides/MEMBERS_DEPLOYMENT_GUIDE.md` (deploy locally)
4. Test: `docs/integration/INTEGRATION_TESTS.md` (test scenarios)

**Daily Work:**
- API Reference: `docs/specifications/members-oidc-v1.0.md` (Section 4)
- Code Structure: `members/README.md`
- Local Testing: `docs/guides/MEMBERS_DEPLOYMENT_GUIDE.md`

### 🚀 **DevOps - Deploying & Operating**

**Getting Started:**
1. Read: `gcp/reference/CURRENT_STATUS.md` (production status)
2. Review: `docs/architecture/TECHNICAL_SOLUTION.md` (infrastructure)
3. Setup: `gcp/deployment/setup_gcp_project.sh` (GCP setup)
4. Learn: `gcp/reference/GCLOUD_COMMANDS_REFERENCE.md` (all commands)

**Daily Work:**
- Deploy: `docs/guides/MEMBERS_DEPLOYMENT_GUIDE.md`
- Operate: `gcp/operations/RUNBOOKS.md`
- Monitor: `gcp/operations/MONITORING_SETUP.md`
- Incidents: `gcp/operations/INCIDENT_RESPONSE.md`

### 🏗️ **Architect - System Design**

**Getting Started:**
1. Read: `docs/architecture/TECHNICAL_SOLUTION.md` (full architecture)
2. Review: `docs/architecture/ARCHITECTURE_DEV_VS_PROD.md` (environments)
3. Study: `docs/specifications/members-oidc-v1.0.md` (OIDC design)
4. Plan: `docs/guides/GCP_MIGRATION_PLAN.md` (migration strategy)

**Daily Work:**
- Architecture: `docs/architecture/` (all docs)
- Specifications: `docs/specifications/` (versioned specs)
- Infrastructure: `gcp/reference/` (production details)

### 🧪 **QA - Testing**

**Getting Started:**
1. Read: `docs/integration/INTEGRATION_TESTS.md` (test scenarios)
2. Review: `gcp/reference/KENNI_INTEGRATION_SUCCESS.md` (test results)
3. Setup: `docs/guides/MEMBERS_DEPLOYMENT_GUIDE.md` (test environment)

**Daily Work:**
- Test Scenarios: `docs/integration/INTEGRATION_TESTS.md`
- Test Results: `docs/integration/KENNI_TEST_RESULTS.md`
- Bug Reporting: GitHub Issues

### 🆘 **On-Call - Handling Incidents**

**Emergency Quick Start:**
1. **First**: `gcp/operations/INCIDENT_RESPONSE.md` (what to do now)
2. **Then**: `gcp/operations/RUNBOOKS.md` (common fixes)
3. **Reference**: `gcp/reference/GCLOUD_COMMANDS_REFERENCE.md` (commands)
4. **Status**: `gcp/reference/CURRENT_STATUS.md` (baseline)

**Monitoring:**
- Dashboards: `gcp/operations/MONITORING_SETUP.md`
- Logs: Cloud Logging (links in MONITORING_SETUP.md)

---

## Documentation Maintenance

### Update Schedule

| Frequency | What to Update | Responsibility |
|-----------|----------------|----------------|
| **After Each Deployment** | Status docs, version numbers | DevOps |
| **Weekly** | Operational docs, runbooks | On-call engineer |
| **Monthly** | Architecture docs, specifications | Tech lead |
| **Quarterly** | Full documentation audit | Team |

### Versioning Strategy

**Specifications** (`docs/specifications/`):
- Use semantic versioning: `v1.0.0`
- Archive old versions: `members-oidc-v1.0.md` → `members-oidc-v1.1.md`
- Update DOCUMENTATION_MAP.md with version changes

**Operational Docs** (`gcp/operations/`):
- Add "Last Verified" dates to commands
- Update immediately after infrastructure changes
- Track changes in git commit messages

**Reference Docs** (`gcp/reference/`):
- Update with production changes
- Timestamp all updates
- Keep historical context in git history

### Contributing to Documentation

1. **Before changing architecture**: Update specification first
2. **After deploying**: Update operational docs + status
3. **After incidents**: Update runbooks + incident response
4. **Follow .code-rules**: Mask PII, no AI attribution in commits

---

## Troubleshooting Documentation

### "I can't find what I need"

**By Task:**
- Deploying Members app → `docs/guides/MEMBERS_DEPLOYMENT_GUIDE.md`
- Fixing production issue → `gcp/operations/INCIDENT_RESPONSE.md`
- Understanding authentication → `docs/architecture/identity.md`
- Running gcloud commands → `gcp/reference/GCLOUD_COMMANDS_REFERENCE.md`

**By Component:**
- ZITADEL → `gcp/reference/CURRENT_STATUS.md` + `docs/architecture/identity.md`
- OIDC Bridge → `gcp/reference/KENNI_INTEGRATION_SUCCESS.md`
- Members App → `docs/specifications/members-oidc-v1.0.md`
- Load Balancer → `gcp/reference/LOAD_BALANCER_SETUP.md`

### "The documentation is outdated"

1. Check git history: `git log -- path/to/doc.md`
2. Check "Last Updated" date in document header
3. Verify commands in non-production environment
4. Update documentation and commit with clear message

### "I need to add new documentation"

1. **Specification**: Add to `docs/specifications/` with version number
2. **Operational**: Add to `gcp/operations/` or `gcp/reference/`
3. **Guide**: Add to `docs/guides/`
4. **Update**: This master map + directory indices

---

## External Resources

### ZITADEL
- Official Docs: https://zitadel.com/docs
- OIDC Guide: https://zitadel.com/docs/guides/integrate/login/oidc
- API Reference: https://zitadel.com/docs/apis/introduction

### GCP
- Cloud Run: https://cloud.google.com/run/docs
- Cloud SQL: https://cloud.google.com/sql/docs
- Secret Manager: https://cloud.google.com/secret-manager/docs

### Standards
- OpenID Connect: https://openid.net/specs/openid-connect-core-1_0.html
- OAuth 2.0 PKCE: https://datatracker.ietf.org/doc/html/rfc7636

### Project
- GitHub Repository: https://github.com/sosialistaflokkurinn/ekklesia
- GitHub Issues: https://github.com/sosialistaflokkurinn/ekklesia/issues

---

## Support & Contact

### Internal Team
- **Tech Lead**: (team contact)
- **DevOps**: (team contact)
- **On-Call**: (rotation schedule)

### External Resources
- **ZITADEL Support**: https://zitadel.com/contact
- **GCP Support**: GCP Console → Support
- **Kenni.is Support**: https://idp.kenni.is/

---

**Document Version**: 1.0.0
**Last Reviewed**: 2025-10-03
**Next Review**: 2026-01-03 (Quarterly)
