# Admin Elections Area

**Purpose**: Administrative interface for managing elections (Epic #192)  
**RBAC**: Requires `admin` or `superuser` role with `election-manager` or `superadmin` elections role  
**API**: Elections Service Admin API (`/api/admin/elections`)

---

## Overview

The Admin Elections area provides a complete interface for election administrators to:
- Create, edit, and delete elections
- Manage election lifecycle (draft → published → closed)
- Schedule elections for specific times
- Control election visibility (hide/unhide)
- View election results

## Pages

### 1. Elections List (`index.html`)
**URL**: `/admin-elections/`  
**Purpose**: Browse and manage all elections

**Features**:
- Filter by status (all, draft, published, closed, hidden)
- Search by title or description
- Mobile-responsive card layout
- CRUD actions (create, edit, delete, control)
- Permission-based button visibility

**RBAC**:
- `election-manager`: Can create, edit, and view elections
- `superadmin`: Full access including hard delete

---

### 2. Creation Wizard (`create.html`)
**URL**: `/admin-elections/create.html` (create) or `/admin-elections/create.html?id={UUID}` (edit)  
**Purpose**: Multi-step wizard for creating or editing elections

**Steps**:
1. **Basic Info** - Title, question, description
2. **Answer Options** - 2-10 answer choices (single/multi-choice)
3. **Schedule** - Start time (immediate or scheduled), duration
4. **Review** - Preview before saving

**Features**:
- Edit mode: Automatically loads existing election data when `?id=` parameter present
- Validation at each step
- Progress indicator (4 steps)
- Save as draft or publish immediately

**RBAC**:
- Requires `create-election` permission
- Only draft elections can be edited

---

### 3. Election Control (`election-control.html`)
**URL**: `/admin-elections/election-control.html?id={UUID}`  
**Purpose**: Control panel for managing election schedule and status

**Features**:
- Start election immediately
- Schedule election for specific time
- Close election manually
- Preview how members see the election
- Countdown timers for scheduled elections

**RBAC**:
- Requires `manage-election` permission

---

## Architecture

### Directory Structure

```
admin-elections/
├── README.md                    (this file)
├── index.html                   Elections list page
├── create.html                  Creation wizard
├── election-control.html        Control panel
├── i18n/
│   ├── strings-loader.js        XML-based i18n loader (R.string pattern)
│   └── values-is/
│       └── admin-elections-strings.xml  178 Icelandic strings
├── js/
│   ├── elections-list.js        List rendering, filters, CRUD (864 lines)
│   ├── elections-list-i18n.js   i18n initialization for list
│   ├── election-create.js       Wizard logic, validation (867 lines)
│   ├── election-create-i18n.js  i18n initialization for wizard
│   ├── election-control.js      Control panel logic (163 lines)
│   ├── debug-logger.js          Debug logging utility
│   └── api/
│       └── elections-admin-mock.js  Mock API for development
└── styles/
    ├── admin-elections.css      Main styles (BEM methodology)
    └── election-wizard.css      Wizard-specific styles
```

### Key Technologies

- **JavaScript**: ES6+ modules, async/await, no jQuery
- **CSS**: BEM methodology with CSS variables
- **i18n**: XML-based (Android-style) with R.string pattern
- **RBAC**: Firebase custom claims with election roles
- **API**: Elections Service Admin API (Cloud Run)

---

## i18n System

**Separate from Members Portal**: Admin Elections has its own i18n system to avoid conflicts.

**Strings**: 178 Icelandic strings in `i18n/values-is/admin-elections-strings.xml`

**Usage**:
```javascript
import { R } from '../i18n/strings-loader.js';

await R.load('is'); // Load Icelandic strings
document.title = R.string.page_title; // Use strings
```

**Categories**:
- Navigation (10 strings)
- Buttons (20 strings)
- Form labels (30 strings)
- Status badges (8 strings)
- Error messages (20 strings)
- Validation (15 strings)

---

## RBAC Integration

### Election Roles

**Mapped from Firebase custom claims**:
- `admin` or `superuser` → Required for access
- `election-manager` → Can create, edit, view elections
- `superadmin` → Full access including hard delete

### Permission Checks

**Frontend**:
```javascript
import { requireAdmin, hasPermission, PERMISSIONS } from '../../js/rbac.js';

// Check admin access
await requireAdmin();

// Check specific permission
const canDelete = await hasPermission(PERMISSIONS.DELETE_ELECTION);
```

**Backend**: Elections Service validates Firebase tokens and checks roles

---

## API Endpoints

**Base URL**: `https://elections-service-ymzrguoifa-nw.a.run.app/api/admin/elections`

**All endpoints require Firebase ID token** in `Authorization: Bearer {token}` header.

### Endpoints

| Method | Endpoint | Permission | Purpose |
|--------|----------|------------|---------|
| GET | `/` | view | List elections with filters |
| POST | `/` | create | Create new election (draft) |
| GET | `/:id` | view | Get single election |
| PATCH | `/:id` | edit | Update election (draft only) |
| POST | `/:id/open` | manage | Publish election |
| POST | `/:id/close` | manage | Close voting |
| POST | `/:id/hide` | manage | Soft delete (hide) |
| POST | `/:id/unhide` | manage | Restore hidden election |
| DELETE | `/:id` | superadmin | Hard delete (permanent) |
| GET | `/:id/results` | view | Get results (closed only) |

---

## State Management

### elections-list.js

```javascript
let elections = [];           // All elections from API
let filteredElections = [];   // After filters applied
let currentFilter = 'all';    // Active filter
let searchQuery = '';         // Search input
let currentUserRole = null;   // Election role (manager/superadmin)

// Cached permission checks (computed once, reused)
let userPermissions = {
  canDelete: false,
  canEdit: false,
  canManage: false
};
```

### election-create.js

```javascript
let currentStep = 1;          // Wizard step (1-4)
let isEditMode = false;       // Create vs Edit
let editingElectionId = null; // UUID when editing

const formData = {
  title: '',
  question: '',
  description: '',
  voting_type: 'single-choice',
  max_selections: null,
  answers: [],
  start_timing: 'immediate',
  scheduled_start: null,
  duration_minutes: 60,
  scheduled_end: null
};
```

---

## Mobile Responsive

**Breakpoints**:
- Desktop: `> 768px` - Table layout
- Mobile: `≤ 768px` - Card layout

**Recent Improvements** (Nov 16, 2025):
- Card-based layout for mobile
- Touch-friendly buttons
- Optimized spacing

---

## Accessibility

**Features**:
- ✅ Skip links (keyboard navigation)
- ✅ ARIA labels on interactive elements
- ✅ Screen reader support (`.u-sr-only` utility)
- ✅ Semantic HTML (`<nav>`, `<main>`, `<article>`)
- ✅ Focus states on all interactive elements

**WCAG Compliance**: AA level (4.5:1 contrast ratio)

---

## Recent Changes

**Nov 16, 2025**:
- ✅ Fixed edit mode form population (element ID bug)
- ✅ Added ARIA labels to filters and search
- ✅ Added skip links for accessibility
- ✅ Added JSDoc comments to key functions
- ✅ Replaced inline styles with utility classes
- ✅ Fixed aria-pressed state management on filter buttons

**Nov 9, 2025**:
- ✅ Deployed Admin API (10 endpoints with RBAC)
- ✅ Created elections-list.js (864 lines)
- ✅ Created election-create.js (867 lines)
- ✅ Implemented i18n system (178 strings)

---

## Development

### Running Locally

1. **Authenticate with Firebase**:
```bash
firebase login
```

2. **Start Firebase emulators** (optional):
```bash
cd /home/gudro/Development/projects/ekklesia
firebase emulators:start --only hosting
```

3. **Open in browser**:
- `http://localhost:5000/admin-elections/` (if using emulators)
- `https://ekklesia-prod-10-2025.web.app/admin-elections/` (production)

### Testing

**Manual Testing Checklist**:
- [ ] Filter elections by status
- [ ] Search elections by title
- [ ] Create new election (wizard)
- [ ] Edit draft election
- [ ] Delete election (soft delete)
- [ ] Publish election
- [ ] Close election
- [ ] View results

**Automated Tests**: Not yet implemented (see audit recommendations)

---

## Known Issues & Limitations

**Current Limitations**:
- No automated tests (manual testing only)
- Edit mode only supports draft elections
- No bulk operations (delete multiple elections)
- No election templates
- No vote revocation

**Future Enhancements** (Low Priority):
- Add English translations (`values-en/`)
- Add automated tests (Jest)
- Add bulk operations
- Add election templates
- Add vote history/audit log viewer

---

## Related Documentation

- [Ekklesia Code Standards](../../../docs/CODE_STANDARDS_MAP.md)
- [Admin Elections Audit](../../../tmp/ADMIN_ELECTIONS_AUDIT_2025-11-16.md)
- [BEM Guide](../../../docs/standards/CSS_BEM_GUIDE.md)
- [i18n Guide](../../../docs/standards/I18N_GUIDE.md)
- [RBAC Implementation](../../../docs/development/guides/admin/ROLES_AND_PERMISSIONS.md)

---

## Support

**Issues**: File GitHub issue with label `admin-elections`  
**Questions**: Check documentation or ask in project chat

**Last Updated**: 2025-11-16  
**Status**: ✅ Production Ready (v1.0)
