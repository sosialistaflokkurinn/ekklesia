# i18n Architecture - Þrjú Aðskilin Kerfi

**Dagsetning:** 7. nóvember 2025  
**Staða:** Virkt í production

## Yfirlit

Ekklesia notar **3 aðskilin i18n (internationalization) kerfi** fyrir mismunandi svæði portalsins. Hvert kerfi hefur sitt eigið XML skráarkerfi og JavaScript loader klasa.

## 🌍 Þrjú i18n Kerfin

### 1. Members Portal (Global) - `R.string`

**Tilgangur:** Almennt félagasvæði (dashboard, profile, voting, etc.)

**Staðsetning:**
```
/apps/members-portal/i18n/
├── values-is/
│   └── strings.xml (445 strengir)
└── strings-loader.js
```

**Loader Klasi:**
```javascript
class StringsLoader {
  // Skilgreint í /i18n/strings-loader.js
}
export const R = { ... }; // Object með lazy loading
```

**Notkun í kóða:**
```javascript
// Import
import { R } from '/i18n/strings-loader.js';

// Hleðsla
await R.load('is');

// Nota streng
const title = R.string.login_title;
const error = R.format(R.string.error_authentication, errorMsg);
```

**Dæmi um strengi:**
- `login_title` - "Innskráning"
- `dashboard_title` - "Yfirlit"
- `voting_title` - "Atkvæðagreiðsla"
- `profile_edit_button` - "Breyta prófíl"

**Skrár sem nota þetta:**
- `/js/**/*.js` - Allt JavaScript í members-portal
- `/members-area/**/*.js` - Félagasvæði kóði
- `/ui/**/*.js` - Almennar UI components

---

### 2. Admin Portal - `adminStrings.get()`

**Tilgangur:** Almenn admin stjórnunarborð (sync, members, events)

**Staðsetning:**
```
/apps/members-portal/admin/
├── i18n/
│   └── values-is/
│       └── strings.xml (210 strengir)
└── js/
    └── i18n/
        └── admin-strings-loader.js
```

**Loader Klasi:**
```javascript
class AdminStringsLoader {
  // Skilgreint í /admin/js/i18n/admin-strings-loader.js
}
export const adminStrings = new AdminStringsLoader();
```

**Notkun í kóða:**
```javascript
// Import
import { adminStrings } from './i18n/admin-strings-loader.js';

// Hleðsla
await adminStrings.load();

// Nota streng
const title = adminStrings.get('sync_members_title');
const error = adminStrings.get('error_unauthorized_admin');
const formatted = adminStrings.get('sync_status_success').replace('%s', count);
```

**Dæmi um strengi:**
- `sync_members_title` - "Samstilla Félaga"
- `sync_status_success` - "Samstilling tókst"
- `error_unauthorized_admin` - "Þú hefur ekki admin réttindi"
- `history_table_date` - "Dagsetning"

**Skrár sem nota þetta:**
- `/admin/js/admin.js` - Admin dashboard
- `/admin/js/sync-queue.js` - Sync kerfið
- `/admin/js/sync-history.js` - Sync history
- `/admin/js/**/*.js` - Allur admin kóði (nema elections)

**Athugasemd:** Sumar admin skrár nota **bæði** `adminStrings` OG global `R.string`:
```javascript
import { adminStrings } from './i18n/admin-strings-loader.js';
import { R } from '../../i18n/strings-loader.js';

// adminStrings fyrir admin-specific texta
const adminTitle = adminStrings.get('sync_members_title');

// R.string fyrir sameiginlega texta (t.d. role badges)
const roleText = R.string.role_superadmin;
```

---

### 3. Admin Elections - `R.string` (Aðskilið)

**Tilgangur:** Kosningastjórnun (list, create, edit, control, results)

**Staðsetning:**
```
/apps/members-portal/admin-elections/
├── i18n/
│   ├── values-is/
│   │   └── strings.xml (177 strengir)
│   └── strings-loader.js
└── js/
    ├── elections-list.js
    ├── election-create.js
    └── election-control.js
```

**Loader Klasi:**
```javascript
class AdminElectionsStringsLoader {
  // Skilgreint í /admin-elections/i18n/strings-loader.js
}
export const R = new AdminElectionsStringsLoader();
```

**Notkun í kóða:**
```javascript
// Import (relative path!)
import { R } from '../i18n/strings-loader.js';

// Hleðsla
await R.load('is');

// Nota streng
const title = R.string.admin_elections_title;
const label = R.string.create_step_basic_title;
const error = R.format(R.string.error_load_elections, errorMsg);
```

**Dæmi um strengi:**
- `admin_elections_brand` - "Kosningar"
- `nav_elections_list` - "Yfirlit Kosninga"
- `create_step_basic_title` - "Grunnupplýsingar"
- `filter_status_active` - "Virkar"
- `btn_create_election` - "Stofna Nýja Kosningu"

**Skrár sem nota þetta:**
- `/admin-elections/js/elections-list.js`
- `/admin-elections/js/election-create.js`
- `/admin-elections/js/election-control.js`
- `/admin-elections/js/**/*.js` - Allur election admin kóði

---

## 🔍 Samanburður Kerfa

| Eiginleiki | Members Portal | Admin Portal | Admin Elections |
|-----------|----------------|--------------|-----------------|
| **Variable** | `R.string` | `adminStrings` | `R.string` |
| **Klasanafn** | `StringsLoader` | `AdminStringsLoader` | `AdminElectionsStringsLoader` |
| **XML Path** | `/i18n/values-is/strings.xml` | `/admin/i18n/values-is/strings.xml` | `/admin-elections/i18n/values-is/strings.xml` |
| **JS Path** | `/i18n/strings-loader.js` | `/admin/js/i18n/admin-strings-loader.js` | `/admin-elections/i18n/strings-loader.js` |
| **Strengir** | 445 | 210 | 177 |
| **Usage %** | 51.0% | 66.2% | 88.1% |
| **API** | `R.string.key`, `R.format()` | `adminStrings.get(key)` | `R.string.key`, `R.format()` |
| **Import** | `/i18n/strings-loader.js` | `./i18n/admin-strings-loader.js` | `../i18n/strings-loader.js` |
| **Svæði** | Félagasvæði | Admin almenn | Admin elections |

## 🎯 Hvenær á að nota hvert kerfi?

### Nota Members Portal `R.string` fyrir:
- ✅ Login/logout texta
- ✅ Dashboard texta
- ✅ Profile/settings texta
- ✅ Atkvæðagreiðslu í félagasvæði
- ✅ Role badges (notað víða)
- ✅ Almennar villuskilaboð
- ✅ Navigation í félagasvæði
- ✅ UI components sem eru deilt

### Nota Admin Portal `adminStrings` fyrir:
- ✅ Sync management texta
- ✅ Admin dashboard texta
- ✅ Member management í admin
- ✅ Event management í admin
- ✅ Admin-specific villuskilaboð
- ✅ Sync history/queue texta
- ✅ Developer tools texta

### Nota Admin Elections `R.string` fyrir:
- ✅ Election list texta
- ✅ Election creation wizard
- ✅ Election control/monitoring
- ✅ Election results display
- ✅ Election filters/search
- ✅ Election-specific validation
- ✅ Election status texta

## 🚨 Algengar Villur

### ❌ Villa 1: Röng R.string breyta

**Vandamál:**
```javascript
// Í /admin-elections/js/elections-list.js
import { R } from '../../i18n/strings-loader.js'; // ❌ RANGT!

const title = R.string.admin_elections_title; // undefined!
```

**Lausn:**
```javascript
// Í /admin-elections/js/elections-list.js
import { R } from '../i18n/strings-loader.js'; // ✅ RÉTT!

const title = R.string.admin_elections_title; // ✅ Virkar!
```

### ❌ Villa 2: Nota adminStrings í elections

**Vandamál:**
```javascript
// Í /admin-elections/js/election-create.js
import { adminStrings } from '../../admin/js/i18n/admin-strings-loader.js'; // ❌ RANGT!

const title = adminStrings.get('create_step_basic_title'); // undefined!
```

**Lausn:**
```javascript
// Í /admin-elections/js/election-create.js
import { R } from '../i18n/strings-loader.js'; // ✅ RÉTT!

const title = R.string.create_step_basic_title; // ✅ Virkar!
```

### ❌ Villa 3: Blanda saman API

**Vandamál:**
```javascript
// Members portal
const text = R.get('login_title'); // ❌ R hefur ekki .get() aðferð

// Admin elections
const text = R.format('error_load_elections'); // ❌ Vantar R.string
```

**Lausn:**
```javascript
// Members portal
const text = R.string.login_title; // ✅ Rétt API

// Admin elections
const text = R.format(R.string.error_load_elections, error); // ✅ Rétt API
```

## 📝 Validation

Validation script styður öll 3 kerfin:

```bash
python3 scripts/admin/validate-i18n-usage.py
```

**Output dæmi:**
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

## 🔄 Framtíðar Úrbætur

### Samræma API (Phase 7?)

Núverandi ósamræmi:
- Members/Elections: `R.string.key`
- Admin: `adminStrings.get(key)`

**Valkostur 1: Samræma á R.string**
```javascript
// Breyta admin í að nota R.string
import { R as adminR } from './i18n/admin-strings-loader.js';
const text = adminR.string.sync_members_title;
```

**Valkostur 2: Samræma á .get()**
```javascript
// Breyta öllum í að nota .get()
import { R } from '/i18n/strings-loader.js';
const text = R.get('login_title');
```

**Ákvörðun:** Bíða með þetta þar til:
1. Öll 3 kerfin virka vel
2. English translations tilbúnar
3. Getum gert breaking change með góðri skipulagningu

### English Translations

Bæta við stuðningi fyrir ensku í öllum 3 kerfum:
```
/i18n/values-en/strings.xml
/admin/i18n/values-en/strings.xml
/admin-elections/i18n/values-en/strings.xml
```

## 📚 Tengd Skjöl

- [ADMIN_ELECTIONS_I18N.md](./ADMIN_ELECTIONS_I18N.md) - Ítarleg skjölun um admin-elections i18n
- [ADMIN_ELECTIONS_NAVIGATION_DESIGN.md](./ADMIN_ELECTIONS_NAVIGATION_DESIGN.md) - Navigation hönnun
- Issue #203 - Admin Elections i18n refactoring
- Issue #202 - Admin Elections navigation simplification

## 🎓 Samantekt fyrir Developers

**Þumalputtaregla:**

1. **Ertu í `/apps/members-portal/js/` eða `/members-area/`?**
   → Nota `/i18n/strings-loader.js` → `R.string.key`

2. **Ertu í `/admin/js/` (en EKKI elections)?**
   → Nota `./i18n/admin-strings-loader.js` → `adminStrings.get(key)`
   → Gætir þurft `R.string` líka fyrir role badges

3. **Ertu í `/admin-elections/js/`?**
   → Nota `../i18n/strings-loader.js` → `R.string.key`

**Ef í vafa:**
- Skoðaðu aðrar skrár í sömu möppu
- Keyrðu validation: `python3 scripts/admin/validate-i18n-usage.py`
- Athugaðu hvort strengurinn sé í réttri XML skrá
