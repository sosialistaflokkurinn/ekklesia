# Ekklesia Documentation Hub

**Welcome to the Ekklesia project documentation.** This is your entry point for understanding the system, contributing code, and operating the platform.

---

## 🚀 Quick Start

**New to Ekklesia?** Start here:
- **[Getting Started Guide](./development/guides/github/README.md)** - Environment setup and first steps
- **[Architecture Overview](./architecture/SYSTEM_ARCHITECTURE_OVERVIEW.md)** - How the system works
- **[Development Workflow](./development/guides/git/README.md)** - Git workflow and contribution guidelines

---

## 📁 Documentation Directory

### 🏗️ Architecture
Understand how Ekklesia is designed and structured.
- **[System Architecture Overview](./architecture/SYSTEM_ARCHITECTURE_OVERVIEW.md)** - Complete system design
- **[Phase 6 Architecture Recommendations](./architecture/ARCHITECTURE_DESIGN_PHASE6.md)** - Future scaling plans
- **[Events Service Design](./architecture/EVENTS_SERVICE_MVP.md)** - Voting infrastructure
- **[CSS Design System](./architecture/CSS_DESIGN_SYSTEM.md)** - UI/UX standards

### 🎯 Features
Detailed information about each major feature and epic.
- **[Election Discovery](./features/)** - Member election discovery and listing
- **[Admin Election Lifecycle](./features/)** - Election management workflow
- **[Membership Sync](./features/)** - Django integration and member synchronization
- **[Member Election Voting](./features/)** - Complete voting flow

### 🔗 Integration & External Systems
Django backend integration, API connectivity, and data synchronization.
- **[Django Address System Deep Dive](./integration/DJANGO_ADDRESS_SYSTEM_DEEP_DIVE.md)** ⭐ **START HERE** - Complete guide to Django address architecture
- **[Django Backend System](./systems/DJANGO_BACKEND_SYSTEM.md)** - System overview and connection details
- **[Django Database Schema](./integration/DJANGO_DATABASE_SCHEMA.md)** - Complete table schema and field mappings
- **[Django API Implementation](./integration/DJANGO_API_IMPLEMENTATION.md)** - API endpoint implementation guide
- **[Django API Upgrade - Epic #116](./integration/DJANGO_API_UPGRADE_EPIC_116.md)** - Read/write API changes (includes address sync bug)
- **[Django Sync Implementation](./integration/DJANGO_SYNC_IMPLEMENTATION.md)** - Member synchronization process
- **[Django → Ekklesia Migration](./integration/DJANGO_TO_EKKLESIA_MIGRATION.md)** - Long-term migration strategy

### 🛠️ Development
Guides for developers contributing to Ekklesia.
- **[GitHub Workflow](./development/guides/github/README.md)** - Issue tracking and PRs
- **[Git Best Practices](./development/guides/git/README.md)** - Commit standards and branching
- **[Admin Guides](./development/guides/admin/README.md)** - Admin operations
- **[Troubleshooting](./development/guides/troubleshooting/README.md)** - Common issues and solutions
- **[Workflows & Processes](./development/guides/workflows/README.md)** - Multi-agent workflow, project workflows

### 🔒 Security
Security policies, hardening guides, and compliance information.
- **[Security Policies](./security/policies/)** - Security standards and requirements
- **[Audit Logging](./security/)** - Compliance and audit trails
- **[Threat Analysis](./security/)** - Security assessments

### 📊 Operations
DevOps, deployment, monitoring, and infrastructure guides.
- **[Deployment](./operations/)** - Cloud Run deployment procedures
- **[Monitoring & Alerts](./operations/)** - Health checks and alerting
- **[Infrastructure](./development/guides/infrastructure/README.md)** - GCP setup and configuration
- **[Incident Response](./operations/)** - Emergency procedures

### 📚 Reference
Technical specifications and reference documentation.
- **[API Endpoints](./reference/)** - Service API documentation
- **[Database Schema](./reference/)** - PostgreSQL schema documentation
- **[Glossary](./reference/)** - Terms and definitions

---

## 🗂️ Repository Structure

```
ekklesia/
├── services/                    # Backend services
│   ├── members/                # Members portal + auth
│   ├── events/                 # Event/election voting API
│   └── elections/              # Election result recording
│
├── apps/                       # Frontend applications
│   └── members-portal/         # Members UI (Firebase Hosting)
│
├── docs/                       # This documentation
│   ├── architecture/           # System design
│   ├── features/               # Feature-specific docs
│   ├── development/            # Developer guides
│   ├── operations/             # DevOps & deployment
│   ├── security/               # Security & compliance
│   └── reference/              # Technical specs
│
├── infrastructure/             # Infrastructure-as-Code
├── testing/                    # Test utilities & E2E tests
├── scripts/                    # Deployment & maintenance scripts
└── archive/                    # Historical / deprecated code
```

---

## 🎓 Learning Paths

Choose your path based on your role:

### For Product Managers / Non-Technical Stakeholders
1. [System Architecture Overview](./architecture/SYSTEM_ARCHITECTURE_OVERVIEW.md)
2. [Feature Documentation](./features/)
3. [Operations Guide](./operations/)

### For Frontend Developers
1. [Getting Started](./development/guides/github/README.md)
2. [Members Service Architecture](./architecture/)
3. [Feature Guides](./features/)
4. [UI Design System](./architecture/CSS_DESIGN_SYSTEM.md)

### For Backend Developers
1. [Getting Started](./development/guides/github/README.md)
2. [System Architecture](./architecture/)
3. [Service Design Documentation](./architecture/EVENTS_SERVICE_MVP.md)
4. [Database Schema](./reference/)

### For DevOps / Infrastructure
1. [Infrastructure Guide](./development/guides/infrastructure/README.md)
2. [Deployment Procedures](./operations/)
3. [Monitoring & Alerting](./operations/)
4. [Security Policies](./security/policies/)

### For Security / Compliance Teams
1. [Security Policies](./security/policies/)
2. [Audit Logging](./security/)
3. [Threat Analysis](./security/)
4. [Incident Response](./operations/)

---

## 🔗 Key Documents

| Document | Purpose | Audience |
|----------|---------|----------|
| [CURRENT_DEVELOPMENT_STATUS.md](./status/CURRENT_DEVELOPMENT_STATUS.md) | Current system status | All |
| [ENVIRONMENT_CLARIFICATION.md](./ENVIRONMENT_CLARIFICATION.md) | Production tools vs development system | All |
| [SYSTEM_ARCHITECTURE_OVERVIEW.md](./architecture/SYSTEM_ARCHITECTURE_OVERVIEW.md) | How the system works | Developers, Architects |
| [Multi-Agent Workflow](./development/guides/workflows/MULTI_AGENT_WORKFLOW.md) | Development process | Developers, Project Managers |
| [Security Defense Analysis](./security/) | Security hardening | Security, DevOps |
| [REPO_RESTRUCTURING_PLAN.md](./roadmap/REPO_RESTRUCTURING_PLAN.md) | Repository organization | Technical Leads |

---

## 🚦 Status & Roadmap

- **Current Phase**: Phase 5 - Feature Development (Nov 2025)
- **Status Page**: [CURRENT_DEVELOPMENT_STATUS.md](./status/CURRENT_DEVELOPMENT_STATUS.md)
- **Roadmap**: [Roadmap Directory](./roadmap/)
- **Open Issues**: [GitHub Issues](https://github.com/sosialistaflokkurinn/ekklesia/issues)

---

## 💬 Need Help?

1. **Check the docs** - Browse the relevant section above
2. **Search for issues** - Look at [GitHub Issues](https://github.com/sosialistaflokkurinn/ekklesia/issues)
3. **Read troubleshooting** - See [Troubleshooting Guide](./development/guides/troubleshooting/README.md)
4. **Ask in PR/Issue** - Comment on relevant GitHub issues

---

## 📝 Contributing Documentation

When adding or updating documentation:
1. Place it in the appropriate section (architecture, features, development, etc.)
2. Follow the naming conventions (UPPERCASE_WITH_UNDERSCORES.md)
3. Add a brief description to the relevant section index above
4. Link related documents
5. Keep language clear and concise

---

## 🔄 Documentation Updates

This documentation is maintained alongside the codebase. When features are added or changed:
- Update relevant docs in the same PR
- Tag documentation changes in commit messages
- Keep git history clean and meaningful

---

**Last Updated**: 2025-10-21
**Maintained By**: Ekklesia Development Team
**Repository**: [github.com/sosialistaflokkurinn/ekklesia](https://github.com/sosialistaflokkurinn/ekklesia)
