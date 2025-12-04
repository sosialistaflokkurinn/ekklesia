# Ekklesia Project - AI Guidelines

## Project Overview

Ekklesia is a membership management system:
- **Frontend:** Firebase Hosting (`apps/members-portal/`)
- **Backend:** Cloud Run (elections, events, members services)
- **Database:** Cloud SQL PostgreSQL
- **Legacy:** Django on Linode (sync API)

---

## Critical Warnings

### Firebase Deploy Resets Secrets (Issue #276)

**NEVER run:** `firebase deploy --only functions`
- Resets Cloud Run secret config
- Has broken auth 6+ times (2 hours debugging each)
- DJANGO_API_TOKEN, KENNI_IS_CLIENT_SECRET get wiped

**SAFE deployment:**
```bash
cd services/svc-members
firebase deploy --only hosting  # Safe - doesn't affect secrets
```

### No Local Server

There is NO local development server workflow.
- **NEVER suggest:** `python3 -m http.server` or similar
- Changes are tested by deploying to Firebase Hosting

---

## Git Strategy: "Track All, Push Selectively"

All files tracked locally (AI can see them), but sensitive files blocked from push.

### How It Works
```
git commit → Files committed locally (AI can read)
git push   → Pre-push hook checks .git-local-only
           → Sensitive files? PUSH BLOCKED
           → Safe files? Push succeeds
```

### Critical Rules
- **NEVER** use `git push --no-verify` (bypasses security)
- If hook fails: INVESTIGATE → UNDERSTAND → FIX
- See `.git-local-only` for blocked patterns

### Local-Only Files (blocked from push)
- `docs/policy/**` - Meeting notes with personal info
- `*KENNITALA*.md`, `*DUPLICATE_SSN*.md` - PII files
- `.env`, `*.key.json`, `*client_secret*` - Credentials
- `services/svc-members/scripts/check-*.js` - Admin scripts
- `*.audit.json`, `scripts/logs/*.jsonl` - Audit logs

---

## Project Structure

```
ekklesia/
├── apps/members-portal/     # Frontend (Firebase Hosting)
│   ├── admin-elections/     # Election administration
│   ├── elections/           # Member voting
│   ├── events/              # Event management
│   ├── policy-session/      # Policy voting
│   └── members-area/        # Main dashboard
├── services/
│   ├── svc-elections/       # Elections backend (Cloud Run)
│   ├── svc-events/          # Events backend (Cloud Run)
│   └── svc-members/         # Members backend + Firebase config
├── scripts/                 # Automation scripts
├── docs/                    # Documentation
├── testing/                 # Integration tests
└── tmp/                     # Temporary files (use this, NOT /tmp/)
```

### Root Directory Rules
**ALLOWED:** .gitignore, package.json, firebase.json, README.md, CLAUDE.md
**FORBIDDEN:** Binaries, .log files, temp files, scattered docs

---

## Deployment

### Frontend
```bash
cd services/svc-members
firebase deploy --only hosting
```

### Backend Services
```bash
cd services/svc-elections && ./deploy.sh
cd services/svc-events && ./deploy.sh
```

### Verify Secrets After Deploy
```bash
gcloud run services describe SERVICE \
  --region=europe-west2 --project=ekklesia-prod-10-2025 \
  --format="json" | jq '.spec.template.spec.containers[0].env[] | select(.valueFrom.secretKeyRef != null)'
```

---

## Django Backend (Linode)

Legacy Django server handles member registration and sync API.

### Locations
- **Local mirror:** `/home/gudro/Development/projects/django/`
- **Linode path:** `/home/manager/socialism/membership/`
- **Connection:** `~/django-ssh.sh` (uses sshpass + GCP secret)

### Deployment Workflow
1. **Test locally:** `python3 -m py_compile membership/FILE.py`
2. **Show changes:** `git diff --stat HEAD~1`
3. **Sync files:** See `/home/gudro/Development/projects/django/CLAUDE.md`
4. **Restart:** `~/django-ssh.sh "systemctl restart gunicorn"`

### Important
- Do NOT sync entire git repo to Linode
- Do NOT upgrade Django/packages (runs Django 2.2/Python 3.6)
- Do NOT overwrite Linode settings.py

---

## Database Access

```bash
# Start Cloud SQL Proxy
cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:ekklesia-db --port 5433 --gcloud-auth

# Connect
psql -h localhost -p 5433 -U postgres -d ekklesia
```

---

## Frontend Best Practices

### Module Imports
- Check paths after refactoring
- Use relative paths consistently (./ or ../)
- Test in browser console: Check for 404s

### Async/Race Conditions
- Always await async functions
- Handle loading states (spinner, disable buttons)
- Prevent double submissions

### Null/Undefined Handling
- Check element exists: `if (!el) return;`
- Use optional chaining: `obj?.property`
- Provide fallbacks: `data || defaultValue`

---

## Testing Checklist

**BEFORE EVERY COMMIT:**

1. **Browser Console Check:**
   - DevTools → Console → Look for errors
   - Network tab → No 404s

2. **Happy Path:** Normal flow works

3. **Edge Cases:** Missing data, network errors, rapid clicks

---

## Adding New Pages

**3 Steps:**
1. HTML boilerplate (DOCTYPE, head, body.authenticated)
2. Navigation: `await initNavHeader(NAV_CONFIGS.area);`
3. Page script: `initAuthenticatedPage()` → Your logic

**Guide:** `docs/development/guides/ADDING_NEW_PAGES_GUIDE.md`

---

## Documentation

### Key Docs
- `docs/status/CURRENT_DEVELOPMENT_STATUS.md` - System state
- `docs/operations/CLOUD_RUN_SERVICES.md` - Backend services
- `docs/operations/OPERATIONAL_PROCEDURES.md` - Deployment procedures

### Update When
- After deployments → CURRENT_DEVELOPMENT_STATUS.md
- After infrastructure changes → CLOUD_RUN_SERVICES.md
- After new workflows → OPERATIONAL_PROCEDURES.md

### Language
- **English:** Architecture, technical guides, API docs, code comments, commits
- **Icelandic OK:** Internal meeting notes (docs/policy/), drafts (tmp/)

---

## VS Code Refactoring

When refactoring, prefer VS Code tools:
- **Moving files:** Right-click → Rename (auto-updates imports)
- **Renaming symbols:** F2 on symbol name
- **Extract function:** Select code → Ctrl+Shift+R

VS Code analyzes AST and handles relative paths correctly.

---

## Detailed Technical Reference

For detailed patterns (i18n, naming conventions, Cloud Run, CSS bundles):
- `.github/copilot-instructions.md` - Comprehensive technical guide (469 lines)
