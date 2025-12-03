# Ekklesia Documentation Hub

**Welcome to the Ekklesia project documentation.** This is your entry point for understanding the system, contributing code, and operating the platform.

---

## 🚀 Quick Start

**New to Ekklesia?** Start here:
- **[Getting Started Guide](./development/guides/github/)** - Environment setup and first steps
- **[Development Workflow](./development/guides/git/)** - Git workflow and contribution guidelines
- **[DOCUMENTATION_MAP.md](../DOCUMENTATION_MAP.md)** ⭐ **Master Navigation Hub** - Complete system overview

---

## 📁 Documentation Directory

### 🏗️ Architecture
Understand how Ekklesia is designed and structured.
- **[CSS Design System](./architecture/CSS_DESIGN_SYSTEM.md)** - UI/UX standards

### 🎯 Features
Detailed information about each major feature and epic.
- **[Election Discovery](./archive/features/election-voting/EPIC_87_ELECTION_DISCOVERY.md)** ✅ Complete - Member election discovery and listing
- **[Admin Election Lifecycle](./archive/features/election-voting/EPIC_24_ADMIN_LIFECYCLE.md)** ✅ Complete - Election management workflow
- **[Membership Sync](./features/election-voting/EPIC_43_MEMBER_MANAGEMENT_SYSTEM.md)** - Django integration and member synchronization
- **[Member Election Voting](./features/election-voting/)** - Complete voting flow

### 🔗 Integration & External Systems
Django backend integration, API connectivity, and data synchronization.
- **[Django Address System Deep Dive](./integration/DJANGO_ADDRESS_SYSTEM_DEEP_DIVE.md)** ⭐ **START HERE** - Complete guide to Django address architecture
- **[Django Backend System](./systems/DJANGO_BACKEND_SYSTEM.md)** - System overview and connection details
- **[Django Database Schema](./integration/DJANGO_DATABASE_SCHEMA.md)** - Complete table schema and field mappings
- **[Django API Implementation](./integration/DJANGO_API_IMPLEMENTATION.md)** - API endpoint implementation guide
- **[Django API Upgrade - Epic #116](./integration/DJANGO_API_UPGRADE_EPIC_116.md)** - Read/write API changes (includes address sync bug)
- **[Django Sync Implementation](./integration/DJANGO_SYNC_IMPLEMENTATION.md)** - Member synchronization process
- **[Django → Ekklesia Migration](./integration/DJANGO_TO_EKKLESIA_MIGRATION.md)** - Long-term migration strategy

### 📐 Code Standards
**Required reading for all developers**. Unified code standards and style guides.
- **[Code Standards (Category Map)](./CODE_STANDARDS_MAP.md)** ⭐ **START HERE** - Overview of all standards
- **[CSS & BEM Guide](./standards/CSS_BEM_GUIDE.md)** - CSS methodology and design system
- **[HTML Guide](./standards/HTML_GUIDE.md)** - Semantic HTML and accessibility
- **[JavaScript Guide](./standards/JAVASCRIPT_GUIDE.md)** - ES6+ standards and patterns
- **[i18n Guide](./standards/I18N_GUIDE.md)** - Internationalization with R.string
- **[Data Quality & UX Guide](./standards/DATA_QUALITY_UX.md)** - User experience and validation
- **[Documentation Guide](./standards/DOCUMENTATION_GUIDE.md)** - Writing JSDoc, READMEs, and ADRs
- **[Git Workflow Guide](./standards/GIT_WORKFLOW_GUIDE.md)** - Branching and commit conventions
- **[Quality & Testing Guide](./standards/QUALITY_TESTING_GUIDE.md)** - Testing philosophy and practices

### 🛠️ Development
Guides for developers contributing to Ekklesia.
- **[GitHub Workflow](./development/guides/github/)** - Issue tracking and PRs
- **[Git Best Practices](./development/guides/git/)** - Commit standards and branching
- **[Admin Guides](./development/guides/admin/)** - Admin operations
- **[Troubleshooting](./development/guides/troubleshooting/)** - Common issues and solutions
- **[Workflows & Processes](./development/guides/workflows/)** - Multi-agent workflow, project workflows

### 🔒 Security
Security policies, hardening guides, and compliance information.
- **[Security Policies](./security/)** - Security standards and requirements
- **[Audit Logging](./development/guides/admin/AUDIT_LOGGING.md)** - Compliance and audit trails
- **[Threat Analysis](./security/)** - Security assessments

### 📊 Operations
DevOps, deployment, monitoring, and infrastructure guides.
- **[Deployment](./setup/)** - Cloud Run deployment procedures
- **[Monitoring & Alerts](./operations/OPERATIONAL_PROCEDURES.md)** - Health checks and alerting
- **[Infrastructure](./development/guides/infrastructure/README.md)** - GCP setup and configuration
- **[Incident Response](./operations/OPERATIONAL_PROCEDURES.md)** - Emergency procedures

### 📚 Reference
Technical specifications and reference documentation.
- **[API Endpoints](./design/)** - Service API documentation
- **[Database Schema](./integration/DJANGO_DATABASE_SCHEMA.md)** - PostgreSQL schema documentation
- **[Glossary](../DOCUMENTATION_MAP.md)** - Terms and definitions

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
│   ├── DOCUMENTATION_MAP.md    # 🗺️ Master navigation hub (Level 1)
│   ├── CODE_STANDARDS_MAP.md   # Code standards category map (Level 2)
│   ├── DEVELOPMENT_MAP.md      # Development category map (Level 2)
│   ├── ARCHITECTURE_MAP.md     # Architecture category map (Level 2)
│   ├── FEATURES_MAP.md         # Features category map (Level 2)
│   ├── TESTING_MAP.md          # Testing category map (Level 2)
│   ├── OPERATIONS_MAP.md       # Operations category map (Level 2)
│   ├── SECURITY_MAP.md         # Security category map (Level 2)
│   ├── INTEGRATION_MAP.md      # Integration category map (Level 2)
│   ├── INFRASTRUCTURE_MAP.md   # Infrastructure category map (Level 2)
│   ├── README_MAP.md           # README files category map (Level 2)
│   ├── standards/              # Code standards and style guides (Level 3)
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
1. [Feature Documentation](./features/election-voting/)
2. [Operations Guide](./operations/OPERATIONAL_PROCEDURES.md)

### For Frontend Developers
1. [Getting Started](./development/guides/github/)
2. **[Code Standards Map](./CODE_STANDARDS_MAP.md)** - HTML, CSS, JavaScript, i18n standards
3. [HTML Guide](./standards/HTML_GUIDE.md) - [Semantic HTML](https://developer.mozilla.org/en-US/docs/Glossary/Semantics#semantics_in_html) and [WCAG 2.1 AA](https://www.w3.org/WAI/WCAG21/quickref/)
4. [CSS & BEM Guide](./standards/CSS_BEM_GUIDE.md) - [BEM methodology](http://getbem.com/)
5. [JavaScript Guide](./standards/JAVASCRIPT_GUIDE.md) - [ES6+](https://developer.mozilla.org/en-US/docs/Web/JavaScript) standards
6. [i18n Guide](./standards/I18N_GUIDE.md) - [R.string pattern](./standards/I18N_GUIDE.md)
7. [Feature Guides](./features/election-voting/)

### For Backend Developers
1. [Getting Started](./development/guides/github/)
2. **[Code Standards Map](./CODE_STANDARDS_MAP.md)** - JavaScript, Python, testing, and documentation standards
3. [Python Guide](./standards/PYTHON_GUIDE.md) - [Python 3.11+](https://www.python.org/), [typing](https://docs.python.org/3/library/typing.html), [Firebase Functions](https://firebase.google.com/docs/functions)
4. Service Design Documentation (see [services/](../services/))
5. [Database Schema](./integration/DJANGO_DATABASE_SCHEMA.md) - [PostgreSQL](https://www.postgresql.org/docs/)

### For DevOps / Infrastructure
1. [Infrastructure Guide](./development/guides/infrastructure/README.md)
2. [Deployment Procedures](./setup/)
3. [Monitoring & Alerting](./operations/OPERATIONAL_PROCEDURES.md)
4. [Security Policies](./security/)

### For Security / Compliance Teams
1. [Security Policies](./security/)
2. [Audit Logging](./development/guides/admin/AUDIT_LOGGING.md)
3. [Threat Analysis](./security/)
4. [Incident Response](./operations/OPERATIONAL_PROCEDURES.md)

---

## 🔗 Key Documents

| Document | Purpose | Audience |
|----------|---------|----------|
| [CURRENT_DEVELOPMENT_STATUS.md](./status/CURRENT_DEVELOPMENT_STATUS.md) | Current system status | All |
| [ENVIRONMENT_CLARIFICATION.md](./ENVIRONMENT_CLARIFICATION.md) | Production tools vs development system | All |
| [Multi-Agent Workflow](./development/guides/workflows/MULTI_AGENT_WORKFLOW.md) | Development process | Developers, Project Managers |
| [Security Defense Analysis](./security/) | Security hardening | Security, DevOps |

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

**Last Updated**: 2025-12-01
**Maintained By**: Ekklesia Development Team
**Repository**: [github.com/sosialistaflokkurinn/ekklesia](https://github.com/sosialistaflokkurinn/ekklesia)
