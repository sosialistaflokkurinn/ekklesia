# PII-Safe Examples Guide

**Last Updated:** 2025-11-06
**Purpose:** Prevent accidental PII exposure in code, docs, commits, and issues

---

## Always Use These Safe Examples

### Kennitalas (Icelandic National IDs)

**❌ NEVER use:**
- Real kennitalas (even if they look fake)
- Pattern-based examples like `010101-2980` (could be real)

**✅ ALWAYS use:**
- Format descriptors: `DDMMYY-XXXX` or `DDMMYYXXXX`
- Obviously fake: `123456-7890`
- Masked: `XXXXXX-****`

### Phone Numbers

**❌ NEVER use:**
- Real-looking numbers: `775-8493`

**✅ ALWAYS use:**
- Format descriptors: `XXX-XXXX`
- Reserved test range: `555-0100` to `555-0199` (North American standard)
- Masked: `***-****`

### Email Addresses

**❌ NEVER use:**
- Real emails: `user@example.is`

**✅ ALWAYS use:**
- RFC 2606 reserved domains: `user@example.com`, `test@example.org`
- Format descriptor: `email@domain.tld`
- Masked: `user@***.***`

### Names

**❌ NEVER use:**
- Real names from database or screenshots

**✅ ALWAYS use:**
- Generic placeholders: `Jón Jónsson`, `Anna Pálsdóttir`
- Test patterns: `Test User`, `Example Member`
- Format descriptors: `[Name]`, `[Full Name]`

---

## Commit Message Safety

### Before Committing:

```bash
# Check for kennitalas (10 digits)
git diff --cached | grep -E "[0-9]{10}"

# Check for kennitalas with hyphen (DDMMYY-XXXX)
git diff --cached | grep -E "[0-9]{6}-[0-9]{4}"

# Check for phone numbers (7 digits)
git diff --cached | grep -E "[0-9]{3}-[0-9]{4}"

# Check for emails
git diff --cached | grep -E "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
```

### Commit Message Template:

```
type(scope): description

Example data patterns:
- Kennitala: DDMMYY-XXXX → DDMMYYXXXX
- Phone: XXX-XXXX
- Email: user@example.com

Related: #issue-number
```

---

## GitHub Issue Safety

### Creating Issues:

**Before submitting:**
1. Search for kennitalas: `[0-9]{10}` or `[0-9]{6}-[0-9]{4}`
2. Search for phone numbers: `[0-9]{3}-[0-9]{4}`
3. Search for emails
4. Replace with format descriptors

**Example:**

```markdown
## Problem
User with kennitala `DDMMYY-XXXX` has duplicate profile.

## Expected
Document ID should be `/members/DDMMYYXXXX/`
```

---

## Code Comment Safety

**❌ NEVER:**
```javascript
// Example: 010101-2980 → 0101012980
// Test with phone: 775-8493
```

**✅ ALWAYS:**
```javascript
// Example: DDMMYY-XXXX → DDMMYYXXXX
// Test with phone: XXX-XXXX or 555-1234
```

---

## Documentation Safety

**In README, guides, and docs:**
- Use format descriptors: `DDMMYY-XXXX`
- Use reserved test data: `555-0100`
- Never copy/paste from real database queries
- Never include screenshots with real PII (blur/mask first)

---

## Pre-commit Hook

Add to `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: local
    hooks:
      - id: check-pii
        name: Check for PII in staged files
        entry: bash -c 'if git diff --cached | grep -qE "([0-9]{6}-[0-9]{4}|[0-9]{10}|[0-9]{3}-[0-9]{4})"; then echo "⚠️ Potential PII detected (kennitala or phone)"; exit 1; fi'
        language: system
        pass_filenames: false
```

---

## Emergency PII Removal

**If PII is already in git history:**

```bash
# Amend last commit (if not pushed)
git commit --amend

# Amend last commit (if pushed but no one else has fetched)
git commit --amend
git push --force-with-lease origin branch-name

# If multiple commits or already pulled by others:
# Contact repository admin to run git-filter-repo or BFG Repo-Cleaner
```

**If PII is in GitHub issues:**

```bash
# Edit issue immediately
gh issue edit <number> --body "sanitized content"

# If in comments, delete comment and recreate
gh issue comment <number> delete <comment-id>
```

---

## Related

- `.pre-commit-config.yaml` - PII detection hooks
- `DATA_FORMAT_CONVENTIONS.md` - Storage vs display formats

---

**Remember:** When in doubt, mask it out! Better safe than sorry.
