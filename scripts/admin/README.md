# Admin Scripts - Documentation Management

**Location**: `/scripts/admin/`
**Purpose**: Documentation audit, validation, and maintenance scripts

---

## Overview

This directory contains scripts for managing and maintaining the Ekklesia project documentation. These scripts are used for auditing documentation quality, validating links, and applying systematic fixes.

---

## Scripts

### Documentation Audit

#### `audit-documentation.py`
**Purpose**: Comprehensive documentation quality audit

**Features**:
- Scans all markdown files for issues
- Validates code blocks for syntax errors
- Checks for missing file references
- Identifies API usage issues
- Generates JSON report

**Usage**:
```bash
python3 scripts/admin/audit-documentation.py
```

**Output**: `AUDIT_CODE_DOCUMENTATION_YYYY-MM-DD.json`

**Note**: Produces some false positives (91% rate) - see `/tmp/CODE_QUALITY_ANALYSIS.md` for details.

---

#### `audit-documentation-detailed.py`
**Purpose**: Enhanced audit with detailed categorization

**Features**:
- More detailed error categorization
- Better file organization
- Excludes audits/ and archive/ by default
- Enhanced reporting format

**Usage**:
```bash
python3 scripts/admin/audit-documentation-detailed.py
```

---

### Link Validation

#### `validate-links.py`
**Purpose**: Validate markdown links across documentation

**Features**:
- Checks internal links (relative paths)
- Validates external links (HTTP/HTTPS)
- Reports broken links by file
- Excludes certain directories

**Usage**:
```bash
# Validate all documentation
python3 scripts/admin/validate-links.py

# Exclude specific directories
python3 scripts/admin/validate-links.py --exclude audits archive
```

**Recent Results** (2025-11-04):
- Initial: 178 broken links
- After fixes: 0 broken links (100% success)

---

#### `validate_documentation_map.py`
**Purpose**: Validate DOCUMENTATION_MAP.md structure

**Features**:
- Ensures all referenced files exist
- Validates map structure
- Checks for orphaned files
- Verifies directory organization

**Usage**:
```bash
./scripts/admin/validate_documentation_map.py
```

---

### Link Fixing

#### `fix-documentation.py`
**Purpose**: Automated link fixing based on patterns

**Features**:
- Pattern-based regex replacements
- Batch processing
- Dry-run mode available
- Backup before changes

**Usage**:
```bash
# Dry run (preview changes)
python3 scripts/admin/fix-documentation.py --dry-run

# Apply fixes
python3 scripts/admin/fix-documentation.py
```

---

#### `fix_documentation_map_links.py`
**Purpose**: Fix links specifically in DOCUMENTATION_MAP.md

**Features**:
- Specialized patterns for documentation map
- Path normalization
- Validates after fixing

**Usage**:
```bash
python3 scripts/admin/fix_documentation_map_links.py
```

**Last Run**: 2025-10-27 (fixed multiple map references)

---

#### `remove_dead_links.py`
**Purpose**: Remove or mark dead links that can't be fixed

**Features**:
- Identifies permanently broken links
- Marks as (archived) or (TBD)
- Option to remove entirely
- Preserves context

**Usage**:
```bash
python3 scripts/admin/remove_dead_links.py
```

---

### Reporting

#### `remediation-summary.py`
**Purpose**: Generate summary of documentation issues and fixes

**Features**:
- Issue categorization
- Priority ranking
- Time estimates for fixes
- Generates markdown report

**Usage**:
```bash
python3 scripts/admin/remediation-summary.py > /tmp/REMEDIATION_SUMMARY.md
```

**Output**: Summary report with prioritized action items

---

## Common Workflows

### Full Documentation Audit (Recommended)

```bash
# Step 1: Run comprehensive audit
cd /home/gudro/Development/projects/ekklesia
python3 scripts/admin/audit-documentation.py

# Step 2: Validate links (excluding audits/archive)
python3 scripts/admin/validate-links.py --exclude audits archive

# Step 3: Review results
cat AUDIT_CODE_DOCUMENTATION_$(date +%Y-%m-%d).json
```

### Fixing Broken Links

```bash
# Step 1: Identify broken links
python3 scripts/admin/validate-links.py > /tmp/broken_links.txt

# Step 2: Create fix script (manual)
# Edit /tmp/fix_links.py with patterns

# Step 3: Apply fixes
python3 /tmp/fix_links.py

# Step 4: Re-validate
python3 scripts/admin/validate-links.py
```

### Documentation Map Maintenance

```bash
# Validate documentation map
./scripts/admin/validate_documentation_map.py

# Fix any broken links in map
python3 scripts/admin/fix_documentation_map_links.py

# Re-validate
./scripts/admin/validate_documentation_map.py
```

---

## Recent Audit Results (2025-11-04)

### Link Validation
- **Initial broken links**: 178
- **Links fixed**: 178 (5 rounds of fixes)
- **Current broken links**: 0
- **Success rate**: 100%

See `/tmp/DOCUMENTATION_AUDIT_FINAL_SUMMARY.md` for complete audit report.

### Code Quality Analysis
- **Code blocks analyzed**: 1,815
- **Issues reported**: 233
- **False positives**: 211 (91%)
- **Real issues**: ~22 (optional improvements)

See `/tmp/CODE_QUALITY_ANALYSIS.md` for detailed analysis.

### GraphQL Validation
- **Examples validated**: 20+
- **Syntax errors**: 0
- **API compliance**: 100%

See `/tmp/GRAPHQL_VALIDATION_REPORT.md` for validation details.

---

## Best Practices

### Running Audits
1. **Exclude audits/ and archive/** - These directories contain historical documentation
2. **Run after major changes** - Always validate links after restructuring
3. **Check false positives** - Many "errors" are actually correct (see analysis reports)
4. **Document findings** - Create reports for future reference

### Fixing Links
1. **Use pattern-based fixes** - Create reusable fix scripts
2. **Validate after each round** - Re-run validation to check progress
3. **Commit in logical groups** - Group related fixes together
4. **Document patterns** - Note common issues for future prevention

### Maintaining Documentation
1. **Regular audits** - Run quarterly to catch drift
2. **Update scripts** - Improve to reduce false positives
3. **Track improvements** - Document success metrics
4. **Share knowledge** - Update this README with new patterns

---

## Integration with Development

### Pre-commit Hook
The git pre-commit hook (in `.git/hooks/pre-commit`) runs:
- Political identity checks
- Secret scanning
- Basic validation

For documentation-specific validation, run manually before committing large doc changes.

### CI/CD Integration (Future)
Consider adding to GitHub Actions:
```yaml
- name: Validate Documentation
  run: python3 scripts/admin/validate-links.py
```

---

## Troubleshooting

### Script Fails with Import Error
**Solution**: Install required dependencies
```bash
pip install -r requirements.txt  # If exists
# Or install manually: requests, beautifulsoup4, etc.
```

### Too Many False Positives
**Solution**: Use filtered validation
```bash
# Exclude problematic directories
python3 scripts/admin/validate-links.py --exclude audits archive testing
```

### Script Takes Too Long
**Solution**: Run on subset of files
```bash
# Validate only specific directory
python3 scripts/admin/validate-links.py docs/development/
```

---

## Related Documentation

- [Repository Root README](../../README.md) - Project overview
- [Scripts README](../README.md) - Overview of all scripts
- [Documentation Guide](../../docs/standards/DOCUMENTATION_GUIDE.md) - Documentation standards
- [Git Hooks README](../git-hooks/README.md) - Pre-commit hooks

---

## Maintenance Notes

**Last Updated**: 2025-11-04
**Scripts Count**: 8
**Last Audit**: 2025-11-04 (100% link validation success)
**Status**: ✅ All scripts operational
