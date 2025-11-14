# Debug Mode for Members Portal

## 🔍 What is Debug Mode?

Debug mode displays detailed console logging information that helps with development and debugging. In production, debug mode is **disabled** by default to keep the console clean.

---

## 🚀 How to Enable Debug Mode

### **Method 1: Automatic (Development)**
Debug mode is **always** enabled when running on `localhost`:

```
http://localhost:5000/admin-elections/
```

✅ No action needed!

---

### **Method 2: URL Parameter (Production Testing)**
Add `?debug=true` to the URL:

```
https://ekklesia-prod-10-2025.web.app/admin-elections/?debug=true
```

✅ Great for debugging in production without changing code

---

### **Method 3: localStorage (Persistent)**
Open Console (F12) and run:

```javascript
localStorage.setItem('DEBUG', 'true');
```

Refresh the page. Debug mode will remain enabled until you disable it with:

```javascript
localStorage.removeItem('DEBUG');
```

**Or use helper functions:**

```javascript
// Enable debug
debug.enable();

// Disable debug
debug.disable();
```

---

## 📊 What You See in Debug Mode

### **RBAC Logging:**
```
[RBAC] User roles from token: ['member', 'admin', 'superuser']
[RBAC] Mapped superuser -> superadmin (elections)
[RBAC] Can superadmin perform 'delete'? true
[RBAC] ✓ Admin access granted
```

### **Elections List Logging:**
```
[Elections List] Election role: superadmin
[Elections List] Permissions cached: {canDelete: true, canEdit: true, canManage: false}
[Elections List] Fetching elections with token...
[Elections List] Loaded elections: 10
[Elections List] Filtered: 10 / 10
[Elections List] Action: open Election: 123-abc-456
[Elections List] Election opened: 123-abc-456 Duration: 30 min
```

### **Component Logging:**
```
[Modal] Showing modal: Confirm Action
[Badge] Created status badge: active
[Nav] Hamburger menu toggled
```

---

## 🛑 What You ALWAYS See (even without debug)?

**Error messages and warnings are ALWAYS shown** to facilitate troubleshooting:

```javascript
console.error('[Elections List] Error loading elections:', error);
console.warn('[RBAC] Missing role claim in token');
```

These are important messages that always need to be visible.

---

## 🏗️ Developer Guide

### **How to use debug in code:**

```javascript
import { debug } from '../../js/utils/debug.js';

// Debug messages (only in debug mode)
debug.log('[MyComponent] Initialized');
debug.log('[MyComponent] User clicked:', buttonId);

// Errors (ALWAYS shown)
console.error('[MyComponent] Failed to save:', error);

// Warnings (ALWAYS shown)
console.warn('[MyComponent] Deprecated function used');
```

### **Best Practices:**

1. ✅ **Use `debug.log()` for:**
   - State changes
   - API calls and responses
   - User actions
   - Component lifecycle events
   - Permission checks

2. ✅ **Use `console.error()` for:**
   - Errors that users need to know about
   - API failures
   - Validation errors
   - Critical failures

3. ✅ **Use `console.warn()` for:**
   - Deprecation warnings
   - Missing data
   - Non-critical issues

4. ❌ **NEVER use `console.log()` directly**
   - Always use `debug.log()` instead
   - This ensures production console stays clean

---

## 📁 Files with Debug Support

- ✅ `/admin-elections/js/elections-list.js`
- ✅ `/js/rbac.js`
- ✅ `/js/utils/debug.js`
- ✅ `/js/nav.js`
- ✅ `/js/dashboard.js`
- ✅ `/admin/js/admin.js`

---

## 🔧 Troubleshooting

### Debug mode not working?

1. **Check hostname:**
   ```javascript
   console.log(window.location.hostname);
   // Should be 'localhost' for automatic debug
   ```

2. **Check localStorage:**
   ```javascript
   console.log(localStorage.getItem('DEBUG'));
   // Should be 'true' if enabled
   ```

3. **Check URL:**
   ```javascript
   console.log(window.location.search);
   // Should contain '?debug=true'
   ```

4. **Hard refresh:**
   - Chrome/Firefox: `Ctrl+Shift+R` (Windows/Linux)
   - Mac: `Cmd+Shift+R`

---

## 🎯 Summary

| Environment | Debug Mode | How |
|-------------|-----------|-----|
| **Development (localhost)** | ✅ Auto ON | No action needed |
| **Production** | ❌ OFF | Default |
| **Production Testing** | ⚠️ Manual ON | `?debug=true` or localStorage |

**Remember:** Error messages are ALWAYS shown, regardless!

---

**Last Updated**: 2025-11-14
