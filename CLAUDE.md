# Ekklesia - AI Assistant Guide

## Quick Reference

| What | Where |
|------|-------|
| Frontend | `apps/members-portal/` → Firebase Hosting |
| Cloud Functions | `services/svc-members/functions/` → Firebase Functions |
| Elections/Events | `services/svc-elections/`, `svc-events/` → Cloud Run |
| Database | Cloud SQL PostgreSQL (europe-west2) |
| Django | `services/svc-members/django-backend/` → Linode |
| Deploy frontend | `cd services/svc-members && firebase deploy --only hosting` |
| Deploy function | `cd services/svc-members && firebase deploy --only functions:NAME` |
| Deploy Cloud Run | `cd services/svc-elections && ./deploy.sh` |

**Detailed docs:** [docs/README.md](docs/README.md)

---

## Critical Rules

### Never
```
firebase deploy --only functions     # Wipes secrets
python3 -m http.server               # No local server
git push --no-verify                 # Bypasses hooks
Hardcode Icelandic text              # Use i18n
Commit .env or credentials           # Use Secret Manager
Create duplicate code                # Reuse existing
```

### Always
```
Search existing code first           # js/components/, js/utils/
Follow naming conventions            # See docs/PATTERNS.md
Run ./scripts/build-css-bundle.sh    # After CSS changes
Verify secrets after deploy          # gcloud run services describe
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
├── apps/members-portal/     # Frontend
│   ├── js/components/       # Reusable UI components
│   ├── js/utils/            # Utility functions
│   ├── js/api/              # API clients
│   ├── styles/              # CSS (bundle)
│   └── i18n/                # Translations
├── services/svc-*/          # Backend services
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
```

**Important deploy notes:**
- `svc-members` uses Firebase Functions (Python) - deploy via `firebase deploy`
- `svc-elections` and `svc-events` use Cloud Run - deploy via `./deploy.sh`
- Never use `firebase deploy --only functions` without specifying function name (slow + risky)
- Single function deploy: `firebase deploy --only functions:sync_from_django`
- Django backend (Linode): push to GitHub triggers CI/CD, or SSH manually

---

## Documentation

| Doc | Purpose |
|-----|---------|
| [docs/README.md](docs/README.md) | Overview and quick links |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design |
| [docs/PATTERNS.md](docs/PATTERNS.md) | Code patterns, components |
| [docs/SECURITY.md](docs/SECURITY.md) | Security rules |
