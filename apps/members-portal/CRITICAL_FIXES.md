# Critical Runtime Bugs Fixed

**Date**: 2025-10-15
**Status**: ✅ All fixed

---

## Summary

Fixed 5 critical runtime bugs that would have broken production:

1. ✅ Functions region not honored (would call wrong region)
2. ✅ signInWithCustomToken using instance method (would throw)
3. ✅ requireAuth/signOut mutating window.location (not pure)
4. ✅ Double R.load causing redundant network requests
5. ✅ Some helpers using getElementById directly (inconsistent)

---

## Bug 1: Functions Region Not Honored

**Problem**: `getFunctions()` always used default region, ignoring `config_firebase_region`.

**Impact**: Would call Cloud Functions in wrong region (breaks production).

**Fix**: [firebase/app.js:87-92](firebase/app.js#L87-L92)

```diff
-export function getFunctions() {
-  return firebaseGetFunctions(app);
+export function getFunctions(region) {
+  if (region) {
+    return firebaseGetFunctions(app, region);
+  }
+  return firebaseGetFunctions(app);
}

-export function httpsCallable(name) {
-  const functions = getFunctions();
+export function httpsCallable(name, region) {
+  const functions = getFunctions(region);
  return firebaseHttpsCallable(functions, name);
}
```

**Callers updated**:
- [login.new.js:148-149](js/login.new.js#L148-L149): `httpsCallable('handleKenniAuth', region)`
- [dashboard.new.js:132-133](js/dashboard.new.js#L132-L133): `httpsCallable('verifyMembership', region)`

---

## Bug 2: signInWithCustomToken Using Instance Method

**Problem**: `auth.signInWithCustomToken(token)` - modular Firebase SDK doesn't have instance methods.

**Impact**: **Runtime crash** on login callback.

**Error**:
```
TypeError: auth.signInWithCustomToken is not a function
```

**Fix**: [firebase/app.js:32-34](firebase/app.js#L32-L34), [login.new.js:162-163](js/login.new.js#L162-L163)

```diff
// firebase/app.js
+import {
+  signInWithCustomToken as firebaseSignInWithCustomToken
+} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

+export {
+  signInWithCustomToken
+};

// login.new.js
-import { getFirebaseAuth } from '/firebase/app.js';
+import { getFirebaseAuth, signInWithCustomToken } from '/firebase/app.js';

-await auth.signInWithCustomToken(customToken);
+await signInWithCustomToken(auth, customToken);
```

---

## Bug 3: requireAuth/signOut Mutating window.location

**Problem**: Session layer was mutating `window.location`, making it impossible to test without DOM or reuse in non-browser contexts.

**Impact**: "Pure session logic" claim was false. Hard to test.

**Fix**: [session/auth.js:18-54](session/auth.js#L18-L54)

**Before**:
```javascript
export async function requireAuth() {
  if (!user) {
    window.location.href = '/';  // Side effect!
    reject(new Error('Not authenticated'));
  }
}

export async function signOut() {
  await firebaseSignOut(auth);
  window.location.href = '/';  // Side effect!
}
```

**After**:
```javascript
export class AuthenticationError extends Error {
  constructor(message, redirectTo = '/') {
    super(message);
    this.redirectTo = redirectTo;  // Hint, not side effect
  }
}

export async function requireAuth() {
  if (!user) {
    reject(new AuthenticationError('Not authenticated', '/'));
  }
}

export async function signOut() {
  await firebaseSignOut(auth);
  // No redirect - caller decides
}
```

**UI layer handles redirect**:
```javascript
// All page modules now:
try {
  const { userData, strings } = await initSession();
} catch (error) {
  if (error instanceof AuthenticationError) {
    window.location.href = error.redirectTo;  // UI decides
  }
}

// ui/nav.js
export function setupLogoutHandler(onLogout, redirectTo = '/') {
  addEventListener('nav-logout', 'click', async (e) => {
    await onLogout();
    window.location.href = redirectTo;  // UI decides
  });
}
```

---

## Bug 4: Double R.load() Causing Redundant Network Requests

**Problem**: `strings-loader.js` auto-loaded 'is' on import, then `initSession()` called `R.load('is')` again.

**Impact**: First page load fetched XML twice.

**Fix**: [i18n/strings-loader.js:220-223](i18n/strings-loader.js#L220-L223)

**Before**:
```javascript
// Auto-load default locale on import
const autoLoad = R.load('is').catch(err => {
  console.error('Failed to auto-load strings:', err);
});
```

**After**:
```javascript
// Lazy loading only - no auto-load
// Pages call R.load() via initSession(), which caches the result
// This avoids double-fetch on first page load
```

**Why safe**: `R.load()` already has cache check (added earlier):
```javascript
async load(locale = 'is') {
  // Check if already loaded for this locale
  if (this.loaded && this.currentLocale === locale) {
    console.log(`✓ Using cached strings for locale: ${locale}`);
    return this.strings;
  }
  // ... fetch
}
```

---

## Bug 5: Inconsistent DOM Access (getElementById vs getElementByIdSafe)

**Problem**: Some helpers (e.g., `updateAuthUI`, `showResult`) used `document.getElementById` directly instead of `getElementByIdSafe`.

**Impact**: Inconsistent - validation happened at page level but not inside helpers.

**Fix**: [test-events.new.js:91-95, 117-121](js/test-events.new.js#L91-L95)

**Before**:
```javascript
function updateAuthUI(userData, strings) {
  const authBadge = document.getElementById('auth-badge');  // Could be null
  authBadge.textContent = strings.test_auth_authenticated;
}

function showResult(elementId, data, isError = false) {
  const element = document.getElementById(elementId);  // Could be null
  element.className = isError ? 'test-result test-error' : 'test-result test-success';
}
```

**After**:
```javascript
function updateAuthUI(userData, strings) {
  const authBadge = getElementByIdSafe('auth-badge', 'test events');
  authBadge.textContent = strings.test_auth_authenticated;
}

function showResult(elementId, data, isError = false) {
  const element = getElementByIdSafe(elementId, 'test events');
  element.className = isError ? 'test-result test-error' : 'test-result test-success';
}
```

**Why**: Now all DOM access goes through validation layer (consistent + helpful errors).

---

## Testing Checklist

### Manual Testing (Browser)

- [ ] Login flow works
  - [ ] OAuth redirect to Kenni.is
  - [ ] Callback with auth code
  - [ ] signInWithCustomToken succeeds (no runtime error)
  - [ ] Redirect to dashboard

- [ ] Dashboard loads
  - [ ] Navigation strings updated
  - [ ] Membership verification calls correct region

- [ ] Profile loads
  - [ ] User data displayed

- [ ] Test events loads
  - [ ] All DOM elements validated (no null errors)
  - [ ] API calls work

- [ ] Logout works
  - [ ] Signs out from Firebase
  - [ ] Redirects to login

- [ ] Auth guard works
  - [ ] Direct /dashboard.html access when not logged in
  - [ ] Should redirect to /

### Console Checks

```javascript
// Should see (1st page):
✓ Loaded 185 strings for locale: is

// Should see (2nd page):
✓ Using cached strings for locale: is (185 strings)

// Should NOT see:
Failed to auto-load strings  // (auto-load removed)
```

### Network Tab Checks

- [ ] Only 1 request to `/i18n/values-is/strings.xml` (not 2)
- [ ] Firebase CDN imports cached across pages
- [ ] Cloud Functions called with correct region

---

## Summary

All critical runtime bugs fixed:

1. ✅ Functions region honored (production calls correct region)
2. ✅ signInWithCustomToken uses modular SDK (no crash)
3. ✅ Session layer pure (no window.location mutation)
4. ✅ i18n lazy loaded (no double fetch)
5. ✅ DOM access consistent (getElementByIdSafe everywhere)

**Ready for testing!**
