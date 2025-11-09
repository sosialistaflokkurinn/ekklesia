# Local-Only Files (Not in Git)

**Document Type**: Development Reference
**Last Updated**: 2025-11-09
**Status**: ✅ Active - Living Document
**Purpose**: Catalog all files that are gitignored and exist only on local machines

---

## Overview

This document lists all files and directories that are intentionally kept out of git version control. These files are defined in `.gitignore` and serve various purposes including security, privacy, and personal development workflow.

**Related**: See [GITIGNORE_STRATEGY.md](guides/GITIGNORE_STRATEGY.md) for the overall strategy.

---

## Security & PII Protection

### Markdown Files with Sensitive Data

**Pattern**: `*KENNITALA*.md`, `*kennitala*.md`, `*DUPLICATE_SSN*.md`, `*DJANGO_KENNITALA*.md`, `*pii_redaction*.md`

**Purpose**: Prevent accidental commit of documents containing Icelandic national IDs (kennitölur) or other personally identifiable information (PII).

**Examples**:
```
docs/migration/KENNITALA_MIGRATION_2025-10-26.md
docs/debugging/DUPLICATE_SSN_ANALYSIS.md
services/members/scripts/pii_redaction_report.md
```

**Why**: These files are typically created during:
- Migration planning with real member data
- Debugging production issues with PII
- Data cleanup operations
- Testing with actual kennitölur

**Best Practice**: Use fake/sanitized data in committed docs, keep real data local only.

---

## Policy & Meeting Documentation

### Immigration Policy Meeting Notes

**File**: `docs/policy/IMMIGRATION_POLICY_MEETING_2025-11-08.md`

**Purpose**: Meeting notes from policy discussions that may contain:
- Personal opinions of members
- Sensitive political discussions
- Draft policy positions not yet public
- Member participation lists

**Why Local Only**:
- Contains personal information about meeting attendees
- Draft policies that are not finalized
- Internal political discussions

**Location**: `/docs/policy/IMMIGRATION_POLICY_MEETING_2025-11-08.md`

**Created**: 2025-11-07 13:23
**Size**: ~23KB

---

## Member Services Scripts

### User Login Tracking Scripts

**Files**:
- `services/members/scripts/check-user-logins.js`
- `services/members/scripts/check-logins-today.js`

**Purpose**: Administrative scripts for checking user login activity in Firestore.

**Why Local Only**:
- These scripts query production Firestore directly
- May contain hardcoded test kennitölur
- Could expose PII if misused
- Intended for local admin use only

**Usage**:
```bash
# Check logins for specific user
node services/members/scripts/check-user-logins.js <kennitala>

# Check all logins today
node services/members/scripts/check-logins-today.js
```

**Security Note**: These scripts require Firebase Admin credentials and should never be committed.

---

## Public Directories

### Members Public Directory

**Path**: `services/members/public/`

**Purpose**: Public-facing static assets for member services (if needed).

**Why Local Only**: Currently not used in production architecture. If created locally for testing, should not be committed.

**Status**: Directory may not exist; ignore pattern is preventative.

---

## Maintenance

### How to Add New Local-Only Files

When you create a file that should remain local:

1. **Add to `.gitignore`**:
   ```bash
   echo "path/to/your/file.md" >> .gitignore
   ```

2. **Update this document** with:
   - File path or pattern
   - Purpose/reason
   - When/why it was created
   - Any security considerations

3. **Verify it's ignored**:
   ```bash
   git check-ignore -v path/to/your/file.md
   # Should show: .gitignore:line_number:pattern    path/to/your/file.md
   ```

### Audit Local-Only Files

Periodically review what files are gitignored:

```bash
# List all ignored .md files in docs/
find docs -name "*.md" -type f -exec git check-ignore -q {} \; -print

# List all ignored files in services/members/scripts/
find services/members/scripts -type f -exec git check-ignore -q {} \; -print

# Check specific patterns
git status --ignored --porcelain | grep "^!! .*\.md$"
```

---

## Current Inventory

### As of 2025-11-09

**Policy Documents**: 1 file
- `docs/policy/IMMIGRATION_POLICY_MEETING_2025-11-08.md` (23KB, created 2025-11-07)

**Member Scripts**: 2 files (if they exist locally)
- `services/members/scripts/check-user-logins.js`
- `services/members/scripts/check-logins-today.js`

**Wildcard Patterns**: 5 patterns
- `*KENNITALA*.md` (matches 0 files currently)
- `*kennitala*.md` (matches 0 files currently)
- `*DUPLICATE_SSN*.md` (matches 0 files currently)
- `*DJANGO_KENNITALA*.md` (matches 0 files currently)
- `*pii_redaction*.md` (matches 0 files currently)

**Directories**: 1 directory
- `services/members/public/` (may not exist)

---

## Security Considerations

### PII Handling

All files in this category must follow PII protection rules:

1. **Never commit** - Obvious, but critical
2. **Encrypt at rest** - Use disk encryption on development machines
3. **Delete when done** - Remove after migration/debugging complete
4. **No backups to cloud** - Ensure backup tools exclude these patterns
5. **Sanitize before sharing** - If you need to share findings, redact all PII

### Access Control

Who should have these files:

| File Type | Access Level | Justification |
|-----------|--------------|---------------|
| Policy meeting notes | Steering Committee, Board | Contains sensitive political discussions |
| Login tracking scripts | System Admins, Developers | Requires production Firestore access |
| PII migration docs | Migration Team Lead | Contains real member data |

---

## Troubleshooting

### "Why is my file showing in git status?"

Check if it matches an ignore pattern:
```bash
git check-ignore -v your-file.md
```

If not matched, add it to `.gitignore`:
```bash
echo "your-file.md" >> .gitignore
```

### "I accidentally committed a local-only file"

**Immediate action**:
```bash
# Remove from git but keep local
git rm --cached path/to/file.md

# Verify it's in .gitignore
git check-ignore -v path/to/file.md

# Commit the removal
git commit -m "chore: remove local-only file from tracking"

# If contains PII and was pushed to remote:
# 1. Contact DevOps immediately
# 2. Consider repository history rewrite
# 3. Rotate any exposed credentials
```

### "How do I find all my local-only files?"

```bash
# Method 1: Using git status
git status --ignored

# Method 2: Check specific directories
find docs services -type f -exec git check-ignore -q {} \; -print

# Method 3: List by pattern
for pattern in "*KENNITALA*.md" "*kennitala*.md" "docs/policy/*.md"; do
  find . -name "$pattern" 2>/dev/null
done
```

---

## Best Practices

### DO ✅

- Document why a file is local-only (add comment in `.gitignore`)
- Update this document when adding new patterns
- Use descriptive filenames that match ignore patterns (e.g., `*_KENNITALA_*.md`)
- Regularly audit and clean up old local-only files
- Encrypt sensitive local-only files

### DON'T ❌

- Commit files with real kennitölur, emails, or names
- Share local-only files via unencrypted channels
- Keep old migration docs with PII indefinitely
- Forget to update `.gitignore` when creating sensitive files
- Assume ignored files are backed up (they might not be)

---

## Related Documentation

- [GITIGNORE_STRATEGY.md](guides/GITIGNORE_STRATEGY.md) - Overall gitignore approach
- [PII_HANDLING.md](../security/policies/PII_HANDLING.md) - PII protection policies
- [CHECK_USER_LOGINS.md](../checklists/CHECK_USER_LOGINS.md) - Using login tracking scripts
- [OPERATIONAL_PROCEDURES.md](../operations/OPERATIONAL_PROCEDURES.md) - System operations

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-11-09 | Initial document created | Development Team |
| 2025-11-09 | Added IMMIGRATION_POLICY_MEETING_2025-11-08.md | Development Team |
| 2025-11-09 | Added member login scripts | Development Team |

---

**Last Updated**: 2025-11-09
**Maintained By**: Development Team
**Review Frequency**: Monthly (or when adding new patterns)

