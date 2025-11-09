# Old Documentation Scripts (ARCHIVED)

**Status**: ⚠️ Archived - Not recommended for use
**Date**: November 9, 2025
**Reason**: These scripts are outdated, have issues, or have been superseded by better tools

---

## Why Archived?

These documentation maintenance scripts were moved to archive because:

1. **audit-documentation.py & audit-documentation-detailed.py**
   - Scan ALL docs including audits/archive (not configurable)
   - High false positive rate (~91%)
   - Create files in project root instead of proper location
   - Very slow (detailed version times out)
   - **Issue**: Need significant refactoring to be useful

2. **fix_documentation_map_links.py**
   - Hardcoded path mappings for October 2025 archive reorganization
   - Specific to one-time fix, not reusable
   - **Issue**: Too specific to historical event

3. **fix-documentation.py**
   - Generic pattern-based fixes
   - Likely outdated patterns
   - **Issue**: Unknown current applicability

4. **remove_dead_links.py**
   - Automatically removes dead links
   - **Issue**: Too dangerous (could remove valid references)

5. **remediation-summary.py**
   - Depends on specific audit JSON file (AUDIT_CODE_DOCUMENTATION_DETAILED_2025-10-20.json)
   - **Issue**: Tied to October 20, 2025 audit

---

## What Replaced Them?

### Active Validation Scripts

**Location**: `/scripts/admin/documentation-maintenance/`

1. **validate_documentation_map.py**
   - Validates DOCUMENTATION_MAP.md structure
   - Excludes archive/audits by default
   - Fast and reliable

2. **validate-links.py**
   - Validates all markdown links
   - Excludes archive/audits by default
   - Clear error reporting

3. **validate-all.sh** (NEW)
   - Master script that runs all validation
   - Safe, read-only validation
   - Quick to run

**Philosophy**: Focus on **validation** (detect issues) rather than **automatic fixing** (too risky).

---

## Could These Be Useful Again?

**Maybe**, but they would need significant work:

### audit-documentation.py
**Would need:**
- Add `--exclude` parameter (like validate-links.py)
- Fix output location (use /tmp/ or /docs/testing/reports/)
- Reduce false positives
- Add proper error handling

**Estimated effort**: 2-4 hours

---

### fix_documentation_map_links.py
**Would need:**
- Make path mappings configurable (not hardcoded)
- Add dry-run mode
- Validate before and after
- Better error handling

**Estimated effort**: 1-2 hours

---

### Other scripts
**Not recommended** - safer to validate and fix manually

---

## If You Need to Fix Documentation

### Recommended Workflow (2025-11-09)

```bash
# 1. Validate to find issues
cd /home/gudro/Development/projects/ekklesia
scripts/admin/documentation-maintenance/validate-all.sh

# 2. Review issues manually

# 3. Fix manually or write custom one-time fix script

# 4. Re-validate
scripts/admin/documentation-maintenance/validate-all.sh
```

**Why manual fixes?**
- More control
- Less risk
- Better understanding of documentation
- Fixes are context-aware

---

## Historical Context

These scripts were created during October 2025 documentation cleanup efforts:
- Major archive reorganization (Oct 13, 2025)
- Link validation campaign (Oct 20-27, 2025)
- 178 broken links fixed manually (100% success)

At the time, these scripts helped identify issues. But for ongoing maintenance, simpler validation-only scripts are more appropriate.

---

## Related Documentation

- [Active Scripts](../../scripts/admin/documentation-maintenance/README.md)
- [Archive Overview](../README.md)
- [Documentation Standards](/docs/standards/DOCUMENTATION_GUIDE.md)

---

**Last Updated**: November 9, 2025
**Archived By**: Claude Code (automated cleanup session)
