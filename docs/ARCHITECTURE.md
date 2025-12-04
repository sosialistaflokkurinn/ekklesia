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

## System Diagram

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
                           ▼
                  ┌─────────────────┐
                  │   Cloud SQL     │
                  │  PostgreSQL 15  │
                  └─────────────────┘
                           │
                           │ sync
                           ▼
                  ┌─────────────────┐
                  │  Django/Linode  │
                  │   (Legacy)      │
                  └─────────────────┘
```

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
Django (Linode) ──webhook──▶ fn_sync_from_django.py ──▶ PostgreSQL
                                                              │
                                                        Firebase sync
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

| Secret | Used By |
|--------|---------|
| `DJANGO_API_TOKEN` | sync functions |
| `KENNI_IS_CLIENT_SECRET` | auth |
| `DB_PASSWORD` | all services |

```bash
# Read secret
gcloud secrets versions access latest --secret="DJANGO_API_TOKEN"

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
| Functions | Automatic on `firebase deploy` (but avoid `--only functions`) |
