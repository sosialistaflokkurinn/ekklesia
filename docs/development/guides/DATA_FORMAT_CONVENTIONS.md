# Data Format Conventions

**Last Updated:** 2025-11-06
**Status:** ✅ Active - Required for all code

---

## Overview

This document defines how sensitive data (kennitalas, phone numbers, etc.) should be stored and displayed throughout the Ekklesia system.

**Core Principle:**
- **Storage:** Normalized format (no special characters)
- **Display:** Human-readable format (with formatting)

---

## Kennitala (Icelandic National ID)

### Storage Format (Database/Firestore)

**Always store without hyphen:**

```
0101012980  ✅ CORRECT
010101-2980 ❌ WRONG
```

**Why:**
1. Simplifies database queries (no need to handle both formats)
2. Prevents duplicate documents (one format = one document ID)
3. Consistent with admin UI expectations (fixed in commit 99a5b23)
4. Standard practice for storing national IDs

**Implementation:**

```python
def normalize_kennitala(kennitala: str) -> str:
    """
    Normalize kennitala to 10 digits without hyphen.

    Example: "010101-2980" -> "0101012980"
    """
    return kennitala.strip().replace('-', '')
```

```javascript
function normalizeKennitala(kennitala) {
    return kennitala.replace(/-/g, '');
}
```

### Display Format (Web UI)

**Always display with hyphen:**

```
010101-2980  ✅ CORRECT for display
0101012980   ❌ Less readable
```

**Implementation:**

```javascript
function formatKennitalaForDisplay(kennitala) {
    // Remove any existing hyphens first
    const normalized = kennitala.replace(/-/g, '');

    // Add hyphen after 6th character
    if (normalized.length === 10) {
        return `${normalized.slice(0, 6)}-${normalized.slice(6)}`;
    }

    return kennitala; // Return as-is if invalid format
}
```

**Usage in UI:**

```html
<!-- Store without hyphen -->
<input id="kennitala-input" value="0101012980" />

<!-- Display with hyphen -->
<span id="kennitala-display">010101-2980</span>
```

### Masking for PII Protection

When logging or displaying in public contexts:

```
010101-****  ✅ CORRECT (first 6 digits + masked)
******-2980  ❌ Last 4 digits alone don't provide anonymity
```

**Implementation:**

```python
def mask_kennitala(kennitala: str) -> str:
    """Mask last 4 digits for logging."""
    normalized = normalize_kennitala(kennitala)
    return f"{normalized[:6]}-****"
```

---

## Phone Numbers (Icelandic)

### Storage Format

**Always store with hyphen (XXX-XXXX):**

```
775-8493  ✅ CORRECT
7758493   ❌ Less readable
```

**Why:**
- Icelandic convention is 3-4 digit format
- Already normalized in sync_members.py

**Implementation:**

```python
def normalize_phone(phone: str) -> str:
    """
    Normalize Icelandic phone to XXX-XXXX format.

    Example: "7758493" -> "775-8493"
    """
    # Remove any non-digits
    digits = ''.join(c for c in phone if c.isdigit())

    # Add hyphen after 3rd digit
    if len(digits) == 7:
        return f"{digits[:3]}-{digits[3:]}"

    return phone  # Return as-is if not 7 digits
```

### Display Format

**Display exactly as stored:**

```
775-8493  ✅ CORRECT
```

### International Phone Numbers

**Store as-is (with country code):**

```
+45 12345678  ✅ CORRECT
+354 775-8493 ✅ CORRECT
```

---

## Document IDs in Firestore

### Members Collection

**Always use normalized kennitala (no hyphen):**

```
/members/0101012980/          ✅ CORRECT
/members/010101-2980/         ❌ WRONG (causes duplicates)
```

**Example:**

```python
# sync_members.py (line 330-336)
normalized_kennitala = normalize_kennitala(kennitala)
member_ref = db.collection('members').document(normalized_kennitala)
member_ref.set(firestore_doc, merge=True)
```

```javascript
// member-detail.js (line 210)
const kennitalaNoHyphen = currentKennitala.replace(/-/g, '');
const docRef = doc(db, 'members', kennitalaNoHyphen);
```

### Audit Logs

**Use timestamp + admin ID + action + kennitala:**

```
1762393896602_system_create_0101012980  ✅ CORRECT
```

**Format:**

```python
timestamp_ms = int(datetime.now().timestamp() * 1000)
log_id = f"{timestamp_ms}_{admin_id}_{action}_{normalized_kennitala}"
```

---

## Data in Firestore Documents

### Profile Section

**Store kennitala WITHOUT hyphen:**

```json
{
  "profile": {
    "kennitala": "0101012980",     // ✅ No hyphen
    "name": "Jón Jónsson",
    "phone": "775-8493",           // ✅ With hyphen (Icelandic convention)
    "email": "jon@example.com"
  }
}
```

### Address Section

**Store postal code WITHOUT hyphen:**

```json
{
  "address": {
    "street": "Laugavegur",
    "number": 1,
    "postal_code": "101",          // ✅ 3 digits, no formatting
    "city": "Reykjavík"
  }
}
```

---

## Migration Notes

### Issue #166: Duplicate Kennitalas

**Root Cause:** `normalize_kennitala()` was ADDING hyphens instead of REMOVING them.

**Affected Commits:**
- Fix: `c69c1c1` (2025-11-06) - sync_members.py and main.py
- Fix: `99a5b23` (2025-11-03) - admin UI normalization

**Resolution:**
1. Fixed `normalize_kennitala()` in both files
2. Delete all `/members` documents in Firestore
3. Run fresh sync from Django
4. All new documents use normalized format (no hyphens)

**Before Fix:**
```
/members/010101-2980/  ❌ (created by sync)
/members/0101012980/   ❌ (created by admin UI)
                       Result: 2 documents for same person!
```

**After Fix:**
```
/members/0101012980/   ✅ (both sync and admin UI use same format)
```

---

## Testing Checklist

When implementing features that handle kennitalas:

- [ ] Storage: Kennitala normalized (no hyphen) before saving to Firestore
- [ ] Display: Kennitala formatted (with hyphen) in UI
- [ ] Queries: Use normalized format for document IDs
- [ ] Logging: Mask last 4 digits (`010101-****`)
- [ ] Validation: Accept both formats from user input, normalize before processing

---

## Related Documentation

- [DUPLICATE_SSN_CLEANUP_2025-10-26.md](../../migration/DUPLICATE_SSN_CLEANUP_2025-10-26.md) - Django cleanup of 9999 prefix duplicates
- [Issue #166](https://github.com/sosialistaflokkurinn/ekklesia/issues/166) - Duplicate Firestore documents

---

## Code Locations

### Python Functions

- `services/members/functions/sync_members.py:20-36` - normalize_kennitala()
- `services/members/functions/main.py:95-111` - normalize_kennitala()
- `services/members/functions/sync_members.py:39-58` - normalize_phone()

### JavaScript UI

- `apps/members-portal/admin/js/api/members-api.js:160` - kennitala normalization
- `apps/members-portal/admin/js/member-detail.js:210` - kennitala normalization
- `apps/members-portal/admin/js/member-edit.js:259` - kennitala normalization
- `apps/members-portal/admin/js/member-profile.js:94,323` - kennitala normalization

---

**Last Updated:** 2025-11-06
**Status:** ✅ Active - Follow these conventions in all new code
