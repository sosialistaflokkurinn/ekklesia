# i18n Architecture - Three Separate Systems

**Last Updated:** November 7, 2025  
**Status:** Active in production

## Overview

Ekklesia uses **3 separate i18n (internationalization) systems** for different areas of the portal. Each system has its own XML file structure and JavaScript loader class.

## 🌍 The Three i18n Systems

### 1. Members Portal (Global) - `R.string`

**Purpose:** General member area (dashboard, profile, voting, etc.)

**Location:**
```
/apps/members-portal/i18n/
├── values-is/
│   └── strings.xml (445 strings)
└── strings-loader.js
```

**Loader Class:**
```javascript
class StringsLoader {
  // Defined in /i18n/strings-loader.js
}
export const R = { ... }; // Object with lazy loading
```

**Usage in code:**
```javascript
// Import
import { R } from '/i18n/strings-loader.js';

// Load
await R.load('is');

// Use string
const title = R.string.login_title;
const error = R.format(R.string.error_authentication, errorMsg);
```

**Example strings:**
- `login_title` - "Innskráning"
- `dashboard_title` - "Yfirlit"
- `voting_title` - "Atkvæðagreiðsla"
- `profile_edit_button` - "Breyta prófíl"

**Files using this:**
- `/js/**/*.js` - All JavaScript in members-portal
- `/members-area/**/*.js` - Member area code
- `/ui/**/*.js` - Shared UI components

---

### 2. Admin Portal - `adminStrings.get()`

**Purpose:** General admin dashboard (sync, members, events)

**Location:**
```
/apps/members-portal/admin/
├── i18n/
│   └── values-is/
│       └── strings.xml (210 strings)
└── js/
    └── i18n/
        └── admin-strings-loader.js
```

**Loader Class:**
```javascript
class AdminStringsLoader {
  // Defined in /admin/js/i18n/admin-strings-loader.js
}
export const adminStrings = new AdminStringsLoader();
```

**Usage in code:**
```javascript
// Import
import { adminStrings } from './i18n/admin-strings-loader.js';

// Load
await adminStrings.load();

// Use string
const title = adminStrings.get('sync_members_title');
const error = adminStrings.get('error_unauthorized_admin');
const formatted = adminStrings.get('sync_status_success').replace('%s', count);
```

**Example strings:**
- `sync_members_title` - "Samstilla Félaga"
- `sync_status_success` - "Samstilling tókst"
- `error_unauthorized_admin` - "Þú hefur ekki admin réttindi"
- `history_table_date` - "Dagsetning"

**Files using this:**
- `/admin/js/admin.js` - Admin dashboard
- `/admin/js/sync-queue.js` - Sync system
- `/admin/js/sync-history.js` - Sync history
- `/admin/js/**/*.js` - All admin code (except elections)

**Note:** Some admin files use **both** `adminStrings` AND global `R.string`:
```javascript
import { adminStrings } from './i18n/admin-strings-loader.js';
import { R } from '../../i18n/strings-loader.js';

// adminStrings for admin-specific text
const adminTitle = adminStrings.get('sync_members_title');

// R.string for shared text (e.g. role badges)
const roleText = R.string.role_superadmin;
```

---

### 3. Admin Elections - `R.string` (Separate)

**Purpose:** Election management (list, create, edit, control, results)

**Location:**
```
/apps/members-portal/admin-elections/
├── i18n/
│   ├── values-is/
│   │   └── strings.xml (177 strings)
│   └── strings-loader.js
└── js/
    ├── elections-list.js
    ├── election-create.js
    └── election-control.js
```

**Loader Class:**
```javascript
class AdminElectionsStringsLoader {
  // Defined in /admin-elections/i18n/strings-loader.js
}
export const R = new AdminElectionsStringsLoader();
```

**Usage in code:**
```javascript
// Import (relative path!)
import { R } from '../i18n/strings-loader.js';

// Load
await R.load('is');

// Use string
const title = R.string.admin_elections_title;
const label = R.string.create_step_basic_title;
const error = R.format(R.string.error_load_elections, errorMsg);
```

**Example strings:**
- `admin_elections_brand` - "Kosningar"
- `nav_elections_list` - "Yfirlit Kosninga"
- `create_step_basic_title` - "Grunnupplýsingar"
- `filter_status_active` - "Virkar"
- `btn_create_election` - "Stofna Nýja Kosningu"

**Files using this:**
- `/admin-elections/js/elections-list.js`
- `/admin-elections/js/election-create.js`
- `/admin-elections/js/election-control.js`
- `/admin-elections/js/**/*.js` - All election admin code

---

## 🔍 System Comparison

| Feature | Members Portal | Admin Portal | Admin Elections |
|---------|----------------|--------------|-----------------|
| **Variable** | `R.string` | `adminStrings` | `R.string` |
| **Class Name** | `StringsLoader` | `AdminStringsLoader` | `AdminElectionsStringsLoader` |
| **XML Path** | `/i18n/values-is/strings.xml` | `/admin/i18n/values-is/strings.xml` | `/admin-elections/i18n/values-is/strings.xml` |
| **JS Path** | `/i18n/strings-loader.js` | `/admin/js/i18n/admin-strings-loader.js` | `/admin-elections/i18n/strings-loader.js` |
| **Strings** | 445 | 210 | 177 |
| **Usage %** | 51.0% | 66.2% | 88.1% |
| **API** | `R.string.key`, `R.format()` | `adminStrings.get(key)` | `R.string.key`, `R.format()` |
| **Import** | `/i18n/strings-loader.js` | `./i18n/admin-strings-loader.js` | `../i18n/strings-loader.js` |
| **Area** | Member portal | Admin general | Admin elections |

## 🎯 When to Use Each System

### Use Members Portal `R.string` for:
- ✅ Login/logout text
- ✅ Dashboard text
- ✅ Profile/settings text
- ✅ Voting in member area
- ✅ Role badges (used everywhere)
- ✅ Generic error messages
- ✅ Navigation in member area
- ✅ Shared UI components

### Use Admin Portal `adminStrings` for:
- ✅ Sync management text
- ✅ Admin dashboard text
- ✅ Member management in admin
- ✅ Event management in admin
- ✅ Admin-specific error messages
- ✅ Sync history/queue text
- ✅ Developer tools text

### Use Admin Elections `R.string` for:
- ✅ Election list text
- ✅ Election creation wizard
- ✅ Election control/monitoring
- ✅ Election results display
- ✅ Election filters/search
- ✅ Election-specific validation
- ✅ Election status text

## 🚨 Common Mistakes

### ❌ Error 1: Wrong R.string Variable

**Problem:**
```javascript
// In /admin-elections/js/elections-list.js
import { R } from '../../i18n/strings-loader.js'; // ❌ WRONG!

const title = R.string.admin_elections_title; // undefined!
```

**Solution:**
```javascript
// In /admin-elections/js/elections-list.js
import { R } from '../i18n/strings-loader.js'; // ✅ CORRECT!

const title = R.string.admin_elections_title; // ✅ Works!
```

### ❌ Error 2: Using adminStrings in Elections

**Problem:**
```javascript
// In /admin-elections/js/election-create.js
import { adminStrings } from '../../admin/js/i18n/admin-strings-loader.js'; // ❌ WRONG!

const title = adminStrings.get('create_step_basic_title'); // undefined!
```

**Solution:**
```javascript
// In /admin-elections/js/election-create.js
import { R } from '../i18n/strings-loader.js'; // ✅ CORRECT!

const title = R.string.create_step_basic_title; // ✅ Works!
```

### ❌ Error 3: Mixing APIs

**Problem:**
```javascript
// Members portal
const text = R.get('login_title'); // ❌ R doesn't have .get() method

// Admin elections
const text = R.format('error_load_elections'); // ❌ Missing R.string
```

**Solution:**
```javascript
// Members portal
const text = R.string.login_title; // ✅ Correct API

// Admin elections
const text = R.format(R.string.error_load_elections, error); // ✅ Correct API
```

## 📝 Validation

Validation script supports all 3 systems:

```bash
python3 scripts/admin/validate-i18n-usage.py
```

**Example output:**
```
Checking members i18n (apps/members-portal/i18n/values-is/strings.xml)
  Found 445 strings
  Used: 227/445 (51.0%)

Checking admin i18n (apps/members-portal/admin/i18n/values-is/strings.xml)
  Found 210 strings
  Used: 139/210 (66.2%)

Checking admin-elections i18n (apps/members-portal/admin-elections/i18n/values-is/strings.xml)
  Found 177 strings
  Used: 156/177 (88.1%)
```

## 🔄 Future Improvements

### Unify API (Phase 7?)

Current inconsistency:
- Members/Elections: `R.string.key`
- Admin: `adminStrings.get(key)`

**Option 1: Standardize on R.string**
```javascript
// Change admin to use R.string
import { R as adminR } from './i18n/admin-strings-loader.js';
const text = adminR.string.sync_members_title;
```

**Option 2: Standardize on .get()**
```javascript
// Change all to use .get()
import { R } from '/i18n/strings-loader.js';
const text = R.get('login_title');
```

**Decision:** Wait until:
1. All 3 systems work well
2. English translations ready
3. Can make breaking change with good planning

### English Translations

Add English support to all 3 systems:
```
/i18n/values-en/strings.xml
/admin/i18n/values-en/strings.xml
/admin-elections/i18n/values-en/strings.xml
```

## 📚 Related Documents

- [ADMIN_ELECTIONS_I18N.md](./ADMIN_ELECTIONS_I18N.md) - Detailed admin-elections i18n documentation
- [ADMIN_ELECTIONS_NAVIGATION_DESIGN.md](/docs/features/election-voting/ADMIN_ELECTIONS_NAVIGATION_DESIGN.md) - Navigation design
- Issue #203 - Admin Elections i18n refactoring
- Issue #202 - Admin Elections navigation simplification

## 🎓 Quick Reference for Developers

**Rule of thumb:**

1. **Are you in `/apps/members-portal/js/` or `/members-area/`?**
   → Use `/i18n/strings-loader.js` → `R.string.key`

2. **Are you in `/admin/js/` (but NOT elections)?**
   → Use `./i18n/admin-strings-loader.js` → `adminStrings.get(key)`
   → May need `R.string` too for role badges

3. **Are you in `/admin-elections/js/`?**
   → Use `../i18n/strings-loader.js` → `R.string.key`

**When in doubt:**
- Check other files in same directory
- Run validation: `python3 scripts/admin/validate-i18n-usage.py`
- Check if string exists in correct XML file
