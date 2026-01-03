# System Architecture

## Quick Reference

| Layer | Location | Tech | Deploy |
|-------|----------|------|--------|
| Frontend | `apps/members-portal/` | Static HTML/JS | `firebase deploy --only hosting` |
| Elections API | `services/svc-elections/` | Node.js/Express | `./deploy.sh` |
| Events + AI | `services/svc-events/` | Node.js + Kimi (2 assistants) | `./deploy.sh` |
| Members API | `services/svc-members/functions/` | Python/Firebase | Firebase Functions |
| Database | Cloud SQL | PostgreSQL 15 + pgvector | Managed |
| Auth | Firebase + Kenni.is | OAuth PKCE | Managed |

**Region:** `europe-west2` (London)

---

## Key Concepts

| Term | Definition |
|------|------------|
| **Firestore** | NoSQL document database - **source of truth** for member data |
| **Cloud SQL** | PostgreSQL database for elections/events (relational data) |
| **Kenni.is** | Icelandic electronic ID provider (OAuth PKCE authentication) |
| **Firebase Auth** | Manages user sessions after Kenni.is authentication |
| **pgvector** | PostgreSQL extension for vector similarity search (AI/RAG) |
| **RAG** | Retrieval-Augmented Generation - AI answers using indexed documents |
| **Kimi** | Moonshot AI LLM used for Party Wiki and Member Assistant |
| **Source of Truth** | Firestore is canonical for member data |
| **Django GCP** | Interim admin interface (Cloud Run) - will be replaced |
| **hnitnum** | Icelandic address registry ID from iceaddr |
| **Soft Delete** | Setting `deleted_at` timestamp instead of hard delete |

---

## Documentation Index

| Document | Purpose |
|----------|---------|
| [API_REFERENCE.md](API_REFERENCE.md) | All API endpoints in one place |
| [ADDRESS_SYSTEM.md](ADDRESS_SYSTEM.md) | Address handling, hnitnum, iceaddr |
| [PATTERNS.md](PATTERNS.md) | Code patterns and components |
| [PATTERNS-KIMI-Felagar.md](PATTERNS-KIMI-Felagar.md) | AI assistants (RAG, Kimi) |
| [SECURITY.md](SECURITY.md) | Security rules and PII guidelines |

---

## System Overview

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
| 2 | Cloud SQL PostgreSQL | Elections, events | Active |
| 3 | Django GCP (Cloud Run) | Admin interface | Interim |

**Related issues:** #323 (Amazon SES email - completed), #416 (Kimi RAG assistant)

### Member Data Model

Members exist in Firestore (source of truth). Some have `django_id` for legacy tracking.

The `updatememberprofile` function updates member data in Firestore.

**Note:** Django admin is read-only. No sync between systems.

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
│   │   ├── route-elections.js
│   │   ├── route-candidates.js
│   │   └── route-nomination.js
│   │
│   ├── middleware/
│   │   ├── middleware-member-auth.js
│   │   ├── middleware-rbac-auth.js
│   │   ├── middleware-s2s-auth.js
│   │   └── middleware-rate-limiter.js
│   │
│   └── services/
│       └── service-audit.js
│
├── migrations/
├── tests/
└── deploy.sh
```

### services/svc-events/ (Node.js + AI)

```
svc-events/
├── src/
│   ├── routes/
│   │   ├── route-events.js
│   │   ├── route-party-wiki.js         # Static knowledge chat
│   │   └── route-member-assistant.js   # RAG AI chat endpoint
│   │
│   ├── services/
│   │   ├── service-embedding.js        # Vertex AI embeddings
│   │   └── service-vector-search.js    # pgvector search
│   │
│   └── config/
│       └── config-database.js
│
├── scripts/
│   ├── verify-kimi-answers.js          # RAG verification tests
│   └── index-*.js                      # Document indexing
│
├── migrations/
└── deploy.sh
```

### services/svc-members/functions/ (Python)

```
functions/
├── auth/                     # Auth handlers
├── membership/               # Membership handlers
├── shared/                   # Shared utilities
│
├── fn_audit_members.py       # Audit logging
├── fn_validate_address.py    # Address validation
├── fn_search_addresses.py    # Address search
├── fn_superuser.py           # Superuser operations
│
├── security_utils.py         # Rate limiting, validation
├── utils_logging.py          # Structured logging
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

### Data Storage
```
┌─────────────────┐          ┌─────────────────┐
│   Firestore     │          │   PostgreSQL    │
│ (member data)   │          │ (elections/RAG) │
│ SOURCE OF TRUTH │          │   Cloud SQL     │
└─────────────────┘          └─────────────────┘

Django GCP: Read-only admin (interim) - reads from PostgreSQL
```

### AI Assistants (Kimi)

**Two assistants with different architectures:**

| | Party Wiki 📚 | Member Assistant ? |
|---|---|---|
| Route | `route-party-wiki.js` | `route-member-assistant.js` |
| Frontend | `party-wiki-chat.js` | `member-assistant-chat.js` |
| Tech | Static system prompt | RAG + pgvector |
| Knowledge | Hardcoded facts | Dynamic document retrieval |
| Use case | Quick facts | Deep research with citations |

**Member Assistant (RAG) Flow:**
```
User Question → Vertex AI Embedding → pgvector Search → Context Assembly → Kimi LLM → Response
                                           │
                                    ┌──────┴──────┐
                                    │ rag_documents│
                                    │ (pgvector)   │
                                    └─────────────┘
```

**RAG Sources indexed:**
- party-website (xj.is)
- kosningaprof-2024 (RÚV)
- discourse-archive

---

## API Examples

### Get Elections (svc-elections)
```bash
# Get all elections
curl -H "Authorization: Bearer $ID_TOKEN" \
  https://svc-elections-....run.app/api/elections

# Response
{
  "elections": [
    {"id": 1, "title": "Stjórnarkjör 2025", "status": "active", ...}
  ]
}
```

### Cast Vote (svc-elections)
```bash
curl -X POST \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"election_id": 1, "candidate_ids": [5, 3, 8]}' \
  https://svc-elections-....run.app/api/vote
```

### AI Chat (svc-events)
```bash
# Party Wiki (static knowledge)
curl -X POST \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hver er formanni flokksins?"}' \
  https://svc-events-....run.app/api/party-wiki/chat

# Member Assistant (RAG)
curl -X POST \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hvað segir stefnuskrá um húsnæðismál?"}' \
  https://svc-events-....run.app/api/member-assistant/chat
```

### Update Member Profile (Firebase Function)
```bash
curl -X POST \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "new@example.com", "phone": "555-1234"}' \
  https://europe-west2-ekklesia-prod-10-2025.cloudfunctions.net/updatememberprofile
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

### Environment Variables by Service

#### svc-elections (Cloud Run)
| Env Var | Secret Name | Purpose |
|---------|-------------|---------|
| `DB_HOST` | - | `/cloudsql/ekklesia-prod-10-2025:europe-west2:ekklesia-db` |
| `DB_NAME` | - | `socialism` |
| `DB_USER` | - | `socialism` |
| `DB_PASSWORD` | `django-socialism-db-password` | PostgreSQL password |

#### svc-events (Cloud Run)
| Env Var | Secret Name | Purpose |
|---------|-------------|---------|
| `DB_*` | (same as elections) | Database connection |
| `KIMI_API_KEY` | `kimi-api-key` | Moonshot AI API |
| `VERTEX_PROJECT` | - | GCP project for embeddings |

#### svc-members (Firebase Functions)
| Env Var | Secret Name | Purpose |
|---------|-------------|---------|
| `django-api-token` | `django-api-token` | Django API auth |
| `django-socialism-db-password` | `django-socialism-db-password` | PostgreSQL |
| `sendgrid-api-key` | `sendgrid-api-key` | Email sending |

### Secrets Management

```bash
# Read secret
gcloud secrets versions access latest --secret="django-api-token"

# Verify Cloud Run service secrets
gcloud run services describe svc-elections \
  --region=europe-west2 \
  --format="json" | jq '.spec.template.spec.containers[0].env'

# List all secrets
gcloud secrets list --project=ekklesia-prod-10-2025
```

**Naming Convention:**
- Secret Manager: lowercase with hyphens (`django-api-token`)
- Firebase Functions: match secret name (lowercase)
- Cloud Run: uppercase (`DB_PASSWORD`) mapped from secret

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

Members exist in Firestore (source of truth). Cloud SQL only has election-related data.
Django admin is read-only and interim.
