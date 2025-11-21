# Admin Scripts

**Location**: `/scripts/admin/`
**Purpose**: Administrative scripts for project maintenance and validation

---

## Overview

This directory contains administrative scripts for managing the Ekklesia project, including documentation maintenance, i18n validation, and data management tools.

---

## Directory Structure

```
/scripts/admin/
├── documentation-maintenance/   ← Documentation validation & audit scripts
├── validate-i18n-usage.py      ← i18n validation
├── replace-fake-data.sh         ← PII data management
└── README.md                    ← This file
```

---

## Documentation Maintenance Scripts

**Location**: `/scripts/admin/documentation-maintenance/`

All documentation-related scripts have been organized into a dedicated subdirectory for better organization and maintainability.

**See**: [documentation-maintenance/README.md](./documentation-maintenance/README.md) for complete documentation on:
- `validate_documentation_map.py` - Validate DOCUMENTATION_MAP.md structure
- `validate-links.py` - Validate markdown links (internal & external)
- `audit-documentation.py` - Audit documentation quality
- `audit-documentation-detailed.py` - Enhanced audit with categorization
- `fix_documentation_map_links.py` - Fix broken links in documentation map
- `fix-documentation.py` - General documentation fix utility
- `remove_dead_links.py` - Remove dead links from documentation
- `remediation-summary.py` - Generate summary of documentation fixes

**Recent Updates** (Nov 9, 2025):
- Moved all documentation scripts to dedicated subdirectory
- Added default exclusions for archive/ and audits/ directories
- Improved validation accuracy (36 errors in active docs)

---

## i18n Validation

### `validate-i18n-usage.py`
**Purpose**: Validate i18n string usage across all 3 systems

**Features**:
- Validates Members Portal i18n (R.string)
- Validates Admin Portal i18n (adminStrings.get())
- Validates Admin Elections i18n (R.string in admin-elections/)
- Detects dynamic string access patterns
- Identifies unused translation strings
- Comprehensive usage statistics

**Usage**:
```bash
python3 scripts/admin/validate-i18n-usage.py
```

**Recent Results** (2025-11-07):
- **Members Portal**: 227/445 strings used (51.0%)
- **Admin Portal**: 139/210 strings used (66.2%)
- **Admin Elections**: 156/177 strings used (88.1%) ⭐
- **Overall**: 522/832 strings used (62.7%)
- Dynamic access patterns detected: 5 string families

**Notes**:
- Admin Elections has excellent usage (88.1%)
- Members Portal could be cleaned up (51% usage = 218 unused strings)
- See [I18N_ARCHITECTURE.md](/docs/standards/I18N_ARCHITECTURE.md) for system documentation

---

## Data Management

### `replace-fake-data.sh`
**Purpose**: Replace fake/test data with real data (PII-sensitive)

**Security**:
- ⚠️ This script is gitignored by default
- Contains or generates PII (personally identifiable information)
- Only use in authorized, secure contexts
- Never commit to version control

**Usage**:
```bash
# Only run with proper authorization
./scripts/admin/replace-fake-data.sh
```

**Note**: This script should only be run by authorized administrators who understand the PII implications.

---

## Common Workflows

### Full Documentation Audit

```bash
# Navigate to repository root
cd /home/gudro/Development/projects/ekklesia

# Run comprehensive validation
python3 scripts/admin/documentation-maintenance/validate_documentation_map.py
python3 scripts/admin/documentation-maintenance/validate-links.py

# Audit quality
python3 scripts/admin/documentation-maintenance/audit-documentation.py
```

### i18n Maintenance

```bash
# Validate i18n usage
python3 scripts/admin/validate-i18n-usage.py

# Review results and clean up unused strings
# See output for specific recommendations
```

---

## Best Practices

### Running Scripts
1. **Run from repository root** - Most scripts expect to be run from project root
2. **Check documentation** - Each script directory has detailed README
3. **Understand output** - Review validation results carefully
4. **Commit thoughtfully** - Group related fixes together

### Documentation Maintenance
1. **Regular audits** - Run quarterly to catch documentation drift
2. **Exclude archive/audits** - Focus validation on active documentation
3. **Fix broken links** - Address validation errors promptly
4. **Update maps** - Keep DOCUMENTATION_MAP.md current

### i18n Management
1. **Regular validation** - Run after major i18n changes
2. **Clean up unused strings** - Remove strings with <50% usage periodically
3. **Document dynamic patterns** - Note string families for validation
4. **Maintain consistency** - Follow i18n architecture guidelines

---

## Related Documentation

- [Scripts Overview](../README.md) - Overview of all project scripts
- [Documentation Maintenance](./documentation-maintenance/README.md) - Documentation tools
- [i18n Architecture](/docs/standards/I18N_ARCHITECTURE.md) - Internationalization system
- [Git Hooks](../git-hooks/README.md) - Pre-commit hooks and validation

---

## Maintenance Notes

**Last Updated**: November 9, 2025
**Major Changes**:
- Reorganized documentation scripts into dedicated subdirectory
- Added comprehensive README for documentation maintenance tools
- Updated validation scripts to exclude archive/audits by default
- Improved script organization and discoverability

**Status**: ✅ All scripts operational
**Scripts Count**: 10 (8 documentation + 2 other)
