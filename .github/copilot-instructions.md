# Ekklesia Development Context

**Auto-loaded by:** GitHub Copilot (VS Code & Terminal)
**Manual reference for:** Claude, Gemini, other AI assistants

> **Quick Reference:** See `/CLAUDE.md` for critical rules and deployment warnings.
> This file contains detailed technical patterns and conventions.

---

## 🔒 Security Rules (CRITICAL)

### Git Security: .gitignore Protection
Sensitive files are protected by `.gitignore` - they are **never tracked or committed**.

### Protected Files (in .gitignore)
```bash
# Credentials (NEVER tracked)
.env, *.key.json, *client_secret*           # Environment & secrets
*serviceAccount*.json                        # GCP service accounts

# PII Protection (NEVER tracked)
docs/policy/                                 # Meeting notes with personal info
*KENNITALA*.md                               # SSN-related files
*.audit.json, scripts/logs/*.jsonl           # Audit logs

# Working directories (local only)
tmp/, archive-code/, docs/archive/           # Temporary/archived files
.claude/                                     # AI assistant config
```

### Critical Rules
- **NEVER** commit `.env` files or credentials
- Check before commit: `git status` should not show sensitive files
- If unsure: `git check-ignore -v FILENAME`

---

## 📁 Project Structure

### Frontend Architecture (`apps/members-portal/`)
- `admin-elections/` - Election administration UI
- `elections/` - Member voting interface
- `events/` - Event management interface
- `policy-session/` - Policy voting interface
- `members-area/` - Main member dashboard

### File Organization Rules

```
✅ CORRECT:
docs/bugfixes/YYYY-MM-DD-description.md     # Bug reports with date prefix
scripts/bugfixes/YYYY-MM-DD-test-name.sh    # Test scripts with date prefix
tmp/                                         # Temporary/working files (project tmp, NOT system /tmp/)

❌ WRONG:
docs/bugfixes/description.md                # Missing date prefix
scripts/test-name.sh                        # Missing bugfixes/ subdirectory
/                                           # Loose files in project root
```

### File Naming Conventions

**JavaScript Files (Frontend):**
| Pattern | Purpose | Examples |
|---------|---------|----------|
| `ui-*.js` | Shared UI components | `ui-button.js`, `ui-modal.js` |
| `*-page.js` | Page controllers | `dashboard-page.js` |
| `api-*.js` | API client modules | `api-elections.js` |
| `util-*.js` | Utility functions | `util-format.js` |

**Feature-specific files use domain prefix:**
| Pattern | Examples |
|---------|----------|
| `election-*.js` | `election-vote-form.js`, `election-countdown.js` |
| `policy-*.js` | `policy-amendment-form.js` |
| `member-*.js` | `member-address-autocomplete.js` |

**Backend Files (Cloud Run - services/svc-*):**
| Directory | Pattern | Examples |
|-----------|---------|----------|
| `src/routes/` | `route-*.js` | `route-admin.js`, `route-elections.js` |
| `src/middleware/` | `middleware-*.js` | `middleware-auth.js`, `middleware-rate-limiter.js` |
| `src/services/` | `service-*.js` | `service-audit.js`, `service-token.js` |
| `src/config/` | `config-*.js` | `config-database.js` |
| `src/utils/` | `util-*.js` | `util-logger.js` |

**Python Files (Firebase Functions):**
| Pattern | Purpose | Examples |
|---------|---------|----------|
| `fn_*.py` | Function definitions | `fn_sync_members.py`, `fn_validate_address.py` |
| `util_*.py` | Utilities | `util_security.py`, `util_logging.py` |
| `handler_*.py` | Request handlers | `handler_auth.py` |

**Full details:** docs/standards/NAMING_CONVENTIONS.md

### Firebase Wrapper Pattern (Frontend)
**ALWAYS** import Firebase services from `/firebase/app.js`, **NEVER** directly from CDN or SDK.

```javascript
// ✅ CORRECT:
import { httpsCallable } from '/firebase/app.js';
const verify = httpsCallable('verifyMembership', 'europe-west2');

// ❌ WRONG:
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/...';
const functions = getFunctions(app);
const verify = httpsCallable(functions, 'verifyMembership');
```

### CSS Bundle Pattern (Frontend)
HTML files use `/styles/bundle.css` instead of individual CSS files for performance.

**After editing any of these CSS files, rebuild the bundle:**
```bash
./scripts/build-css-bundle.sh
```

**Bundled files:** `global.css`, `nav.css`, `page.css`, `button.css`, `badge.css`, `modal.css`, `toast.css`, `form.css`

**Page-specific styles** (NOT bundled): Load separately after bundle.css
- `/admin/styles/admin.css`
- `/superuser/styles/superuser.css`
- `/styles/components/profile-edit.css`
- etc.

### Documentation Philosophy
- **Concise docs** → `docs/` (production, in repo)
- **Verbose investigation** → `tmp/` (project tmp, working context, not committed)
- **Always date-prefix** bug reports: `YYYY-MM-DD-`

**Full details:** DOCUMENTATION_MAP.md

---

## 🌍 Internationalization (i18n) Rules

### Core Principle
**ALL user-facing text MUST be in XML files, NEVER hardcoded in HTML or JavaScript.**

### String Files Location
```
apps/members-portal/
├── i18n/values-is/portal-strings.xml              # Main portal (~350 strings)
├── admin/i18n/values-is/admin-portal-strings.xml  # Admin portal (~155 strings)
├── admin-elections/i18n/values-is/admin-elections-strings.xml  # Elections admin
├── elections/i18n/values-is/member-elections-strings.xml       # Member elections
├── policy-session/i18n/values-is/policy-session-strings.xml    # Policy session
└── superuser/i18n/values-is/superuser-portal-strings.xml       # Superuser
```

### Pattern 1: HTML with data-i18n Attributes
```html
<!-- ✅ CORRECT: Use data-i18n attributes -->
<h1 data-i18n="page_title_dashboard"></h1>
<button data-i18n="btn_save"></button>
<input placeholder="" data-i18n-placeholder="input_search_placeholder">
<span title="" data-i18n-title="tooltip_help"></span>

<!-- ❌ WRONG: Hardcoded Icelandic text -->
<h1>Stjórnborð</h1>
<button>Vista</button>
```

### Pattern 2: JavaScript with R.string
```javascript
// ✅ CORRECT: Use R.string for dynamic text
import { R } from '/i18n/strings-loader.js';

async function init() {
  await R.load('is');  // REQUIRED - must call before using R.string
  
  element.textContent = R.string.welcome_message;
  showToast(R.string.success_saved, 'success');
}

// ❌ WRONG: Hardcoded strings
element.textContent = 'Velkomin!';
showToast('Vistað!', 'success');
```

### Pattern 3: Components with DEFAULT_STRINGS
```javascript
// ✅ CORRECT: Components use DEFAULT_STRINGS pattern
const DEFAULT_STRINGS = {
  loading: 'Hleður...',
  error: 'Villa kom upp',
  retry: 'Reyna aftur'
};

export function createComponent(options = {}) {
  const strings = {
    ...DEFAULT_STRINGS,
    ...options.strings  // Allow override from caller
  };
  
  // Use strings.loading, strings.error, etc.
}

// ❌ WRONG: Hardcoded in component
button.textContent = 'Hleður...';
```

### Pattern 4: translatePage() for Declarative Translation
```javascript
// ✅ CORRECT: Call translatePage() after R.load()
import { R, translatePage } from '/i18n/strings-loader.js';

async function init() {
  await R.load('is');
  translatePage();  // Auto-translates all data-i18n elements
}
```

### String Naming Conventions
| Type | Pattern | Example |
|------|---------|---------|
| Page title | `page_title_*` | `page_title_dashboard` |
| Button | `btn_*` | `btn_save`, `btn_cancel` |
| Label | `label_*` | `label_name`, `label_email` |
| Error | `error_*` | `error_loading`, `error_not_found` |
| Success | `success_*` | `success_saved` |
| Status | `status_*` | `status_active`, `status_closed` |

### Enforcement Tools
```bash
# Analyze i18n usage (find unused/missing strings)
python3 scripts/utils/analyze-i18n.py --verbose

# Find hardcoded Icelandic text
python3 scripts/utils/find-hardcoded-text.py

# Pre-commit hook automatically checks:
# - String loader imports have matching .load() calls
# - No hardcoded Icelandic text in staged files
```

**Full details:** docs/standards/I18N_ENFORCEMENT.md

---

## ☁️ Cloud Run Services

### Architecture Overview
Services in `europe-west2` region:

**Authentication:**
- `handlekenniauth` - Kenni.is OAuth with PKCE (Python 3.13)
- `verifymembership` - Membership verification

**Data Sync (Real-time, all use DJANGO_API_TOKEN):**
- `syncmembers` - Manual admin-triggered sync
- `sync-from-django` - Real-time webhook from Django signals
- `updatememberprofile` - Self-service profile updates

**Voting:**
- `elections-service` - Anonymous ballot recording (Node.js)
- `events-service` - Voting token issuance (Node.js)

**Other Services:**
- `get-django-token` - Admin API access
- `auditmemberchanges` - Audit logging
- `healthz` - System health checks

### Secret Management Pattern

**Python Cloud Functions (Firebase Gen 2):**
You MUST declare secrets in the decorator to persist them across deployments:
```python
@https_fn.on_request(secrets=["DJANGO_API_TOKEN"])
def myFunction(req: https_fn.Request) -> https_fn.Response:
    token = os.environ.get('DJANGO_API_TOKEN')
```

**Usage in Code:**
```python
# ✅ CORRECT: Read from environment (injected at deploy)
token = os.environ.get('DJANGO_API_TOKEN')
if not token:
    # Fallback for local dev or volume mounts
    if os.path.exists("/run/secrets/django-api-token"):
        with open("/run/secrets/django-api-token") as f:
            token = f.read().strip()

# ❌ WRONG: Direct Secret Manager API call
client = SecretManagerServiceClient()  # DON'T DO THIS!
```

**Deploy pattern:**
```bash
gcloud run services update SERVICE_NAME \
  --region=europe-west2 \
  --set-secrets="DJANGO_API_TOKEN=django-api-token:latest"
```

⚠️ **WARNING:** `firebase deploy --only functions` may reset secrets!

**Full details:** docs/infrastructure/CLOUD_RUN_SERVICES.md

---

## 🗄️ Database Architecture

### Current Setup
- **Production:** Cloud SQL PostgreSQL (europe-west2)
- **Connection:** Private IP via VPC connector
- **Proxy:** `cloud-sql-proxy` for local development

### Database Connection (Verified)
**Instance:** `ekklesia-prod-10-2025:europe-west2:ekklesia-db`
**Port:** `5433` (Avoids default 5432 conflicts)
**Auth:** `--gcloud-auth` (Crucial for local dev)

**Manual Connection Pattern:**
```bash
# 1. Start Proxy (Background)
cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:ekklesia-db --port 5433 --gcloud-auth &

# 2. Connect (PSQL)
psql -h 127.0.0.1 -p 5433 -U postgres -d postgres
```

**Helper Scripts:**
```bash
./scripts/database/start-proxy.sh  # Wraps the above command
./scripts/database/psql-cloud.sh   # Interactive shell
```

**Full details:** docs/infrastructure/CLOUD_RUN_SERVICES.md

---

## 🚀 Deployment Procedures

### Backend (Cloud Run)
```bash
cd services/svc-elections  # or svc-events
./deploy.sh
```

### Frontend (Firebase Hosting)
⚠️ **CRITICAL:** Must run from `services/svc-members/` directory!
```bash
cd services/svc-members
firebase deploy --only hosting
```

🚫 **NO LOCAL SERVER:** There is NO local development server workflow.
Changes are tested by deploying directly to Firebase Hosting.
**NEVER** suggest `python3 -m http.server`, `npx serve`, or similar local servers.

### Post-Deploy Verification
```bash
# Check secrets still configured
gcloud run services describe SERVICE \
  --region=europe-west2 --format="json" | grep secretKeyRef

# Re-apply if missing
gcloud run services update SERVICE \
  --set-secrets="DJANGO_API_TOKEN=django-api-token:latest"
```

**Full details:** docs/operations/OPERATIONAL_PROCEDURES.md

---

## 📊 Current Development Status

**Branch:** Check with `git branch --show-current`  
**Recent Work:** Check docs/status/CURRENT_DEVELOPMENT_STATUS.md

### Quick Status Check
```bash
# View recent commits
git log -5 --oneline --decorate

# View current branch and status
git status

# Check for uncommitted changes
git diff --stat
```

---

## 🧪 Testing Patterns

### Test Script Location
```bash
scripts/bugfixes/YYYY-MM-DD-test-name.sh  # Bug-specific tests
testing/integration/                      # Integration test code
docs/testing/reports/                     # Test documentation
```

### Test Structure
```bash
#!/bin/bash
# Test description here

run_test() {
    local test_name="$1"
    local test_command="$2"
    # Test logic
}
```

**Full details:** docs/testing/reports/INDEX.md

---

## 📝 Commit Message Format

```
type(scope): brief description

## Problem
Clear problem statement

## Solution
- What was changed
- Why it was changed

## Testing
- Test results


```

---

## 🔗 Essential Documentation Links

| Document | Purpose |
|----------|---------|
| DOCUMENTATION_MAP.md | Navigation to all docs |
| docs/status/CURRENT_DEVELOPMENT_STATUS.md | Current system state |
| docs/infrastructure/CLOUD_RUN_SERVICES.md | All 13 Cloud Run services |
| docs/operations/OPERATIONAL_PROCEDURES.md | Deploy & operations |

---

## 💡 Quick Reference

**Before creating files:**
1. Check if temporary → use `tmp/` (project tmp, NOT system /tmp/)
2. Check if bug-related → use date prefix `YYYY-MM-DD-`
3. Check if in proper subdirectory → `docs/category/` or `scripts/category/`

**Before committing:**
1. Run `git check-ignore -v <file>` to verify not gitignored
2. Check for PII (kennitölur, names, IPs, emails)
3. Verify pre-commit hooks pass (don't use `--no-verify`)

**After editing CSS/JS/HTML files:**
1. If CSS: Run `./scripts/build-css-bundle.sh` to rebuild bundle
2. Deploy: `cd services/svc-members && firebase deploy --only hosting`
3. **NO LOCAL TESTING** - deploy directly to Firebase Hosting

**When deploying Cloud Run:**
1. Deploy service
2. Verify secrets: `gcloud run services describe SERVICE | grep secretKeyRef`
3. Re-apply if needed: `--set-secrets="VAR=secret:latest"`

---

**Last Updated:** 2025-12-03
**Maintained by:** Development team

For questions or context issues, reference the linked documentation above.
