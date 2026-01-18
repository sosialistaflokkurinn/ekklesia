# Quick Reference

All quick-reference tables in one place for AI assistants and developers.

**Last Updated:** 2026-01-16

---

## Service Map

| Service | Location | Deploy | Runtime |
|---------|----------|--------|---------|
| Frontend | `apps/members-portal/` | Firebase Hosting | Static |
| Cloud Functions | `services/svc-members/functions/` | `firebase deploy --only functions:NAME` | Python 3.11 |
| Elections | `services/svc-elections/` | `./deploy.sh` | Node.js (Cloud Run) |
| Events | `services/svc-events/` | `./deploy.sh` | Node.js (Cloud Run) |
| Django Admin | `~/Development/projects/django/` | `gcloud builds submit` | Python (Cloud Run) |

---

## Deploy Commands

```bash
# Frontend (HTML/JS/CSS)
cd ~/Development/projects/ekklesia/services/svc-members && firebase deploy --only hosting

# Single Cloud Function (PREFERRED)
cd ~/Development/projects/ekklesia/services/svc-members && firebase deploy --only functions:FUNCTION_NAME

# Elections service
cd ~/Development/projects/ekklesia/services/svc-elections && ./deploy.sh

# Events service
cd ~/Development/projects/ekklesia/services/svc-events && ./deploy.sh
```

---

## Database Access

```bash
# Start Cloud SQL proxy (ALWAYS use --gcloud-auth)
cloud-sql-proxy ekklesia-prod-10-2025:europe-west1:ekklesia-db-eu1 --port 5433 --gcloud-auth

# Connect to PostgreSQL
PGPASSWORD='Socialism2025#Db' psql -h localhost -p 5433 -U socialism -d socialism
```

---

## Live URLs

| Environment | URL |
|-------------|-----|
| **Production** | https://felagar.sosialistaflokkurinn.is/ |
| Hitakort | https://felagar.sosialistaflokkurinn.is/members-area/heatmap.html |
| Firebase (backup) | https://ekklesia-prod-10-2025.web.app |

---

## Firestore Collections

| Collection | Purpose | Key Fields |
|------------|---------|------------|
| `members` | Member profiles | `uid`, `kennitala`, `name`, `email`, `django_id` |
| `cells` | Local chapters | `name`, `postal_codes[]`, `region` |
| `audit_log` | Activity tracking | `action`, `uid`, `timestamp` |

---

## Cloud SQL Tables

| Table | Purpose |
|-------|---------|
| `elections` | Election definitions |
| `ballots` | Cast votes (encrypted) |
| `candidates` | Election candidates |
| `events` | Event definitions |
| `external_events` | Scraped external events |
| `rag_documents` | AI assistant knowledge base (pgvector) |

---

## GCP Secrets

| Secret | Purpose |
|--------|---------|
| `django-api-token` | Django API authentication |
| `django-socialism-db-password` | Cloud SQL password |
| `kenni-client-secret` | Kenni.is OAuth |
| `GEMINI_API_KEY` | Gemini AI |
| `kimi-api-key` | Moonshot AI (Party Wiki) |
| `brave-search-api-key` | Web search fallback |
| `sendgrid-api-key` | Email sending |

**Access secret:**
```bash
gcloud secrets versions access latest --secret=SECRET_NAME
```

---

## Project Structure

```
ekklesia/
├── apps/members-portal/     # Frontend (Firebase Hosting)
│   ├── js/components/       # Reusable UI components
│   ├── js/utils/            # Utility functions
│   ├── js/api/              # API clients
│   ├── styles/              # CSS (bundle)
│   └── i18n/                # Translations (XML)
├── services/
│   ├── svc-members/         # Firebase Functions (Python)
│   │   └── functions/       # Function implementations
│   ├── svc-elections/       # Cloud Run (Node.js)
│   └── svc-events/          # Cloud Run (Node.js)
├── scripts/                 # Automation, maintenance
├── docs/                    # Documentation
└── git-hooks/               # Pre-commit checks
```

---

## Documentation Map

| Topic | Document |
|-------|----------|
| Project overview | `CLAUDE.md` |
| Architecture | `docs/ARCHITECTURE.md` |
| Rules (consolidated) | `docs/CRITICAL-RULES.md` |
| Security patterns | `docs/SECURITY.md` |
| Deployment | `docs/DEPLOYMENT.md` |
| Code patterns | `docs/PATTERNS.md` |
| GCP patterns | `docs/PATTERNS-GCP.md` |
| Elections | `docs/ELECTIONS.md` |
| Authentication | `docs/AUTHENTICATION.md` |
| Email templates | `docs/EMAIL-TEMPLATES-GUIDE.md` |
| Addresses | `docs/ADDRESSES.md` |
| AI assistants | `docs/AI-ASSISTANTS.md` |
| API reference | `docs/API_REFERENCE.md` |
| Registration | `docs/REGISTRATION.md` |

---

## Common Commands

```bash
# GCP Authentication
gcloud auth application-default login
gcloud config set project ekklesia-prod-10-2025

# CSS rebuild (required after style changes)
./scripts/build-css-bundle.sh

# CSS version check (auto-runs on deploy)
./scripts/check-css-versions.sh

# View function logs
gcloud functions logs read FUNCTION_NAME --region=europe-west2 --limit=50

# View Cloud Run logs
gcloud run services logs read SERVICE_NAME --region europe-west1 --limit 50
```

---

## GCP Regions

| Service | Region |
|---------|--------|
| Cloud Functions | europe-west2 (London) |
| Cloud Run | europe-west1 (Belgium), europe-west2 (London) |
| Cloud SQL | europe-west1 (Belgium) |
| Firebase Hosting | Global CDN |
| Firestore | europe-west1 |
