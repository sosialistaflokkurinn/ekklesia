# System Architecture

## Quick Reference

| Layer | Location | Tech | Deploy |
|-------|----------|------|--------|
| Frontend | `apps/members-portal/` | Static HTML/JS | `firebase deploy --only hosting` |
| Elections API | `services/svc-elections/` | Node.js/Express | `./deploy.sh` |
| Events API | `services/svc-events/` | Node.js/Express | `./deploy.sh` |
| Members API | `services/svc-members/functions/` | Python/Firebase | Firebase Functions |
| Database | Cloud SQL | PostgreSQL 15 | Managed |
| Auth | Firebase + Kenni.is | OAuth PKCE | Managed |

**Region:** `europe-west2` (London)

---

## System Overview

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
│                                                              │
│  Linode (LEGACY - being retired)                            │
│  ├── Django 2.2.3 / Python 3.6                              │
│  └── Will be decommissioned after DNS migration             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

```
                              ┌─────────────┐
                              │    Users    │
                              └──────┬──────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
            ┌───────────┐    ┌───────────┐    ┌───────────┐
            │  Kenni.is │    │  Firebase │    │  Firebase │
            │   OAuth   │───▶│   Auth    │    │  Hosting  │
            └───────────┘    └─────┬─────┘    └─────┬─────┘
                                   │                │
                              ID Token         Static Files
                                   │                │
                    ┌──────────────┴────────────────┘
                    │
                    ▼
         ┌─────────────────────────────────────────────┐
         │              Cloud Run Services              │
         │                                              │
         │  ┌─────────────┐  ┌─────────────┐          │
         │  │svc-elections│  │ svc-events  │          │
         │  │  (Node.js)  │  │  (Node.js)  │          │
         │  └──────┬──────┘  └──────┬──────┘          │
         │         │                │                  │
         │  ┌──────┴────────────────┴──────┐          │
         │  │      svc-members (Python)     │          │
         │  │      Firebase Functions       │          │
         │  └──────────────┬───────────────┘          │
         └─────────────────┼───────────────────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
     ┌─────────────┐ ┌──────────┐ ┌─────────────┐
     │  Firestore  │ │Cloud SQL │ │   Django    │
     │  (SOURCE OF │ │PostgreSQL│ │   (GCP)     │
     │   TRUTH)    │ │          │ │  (INTERIM)  │
     └─────────────┘ └──────────┘ └─────────────┘
```

## Data Sources (Priority Order)

| Priority | Source | Purpose | Status |
|----------|--------|---------|--------|
| 1 | **Firestore** | Canonical member data | Active |
| 2 | Cloud SQL PostgreSQL | Elections, events, legacy sync | Active |
| 3 | Django GCP (Cloud Run) | Admin interface | Interim |
| 4 | Django Linode | Legacy admin | Being retired |

**Related issues:** #323 (Postmark email), #324 (Email migration)

### Member Data Model

Members can exist in two states:
1. **Firestore + Django**: Members registered via Django have `django_id` in Firestore
2. **Firestore-only**: Members registered via Ekklesia portal have no `django_id`

The `updatememberprofile` function handles both cases:
- With `django_id`: Updates sync to both Firestore and Django/Cloud SQL
- Without `django_id`: Updates only in Firestore (Firestore-only members)

**Note:** Some members may have a `django_id` in Firestore but not exist in Cloud SQL (sync gap). The function handles this gracefully by continuing with Firestore-only updates.

---

## Frontend Structure

### apps/members-portal/

```
apps/members-portal/
├── js/
│   ├── components/           # REUSABLE - check here first
│   │   ├── ui-modal.js
│   │   ├── ui-toast.js
│   │   ├── ui-loading.js
│   │   ├── ui-button.js
│   │   ├── ui-card.js
│   │   ├── ui-badge.js
│   │   ├── ui-searchable-select.js
│   │   ├── election-*.js     # Election components
│   │   ├── policy-*.js       # Policy components
│   │   └── member-*.js       # Member components
│   │
│   ├── api/                  # API clients
│   │   ├── api-elections.js
│   │   └── api-members.js
│   │
│   ├── utils/                # Utilities
│   │   ├── util-format.js
│   │   ├── util-dom.js
│   │   ├── util-debounce.js
│   │   └── util-error-handler.js
│   │
│   └── core/
│       └── api.js            # Base API
│
├── styles/
│   ├── bundle.css            # ← Rebuild: ./scripts/build-css-bundle.sh
│   └── global.css
│
├── i18n/
│   ├── strings-loader.js     # R.string access
│   └── values-is/            # Icelandic strings
│
├── firebase/
│   └── app.js                # ← Always import Firebase from here
│
└── [features]/
    ├── admin/
    ├── admin-elections/
    ├── elections/
    ├── events/
    ├── members-area/
    ├── policy-session/
    └── superuser/
```

---

## Backend Structure

### services/svc-elections/ (Node.js)

```
svc-elections/
├── src/
│   ├── routes/
│   │   ├── route-admin.js
│   │   └── route-elections.js
│   │
│   ├── middleware/
│   │   ├── middleware-member-auth.js
│   │   ├── middleware-rbac-auth.js
│   │   ├── middleware-s2s-auth.js
│   │   ├── middleware-rate-limiter.js
│   │   ├── middleware-app-check.js
│   │   └── middleware-correlation-id.js
│   │
│   ├── services/
│   │   └── service-audit.js
│   │
│   └── config/
│
├── migrations/
├── tests/
└── deploy.sh
```

### services/svc-members/functions/ (Python)

```
functions/
├── auth/                     # Auth handlers
├── membership/               # Membership handlers
├── shared/                   # Shared utilities
│
├── fn_sync_members.py        # Manual sync
├── fn_sync_from_django.py    # Webhook sync
├── fn_get_django_token.py    # Token retrieval
├── fn_audit_members.py       # Audit logging
├── fn_validate_address.py    # Address validation
├── fn_search_addresses.py    # Address search
├── fn_superuser.py           # Superuser operations
│
├── util_security.py          # Security utilities
├── util_logging.py           # Logging utilities
├── util_jwks.py              # JWT utilities
│
└── main.py                   # Entry point
```

---

## Data Flows

### Authentication
```
User → Kenni.is (PKCE) → Firebase Auth → ID Token → API Request
                                                          │
                                              middleware-member-auth.js
                                                          │
                                                    Verified User
```

### Voting
```
1. User requests voting token
   └─▶ svc-events → Verify eligibility → Issue token

2. User casts vote
   └─▶ svc-elections → Validate token → Record ballot → PostgreSQL
```

### Member Sync
```
                    ┌─────────────────┐
                    │   Firestore     │ ◄── SOURCE OF TRUTH
                    │ (canonical data)│
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
     ┌─────────────────┐          ┌─────────────────┐
     │  Django GCP     │          │  PostgreSQL     │
     │  (admin UI)     │          │  (elections)    │
     └─────────────────┘          └─────────────────┘
              │
              │ (legacy sync - being phased out)
              ▼
     ┌─────────────────┐
     │  Django Linode  │
     │  (RETIRING)     │
     └─────────────────┘
```

---

## Infrastructure

### Database Access

```bash
# Start proxy
cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:ekklesia-db \
  --port 5433 --gcloud-auth

# Connect
psql -h localhost -p 5433 -U postgres -d ekklesia
```

### Secrets (GCP Secret Manager)

| Secret Name (GCP) | Env Var (App) | Used By |
|-------------------|---------------|---------|
| `django-api-token` | `django-api-token` / `DJANGO_API_TOKEN` | sync functions |
| `kenni-client-secret` | `KENNI_IS_CLIENT_SECRET` | auth |
| `django-socialism-db-password` | `DB_PASSWORD` | all services |

**Note on Naming:**
- **Secret Name:** The name in Secret Manager (usually lowercase with hyphens).
- **Env Var:** The environment variable injected into the container.
- **Best Practice:** Match the secret name (lowercase) for Firebase Functions, use uppercase for legacy/Docker services.

```bash
# Read secret
gcloud secrets versions access latest --secret="django-api-token"

# Verify service secrets
gcloud run services describe svc-elections \
  --region=europe-west2 \
  --format="json" | jq '.spec.template.spec.containers[0].env'
```

---

## Deployment

| What | Command |
|------|---------|
| Frontend | `cd services/svc-members && firebase deploy --only hosting` |
| Elections | `cd services/svc-elections && ./deploy.sh` |
| Events | `cd services/svc-events && ./deploy.sh` |
| Functions | `firebase deploy --only functions:FUNCTION_NAME` (specify function!) |
| Django | `cd ~/Development/projects/django && gcloud builds submit --config cloudbuild.yaml` |

---

## Troubleshooting

### Django Admin 500 Errors

If Django admin returns 500 errors, check the user preferences table:

```bash
# Connect to Cloud SQL
PGPASSWORD='...' psql -h localhost -p 5433 -U postgres -d ekklesia

# Check preferences
SELECT * FROM preferences_adminpreference;

# Common fix: Invalid sort_field
UPDATE preferences_adminpreference
SET sort_field = '-date_joined'
WHERE sort_field NOT LIKE '%date%' AND sort_field NOT LIKE '%name%';
```

**Root cause:** The `PreferencesMixin` in Django admin uses `sort_field` from user preferences. Invalid values (e.g., `'3'`) cause `FieldError: Cannot resolve keyword`.

### Cloud Function Errors

Check function logs:
```bash
gcloud functions logs read updatememberprofile --region=europe-west2 --limit=50
```

### Member Sync Issues

Compare members between Firestore and Cloud SQL:
```bash
# Firestore: Query via REST API or Firebase Console
# Cloud SQL:
SELECT id, first_name, last_name, kennitala
FROM membership_comrade
ORDER BY id DESC
LIMIT 10;
```

Members may exist in Firestore but not Cloud SQL if:
- Registered via Ekklesia portal (Firestore-only)
- Sync failed during Django registration
- Member deleted from Django but not Firestore
