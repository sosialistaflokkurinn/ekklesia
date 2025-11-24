# Ekklesia JavaScript Style Guide

**Last Updated**: 2025-11-04
**Status**: ✅ Active - ES6+ Standards
**Purpose**: JavaScript coding conventions, patterns, and best practices

---

## Overview

This guide defines JavaScript standards for the Ekklesia project. We use modern ES6+ JavaScript with modules, async/await, and strict JSDoc documentation.

### Core Principles

1. **Modern ES6+** - Use [const/let](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements), [arrow functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions), [destructuring](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment), [async/await](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function)
2. **Modular Code** - [Import/export](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) for reusability
3. **No jQuery** - Vanilla JavaScript only
4. **JSDoc Always** - All functions [documented](https://jsdoc.app/)
5. **Functional Where Possible** - Prefer pure functions, avoid side effects

---

## Variables & Constants

### const vs let vs var

Always use `const` by default, `let` when reassignment needed, **never** `var`:

✅ **Good**:
```javascript
const userName = 'Jón Jónsson';  // Won't change
let counter = 0;                 // Will increment

// const prevents reassignment
const user = { name: 'Jón' };
user.name = 'Sigga';  // ✅ OK: object mutation allowed
user = { name: 'Sigga' };  // ❌ Error: reassignment not allowed
```

❌ **Bad**:
```javascript
var userName = 'Jón Jónsson';  // Don't use var (function-scoped, hoisting issues)
```

**Why**:
- `const` prevents accidental reassignment
- `let` is block-scoped (predictable)
- `var` is function-scoped (confusing, avoid)

---

### Naming Conventions

```javascript
// Constants (UPPER_SNAKE_CASE for true constants)
const MAX_RETRY_COUNT = 3;
const API_BASE_URL = 'https://api.example.com';

// Variables and functions (camelCase)
const userName = 'Jón';
let phoneNumbers = [];
function savePhoneNumbers() { }

// Classes (PascalCase)
class UserProfile { }
class MembershipService { }

// Private properties (prefix with _)
class User {
  constructor() {
    this._privateData = {};  // Convention: private
  }
}

// Boolean variables (prefix with is/has/should/can)
const isAuthenticated = true;
const hasPermission = false;
const shouldRetry = true;
const canEdit = false;
```

---

## Functions

### Function Declarations vs Arrow Functions

Use arrow functions for callbacks, regular functions for top-level:

```javascript
// ✅ Good: Regular function for top-level
async function savePhoneNumbers(phoneNumbers) {
  const { getFirebaseAuth } = await import('../firebase/auth.js');
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  // ...
}

// ✅ Good: Arrow function for callbacks
phoneNumbers.forEach((phone) => {
  console.log(phone.number);
});

button.addEventListener('click', (e) => {
  handleClick(e);
});

// ❌ Bad: Arrow function for top-level (harder to debug)
const savePhoneNumbers = async (phoneNumbers) => {
  // Function name doesn't appear in stack traces as clearly
};
```

**Why**:
- Regular functions have clearer stack traces
- Arrow functions don't rebind `this` (useful for callbacks)

---

### JSDoc Documentation

**All functions must have JSDoc comments**:

```javascript
/**
 * Save phone numbers to Firestore
 *
 * Updates the current user's phone_numbers field in Firestore.
 * Validates that user is authenticated before saving.
 *
 * @param {Array<{country: string, number: string, default: boolean}>} phoneNumbers - Array of phone number objects
 * @returns {Promise<void>}
 * @throws {Error} If user is not authenticated
 *
 * @example
 * await savePhoneNumbers([
 *   { country: 'IS', number: '1234567', default: true },
 *   { country: 'DK', number: '9876543', default: false }
 * ]);
 */
async function savePhoneNumbers(phoneNumbers) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  const docRef = doc(db, 'members', user.uid);
  await updateDoc(docRef, {
    phone_numbers: phoneNumbers
  });

  console.log('✅ Phone numbers saved');
}
```

**Required JSDoc Tags**:
- `@param` - All parameters with types
- `@returns` - Return type and description
- `@throws` - Possible errors
- `@example` - Usage example (if not obvious)

---

### Parameter Destructuring

Use destructuring for object parameters:

✅ **Good**:
```javascript
/**
 * Create phone number element
 *
 * @param {Object} phone - Phone number object
 * @param {string} phone.country - Country code (e.g., "IS")
 * @param {string} phone.number - Phone number
 * @param {boolean} phone.default - Is default phone number
 * @param {number} index - Array index
 * @returns {HTMLElement} Phone number container element
 */
function createPhoneElement({ country, number, default: isDefault }, index) {
  // Use destructured parameters directly
  const countryName = getCountryName(country);
  // ...
}
```

❌ **Bad**:
```javascript
function createPhoneElement(phone, index) {
  // Accessing properties repeatedly
  const countryName = getCountryName(phone.country);
  const phoneNumber = phone.number;
  const isDefault = phone.default;
  // ...
}
```

---

## Async/Await

### Always Use Async/Await (Never Callbacks)

✅ **Good** (async/await):
```javascript
async function loadUserProfile() {
  try {
    // Wait for auth state
    const user = await getCurrentUser();

    // Load profile data
    const docRef = doc(db, 'members', user.uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Profile not found');
    }

    const profile = docSnap.data();
    renderProfile(profile);
  } catch (error) {
    console.error('Error loading profile:', error);
    showError('Failed to load profile');
  }
}
```

❌ **Bad** (callback hell):
```javascript
function loadUserProfile() {
  firebase.auth().onAuthStateChanged(function(user) {
    if (user) {
      firebase.firestore().collection('members').doc(user.uid).get()
        .then(function(docSnap) {
          if (docSnap.exists()) {
            const profile = docSnap.data();
            renderProfile(profile);
          } else {
            console.error('Profile not found');
          }
        })
        .catch(function(error) {
          console.error('Error:', error);
        });
    }
  });
}
```

**Why**: Async/await is more readable and easier to debug.

---

### Error Handling

Always use try/catch with async functions:

✅ **Good**:
```javascript
async function saveProfile() {
  const statusIcon = document.getElementById('status-save');

  try {
    // Show loading
    showStatusFeedback(statusIcon, 'loading');

    // Validate
    if (!validateProfile()) {
      throw new Error('Invalid profile data');
    }

    // Save
    await updateDoc(docRef, profileData);

    // Show success
    showStatusFeedback(statusIcon, 'success');
  } catch (error) {
    console.error('Error saving profile:', error);

    // Show error
    showStatusFeedback(statusIcon, 'error');

    // User-friendly error message
    showError(R.format(R.string.error_save, error.message));
  }
}
```

❌ **Bad** (no error handling):
```javascript
async function saveProfile() {
  // No try/catch - errors crash the app
  await updateDoc(docRef, profileData);
  console.log('Saved');
}
```

---

## Modules (Import/Export)

### ES6 Modules

Always use ES6 modules for code organization:

**File: `/js/utils/validators.js`**
```javascript
/**
 * Validate email address
 *
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
export function isValidEmail(email) {
  if (!email) return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Validate Icelandic kennitala
 *
 * @param {string} kt - Kennitala to validate
 * @returns {boolean} True if valid
 */
export function validateKennitala(kt) {
  if (!kt || kt.length !== 10) return false;
  // Validation logic...
  return true;
}
```

**File: `/js/profile.js`** (importing):
```javascript
import { isValidEmail, validateKennitala } from './utils/validators.js';
import { R } from '/i18n/strings-loader.js';
import { auth, db } from './firebase-config.js';

// Use imported functions
if (!isValidEmail(email)) {
  console.error('Invalid email');
}
```

**Benefits**:
- Clear dependencies
- Code reusability
- Tree-shaking (smaller bundles)
- Better IDE autocomplete

---

### Named vs Default Exports

Prefer **named exports** over default exports:

✅ **Good** (named exports):
```javascript
// utils/countries.js
export function getCountryName(code) { }
export function searchCountries(query) { }
export const COUNTRIES = { };

// Import specific functions
import { getCountryName, searchCountries } from './utils/countries.js';
```

❌ **Bad** (default export):
```javascript
// utils/countries.js
export default {
  getCountryName(code) { },
  searchCountries(query) { },
  COUNTRIES: { }
};

// Must import entire object
import countries from './utils/countries.js';
countries.getCountryName('IS');
```

**Why**: Named exports provide better IDE support and prevent naming inconsistencies.

---

## DOM Manipulation

### Selecting Elements

Use specific selectors:

✅ **Good**:
```javascript
// By ID (fastest)
const button = document.getElementById('btn-save');

// By class (for multiple elements)
const cards = document.querySelectorAll('.card');

// Complex selector
const activeLink = document.querySelector('.nav__link--active');
```

❌ **Bad**:
```javascript
// jQuery-style (don't use jQuery)
const button = $('#btn-save');

// Too generic
const elements = document.getElementsByTagName('div');
```

---

### Creating Elements

Use the `el` helper from `js/utils/dom.js` to reduce verbosity and improve readability:

✅ **Preferred (using helper)**:
```javascript
import { el } from '../utils/dom.js';

const btn = el('button', 'btn btn--primary', {
  type: 'button',
  onclick: handleClick
}, 'Click Me');

const card = el('div', 'card', {},
  el('h2', 'card__title', {}, 'Title'),
  el('p', 'card__text', {}, 'Content')
);
```

✅ **Low-level (document.createElement)**:
```javascript
/**
 * Create status icon element
 *
 * @returns {HTMLElement} Status icon span
 */
function createStatusIcon() {
  const statusIcon = document.createElement('span');
  statusIcon.className = 'profile-field__status';
  return statusIcon;
}
```

/**
 * Create phone number input
 *
 * @param {Object} phone - Phone number data
 * @param {number} index - Array index
 * @returns {HTMLElement} Phone number container
 */
function createPhoneInput({ country, number }, index) {
  // Container
  const container = document.createElement('div');
  container.className = 'phone-item';

  // Country selector
  const countrySelect = document.createElement('select');
  countrySelect.className = 'phone-item__country';
  countrySelect.value = country;

  // Number input
  const numberInput = document.createElement('input');
  numberInput.type = 'tel';
  numberInput.className = 'phone-item__number';
  numberInput.value = number;

  // Assemble
  container.appendChild(countrySelect);
  container.appendChild(numberInput);

  return container;
}
```

❌ **Bad** (innerHTML with string concatenation):
```javascript
// Security risk: XSS vulnerability
function createPhoneInput(phone, index) {
  const html = `
    <div class="phone-item">
      <select class="phone-item__country">${phone.country}</select>
      <input type="tel" value="${phone.number}" />
    </div>
  `;
  container.innerHTML = html;  // XSS risk if phone.number contains <script>
}
```

**Why**: Creating elements programmatically is safer (no XSS) and faster.

---

### Event Listeners

Use `addEventListener` (never inline `onclick`):

✅ **Good**:
```javascript
const button = document.getElementById('btn-save');

button.addEventListener('click', async (e) => {
  e.preventDefault();  // Prevent default if needed

  await saveProfile();
});

// Keyboard support
button.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    button.click();
  }
});
```

❌ **Bad** (inline onclick):
```html
<button onclick="saveProfile()">Save</button>
```

**Why**:
- Separates HTML from JavaScript
- Allows multiple listeners on same element
- Easier to test

---

## Common Patterns

### Status Feedback Utility

Reusable utility for status feedback:

```javascript
/**
 * Show status feedback on an element (loading → success → clear)
 *
 * @param {HTMLElement} statusElement - The status icon element
 * @param {string} state - 'loading', 'success', or 'error'
 * @param {number} clearDelayMs - Milliseconds before clearing (default 2000)
 *
 * @example
 * const statusIcon = document.getElementById('status-email');
 * showStatusFeedback(statusIcon, 'loading');
 * await saveEmail();
 * showStatusFeedback(statusIcon, 'success');
 */
function showStatusFeedback(statusElement, state, clearDelayMs = 2000) {
  if (!statusElement) return;

  // Clear all states first
  statusElement.className = 'profile-field__status';

  // Set new state
  if (state === 'loading') {
    statusElement.className = 'profile-field__status profile-field__status--loading';
  } else if (state === 'success') {
    statusElement.className = 'profile-field__status profile-field__status--success';

    // Auto-clear after delay
    setTimeout(() => {
      statusElement.className = 'profile-field__status';
    }, clearDelayMs);
  } else if (state === 'error') {
    statusElement.className = 'profile-field__status profile-field__status--error';

    // Auto-clear after delay (longer for errors)
    setTimeout(() => {
      statusElement.className = 'profile-field__status';
    }, clearDelayMs * 1.5);
  }
}

/**
 * Create a status icon element for inline feedback
 *
 * @returns {HTMLElement} Status icon span element
 *
 * @example
 * const statusIcon = createStatusIcon();
 * fieldContainer.appendChild(statusIcon);
 */
function createStatusIcon() {
  const statusIcon = document.createElement('span');
  statusIcon.className = 'profile-field__status';
  return statusIcon;
}
```

**Usage**:
```javascript
// In field event handler
input.addEventListener('blur', async (e) => {
  const newValue = e.target.value.trim();

  if (newValue !== currentValue) {
    showStatusFeedback(statusIcon, 'loading');

    try {
      await saveField(newValue);
      showStatusFeedback(statusIcon, 'success');
    } catch (error) {
      console.error('Save failed:', error);
      showStatusFeedback(statusIcon, 'error');
    }
  }
});
```

---

### Debouncing

Debounce expensive operations:

```javascript
/**
 * Debounce a function call
 *
 * @param {Function} func - Function to debounce
 * @param {number} delayMs - Delay in milliseconds
 * @returns {Function} Debounced function
 *
 * @example
 * const debouncedSearch = debounce(searchCountries, 300);
 * input.addEventListener('input', (e) => {
 *   debouncedSearch(e.target.value);
 * });
 */
function debounce(func, delayMs) {
  let timeoutId;

  return function debounced(...args) {
    // Clear previous timeout
    clearTimeout(timeoutId);

    // Set new timeout
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delayMs);
  };
}

// Usage: Debounce search
const searchInput = document.getElementById('input-search');
const debouncedSearch = debounce(performSearch, 300);

searchInput.addEventListener('input', (e) => {
  debouncedSearch(e.target.value);
});
```

**Why**: Prevents excessive function calls during rapid input (e.g., every keystroke).

---

### Local Storage Helpers

Wrapper for localStorage with error handling:

```javascript
/**
 * Get item from localStorage with JSON parsing
 *
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if key doesn't exist
 * @returns {*} Parsed value or default
 *
 * @example
 * const user = getLocalStorage('user', null);
 */
function getLocalStorage(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error reading localStorage key "${key}":`, error);
    return defaultValue;
  }
}

/**
 * Set item in localStorage with JSON stringification
 *
 * @param {string} key - Storage key
 * @param {*} value - Value to store (will be JSON stringified)
 * @returns {boolean} True if successful
 *
 * @example
 * setLocalStorage('user', { name: 'Jón', id: 123 });
 */
function setLocalStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Error writing localStorage key "${key}":`, error);
    return false;
  }
}

/**
 * Remove item from localStorage
 *
 * @param {string} key - Storage key
 * @returns {boolean} True if successful
 */
function removeLocalStorage(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Error removing localStorage key "${key}":`, error);
    return false;
  }
}
```

---

## Best Practices

### ✅ Do

- Use `const` by default, `let` when reassignment needed
- Write JSDoc comments for all functions
- Use async/await (never callbacks)
- Handle errors with try/catch
- Use ES6 modules (import/export)
- Create elements programmatically (no innerHTML with user data)
- Use `addEventListener` (never inline onclick)
- Validate user input before saving
- Use i18n strings (never hardcode text)
- Use descriptive variable names (`phoneNumbers`, not `arr`)

### ❌ Don't

- Use `var` (always const/let)
- Use jQuery (vanilla JS only)
- Use callbacks (use async/await)
- Ignore errors (always try/catch)
- Use inline event handlers (`onclick="..."`)
- Use `innerHTML` with user data (XSS risk)
- Hardcode user-facing text (use R.string)
- Leave console.log in production code
- Use global variables (use modules)
- Write functions without JSDoc

---

## Code Quality Tools

### ESLint Configuration

ESLint enforces JavaScript standards automatically.

**File: `.eslintrc.json`** (see separate task)

**Run ESLint**:
```bash
# Check for issues
npm run lint

# Auto-fix issues
npm run lint:fix
```

---

### Prettier Configuration

Prettier enforces consistent formatting.

**File: `.prettierrc.json`** (see separate task)

**Run Prettier**:
```bash
# Format all files
npm run format

# Check formatting
npm run format:check
```

---

## Common Mistakes

### Mistake 1: Not Handling Errors

❌ **Bad**:
```javascript
async function loadData() {
  const data = await fetchData();  // What if this fails?
  renderData(data);
}
```

✅ **Good**:
```javascript
async function loadData() {
  try {
    const data = await fetchData();
    renderData(data);
  } catch (error) {
    console.error('Failed to load data:', error);
    showError(R.string.error_load_data);
  }
}
```

---

### Mistake 2: XSS Vulnerability with innerHTML

❌ **Bad** (XSS risk):
```javascript
const userInput = document.getElementById('input-name').value;
div.innerHTML = `<p>Hello ${userInput}</p>`;  // XSS if userInput contains <script>
```

✅ **Good** (safe):
```javascript
const userInput = document.getElementById('input-name').value;
const p = document.createElement('p');
p.textContent = `Hello ${userInput}`;  // Safe: textContent escapes HTML
div.appendChild(p);
```

---

### Mistake 3: Missing JSDoc

❌ **Bad**:
```javascript
function savePhoneNumbers(phoneNumbers) {
  // No documentation
}
```

✅ **Good**:
```javascript
/**
 * Save phone numbers to Firestore
 *
 * @param {Array<{country: string, number: string}>} phoneNumbers
 * @returns {Promise<void>}
 * @throws {Error} If user not authenticated
 */
async function savePhoneNumbers(phoneNumbers) {
  // ...
}
```

---

## Testing

### Unit Testing (Future)

Use Jest for unit tests:

```javascript
// validators.test.js
import { isValidEmail, validateKennitala } from './validators.js';

describe('isValidEmail', () => {
  test('validates correct email', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
  });

  test('rejects invalid email', () => {
    expect(isValidEmail('invalid')).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('validateKennitala', () => {
  test('validates correct kennitala', () => {
    expect(validateKennitala('0103009999')).toBe(true); // Jan 3, 2000
  });

  test('rejects invalid kennitala', () => {
    expect(validateKennitala('123')).toBe(false);
    expect(validateKennitala(null)).toBe(false);
  });
});
```

---

## Shared JavaScript Architecture

### Overview

Ekklesia uses a **shared JavaScript architecture** where common utilities are used across both member portal and admin portal. This reduces code duplication, ensures consistency, and makes maintenance easier.

### 🔐 Security Model

**Important**: Sharing JavaScript between member and admin portals is **completely safe** because:

1. **Security is enforced on the backend** - Firebase Firestore rules and Cloud Functions validate all requests
2. **Frontend code is just UI** - JavaScript in the browser cannot bypass server-side security
3. **Admin access is checked server-side** - `checkAdminAccess()` calls Firebase which validates roles

```javascript
// This is safe! Even if a regular user calls this function,
// Firebase will reject the request because they don't have admin role
export async function checkAdminAccess() {
  const user = auth.currentUser;
  if (!user) return false;
  
  // 🔒 Firebase Security Rules enforce this on the server
  const adminDoc = await db.collection('admins').doc(user.uid).get();
  return adminDoc.exists; // Server rejects if user is not admin
}
```

### File Structure

```
/js/
├── core/                    # Core shared functionality
│   ├── api.js               # ✅ authenticatedFetch, POST, PATCH helpers
│   ├── auth.js              # ✅ Firebase auth initialization
│   └── nav.js               # ✅ Navigation (hamburger menu)
│
├── components/              # ✅ Reusable UI components
│   ├── toast.js             # ✅ showToast notification system
│   └── status.js            # ✅ showStatus feedback (loading/success/error)
│
├── utils/                   # ✅ Shared utilities
│   ├── format.js            # ✅ Phone, kennitala formatting
│   ├── debug.js             # ✅ Conditional logging
│   └── countries.js         # ✅ Country data
│
├── members/                 # Member-specific (keep separate)
│   ├── profile.js           # Profile editing
│   └── dashboard.js         # Dashboard
│
└── api/                     # API clients
    └── elections-api.js     # Elections API

/admin/js/
├── admin.js                 # Admin dashboard
├── member-edit.js           # Edit member (uses shared toast.js)
├── members-list.js          # Member list
├── django-api.js            # Django API client (admin-only)
└── utils/
    ├── admin-helpers.js     # Admin-only helpers
    └── electoral-districts.js  # Admin data
```

### ✅ What to Share

**Share utilities for**:
- Authentication helpers (`authenticatedFetch`)
- UI components (`showToast`, `showStatus`)
- Formatting/validation (`formatPhone`, `validateKennitala`)
- Navigation (`initNavigation`)
- Debugging (`debug.log`)

**Keep separate**:
- Business logic specific to portal (admin bulk ops vs member profile editing)
- Page-specific code (dashboard.js, sync-members.js)

---

### Shared Component: Toast Notifications

**File**: `/js/components/toast.js`

Unified toast notification system for success, error, info, and warning messages.

**Usage**:
```javascript
import { showToast, showSuccess, showError } from '../../js/components/toast.js';

// Basic usage
showToast('Profile updated!', 'success');
showToast('Invalid input', 'error');

// With options
showToast('Processing...', 'info', { duration: 5000 });

// Convenience methods
showSuccess('Saved successfully');
showError('Save failed');
```

**CSS Required**:
```html
<link rel="stylesheet" href="/styles/components/toast.css">
```

**API**:
- `showToast(message, type, options)` - Show toast notification
- `showSuccess(message, options)` - Show success toast
- `showError(message, options)` - Show error toast
- `showInfo(message, options)` - Show info toast
- `showWarning(message, options)` - Show warning toast
- `clearAllToasts()` - Clear all active toasts

**Options**:
- `duration` (number) - Duration in milliseconds (default: 3000)
- `dismissible` (boolean) - Allow manual dismissal (default: true)

---

### Shared Component: Status Feedback

**File**: `/js/components/status.js`

Visual feedback for loading, success, and error states on UI elements.

**Usage**:
```javascript
import { showStatus, createStatusIcon, toggleButtonLoading } from '../../js/components/status.js';

// Create status icon
const statusIcon = createStatusIcon({ baseClass: 'form-field__status' });
inputContainer.appendChild(statusIcon);

// Show loading
showStatus(statusIcon, 'loading', { baseClass: 'form-field__status' });

// Show success (auto-clears after 2 seconds)
showStatus(statusIcon, 'success', { baseClass: 'form-field__status' });

// Button loading state
const saveBtn = document.getElementById('btn-save');
toggleButtonLoading(saveBtn, true, { loadingText: 'Saving...' });
// ... perform save ...
toggleButtonLoading(saveBtn, false);
```

**API**:
- `showStatus(element, state, options)` - Show status on element
- `createStatusIcon(options)` - Create status icon element
- `showLoading(element, options)` - Convenience: show loading
- `showSuccess(element, options)` - Convenience: show success
- `showError(element, options)` - Convenience: show error
- `clearStatus(element, options)` - Clear status
- `toggleButtonLoading(button, loading, options)` - Toggle button loading state

**Options**:
- `baseClass` (string) - Base CSS class (default: 'status')
- `clearDelay` (number) - Milliseconds before clearing (default: 2000)
- `loadingText` (string) - Text for loading state
- `originalText` (string) - Original button text

---

### Shared Utility: API Client

**File**: `/js/core/api.js`

Unified HTTP client for Firebase-authenticated API requests. Consolidates duplicate `authenticatedFetch` implementations.

**Usage**:
```javascript
import { authenticatedFetch, authenticatedPost, authenticatedPatch } from '../../js/core/api.js';

// GET request
const member = await authenticatedJSON('/api/members/123');

// POST request
const newMember = await authenticatedPost('/api/members', {
  name: 'Jón Jónsson',
  email: 'jon@example.com'
});

// PATCH request
const updated = await authenticatedPatch('/api/members/123', {
  phone: '555-1234'
});

// DELETE request
await authenticatedDelete('/api/members/123');

// Custom request
const response = await authenticatedFetch('/api/custom', {
  method: 'PUT',
  body: JSON.stringify({ data: 'value' })
});
```

**API**:
- `authenticatedFetch(url, options)` - Fetch with Firebase token
- `authenticatedJSON(url, options)` - Fetch and parse JSON
- `authenticatedPost(url, data)` - POST request
- `authenticatedPatch(url, data)` - PATCH request
- `authenticatedPut(url, data)` - PUT request
- `authenticatedDelete(url)` - DELETE request

**Error Handling**:
```javascript
import { APIError } from '../../js/core/api.js';

try {
  await authenticatedPost('/api/members', memberData);
} catch (error) {
  if (error instanceof APIError) {
    console.error(`API Error ${error.status}:`, error.message);
  } else {
    console.error('Network error:', error);
  }
}
```

---

### Migration Guide: Converting to Shared Components

**Before** (profile.js - inline toast):
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

**After** (import shared component):
```javascript
import { showToast } from './components/toast.js';

// Use directly
showToast('Profile updated!', 'success');
```

**Before** (admin - inline success message):
```javascript
function showSuccess() {
  elements.successMessage.style.display = 'block';
}
```

**After** (import shared toast):
```javascript
import { showToast } from '../../js/components/toast.js';

showToast('Upplýsingar vistaðar', 'success');
```

**Benefits**:
- ~40 lines saved per file
- Consistent UX across portals
- Single source of truth for UI patterns
- Easier to add new features (e.g., dismissible toasts)

---

### Code Savings Summary

| Component | Before | After | Lines Saved |
|-----------|--------|-------|-------------|
| Toast notifications | 2 implementations (70 lines) | 1 shared (140 lines) | ~40 lines |
| Status feedback | 1 implementation (40 lines) | 1 shared (180 lines) | ~25 lines (reusable) |
| authenticatedFetch | 2 implementations (60 lines) | 1 shared (210 lines) | ~30 lines |
| **Total** | **170 lines duplicated** | **530 lines shared** | **~95 lines saved** |

**Additional benefits**:
- Easier maintenance (fix once, works everywhere)
- Consistent behavior (same toast timing, same loading spinners)
- Better UX (users see familiar patterns across portals)

---

## Related Documentation

- **HTML Guide**: [/docs/standards/HTML_GUIDE.md](/docs/standards/HTML_GUIDE.md)
- **CSS & BEM Guide**: [/docs/standards/CSS_BEM_GUIDE.md](/docs/standards/CSS_BEM_GUIDE.md)
- **i18n Guide**: [/docs/standards/I18N_GUIDE.md](/docs/standards/I18N_GUIDE.md)
- **Master Code Standards**: [/docs/CODE_STANDARDS_MAP.md](/docs/CODE_STANDARDS_MAP.md)

**External Resources**:
- **MDN JavaScript Guide**: https://developer.mozilla.org/en-US/docs/Web/JavaScript
- **ESLint Rules**: https://eslint.org/docs/rules/
- **Airbnb JavaScript Style Guide**: https://github.com/airbnb/javascript

---

**Last Updated**: 2025-11-05
**Maintained By**: Frontend team
**Status**: ✅ Active - Required for all JavaScript code
