# Election Feature Deployment Checklist

**Purpose:** Pre-deployment verification and performance optimization
**Part of:** [Election Feature Development Guide](./OVERVIEW.md)
**Last Updated:** 2025-11-24

---

## 🚀 Performance

### Page Load Optimization
- [ ] CSS loaded in `<head>` (render-blocking is OK for CSS)
- [ ] JavaScript loaded with `type="module"` (deferred by default)
- [ ] Version parameters on all static assets (`?v=20251106-22`)
- [ ] Images optimized (WebP, lazy loading)
- [ ] Fonts preloaded if custom fonts used

### Runtime Performance
- [ ] Debounce user input (search, autocomplete)
- [ ] Throttle scroll/resize handlers
- [ ] Use `document.getElementById()` not `querySelector()` when possible
- [ ] Minimize DOM manipulation (batch updates)
- [ ] Remove event listeners when no longer needed

**Example:**
```javascript
import { debounce } from './utils/debounce.js';

// Good ✓
const handleSearch = debounce((query) => {
  searchElections(query);
}, 300);

searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
```

---

## ✅ Pre-Deployment Checklist

### Before Committing
- [ ] All console.log() removed (use `debug.log()` instead)
- [ ] No commented-out code
- [ ] No TODO comments (create GitHub issues instead)
- [ ] All functions documented (JSDoc)
- [ ] Code formatted consistently

### Before Deploying
- [ ] Manual testing completed (see [Testing Checklist](./testing-checklist.md))
- [ ] No errors in browser console
- [ ] Lighthouse score: 90+ (Performance, Accessibility, Best Practices)
- [ ] Version numbers updated in HTML
- [ ] Git commit with descriptive message
- [ ] Deploy: `firebase deploy --only hosting`

### After Deploying
- [ ] Test on production URL (hard refresh)
- [ ] Check Firebase hosting logs (no 404s)
- [ ] Check Firebase Analytics (no spike in errors)
- [ ] Monitor for 15 minutes (check for user reports)

---

## 📝 Git Commits

### Conventional Commits Format
- [ ] Descriptive commit messages (not "fix bug", "update code")
- [ ] Use conventional commits format:
  - `feat(elections): add vote confirmation modal`
  - `fix(elections): date format using English months`
  - `refactor(modal): extract reusable component`
  - `docs(checklist): add election feature checklist`

---

## 🔧 Debugging Checklist

### Common Issues & Solutions

**Issue: Styles not updating**
- [ ] Update version parameter (`?v=20251106-XX`)
- [ ] Hard refresh browser (Ctrl+Shift+R)
- [ ] Check CSS file path is correct
- [ ] Check for CSS specificity conflicts

**Issue: Authentication redirect loop**
- [ ] Check Firebase config is correct
- [ ] Check user is actually logged in (Firebase console)
- [ ] Check `initAuthenticatedPage()` is called only once
- [ ] Check no JavaScript errors before auth check

**Issue: Modal not showing**
- [ ] Check `modal.css` is imported in HTML
- [ ] Check no conflicting CSS (search for `.modal {` in other files)
- [ ] Check `showModal()` is called correctly
- [ ] Check browser console for errors

**Issue: i18n strings showing as "Missing string key: ..."**
- [ ] Check string exists in `/i18n/values-is/strings.xml`
- [ ] Check string name matches exactly (case-sensitive)
- [ ] Check `R.load('is')` was called before using strings
- [ ] Hard refresh browser (Ctrl+Shift+R)

**Issue: Date showing in English**
- [ ] Using `formatDateIcelandic()` not `toLocaleDateString()`
- [ ] Check import: `import { formatDateIcelandic } from './utils/format.js'`
- [ ] Check date string is valid ISO format

---

## 📚 Reference

### Related Checklists
- [Testing Checklist](./testing-checklist.md) - Manual testing procedures
- [Components](./components-checklist.md) - Component debugging
- [Overview](./OVERVIEW.md) - Back to main guide

---

**Last Updated:** 2025-11-24
**Maintained By:** Development Team
