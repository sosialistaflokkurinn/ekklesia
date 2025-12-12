# Ekklesia - AI Assistant Guide

## Architecture Overview

**Ekklesia is the FUTURE source of truth** for the membership system.

```
┌─────────────────────────────────────────────────────────────┐
│                    SYSTEM ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Ekklesia (THIS PROJECT - Future source of truth)           │
│  ├── Firestore database (canonical member data)             │
│  ├── Firebase Hosting (members-portal)                       │
│  ├── Firebase Functions (svc-members)                        │
│  ├── Cloud Run (svc-elections, svc-events)                  │
│  └── Postmark email (planned - #323)                        │
│                                                              │
│  Django GCP (INTERIM admin interface)                       │
│  ├── Cloud Run: django-socialism                            │
│  ├── Cloud SQL PostgreSQL                                    │
│  └── SendGrid email (temporary)                             │
│  └── See: ~/Development/projects/django/                    │
│                                                              │
│  Linode (DECOMMISSIONED 2025-12-11)                         │
│  └── Backup: ~/Development/projects/django/backups/         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Quick Reference

| What | Where |
|------|-------|
| Frontend | `apps/members-portal/` → Firebase Hosting |
| Cloud Functions | `services/svc-members/functions/` → Firebase Functions |
| Elections/Events | `services/svc-elections/`, `svc-events/` → Cloud Run |
| Database (future) | **Firestore** (source of truth) |
| Database (interim) | Cloud SQL PostgreSQL (europe-west2) |
| Django Admin | `~/Development/projects/django/` → Cloud Run (interim) |
| Deploy frontend | `cd services/svc-members && firebase deploy --only hosting` |
| Deploy function | `cd services/svc-members && firebase deploy --only functions:NAME` |
| Deploy Cloud Run | `cd services/svc-elections && ./deploy.sh` |
| Deploy Django | See Django CLAUDE.md for `gcloud builds submit` |

**Detailed docs:** [docs/README.md](docs/README.md)

---

## Critical Rules

### Never
```
firebase deploy --only functions     # Wipes secrets (unless selective)
python3 -m http.server               # No local server
git push --no-verify                 # Bypasses hooks
Hardcode Icelandic text              # Use i18n
Commit .env or credentials           # Use Secret Manager
Create duplicate code                # Reuse existing
Mix annotation/env secrets           # Use valueFrom in YAML
```

### Always
```
Search existing code first           # js/components/, js/utils/
Follow naming conventions            # See docs/PATTERNS.md
Run ./scripts/build-css-bundle.sh    # After CSS changes
Verify secrets after deploy          # gcloud run services describe
Use --gcloud-auth for proxy          # cloud-sql-proxy auth fix
```

---

## Code Principles

### 1. Reuse Before Create
Before writing new code:
- Check `js/components/` for UI components
- Check `js/utils/` for utilities
- Check sibling files for patterns

### 2. Consistency Over Cleverness
- Match existing patterns
- Follow naming conventions
- Same error handling approach

### 3. Simple Over Complex
- Minimum code needed
- No premature abstractions
- No over-engineering

---

## Project Structure

```
ekklesia/
├── apps/members-portal/     # Frontend (Firebase Hosting)
│   ├── js/components/       # Reusable UI components
│   ├── js/utils/            # Utility functions
│   ├── js/api/              # API clients
│   ├── styles/              # CSS (bundle)
│   └── i18n/                # Translations
├── services/
│   ├── svc-members/         # Firebase Functions (Python)
│   ├── svc-elections/       # Cloud Run (Node.js)
│   └── svc-events/          # Cloud Run (Node.js)
├── scripts/                 # Automation
└── docs/                    # Documentation
```

---

## Common Tasks

### Add New Feature
1. Search for similar existing code
2. Reuse components from `js/components/`
3. Follow naming: `[domain]-[name].js`
4. Add i18n strings to XML files
5. Test: no console errors, no 404s

### Fix Bug
1. Understand root cause
2. Check if fix can reuse existing utilities
3. Test edge cases
4. Verify in browser console

### Deploy

```bash
# Frontend (HTML/JS/CSS)
cd services/svc-members && firebase deploy --only hosting

# Cloud Functions - single function (preferred)
cd services/svc-members && firebase deploy --only functions:FUNCTION_NAME

# Cloud Functions - all (note: large upload ~130MB)
cd services/svc-members && firebase deploy --only functions

# Elections service (Cloud Run)
cd services/svc-elections && ./deploy.sh

# Events service (Cloud Run)
cd services/svc-events && ./deploy.sh

# Django Admin (Cloud Run) - see Django CLAUDE.md
cd ~/Development/projects/django
gcloud builds submit --config cloudbuild.yaml \
  --substitutions="_REGION=europe-west2,_SERVICE_NAME=django-socialism,..."
```

**Important deploy notes:**
- `svc-members` uses Firebase Functions (Python) - deploy via `firebase deploy`
- `svc-elections` and `svc-events` use Cloud Run - deploy via `./deploy.sh`
- Never use `firebase deploy --only functions` without specifying function name (slow + risky)
- Single function deploy: `firebase deploy --only functions:sync_from_django`
- Django admin: deploy via `gcloud builds submit` (see Django CLAUDE.md)

---

## Data Sources

### Source of Truth Hierarchy
1. **Firestore** - Future canonical source (Ekklesia)
2. **Cloud SQL** - Current operational database (Django GCP)

### Sync Status
- Members sync from Firestore → Cloud SQL (planned)
- Django admin reads/writes to Cloud SQL

---

## Related Issues
- **#323** - Postmark email integration
- **#324** - Email migration from Linode to GCP

---

## Documentation

| Doc | Purpose |
|-----|---------|
| [docs/README.md](docs/README.md) | Overview and quick links |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design |
| [docs/PATTERNS.md](docs/PATTERNS.md) | Code patterns, components |
| [docs/SECURITY.md](docs/SECURITY.md) | Security rules |
