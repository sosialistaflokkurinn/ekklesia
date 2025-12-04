# Ekklesia Documentation

## Quick Links

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, components, data flow |
| [PATTERNS.md](PATTERNS.md) | Code patterns, reusable components, best practices |
| [SECURITY.md](SECURITY.md) | Security rules, secrets management |

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
│   ├── svc-events/               # Events service (Node.js)
│   └── svc-members/              # Members service (Firebase)
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
- `js/components/` for UI components
- `js/utils/` for utility functions
- `js/api/` for API clients

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

### Rebuild CSS Bundle
```bash
./scripts/build-css-bundle.sh
```

### Database Access
```bash
cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:ekklesia-db --port 5433 --gcloud-auth
psql -h localhost -p 5433 -U postgres -d ekklesia
```

---

## Critical Rules

| Never | Always |
|-------|--------|
| `firebase deploy --only functions` | `firebase deploy --only hosting` |
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
