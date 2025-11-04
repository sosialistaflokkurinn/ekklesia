# .gitignore Strategy - Ekklesia

**Document Type**: Development Guide
**Last Updated**: 2025-10-27
**Status**: ✅ Active - Required Reading
**Purpose**: Define git ignore strategy and maintain separation between shared and personal development environments

---

## Overview

The Ekklesia project uses a **two-tier .gitignore strategy** to maintain strict separation between:

1. **Shared team configuration** (`.gitignore.example`) - Tracked in git
2. **Personal development environment** (`.gitignore`) - Local only, NOT tracked

This approach allows each developer to customize their local environment while maintaining consistent base configuration across the team.

---

## Architecture

```
Repository Root
├── .gitignore.example     ← Tracked in git (template for all developers)
└── .gitignore              ← NOT tracked (your personal local config)
```

### Key Principle

**.gitignore itself is in .gitignore**

This creates a self-referential pattern where `.gitignore` blocks itself from being committed, ensuring personal configurations stay local.

---

## Setup for New Developers

When cloning the repository:

```bash
# 1. Copy template to create your local .gitignore
cp .gitignore.example .gitignore

# 2. Customize for your personal environment
nano .gitignore  # Add your IDE settings, local scripts, etc.

# 3. Verify .gitignore is not tracked
git status  # Should NOT show .gitignore as a change
```

**IMPORTANT**: Never commit `.gitignore` to the repository!

---

## What Goes Where

### ✅ IN `.gitignore.example` (Shared - Tracked in Git)

**Include patterns that ALL developers need:**

- Security patterns (secrets, API keys, credentials)
- Common build artifacts (node_modules, __pycache__, dist/)
- Standard backup files (*.bak, *.backup, *.old)
- Cloud infrastructure binaries (cloud-sql-proxy*)
- Project-specific directories (archive/, audits/)
- Documentation strategy (markdown tracking rules)
- Database dumps and temp files
- OS files (.DS_Store, Thumbs.db)
- Common editor files (.vscode/, .idea/)

**Examples:**
```gitignore
# Security - ALL developers need this
.env
.env.*
*.key.json
*service-account*.json

# Cloud SQL - ALL developers need this
cloud-sql-proxy*
*:europe-west*:*

# Project structure - ALL developers need this
archive/
audits/
services/members/public
apps/admin-portal/
```

### ❌ IN `.gitignore` ONLY (Personal - NOT Tracked)

**Include patterns specific to YOUR development setup:**

- Personal scripts you're testing
- Local data files for development
- Your specific IDE configurations (if not .vscode/)
- Temporary analysis files
- One-off migration scripts
- Personal notes and scratch files
- Local database dumps with specific names

**Examples:**
```gitignore
# Personal scripts
validate_documentation_map.py
my-test-script.sh

# Personal data
data/Stadfangaskra.csv
docs/migration/DUPLICATE_SSN_CLEANUP_2025-10-26.md

# Personal IDE settings beyond .vscode/
.claude/settings.local.json
```

---

## Maintenance Workflow

### When to Update `.gitignore.example`

Update the shared template when you discover a pattern that **all developers** would benefit from:

1. **Security vulnerabilities**: New secret patterns, credential formats
2. **New infrastructure**: New cloud tools, build artifacts
3. **Project structure changes**: New directories to ignore
4. **Common mistakes**: Files accidentally committed by multiple people

**Process:**
```bash
# 1. Edit .gitignore.example
nano .gitignore.example

# 2. Add pattern with comment explaining why
echo "# New pattern for [reason]" >> .gitignore.example
echo "new-pattern*" >> .gitignore.example

# 3. Commit to git
git add .gitignore.example
git commit -m "chore: add new-pattern to .gitignore.example"

# 4. Update your personal .gitignore
cp .gitignore.example .gitignore
# Add back your personal patterns
```

### When to Update `.gitignore` (Personal)

Update your local file anytime you need to ignore something specific to your workflow:

```bash
# Just edit - no git commit needed!
echo "my-personal-file.txt" >> .gitignore
```

---

## Validation

### Check Your .gitignore is NOT Tracked

```bash
# Should return empty (NOT staged)
git ls-files .gitignore

# Should show .gitignore in ignore list
git check-ignore -v .gitignore
# Output: .gitignore:221:.gitignore	.gitignore
```

### Verify Shared Template is Tracked

```bash
# Should show the file (IS tracked)
git ls-files .gitignore.example
# Output: .gitignore.example

# Should NOT be ignored
git check-ignore .gitignore.example
# Output: (empty - not ignored)
```

### Compare Your Config to Template

```bash
# See what you've added personally
diff .gitignore.example .gitignore

# Or use this Python script:
python3 << 'EOF'
with open('.gitignore', 'r') as f:
    personal = set(f.read().splitlines())
with open('.gitignore.example', 'r') as f:
    template = set(f.read().splitlines())

print("=== Personal additions (not in template) ===")
for line in sorted(personal - template):
    if line.strip() and not line.strip().startswith('#'):
        print(f"  {line}")
EOF
```

---

## Common Patterns in .gitignore.example

### Security & Secrets

```gitignore
.env
.env.*
*.key.json
*service-account*.json
*client_secret*
firebase-adminsdk-*.json
```

### Python Development

```gitignore
__pycache__/
*.py[cod]
venv/
.pytest_cache/
.mypy_cache/
```

### Node.js Development

```gitignore
node_modules/
npm-debug.log*
dist/
build/
.eslintcache
```

### Firebase

```gitignore
.firebase/
firebase-debug.log
ui-debug.log
```

### Cloud SQL Proxy

```gitignore
cloud-sql-proxy*
*:europe-west*:*
*:us-central*:*
```

### Documentation Strategy

```gitignore
# Ignore all markdown by default
*.md

# Except essential docs
!DOCUMENTATION_MAP.md
!README.md
!docs/**/*.md

# Allow uppercase MD extension
!docs/**/*.MD
```

### Backup Files

```gitignore
*.backup
*.bak
*.old
*.orig
*~
```

---

## Troubleshooting

### Problem: I accidentally committed .gitignore

```bash
# Remove from git but keep local file
git rm --cached .gitignore

# Verify .gitignore pattern exists in .gitignore
grep "^\.gitignore$" .gitignore

# Commit the removal
git commit -m "chore: remove .gitignore from tracking"
```

### Problem: My personal files are showing in git status

```bash
# Check if pattern is in your .gitignore
grep "my-file-pattern" .gitignore

# If not, add it
echo "my-file-pattern" >> .gitignore

# Verify it's now ignored
git check-ignore -v my-file-pattern
```

### Problem: I need to update .gitignore.example

```bash
# 1. Backup your personal .gitignore
cp .gitignore .gitignore.personal.backup

# 2. Edit .gitignore.example
nano .gitignore.example

# 3. Commit the template
git add .gitignore.example
git commit -m "chore: update .gitignore.example with [pattern]"

# 4. Merge template changes into your personal file
cp .gitignore.example .gitignore
cat .gitignore.personal.backup >> .gitignore

# 5. Clean up duplicates (manual review)
nano .gitignore
```

---

## Migration Guide

### If you have an existing .gitignore tracked in git:

```bash
# 1. Copy current .gitignore to template
cp .gitignore .gitignore.example

# 2. Remove personal patterns from template
nano .gitignore.example
# Delete lines like:
# - validate_documentation_map.py
# - data/Stadfangaskra.csv
# - .claude/settings.local.json
# - docs/migration/DUPLICATE_SSN_CLEANUP_*.md

# 3. Add .gitignore to itself
echo ".gitignore" >> .gitignore

# 4. Remove .gitignore from tracking
git rm --cached .gitignore

# 5. Add .gitignore.example to tracking
git add .gitignore.example

# 6. Commit
git commit -m "chore: split .gitignore into template and personal config"
```

---

## Best Practices

### DO ✅

- Copy `.gitignore.example` as starting point
- Add personal development files to your `.gitignore`
- Update `.gitignore.example` for team-wide patterns
- Document why patterns exist (comments)
- Use wildcards for flexible matching (`*.key.json`)
- Group patterns by category with headers

### DON'T ❌

- Commit `.gitignore` to git
- Add personal files to `.gitignore.example`
- Remove security patterns from `.gitignore.example`
- Use overly broad patterns (`*` alone)
- Forget to test patterns with `git check-ignore`
- Leave `.gitignore` unprotected (must ignore itself)

---

## Related Documentation

- [OPERATIONAL_PROCEDURES.md](../../operations/OPERATIONAL_PROCEDURES.md) - System operations
- [USAGE_CONTEXT.md](workflows/USAGE_CONTEXT.md) - Development patterns
- REPO_RESTRUCTURING_PLAN.md (TBD) - Repository organization

---

## Summary

**Key Takeaways:**

1. `.gitignore.example` = Shared template (tracked in git)
2. `.gitignore` = Personal config (NOT tracked in git)
3. `.gitignore` blocks itself from being committed
4. Update template for team-wide patterns
5. Update personal file for your specific needs
6. Never commit personal development artifacts

**Setup Command:**
```bash
cp .gitignore.example .gitignore
```

**Validation Commands:**
```bash
# .gitignore should NOT be tracked
git ls-files .gitignore  # Empty = good

# .gitignore.example SHOULD be tracked
git ls-files .gitignore.example  # Shows file = good
```

---

**Last Updated**: 2025-10-27
**Maintained By**: Development Team
**Questions**: Check `.gitignore.example` comments for pattern explanations
