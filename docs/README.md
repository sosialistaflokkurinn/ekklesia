# Ekklesia Documentation

## Quick Links

### Core Documentation
| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, data flow, troubleshooting |
| [PATTERNS.md](PATTERNS.md) | Code patterns, reusable components, best practices |
| [PATTERNS-GCP.md](PATTERNS-GCP.md) | GCP/Firebase queries, Cloud SQL, Firestore |
| [SECURITY.md](SECURITY.md) | Security rules, secrets management |
| [API_REFERENCE.md](API_REFERENCE.md) | All API endpoints |

### Systems & Features
| Document | Purpose |
|----------|---------|
| [AI-ASSISTANTS.md](AI-ASSISTANTS.md) | Gemini/Kimi AI assistants, RAG, vector search |
| [ELECTIONS.md](ELECTIONS.md) | Elections and nomination committee |
| [ADDRESSES.md](ADDRESSES.md) | Address system, hnitnum, iceaddr |
| [REGISTRATION.md](REGISTRATION.md) | Member registration flow |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Deployment procedures |
| [AUTHENTICATION.md](AUTHENTICATION.md) | OAuth troubleshooting, MFA |
| [EMAIL-TEMPLATES-GUIDE.md](EMAIL-TEMPLATES-GUIDE.md) | Email template guide |

---

## Project Structure

```
ekklesia/
├── apps/members-portal/          # Frontend (Firebase Hosting)
│   ├── js/
│   │   ├── components/           # Reusable components
│   │   ├── api/                  # API clients
│   │   ├── utils/                # Utility functions
│   │   └── core/                 # Core functionality
│   ├── styles/                   # CSS (bundle.css)
│   ├── i18n/                     # Translations
│   └── [feature]/                # Feature pages (admin, elections, etc.)
│
├── services/                     # Backend (Cloud Run)
│   ├── svc-elections/            # Elections service (Node.js)
│   ├── svc-events/               # Events + RAG AI assistant (Node.js)
│   └── svc-members/              # Members service (Firebase Functions)
│
├── scripts/                      # Automation
│   ├── database/                 # DB scripts
│   ├── deployment/               # Deploy scripts
│   ├── maintenance/              # Maintenance
│   └── utils/                    # Utilities
│
└── docs/                         # This documentation
```

---

## Key Principles

### 1. Reuse Before Create
Search existing code before writing new:
- `js/components/` for UI (ui-modal, ui-toast, member-assistant-chat, party-wiki-chat)
- `js/utils/` for utilities (util-format, util-debounce, util-error-handler)
- `js/api/` for API clients (api-elections, api-members, api-heatmap)

### 2. Consistency Over Cleverness
- Follow existing patterns
- Match naming conventions
- Use same error handling approach

### 3. Simple Over Complex
- Minimum code for the task
- No premature abstractions
- No over-engineering

---

## Common Tasks

### Deploy Frontend
```bash
cd services/svc-members
firebase deploy --only hosting
```

### Deploy Backend
```bash
cd services/svc-elections && ./deploy.sh
cd services/svc-events && ./deploy.sh
```

### Deploy Cloud Function (single)
```bash
cd services/svc-members
firebase deploy --only functions:FUNCTION_NAME
```

### Rebuild CSS Bundle
```bash
./scripts/build-css-bundle.sh
```

### Database Access
```bash
cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:ekklesia-db --port 5433 --gcloud-auth
psql -h localhost -p 5433 -U postgres -d ekklesia
```

### Check Function Logs
```bash
gcloud functions logs read FUNCTION_NAME --region=europe-west2 --limit=50
```

---

## Critical Rules

| Never | Always |
|-------|--------|
| `firebase deploy --only functions` (all) | `firebase deploy --only functions:NAME` |
| Hardcode Icelandic text | Use i18n system |
| Commit `.env` files | Use GCP Secret Manager |
| `git push --no-verify` | Let hooks run |
| Create duplicate code | Reuse existing components |

---

## Service-Specific Docs

Each service has its own README:
- `services/svc-elections/README.md`
- `services/svc-events/README.md`
- `services/svc-members/README.md`
