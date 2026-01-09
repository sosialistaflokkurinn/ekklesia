# Ekklesia - AI Assistant Guide

## Architecture Overview

**Ekklesia is the source of truth** for the membership system.

```
┌─────────────────────────────────────────────────────────────┐
│                    SYSTEM ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Ekklesia (THIS PROJECT - Source of truth)                  │
│  ├── Firestore database (canonical member data)             │
│  ├── Firebase Hosting (members-portal)                       │
│  ├── Firebase Functions (svc-members, Python)               │
│  ├── Cloud Run: svc-elections (Node.js)                     │
│  ├── Cloud Run: svc-events (Node.js + AI assistants)        │
│  │   ├── Kimi sysadmin chat (superuser only)                │
│  │   └── Member assistant (RAG + web search)                │
│  └── SendGrid email                                          │
│                                                              │
│  Django GCP (INTERIM read-only admin)                       │
│  ├── Cloud Run: django-socialism                            │
│  ├── Cloud SQL PostgreSQL                                    │
│  └── See: ~/Development/projects/django/                    │
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
| Database (interim) | Cloud SQL PostgreSQL (europe-west1: ekklesia-db-eu1) |
| Django Admin | `~/Development/projects/django/` → Cloud Run (interim) |
| Deploy frontend | `cd services/svc-members && firebase deploy --only hosting` |
| Deploy function | `cd services/svc-members && firebase deploy --only functions:NAME` |
| Deploy Cloud Run | `cd services/svc-elections && ./deploy.sh` |
| Deploy Django | See Django CLAUDE.md for `gcloud builds submit` |

## Live URLs

| Environment | URL |
|-------------|-----|
| **Production** | https://felagar.sosialistaflokkurinn.is/ |
| Hitakort | https://felagar.sosialistaflokkurinn.is/members-area/heatmap.html |
| Firebase (backup) | https://ekklesia-prod-10-2025.web.app |

**Detailed docs:** [docs/README.md](docs/README.md)

---

## Development Setup

### Local Testing
```bash
# Frontend with Firebase emulators (recommended)
cd services/svc-members && firebase emulators:start --only hosting

# Or use Firebase serve
firebase serve --only hosting --port 5000
```

### Database Access
```bash
# Start Cloud SQL proxy (ALWAYS use --gcloud-auth)
cloud-sql-proxy ekklesia-prod-10-2025:europe-west1:ekklesia-db-eu1 --port 5433 --gcloud-auth

# Connect to PostgreSQL
PGPASSWORD='Socialism2025#Db' psql -h localhost -p 5433 -U socialism -d socialism
```

### Environment Variables
Services read secrets from GCP Secret Manager. Key secrets:
- `django-api-token` - Django API authentication
- `django-socialism-db-password` - PostgreSQL password
- `kenni-client-secret` - Kenni.is OAuth secret
- `kimi-api-key` - Moonshot Kimi API key (sysadmin chat)
- `brave-search-api-key` - Web search fallback for member assistant

---

## Database Structure

### Firestore Collections (Source of Truth)
| Collection | Purpose | Key Fields |
|------------|---------|------------|
| `members` | Member profiles | `uid`, `kennitala`, `name`, `email`, `django_id` |
| `cells` | Local chapters | `name`, `postal_codes[]`, `region` |
| `audit_log` | Activity tracking | `action`, `uid`, `timestamp` |

### Cloud SQL Tables (Elections/Events)
| Table | Purpose |
|-------|---------|
| `elections` | Election definitions |
| `ballots` | Cast votes |
| `candidates` | Election candidates |
| `rag_documents` | AI assistant knowledge base (pgvector) |

---

## Critical Rules

### Never (and Why)

| Command | Why It's Banned |
|---------|-----------------|
| `firebase deploy --only functions` | Redeploys ALL functions (~130MB), wipes secrets from containers not in deploy |
| `python3 -m http.server` | CORS blocks Firebase Auth; use `firebase serve` instead |
| `git push --no-verify` | Bypasses pre-commit hooks that catch secrets/PII leaks |
| Hardcode Icelandic text | Breaks i18n; add strings to `i18n/values-is/*.xml` |
| Commit `.env` or credentials | Secrets belong in GCP Secret Manager, not git |
| Create duplicate code | Check `js/components/`, `js/utils/` first - reuse existing |
| Mix annotation/env secrets | Use only `valueFrom.secretKeyRef` in YAML, not annotations |

### Always

| Action | Why |
|--------|-----|
| Search existing code first | `js/components/`, `js/utils/` have reusable patterns |
| Follow naming conventions | See docs/PATTERNS.md for `[domain]-[name].js` pattern |
| Run `./scripts/build-css-bundle.sh` | CSS changes need bundle rebuild before deploy |
| Run `./scripts/check-css-versions.sh` | Prevents CSS cache issues (auto-runs on deploy) |
| Verify secrets after deploy | `gcloud run services describe` confirms secret mounting |
| Use `--gcloud-auth` for proxy | Avoids ADC auth issues with cloud-sql-proxy |
| Add rate limiting to writes | `check_uid_rate_limit()` prevents abuse |
| Add input validation | Length/format checks prevent injection attacks |
| Add timeout to HTTP requests | `timeout=30` prevents hanging connections |

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
- Single function deploy: `firebase deploy --only functions:FUNCTION_NAME`
- Django admin: deploy via `gcloud builds submit` (see Django CLAUDE.md)

---

## Data Sources

### Source of Truth
- **Firestore** - Canonical member data (Ekklesia)
- **Cloud SQL** - Elections, events, RAG documents

### Django (Interim)
- Read-only admin interface
- No sync - Django reads from Cloud SQL
- Will be replaced by Ekklesia admin

---

## Related Issues
- **#323** - ✅ SendGrid email integration (implemented Dec 2025)
- **#324** - ✅ Email migration from Linode to GCP (completed Dec 2025)

---

## Documentation

| Doc | Purpose |
|-----|---------|
| [docs/README.md](docs/README.md) | Overview and quick links |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design |
| [docs/PATTERNS.md](docs/PATTERNS.md) | Code patterns, components |
| [docs/PATTERNS-KIMI-Felagar.md](docs/PATTERNS-KIMI-Felagar.md) | AI assistants (Kimi, member chat, RAG) |
| [docs/SECURITY.md](docs/SECURITY.md) | Security rules |
