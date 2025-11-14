# .gitignore Hybrid Strategy (Local Files)

**Document Type**: Development Guide
**Last Updated**: 2025-11-14
**Status**: ✅ Active - Required Reading
**Purpose**: Enable AI-friendly git workflows while protecting personal development files

---

## Overview

The Ekklesia project uses a **hybrid .gitignore strategy** that works WITH AI assistant behavior instead of fighting against it:

- ✅ **`.gitignore`** - Tracked in git (shared project rules)
- ✅ **`.gitignore.local`** - Personal config (NOT tracked, merged automatically by git)
- ✅ **Pre-commit safeguards** - Prevents accidental commits of personal files

**Key Principle**: AI assistants (Claude, Copilot, Gemini) naturally want to track everything. This strategy accommodates that while protecting personal data.

---

## Why This Strategy?

### Problem with Two-File Strategy

**Previous attempt** (documented but never fully implemented):
- `.gitignore` = local only (NOT tracked)
- `.gitignore.example` = template (tracked)

**Why it failed**:
1. ❌ AI assistants **systematically re-added** .gitignore to tracking (~5x observed)
2. ❌ Fought against natural AI workflow
3. ❌ Required constant vigilance
4. ❌ Developer (human) had to catch AI mistakes

### Solution: Hybrid Strategy

**Accept reality**:
- AI assistants WILL track .gitignore
- Fighting this is counterproductive

**Work with it**:
- `.gitignore` = tracked (makes AI happy)
- `.gitignore.local` = personal (never tracked)
- Git automatically merges both files
- **Pre-commit hooks prevent mistakes**

**Result**: ✅ AI can work naturally + personal files stay safe

---

## Architecture

```
Repository Root
├── .gitignore                   ← Tracked (shared project rules)
├── .gitignore.local             ← NOT tracked (your personal rules)
├── .gitignore.local.example     ← Tracked (template for developers)
└── .git/hooks/
    ├── pre-commit               ← Main hook (updated)
    └── pre-commit.d/
        └── 10-gitignore-safeguard.sh  ← Blocks .gitignore.local commits
```

### How Git Merges Files

Git **automatically reads both** `.gitignore` and `.gitignore.local`:

```bash
# Effective ignore rules = .gitignore + .gitignore.local
# Git merges them transparently
```

**No configuration needed** - this is built into git!

---

## Setup for New Developers

```bash
# 1. Clone repository
git clone https://github.com/sosialistaflokkurinn/ekklesia.git
cd ekklesia

# 2. Create your personal .gitignore.local
cp .gitignore.local.example .gitignore.local

# 3. Add your personal patterns
nano .gitignore.local

# Add at end:
# .claude/
# .gemini/
# data/
# *.personal.md

# 4. Verify setup
./scripts/admin/validate-gitignore-setup.sh

# 5. Test safeguards work
git add .gitignore.local  # Should be blocked by pre-commit hook
```

---

## What Goes Where

### ✅ IN `.gitignore` (Shared - Tracked in Git)

**Project-wide patterns that ALL developers need:**

```gitignore
# Security
.env
*.key.json
*serviceAccount*.json

# Build artifacts
node_modules/
__pycache__/
dist/
build/

# IDE (shared workspace settings only)
.idea/
*.swp

# Project-specific
archive/
audits/
services/members/public
```

### ✅ IN `.gitignore.local` (Personal - NOT Tracked)

**Patterns specific to YOUR development environment:**

```gitignore
# AI Assistant Settings
.claude/
.gemini/
.cursor/

# Personal Data
data/
data/Stadfangaskra.csv
AUDIT_CODE_DOCUMENTATION_*.json

# Personal Work Directories
correct-mark-of-the-party/
my-experiments/
scratch/

# Personal Notes
*.personal.md
TODO.md
NOTES.md
```

---

## Safeguards (AI Protection)

### Pre-Commit Hook: 10-gitignore-safeguard.sh

**Location**: `.git/hooks/pre-commit.d/10-gitignore-safeguard.sh`

**What it blocks**:

1. ❌ **`.gitignore.local`** - Personal config
2. ❌ **`.gitignore.personal`** - Alternative naming
3. ❌ **`.gitignore.private`** - Alternative naming
4. ❌ **`*.personal.*`** - Personal file pattern
5. ❌ **Deleting `.gitignore`** - Strategy requires it tracked

**What it warns about**:

- ⚠️ Suspicious patterns (`*-personal-*`, `*.local.backup`)
- ⚠️ Updating `.gitignore.example` without updating `.gitignore`
- ⚠️ Personal files that should be in `.gitignore.local`

### Validation Script

**Location**: `scripts/admin/validate-gitignore-setup.sh`

**Run after setup**:
```bash
./scripts/admin/validate-gitignore-setup.sh
```

**Checks**:
1. ✅ `.gitignore` is tracked
2. ✅ `.gitignore.local` is NOT tracked
3. ✅ `.gitignore.local` is ignored
4. ✅ `.gitignore.local.example` exists and is tracked
5. ✅ `.gitignore` has hybrid strategy documentation
6. ✅ Pre-commit safeguard hook exists and is executable
7. ✅ Main pre-commit calls safeguard hook
8. ✅ No orphaned two-file strategy files
9. ✅ Documentation exists
10. ✅ Hook functionality test (blocks .gitignore.local)

---

## Workflow Examples

### Adding Personal Pattern

```bash
# Add pattern to YOUR .gitignore.local
echo "my-experiment/" >> .gitignore.local

# Verify it's ignored
git check-ignore -v my-experiment/
# Output: .gitignore.local:XX:my-experiment/    my-experiment/

# Try to commit (will be blocked by hook)
git add .gitignore.local
git commit -m "test"
# Output: ❌ BLOCKED: Attempting to commit forbidden file
```

### Adding Shared Pattern

```bash
# Add pattern to project .gitignore
echo "new-build-artifact/" >> .gitignore

# Stage and commit (allowed)
git add .gitignore
git commit -m "chore(gitignore): ignore new build artifacts"

# Other developers get this automatically
git push origin feature-branch
```

### AI Assistant Accidentally Stages .gitignore.local

```bash
# AI runs: git add .
# (includes .gitignore.local)

# Try to commit
git commit -m "update: changes"

# Pre-commit hook blocks:
# ❌ BLOCKED: Attempting to commit forbidden file: .gitignore.local
#    This file contains personal development patterns and should NOT be committed.

# Fix:
git restore --staged .gitignore.local
```

---

## Migration from Two-File Strategy

If you previously had `.gitignore` untracked:

```bash
# 1. Current state check
git ls-files .gitignore
# Empty = untracked (old strategy)

# 2. Add .gitignore back to tracking
git add .gitignore
git commit -m "fix: track .gitignore (hybrid strategy)"

# 3. Create your .gitignore.local
cp .gitignore.local.example .gitignore.local

# 4. Move personal patterns
# Copy patterns from old .gitignore to new .gitignore.local
# (lines like: .claude/, data/, correct-mark-of-the-party/)

# 5. Validate
./scripts/admin/validate-gitignore-setup.sh
```

---

## Troubleshooting

### Problem: .gitignore.local is tracked in git

```bash
# Check
git ls-files .gitignore.local

# Fix
git rm --cached .gitignore.local
git commit -m "fix: remove .gitignore.local from tracking"

# Verify
git ls-files .gitignore.local  # Should be empty
```

### Problem: Pre-commit hook doesn't run

```bash
# Check hook exists
ls -la .git/hooks/pre-commit.d/10-gitignore-safeguard.sh

# Check permissions
chmod +x .git/hooks/pre-commit.d/10-gitignore-safeguard.sh

# Check main hook calls it
grep "10-gitignore-safeguard" .git/hooks/pre-commit
```

### Problem: AI assistant added .gitignore.local to commit

**This means safeguards are working!**

```bash
# Hook blocked it, now unstage:
git restore --staged .gitignore.local

# Proceed with commit (without .gitignore.local)
git commit -m "your message"
```

### Problem: Need to share personal pattern with team

```bash
# Move pattern from .gitignore.local to .gitignore
# 1. Add to .gitignore
echo "new-shared-pattern/" >> .gitignore

# 2. Remove from .gitignore.local
nano .gitignore.local  # Delete the line

# 3. Commit to share
git add .gitignore
git commit -m "chore(gitignore): add new-shared-pattern (now project-wide)"
```

---

## Design Philosophy

### Why Not Fight AI Behavior?

**Observation** (5+ incidents):
- AI assistants naturally track all files
- They have built-in bias toward version control
- Fighting this requires constant human vigilance
- Mistakes **will** happen

**Better approach**:
- Design system that works WITH AI behavior
- Use automation (hooks) to prevent mistakes
- Make the "right thing" easy
- Make the "wrong thing" blocked

### Layered Safety

1. **Layer 1: Git ignores .gitignore.local** (natural git behavior)
2. **Layer 2: Pre-commit hook blocks attempts** (automation)
3. **Layer 3: Validation script catches setup errors** (testing)
4. **Layer 4: Documentation explains why** (education)

**Result**: AI can work naturally, mistakes are caught automatically.

---

## For AI Assistants

**If you're an AI reading this** (Claude, Copilot, Gemini):

✅ **DO**:
- Track `.gitignore` (it's meant to be committed)
- Update `.gitignore` for project-wide patterns
- Run validation script after changes
- Trust pre-commit hooks to catch mistakes

❌ **DON'T**:
- Stage `.gitignore.local` (hook will block it)
- Delete `.gitignore` (hook will block it)
- Stage `*.personal.*` files (hook will warn)
- Override `--no-verify` unless user explicitly requests

**When blocked by hook**:
1. Read the error message carefully
2. Unstage the blocked file: `git restore --staged <file>`
3. Suggest user adds pattern to `.gitignore.local`
4. Proceed without the personal file

---

## Related Documentation

- [GITIGNORE_STRATEGY.md](GITIGNORE_STRATEGY.md) - Original two-file strategy (deprecated)
- [GIT_IGNORE_ISSUE_RESOLUTION.md](../../troubleshooting/GIT_IGNORE_ISSUE_RESOLUTION.md) - Historical context
- [Pre-commit hooks](../../../.git/hooks/) - Implementation details

---

## Summary

**Setup Command**:
```bash
cp .gitignore.local.example .gitignore.local
```

**Validation Command**:
```bash
./scripts/admin/validate-gitignore-setup.sh
```

**Key Rules**:
1. `.gitignore` = tracked (shared project rules)
2. `.gitignore.local` = NOT tracked (your personal rules)
3. Pre-commit hook prevents mistakes automatically
4. Works WITH AI assistant behavior, not against it

**Philosophy**: Design systems that accommodate AI tendencies while protecting what matters.

---

**Last Updated**: 2025-11-14
**Maintained By**: Development Team
**Questions**: See validation script output or ask in team chat
