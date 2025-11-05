# I18N Post-Deployment Testing Checklist

**Date**: 2025-11-05
**Deployment**: feature/epic-159-profile-and-admin-ui
**Focus**: Verify all new i18n strings display correctly

---

## 🎯 Critical Tests

### Modal Dialogs

**Test 1: Member Edit Cancel Modal**
- [ ] Navigate to `/admin/member-edit.html?id=<kennitala>`
- [ ] Click "Hætta við" button
- [ ] **Expected**: Modal shows:
  - Title: "Hætta við breytingar?"
  - Message: "Allar óvistaðar breytingar munu tapast."
  - Confirm button: "Hætta við"
  - Cancel button: "Halda áfram að breyta"
- [ ] **NOT**: Any hardcoded text or "Loading..."

**Test 2: Sync Members Confirmation Modal**
- [ ] Navigate to `/admin/sync-members.html`
- [ ] Click "Keyra samstillingu" button
- [ ] **Expected**: Modal shows:
  - Title: "Keyra samstillingu?"
  - Message: "Þetta mun sækja öll gögn frá Django og uppfæra Firestore."
  - Confirm button: "Keyra sync"
- [ ] **NOT**: Any hardcoded text

---

### Admin Members List Dropdowns

**Test 3: Status Filter Dropdown**
- [ ] Navigate to `/admin/members.html`
- [ ] Open status filter dropdown
- [ ] **Expected**: Options show:
  - "Allir" (not "Loading...")
  - "Virkir" (not "Loading...")
  - "Óvirkir" (not "Loading...")
- [ ] **NOT**: "Loading..." text

**Test 4: Electoral District Filter Dropdown**
- [ ] On same page, open district filter dropdown
- [ ] **Expected**: Options show:
  - "Öll kjördæmi"
  - "Reykjavíkurkjördæmi"
  - "Suðvesturkjördæmi"
  - "Suðurkjördæmi"
  - "Norðvesturkjördæmi"
  - "Norðausturkjördæmi"
- [ ] **NOT**: "Loading..." text

**Test 5: Table Headers**
- [ ] On same page, verify table headers show:
  - "Django ID" (not "Loading...")
  - "Nafn" (not "Loading...")
  - "Netfang" (not "Loading...")
  - "Kennitala" (not "Loading...")
  - "Sími" (not "Loading...")
  - "Staða" (not "Loading...")
  - "Aðgerðir" (not "Loading...")

**Test 6: Empty State**
- [ ] Apply filters that return no results
- [ ] **Expected**: "Engir félagar fundust" (not "Loading...")

**Test 7: Retry Button**
- [ ] Disconnect network, trigger error state
- [ ] **Expected**: Button shows "Reyna aftur" (not "Loading...")

---

### Profile Error Messages

**Test 8: Profile Phone Delete Button**
- [ ] Navigate to `/members-area/profile.html`
- [ ] Hover over phone delete button (🗑️)
- [ ] **Expected**: Tooltip shows "Eyða símanúmeri"
- [ ] **NOT**: "Eyða símanúmeri" hardcoded or missing

**Test 9: Profile Address Delete Button**
- [ ] On same page, hover over address delete button (🗑️)
- [ ] **Expected**: Tooltip shows "Eyða heimilisfangi"

**Test 10: Profile Save Error**
- [ ] Try to save invalid data (e.g., invalid email)
- [ ] **Expected**: Error toast shows proper Icelandic from R.string
- [ ] **NOT**: Hardcoded "Villa við vistun í Django..."

**Test 11: Autosave Error**
- [ ] Trigger autosave error (disconnect network mid-edit)
- [ ] **Expected**: Error toast shows "Villa við vistun"
- [ ] **NOT**: Hardcoded fallback text

**Test 12: Phone Save Error**
- [ ] Try to save invalid phone number
- [ ] **Expected**: Error shows "Villa við vistun símanúmers"
- [ ] **NOT**: Hardcoded text with `|| 'fallback'`

**Test 13: Address Save Error**
- [ ] Try to save invalid address
- [ ] **Expected**: Error shows "Villa við vistun heimilisfangs"

---

### API Error Messages

**Test 14: Django Update Error**
- [ ] Trigger Django API error (invalid data or network issue)
- [ ] **Expected**: Error message format: "Villa við uppfærslu Django gagnagrunns: [error details]"
- [ ] Uses `R.format()` correctly with %s placeholder

**Test 15: Django Foreign Address Error**
- [ ] Trigger foreign address update error
- [ ] **Expected**: Error format: "Villa við uppfærslu Django erlends heimilisfangs: [error details]"

---

## 🟢 Secondary Tests

### Browser Console Check
- [ ] Open browser console (F12)
- [ ] Navigate through all tested pages
- [ ] **Expected**: No JavaScript errors
- [ ] **Expected**: No "string not found" warnings
- [ ] **Expected**: No TypeScript errors

### Network Tab Check
- [ ] Open Network tab
- [ ] Verify `strings.xml` loads successfully:
  - `/admin/i18n/values-is/strings.xml` (200 OK)
  - `/i18n/values-is/strings.xml` (200 OK)
- [ ] No 404 errors for i18n files

### Accessibility Check
- [ ] All modal dialogs have proper ARIA labels
- [ ] All dropdowns have proper labels
- [ ] Screen reader announces modal text correctly

---

## 🔴 Known Issues to Watch For

1. **"Loading..." persists**: JavaScript failed to load strings.xml
   - Check Network tab for 404
   - Check console for XML parsing errors

2. **Hardcoded text still visible**: Cache issue
   - Hard refresh: Ctrl+Shift+R (Chrome) or Ctrl+F5 (Firefox)
   - Clear browser cache

3. **Modal shows wrong text**: String key mismatch
   - Verify strings.xml has correct key names
   - Check JS uses matching key

4. **Dropdown empty**: JavaScript error in applyStrings()
   - Check console for errors
   - Verify members-list.js loaded

5. **Error messages in English**: R.string not loaded yet
   - Check if error thrown before strings.xml loaded
   - Verify R.load() completes before user actions

---

## 📊 Test Results Template

```
Date: ______
Tester: ______
Environment: Production / Staging

Modal Dialogs:          [ ] Pass  [ ] Fail
Dropdowns:             [ ] Pass  [ ] Fail  
Table Headers:         [ ] Pass  [ ] Fail
Error Messages:        [ ] Pass  [ ] Fail
API Errors:            [ ] Pass  [ ] Fail
Console Clean:         [ ] Pass  [ ] Fail

Issues Found:
1. ___________________
2. ___________________

Overall: [ ] ✅ PASS  [ ] ❌ FAIL
```

---

## 🚨 Rollback Plan

If critical issues found:

1. **Immediate**: Revert to previous deployment
2. **Investigate**: Check browser console logs
3. **Fix**: Update strings.xml or JavaScript
4. **Redeploy**: After local testing

---

## ✅ Success Criteria

- [ ] All 15 critical tests pass
- [ ] No JavaScript errors in console
- [ ] No hardcoded Icelandic visible
- [ ] All strings load from strings.xml
- [ ] Modals display correct Icelandic
- [ ] Dropdowns populate correctly
- [ ] Error messages use R.string/R.format()
- [ ] User experience identical to before (just i18n-compliant)

---

**Next Steps After Testing**:
1. Document any issues found
2. Update CHANGELOG.md
3. Close i18n audit GitHub issue
4. Plan English translation (values-en/strings.xml)
