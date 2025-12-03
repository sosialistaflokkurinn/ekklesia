# Naming Conventions

**Created**: 2025-12-03  
**Status**: Active  
**Enforced by**: AI assistants, pre-commit hooks, analyze-naming.py

---

## Overview

This document defines the naming conventions for all files, folders, and code elements in the Ekklesia project. Following these conventions ensures:

1. **Self-documenting code** - Names reveal purpose and type
2. **Easy navigation** - Predictable structure reduces cognitive load
3. **AI-friendly patterns** - Clear conventions that assistants can learn and enforce
4. **Reduced conflicts** - Unique names prevent namespace collisions

---

## File Naming Conventions

### JavaScript Files (Frontend)

| Pattern | Purpose | Examples |
|---------|---------|----------|
| `ui-*.js` | Shared UI components | `ui-button.js`, `ui-modal.js`, `ui-toast.js` |
| `*-page.js` | Page controllers | `dashboard-page.js`, `elections-page.js` |
| `api-*.js` | API client modules | `api-elections.js`, `api-members.js` |
| `util-*.js` | Utility functions | `util-format.js`, `util-dom.js` |
| `*-loader.js` | Data/resource loaders | `strings-loader.js`, `config-loader.js` |

**Feature-specific components** use domain prefix:
| Pattern | Purpose | Examples |
|---------|---------|----------|
| `election-*.js` | Election features | `election-vote-form.js`, `election-countdown.js` |
| `policy-*.js` | Policy session features | `policy-amendment-form.js`, `policy-item-card.js` |
| `member-*.js` | Member features | `member-address-autocomplete.js` |
| `admin-*.js` | Admin features | `admin-user-table.js` |

### JavaScript Files (Backend - Cloud Functions)

| Pattern | Purpose | Examples |
|---------|---------|----------|
| `*-service.js` | Business logic services | `ballot-service.js`, `token-service.js` |
| `*-handler.js` | HTTP request handlers | `vote-handler.js`, `auth-handler.js` |
| `*-repository.js` | Database access layer | `member-repository.js` |
| `*-client.js` | External API clients | `django-client.js` |

### Python Files (Cloud Functions)

| Pattern | Purpose | Examples |
|---------|---------|----------|
| `fn_*.py` | Firebase function definitions | `fn_sync_members.py`, `fn_verify.py` |
| `handler_*.py` | Request handlers | `handler_auth.py`, `handler_webhook.py` |
| `util_*.py` | Utility modules | `util_firebase.py`, `util_validation.py` |
| `client_*.py` | External API clients | `client_django.py` |

### Other File Types

| Pattern | Purpose | Examples |
|---------|---------|----------|
| `*-strings.xml` | i18n string files | `portal-strings.xml`, `admin-strings.xml` |
| `*.config.js` | Configuration files | `firebase.config.js` |
| `*.test.js` | Test files | `ballot-service.test.js` |
| `YYYY-MM-DD-*.md` | Date-prefixed docs | `2025-12-03-auth-bug.md` |

---

## Folder Naming Conventions

### Frontend Structure (`apps/members-portal/`)

```
apps/members-portal/
├── js/
│   ├── components/       # Shared UI components (ui-*.js)
│   ├── api/              # Consolidated API clients (api-*.js)
│   ├── utils/            # Utility functions (util-*.js)
│   └── loaders/          # Resource loaders (*-loader.js)
├── styles/               # CSS files
├── i18n/                 # Internationalization strings
├── firebase/             # Firebase wrapper modules
│
├── elections/            # Elections feature area
│   ├── js/               # Feature-specific JS
│   ├── i18n/             # Feature-specific strings
│   └── index.html        # Feature entry point
│
├── policy-session/       # Policy voting feature
├── events/               # Events feature
├── admin/                # Admin portal
├── admin-elections/      # Election admin feature
├── superuser/            # Superuser portal
└── members-area/         # Member dashboard
```

### Backend Structure (`services/`)

```
services/
├── svc-elections/          # Elections backend service (Cloud Run)
│   ├── src/
│   │   ├── routes/         # HTTP routes (route-*.js)
│   │   │   ├── route-admin.js
│   │   │   └── route-elections.js
│   │   ├── middleware/     # Express middleware (middleware-*.js)
│   │   │   ├── middleware-auth.js
│   │   │   ├── middleware-rate-limiter.js
│   │   │   └── middleware-rbac-auth.js
│   │   ├── services/       # Business logic (service-*.js)
│   │   │   └── service-audit.js
│   │   ├── config/         # Configuration (config-*.js)
│   │   │   └── config-database.js
│   │   ├── utils/          # Utilities (util-*.js)
│   │   │   └── util-logger.js
│   │   └── index.js
│   ├── package.json
│   └── deploy.sh
│
├── svc-events/             # Events backend service (Cloud Run)
│   └── ... (same structure)
│
└── svc-members/            # Members service (Firebase)
    ├── functions/          # Cloud Functions (Python)
    │   ├── fn_sync_members.py
    │   ├── fn_validate_address.py
    │   ├── util_security.py
    │   └── main.py
    └── firebase.json
```

### Backend JavaScript File Naming (Cloud Run)

| Directory | Pattern | Examples |
|-----------|---------|----------|
| `src/routes/` | `route-*.js` | `route-admin.js`, `route-elections.js` |
| `src/middleware/` | `middleware-*.js` | `middleware-auth.js`, `middleware-rate-limiter.js` |
| `src/services/` | `service-*.js` | `service-audit.js`, `service-token.js` |
| `src/config/` | `config-*.js` | `config-database.js`, `config-firebase.js` |
| `src/utils/` | `util-*.js` | `util-logger.js`, `util-hash-uid.js` |

### Documentation Structure (`docs/`)

Folders are organized by category with clear purposes:

| Folder | Purpose | Example Files |
|--------|---------|---------------|
| `standards/` | Code standards, conventions | `NAMING_CONVENTIONS.md`, `I18N_ENFORCEMENT.md` |
| `architecture/` | System design docs | `DATA_FLOW.md`, `COMPONENT_HIERARCHY.md` |
| `infrastructure/` | Cloud setup, configs | `CLOUD_RUN_SERVICES.md` |
| `operations/` | Deployment, runbooks | `OPERATIONAL_PROCEDURES.md` |
| `features/` | Feature specifications | `ELECTIONS_FEATURE.md` |
| `bugfixes/` | Bug reports (date-prefixed) | `2025-12-03-auth-issue.md` |
| `testing/` | Test documentation | `TEST_STRATEGY.md` |

### Archive Folder Naming

**Standard term: `archive/`** (NOT `historical/`)

Root-level archive folders use the `archive-*` prefix to clearly indicate their purpose:

| Pattern | Purpose | Git Status |
|---------|---------|------------|
| `archive-code/` | Deprecated code, old features | Local-only |
| `archive-i18n/` | Archived i18n strings (unused) | Local-only |
| `docs/archive/` | Historical documentation | Local-only |

**Subdirectory archives** use `archive/` subfolder:

| Correct ✅ | Wrong ❌ |
|-----------|---------|
| `docs/security/archive/` | `docs/security/historical/` |
| `docs/status/archive/` | `docs/status/historical/` |
| `docs/audits/archive/` | `docs/audits/historical/` |
| `docs/testing/archive/` | `docs/testing/history/` |

**Structure:**
```
archive-code/                 # Deprecated code (local-only)
├── 2025-11-deprecated-nav/
├── 2025-11-epic24-admin-lifecycle/
└── election-feature/

archive-i18n/                 # Archived i18n strings (local-only)
└── unused-strings/
    └── *.xml

docs/archive/                 # Main historical documentation (local-only)
├── audits/2025-11/
├── bugfixes/2025-11/
├── incidents/2025-10/
├── reports/2025-11/
├── design/
├── development/
└── infrastructure/

docs/security/archive/        # Security-specific archives (in-place)
├── 2025-10-16/
└── README.md
```

**Rationale:**
- `archive-*` prefix follows the same pattern as `svc-*` for services
- Clear distinction between code, i18n, and documentation archives
- `docs/archive/` stays under `docs/` as it's documentation
- Consistent use of `archive/` term (not `historical/`) across all locations
- Subdirectory archives stay in-place for context (e.g., `docs/security/archive/`)

**Enforcement:**
- Run `scripts/maintenance/find-archive-inconsistencies.sh` to detect violations
- Pre-push hook blocks `*/historical/` patterns from remote

---

## Code Style Conventions

### Case Conventions

| Element | Convention | Example |
|---------|------------|---------|
| File names | kebab-case | `ui-button.js`, `api-elections.js` |
| Folder names | kebab-case | `policy-session/`, `admin-elections/` |
| JS variables | camelCase | `memberCount`, `isActive` |
| JS functions | camelCase | `getMemberById()`, `validateInput()` |
| JS classes | PascalCase | `MemberService`, `ElectionRepository` |
| JS constants | SCREAMING_SNAKE_CASE | `MAX_RETRIES`, `API_BASE_URL` |
| Python variables | snake_case | `member_count`, `is_active` |
| Python functions | snake_case | `get_member_by_id()`, `validate_input()` |
| Python classes | PascalCase | `MemberService` |
| CSS classes | kebab-case with BEM | `btn--primary`, `card__header` |
| i18n keys | snake_case | `page_title_dashboard`, `btn_save` |

### Import Ordering

```javascript
// 1. External dependencies (npm packages, CDN)
import { initializeApp } from 'firebase/app';

// 2. Firebase wrapper (project's firebase abstraction)
import { httpsCallable } from '/firebase/app.js';

// 3. Shared components (from js/components/)
import { createButton } from '/js/components/ui-button.js';
import { showToast } from '/js/components/ui-toast.js';

// 4. API clients
import { getElections } from '/js/api/api-elections.js';

// 5. Utilities
import { formatDate } from '/js/utils/util-format.js';

// 6. Feature-specific imports
import { ElectionCard } from './election-card.js';

// 7. i18n
import { R } from '/i18n/strings-loader.js';
```

---

## Anti-Patterns to Avoid

### ❌ Namespace Collisions

```
# WRONG: Same name in multiple locations
apps/members-portal/elections/
apps/members-portal/admin-elections/elections/
services/elections/
```

**Solution**: Use unique, descriptive names with clear scope.

### ❌ Ambiguous File Names

```
# WRONG: What does this file do?
auth.js           # Is it a service? utility? page controller?
helpers.js        # Helpers for what?
index.js          # Entry point for what feature?
```

**Solution**: Use prefixes to indicate type.

```
# CORRECT:
util-auth.js      # Authentication utilities
api-auth.js       # Authentication API client
auth-page.js      # Authentication page controller
```

### ❌ Duplicate Components

```
# WRONG: Same component in multiple places
apps/members-portal/js/components/modal.js
apps/members-portal/policy-session/js/modal.js
```

**Solution**: Single source of truth in `js/components/`, import where needed.

### ❌ Inconsistent Case

```
# WRONG: Mixing cases
PolicySession.js    # PascalCase for file
policy_session.js   # snake_case for file
policySession.js    # camelCase for file
```

**Solution**: Always use kebab-case for files: `policy-session.js`

---

## Enforcement

### Automated Checks

1. **Pre-commit hook** - Validates naming on staged files
2. **`scripts/analysis/analyze-naming.py`** - Full codebase scan
3. **AI assistants** - Follow these conventions when generating code

### Running the Analysis

```bash
# Check all files
python3 scripts/analysis/analyze-naming.py

# Check specific directory
python3 scripts/analysis/analyze-naming.py --path apps/members-portal/js/

# CI mode (exit code 1 on violations)
python3 scripts/analysis/analyze-naming.py --strict
```

---

## Migration Status

### ✅ Phase 2 Complete (2025-12-03)

**UI Components renamed** (`js/components/`):
- `button.js` → `ui-button.js`
- `modal.js` → `ui-modal.js`
- `toast.js` → `ui-toast.js`
- `badge.js` → `ui-badge.js`
- `card.js` → `ui-card.js`
- `status.js` → `ui-status.js`
- `loading-state.js` → `ui-loading.js`
- `error-state.js` → `ui-error.js`
- `searchable-select.js` → `ui-searchable-select.js`

**API Clients renamed** (`js/api/`):
- `elections-api.js` → `api-elections.js`
- `members-client.js` → `api-members.js`

All 68 import statements across the codebase have been updated.

See `tmp/NAMING_CONVENTION_MIGRATION_PLAN.md` for remaining phases.

---

## Related Documentation

- [I18N_ENFORCEMENT.md](./I18N_ENFORCEMENT.md) - i18n string naming conventions
- [CODE_STANDARDS_MAP.md](../CODE_STANDARDS_MAP.md) - Overall code standards
- [NAMING_CONVENTION_MIGRATION_PLAN.md](../../tmp/NAMING_CONVENTION_MIGRATION_PLAN.md) - Migration timeline

---

**Last Updated**: 2025-12-03
