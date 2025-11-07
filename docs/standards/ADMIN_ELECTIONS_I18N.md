# Admin Elections i18n System

**Date:** 2025-11-07  
**Related:** #202 - Admin Elections Navigation Design  
**Status:** ✅ Implemented and Deployed

## Overview

The admin-elections area has its own **separate i18n (internationalization) system**, independent from both the global member portal i18n and the general admin portal i18n.

## Problem Statement

Originally, admin-elections was using the global i18n system (`/i18n/values-is/strings.xml`), which created several issues:

1. **No separation** - All strings mixed together (member portal + admin + elections)
2. **Unclear ownership** - Hard to know which strings belong to which area
3. **Maintenance difficulty** - 527+ strings in one file, hard to navigate
4. **Namespace pollution** - Election strings polluting global namespace
5. **Inconsistency** - `/admin/` has its own i18n, but `/admin-elections/` didn't

## Solution

Created a **self-contained i18n system** for admin-elections, following the same pattern as the general admin portal.

### Directory Structure

```
apps/members-portal/
├── i18n/                                    # Global member portal i18n
│   └── values-is/
│       └── strings.xml                      # Member strings only
│
├── admin/                                   # General admin portal
│   └── i18n/
│       └── values-is/
│           └── strings.xml                  # Admin strings (sync, members, etc.)
│
└── admin-elections/                         # Election management (NEW)
    └── i18n/                                # ✅ NEW: Separate i18n system
        ├── strings-loader.js                # AdminElectionsStringsLoader class
        └── values-is/
            └── strings.xml                  # 241 election-specific strings
```

## Implementation

### 1. Strings Loader (`admin-elections/i18n/strings-loader.js`)

**Custom loader class** specifically for admin-elections:

```javascript
import { debug } from '../../js/utils/debug.js';

class AdminElectionsStringsLoader {
  constructor() {
    this.strings = {};
    this.currentLocale = 'is';
    this.loaded = false;
  }

  async load(locale = 'is') {
    // Loads from /admin-elections/i18n/values-is/strings.xml
    const xmlPath = `/admin-elections/i18n/values-${locale}/strings.xml`;
    // ... parsing logic
  }

  // Same API as global loader
  format(template, ...args) { /* ... */ }
  get(key, ...args) { /* ... */ }
  get string() { return this.strings; }
}

export const R = new AdminElectionsStringsLoader();
```

**Key features:**
- Loads from `/admin-elections/i18n/` directory
- Debug logging with `[Admin Elections i18n]` prefix
- Same API as global loader (format, get, string)
- Independent cache and state

### 2. Strings File (`admin-elections/i18n/values-is/strings.xml`)

**241 election-specific strings** organized by category:

```xml
<?xml version='1.0' encoding='utf-8'?>
<resources>
  <!-- NAVIGATION (4 strings) -->
  <string name="admin_elections_brand">Kosningastjórnun</string>
  <string name="nav_elections_list">Kosningar</string>
  <string name="admin_nav_back_to_member">Aftur á félagavef</string>
  <string name="admin_nav_logout">Útskrá</string>
  
  <!-- ROLES (2 strings) -->
  <string name="role_superadmin">👑 Superadmin</string>
  <string name="role_election_manager">📊 Kosningastjóri</string>
  
  <!-- LIST PAGE (68 strings) -->
  <!-- Filters, search, table headers, actions, confirmations, etc. -->
  
  <!-- CREATE WIZARD (167 strings) -->
  <!-- 4 steps, validation, duration, review, etc. -->
</resources>
```

**Categories:**
- **Navigation** (4) - Brand, links, logout
- **Roles** (2) - Superadmin, election-manager
- **List page** (68) - Filters, search, table, actions, confirmations
- **Create wizard** (167) - Steps, validation, duration, review

### 3. Updated JavaScript Files

**Changed import statement** in 3 files:

```javascript
// Before (using global i18n):
import { R } from '../../i18n/strings-loader.js';

// After (using local i18n):
import { R } from '../i18n/strings-loader.js';
```

**Files updated:**
- `admin-elections/js/elections-list.js`
- `admin-elections/js/election-create.js`
- `admin-elections/js/election-control.js`

**Usage remains identical:**
```javascript
await R.load('is');
document.title = R.string.admin_elections_page_title;
const msg = R.format(R.string.success_opened, electionTitle);
```

## Ávinningur (Benefits)

### ✅ Aðskilnaður (Separation)
- **admin-elections er nú self-contained með eigin i18n**
- No dependency on global i18n namespace
- Can evolve independently from member portal and general admin
- Clear ownership of all election-related strings

### ✅ Skýrleiki (Clarity)
- **Enginn ruglingur við global admin strings**
- All election strings in one dedicated file
- Easy to see exactly what text admin-elections uses
- No confusion about which area owns which strings

### ✅ Viðhald (Maintainability)
- **Auðvelt að finna og uppfæra election strings**
- 241 strings in dedicated file vs 527+ in global file
- Grouped by functionality (navigation, list, create)
- Changes to elections don't affect other areas

### ✅ Samkvæmni (Consistency)
- **Sama pattern og `/admin/i18n/`**
- Both `/admin/` and `/admin-elections/` have own i18n
- Follows established architectural pattern
- Easy to understand and replicate for future areas

### ✅ Namespace (No Pollution)
- **Engin mengun af global i18n**
- Election strings don't clutter member portal namespace
- Member portal i18n remains focused on member features
- Each area has its own string keys without conflicts

## Comparison: Before vs After

### Before (All Mixed Together)

```
/i18n/values-is/strings.xml (527+ strings)
├── Member portal strings (login, dashboard, voting, etc.)
├── General admin strings (sync, members, events, etc.)
└── Admin elections strings (list, create, wizard, etc.) ← MIXED IN
```

**Problems:**
- Hard to find election strings among 527+ total strings
- Unclear which strings belong to which area
- Changes to elections risk breaking member/admin features
- No clear ownership or responsibility

### After (Clean Separation)

```
/i18n/values-is/strings.xml
├── Member portal strings only
└── NO admin-elections strings

/admin/i18n/values-is/strings.xml
└── General admin strings (sync, members, etc.)

/admin-elections/i18n/values-is/strings.xml ← NEW!
└── Election management strings (241 total)
```

**Benefits:**
- Clear separation by functional area
- Easy to find and modify election strings
- No risk of cross-contamination
- Each area self-contained

## File Structure

```
apps/members-portal/admin-elections/
├── i18n/
│   ├── strings-loader.js              # 156 lines - Custom loader
│   └── values-is/
│       └── strings.xml                # 241 strings - All election text
├── js/
│   ├── elections-list.js              # Uses ../i18n/strings-loader.js
│   ├── election-create.js             # Uses ../i18n/strings-loader.js
│   └── election-control.js            # Uses ../i18n/strings-loader.js
├── index.html
├── create.html
└── election-control.html
```

## Usage Examples

### Loading Strings

```javascript
import { R } from '../i18n/strings-loader.js';

// Load Icelandic strings
await R.load('is');

console.log(`[Admin Elections i18n] ✓ Loaded ${Object.keys(R.string).length} strings`);
// Output: [Admin Elections i18n] ✓ Loaded 241 strings for locale: is
```

### Accessing Strings

```javascript
// Direct access
const title = R.string.admin_elections_title; // "Kosningar"

// With formatting
const message = R.format(R.string.confirm_hide_message, electionTitle);
// "Ertu viss um að þú viljir fela kosninguna "Forsetakjör"?"

// Using get() method
const text = R.get('filter_all'); // "Allar"
```

### Initializing UI

```javascript
async function initializeUITexts() {
  // Navigation
  document.getElementById('nav-brand').textContent = R.string.admin_elections_brand;
  document.getElementById('nav-elections-list').textContent = R.string.nav_elections_list;
  
  // Page content
  document.title = R.string.admin_elections_page_title;
  document.getElementById('page-heading').textContent = R.string.admin_elections_title;
  
  // Filters
  document.getElementById('filter-all').textContent = R.string.filter_all;
  document.getElementById('filter-draft').textContent = R.string.filter_draft;
  
  // Table headers
  document.getElementById('th-title').textContent = R.string.table_header_title;
  document.getElementById('th-status').textContent = R.string.table_header_status;
}
```

## Adding New Strings

### 1. Add to XML

Edit `admin-elections/i18n/values-is/strings.xml`:

```xml
<string name="btn_export_results">📊 Flytja út niðurstöður</string>
```

### 2. Use in JavaScript

```javascript
const exportBtn = document.getElementById('export-btn');
exportBtn.textContent = R.string.btn_export_results;
```

### 3. Test

```bash
# Deploy to test
cd services/members
firebase deploy --only hosting --project ekklesia-prod-10-2025

# Verify in browser
# Check that new string appears correctly
```

## Future Enhancements

### Multi-Language Support

When adding English support:

1. Create `admin-elections/i18n/values-en/strings.xml`
2. Translate all 241 strings to English
3. Load with `await R.load('en')`

```
admin-elections/i18n/
├── strings-loader.js
├── values-is/
│   └── strings.xml        # Icelandic (241 strings)
└── values-en/             # NEW
    └── strings.xml        # English (241 strings)
```

### Additional Pages

When adding new admin-elections pages (edit, detail, results):

1. Add strings to `admin-elections/i18n/values-is/strings.xml`
2. Group by page/feature with XML comments
3. Use same loader: `import { R } from '../i18n/strings-loader.js'`

Example for results page:

```xml
<!-- ========================================== -->
<!-- ADMIN ELECTIONS - RESULTS PAGE -->
<!-- ========================================== -->
<string name="results_page_title">Niðurstöður - Kosningastjórnun</string>
<string name="results_heading">Niðurstöður kosningar</string>
<string name="results_total_votes">Heildarfjöldi atkvæða:</string>
<!-- ... more results strings ... -->
```

## Migration Notes

### What Was Moved

**241 strings** moved from `/i18n/values-is/strings.xml` to `/admin-elections/i18n/values-is/strings.xml`:

- All strings with `admin_elections_` prefix
- All strings with `nav_elections_` prefix
- All strings related to election management UI
- All wizard step strings
- All validation messages for elections
- All action button strings (open, close, hide, delete)

### What Remained in Global i18n

Member portal strings stayed in `/i18n/values-is/strings.xml`:

- Login, dashboard, profile strings
- Member voting experience strings
- Navigation strings for member area
- Common UI strings (loading, error, success)

### What Remained in Admin i18n

General admin strings stayed in `/admin/i18n/values-is/strings.xml`:

- Sync, history, queue strings
- Member management strings
- Admin dashboard strings
- Admin navigation strings

## Testing

### Manual Verification

1. **Load admin-elections:** https://ekklesia-prod-10-2025.web.app/admin-elections/
2. **Check navigation:** Brand should say "Kosningastjórnun"
3. **Check filters:** "Allar", "Drög", "Virkar", "Lokaðar", "Faldar"
4. **Check create wizard:** All 4 steps with proper Icelandic text
5. **Open console:** Should see `[Admin Elections i18n] ✓ Loaded 241 strings`

### Validation Script

Check that all strings are properly used:

```bash
cd /home/gudro/Development/projects/ekklesia
python3 scripts/admin/validate-i18n-usage.py
```

Expected output:
- All 241 strings referenced in code
- No missing string keys
- No unused strings
- All text properly internationalized

## Troubleshooting

### Strings Not Loading

**Problem:** UI shows "Loading..." everywhere

**Solution:**
1. Check console for errors
2. Verify `await R.load('is')` completes before UI initialization
3. Check network tab for `/admin-elections/i18n/values-is/strings.xml` request
4. Verify XML file is valid (no syntax errors)

### Wrong Strings Showing

**Problem:** Seeing member portal strings instead of election strings

**Solution:**
1. Check import: Should be `from '../i18n/strings-loader.js'` not `from '../../i18n/strings-loader.js'`
2. Verify file is using admin-elections loader
3. Clear browser cache and hard refresh

### Missing String Key

**Problem:** Console warning "Missing string key: xyz"

**Solution:**
1. Add missing key to `admin-elections/i18n/values-is/strings.xml`
2. Redeploy: `firebase deploy --only hosting`
3. Hard refresh browser

## Related Documentation

- [Admin Elections Navigation Design](../features/election-voting/ADMIN_ELECTIONS_NAVIGATION_DESIGN.md)
- [I18n Guide](./I18N_GUIDE.md)
- [Code Standards](/docs/CODE_STANDARDS_MAP.md)

## Related Issues

- [#202 - Admin Elections Navigation Simplification](https://github.com/sosialistaflokkurinn/ekklesia/issues/202)
- [#192 - Epic: Admin Elections Dashboard](https://github.com/sosialistaflokkurinn/ekklesia/issues/192)

## Deployment

**Commit:** `0efbf01` - refactor(admin-elections): Create separate i18n system  
**Date:** 2025-11-07  
**Status:** ✅ Deployed to production  
**URL:** https://ekklesia-prod-10-2025.web.app/admin-elections/

---

**Key Principle:**

> "Each functional area should have its own i18n system for clarity, maintainability, and separation of concerns."

Just like `/admin/` has its own i18n separate from the member portal, `/admin-elections/` now has its own i18n separate from both. This pattern should be followed for future specialized areas.
