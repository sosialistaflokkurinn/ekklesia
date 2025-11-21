# Data Normalization Policy

## 🎯 General Rule

**All personal identifiers are stored NORMALIZED in database and FORMATTED for display in UI.**

```
Storage:  No hyphens, spaces, or formatting
Display:  User-friendly formatting with hyphens
```

## 📋 Data Types

### Kennitala (Icelandic National ID)

| Context  | Format       | Example      | Function                |
|----------|--------------|--------------|-------------------------|
| Database | 10 digits    | `0103882369` | `normalize_kennitala()` |
| Web UI   | DDMMYY-XXXX  | `010388-2369`| `format_kennitala()`    |

**Storage locations**:
- `/users/{uid}/kennitala` (auth users)
- `/members/{kennitala}/profile.kennitala` (member data)

### Phone Number (Icelandic)

| Context  | Format       | Example   | Function            |
|----------|--------------|-----------|---------------------|
| Database | 7 digits     | `6903635` | `normalize_phone()` |
| Web UI   | XXX-XXXX     | `690-3635`| `format_phone()`    |

**Storage locations**:
- `/users/{uid}/phoneNumber` (auth users)
- `/members/{kennitala}/profile.phone` (member data)

## 🔧 Code Implementation

### Validators (`services/members/functions/shared/validators.py`)

**Normalization (for database writes)**:
```python
from shared.validators import normalize_kennitala, normalize_phone

# Before storing in database:
user_data = {
    'kennitala': normalize_kennitala(input_kennitala),  # "010388-2369" → "0103882369"
    'phoneNumber': normalize_phone(input_phone)         # "690-3635" → "6903635"
}
```

**Formatting (for UI display)**:
```python
from shared.validators import format_phone

# Before displaying in web UI:
displayed_phone = format_phone(db_phone)  # "6903635" → "690-3635"
```

## 📊 Data Migration

### Current State (Nov 14, 2025)

**Problem**: Existing data has mixed formats:
- Some users created BEFORE normalization fixes have hyphens in database
- Some users created AFTER normalization fixes are normalized

### Required Migrations

#### 1. Kennitala Normalization
- **Script**: `services/members/scripts/migrate-kennitala-normalization.js`
- **Collections**: `/users/`
- **Action**: Remove hyphens from kennitala field
- **Duplicates**: Merge users with same normalized kennitala

#### 2. Phone Number Normalization
- **Script**: (To be created)
- **Collections**: `/users/`, `/members/`
- **Fields**: `phoneNumber`, `profile.phone`
- **Action**: Remove hyphens from phone fields

## ✅ Checklist for New Features

When implementing new features that handle personal data:

- [ ] Use `normalize_*()` functions before database writes
- [ ] Use `format_*()` functions before UI display
- [ ] Never store formatted data in database
- [ ] Add validation to ensure correct format
- [ ] Test with both formatted and unformatted input

## 🚨 Common Mistakes to Avoid

❌ **DON'T**:
```python
# Storing formatted data
user_data['kennitala'] = "010388-2369"  # WRONG!
user_data['phoneNumber'] = "690-3635"   # WRONG!

# Displaying raw database data
<span>{user.kennitala}</span>  # WRONG! Shows "0103882369"
```

✅ **DO**:
```python
# Store normalized
user_data['kennitala'] = normalize_kennitala(input)  # "0103882369"

# Display formatted
<span>{format_kennitala(user.kennitala)}</span>  # "010388-2369"
```

## 📚 Related Documentation

- `/services/members/functions/shared/validators.py` - Normalization functions
- `/services/members/scripts/migrate-kennitala-normalization.js` - Migration script
- `/docs/troubleshooting/DUPLICATE_USER_KENNITALA_ISSUE.md` - Kennitala issue

---

**Last Updated**: 2025-11-14
**Policy Version**: 1.0
**Status**: Active
