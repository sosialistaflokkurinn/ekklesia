# Code Patterns & Best Practices

## Core Principles

1. **Reuse over rewrite** - Search `js/components/` and `js/utils/` first
2. **Consistency over cleverness** - Match existing patterns exactly
3. **Simple over complex** - Minimum code for the task
4. **Explicit over implicit** - Clear naming, JSDoc comments

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
| Formatting | `import { formatDate } from '/js/utils/util-format.js'` | `formatDate(date)` |
| Debounce | `import { debounce } from '/js/utils/util-debounce.js'` | `debounce(fn, 300)` |
| Debug | `import { debug } from '/js/utils/util-debug.js'` | `debug('module', 'message')` |

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
