# Production Testing Guide - New Architecture

**Date**: 2025-10-15
**Deployment**: 21:18:08 UTC (version dbaac5154df9c557)
**Status**: ✅ Deployed - Ready for Testing

---

## Testing Checklist

### ✅ Step 1: Login Page

**URL**: https://ekklesia-prod-10-2025.web.app/

**Expected Behavior**:
1. Page loads with Icelandic text
2. Title: "Innskráning - Sósíalistaflokkurinn"
3. Button says "Skrá inn með Kenni.is"
4. No console errors

**Test**:
```
1. Open URL in browser
2. Open DevTools console (F12)
3. Check for:
   ✅ "✅ Firebase App Check initialized (reCAPTCHA Enterprise)"
   ✅ "✅ Loaded X strings for locale: is"
4. Click "Skrá inn með Kenni.is"
5. Should redirect to Kenni.is OAuth page
```

**Console Output Expected**:
```
✅ Firebase App Check initialized (reCAPTCHA Enterprise)
✅ Loaded 185 strings for locale: is
```

---

### ✅ Step 2: Dashboard Page

**URL**: https://ekklesia-prod-10-2025.web.app/dashboard.html

**Expected Behavior**:
1. If not logged in → redirects to `/` (login page)
2. If logged in → shows dashboard with:
   - Navigation (Mælaborð, Prófíll, Útskrá)
   - Membership status
   - Kennitala (masked)
   - All text in Icelandic

**Test**:
```
1. Complete login flow (Kenni.is → callback)
2. Should land on dashboard
3. Check console for:
   ✅ "✅ Using cached strings for locale: is" (2nd page, should use cache)
4. Verify:
   - Navigation links work
   - Membership status displays
   - Kennitala shows (masked XXXXXX-XXXX)
```

**Console Output Expected**:
```
✅ Firebase App Check initialized (reCAPTCHA Enterprise)
✅ Using cached strings for locale: is (185 strings)
```

---

### ✅ Step 3: Profile Page (FIXED)

**URL**: https://ekklesia-prod-10-2025.web.app/profile.html

**Previous Error**:
```
❌ Profile page initialization failed: Error: Missing required DOM elements in profile page:
  - #profile-title
```

**Fix Applied** (21:18:08 UTC):
- Changed `<h1 id="page-title">` → `<h1 id="profile-title">`

**Test**:
```
1. Navigate to Profile page (from dashboard or direct URL)
2. Page should load WITHOUT errors
3. Check console - should NOT see "Missing required DOM elements"
4. Should see:
   - Page title: "Prófíll"
   - Personal info (name, kennitala, email, phone)
   - Membership status section
```

**Console Output Expected**:
```
✅ Firebase App Check initialized (reCAPTCHA Enterprise)
✅ Using cached strings for locale: is (185 strings)
```

**If you still see the error**:
- Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)
- Check deployment version in Network tab (should be dbaac5154df9c557)

---

### ✅ Step 4: Test Events Page

**URL**: https://ekklesia-prod-10-2025.web.app/test-events.html

**Expected Behavior**:
1. Page loads with API test interface
2. Shows authentication status
3. Buttons enabled after login

**Test**:
```
1. Navigate to test-events.html
2. Check console for Firebase App Check + i18n cache
3. Should see:
   - Auth badge: "Auðkenndur" (green)
   - User info (UID, kennitala, membership)
   - API test buttons enabled (except health check - always enabled)
4. Click "GET /health" → should return 200 OK
5. Click "GET /api/election" → should return election data
6. Click "POST /api/request-token" → should issue voting token
```

**Console Output Expected**:
```
✅ Firebase App Check initialized (reCAPTCHA Enterprise)
✅ Using cached strings for locale: is (185 strings)
```

---

## Testing Results Template

**Copy this to Discord/notes after testing:**

```markdown
## Production Testing Results - 2025-10-15

**Tester**: [Your Name]
**Browser**: [Chrome/Firefox/Safari + version]
**Time**: [UTC time]

### Login Page
- [ ] ✅ Page loads
- [ ] ✅ No console errors
- [ ] ✅ Firebase App Check initialized
- [ ] ✅ i18n strings loaded
- [ ] ✅ Login button works (redirects to Kenni.is)

### Dashboard Page
- [ ] ✅ Redirects to login if not authenticated
- [ ] ✅ Shows dashboard after login
- [ ] ✅ i18n cache used (no refetch)
- [ ] ✅ Navigation works
- [ ] ✅ Membership status displays

### Profile Page (CRITICAL - Recently Fixed)
- [ ] ✅ Page loads WITHOUT "Missing required DOM elements" error
- [ ] ✅ Profile title displays ("Prófíll")
- [ ] ✅ Personal info displays
- [ ] ✅ Membership status displays
- [ ] ❌ ERROR: [describe if any]

### Test Events Page
- [ ] ✅ Page loads
- [ ] ✅ Auth badge shows "Auðkenndur"
- [ ] ✅ User info displays
- [ ] ✅ Health check works
- [ ] ✅ Election endpoint works
- [ ] ✅ Token request works
- [ ] ❌ ERROR: [describe if any]

### Overall Architecture
- [ ] ✅ Single Firebase import (check Network tab - one firebase-app.js load)
- [ ] ✅ i18n cache working (only loads once, reused on other pages)
- [ ] ✅ Navigation shared (no code duplication visible)
- [ ] ✅ DOM validation helpful (if error occurs, message is clear)

**Notes**:
[Any observations, performance issues, or suggestions]
```

---

## Common Issues & Fixes

### Issue 1: "Missing required DOM elements" on Profile Page

**Symptom**: Error in console, profile page doesn't load

**Cause**: Browser cached old version (before fix)

**Fix**:
1. Hard reload: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
2. Or clear cache: DevTools → Network tab → Disable cache checkbox
3. Verify version: Check HTML response, should have `id="profile-title"`

### Issue 2: "Using cached strings" doesn't appear

**Symptom**: i18n fetches XML on every page

**Cause**: Navigation between pages doesn't preserve cache

**Expected**: First page shows "Loaded X strings", subsequent pages show "Using cached strings"

**If broken**: Check browser console for errors in strings-loader.js

### Issue 3: Firebase App Check error

**Symptom**: "⚠️ Firebase App Check initialization failed"

**Impact**: Non-critical - app still works (degrades gracefully)

**Cause**: reCAPTCHA Enterprise not loaded yet

**Action**: Ignore warning if app works, or check Network tab for blocked requests

---

## Performance Verification

### Check Single Firebase Import

**How**:
1. Open DevTools → Network tab
2. Filter by "firebase"
3. Navigate between pages (index → dashboard → profile → test-events)

**Expected**:
- First page: Loads firebase-app.js, firebase-auth.js, firebase-functions.js
- Subsequent pages: **NO NEW FIREBASE REQUESTS** (cached!)

**If broken**:
- Each page loads Firebase from CDN → Old architecture still active
- Check HTML `<script>` tags - should use `/firebase/app.js` not CDN

### Check i18n Cache

**How**:
1. Open DevTools → Network tab
2. Filter by "strings.xml"
3. Navigate between pages

**Expected**:
- First page: Loads values-is/strings.xml (one request)
- Subsequent pages: **NO NEW XML REQUESTS** (cached!)

**If broken**:
- Each page fetches XML → strings-loader.js cache not working
- Check console for "Using cached strings" message

---

## Architecture Verification

### Verify New Architecture is Active

**Files to check in Network tab**:
- ✅ `/firebase/app.js` (loaded once, shared)
- ✅ `/session/auth.js` (pure session logic)
- ✅ `/session/init.js` (session initialization)
- ✅ `/ui/nav.js` (shared navigation)
- ✅ `/ui/dom.js` (DOM helpers)
- ✅ `/js/login.new.js` (login page logic)
- ✅ `/js/dashboard.new.js` (dashboard page logic)
- ✅ `/js/profile.new.js` (profile page logic)
- ✅ `/js/test-events.new.js` (test events page logic)

**Old files (should NOT be loaded)**:
- ❌ `/js/auth.js` (deprecated god module)
- ❌ `/js/page-init.js` (deprecated mixed concerns)
- ❌ `/js/login.js` (old version)
- ❌ `/js/dashboard.js` (old version)
- ❌ `/js/profile.js` (old version)
- ❌ `/js/test-events.js` (old version)

**If old files still loading**:
- HTML not updated to use `.new.js` modules
- Deployment didn't include updated HTML files
- Browser cache issue (hard reload)

---

## Next Steps After Testing

### If All Tests Pass ✅

1. **Document success** in testing results template
2. **Proceed to finalization**:
   - Delete old files (auth.js, page-init.js, login.js, dashboard.js, profile.js, test-events.js)
   - Rename .new.js files to .js
   - Update HTML to use final names
   - Final deployment

### If Profile Page Still Fails ❌

1. **Verify deployment version**:
   ```bash
   curl -s https://ekklesia-prod-10-2025.web.app/profile.html | grep 'profile-title'
   ```
   Should show: `<h1 class="page-title" id="profile-title">`

2. **Check browser cache**:
   - DevTools → Application tab → Clear storage
   - Hard reload (Ctrl+Shift+R)

3. **Check console error** - share exact error message

### If Other Pages Fail ❌

1. **Share console error** - exact error message
2. **Check Network tab** - which request failed?
3. **Verify authentication** - are you logged in?

---

## Testing Priority

**Priority 1** (CRITICAL):
1. ✅ Profile page (recently fixed)
2. ✅ Dashboard page (most used)
3. ✅ Login flow (OAuth callback)

**Priority 2** (Important):
4. ✅ Test events page (API testing)
5. ✅ Navigation between pages (cache verification)

**Priority 3** (Nice to have):
6. ✅ Performance (Firebase single import, i18n cache)
7. ✅ Error handling (helpful error messages)

---

**Last Updated**: 2025-10-15 21:20 UTC
**Deployment Version**: dbaac5154df9c557
**Status**: ✅ Ready for Testing

**Tester**: Please test and report results using template above! 🚀
