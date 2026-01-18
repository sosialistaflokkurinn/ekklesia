# Ekklesia - AI Assistant Guide

**Last Updated:** 2026-01-16

## Before You Code

1. **Read this file** - Architecture, quick rules
2. **Read domain docs** - See "When to Read What" below
3. **Search existing code** - `js/components/`, `js/utils/`, `js/api/`

---

## Architecture

**Ekklesia is the source of truth** for the membership system.

```
┌─────────────────────────────────────────────────────────────┐
│  Ekklesia (THIS PROJECT)                                    │
│  ├── Firestore (canonical member data)                      │
│  ├── Firebase Hosting (members-portal)                      │
│  ├── Firebase Functions (svc-members, Python)               │
│  ├── Cloud Run: svc-elections (Node.js)                     │
│  ├── Cloud Run: svc-events (Node.js + AI assistants)        │
│  └── SendGrid email                                         │
├─────────────────────────────────────────────────────────────┤
│  Django GCP (INTERIM read-only admin)                       │
│  ├── Cloud Run: django-socialism                            │
│  └── Cloud SQL PostgreSQL                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Reference

| What | Where |
|------|-------|
| Frontend | `apps/members-portal/` |
| Functions | `services/svc-members/functions/` |
| Elections | `services/svc-elections/` |
| Events | `services/svc-events/` |

| Deploy | Command |
|--------|---------|
| Frontend | `firebase deploy --only hosting` |
| Function | `firebase deploy --only functions:NAME` |
| Cloud Run | `./deploy.sh` |

| URL | Purpose |
|-----|---------|
| https://felagar.sosialistaflokkurinn.is/ | Production |
| https://ekklesia-prod-10-2025.web.app | Firebase backup |

**Full quick reference:** [docs/QUICK-REFERENCE.md](docs/QUICK-REFERENCE.md)

---

## Critical Rules (Summary)

**NEVER:**
- `firebase deploy --only functions` - deploys ALL, slow, wipes secrets
- Hardcode Icelandic text - use `i18n/values-is/*.xml`
- Commit `.env` or credentials - use GCP Secret Manager
- Create duplicate code - search existing first

**ALWAYS:**
- Run `./scripts/build-css-bundle.sh` after CSS changes
- Use `--gcloud-auth` with cloud-sql-proxy
- Add rate limiting: `check_uid_rate_limit()`
- Add input validation: length, format, type

**Full rules:** [docs/CRITICAL-RULES.md](docs/CRITICAL-RULES.md)

---

## When to Read What

| Working On | Read These |
|------------|------------|
| **Any code change** | This file (CLAUDE.md) |
| Elections, voting | [docs/ELECTIONS.md](docs/ELECTIONS.md) |
| Auth, login, Kenni.is | [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) |
| Email, templates | [docs/EMAIL-TEMPLATES-GUIDE.md](docs/EMAIL-TEMPLATES-GUIDE.md) |
| Addresses, Thjodskra | [docs/ADDRESSES.md](docs/ADDRESSES.md) |
| AI, RAG, Gemini | [docs/AI-ASSISTANTS.md](docs/AI-ASSISTANTS.md) |
| Security, rate limits | [docs/SECURITY.md](docs/SECURITY.md) |
| Deployment | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| JS patterns | [docs/PATTERNS.md](docs/PATTERNS.md) |
| GCP patterns | [docs/PATTERNS-GCP.md](docs/PATTERNS-GCP.md) |

---

## File Map by Domain

### Frontend (`apps/members-portal/`)
```
js/
├── components/     # Reusable UI (toast, modal, table, etc.)
├── utils/          # Helpers (format, escapeHTML, debounce)
├── api/            # API clients (firestore, elections, events)
├── session/        # Auth (auth.js, requireAuth)
├── profile/        # Member profile pages
├── admin/          # Admin pages
└── superuser/      # Superuser pages

styles/
├── bundle.css      # Built CSS (commit this)
├── components/     # Component styles
└── global.css      # Base styles

i18n/
├── values-is/      # Icelandic strings
└── strings-loader.js
```

### Functions (`services/svc-members/functions/`)
```
fn_*.py             # Individual functions
shared/
├── rate_limit.py   # Rate limiting
├── validation.py   # Input validation
└── email.py        # SendGrid integration
```

### Services
```
services/svc-elections/   # Elections (Cloud Run)
services/svc-events/      # Events + AI (Cloud Run)
```

---

## Development Setup

```bash
# Frontend with emulators
cd services/svc-members && firebase emulators:start --only hosting

# Database access
cloud-sql-proxy ekklesia-prod-10-2025:europe-west1:ekklesia-db-eu1 --port 5433 --gcloud-auth
PGPASSWORD='Socialism2025#Db' psql -h localhost -p 5433 -U socialism -d socialism
```

---

## Code Principles

1. **Reuse Before Create** - Check existing components/utils
2. **Consistency Over Cleverness** - Match existing patterns
3. **Simple Over Complex** - Minimum needed, no over-engineering

---

## Documentation Index

| Doc | Purpose |
|-----|---------|
| [docs/QUICK-REFERENCE.md](docs/QUICK-REFERENCE.md) | All tables in one place |
| [docs/CRITICAL-RULES.md](docs/CRITICAL-RULES.md) | All rules consolidated |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design details |
| [docs/PATTERNS.md](docs/PATTERNS.md) | Code patterns, components |
| [docs/SECURITY.md](docs/SECURITY.md) | Security implementation |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Deploy procedures |
| [docs/README.md](docs/README.md) | Documentation overview |
