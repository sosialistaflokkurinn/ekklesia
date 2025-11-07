# Shared JavaScript Components

**Location**: `/js/components/`
**Purpose**: Reusable UI components shared between member portal and admin portal
**Updated**: 2025-11-05

---

## Overview

This directory contains shared JavaScript components that provide consistent UI patterns across the entire Ekklesia application. These components are safe to use in both member and admin portals because **all security is enforced on the backend** (Firebase Security Rules, Cloud Functions).

---

## Components

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
