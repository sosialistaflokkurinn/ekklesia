# Election Feature i18n Checklist

**Purpose:** Internationalization requirements for election features
**Part of:** [Election Feature Development Guide](./OVERVIEW.md)
**Last Updated:** 2025-11-24

---

## 🌍 i18n (Internationalization)

### All User-Facing Text MUST Use i18n

**Location:** `/i18n/values-is/strings.xml`

**Checklist:**
- [ ] **NO hardcoded Icelandic text in HTML**
- [ ] **NO hardcoded Icelandic text in JavaScript**
- [ ] All strings added to `strings.xml` with descriptive names
- [ ] String names follow naming convention: `{page}_{element}_{purpose}`
- [ ] Strings tested with actual content (not Lorem Ipsum)

**Examples:**
```xml
<!-- Good naming convention -->
<string name="election_detail_title">Kosning</string>
<string name="election_status_active">Virk</string>
<string name="election_confirm_message">Ertu viss um að þú viljir kjósa þetta svar?</string>

<!-- Bad naming convention -->
<string name="text1">Kosning</string>
<string name="msg">Ertu viss?</string>
```

**JavaScript Usage:**
```javascript
import { R } from '../i18n/strings-loader.js';

// Good
document.getElementById('title').textContent = R.string.election_detail_title;

// Bad
document.getElementById('title').textContent = 'Kosning';
```

**Common i18n Strings Needed:**
- [ ] Page title
- [ ] Section headings
- [ ] Button labels (Submit, Cancel, Confirm, etc.)
- [ ] Status labels (Active, Closed, Upcoming)
- [ ] Error messages (Load failed, Network error, Validation errors)
- [ ] Success messages (Vote submitted, Saved successfully)
- [ ] Loading messages (Loading election..., Submitting vote...)
- [ ] Empty states (No elections available, No results yet)
- [ ] Confirmation messages (Are you sure...?)
- [ ] Help text / tooltips

---

## 🧪 i18n Testing

### Testing Checklist
- [ ] All text in Icelandic (no English leaking through)
- [ ] Dates formatted correctly (`6. nóvember 2025 kl. 13:30`)
- [ ] Numbers formatted correctly (Icelandic uses `.` for thousands)
- [ ] No console warnings about missing strings

### Common Issues & Solutions

**Issue: i18n strings showing as "Missing string key: ..."**
- [ ] Check string exists in `/i18n/values-is/strings.xml`
- [ ] Check string name matches exactly (case-sensitive)
- [ ] Check `R.load('is')` was called before using strings
- [ ] Hard refresh browser (Ctrl+Shift+R)

---

## 📚 Reference

### Related Files
- **Strings File:** `/i18n/values-is/strings.xml`
- **Loader:** `/i18n/strings-loader.js`
- **Usage:** `import { R } from '../i18n/strings-loader.js'`

### Related Checklists
- [Component Usage](./components-checklist.md) - Components use i18n strings
- [Testing](./testing-checklist.md) - i18n testing procedures
- [Overview](./OVERVIEW.md) - Back to main guide

---

**Last Updated:** 2025-11-24
**Maintained By:** Development Team
