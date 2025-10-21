# ⚡ Git Recovery Quick Reference Card

**Situation:** Lost work during PR #34 merge (file reorganization conflicts)  
**Status:** ✅ Recoverable - 6 dangling commits found  
**Time Required:** 5-15 minutes

---

## 🚀 Quick Recovery (Copy & Paste)

### Step 1: List All Dangling Commits
```bash
git fsck --lost-found 2>/dev/null | grep "dangling commit"
```

**You should see:**
```
dangling commit 110598d6f5ba50e392a31b9c28a49db34cbaf8c5
dangling commit 2e1b0237c7c82ae89369fc4762d7911ffee38727
dangling commit 0a2b26c0021635c84f984f900fae976b8aa3acc4
dangling commit 1f3de009831e7ada0fe7102dd32ace80b03ca657
dangling commit 4c560ee218036f3c3300f25b27640593e122f7ad
dangling commit ba797855541fbdd6e742c6dff9fcf672b6ae54d9
```

### Step 2: Examine Dangling Commits (Choose Your Commits)
```bash
# Check each one (takes 30 seconds per commit)
git show --stat 110598d6f5ba50e392a31b9c28a49db34cbaf8c5
git show --stat 2e1b0237c7c82ae89369fc4762d7911ffee38727
git show --stat 0a2b26c0021635c84f984f900fae976b8aa3acc4
# ... etc for others
```

**Look for commits with:**
- Your files
- Dates matching your work
- Meaningful commit messages

### Step 3: Create Recovery Branches (Save These)
```bash
# Create recovery branches for commits with your work
git branch recovery/lost-1 110598d6f5ba50e392a31b9c28a49db34cbaf8c5
git branch recovery/lost-2 2e1b0237c7c82ae89369fc4762d7911ffee38727
git branch recovery/lost-3 0a2b26c0021635c84f984f900fae976b8aa3acc4

# View your recovery branches
git branch -a | grep recovery
```

### Step 4: Review Each Recovery Branch
```bash
# Switch to recovery branch
git checkout recovery/lost-1

# See what files are there
git diff main --name-status

# See full diff (if small enough)
git diff main

# Or review specific files
ls -la docs/
git log --oneline -5
```

### Step 5: Extract Your Work (Choose Method)

#### Option A: Cherry-Pick (Recommended)
```bash
git checkout main
git cherry-pick recovery/lost-1
# Might get conflicts - resolve them, then:
# git add .
# git cherry-pick --continue
```

#### Option B: Create Patch
```bash
git checkout main
git diff main recovery/lost-1 > recovery.patch
# Review patch
less recovery.patch
# Apply patch (interactive)
git apply -p1 --check recovery.patch  # Test first
git apply -p1 recovery.patch
```

#### Option C: Manually Copy Files
```bash
# Check out files from recovery branch
git checkout recovery/lost-1 -- docs/ARCHITECTURE_DESIGN_PHASE6.md

# Or multiple files
git checkout recovery/lost-1 -- docs/

# Review what you're about to commit
git status
git diff --cached

# Commit
git add .
git commit -m "recover: restore files from merge recovery"
```

### Step 6: Verify & Clean Up
```bash
# Check current status
git status
git log --oneline -3

# Verify no uncommitted changes
git diff HEAD

# Delete recovery branches (when confident)
git branch -D recovery/lost-1
git branch -D recovery/lost-2
git branch -D recovery/lost-3

# Verify cleanup
git branch -a | grep recovery
```

### Step 7: Push to Remote
```bash
git push origin main
```

---

## 📊 Understanding the Output

### What You'll See

```
dangling commit 110598d6f5ba50e392a31b9c28a49db34cbaf8c5
↑                ↑       ↑
status          type    hash (your lost work is here)

Shows file changes:
---
 docs/AUDIT_2025-10-20.md                           |  317 +++
 scripts/convert-to-bem.js                          |  349 ++++
 members/public/auth.js                             |   81 +-
 189 files changed, 41722 insertions(+), 4216 deletions(-)
 ↑       ↑            ↑                   ↑
 count   file name    additions           deletions
```

---

## 🚨 Important Notes

### ⚠️ DO NOT
- ❌ Run `git gc` or `git prune` (might delete dangling commits)
- ❌ Skip recovery branches (go straight to main)
- ❌ Cherry-pick into wrong branch
- ❌ Delete recovery branches before verifying

### ✅ DO
- ✅ Create recovery branches first (safe snapshots)
- ✅ Test on recovery branches (non-destructive)
- ✅ Commit recovery work explicitly
- ✅ Keep recovery branches for 24-48 hours as backup
- ✅ Verify everything works after recovery

---

## 🔄 If Something Goes Wrong

### "Cherry-pick got conflicts"
```bash
# See the conflicts
git status

# Resolve manually
# Then
git add .
git cherry-pick --continue
```

### "I picked the wrong commit"
```bash
# Undo the cherry-pick
git cherry-pick --abort

# Or reset to before cherry-pick
git reset --hard HEAD~1

# Try again with different commit
```

### "I can't remember which commit has my work"
```bash
# Show all dangling commits' details
for commit in $(git fsck --lost-found 2>/dev/null | grep "dangling commit" | awk '{print $3}'); do
  echo "=== $commit ==="
  git log -1 --oneline $commit
  git show --stat $commit | head -20
  echo ""
done
```

### "Did I lose more data?"
```bash
# Check if other dangling objects exist
git fsck --lost-found 2>/dev/null | grep "dangling" | wc -l

# Most are trees/blobs (internal), commits are your work
git fsck --lost-found 2>/dev/null | grep "dangling commit" | wc -l
```

---

## 📋 Checklist

Before you start recovery:
- [ ] I have read the MERGE_RECOVERY_GUIDE.md (full version)
- [ ] I have listed all dangling commits
- [ ] I have examined each dangling commit
- [ ] I know which commits have my work
- [ ] I have created recovery branches
- [ ] I tested on recovery branches first
- [ ] I understand git cherry-pick / apply
- [ ] I have verified my changes before pushing

---

## 🎯 Success Criteria

After recovery, you should have:
- ✅ All dangling commits found and recovered
- ✅ Your work restored to main branch
- ✅ No uncommitted changes (git status clean)
- ✅ Recovery branches deleted (cleanup)
- ✅ Changes pushed to remote
- ✅ Tests passing (if applicable)
- ✅ Team notified of recovery

---

## 💡 Tips

1. **Keep recovery branches for 48 hours** - In case you need to rollback
2. **Test cherry-picks on new branches first** - Before committing to main
3. **Use `git show --stat`** - Fastest way to see what's in each commit
4. **Document your recovery** - Add recovery notes to DOCUMENTATION_MAP.md
5. **Share what you learned** - Help team prevent this next time

---

## 📞 Questions?

See full guide: `docs/MERGE_RECOVERY_GUIDE.md`

Key sections:
- Why your work was "lost" → [Section 3]
- What happened during merge → [Section 2]
- Step-by-step recovery → [Section 4]
- Prevention for future → [Section 6]
- Technical details → [Section 7]
- FAQ → [Section 8]

---

**Created:** October 21, 2025  
**Status:** Ready to use  
**Recovery Risk:** 🟢 Low (Non-destructive process)  
**Estimated Time:** 5-15 minutes  
**Difficulty:** Medium (But we've made it simple!)

Good luck! 🚀
