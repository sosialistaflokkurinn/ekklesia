# .gitignore Two-File Strategy Migration Guide

**Date**: 2025-11-14
**Status**: 🚨 **BREAKING CHANGE** - Action Required
**Affected**: All developers
**Priority**: High - Must complete before next `git pull`

---

## What Changed

The Ekklesia project has **migrated to a two-file .gitignore strategy**:

**BEFORE** (old way):
- `.gitignore` was tracked in git (shared by everyone)
- Everyone had the same ignore rules
- Personal files needed manual ignore patterns

**AFTER** (new way - Nov 14, 2025):
- ✅ `.gitignore.example` = Shared template (tracked in git)
- ✅ `.gitignore` = Your personal config (**NOT tracked in git**)
- `.gitignore` ignores itself - never committed

---

## Why This Change

### Problems with old approach:
1. **Personal files leaked into commits** (data/, .claude/, etc.)
2. **Merge conflicts** when multiple developers updated ignore rules
3. **No flexibility** for personal development workflows
4. **Documentation mismatch** - guides described two-file strategy that wasn't implemented

### Benefits of new approach:
1. ✅ **Personal files stay local** - never accidentally committed
2. ✅ **No merge conflicts** on .gitignore
3. ✅ **Customizable** for your workflow
4. ✅ **Follows industry best practices**

---

## 🚨 IMMEDIATE ACTION REQUIRED

**BEFORE your next `git pull`**, run these commands:

```bash
# 1. Save your current .gitignore (backup)
cp .gitignore .gitignore.backup

# 2. Pull the breaking change
git pull origin feature/epic-186-member-voting-experience

# 3. Copy template to create your personal .gitignore
cp .gitignore.example .gitignore

# 4. Add back your personal patterns (if any)
# Edit .gitignore and add your personal rules at the end
nano .gitignore

# 5. Verify .gitignore is NOT tracked
git ls-files .gitignore
# Should return EMPTY (good)

# 6. Verify .gitignore is ignored
git check-ignore -v .gitignore
# Should return: .gitignore:13:.gitignore  .gitignore (good)
```

---

## What to Add to YOUR .gitignore

After copying `.gitignore.example`, add these personal patterns at the end:

### Common Personal Patterns

```gitignore
##################################################################
# MY PERSONAL DEVELOPMENT FILES
##################################################################

# IDE / AI Tool Settings (if you use them)
.claude/
.gemini/
.cursor/

# Personal work directories
correct-mark-of-the-party/     # Party logo work
my-scripts/                     # Your personal scripts
scratch/                        # Temporary work

# Local data files
data/                           # Local data directory
data/Stadfangaskra.csv         # Address registry
AUDIT_CODE_DOCUMENTATION_*.json # Audit files

# Personal notes
*.personal.md
TODO.md
NOTES.md
```

### Example: My Personal .gitignore Setup

```bash
# After: cp .gitignore.example .gitignore
# Add at the end:

echo "" >> .gitignore
echo "# Personal development files" >> .gitignore
echo ".claude/" >> .gitignore
echo "data/" >> .gitignore
echo "*.personal.md" >> .gitignore
```

---

## Updating Shared Rules (Project-Wide)

**When to update `.gitignore.example`:**

Update the shared template when you discover a pattern that **ALL developers** need:

1. **New security patterns** (credentials, API keys)
2. **New build artifacts** (new frameworks, tools)
3. **Common mistakes** (files multiple people accidentally committed)

**How to update `.gitignore.example`:**

```bash
# 1. Edit the template
nano .gitignore.example

# 2. Add pattern with explanation
echo "# New framework build output" >> .gitignore.example
echo "new-framework-dist/" >> .gitignore.example

# 3. Commit ONLY .gitignore.example (NOT .gitignore!)
git add .gitignore.example
git commit -m "chore(gitignore): add new-framework build output"

# 4. Update your personal .gitignore
cp .gitignore.example .gitignore
# Add back your personal patterns at the end
```

---

## Troubleshooting

### Problem: "fatal: pathspec '.gitignore' did not match any files"

**Cause**: You tried to commit `.gitignore` but it's now ignored.

**Solution**: This is **correct behavior**! `.gitignore` should never be committed.
- If you need to update shared rules, edit `.gitignore.example` instead
- Your personal `.gitignore` stays local only

### Problem: My personal files show up in `git status`

**Cause**: Your `.gitignore` doesn't have your personal patterns.

**Solution**:
```bash
# Check what's showing up
git status

# Add missing patterns to YOUR .gitignore
echo "my-personal-file/" >> .gitignore

# Verify it's now ignored
git check-ignore -v my-personal-file/
```

### Problem: I accidentally committed `.gitignore` before migration

**Cause**: Old commits have `.gitignore` tracked.

**Solution**: This is fine! The migration commit removes it from tracking going forward.
- Old commits still have `.gitignore` (history preserved)
- New commits won't track `.gitignore` (new behavior)

### Problem: Merge conflict on `.gitignore`

**Cause**: Someone didn't follow migration guide.

**Solution**:
```bash
# 1. Accept remote version (delete from tracking)
git checkout --theirs .gitignore
git rm .gitignore

# 2. Copy template to create your personal config
cp .gitignore.example .gitignore

# 3. Complete merge
git commit -m "fix: resolve .gitignore merge conflict (follow two-file strategy)"
```

---

## Validation Commands

### Check Your Setup is Correct

```bash
# 1. .gitignore should NOT be tracked
git ls-files .gitignore
# Expected: (empty)
# ❌ If you see ".gitignore", it's still tracked - run: git rm --cached .gitignore

# 2. .gitignore should be ignored
git check-ignore -v .gitignore
# Expected: .gitignore:13:.gitignore	.gitignore
# ❌ If empty, .gitignore is not ignoring itself

# 3. .gitignore.example SHOULD be tracked
git ls-files .gitignore.example
# Expected: .gitignore.example
# ❌ If empty, template is not tracked - run: git add .gitignore.example

# 4. Your personal patterns should work
git status
# Expected: No personal files shown (data/, .claude/, etc.)
# ❌ If you see personal files, add patterns to YOUR .gitignore
```

### Compare Your Config to Template

```bash
# See what you've added personally
diff .gitignore.example .gitignore | grep "^>" | head -20
```

---

## Migration Commit Details

**Commit**: `XXXXXXX` (Nov 14, 2025)
**Branch**: `feature/epic-186-member-voting-experience`
**PR**: #250

**Changes in commit**:
1. ✅ Removed `.gitignore` from git tracking
2. ✅ Updated `.gitignore.example` with all project-wide rules
3. ✅ Added personal patterns section to template (commented examples)

**Files affected**:
- `D .gitignore` (deleted from tracking - still exists locally!)
- `M .gitignore.example` (updated with 44 new lines)

---

## For Team Leads

### Communication Checklist

- [ ] Post migration guide in team chat
- [ ] Add to next standup agenda
- [ ] Create Slack reminder before merge to main
- [ ] Update onboarding docs for new developers
- [ ] Monitor for merge conflicts in next week

### Monitoring

```bash
# Check who still has .gitignore tracked (after merge)
git log --all --oneline -- .gitignore | head -1

# Find developers who might need help
git log --since="2025-11-14" --author=.* -- .gitignore
```

---

## New Developer Setup

**When cloning the repository** (after migration):

```bash
# 1. Clone repository
git clone https://github.com/sosialistaflokkurinn/ekklesia.git
cd ekklesia

# 2. Set up .gitignore (FIRST THING!)
cp .gitignore.example .gitignore

# 3. Add your personal patterns
nano .gitignore
# Add at end:
# .claude/
# data/
# *.personal.md

# 4. Verify setup
git check-ignore -v .gitignore
# Should show: .gitignore:13:.gitignore	.gitignore

# 5. Install dependencies (node_modules/ will be ignored)
npm install
```

---

## Related Documentation

- [GITIGNORE_STRATEGY.md](GITIGNORE_STRATEGY.md) - Detailed strategy guide
- [GIT_IGNORE_ISSUE_RESOLUTION.md](../../troubleshooting/GIT_IGNORE_ISSUE_RESOLUTION.md) - Historical context
- [GITIGNORE_STRATEGY.md](GIT_IGNORE_STRATEGY.md) - Alternative guide (merge with above)

---

## Summary

**KEY CHANGES:**

1. ❌ **STOP** committing `.gitignore`
2. ✅ **START** using `.gitignore.example` for shared rules
3. ✅ **CREATE** your personal `.gitignore` with: `cp .gitignore.example .gitignore`
4. ✅ **ADD** your personal patterns to the end of `.gitignore`

**REMEMBER:**

- `.gitignore` = Your personal config (never committed)
- `.gitignore.example` = Shared template (always committed)
- `.gitignore` ignores itself automatically

**TIMELINE:**

- **2025-11-14**: Migration commit created
- **Next**: Complete migration before `git pull`
- **After**: Monitor for issues, help team members

---

**Questions?** Check [GITIGNORE_STRATEGY.md](GITIGNORE_STRATEGY.md) or ask in team chat.

**Status**: 🚨 **BREAKING CHANGE** - Follow guide before next pull!
