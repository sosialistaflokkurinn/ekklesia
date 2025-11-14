# Data Quality Policy

**Document Type**: Development Policy
**Created**: 2025-11-03
**Status**: ✅ Active
**Purpose**: Define principles and patterns for balancing data quality with user experience

---

## Core Philosophy

### We optimize for **user completion** over **perfect input**.

Ekklesia is a voting and membership system for real people, not data entry clerks. Our goal is to help users complete tasks successfully, not to block them with pedantic validation.

**Guiding Principle**: If we can safely auto-correct user input, we should. If we can't, we should guide them clearly.

---

## Principles

### 1. Help, Don't Block

**Good**: Auto-correct common mistakes transparently
```
User types: "4512345678"
System shows: "+4512345678" (immediately, visibly)
Result: Form submits successfully
```

**Bad**: Show error and make user fix manually
```
User types: "4512345678"
System shows: "❌ Vinsamlegast byrjaðu á + og landskóða"
Result: User frustrated, may abandon form
```

**When to block**: Only when we truly cannot interpret user intent (e.g., invalid characters, impossible values)

### 2. Transparent, Not Silent

Users should see auto-corrections happen in real-time, not discover them after submission.

**Good**: Real-time visual feedback
```
User types: "Banda"
System shows: Dropdown with "Bandaríkin" highlighted
User selects: Input shows "Bandaríkin"
Result: User understands what was saved
```

**Bad**: Silent background changes
```
User types: "USA"
System stores: "US" (country code)
Result: User doesn't know what happened
```

**Exception**: Normalization for storage (e.g., removing hyphens from kennitala) can be silent if display format matches user expectation.

### 3. Reversible

Users should be able to override auto-corrections if we got it wrong.

**Good**: User retains control
```
System auto-prepends: "+" to phone number
User can delete "+": If they want to enter local format
System re-validates: On save, offer suggestion if needed
```

**Bad**: Forced corrections
```
User types: "123"
System prevents: Typing anything except digits
Result: User cannot enter valid edge case
```

### 4. Learn and Improve

Track where users struggle. Use data to improve UX, not to blame users.

**Metrics to track**:
- Which validation errors occur most often?
- Where do users abandon forms?
- What patterns appear in "invalid" data?

**Response**: Update auto-correction logic, not validation rules.

---

## Implementation Patterns

### Pattern 1: Auto-Prepend Required Prefix

**Use case**: International phone numbers require '+' prefix (E.164 format)

**Implementation**:
```javascript
// Real-time as user types
phoneInput.addEventListener('input', (e) => {
  let value = e.target.value;

  // If user starts typing digits, prepend +
  if (value.length > 0 && /^\d/.test(value)) {
    e.target.value = '+' + value;
    // Move cursor after the +
    e.target.setSelectionRange(value.length + 1, value.length + 1);
  }
});
```

**Why**: 99% of users don't know E.164 format. We know they need '+', so we add it.

**User sees**: Immediate visual feedback, understands format requirement

**Data quality**: Guaranteed E.164 format in database

### Pattern 2: Flexible Search with Autocomplete

**Use case**: Country selection should accept multiple input formats

**Implementation**:
```javascript
// Search by: Icelandic name, English name, OR country code
function searchCountries(query) {
  return countries.filter(c =>
    c.nameIs.includes(query) ||  // "Banda" → Bandaríkin
    c.nameEn.includes(query) ||  // "United" → Bandaríkin
    c.code.includes(query)       // "US" → Bandaríkin
  );
}
```

**Why**: Users think in different languages and contexts. Meet them where they are.

**User sees**: Relevant results regardless of how they search

**Data quality**: Store ISO codes (consistent), display localized names (readable)

### Pattern 3: Format on Display, Store Canonical

**Use case**: Phone numbers have many valid display formats, but one storage format

**Implementation**:
```javascript
// Storage: E.164 format (international standard)
database.phone = "+354-999-9999";  // 12 chars, + prefix

// Display: Localized format (Icelandic convention)
displayPhone = formatPhone(phone);  // "999-9999" (8 chars, hyphen)
```

**Why**: Storage optimizes for interoperability, display optimizes for readability

**User sees**: Familiar format (Icelandic: XXX-XXXX)

**Data quality**: International standard (E.164) enables SMS, WhatsApp integration

### Pattern 4: Validate Intent, Not Format

**Use case**: Postal codes vary wildly by country

**Bad**: Strict validation
```javascript
// Too strict - breaks for international users
if (!/^\d{3}$/.test(postalCode)) {
  return "Póstnúmer verður að vera 3 tölustafir";
}
```

**Good**: Validate reasonableness
```javascript
// Flexible - accepts international formats
if (postalCode.length < 3 || postalCode.length > 16) {
  return "Póstnúmer virðist of stutt eða of langt";
}

// Even better: Country-specific validation when possible
if (country === 'IS' && !/^\d{3}$/.test(postalCode)) {
  return "Íslenskt póstnúmer á að vera 3 tölustafir";
}
```

**Why**: We know user intent (enter postal code), format varies by country

**User sees**: Helpful, context-aware guidance

**Data quality**: Reasonable bounds, not artificial constraints

---

## Domain-Specific Policies

### Foreign Phone Numbers

**Format requirement**: E.164 (starts with '+', country code, then number)

**Auto-correction**:
- ✅ Auto-prepend '+' when user types digits
- ✅ Real-time (as user types)
- ✅ Visible to user

**Validation**:
- ✅ Require '+' prefix (after auto-correction)
- ✅ Minimum 5 digits total (very permissive)
- ❌ No specific country code validation (too complex, too brittle)

**Display format**: Keep user formatting (spaces, hyphens) for readability

**Rationale**: E.164 enables future SMS/WhatsApp features, but most users don't know this format. Help them by auto-correcting.

### Country Selection

**Storage format**: ISO 3166-1 alpha-2 code (e.g., "US", "DK", "IS")

**Search flexibility**:
- ✅ Icelandic name (Bandaríkin)
- ✅ English name (United States)
- ✅ Country code (US)

**Display format**: Full Icelandic name (readable, unambiguous)

**Interaction pattern**: Autocomplete dropdown (like Google search)

**Rationale**: Users think in different contexts. Someone living in Denmark might type "DK", while someone thinking in Icelandic types "Dan". Both should work.

### Postal Codes (International)

**Storage format**: String, 3-16 characters, may include spaces/hyphens

**Validation**: Country-specific when possible, generic bounds otherwise

**Auto-correction**: Trim whitespace, preserve internal spaces/hyphens

**Rationale**: Postal code formats vary dramatically by country. Validate intent (reasonable length), not format (country-specific rules).

### Kennitala (Icelandic National ID)

**Format requirement**: DDMMYY-XXXX (10 digits, hyphen after 6th)

**Auto-correction**:
- ✅ Auto-format with hyphen on display (999999-9999)
- ✅ Store without hyphen for querying (9999999999)
- ❌ No auto-correction of digits (too risky - these are identity)

**Validation**:
- ✅ Exactly 10 digits
- ❌ No checksum validation (Kenni.is OAuth already validated it)

**Rationale**: Kennitala is authoritative identity. Display nicely, but don't modify.

---

## Anti-Patterns (What NOT To Do)

### ❌ Silent Data Mutation After Submission

**Bad**:
```javascript
// User submits form
const data = getFormData();
// Silently "fix" data behind the scenes
data.phone = normalizePhone(data.phone);  // User doesn't see this
saveToDatabase(data);
```

**Why bad**: User doesn't know what was saved. If something goes wrong, they can't debug it.

**Better**: Show normalized format before submission, or auto-correct in real-time.

### ❌ Overly Strict Validation

**Bad**:
```javascript
// Reject valid international phone numbers because format is "wrong"
if (!phone.match(/^\+354\d{7}$/)) {
  return "Símanúmer verður að vera íslenskt (+354 XXX-XXXX)";
}
```

**Why bad**: Ekklesia has users living abroad. Rejecting valid foreign phones blocks real users.

**Better**: Accept E.164 format (any country code), validate reasonableness.

### ❌ Cryptic Error Messages

**Bad**:
```
"Invalid input format"
"Validation failed: field.phone"
"Error code: ERR_PHONE_001"
```

**Why bad**: User doesn't know what's wrong or how to fix it.

**Better**:
```
"Símanúmer þarf að byrja á + og landskóða (t.d. +45 12345678)"
"Íslensk símanúmer: 7 tölustafir (t.d. 000-0000)"
```

### ❌ Blocking Valid Edge Cases

**Bad**:
```javascript
// Force specific format
phoneInput.addEventListener('keypress', (e) => {
  if (!/\d/.test(e.key)) {
    e.preventDefault();  // Block all non-digits
  }
});
```

**Why bad**: Blocks '+' prefix, spaces, hyphens (all valid in E.164)

**Better**: Accept any characters, validate on blur/submit

---

## Testing Checklist for Data Quality Features

When implementing auto-corrections or flexible validation:

### Functionality
- [ ] Auto-correction happens in real-time (visible to user)
- [ ] User can override auto-correction if needed
- [ ] Validation passes after auto-correction
- [ ] Edge cases handled (empty input, very long input, special chars)
- [ ] Data saves correctly to database (canonical format)

### User Experience
- [ ] User understands what the system did (transparent)
- [ ] Error messages are helpful, not cryptic
- [ ] User can complete form without external knowledge (e.g., what E.164 is)
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Touch interaction works on mobile

### Data Quality
- [ ] Stored data follows canonical format (e.g., E.164 for phones, ISO codes for countries)
- [ ] Stored data is query-able (no random formats)
- [ ] Displayed data is readable (localized, formatted)
- [ ] Round-trip works (load → display → edit → save → reload)

### Accessibility
- [ ] Screen reader announces changes (ARIA live regions)
- [ ] Keyboard-only navigation works
- [ ] Focus indicators visible
- [ ] Labels associated with inputs

---

## Decision Framework

When adding new validation or auto-correction, ask:

### 1. What is the user's intent?
*Example*: User wants to enter their foreign phone number so they can be contacted.

### 2. What format do we need for storage?
*Example*: E.164 format (+[country][number]) for SMS/WhatsApp integration.

### 3. What format will the user naturally enter?
*Example*: Whatever format they're used to (maybe "45 12345678" without '+')

### 4. Can we safely auto-correct from (3) to (2)?
*Example*: Yes - we can prepend '+' if first char is a digit.

### 5. Is the auto-correction visible to the user?
*Example*: Yes - happens in real-time as they type.

### 6. Can the user override if we got it wrong?
*Example*: Yes - they can delete the '+' if needed.

**If you answered Yes to 4-6**: Implement auto-correction. ✅
**If any answer is No**: Consider if validation should be more flexible, or if error guidance should be improved.

---

## Examples from Ekklesia

### ✅ Good: Foreign Phone Auto-Prepend

**User intent**: Enter phone number to be contacted
**Storage format**: E.164 (+[country][number])
**Natural format**: "4512345678" (digits only)
**Auto-correct**: Prepend '+' → "+4512345678"
**Visible**: Yes (real-time)
**Reversible**: Yes (user can delete '+')

**Result**: ✅ Implement auto-correction

### ✅ Good: Country Autocomplete

**User intent**: Select country where they live
**Storage format**: ISO code ("DK")
**Natural format**: "Danmark" or "Denmark" or "DK" (varies)
**Auto-correct**: Map search term → country code
**Visible**: Yes (dropdown shows options)
**Reversible**: Yes (user can re-search)

**Result**: ✅ Implement flexible search

### ❌ Bad: Auto-Correct Kennitala

**User intent**: Verify their identity
**Storage format**: 10 digits
**Natural format**: "999999-9999" or "9999999999"
**Auto-correct**: ??? (can't fix typos - too risky)
**Visible**: Yes (but what if we guess wrong?)
**Reversible**: Yes (but damage already done - wrong person identified)

**Result**: ❌ Do NOT auto-correct (only auto-format hyphen for display)

### ✅ Good: Auto-Format Phone Display

**User intent**: See their phone number
**Storage format**: "+354-999-9999" (E.164)
**Natural format**: "999-9999" (Icelandic convention)
**Auto-correct**: Format for display only, don't modify stored data
**Visible**: Yes (user sees formatted version)
**Reversible**: N/A (display-only, storage unchanged)

**Result**: ✅ Implement display formatting

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-03 | Initial policy document created |

---

## References

- [DJANGO_FOREIGN_ADDRESS_REQUIREMENTS.md](../requirements/DJANGO_FOREIGN_ADDRESS_REQUIREMENTS.md) - Backend data requirements
- [E.164 International Phone Format](https://en.wikipedia.org/wiki/E.164) - ITU-T standard
- [ISO 3166-1 Country Codes](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2) - International standard
- [Icelandic Postal Codes](https://www.postur.is/en/individuals/zip-codes/) - Íslandspóstur

---

**Last Updated**: 2025-11-03
**Status**: ✅ Active - Required reading for frontend development
**Next Review**: After first user testing session
