# README Files Category Map

**Last Updated**: 2025-11-14  
**Status**: ✅ Level 2 Category Map  
**Purpose**: Navigation to all README.md files across the codebase

---

## Overview

This category map provides navigation to all README.md files in the Ekklesia repository. README files serve as entry points for understanding specific directories, components, and subsystems.

**Why README files matter:**
- Primary documentation for AI assistants and developers
- Quick orientation for new contributors
- Directory-specific context and guidelines
- Component usage examples

---

## Quick Links

- [Root README](../README.md) - Project overview and getting started
- [Documentation README](../docs/README.md) - Documentation system guide
- [Scripts README](../scripts/README.md) - Available automation scripts
- [Services README](../services/) - Microservices overview

---

## README Files by Category

### 📚 Documentation System

- [docs/README.md](../docs/README.md) - Documentation system overview and navigation
- [docs/development/guides/README.md](../docs/development/guides/README.md) - Development guides index
- [docs/development/guides/admin/README.md](../docs/development/guides/admin/README.md) - Admin guides
- [docs/development/guides/infrastructure/README.md](../docs/development/guides/infrastructure/README.md) - Infrastructure guides
- [docs/development/guides/troubleshooting/README.md](../docs/development/guides/troubleshooting/README.md) - Troubleshooting guides
- [docs/development/guides/workflows/README.md](../docs/development/guides/workflows/README.md) - Workflow guides

### 🔒 Security Documentation

- [docs/security/README.md](../docs/security/README.md) - Security documentation index
- [docs/security/current/README.md](../docs/security/current/README.md) - Current security status
- [docs/security/policies/README.md](../docs/security/policies/README.md) - Security policies
- [docs/security/responses/README.md](../docs/security/responses/README.md) - Incident responses
- [docs/security/historical/README.md](../docs/security/historical/README.md) - Historical security docs
- [docs/security/historical/2025-10-16/README.md](../docs/security/historical/2025-10-16/README.md) - Oct 16 2025 security event

### 📊 Status Reports

- [docs/status/README.md](../docs/status/README.md) - Development status index
- [docs/status/ongoing/README.md](../docs/status/ongoing/README.md) - Ongoing work tracking
- [docs/status/historical/README.md](../docs/status/historical/README.md) - Historical status reports
- [docs/status/historical/2025-10-16/README.md](../docs/status/historical/2025-10-16/README.md) - Oct 16 2025 status
- [docs/status/historical/2025-10-19/README.md](../docs/status/historical/2025-10-19/README.md) - Oct 19 2025 status

### 🖥️ Applications

- [apps/README.md](../apps/README.md) - Applications directory overview
- [apps/members-portal/i18n/README.md](../apps/members-portal/i18n/README.md) - i18n system documentation
- [apps/members-portal/js/components/README.md](../apps/members-portal/js/components/README.md) - JavaScript components guide
- [apps/members-portal/styles/README.md](../apps/members-portal/styles/README.md) - CSS styles organization
- [apps/members-portal/admin/styles/README.md](../apps/members-portal/admin/styles/README.md) - Admin styles guide

### 🛠️ Scripts & Automation

- [scripts/README.md](../scripts/README.md) - Scripts directory overview
- [scripts/admin/README.md](../scripts/admin/README.md) - Administrative scripts
- [scripts/database/README.md](../scripts/database/README.md) - Database management scripts
- [scripts/deployment/README.md](../scripts/deployment/README.md) - Deployment automation
- [scripts/setup/install-git-hooks.sh](../scripts/setup/install-git-hooks.sh) - Git hooks installation script

**Archived Scripts:**
- [archive/scripts/cloudflare/README.md](../archive/scripts/cloudflare/README.md) - 🗄️ Cloudflare scripts (not in use)

### ⚙️ Services (Microservices)

- [services/elections/README.md](../services/elections/README.md) - Elections service ([Node.js/Express](https://expressjs.com/))
- [services/elections/migrations/README.md](../services/elections/migrations/README.md) - Elections database migrations
- [services/events/README.md](../services/events/README.md) - Events service ([Node.js/Express](https://expressjs.com/))
- [services/events/migrations/README.md](../services/events/migrations/README.md) - Events database migrations
- [services/members/README.md](../services/members/README.md) - Members service ([Python/Firebase Functions](https://firebase.google.com/docs/functions))
- [services/members/scripts/README.md](../services/members/scripts/README.md) - Members service utility scripts

---

## README File Purposes

### Project-Level READMEs

**Root README** ([README.md](../README.md)):
- Project overview and mission
- Quick start guide
- Technology stack summary
- Development environment setup
- Contributing guidelines

**Documentation README** ([docs/README.md](../docs/README.md)):
- Documentation system navigation
- How to find specific information
- Documentation standards
- [Hierarchical documentation philosophy](../docs/DOCUMENTATION_PHILOSOPHY.md)

### Directory-Level READMEs

**Purpose**: Explain what's in the directory and how to use it

**Examples**:
- `apps/README.md` - What applications exist
- `scripts/README.md` - What scripts are available
- `services/README.md` - What microservices exist

### Component-Level READMEs

**Purpose**: Specific usage instructions for components/subsystems

**Examples**:
- `apps/members-portal/js/components/README.md` - JavaScript component library
- `apps/members-portal/i18n/README.md` - Internationalization system
- `scripts/admin/README.md` - Administrative automation tools

### Historical READMEs

**Purpose**: Context for archived/historical documentation

**Examples**:
- `docs/security/historical/2025-10-16/README.md` - Security event context
- `docs/status/historical/2025-10-16/README.md` - Development snapshot context

---

## README Writing Guidelines

All README files should follow these principles:

### 1. Start with Purpose

```markdown
# Component Name

**Purpose**: One-line description of what this is
**Status**: ✅ Active / ⚠️ Deprecated / 📦 Archived
**Last Updated**: YYYY-MM-DD
```

### 2. Include Quick Start

Every README should have a "Quick Start" or "Getting Started" section for impatient developers:

```markdown
## Quick Start

# Install dependencies
npm install

# Run locally
npm run dev

# Run tests
npm test
```

### 3. Link to Detailed Guides

README files are **entry points**, not complete documentation:

```markdown
## Documentation

For detailed guides, see:
- [Architecture Overview](./ARCHITECTURE_MAP.md)
- [Development Guide](./DEVELOPMENT_MAP.md)
- [Features Guide](./FEATURES_MAP.md)
```

### 4. Keep It Updated

README files should be updated when:
- New features are added
- Directory structure changes
- Dependencies change
- Setup instructions change

### 5. Be AI-Friendly

README files are often the first thing AI assistants read:
- Use clear, descriptive language
- Include examples
- Link to related documentation
- Mention key technologies explicitly

---

## Related Categories

- [Development](../docs/DEVELOPMENT_MAP.md) - Development workflows and guides
- [Code Standards](../docs/CODE_STANDARDS_MAP.md) - Coding conventions
- [Documentation Philosophy](../docs/DOCUMENTATION_PHILOSOPHY.md) - Documentation hierarchy

---

**See**: [Documentation Philosophy](../docs/DOCUMENTATION_PHILOSOPHY.md) for hierarchy explanation
