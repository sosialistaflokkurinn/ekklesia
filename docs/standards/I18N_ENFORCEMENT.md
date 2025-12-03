# i18n Enforcement Policy

**Created**: 2025-12-03
**Status**: 🚧 In Progress
**Purpose**: Define and enforce i18n standards across the codebase

---

## Core Principles

### 1. All User-Facing Text in XML Files

**Every** string displayed to users must be defined in XML files:

```
apps/members-portal/
├── i18n/values-is/portal-strings.xml           # Main portal (348 strings)
├── admin/i18n/values-is/admin-portal-strings.xml    # Admin portal (154 strings)
├── admin-elections/i18n/values-is/admin-elections-strings.xml  # Elections admin (173 strings)
├── elections/i18n/values-is/member-elections-strings.xml       # Member elections (60 strings)
├── policy-session/i18n/values-is/policy-session-strings.xml    # Policy session (52 strings)
└── superuser/i18n/values-is/superuser-portal-strings.xml       # Superuser (151 strings)
```

**Total: ~938 strings across 6 XML files**

### 2. No Hardcoded Text in HTML or JavaScript

❌ **WRONG:**
```html
<h1>Staða kerfis</h1>
<button>Uppfæra</button>
```

✅ **CORRECT (Option A - JavaScript replacement):**
```html
<h1 id="page-title">Loading...</h1>
<button id="refresh-btn">Loading...</button>
```
```javascript
document.getElementById('page-title').textContent = R.string.page_title_system_health;
document.getElementById('refresh-btn').textContent = R.string.btn_refresh;
```

✅ **CORRECT (Option B - data-i18n attribute):**
```html
<h1 data-i18n="page_title_system_health"></h1>
<button data-i18n="btn_refresh"></button>
```
```javascript
// Auto-translated by i18n loader
document.querySelectorAll('[data-i18n]').forEach(el => {
  el.textContent = R.string[el.dataset.i18n];
});
```

### 3. Mandatory String Loader Initialization

Every JS file that uses i18n **must** call `.load()`:

```javascript
import { R } from '/i18n/strings-loader.js';
import { superuserStrings } from './i18n/superuser-strings-loader.js';

async function init() {
  await R.load('is');                    // ✅ REQUIRED
  await superuserStrings.load();         // ✅ REQUIRED if using superuserStrings
  // ... rest of init
}
```

---

## Enforcement Tools

### 1. Pre-commit Hook (Automatic)

Located at `git-hooks/pre-commit`, runs automatically on every commit:

**Checks performed:**
- ✅ JS files importing `R` must call `R.load()`
- ✅ JS files importing `superuserStrings` must call `.load()`
- ✅ JS files importing `adminStrings` must call `.load()`
- ✅ JS files importing `electionsStrings` must call `.load()`
- ⚠️ Warns about hardcoded Icelandic text (via find-hardcoded-text.py)

**Installation:**
```bash
cp git-hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### 2. analyze-i18n.py (Manual Analysis)

```bash
python3 scripts/utils/analyze-i18n.py --verbose
```

**Finds:**
- Missing strings (used in code but not defined in XML)
- Unused strings (defined in XML but not used)
- String usage by file type (JS vs HTML)

### 3. find-hardcoded-text.py (Hardcoded Text Detection)

```bash
# Scan all files
python3 scripts/utils/find-hardcoded-text.py --verbose

# Scan only staged files (used by pre-commit hook)
python3 scripts/utils/find-hardcoded-text.py --staged

# Generate XML suggestions for missing strings
python3 scripts/utils/find-hardcoded-text.py --fix
```

**Finds:**
- Icelandic text directly in HTML tags
- Icelandic text in JavaScript string literals
- English text that should be translated
- Hardcoded placeholder/title/aria-label attributes

---

## i18n Patterns

### Pattern 1: HTML with data-i18n Attributes

```html
<!-- Text content -->
<h1 data-i18n="page_title_dashboard"></h1>
<button data-i18n="btn_save"></button>

<!-- Attributes -->
<input placeholder="" data-i18n-placeholder="input_search_placeholder">
<span title="" data-i18n-title="tooltip_help"></span>
<button aria-label="" data-i18n-aria-label="btn_close_aria"></button>
```

### Pattern 2: JavaScript with R.string

```javascript
import { R, translatePage } from '/i18n/strings-loader.js';

async function init() {
  await R.load('is');     // REQUIRED before using R.string
  translatePage();        // Auto-translate data-i18n elements
  
  // Dynamic text
  element.textContent = R.string.welcome_message;
  showToast(R.string.success_saved, 'success');
}
```

### Pattern 3: Components with DEFAULT_STRINGS

For reusable components that may load before R.load() completes:

```javascript
const DEFAULT_STRINGS = {
  loading: 'Hleður...',
  error: 'Villa kom upp',
  retry: 'Reyna aftur'
};

export function createComponent(options = {}) {
  // Merge: DEFAULT_STRINGS < R.string < options.strings
  const strings = {
    ...DEFAULT_STRINGS,
    loading: R.string?.loading || DEFAULT_STRINGS.loading,
    ...options.strings
  };
  
  // Use strings.loading, strings.error, etc.
}
```

### Pattern 4: translatePage() Function

All string loaders now include `translatePage()`:

```javascript
// Translates all elements with data-i18n* attributes
translatePage();

// Supported attributes:
// - data-i18n="key"           → textContent
// - data-i18n-title="key"     → title attribute
// - data-i18n-placeholder="key" → placeholder attribute
// - data-i18n-aria-label="key" → aria-label attribute
```

---

## String Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Page title | `page_title_*` | `page_title_system_health` |
| Section heading | `heading_*` | `heading_services` |
| Button | `btn_*` | `btn_refresh`, `btn_save` |
| Label | `label_*` | `label_status`, `label_name` |
| Error message | `error_*` | `error_loading`, `error_generic` |
| Success message | `success_*` | `success_saved` |
| Status | `status_*` | `status_active`, `status_inactive` |
| Navigation | `nav_*` | `nav_dashboard`, `nav_logout` |
| Service name | `service_name_*` | `service_name_elections` |
| Service status | `service_status_*` | `service_status_healthy` |

---

## Framework Alignment

### Angular-style i18n (Our Target)

We follow Angular's i18n approach without TypeScript:

1. **XML resource files** (like Android/Angular)
2. **Centralized string management**
3. **`data-i18n` attributes** for static HTML content
4. **JavaScript API** for dynamic content

### Why Not JSON?

- XML has better support for comments and organization
- XML is the Android standard (familiar to many developers)
- XML allows for plurals, arrays, and complex structures
- Translation tools (OneSky, Crowdin) prefer XML

### Performance Considerations

⚠️ **Note**: Loading XML at runtime has a small performance cost (~50-100ms).
This is acceptable for our use case because:

1. XML files are cached after first load
2. Strings load in parallel with other resources
3. User sees "Loading..." placeholder briefly (good UX pattern)

If performance becomes an issue, we can:
- Pre-compile XML to JSON at build time
- Inline critical strings in HTML
- Use service worker to cache strings

---

## Migration Status

### ✅ Phase 1: Infrastructure (Complete)
- [x] Create analyze-i18n.py tool
- [x] Create find-hardcoded-text.py tool
- [x] Add pre-commit hook for loader checks
- [x] Add pre-commit hook for hardcoded text detection

### ✅ Phase 2: Superuser Console (Complete)
- [x] Convert system-health.html to use data-i18n
- [x] Convert roles.html to use data-i18n
- [x] Convert other superuser pages
- [x] Add 203 new strings to superuser-portal-strings.xml

### ✅ Phase 3: Admin Portal (Complete)
- [x] Audit admin-elections HTML files
- [x] Add translatePage() to admin string loaders
- [x] Convert to data-i18n pattern

### ✅ Phase 4: Member Portal (Complete)
- [x] Audit member area HTML files (dashboard, profile)
- [x] Audit elections and policy-session pages
- [x] Add translatePage() to all string loaders

### ✅ Phase 5: Components (Complete)
- [x] Add DEFAULT_STRINGS to countdown-timer.js
- [x] Add DEFAULT_STRINGS to schedule-control.js
- [x] Add DEFAULT_STRINGS to schedule-display.js
- [x] Add DEFAULT_STRINGS to voting-form.js
- [x] Add DEFAULT_STRINGS to modal.js
- [x] Add DEFAULT_STRINGS to other components

### ✅ Phase 6: Enforcement (Complete)
- [x] Pre-commit hook for R.load() checks
- [x] Pre-commit hook for hardcoded text (warning)
- [x] Document in AI instructions (.github/copilot-instructions.md)
- [x] Document in I18N_ENFORCEMENT.md

---

## Related Documentation

- [I18N_GUIDE.md](./I18N_GUIDE.md) - Original i18n usage guide
- [apps/members-portal/i18n/README.md](../../apps/members-portal/i18n/README.md) - Detailed API reference
- [.github/copilot-instructions.md](../../.github/copilot-instructions.md) - AI assistant instructions

---

**Last Updated**: 2025-12-03
