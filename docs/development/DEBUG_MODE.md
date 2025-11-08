# Debug Mode fyrir Members Portal

## 🔍 Hvað er Debug Mode?

Debug mode sýnir nákvæmar console logging upplýsingar sem hjálpa við þróun og debugging. Í production er debug mode **slökkt** sjálfvirkt til að halda console clean.

---

## 🚀 Hvernig á að virkja Debug Mode

### **Method 1: Sjálfvirkt (Development)**
Debug mode er **alltaf** virkt þegar þú ert að keyra á `localhost`:

```
http://localhost:5000/admin-elections/
```

✅ Engin aðgerð nauðsynleg!

---

### **Method 2: URL Parameter (Production Testing)**
Bættu `?debug=true` við URL-ið:

```
https://ekklesia-prod-10-2025.web.app/admin-elections/?debug=true
```

✅ Hentar vel til að debug í production án þess að breyta kóða

---

### **Method 3: localStorage (Persistent)**
Opnaðu Console (F12) og keyra:

```javascript
localStorage.setItem('DEBUG', 'true');
```

Endurnýjaðu síðuna. Debug mode verður áfram virkt þar til þú slekkur á því með:

```javascript
localStorage.removeItem('DEBUG');
```

**eða notaðu helper functions:**

```javascript
// Enable debug
debug.enable();

// Disable debug
debug.disable();
```

---

## 📊 Hvað sérðu í Debug Mode?

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

## 🛑 Hvað sérðu ALLTAF (jafnvel án debug)?

**Error messages og warnings eru ALLTAF sýnd** til að auðvelda troubleshooting:

```javascript
console.error('[Elections List] Error loading elections:', error);
console.warn('[RBAC] Missing role claim in token');
```

Þetta eru mikilvæg skilaboð sem þarf alltaf að sjá.

---

## 🏗️ Developer Guide

### **Hvernig á að nota debug í kóða:**

```javascript
import { debug } from '../../js/utils/debug.js';

// Debug messages (aðeins í debug mode)
debug.log('[MyComponent] Initialized');
debug.log('[MyComponent] User clicked:', buttonId);

// Errors (ALLTAF sýnd)
console.error('[MyComponent] Failed to save:', error);

// Warnings (ALLTAF sýnd)
console.warn('[MyComponent] Deprecated function used');
```

### **Best Practices:**

1. ✅ **Notaðu `debug.log()` fyrir:**
   - State changes
   - API calls og responses
   - User actions
   - Component lifecycle events
   - Permission checks

2. ✅ **Notaðu `console.error()` fyrir:**
   - Errors sem þarf að láta notanda vita um
   - API failures
   - Validation errors
   - Critical failures

3. ✅ **Notaðu `console.warn()` fyrir:**
   - Deprecation warnings
   - Missing data
   - Non-critical issues

4. ❌ **ALDREI nota `console.log()` beint**
   - Notaðu alltaf `debug.log()` í staðinn
   - Þetta tryggir að production console sé clean

---

## 📁 Files með Debug Support

- ✅ `/admin-elections/js/elections-list.js`
- ✅ `/js/rbac.js`
- ✅ `/js/utils/debug.js`
- ✅ `/js/nav.js`
- ✅ `/js/dashboard.js`
- ✅ `/admin/js/admin.js`

---

## 🔧 Troubleshooting

### Debug mode virkar ekki?

1. **Athugaðu hostname:**
   ```javascript
   console.log(window.location.hostname);
   // Ætti að vera 'localhost' fyrir sjálfvirkt debug
   ```

2. **Athugaðu localStorage:**
   ```javascript
   console.log(localStorage.getItem('DEBUG'));
   // Ætti að vera 'true' ef enabled
   ```

3. **Athugaðu URL:**
   ```javascript
   console.log(window.location.search);
   // Ætti að innihalda '?debug=true'
   ```

4. **Hard refresh:**
   - Chrome/Firefox: `Ctrl+Shift+R` (Windows/Linux)
   - Mac: `Cmd+Shift+R`

---

## 🎯 Summary

| Environment | Debug Mode | Hvernig |
|-------------|-----------|---------|
| **Development (localhost)** | ✅ Auto ON | Engin aðgerð |
| **Production** | ❌ OFF | Default |
| **Production Testing** | ⚠️ Manual ON | `?debug=true` eða localStorage |

**Munaðu:** Error messages eru ALLTAF sýnd, sama hvað!
