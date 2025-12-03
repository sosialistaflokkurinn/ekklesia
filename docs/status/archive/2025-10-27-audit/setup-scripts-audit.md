# Setup Scripts Directory Audit

**Directory:** `/services/members/setup-scripts`
**Date:** 2025-10-27

---

## Summary

The `setup-scripts` directory is **DEPRECATED** according to its README. All functionality has been consolidated to `/services/members/scripts/`.

However, the directory still contains:
- Old version of `set-user-roles.js` (64 lines)
- `package.json` and `package-lock.json`
- Deprecation notice in README

---

## Files Found

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `README.md` | 11 | ✅ OK | Deprecation notice points to `scripts/` |
| `set-user-roles.js` | 64 | ⚠️ DUPLICATE | Old version, superseded by `scripts/set-user-roles.js` (228 lines) |
| `package.json` | 10 | ⚠️ DUPLICATE | Same deps as `scripts/package.json` |
| `package-lock.json` | ~74KB | ⚠️ DUPLICATE | Lock file for old deps |

---

## Issues Found

### 1. **Deprecated Directory Not Removed** (Medium Priority)

**Issue:** Directory still exists despite being deprecated.

**Impact:**
- Confusion for new developers
- Outdated code may be accidentally used
- Wasted disk space (~76KB)

**Recommendation:** Delete entire `setup-scripts/` directory

**Reasoning:**
- README says "consolidated" to `scripts/`
- `scripts/set-user-roles.js` is newer and more feature-rich (228 vs 64 lines)
- No reason to keep old version

---

### 2. **Duplicate Code** (Medium Priority)

**Issue:** `set-user-roles.js` exists in both locations with different implementations.

**Comparison:**

| Feature | `setup-scripts/` (old) | `scripts/` (new) |
|---------|------------------------|------------------|
| Lines of code | 64 | 228 |
| ES modules | ✅ `import` | ❌ `require` (CommonJS) |
| Positional args | ❌ | ✅ |
| Flag args | ✅ | ✅ |
| Dry-run mode | ❌ | ✅ |
| Audit file | ❌ | ✅ |
| Interactive prompts | ❌ | ✅ |
| Error handling | Basic | Comprehensive |

**The `scripts/` version is clearly superior.**

---

### 3. **No Personal Information** ✅

**Status:** Clean - no PII found in any files.

Searched for:
- Kennitala patterns
- Firebase UIDs
- Email addresses
- Phone numbers

**Result:** None found ✅

---

## Recommendations

### Immediate Action (Low Risk)

**Delete the entire `setup-scripts/` directory:**

```bash
# Remove deprecated directory
rm -rf /home/gudro/Development/projects/ekklesia/services/members/setup-scripts

# Commit
git add services/members/setup-scripts
git commit -m "chore: remove deprecated setup-scripts directory

The setup-scripts directory has been deprecated and consolidated
into services/members/scripts/ (see README in setup-scripts/).

Removed:
- Old version of set-user-roles.js (64 lines vs 228 in scripts/)
- Duplicate package.json and package-lock.json
- README.md deprecation notice

All functionality is available in services/members/scripts/
with improved features (dry-run, audit, interactive mode)."
```

**Why it's safe:**
1. README explicitly says directory is deprecated
2. All functionality exists in `scripts/` with more features
3. No unique code or data will be lost
4. No PII or secrets in directory

---

## Alternative: Keep as Archive

If you want to preserve history, move to archive:

```bash
mkdir -p archive/deprecated/services/members/
mv services/members/setup-scripts archive/deprecated/services/members/
git add archive/deprecated/services/members/setup-scripts
git add services/members/setup-scripts
git commit -m "chore: archive deprecated setup-scripts directory"
```

**Pros:**
- Preserves history
- Can reference old implementation if needed

**Cons:**
- Still creates confusion
- Archive directory already exists (should we keep growing it?)

---

## Summary

| Issue | Severity | Action | Lines Saved |
|-------|----------|--------|-------------|
| Deprecated directory exists | Medium | Delete entire dir | N/A |
| Duplicate code | Medium | Delete (newer version in `scripts/`) | 64 |
| Duplicate package files | Low | Delete | ~76KB |
| **Total impact** | **Medium** | **Delete 4 files, save ~76KB** | **64 lines** |

---

## Decision

**Recommendation:** Delete the entire `setup-scripts/` directory.

**Rationale:**
1. Explicitly deprecated in README
2. All functionality superseded by better implementation
3. No unique value in keeping it
4. Reduces confusion for developers

---

**Audit completed:** 2025-10-27
**Status:** Ready for cleanup
