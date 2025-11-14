# Shared JavaScript Components

**Location**: `/js/components/` and `/js/`
**Purpose**: Reusable UI components shared between member portal and admin portal
**Updated**: 2025-11-13
**Audit**: Epic #186 Component Reusability Review

---

## Overview

This directory contains shared JavaScript components that provide consistent UI patterns across the entire Ekklesia application. These components are safe to use in both member and admin portals because **all security is enforced on the backend** (Firebase Security Rules, Cloud Functions).

**Component Quality Metrics** (from Nov 2025 audit):
- **Total Components**: 18 identified
- **Documented**: 4 (22%)
- **Gold Standard**: 1 (nav.js - 100% adoption across 15 pages)
- **Needs Improvement**: 17 (94%)
- **Estimated Value**: ~375 lines saved, ~10-15% reduction in code duplication

---

## Component Status Overview

| Component | Adoption | Quality | Priority | Status |
|-----------|----------|---------|----------|--------|
| nav.js | 100% (15/15 pages) | ⭐⭐⭐⭐⭐ GOLD STANDARD | Critical | ✅ Complete |
| toast.js | 27% (4/15 pages) | ⭐⭐⭐⭐ Good | High | ⚠️ Needs adoption |
| modal.js | 27% (4/15 pages) | ⭐⭐⭐ Decent | High | ⚠️ Missing i18n |
| status.js | 7% (1/15 pages) | ⭐⭐⭐ Decent | Medium | ⚠️ Needs adoption |
| button.js | 0% (0/15 pages) | ⭐⭐ Basic | Low | ⚠️ Not used yet |
| searchable-select.js | 100% (1/1 forms) | ⭐⭐⭐⭐ Good | Medium | ✅ Complete |
| form-validator.js | 10% (1/10 forms) | ⭐⭐ Basic | High | ⚠️ Needs adoption |
| api.js | 33% (2/6 API uses) | ⭐⭐⭐ Decent | Medium | ⚠️ Needs adoption |

---

## Components

### ⭐ nav.js - Navigation System (GOLD STANDARD)

**THE GOLD STANDARD** for component quality and adoption across the Ekklesia application.

**File**: `/js/nav.js` (215 lines)
**CSS**: `/styles/components/nav.css` (450+ lines)
**Adoption**: 100% (15/15 authenticated pages)
**Quality**: ⭐⭐⭐⭐⭐

**Why This is the Gold Standard**:
1. ✅ **100% Adoption** - Used consistently across all 15 authenticated pages
2. ✅ **Zero Duplication** - Single source of truth for navigation logic
3. ✅ **Comprehensive Features** - Focus trap, keyboard navigation, ARIA labels
4. ✅ **Memory Safe** - Proper cleanup prevents memory leaks
5. ✅ **Mobile Optimized** - Perfect hamburger menu with smooth animations
6. ✅ **Accessible** - Full keyboard and screen reader support
7. ✅ **Well Documented** - Clear JSDoc comments
8. ✅ **Battle Tested** - Used in production across entire application

**Usage**:
```javascript
import { initNavigation } from '../js/nav.js';

// Initialize navigation with hamburger menu
initNavigation();

// That's it! No configuration needed.
// The function automatically finds and binds to standard nav elements.
```

**Features**:
- Hamburger menu with smooth open/close animations
- Focus trap (keeps tab key within menu when open)
- Escape key closes menu
- Click outside to close
- Overlay backdrop with blur
- Mobile responsive breakpoints
- ARIA attributes for accessibility
- Automatic cleanup on window resize
- Memory leak prevention

**HTML Structure** (standardized):
```html
<nav class="nav">
  <div class="nav__container">
    <a href="/" class="nav__brand">Ekklesia</a>

    <!-- Hamburger Button (mobile only) -->
    <button class="nav__hamburger" id="nav-hamburger" aria-expanded="false">
      <span class="nav__hamburger-line"></span>
      <span class="nav__hamburger-line"></span>
      <span class="nav__hamburger-line"></span>
    </button>

    <!-- Overlay for mobile menu -->
    <div class="nav__overlay" id="nav-overlay"></div>

    <!-- Navigation Drawer -->
    <div class="nav__drawer" id="nav-drawer" aria-hidden="true">
      <button class="nav__close" id="nav-close">
        <span class="nav__close-icon">✕</span>
      </button>

      <div class="nav__links">
        <a href="/dashboard" class="nav__link">Dashboard</a>
        <a href="/profile" class="nav__link">Profile</a>
        <a href="#" class="nav__link nav__link--logout">Logout</a>
      </div>
    </div>
  </div>
</nav>
```

**HTML Integration**:
```html
<link rel="stylesheet" href="/styles/components/nav.css">
```

**Lessons for Other Components**:
- Single responsibility: Does one thing (navigation) extremely well
- Zero configuration: Works out of the box with standard HTML
- Consistent structure: Same HTML across all pages
- Comprehensive features: Covers all edge cases (keyboard, mobile, accessibility)
- Proper cleanup: No memory leaks
- Clear documentation: Easy to understand and maintain

**Pages Using This** (15/15 = 100%):
- `/admin-elections/index.html`
- `/admin-elections/create.html`
- `/members-area/dashboard.html`
- `/members-area/profile.html`
- `/members-area/events.html`
- `/members-area/elections.html`
- `/policy-session/index.html`
- `/policy-session/submit.html`
- `/policy-session/votes.html`
- `/policy-session/results.html`
- ... and 5 more

---

### 🔔 toast.js - Notification System

Unified toast notification system for success, error, info, and warning messages.

**File**: `/js/components/toast.js` (140 lines)
**CSS**: `/styles/components/toast.css` (179 lines)

**Usage**:
```javascript
import { showToast, showSuccess, showError } from '../../js/components/toast.js';

// Basic notifications
showToast('Profile updated!', 'success');
showToast('Invalid input', 'error');
showToast('Processing...', 'info');
showToast('Please review', 'warning');

// Convenience methods
showSuccess('Saved successfully');
showError('Save failed');
showInfo('Loading data...');
showWarning('Unsaved changes');

// Custom duration
showToast('Custom message', 'info', { duration: 5000 });

// Non-dismissible (for critical messages)
showToast('Critical error', 'error', { dismissible: false });
```

**Features**:
- 4 variants: success (green), error (orange), info (blue), warning (yellow)
- Auto-dismiss after 3 seconds (customizable)
- Manual dismissal with × button
- Slide-in animation from bottom
- Mobile responsive
- Accessibility support (ARIA roles)

**HTML Integration**:
```html
<link rel="stylesheet" href="/styles/components/toast.css?v=20251105">
```

---

### ⏳ status.js - Status Feedback

Visual feedback for loading, success, and error states on UI elements.

**File**: `/js/components/status.js` (182 lines)

**Usage**:
```javascript
import { showStatus, createStatusIcon, toggleButtonLoading } from '../../js/components/status.js';

// Create status icon for form field
const statusIcon = createStatusIcon({ baseClass: 'form-field__status' });
inputContainer.appendChild(statusIcon);

// Show loading spinner
showStatus(statusIcon, 'loading', { baseClass: 'form-field__status' });

// Show success checkmark (auto-clears after 2 seconds)
showStatus(statusIcon, 'success', { baseClass: 'form-field__status' });

// Show error X mark
showStatus(statusIcon, 'error', { baseClass: 'form-field__status' });

// Button loading state
const saveBtn = document.getElementById('btn-save');
toggleButtonLoading(saveBtn, true, { loadingText: 'Saving...' });
// ... perform async operation ...
toggleButtonLoading(saveBtn, false);
```

**Features**:
- Inline status indicators (loading, success, error)
- Auto-clear after customizable delay
- Button loading state management
- Configurable base CSS class
- Accessibility support (ARIA live regions)

**Use Cases**:
- Form field validation feedback
- Inline save indicators
- Button loading states
- Async operation feedback

---

### 🔘 button.js - Button Factory

Unified button creation system with consistent styling and behavior.

**File**: `/js/components/button.js` (262 lines)
**CSS**: `/styles/components/button.css` (123 lines)

**Usage**:
```javascript
import { createButton, createOutlineButton } from '../../js/components/button.js';

// Primary button with click handler
const saveButton = createButton({
  text: 'Save Changes',
  variant: 'primary',
  onClick: () => saveData()
});
container.appendChild(saveButton.element);

// Outline button with loading state
const verifyButton = createButton({
  text: 'Verify Membership',
  variant: 'outline',
  onClick: async () => {
    verifyButton.setLoading(true, 'Verifying...');
    await verifyMembership();
    verifyButton.setLoading(false);
  }
});

// Convenience functions
const primaryBtn = createPrimaryButton({ text: 'Primary' });
const secondaryBtn = createSecondaryButton({ text: 'Secondary' });
const outlineBtn = createOutlineButton({ text: 'Outline' });
const dangerBtn = createDangerButton({ text: 'Delete' });

// Small danger button
const deleteBtn = createButton({
  text: 'Delete',
  variant: 'danger',
  size: 'small'
});

// Button API methods
saveButton.disable();
saveButton.enable();
saveButton.setText('Updated Text');
saveButton.destroy();  // Cleanup when removing
```

**Features**:
- 4 variants: primary (red), secondary (light red), outline (white bg + red border), danger (dark red)
- 3 sizes: small, medium, large
- Built-in loading state management
- Automatic event listener cleanup
- BEM class structure
- Type-safe button types (button, submit, reset)

**Variants**:
| Variant | Background | Text | Border | Use Case |
|---------|------------|------|--------|----------|
| `primary` | Red | White | None | Main actions (default) |
| `secondary` | Light Red | White | None | Secondary actions |
| `outline` | White | Red | Red 2px | Tertiary actions |
| `danger` | Dark Red | White | None | Destructive actions |

**HTML Integration**:
```html
<link rel="stylesheet" href="/styles/components/button.css">
```

**Migration from Hardcoded HTML**:
```html
<!-- Before: Hardcoded HTML button -->
<button class="btn btn--outline" id="verify-btn">Loading...</button>
```
```javascript
// Before: Update text later
setTextContent('verify-btn', R.string.btn_verify);
```
```javascript
// After: Create button with JS
const verifyBtn = createButton({
  text: R.string.btn_verify,
  variant: 'outline'
});
container.appendChild(verifyBtn.element);
```

---

### 💬 modal.js - Dialog System

Unified modal/dialog system for confirmations, forms, and alerts.

**File**: `/js/components/modal.js` (315 lines)
**CSS**: `/styles/components/modal.css` (240 lines)

**Usage**:
```javascript
import { showModal, showConfirm, showAlert } from '../../js/components/modal.js';

// Confirmation dialog
const confirmed = await showConfirm(
  'Delete member?',
  'This action cannot be undone',
  { confirmStyle: 'danger', confirmText: 'Delete' }
);
if (confirmed) {
  deleteMember();
}

// Alert dialog
await showAlert('Success', 'Member saved successfully');

// Custom modal
const modal = showModal({
  title: 'Edit Member',
  content: '<form>...</form>',
  size: 'lg',
  buttons: [
    { text: 'Save', onClick: () => { save(); modal.close(); }, primary: true },
    { text: 'Cancel', onClick: () => modal.close() }
  ]
});
```

**Features**:
- Confirmation dialogs (async/await pattern)
- Alert dialogs
- Custom content modals
- Multiple sizes (sm, md, lg, xl)
- Keyboard support (ESC to close)
- Click outside to close
- Backdrop blur effect
- Mobile responsive
- Accessibility (ARIA, focus trap)

**HTML Integration**:
```html
<link rel="stylesheet" href="/styles/components/modal.css?v=20251105">
```

---

### 🔍 searchable-select.js - Searchable Dropdown

Accessible searchable dropdown component for country selection and large option lists.

**File**: `/policy-session/js/searchable-select.js` (450+ lines)
**CSS**: Inline styles in component
**Adoption**: 100% (1/1 country selection forms)
**Quality**: ⭐⭐⭐⭐ Good
**Documentation**: See `/docs/features/SEARCHABLE_SELECT_COMPONENT.md`

**Usage**:
```javascript
import { createSearchableSelect } from './js/searchable-select.js';

const countrySelect = createSearchableSelect({
  targetElement: document.getElementById('country-select'),
  options: countries.map(c => ({ value: c.code, label: c.name })),
  placeholder: 'Select country',
  searchPlaceholder: 'Search countries...',
  onChange: (value) => console.log('Selected:', value)
});
```

**Features**:
- Full keyboard navigation (arrow keys, enter, escape)
- Search filtering with instant results
- Mobile responsive
- ARIA accessibility
- Custom styling support
- Option grouping
- Multi-select mode (optional)

**TODO**:
- [ ] Move from `/policy-session/js/` to `/js/components/`
- [ ] Extract CSS to separate file
- [ ] Add i18n support
- [ ] Adopt in admin member edit form (country selection)

---

### ✅ form-validator.js - Form Validation

Client-side form validation with consistent error messaging.

**File**: `/js/utils/form-validator.js` (estimated)
**Adoption**: 10% (1/10 forms)
**Quality**: ⭐⭐ Basic
**Priority**: HIGH - Huge duplication opportunity

**Current State**: Most forms have inline validation logic duplicated across files.

**Opportunities**:
- Member edit form (kennitala, email, phone validation)
- Policy submission form (title, content validation)
- Election creation form (dates, title validation)
- Login form (email validation)
- ... 6 more forms

**Estimated Savings**: ~200 lines of duplicated validation code

**TODO**:
- [ ] Create standardized form-validator.js component
- [ ] Add common validators (email, kennitala, phone, date)
- [ ] Add i18n error messages
- [ ] Migrate all 10 forms to use shared validator
- [ ] Add visual error feedback (status.js integration)

---

### 🌐 api.js - HTTP Client

Unified HTTP client for making API requests with authentication.

**File**: `/js/core/api.js` (215 lines)
**Adoption**: 33% (2/6 API integrations)
**Quality**: ⭐⭐⭐ Decent

**Usage**:
```javascript
import { ApiClient } from '../js/core/api.js';

const api = new ApiClient({
  baseUrl: 'https://api.ekklesia.is',
  getAuthToken: async () => {
    const user = auth.currentUser;
    return user ? await user.getIdToken() : null;
  }
});

// GET request
const members = await api.get('/api/members');

// POST request
const result = await api.post('/api/members', { name: 'Test' });

// PUT request
await api.put('/api/members/123', { name: 'Updated' });

// DELETE request
await api.delete('/api/members/123');
```

**Features**:
- Automatic authentication header injection
- JSON serialization/deserialization
- Error handling and retries
- Request/response logging
- TypeScript-ready (JSDoc types)

**Current Usage**:
- ✅ `/admin-elections/js/elections-list.js` - elections API
- ✅ `/admin-elections/js/election-create.js` - create election
- ❌ `/policy-session/js/` - Still uses raw fetch()
- ❌ `/members-area/profile.js` - Still uses raw fetch()
- ❌ 2 more files

**TODO**:
- [ ] Migrate remaining 4 API integrations to api.js
- [ ] Add request caching
- [ ] Add request cancellation
- [ ] Add retry logic with exponential backoff

---

### 📋 Other Utility Components

**debug.js** - Conditional logging based on URL params
- **File**: `/js/utils/debug.js`
- **Adoption**: ~90% of pages
- **Status**: ✅ Excellent adoption

**format.js** - Date/number/currency formatting
- **File**: `/js/utils/format.js`
- **Adoption**: Unknown
- **TODO**: Audit usage and opportunities

**countries.js** - Country data and utilities
- **File**: `/js/utils/countries.js`
- **Adoption**: 100% of country selection forms
- **Status**: ✅ Good

**strings-loader.js** - i18n string loading system
- **File**: `/i18n/strings-loader.js`
- **Adoption**: 100% of pages
- **Status**: ⚠️ 3 different initialization patterns (needs standardization)

---

## Security Model

### 🔐 Why Sharing JS is Safe

Sharing JavaScript between member and admin portals is **completely secure** because:

1. **Backend enforces all security** - Firebase Firestore rules and Cloud Functions validate every request
2. **Frontend is just UI** - JavaScript in browser cannot bypass server-side security
3. **Admin checks happen server-side** - Even if regular user calls admin function, Firebase rejects it

**Example**:
```javascript
// Even if a regular member calls this function in browser console,
// Firebase Security Rules will reject the request on the server
export async function checkAdminAccess() {
  const user = auth.currentUser;
  
  // 🔒 Firebase rules enforce this - regular users get permission denied
  const adminDoc = await db.collection('admins').doc(user.uid).get();
  return adminDoc.exists;
}
```

**What is NOT safe**:
- ❌ Storing secrets in JavaScript (API keys, tokens, passwords)
- ❌ Client-side authorization logic without server validation
- ❌ Trusting client-provided data without backend validation

**What IS safe**:
- ✅ Shared UI components (toast, status, forms)
- ✅ Shared utilities (formatting, validation, API helpers)
- ✅ Shared navigation (hamburger menu, tabs)

---

## File Organization

```
/js/
├── components/              # 🆕 Shared UI components (this directory)
│   ├── README.md            # This file
│   ├── toast.js             # Notification system (140 lines)
│   ├── status.js            # Status feedback (182 lines)
│   ├── button.js            # 🆕 Button factory (262 lines)
│   └── modal.js             # 🆕 Dialog system (315 lines)
│
├── core/                    # Core functionality
│   ├── api.js               # 🆕 HTTP client (215 lines)
│   ├── auth.js              # Firebase auth
│   └── nav.js               # Navigation
│
├── utils/                   # Utilities
│   ├── format.js            # Formatting/validation
│   ├── debug.js             # Conditional logging
│   └── countries.js         # Country data
│
├── members/                 # Member-specific code
│   ├── profile.js
│   └── dashboard.js
│
└── api/                     # API clients
    └── elections-api.js

/styles/components/
├── toast.css                # Toast notification styles (179 lines)
├── button.css               # Button styles (123 lines)
└── modal.css                # 🆕 Modal dialog styles (240 lines)
```

---

## Migration Guide

### Converting Inline Functions to Shared Components

**Before** (inline toast in profile.js):
```javascript
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `profile-toast profile-toast--${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('profile-toast--show'), 10);
  setTimeout(() => {
    toast.classList.remove('profile-toast--show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
```

**After** (shared component):
```javascript
import { showToast } from './components/toast.js';

showToast('Profile updated!', 'success');
```

**Benefits**:
- ~40 lines removed from profile.js
- Consistent behavior across app
- Single source of truth
- Easier to maintain and extend

---

## Code Savings

| Component | Files Using | Lines Saved Per File | Total Saved |
|-----------|-------------|----------------------|-------------|
| toast.js | profile.js, member-edit.js, (future admin pages) | ~40 lines | ~120 lines |
| status.js | profile.js, (future admin pages) | ~25 lines | ~75 lines |
| button.js | dashboard.html, elections.html, events.html, profile.html | ~10 lines | ~90 lines |
| modal.js | (replacing inline confirms) | ~30 lines | ~90 lines |
| **Total** | **Multiple files** | **~105 lines** | **~375 lines** |

**Additional Benefits**:
- Easier to add new features (e.g., toast stacking, custom icons)
- Consistent UX (same animations, timing, colors)
- Reduced testing surface (test once, works everywhere)

---

## Best Practices

### When to Create Shared Component

Create a shared component when:
1. **Code is duplicated** - Same logic appears in 2+ places
2. **UI pattern is common** - Used across multiple pages/portals
3. **Behavior should be consistent** - Same UX everywhere
4. **Logic is reusable** - Not tightly coupled to specific page

### When NOT to Create Shared Component

Keep code local when:
1. **Used in only one place** - No duplication
2. **Highly specialized** - Tightly coupled to specific feature
3. **Likely to change frequently** - Still under development
4. **Portal-specific business logic** - Admin-only operations

---

## 🔍 Component Reusability Audit (Epic #186, Nov 2025)

### Executive Summary

**Audit Scope**: 58 source files, 23 HTML pages, ~15,000 lines of code
**Time Invested**: 4 hours deep analysis
**Total Issues Found**: 47
**Estimated Fix Effort**: ~100 hours (2-3 months)

**Key Findings**:
1. ⭐ **Navigation is PERFECT** - nav.js is the gold standard (100% adoption)
2. ⚠️ **i18n is CRITICAL issue** - 3 different initialization patterns
3. ⚠️ **No form field components** - 10+ forms with inconsistent patterns
4. ⚠️ **Low modal adoption** - 11 files still use alert()/confirm()
5. ✅ **Toast/status have low adoption** - Only 4/15 pages use them
6. ❌ **7 BEM violations** - btn-primary instead of btn--primary (FIXED)

### Issue Breakdown by Category

| Category | Issues | Severity | Estimated Effort |
|----------|--------|----------|-----------------|
| **i18n Initialization** | 3 patterns | 🔴 CRITICAL | 10 hours |
| **Form Components** | 10 forms inconsistent | 🟠 HIGH | 40 hours |
| **Native Dialogs** | 11 files using alert/confirm | 🟠 HIGH | 8 hours |
| **Component Adoption** | Toast (11 pages), Status (14 pages) | 🟡 MEDIUM | 15 hours |
| **API Client** | 4 files using raw fetch | 🟡 MEDIUM | 6 hours |
| **BEM Violations** | 7 instances (btn-primary) | 🟢 LOW | 10 min (FIXED) |
| **Inline Styles** | 40+ instances | 🟢 LOW | 1 hour |
| **Duplicate Components** | 4 files in /policy-session/js/ | 🟢 LOW | 1 hour |

### Immediate Action Items (Quick Wins - 2-3 hours)

1. ✅ **Fix BEM violations** (10 minutes) - COMPLETED
   - Fixed 7 instances of btn-primary → btn--primary

2. ⏳ **Create Component README** (30 minutes) - IN PROGRESS
   - Document all 18 components
   - Show nav.js as gold standard
   - Provide usage examples

3. ⏳ **Delete duplicate components** (1 hour) - PENDING
   - Remove 4 duplicate files from /policy-session/js/

4. ⏳ **Replace inline styles** (1 hour) - PENDING
   - Replace 40+ `style="display: none"` with `.u-hidden` class

### Phase 1: Critical i18n Standardization (10 hours)

**Problem**: 3 different i18n initialization patterns causing confusion and duplication:

**Pattern 1** (Inline HTML - 95 lines in create.html):
```html
<script type="module">
  import R from '../i18n/strings-loader.js';
  await R.load('is');
  document.getElementById('page-title').textContent = R.string.page_title;
  document.getElementById('nav-brand').textContent = R.string.nav_brand;
  // ... 90 more lines
</script>
```

**Pattern 2** (JS Module - election-create.js):
```javascript
import R from '../../i18n/strings-loader.js';
await R.load('is');
// Initialize strings in module
```

**Pattern 3** (Hybrid - some pages):
```html
<!-- Load in HTML, use in both HTML and JS -->
```

**Solution**:
- Create `/js/utils/i18n-init.js` utility module
- Extract all inline i18n to JS modules
- Standardize on single pattern across all 15 pages

**Action Items**:
1. ⏳ Extract create.html i18n (3 hours)
2. ⏳ Create i18n utility module (1 hour)
3. ⏳ Standardize index.html (1 hour)
4. ⏳ Standardize dashboard.html (1 hour)
5. ⏳ Standardize remaining 12 pages (4 hours)

### Phase 2: Form Component Library (40 hours)

**Problem**: 10+ forms with duplicated field creation, validation, error handling

**Opportunities Identified**:
1. Member edit form - 15 fields with inline validation
2. Policy submission form - 8 fields
3. Election creation form - 12 fields
4. Login form - 2 fields
5. Registration form - 10 fields
6. Profile edit form - 8 fields
7. ... 4 more forms

**Components to Create**:
- `form-field.js` - Unified form field with label, input, error, status
- `form-validator.js` - Common validators (email, kennitala, phone, dates)
- `form-builder.js` - Declarative form building API

**Estimated Savings**: ~500 lines of duplicated code

### Phase 3: Modal Migration (8 hours)

**Problem**: 11 files still use native alert()/confirm() instead of modal.js component

**Files to Migrate**:
1. `/admin-elections/js/election-create.js` - 3 confirms, 2 alerts
2. `/admin-elections/js/elections-list.js` - 2 confirms
3. `/members-area/profile.js` - 1 confirm, 1 alert
4. `/policy-session/js/submit.js` - 2 confirms
5. ... 7 more files

**Additional Task**: Add i18n support to modal.js (currently hardcoded Icelandic)

**Action Items**:
1. ⏳ Add i18n strings to modal.js (2 hours)
2. ⏳ Migrate elections-list.js (1 hour)
3. ⏳ Migrate election-create.js (1 hour)
4. ⏳ Migrate profile.js (1 hour)
5. ⏳ Migrate remaining 8 files (3 hours)

### Phase 4: Component Adoption (15 hours)

**Increase adoption of existing underutilized components**:

**Toast.js** (27% → 80% adoption):
- ⏳ Add to remaining 11 pages that need notifications
- Estimated: 5 hours

**Status.js** (7% → 50% adoption):
- ⏳ Add to form fields across 10 forms
- Estimated: 5 hours

**Button.js** (0% → 30% adoption):
- ⏳ Replace hardcoded buttons in 5 forms
- Estimated: 5 hours

### Success Metrics

**After completing all phases, we expect**:
- ✅ 100% i18n pattern consistency (currently 0%)
- ✅ 80%+ component adoption (currently 27% avg)
- ✅ ~1,000 lines of code eliminated
- ✅ 50% faster feature development (reuse components)
- ✅ Zero BEM violations (currently FIXED)
- ✅ Zero native dialogs (currently 11 files)
- ✅ Consistent UX across all pages

---

## Testing

### Manual Testing Checklist

**Toast Component**:
- [ ] Success toast shows with green background
- [ ] Error toast shows with orange background
- [ ] Info toast shows with blue background
- [ ] Warning toast shows with yellow background
- [ ] Toast auto-dismisses after 3 seconds
- [ ] × button dismisses toast immediately
- [ ] Multiple toasts stack properly
- [ ] Mobile: Toast fits screen width

**Status Component**:
- [ ] Loading spinner shows and animates
- [ ] Success checkmark shows and auto-clears
- [ ] Error X mark shows and auto-clears
- [ ] Button loading state disables button
- [ ] Button text changes to "Saving..."
- [ ] Button restores original text after completion

**Button Component**:
- [ ] Primary button: Red background + white text
- [ ] Secondary button: Light red background + white text
- [ ] Outline button: White background + red text + red border
- [ ] Danger button: Dark red background + white text
- [ ] Small size renders correctly
- [ ] Large size renders correctly
- [ ] Loading state: disables button + changes text
- [ ] Loading state: restores original text after complete
- [ ] disable() / enable() methods work
- [ ] setText() updates button text
- [ ] onClick handler fires
- [ ] destroy() removes event listeners

**Modal Component**:
- [ ] Confirmation dialog shows with correct title/message
- [ ] Confirm button returns true on click
- [ ] Cancel button returns false on click
- [ ] ESC key closes modal
- [ ] Click outside closes modal (if enabled)
- [ ] Modal backdrop blurs background
- [ ] Mobile: Modal fits screen width
- [ ] Keyboard navigation works (tab through buttons)

---

## Related Documentation

- **JavaScript Guide**: [/docs/standards/JAVASCRIPT_GUIDE.md](/docs/standards/JAVASCRIPT_GUIDE.md) - See "Shared JavaScript Architecture" section
- **CSS BEM Guide**: [/docs/standards/CSS_BEM_GUIDE.md](/docs/standards/CSS_BEM_GUIDE.md)
- **Code Standards**: [/docs/CODE_STANDARDS_MAP.md](/docs/CODE_STANDARDS_MAP.md)

---

**Created**: 2025-11-05
**Maintained By**: Frontend team
**Questions**: See GitHub Issues or team documentation
