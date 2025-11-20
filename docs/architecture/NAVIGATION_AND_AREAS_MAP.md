# Navigation & Areas Architecture Map

This document shows how the user experience (navigation flow) and area structure works in the Ekklesia system.

**Last Updated**: 2025-11-08 (commits 502eebc, db16764, 6266f77)

---

## 🗺️ Navigation Flow - User Journey

````markdown
# Navigation & Areas Architecture Map

This document shows how the user experience (navigation flow) and area structure works in the Ekklesia system.

**Last Updated**: 2025-11-08 (commits 502eebc, db16764, 6266f77)

---

## 🗺️ Navigation Flow - User Journey

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      🏠 MÍN SÍÐA / DASHBOARD                             │
│                    /members-area/dashboard.html                          │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Velkomin, [Nafn]                            🏷️ Badges:          │  │
│  │                                              ┌──────────────────┐  │  │
│  │  Hér eru þínar aðal upplýsingar             │ 👤 Félagsmaður   │  │  │
│  │                                              ├──────────────────┤  │  │
│  │                                              │ 👑 Stjórnandi    │  │  │
│  │                                              │   → /admin/      │  │  │
│  │                                              ├──────────────────┤  │  │
│  │                                              │ ⚙️ Kerfisstjóri  │  │  │
│  │                                              │   → /admin-      │  │  │
│  │                                              │     elections/   │  │  │
│  │                                              └──────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌────────────────────────── QUICK LINKS ──────────────────────────┐   │
│  │                                                                   │   │
│  │  📋 Prófíll           📅 Viðburðir         🗳️ Kosningar          │   │
│  │  → /members-area/    → /members-area/     → /members-area/      │   │
│  │    profile.html        events.html          elections.html      │   │
│  │                                                                   │   │
│  │  📝 Stefnumótun                                                  │   │
│  │  → /policy-session/                                              │   │
│  │                                                                   │   │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
           │                    │                    │               │
           │                    │                    │               │
           ▼                    ▼                    ▼               ▼
```

---

## 🏢 Area Structure

---

## 🏢 Area Structure

### 1️⃣ **Members Area** - General Members
```
/members-area/
├── dashboard.html          ← 🏠 MAIN HUB (Home base)
├── profile.html            ← Personal information
├── events.html             ← Events and meetings
└── elections.html          ← List of elections (gateway)
```

**Purpose**: Main area for general members
**Navigation**: All navigation returns to `dashboard.html`

---

### 2️⃣ **Elections Area** - Elections (Member-facing)
```
/members-area/
└── elections.html          ← List of elections with tabs:
    │
    ├─ Tab: Allar kosningar      (All elections)
    ├─ Tab: Stefnumótun         (Policy Sessions)
    └─ Tab: Framboð             (Candidate Elections)
```

**Navigation Flow:**
```
Dashboard → elections.html → Select election → Election page
                                              │
                                              ▼
                      ┌─────────────────────────────────┐
                      │  Back link: "Til baka á        │
                      │  Mína síðu" → dashboard.html   │
                      └─────────────────────────────────┘
```

---

### 3️⃣ **Policy Session Area** - Policy Formation Meetingsetings
```
/policy-session/
├── index.html                              ← Main page (session view)
├── i18n/
│   ├── values-is/strings.xml              ← Icelandic strings
│   └── strings-loader.js                  ← i18n loader
├── js/
│   ├── policy-session.js                  ← Main logic
│   ├── amendment-form.js                  ← Amendment submission
│   ├── amendment-vote-card.js             ← Vote on amendments
│   ├── policy-item-vote-card.js           ← Vote on policy items
│   ├── policy-results-display.js          ← Results display
│   └── api/
│       └── policy-session-api-mock.js     ← Self-contained mock API
└── styles/
    ├── policy-session.css                 ← Main styles
    ├── amendment-form.css
    ├── amendment-vote-card.css
    ├── policy-item-vote-card.css
    └── policy-results-display.css
```

**Key Features:**
- ✅ **Self-contained** (independent area)
- ✅ **Dedicated API mock** (not shared with others)
- ✅ **Own i18n strings** (dedicated translation strings)
- ✅ **Component-based** (reusable components)

**Navigation:**
```
Dashboard → /policy-session/ → (work in session)
                                      │
                                      ▼
                        Back link: "Til baka á Mína síðu"
                                → dashboard.html
```

**Mobile Navigation:**
```
Hamburger menu shows:
┌──────────────────────┐
│ Tabs (mobile only):  │
│ • Allar kosningar    │
│ • Stefnumótun ✓      │ ← Active
│ • Framboð            │
├──────────────────────┤
│ Links:               │
│ • Mín síða           │
│ • Prófíll            │
│ • Viðburðir          │
│ • Kosningar          │
│ • Útskrá             │
└──────────────────────┘
```

---

### 4️⃣ **Admin Area** - Member Registry (Member Management)
```
/admin/
└── members.html                ← Manage member registry (CRUD)
```

**Access:**
- Badge on dashboard: "👑 Stjórnandi"
- Requires `admin` roles
- Independent of election management

---

### 5️⃣ **Admin Elections Area** - Election Managementent
```
/admin-elections/
├── index.html                              ← Elections list
├── create-election.html                    ← Wizard: Create election
├── election-detail.html                    ← Single election CRUD
├── js/
│   ├── elections-list.js
│   ├── create-election-wizard.js
│   ├── election-detail.js
│   └── api/
│       ├── elections-api.js                ← API abstraction
│       └── elections-admin-mock.js         ← Admin-specific mock
└── i18n/
    └── values-is/strings.xml               ← Dedicated i18n
```

**Key Features:**
- ✅ **Separate from member elections** (separated from user elections)
- ✅ **Admin-specific mock** (`elections-admin-mock.js`)
- ✅ **CRUD operations** (Create, Read, Update, Delete)
- ✅ **Own i18n namespace**

**Access:**
- Badge on dashboard: "⚙️ Kerfisstjóri"
- Requires `superuser` role
- Dedicated admin interface

---

## 🔄 API Structure

### Before Refactor (Old):
```
apps/members-portal/js/api/
└── elections-mock.js           ← One mock for everything (confused)
```

**Problems:**
- Mixed admin and member mock
- Difficult to maintain
- Unclear ownership

---

### After Refactor (New):
```
apps/members-portal/
├── admin-elections/js/api/
│   └── elections-admin-mock.js     ← Admin elections (superuser)
│
└── policy-session/js/api/
    └── policy-session-api-mock.js  ← Policy sessions (members)
```

**Benefits:**
- ✅ **Clear separation** - Each area has its own API
- ✅ **Self-contained** - All functionality in one area
- ✅ **Better naming** - Descriptive file names
- ✅ **Easier maintenance** - Changes don't affect other areas

**Import examples:**
```javascript
// Admin elections area
import { ElectionsAPI } from '../api/elections-admin-mock.js';

// Policy session area
import { PolicySessionAPI } from '../api/policy-session-api-mock.js';
```

---

## 🧭 Navigation Patterns

### Pattern 1: Hub & Spoke (Hub = Dashboard)

```
              🏠 DASHBOARD (Hub)
                    │
        ┌───────────┼───────────┬───────────┐
        │           │           │           │
        ▼           ▼           ▼           ▼
    Profile     Events     Elections   Policy Sessions
        │           │           │           │
        └───────────┴───────────┴───────────┘
                    │
                    ▼
              Back to Dashboard
```

**Rule**: All "back" navigation returns to **Dashboard**, not to previous page

**Reason**:
- Dashboard is **central hub**
- User always knows where they are
- Avoids navigation deep into nested pages

---

### Pattern 2: Tabs for Categories

**Desktop:**
```
┌────────────────────────────────────────────────┐
│  Elections List                                │
│  ┌──────────────┬──────────────┬─────────────┐ │
│  │ Allar        │ Stefnumótun  │ Framboð     │ │
│  │ kosningar    │   (Active)   │             │ │
│  └──────────────┴──────────────┴─────────────┘ │
│                                                │
│  [Policy Session 1]                            │
│  [Policy Session 2]                            │
└────────────────────────────────────────────────┘
```

**Mobile:**
- Tabs hidden on election list page (too crowded)
- Tabs shown in **hamburger menu drawer** instead
- Better use of limited screen space

---

### Pattern 3: Role-Based Navigation (Badges)

```
Dashboard Role Badges:
┌────────────────────────────────────┐
│  Velkomin, Guðröður                │
│                                    │
│  Badges:                           │
│  ┌──────────────┐                  │
│  │ 👤 Félagsm.  │  (All users)     │
│  ├──────────────┤                  │
│  │ 👑 Stjórnandi│  → /admin/       │
│  │              │  (member CRUD)   │
│  ├──────────────┤                  │
│  │ ⚙️ Kerfisstj.│  → /admin-       │
│  │              │    elections/    │
│  │              │  (election CRUD) │
│  └──────────────┘                  │
└────────────────────────────────────┘
```

**Rule**:
- Only badges for roles the user has
- Each badge links to its dedicated admin area
- Tooltip explains what each badge does

---

## 📱 Responsive Navigation

### Desktop:
```
┌──────────────────────────────────────────────────────────────┐
│  Navbar:  [🏠 Mín síða] [Prófíll] [Viðburðir] [Kosningar]   │
│                                              [Útskrá]        │
└──────────────────────────────────────────────────────────────┘
```

### Mobile:
```
┌──────────────────────────────────┐
│  Navbar: [☰ Menu]                │
└──────────────────────────────────┘

Drawer (when open):
┌──────────────────────────────────┐
│  [✕ Close]                       │
│                                  │
│  Sub-tabs (if applicable):      │
│  • Allar kosningar               │
│  • Stefnumótun ✓                 │
│  • Framboð                       │
│  ──────────────────────────────── │
│  Links:                          │
│  • 🏠 Mín síða                   │
│  • 👤 Prófíll                    │
│  • 📅 Viðburðir                  │
│  • 🗳️ Kosningar                  │
│  • 🚺 Útskrá                     │
└──────────────────────────────────┘
```

---

## 🏭 Architectural Benefits

### 1. Clear Separation of Concerns
```
Admin Elections      Policy Sessions      Member Elections
     Area                 Area                 Area
      │                    │                     │
      ├─ Own mock API      ├─ Own mock API      ├─ Shares admin mock
      ├─ Own i18n          ├─ Own i18n          │   (for now)
      ├─ Own styles        ├─ Own styles        │
      └─ Own components    └─ Own components    └─ Basic view
```

### 2. Self-Contained Areas
Each area has:
- ✅ Own directory structure
- ✅ Own API mock
- ✅ Own i18n strings
- ✅ Own styles
- ✅ Own components

**Benefit**: Changes to one area don't affect others

### 3. Scalability
Easy to add new areas:
```

---

## 🏗️ Architectural Benefits

### 1. Clear Separation of Concerns
```
Admin Elections      Policy Sessions      Member Elections
     Area                 Area                 Area
      │                    │                     │
      ├─ Own mock API      ├─ Own mock API      ├─ Shares admin mock
      ├─ Own i18n          ├─ Own i18n          │   (for now)
      ├─ Own styles        ├─ Own styles        │
      └─ Own components    └─ Own components    └─ Basic view
```

### 2. Self-Contained Areas
Hver svæði hefur:
- ✅ Own directory structure
- ✅ Own API mock
- ✅ Own i18n strings
- ✅ Own styles
- ✅ Own components

**Kostur**: Breytingar á einu svæði hafa ekki áhrif á önnur

### 3. Scalability
Easy to add new areas:
```
Future areas:
├── /working-groups/          ← Working groups area
├── /policy-proposals/        ← Policy proposal system
└── /member-communications/   ← Internal messaging
```

Each area follows the same pattern:
- Dedicated directory
- Own mock API
- Own i18n
- Own components
- Back link to dashboard

---

## 🎯 Navigation Rules Summary

1. **Hub & Spoke**: Dashboard is central hub, all navigation returns there
2. **Role-based access**: Badges on dashboard for admin areas
3. **Area isolation**: Each area is independent (self-contained)
4. **Responsive**: Different patterns for desktop vs mobile
5. **Tab categories**: Tabs for categorizing content within areas
6. **Clear back links**: Always "Til baka á Mína síðu" → dashboard

---

## 🎯 Navigation Rules Summary

1. **Hub & Spoke**: Dashboard is central hub, all navigation returns there
2. **Role-based access**: Badges on dashboard for admin areas
3. **Area isolation**: Each area is independent (self-contained)
4. **Responsive**: Different patterns for desktop vs mobile
5. **Tab categories**: Tabs for categorizing content within areas
6. **Clear back links**: Always "Til baka á Mína síðu" → dashboard

---

## 📊 User Flow Examples

### Example 1: Member votes on policy session
```
1. Login → Dashboard
2. Click "Stefnumótun" quick link → /policy-session/
3. View policy, submit amendment, vote
4. Click "Til baka á Mína síðu" → Dashboard
```

### Example 2: Admin manages elections
```
1. Login → Dashboard
2. Click "⚙️ Kerfisstjóri" badge → /admin-elections/
3. Create/edit election
4. Browser back or manual navigation → Dashboard
```

### Example 3: Admin manages members
```
1. Login → Dashboard
2. Click "👑 Stjórnandi" badge → /admin/members.html
3. CRUD operations on member data
4. Browser back or manual navigation → Dashboard
```

---

## 🔄 Migration from Old to New

### Old Structure (Before refactor):
```
❌ Mixed concerns:
   - elections-mock.js served both admin and member
   - No clear area boundaries
   - Hard to maintain

❌ Poor naming:
   - "elections-mock.js" - which elections?
   - Not descriptive

❌ Tight coupling:
   - Changes affected multiple areas
```

### New Structure (After refactor):
```
✅ Clear separation:
   - elections-admin-mock.js for admin
   - policy-session-api-mock.js for policy
   - Each area independent

✅ Descriptive naming:
   - File names indicate purpose
   - Clear ownership

✅ Loose coupling:
   - Areas can change independently
   - Easier to test and maintain
```

---

## 📚 Related Documentation

- API Reference: `/docs/integration/API_REFERENCE.md`
- Component Guide: `/docs/development/COMPONENT_ARCHITECTURE.md`
- i18n System: `/docs/development/guides/I18N_ARCHITECTURE.md`

---

**Commits:**
- `502eebc` - Separate admin role badges to distinct dashboards
- `db16764` - Add election type tabs to mobile navigation drawer
- `6266f77` - Reorganize API structure with area-specific mocks
- `59150d7` - Add navigation tabs for election types

**Related Issues:**
- #216 - Epic: Create Dedicated Member-Facing Elections Area
- #215 - Policy Amendment Voting System
- #186 - Epic: Member Voting Experience
