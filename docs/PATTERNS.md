# Code Patterns & Best Practices

## Core Principles

1. **Reuse over rewrite** - Search `js/components/` and `js/utils/` first
2. **Consistency over cleverness** - Match existing patterns exactly
3. **Simple over complex** - Minimum code for the task
4. **Explicit over implicit** - Clear naming, JSDoc comments

### Related Documentation

| Document | Topics |
|----------|--------|
| [PATTERNS-GCP.md](PATTERNS-GCP.md) | GCP/Firebase auth, CLI commands, Cloud Run, Firestore queries |
| [PATTERNS-ELECTIONS.md](PATTERNS-ELECTIONS.md) | Election types, voting systems, admin elections |
| [PATTERNS-NominationCommittee.md](PATTERNS-NominationCommittee.md) | Nomination committee, ranked voting, restricted access |
| [PATTERNS_DATA_DEBUGGING.md](PATTERNS_DATA_DEBUGGING.md) | Data sync issues, debugging data loss, iceaddr, webhook debugging |

---

## Secrets Management

### Secret Mounting
When injecting secrets into Cloud Run or Cloud Functions:
1.  **Use `valueFrom.secretKeyRef`**: Always reference the secret by key.
2.  **Use `latest` version**: Unless pinning is required, use `latest`.
3.  **Avoid Conflicting Annotations**: Do not use `run.googleapis.com/secrets` annotation if using `valueFrom` in `env`.

**Correct (YAML):**
```yaml
containers:
  - env:
      - name: django-api-token  # Lowercase to match secret name
        valueFrom:
          secretKeyRef:
            name: django-api-token
            key: latest
```

**Incorrect (Do not mix):**
```yaml
metadata:
  annotations:
    run.googleapis.com/secrets: secret-name:project/secrets/secret-name  # CONFLICT
containers:
  - env:
      - name: MY_SECRET
        valueFrom: ...
```

### Environment Variable Naming
- **Cloud Run/Functions**: Match the secret name exactly (usually lowercase with hyphens) if using Firebase SDK.
- **Legacy/CLI**: `gcloud run deploy --set-secrets` often creates UPPERCASE variables.
- **Pattern**: Prefer lowercase matching the secret name: `os.environ.get('django-api-token')`.

---

## Database Connectivity

### Local Development Proxy
Always use `--gcloud-auth` when running `cloud-sql-proxy` locally. This ensures it uses your personal gcloud credentials rather than searching for Application Default Credentials (ADC) which may be missing or stale.

**Correct Command:**
```bash
cloud-sql-proxy PROJECT:REGION:INSTANCE --port 5433 --gcloud-auth
```

**Incorrect:**
```bash
# Missing auth flag - will fail if ADC is not set
cloud-sql-proxy PROJECT:REGION:INSTANCE --port 5433
```

---

## Reusable Components

### UI Components (js/components/)

| Component | Import | Usage |
|-----------|--------|-------|
| Toast | `import { showToast } from '/js/components/ui-toast.js'` | `showToast('Saved!', 'success')` |
| Modal | `import { showModal, showConfirm } from '/js/components/ui-modal.js'` | `showModal('Title', content)` |
| Loading | `import { showLoading, hideLoading } from '/js/components/ui-loading.js'` | `showLoading()` |
| Badge | `import { createBadge } from '/js/components/ui-badge.js'` | `createBadge('Active', 'success')` |
| Card | `import { createCard } from '/js/components/ui-card.js'` | `createCard(title, content)` |
| Error | `import { showError } from '/js/components/ui-error.js'` | `showError(message)` |

### Utilities (js/utils/)

| Utility | Import | Usage |
|---------|--------|-------|
| DOM helper | `import { el } from '/js/utils/util-dom.js'` | `el('div', 'class', {attr: val}, children)` |
| Date formatting | `import { formatDateIcelandic } from '/js/utils/util-format.js'` | `formatDateIcelandic(date)` |
| Debounce | `import { debounce } from '/js/utils/util-debounce.js'` | `debounce(fn, 300)` |
| Debug | `import { debug } from '/js/utils/util-debug.js'` | `debug.log('module', 'msg')` |

**Icelandic date formatters** (from `util-format.js`):
| Function | Output Example | Usage |
|----------|----------------|-------|
| `formatDateIcelandic` | "6. nóvember 2025 kl. 13:30" | Full date + time |
| `formatDateOnlyIcelandic` | "6. nóvember 2025" | Date only |
| `formatDateWithDayIcelandic` | "sunnudaginn 12. október, kl. 10:00" | Day name + date + time |
| `formatDateShortIcelandic` | "12. des, kl. 14:30" | Compact (for lists) |
| `formatTimeIcelandic` | "14:30:45" | Time only |

**IMPORTANT:** Do NOT use `toLocaleDateString('is-IS')` or `toLocaleTimeString('is-IS')` - browser support for Icelandic locale is inconsistent. Always use the central formatters above.

**Debug utility note:** `debug` is an object with methods, not a function:
```javascript
// CORRECT
debug.log('MyModule', 'Loading data...');
debug.warn('MyModule', 'Deprecated feature used');
debug.error('MyModule', 'Failed to load:', error);

// WRONG - debug is not a function!
debug('MyModule', 'message');  // TypeError: debug is not a function
```

### API Clients (js/api/)

| Client | Import | Usage |
|--------|--------|-------|
| Elections | `import { getElections, submitVote } from '/js/api/api-elections.js'` | `await getElections()` |
| Members | `import { getMember } from '/js/api/api-members.js'` | `await getMember(id)` |

---

## Component Pattern (DEFAULT_STRINGS)

All components use this pattern for i18n:

```javascript
/**
 * Component description
 * @module components/name
 */

import { el } from '../utils/util-dom.js';
import { R } from '../../i18n/strings-loader.js';

/**
 * Default i18n strings (fallback when R.string not loaded)
 */
const DEFAULT_STRINGS = {
  close_aria: 'Loka',
  confirm_btn: 'Staðfesta',
  cancel_btn: 'Hætta við'
};

/**
 * Get string with fallback
 */
function getString(key) {
  return R.string?.[`component_${key}`] || DEFAULT_STRINGS[key];
}

/**
 * Main component function
 * @param {string} message - Message to display
 * @param {Object} options - Configuration options
 */
export function showComponent(message, options = {}) {
  const { duration = 3000, dismissible = true } = options;
  // ...
}
```

---

## DOM Helper (el)

Use `el()` instead of `document.createElement()`:

```javascript
import { el } from '/js/utils/util-dom.js';

// Create element with class, attributes, and children
const button = el('button', 'btn btn--primary', {
  type: 'button',
  'aria-label': 'Close',
  onclick: handleClick
}, 'Click Me');

// Create nested structure
const card = el('div', 'card', {},
  el('div', 'card__header', {}, title),
  el('div', 'card__body', {}, content)
);
```

---

## API Client Pattern

```javascript
/**
 * API Client for [Domain]
 * @module api/domain
 */

import { debug } from '../utils/util-debug.js';
import { authenticatedFetch } from '../auth.js';

const API_BASE = 'https://service-url.run.app';

/**
 * Get items
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} List of items
 */
export async function getItems(filters = {}) {
  try {
    const url = new URL(`${API_BASE}/api/items`);

    if (filters.status) {
      url.searchParams.set('status', filters.status);
    }

    const response = await authenticatedFetch(url);
    return response.data;
  } catch (error) {
    debug('api', 'Failed to fetch items:', error);
    throw error;
  }
}
```

---

## i18n Pattern

### HTML (data-i18n attributes)
```html
<h1 data-i18n="page_title"></h1>
<button data-i18n="btn_save"></button>
<input data-i18n-placeholder="input_search">
<span data-i18n-title="tooltip_help"></span>
```

### JavaScript (R.string)
```javascript
import { R, translatePage } from '/i18n/strings-loader.js';

async function init() {
  await R.load('is');
  translatePage();  // Translates all data-i18n elements

  // Dynamic text
  element.textContent = R.string.welcome_message;
  showToast(R.string.success_saved, 'success');
}
```

### String Naming Convention
| Type | Pattern | Example |
|------|---------|---------|
| Page title | `page_title_*` | `page_title_dashboard` |
| Button | `btn_*` | `btn_save`, `btn_cancel` |
| Label | `label_*` | `label_email`, `label_name` |
| Error | `error_*` | `error_loading`, `error_invalid` |
| Success | `success_*` | `success_saved` |
| Modal | `modal_*` | `modal_confirm_btn` |

---

## File Naming

| Type | Pattern | Example |
|------|---------|---------|
| UI component | `ui-[name].js` | `ui-toast.js` |
| Feature component | `[domain]-[name].js` | `election-vote-form.js` |
| Utility | `util-[name].js` | `util-format.js` |
| API client | `api-[domain].js` | `api-elections.js` |
| Route (backend) | `route-[name].js` | `route-admin.js` |
| Middleware | `middleware-[name].js` | `middleware-auth.js` |
| Service | `service-[name].js` | `service-audit.js` |
| Python function | `fn_[name].py` | `fn_sync_members.py` |
| Python utility | `util_[name].py` | `util_security.py` |

---

## JSDoc Style

```javascript
/**
 * Brief description of function
 *
 * @param {string} id - Item identifier
 * @param {Object} options - Configuration options
 * @param {number} options.timeout - Timeout in ms (default: 3000)
 * @param {boolean} options.retry - Enable retry (default: true)
 * @returns {Promise<Object>} The fetched item
 *
 * @example
 * const item = await getItem('123', { timeout: 5000 });
 */
export async function getItem(id, options = {}) {
  // ...
}
```

---

## Firebase Pattern

```javascript
// ALWAYS use wrapper
import { httpsCallable, auth, onAuthStateChanged } from '/firebase/app.js';

// Call function
const verify = httpsCallable('verifyMembership', 'europe-west2');
const result = await verify({ memberId: '123' });

// NEVER import directly
// import { ... } from 'https://www.gstatic.com/...';  // WRONG
```

---

## Auth Guard Pattern (requireAuth)

**Critical:** Use `requireAuth()` on protected pages instead of custom auth checks.

```javascript
// CORRECT - Use requireAuth() from auth.js
import { requireAuth } from '/js/auth.js';

async function init() {
  // Redirects to login if not authenticated
  const user = await requireAuth();

  // User is guaranteed to be authenticated here
  await loadPageData(user.uid);
}

// WRONG - Don't write custom auth checks that throw errors
async function init() {
  const auth = getFirebaseAuth();
  await new Promise((resolve, reject) => {
    auth.onAuthStateChanged(user => {
      if (user) resolve(user);
      else reject(new Error('Not logged in'));  // BAD: shows error instead of redirect
    });
  });
}
```

**Why this matters:**
- Token expiry at midnight causes "Not logged in" errors if you throw
- `requireAuth()` redirects to `/` (login page) instead of showing error
- Consistent UX across all protected pages

**Available auth functions (js/auth.js):**
| Function | Purpose |
|----------|---------|
| `requireAuth()` | Auth guard - redirects if not logged in |
| `getCurrentUser()` | Get user or null (no redirect) |
| `getUserData(user)` | Get claims (kennitala, roles, etc.) |
| `authenticatedFetch(url, options)` | Fetch with ID token + App Check |
| `signOut()` | Sign out and redirect to login |

---

## Error Handling

```javascript
async function fetchData() {
  try {
    const data = await api.getData();
    return data;
  } catch (error) {
    // Log for debugging
    debug('module', 'Failed to fetch:', error);

    // Show user-friendly message
    showToast(R.string.error_loading, 'error');

    // Return safe fallback
    return null;
  }
}
```

---

## Firestore-only Member Pattern (Python)

When a Cloud Function needs to update member data, handle both Django-synced and Firestore-only members:

```python
def update_member_profile(req):
    # Get django_id from Firestore member document
    django_id = member_data.get('django_id')

    # Note: django_id may be None for Firestore-only members
    if not django_id:
        log_json("info", "Member has no Django ID - Firestore-only update")

    # Update Firestore first (always succeeds)
    firestore_update_success = update_firestore(member_ref, profile_data)

    # Skip Django sync if no django_id
    if not django_id:
        log_json("info", "Skipping Django sync - Firestore-only member")
        return {"success": True, "firestore_only": True}

    # Try Django sync, handle 404 gracefully
    try:
        sync_to_django(django_id, profile_data)
    except Exception as e:
        if '404' in str(e) or 'No Comrade matches' in str(e):
            log_json("warn", "Member not found in Django - Firestore-only update")
            # Continue - Firestore update already succeeded
        else:
            raise  # Re-raise other errors

    return {"success": True}
```

**Key points:**
- Always check for `django_id` before attempting Django sync
- Handle 404 from Django gracefully (member may exist in Firestore but not Cloud SQL)
- Log clearly whether update was Firestore-only or synced to both

---

## Structured Logging (Python)

Use `log_json()` for consistent, searchable logs in Cloud Functions:

```python
from util_logging import log_json

# Standard log levels
log_json('INFO', 'Member registered', event='register_success', comrade_id=1234)
log_json('WARN', 'Django sync failed', event='django_sync_failed', error='timeout')
log_json('ERROR', 'Registration failed', event='register_error', error=str(e))

# Always include:
# - event: Machine-readable event name (snake_case)
# - Relevant IDs (but mask PII like kennitala)

# Masking PII
log_json('INFO', 'Processing member',
         kennitala=f"{kennitala[:6]}****",  # Show first 6, mask last 4
         email=f"{email.split('@')[0][:3]}***@{email.split('@')[1]}")
```

**Log levels:**
- `INFO`: Normal operations (registration, sync success)
- `WARN`: Recoverable issues (Django sync failed but Firestore succeeded)
- `ERROR`: Failures that need attention

---

## Prevent Double Submit

```javascript
async function handleSubmit(event) {
  event.preventDefault();

  const button = event.target.querySelector('button[type="submit"]');
  if (button.disabled) return;

  button.disabled = true;
  try {
    await submitForm();
    showToast(R.string.success_saved, 'success');
  } catch (error) {
    showToast(R.string.error_saving, 'error');
  } finally {
    button.disabled = false;
  }
}
```

---

## Anti-Patterns

### Don't Create Custom Components
```javascript
// BAD
const modal = document.createElement('div');
modal.className = 'my-modal';
// ... 50 lines of modal code

// GOOD
import { showModal } from '/js/components/ui-modal.js';
showModal('Title', content);
```

### Don't Hardcode Strings
```javascript
// BAD
showToast('Villa kom upp');

// GOOD
showToast(R.string.error_generic);
```

### Don't Use Deep Nesting
```javascript
// BAD
if (user) {
  if (user.isActive) {
    if (user.hasPermission) {
      doSomething();
    }
  }
}

// GOOD
if (!user) return;
if (!user.isActive) return;
if (!user.hasPermission) return;
doSomething();
```

### Don't Skip Null Checks
```javascript
// BAD
document.getElementById('el').textContent = data.value;

// GOOD
const el = document.getElementById('el');
if (!el) return;
el.textContent = data?.value ?? '';
```

---

## XSS Prevention (escapeHTML)

When inserting user-provided text into HTML, always escape it:

```javascript
/**
 * Escape HTML to prevent XSS attacks
 * @param {string} str - Untrusted string
 * @returns {string} Safe HTML-escaped string
 */
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Usage in innerHTML
item.innerHTML = `
  <div class="title">${escapeHTML(user.name)}</div>
  <div class="desc">${escapeHTML(user.bio)}</div>
`;

// Alternative: Use textContent when possible (auto-escapes)
element.textContent = user.name;  // Safe - no escaping needed
```

**When to use:**
- `innerHTML` with user data → Always escape
- `textContent` → No escaping needed (browser handles it)
- Template literals in innerHTML → Escape all variables

---

## API Timeout Pattern

For API calls that may take longer, use AbortController:

```javascript
async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  }
}
```

**Default timeouts:**
- Regular API calls: 10-15 seconds
- File uploads: 60 seconds
- Long-running operations: 30+ seconds

---

## CDN Library Loading (Dynamic Import)

When loading external libraries from CDN (e.g., SortableJS, Chart.js):

```javascript
/**
 * Singleton promise to avoid multiple loads
 */
let loadPromise = null;

/**
 * Load library from CDN with singleton pattern
 * @returns {Promise<Library>} The loaded library
 */
async function loadLibrary() {
  // Check if already loaded globally
  if (window.MyLibrary) {
    return window.MyLibrary;
  }

  // Singleton: return existing promise if loading
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/library@version/dist/library.min.js';
    script.onload = () => {
      debug('module', 'Library loaded successfully');
      resolve(window.MyLibrary);
    };
    script.onerror = () => reject(new Error('Failed to load library'));
    document.head.appendChild(script);
  });

  return loadPromise;
}
```

**Key points:**
- Use singleton pattern to prevent duplicate script tags
- Check `window.LibraryName` first (may already be loaded)
- Pin specific version in URL (`@1.15.2` not `@latest`)
- Add debug logging for load success

---

## Multi-Type Component Pattern

When a component needs to handle multiple variants (e.g., voting forms):

```javascript
/**
 * Display section based on type
 */
async function displaySection(container, data) {
  const { type } = data;

  // Clear previous content
  container.innerHTML = '';

  // Branch by type - use separate components
  if (type === 'ranked-choice') {
    const { createRankedForm } = await import('./ranked-form.js');
    const form = await createRankedForm({
      items: data.items,
      onSubmit: handleRankedSubmit
    });
    container.appendChild(form.element);
  } else {
    // Default: single/multi-choice
    const { createStandardForm } = await import('./standard-form.js');
    const form = createStandardForm({
      items: data.items,
      maxSelections: data.max_selections,
      onSubmit: handleStandardSubmit
    });
    container.appendChild(form.element);
  }
}
```

**Pattern:**
- Detect type from API response (`voting_type`, `content_type`, etc.)
- Use dynamic `import()` to load only needed component
- Keep separate components for each variant (avoid giant switch statements)
- Each component returns `{ element, methods... }` object

---

## Database Migration Pattern (Voting Types)

When adding new constrained values (e.g., new voting_type):

```sql
-- 1. Drop existing constraint
ALTER TABLE tablename DROP CONSTRAINT IF EXISTS constraint_name;

-- 2. Add new constraint with extended values
ALTER TABLE tablename
ADD CONSTRAINT constraint_name CHECK (
    column_name IN ('existing-value', 'new-value')
);

-- 3. Add supporting columns (with safe defaults)
ALTER TABLE tablename
ADD COLUMN IF NOT EXISTS new_column TYPE DEFAULT safe_value;

-- 4. Make existing NOT NULL columns nullable if new type doesn't use them
ALTER TABLE tablename ALTER COLUMN old_column DROP NOT NULL;

-- 5. Update validation constraint to allow either old OR new pattern
ALTER TABLE tablename DROP CONSTRAINT IF EXISTS data_validation;
ALTER TABLE tablename
ADD CONSTRAINT data_validation CHECK (
    (old_column IS NOT NULL) OR
    (new_column IS NOT NULL AND jsonb_typeof(new_column) = 'array')
);
```

**Key lesson:** If adding a new type that doesn't use existing required columns, remember to make those columns nullable!

---

## Backend Vote Validation Pattern

Multi-type validation in route handlers:

```javascript
router.post('/:id/vote', authenticate, async (req, res) => {
  const { answer_ids, ranked_answers } = req.body;
  const { voting_type } = election;

  // Branch validation by type
  if (voting_type === 'ranked-choice') {
    if (!ranked_answers) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'ranked_answers required for ranked-choice'
      });
    }
    const check = validateRankedAnswers(ranked_answers, election);
    if (!check.valid) {
      return res.status(400).json({ error: 'Bad Request', message: check.error });
    }
  } else {
    // single-choice or multi-choice
    const check = validateAnswers(answer_ids, election);
    if (!check.valid) {
      return res.status(400).json({ error: 'Bad Request', message: check.error });
    }
  }

  // Insert based on type
  if (voting_type === 'ranked-choice') {
    // Single row with JSONB array
    await client.query(
      `INSERT INTO ballots (election_id, member_uid, ranked_answers, ...)
       VALUES ($1, $2, $3, ...)`,
      [id, uid, JSON.stringify(ranked_answers)]
    );
  } else {
    // Multiple rows (one per selection)
    for (const answerId of answer_ids) {
      await client.query(
        `INSERT INTO ballots (election_id, member_uid, answer_id, ...)
         VALUES ($1, $2, $3, ...)`,
        [id, uid, answerId]
      );
    }
  }
});
```

**Key points:**
- Extract ALL possible body params at top
- Check `voting_type` from election record (not from request!)
- Use separate validation functions per type
- Different storage patterns: ranked = single JSONB row, multi = multiple rows

---
## API Response Field Requirements

When frontend needs data to determine UI variant, backend MUST include it:

```javascript
// WRONG - frontend can't detect type
const result = await client.query(
  `SELECT id, title, question, answers FROM elections WHERE id = $1`,
  [id]
);

// RIGHT - include type fields
const result = await client.query(
  `SELECT id, title, question, answers, voting_type, seats_to_fill, max_selections
   FROM elections WHERE id = $1`,
  [id]
);
```

**Checklist when adding new voting/content types:**
1. ✅ Add type field to GET single item endpoint
2. ✅ Add type field to GET list endpoint
3. ✅ Add any type-specific fields (e.g., `seats_to_fill` for STV)
4. ✅ Update POST/PUT to accept and validate type-specific fields
5. ✅ Add type to results/summary endpoints

---

## Client-Side Caching (PII Security)

When caching data in the browser, use the correct storage based on data sensitivity:

### localStorage vs sessionStorage

| Storage | Use For | Cleared |
|---------|---------|---------|
| `localStorage` | Non-PII data (events, elections, public lookups) | Never (manual clear only) |
| `sessionStorage` | PII data (members list, sync history, user details) | On browser close |

**Why this matters:**
- localStorage persists indefinitely - PII exposed if browser compromised
- sessionStorage cleared on browser close - limits exposure window
- Both vulnerable to XSS, but sessionStorage reduces risk

### Implementation Pattern

```javascript
// NON-PII (localStorage) - events, elections, public data
const CACHE_KEY = 'elections_list_cache';
function getCache() {
  const cached = localStorage.getItem(CACHE_KEY);
  // ...
}
function setCache(data) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
}

// PII (sessionStorage) - names, kennitala, emails, phones, addresses
const CACHE_KEY = 'admin_members_list_cache';
function getCache() {
  const cached = sessionStorage.getItem(CACHE_KEY);
  // ...
}
function setCache(data) {
  sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
}
```

### Logout Cleanup

Always clear PII caches on logout (in `session/auth.js`):

```javascript
export async function signOut() {
  // Clear sessionStorage (PII caches)
  sessionStorage.clear();

  // Clear any legacy localStorage PII keys
  const piiCacheKeys = [
    'admin_members_list_cache',
    'admin_sync_history_cache',
    'superuser_elevated_users_cache'
  ];
  piiCacheKeys.forEach(key => localStorage.removeItem(key));

  await firebaseSignOut(auth);
}
```

### Data Classification

| Data Type | Contains PII? | Storage |
|-----------|--------------|---------|
| Elections list | No | localStorage |
| Events list | No | localStorage |
| Unions/Job titles | No | localStorage |
| Members list | Yes (names, kennitala, emails) | sessionStorage |
| Sync history | Yes (kennitala references) | sessionStorage |
| Elevated users | Yes (names, kennitala) | sessionStorage |

---

## Cache Busting Pattern

When deploying frontend changes, update version query params:

```html
<!-- In HTML imports -->
<link rel="stylesheet" href="/styles/component.css?v=20251210">
<script type="module" src="/js/page.js?v=20251210"></script>
```

**Format:** `?v=YYYYMMDD` (date of deploy)

**When to update:**
- Any JS/CSS file change that's deployed
- Use `replace_all` in editor to update all occurrences
- Deploy frontend AFTER updating version tags

**Note:** Even with Firebase deploy, browsers may cache old JS. Hard refresh (Ctrl+Shift+R) or incognito may be needed for testing.

---
## In-Memory Cache Pattern (Python Cloud Functions)

For lookup data that changes rarely (countries, postal codes, job titles), use module-level cache to avoid Firestore queries on every invocation:

```python
import time
from typing import Optional, List

# In-memory cache (persists across invocations on same container)
_cache: Optional[List[dict]] = None
_cache_time: float = 0
CACHE_TTL_SECONDS = 3600  # 1 hour

def list_items(req):
    global _cache, _cache_time

    # Return cached data if valid
    if _cache and (time.time() - _cache_time) < CACHE_TTL_SECONDS:
        logger.info(f"Returning {len(_cache)} items from cache")
        return _cache

    # Fetch from Firestore
    db = firestore.client()
    docs = db.collection('lookup_items').order_by('name').stream()

    results = [{'id': d.get('id'), 'name': d.get('name')} for d in docs]

    # Update cache
    _cache = results
    _cache_time = time.time()

    logger.info(f"Returning {len(results)} items (cached)")
    return results
```

**For keyed data** (e.g., cells by postal code):

```python
from typing import Dict, Tuple

# Keyed cache: {key: (data, cache_time)}
_cache: Dict[int, Tuple[List[dict], float]] = {}
CACHE_TTL_SECONDS = 3600

def get_items_by_key(req):
    global _cache
    key = req.data.get('key_id')

    # Check cache
    if key in _cache:
        data, cache_time = _cache[key]
        if (time.time() - cache_time) < CACHE_TTL_SECONDS:
            return data

    # Fetch and cache
    result = fetch_from_firestore(key)
    _cache[key] = (result, time.time())
    return result
```

**Key points:**
- Module-level globals persist across invocations on same container instance
- Use 1 hour TTL for lookup data (adjust based on change frequency)
- Cache empty results too (prevents repeated queries for missing data)
- Log cache hits for monitoring
- Cold starts still query Firestore (first request after deploy or scale-up)