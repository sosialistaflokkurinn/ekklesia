# Documentation Maintenance Scripts

Scripts for validating, auditing, and maintaining project documentation.

## 🚀 Quick Start

**Recommended:** Use the master validation script to run all checks:

```bash
./validate-all.sh
```

This runs all validation checks in logical order and provides a comprehensive summary.

---

## 📋 Available Scripts

### Master Script

#### `validate-all.sh` ⭐
Master validation script that runs all documentation checks in logical order.

**Purpose:**
- Validates DOCUMENTATION_MAP.md structure
- Validates all markdown links (internal & external)
- Provides comprehensive summary with clear pass/fail status
- READ-ONLY - does not modify any files

**Usage:**
```bash
./validate-all.sh
./validate-all.sh --verbose
```

**Exit codes:**
- 0 - All validations passed
- 1 - One or more validations failed
- 2 - Script error

**Last Updated:** Nov 9, 2025 (initial creation)

---

### Freshness & Maintenance

#### `check-docs-freshness.sh` 🆕
Checks if key documentation files are up-to-date.

**Purpose:**
- Monitors freshness of session-start context files
- Detects stale documentation (default: 7 days)
- READ-ONLY - does not modify files

**Files monitored:**
- `docs/status/CURRENT_DEVELOPMENT_STATUS.md`
- `docs/development/guides/workflows/USAGE_CONTEXT.md`
- `docs/operations/OPERATIONAL_PROCEDURES.md`
- `docs/SESSION_START_REMINDER.md`

**Usage:**
```bash
./check-docs-freshness.sh        # 7-day threshold (default)
./check-docs-freshness.sh 14     # 14-day threshold
```

**Exit codes:**
- 0 - All docs are fresh
- 1 - One or more docs are stale/missing

**Last Updated:** Nov 9, 2025 (initial creation)

---

#### `install-git-hook.sh` 🆕
Installs git post-commit hook for documentation reminders.

**Purpose:**
- Automatically reminds about doc updates after significant commits
- Checks if commit includes deployment/infrastructure changes
- Skips reminder if docs already updated in commit

**Usage:**
```bash
./install-git-hook.sh
```

**What it does:**
- Creates symlink: `.git/hooks/post-commit` → `post-commit-reminder.sh`
- Shows reminder after commits with patterns: `feat:`, `deploy`, `infrastructure`, etc.

**Last Updated:** Nov 9, 2025 (initial creation)

---

### Validation Scripts

#### `validate_documentation_map.py`
Validates DOCUMENTATION_MAP.md against the filesystem.

**Purpose:**
- Verifies file references in DOCUMENTATION_MAP.md exist
- Lists documentation files not referenced in the map
- Excludes archive and audits directories by default

**Usage:**
```bash
python3 validate_documentation_map.py
python3 validate_documentation_map.py --ignore archive audits
```

**Last Updated:** Nov 9, 2025 (added archive/audits exclusion)

---

#### `validate_links.py`
Validates internal cross-references in markdown files.

**Purpose:**
- Checks internal links to other markdown files
- Validates links to code files
- Checks anchor references
- Excludes archive and audits by default

**Usage:**
```bash
python3 validate_links.py
python3 validate_links.py --exclude audits archive
```

**Last Updated:** Nov 9, 2025 (added default exclusions)

---

## 🔄 Workflow

### Setup (One-time)

**Install git hook for documentation reminders:**
```bash
./scripts/admin/documentation-maintenance/install-git-hook.sh
```

This will show a reminder after significant commits to update docs if needed.

---

### Regular Maintenance (Recommended)

**Check documentation freshness:**
```bash
./scripts/admin/documentation-maintenance/check-docs-freshness.sh
```

**Quick validation:**
```bash
cd /home/gudro/Development/projects/ekklesia
./scripts/admin/documentation-maintenance/validate-all.sh
```

**Individual checks:**
```bash
# Check if docs are up-to-date
./scripts/admin/documentation-maintenance/check-docs-freshness.sh 7

# Validate DOCUMENTATION_MAP.md only
python3 scripts/admin/documentation-maintenance/validate_documentation_map.py

# Validate links only
python3 scripts/admin/documentation-maintenance/validate_links.py
```

---

### Automated Workflows

**GitHub Actions:** `.github/workflows/check-docs-freshness.yml`

- Runs weekly on Mondays at 9:00 AM UTC
- Runs on every push to `main`
- Creates GitHub issue if docs are stale (>14 days)
- Adds PR comment if docs need update

**See:** `docs/development/guides/DOCUMENTATION_MAINTENANCE.md` for full automation guide

---

## 📝 Notes

- All scripts support `--help` for detailed usage
- Validation scripts exclude archive/ and audits/ directories by default
- Run from repository root for best results
- `validate-all.sh` is READ-ONLY and safe to run anytime

---

## 📦 Archived Scripts

Several documentation maintenance scripts have been archived to `/archive/old-documentation-scripts/` as of November 9, 2025:

- `audit-documentation.py` - Too slow, high false positive rate, needs refactoring
- `audit-documentation-detailed.py` - Times out, not practical for regular use
- `fix_documentation_map_links.py` - Hardcoded for October 2025 reorganization
- `fix_documentation.py` - Generic patterns, outdated
- `remove_dead_links.py` - Too dangerous (automatic removal)
- `remediation-summary.py` - Tied to specific October 2025 audit

**Philosophy:** Focus on **validation** (detect issues) rather than **automatic fixing** (too risky).

**See:** `/archive/old-documentation-scripts/README.md` for details on why these were archived and what would be needed to restore them.

---

## 🔗 Related

- `/docs/` - Documentation directory
- `/scripts/admin/README.md` - Admin scripts overview
- `/archive/old-documentation-scripts/README.md` - Archived scripts documentation
- `DOCUMENTATION_MAP.md` - Main documentation map

---

**Last Updated:** November 9, 2025
**Recent Changes:**
- Created `validate-all.sh` master validation script
- Archived 6 outdated/problematic scripts
- Simplified workflow to focus on safe validation
