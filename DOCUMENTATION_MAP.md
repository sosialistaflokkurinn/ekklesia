# 🗺️ Ekklesia Platform - Documentation Map

**Version**: 9.1.0
**Last Updated**: 2025-12-01
**Status**: ✅ Level 1 Navigation Hub - Hierarchical Documentation System  

---

## 📖 About This Document

This is the **Level 1 navigation hub** for all Ekklesia documentation. It provides high-level overview and links to **Level 2 category maps**, which in turn link to detailed guides.

**New to documentation?** Read: [Documentation Philosophy](docs/DOCUMENTATION_PHILOSOPHY.md) - Explains the 3-level hierarchy

---

## 🚀 Quick Start

### For New Developers
1. [Code Standards](docs/CODE_STANDARDS_MAP.md) - Learn our coding conventions
2. [Development Guides](docs/DEVELOPMENT_MAP.md) - Understand our workflows
3. [System Architecture](docs/ARCHITECTURE_MAP.md) - Understand the system design

### For Product Managers
1. [System Architecture](docs/ARCHITECTURE_MAP.md) - Understand the system design
2. [Features](docs/FEATURES_MAP.md) - See what we've built
3. [Operations](docs/OPERATIONS_MAP.md) - How we run in production

### For DevOps
1. [Infrastructure](docs/INFRASTRUCTURE_MAP.md) - Cloud services and deployment
2. [Operations](docs/OPERATIONS_MAP.md) - Operational procedures
3. [Security](docs/SECURITY_MAP.md) - Security policies and procedures
4. [System Health](https://ekklesia-prod-10-2025.web.app/superuser/system-health.html) - Live system monitoring (requires superuser role)

---

## 📊 Project Overview

**Ekklesia** is a democratic participation platform for [Sósíalistaflokkur Íslands](https://www.socialist.is) (Socialist Party of Iceland).

### Technology Stack

| Component | Technology | Status |
|-----------|-----------|--------|
| **Identity Provider** | [Firebase/Identity Platform](https://cloud.google.com/identity-platform) | ⚙️ Deployed |
| **National eID** | [Kenni.is](https://idp.kenni.is/) OAuth PKCE | ⚙️ Deployed |
| **Members Service** | [Firebase Hosting](https://firebase.google.com/docs/hosting) + [Python Cloud Functions](https://cloud.google.com/functions/docs) | ⚙️ Deployed |
| **Events Service** | [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/) on [Cloud Run](https://cloud.google.com/run) | ⚙️ Deployed |
| **Elections Service** | [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/) on [Cloud Run](https://cloud.google.com/run) | ⚙️ Deployed |
| **Database** | [Cloud SQL PostgreSQL 15](https://cloud.google.com/sql/docs/postgres) | ⚙️ Deployed |
| **Region** | [europe-west2 (London)](https://cloud.google.com/compute/docs/regions-zones) | ⚙️ Deployed |

**System Status**: 🟡 **Beta** - Active development, not yet in production use
**Infrastructure**: Production-grade GCP resources (ekklesia-prod-10-2025 project)
**Cost**: ~$7-13/month
**Deployment**: Fully automated via [Cloud Run](https://cloud.google.com/run/docs/deploying)

---

## 🗂️ Documentation Categories

### 📐 [Code Standards](docs/CODE_STANDARDS_MAP.md)
Coding conventions, style guides, and best practices for all technologies.

**Quick Links**:
- [CSS & BEM](docs/standards/CSS_BEM_GUIDE.md) - BEM methodology and design system
- [JavaScript ES6+](docs/standards/JAVASCRIPT_GUIDE.md) - Modern JavaScript standards
- [HTML & Accessibility](docs/standards/HTML_GUIDE.md) - Semantic HTML and WCAG 2.1 AA
- [Internationalization](docs/standards/I18N_GUIDE.md) - i18n with R.string pattern
- [Data Quality & UX](docs/standards/DATA_QUALITY_UX.md) - Validation and auto-correction
- [Documentation](docs/standards/DOCUMENTATION_GUIDE.md) - Writing JSDoc and READMEs
- [Git Workflow](docs/standards/GIT_WORKFLOW_GUIDE.md) - Conventional commits and PR process
- [Quality & Testing](docs/standards/QUALITY_TESTING_GUIDE.md) - Testing philosophy

---

### 🛠️ [Development](docs/DEVELOPMENT_MAP.md)
Developer workflows, tools, and implementation guides.

**Quick Links**:
- [GitHub Workflow](docs/development/guides/github/) - PR and issue management
- [Testing Guide](docs/TESTING_MAP.md) - QA processes
- [Git Conventions](docs/standards/GIT_WORKFLOW_GUIDE.md) - Branching and commits
- [Chrome Debugging](docs/development/guides/CHROME_REMOTE_DEBUGGING.md) - Remote debugging
- [Debug Logging](docs/development/guides/DEBUG_LOGGING.md) - Console monitoring

---

### 🏗️ [Architecture](docs/ARCHITECTURE_MAP.md)
System design, component architecture, and technical decisions.

**Quick Links**:
- [System Architecture](docs/architecture/SYSTEM_ARCHITECTURE.md) - Complete system overview (NEW - Dec 2025)
- [Database Schema](docs/integration/DJANGO_DATABASE_SCHEMA.md) - Django DB schema and sync
- [Cloud Run Services](docs/infrastructure/CLOUD_RUN_SERVICES.md) - 22 services documented
- [Django Backend System](docs/systems/DJANGO_BACKEND_SYSTEM.md) - Backend documentation
- [CSS Design System](docs/architecture/CSS_DESIGN_SYSTEM.md) - Component architecture

---

### ✨ [Features](docs/FEATURES_MAP.md)
Feature-specific documentation and epic implementation guides.

**Quick Links**:
- [Election Voting](docs/features/election-voting/) - Voting system docs
  - [Database Schema](docs/features/election-voting/DATABASE_SCHEMA.md) - Complete elections schema reference
  - [Epic #24: Admin Lifecycle](docs/features/election-voting/EPIC_24_ADMIN_LIFECYCLE.md)
  - [Epic #43: Member Management](docs/features/election-voting/EPIC_43_MEMBER_MANAGEMENT_SYSTEM.md)
  - [Epic #87: Election Discovery](docs/features/election-voting/EPIC_87_ELECTION_DISCOVERY.md)
  - [Admin API Reference](docs/features/election-voting/ADMIN_API_REFERENCE.md)
- [Admin Portal](docs/features/admin-portal/) - Admin functionality
  - [Epic #116: Member Detail & Edit](docs/features/admin-portal/EPIC_116_MEMBER_DETAIL_EDIT_PLAN.md)
- [Components](docs/features/SEARCHABLE_SELECT_COMPONENT.md) - Reusable UI components

---

### 🧪 [Testing](docs/TESTING_MAP.md)
Testing strategies, QA processes, and test documentation.

**Quick Links**:
- [Quality & Testing Guide](docs/standards/QUALITY_TESTING_GUIDE.md) - Complete testing guide
- [Test Reports](testing/reports/) - Test execution reports

---

### 🔧 [Operations](docs/OPERATIONS_MAP.md)
Production operations, deployment, and monitoring.

**Quick Links**:
- [Operational Procedures](docs/operations/OPERATIONAL_PROCEDURES.md) - Meeting day operations
- [Development Status](docs/status/CURRENT_DEVELOPMENT_STATUS.md) - Current status (Beta)
- [Deployment Guides](docs/setup/) - Service deployment
  - [Members Deployment Guide](docs/setup/MEMBERS_DEPLOYMENT_GUIDE.md)
- [GitHub Workflows](docs/operations/GITHUB_WORKFLOWS_STATUS.md) - CI/CD status (563 lines)

---

### 🔐 [Security](docs/SECURITY_MAP.md)
Security policies, incident responses, and compliance.

**Quick Links**:
- [Security Policies](docs/security/policies/) - Policy documentation
  - [Credential Migration Plan](docs/security/policies/CREDENTIAL_MIGRATION_PLAN.md)
  - [History Purge Plan](docs/security/policies/HISTORY_PURGE_PLAN.md)
  - [Voting Anonymity Model](docs/security/policies/VOTING_ANONYMITY_MODEL.md) - Voting system security analysis
- [Incident Responses](docs/security/responses/) - Security incidents
  - [Issues #31-40 Security Review](docs/security/responses/ISSUES_31-40_SECURITY_REVIEW_RESPONSE.md)
  - [Issues #41-50 Critical Review](docs/security/responses/ISSUES_41-50_CRITICAL_REVIEW.md)
- [Critical Actions Log](docs/security/current/CRITICAL_ACTIONS_LOG.md) - Audit trail

---

### � [README Files](docs/README_MAP.md)
Entry points and directory-level documentation across the codebase.

**Quick Links**:
- [Root README](README.md) - Project overview and getting started
- [Documentation README](docs/README.md) - Documentation system guide
- [Scripts README](scripts/README.md) - Available automation scripts
- [Services README](services/) - Microservices overview
- [Apps README](apps/README.md) - Applications directory
- [Security README](docs/security/README.md) - Security documentation index

**Why README files matter**: They guide AI assistants and developers, providing quick orientation and directory-specific context.

---

### �🔌 [Integration](docs/INTEGRATION_MAP.md)
External system integrations and API documentation.

**Quick Links**:
- [Django Backend](docs/systems/DJANGO_BACKEND_SYSTEM.md) - Complete backend docs (1,199 lines)
- [Django Address System](docs/integration/DJANGO_ADDRESS_SYSTEM_DEEP_DIVE.md) - Address architecture (1,106 lines)
- [Django Database Schema](docs/integration/DJANGO_DATABASE_SCHEMA.md) - DB schema reference
- [Django API Implementation](docs/integration/DJANGO_API_IMPLEMENTATION.md) - API guide
- [Django Migration Strategy](docs/integration/DJANGO_TO_EKKLESIA_MIGRATION.md) - Long-term plan
- [API Documentation](docs/features/election-voting/ADMIN_API_REFERENCE.md) - Admin API endpoints

---

### 🏗️ [Infrastructure](docs/INFRASTRUCTURE_MAP.md)
Cloud infrastructure, services, and deployment pipelines.

**Quick Links**:
- [Cloud Run Services](docs/infrastructure/CLOUD_RUN_SERVICES.md) - Service config (1000+ lines)
- [GitHub Workflows](docs/operations/GITHUB_WORKFLOWS_STATUS.md) - CI/CD workflows (563 lines)
- [Database Scripts](scripts/database/README.md) - Cloud SQL tools
- [Deployment Scripts](scripts/deployment/README.md) - Deployment automation
- [Admin Scripts](scripts/admin/README.md) - Documentation validation tools

---

## 📍 Current Status

### ⚙️ Deployed Services - Beta (November 14, 2025)

**Status**: 🟡 Beta - Active development with production-grade infrastructure

| Service | Status | URL/Details |
|---------|--------|-------------|
| **[Members Portal](https://ekklesia-prod-10-2025.web.app)** | 🟡 Beta | Firebase Hosting + Python Cloud Functions |
| **[Events Service](services/svc-events/)** | 🟡 Beta | Cloud Run (europe-west2) |
| **[Elections Service](services/svc-elections/)** | 🟡 Beta | Cloud Run (europe-west2) |
| **[Cloud SQL Database](https://console.cloud.google.com/sql)** | 🟡 Beta | PostgreSQL 15 (2 schemas: public, elections) |

**Note**: Services use production-grade infrastructure (GCP production project) but system is under active development and not yet in production use. Real Icelandic eID (Kenni.is) authentication is enabled for testing purposes.

### 🔨 Current Work (December 2025)

- **Superuser Console**: System health monitoring, audit logs, role management (✅ Complete)
- **Real-time Sync**: Django ↔ Firestore bidirectional sync (✅ Complete)
- **Documentation Verification**: Audit and update of all system documentation (In Progress)
- **22 Cloud Run Services**: Full service catalog deployed and documented

**Recent Milestones**: See [Status Documents](docs/status/) for detailed history

---

## 🗂️ Repository Structure

```
ekklesia/
├── DOCUMENTATION_MAP.md         # THIS FILE - Level 1 navigation hub
│
├── docs/                        # Level 2 category maps + Level 3 guides
│   ├── CODE_STANDARDS_MAP.md    # Code standards category
│   ├── DEVELOPMENT_MAP.md       # Development category
│   ├── ARCHITECTURE_MAP.md      # Architecture category
│   ├── FEATURES_MAP.md          # Features category
│   ├── TESTING_MAP.md           # Testing category
│   ├── OPERATIONS_MAP.md        # Operations category
│   ├── SECURITY_MAP.md          # Security category
│   ├── INTEGRATION_MAP.md       # Integration category
│   ├── INFRASTRUCTURE_MAP.md    # Infrastructure category
│   ├── README_MAP.md            # README files category
│   │
│   ├── standards/               # Detailed guides (Level 3)
│   ├── development/
│   ├── architecture/
│   ├── features/
│   ├── testing/
│   ├── operations/
│   ├── security/
│   ├── integration/
│   ├── infrastructure/
│   └── ...
│
├── services/                    # Backend services
│   ├── members/                 # Members service (Cloud Functions)
│   ├── events/                  # Events service (Cloud Run)
│   └── elections/               # Elections service (Cloud Run)
│
├── apps/                        # Frontend applications
│   └── members-portal/          # Members UI (Firebase Hosting)
│
├── scripts/                     # Deployment & maintenance
│   ├── admin/                   # Documentation validation
│   ├── database/                # Cloud SQL tools
│   └── deployment/              # Deployment automation
│
├── testing/                     # Test suites & reports
├── data/                        # Data files (gitignored)
└── archive/                     # Historical/deprecated code
```

---

## 🧭 Navigation Guide

### Finding Information

1. **Start here** (DOCUMENTATION_MAP.md) - Identify the category
2. **Go to category map** (e.g., [docs/CODE_STANDARDS_MAP.md](docs/CODE_STANDARDS_MAP.md)) - Find the specific guide
3. **Read detailed guide** (e.g., [docs/standards/CSS_BEM_GUIDE.md](docs/standards/CSS_BEM_GUIDE.md)) - Get implementation details

### Documentation Levels

- **Level 1**: This file - Navigation hub only
- **Level 2**: Category maps (`*_MAP.md`) - Overview + links to guides
- **Level 3+**: Detailed guides - Complete implementation details

**See**: [Documentation Philosophy](docs/DOCUMENTATION_PHILOSOPHY.md) for more details

---

## 🛠️ Documentation Maintenance

### Validation Scripts

| Script | Purpose |
|--------|---------|
| `scripts/admin/documentation-maintenance/validate-all.sh` | Master validation (runs all checks) |
| `scripts/admin/documentation-maintenance/validate-links.py` | Markdown link validation |
| `scripts/admin/documentation-maintenance/check-docs-freshness.sh` | Freshness monitoring |
| `scripts/admin/documentation-maintenance/audit-docs.py` | Documentation audit |
| `scripts/maintenance/check-code-health.py` | Code health checks |

### Quick Commands

```bash
# Validate all documentation
./scripts/admin/documentation-maintenance/validate-all.sh

# Check links only
python3 scripts/admin/documentation-maintenance/validate-links.py --exclude audits archive

# Check freshness
./scripts/admin/documentation-maintenance/check-docs-freshness.sh
```

### Live Monitoring

- [System Health](https://ekklesia-prod-10-2025.web.app/superuser/system-health.html) - Real-time service status
- [Audit Logs](https://ekklesia-prod-10-2025.web.app/superuser/audit-logs.html) - Change tracking

### For Contributors

- **Creating new docs**: Start at appropriate level (see [Documentation Philosophy](docs/DOCUMENTATION_PHILOSOPHY.md))
- **Style guide**: Follow [Documentation Guide](docs/standards/DOCUMENTATION_GUIDE.md)

### Excluded Directories

The following directories are excluded from documentation hierarchy:
- [`/docs/audits/`](docs/audits/) - Historical audits (archival only)
- [`/archive/`](archive/) - Deprecated code/docs (historical reference)

---

## 🔗 External Resources

### Firebase & GCP
- [Firebase Documentation](https://firebase.google.com/docs) - Complete Firebase docs
- [Cloud Run Documentation](https://cloud.google.com/run/docs) - Serverless container platform
- [Cloud SQL Documentation](https://cloud.google.com/sql/docs/postgres) - PostgreSQL managed service
- [Identity Platform](https://cloud.google.com/identity-platform/docs) - Authentication service
- [Cloud Functions](https://cloud.google.com/functions/docs) - Serverless functions

### Authentication
- [Kenni.is OAuth](https://idp.kenni.is/) - Icelandic national eID
- [OAuth 2.0 PKCE](https://datatracker.ietf.org/doc/html/rfc7636) - Authorization code flow
- [OpenID Connect](https://openid.net/specs/openid-connect-core-1_0.html) - Authentication layer

### Project
- [GitHub Repository](https://github.com/sosialistaflokkurinn/ekklesia) - Source code
- [GitHub Issues](https://github.com/sosialistaflokkurinn/ekklesia/issues) - Issue tracker
- [GitHub Projects](https://github.com/sosialistaflokkurinn/ekklesia/projects) - Project boards

---

## 📞 Support

### Production Issues
- **Firebase**: [Firebase Console](https://console.firebase.google.com/) → Authentication
- **Cloud Services**: [GCP Console](https://console.cloud.google.com/) → Cloud Run / Cloud SQL
- **Database**: [Cloud SQL Console](https://console.cloud.google.com/sql) → ekklesia-db

### Development Help
- **Documentation**: This file + [category maps](docs/)
- **Procedures**: [Operations Map](docs/OPERATIONS_MAP.md)
- **Security**: [Security Map](docs/SECURITY_MAP.md)

---

**Document Version**: 9.2.0
**Major Change**: Updated Documentation Maintenance section with correct script paths and live monitoring links
**Last Reviewed**: 2025-12-01
**Next Review**: 2026-03-01 (Quarterly)
**Philosophy**: [Documentation Philosophy](docs/DOCUMENTATION_PHILOSOPHY.md)
