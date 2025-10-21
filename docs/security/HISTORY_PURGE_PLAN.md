# Git History Purge Plan

**Status:** ⚠️ **PENDING MANUAL EXECUTION**  
**Date Created:** 2025-10-20  
**Priority:** CRITICAL  
**Action Required:** Human operator with `git-filter-repo` installed

---

## Executive Summary

Plaintext production database credentials and admin passwords were discovered in the repository's git history during the PR #34 security review. This document outlines the **exact, irreversible operation** required to purge them from all branches.

**WARNING:** This operation will rewrite repository history and requires a **force push**. All team members must pull the rewritten history immediately after.

---

## Credentials to Purge

### 1. Production Database Password (CRITICAL)

**String:** `***REMOVED***`

**Found in commits:**
- `docs/security/CRITICAL_SECURITY_RESPONSE.md` (line 27, 124)
- `docs/security/CREDENTIAL_MIGRATION_PLAN.md` (line 40)
- `docs/reviews/PR29_REVIEW_INDEX.md` (line 422, 442)
- `reset-election.sql` (line 5) — *already removed in commit 80b6009*

**Status:** Already rotated in Secret Manager (Oct 19, 2025). This credential is **COMPROMISED** and must be purged immediately.

---

### 2. Django Admin Password (HIGH)

**String:** `***REMOVED***`

**Found in commits:**
- `docs/legacy/DJANGO_LEGACY_SYSTEM.md` (line 47)

**Context:** Legacy Django system credential, plaintext in documentation.

---

## Pre-Purge Checklist

- [ ] All team members notified of impending force push
- [ ] All local branches backed up (git bundle or clone)
- [ ] `git-filter-repo` installed on operator workstation:
  ```bash
  pip install git-filter-repo
  ```
- [ ] Operator has write access to repository
- [ ] Production deployment stable (no active deploys during history rewrite)

---

## Purge Operation (Manual)

### Step 1: Create Filter List File

Create `~/passwords-to-filter.txt`:

```
***REMOVED***
***REMOVED***
```

### Step 2: Clone Fresh Repository (Safe Copy)

```bash
# Create a working directory
mkdir -p /tmp/ekklesia-history-purge
cd /tmp/ekklesia-history-purge

# Clone with all history
git clone --mirror https://github.com/sosialistaflokkurinn/ekklesia.git ekklesia.git

# Enter the mirror
cd ekklesia.git
```

### Step 3: Run git-filter-repo

```bash
git-filter-repo --replace-text ~/passwords-to-filter.txt \
  --force \
  --prune-empty=auto \
  --commit-callback 'echo "Rewriting commit: $(git rev-parse --short $GIT_COMMIT)"'
```

**What this does:**
- Scans all commits in all branches
- Replaces each occurrence of the passwords with empty string (removes them)
- Removes empty commits automatically
- Rewrites commit hashes (destructive)
- Regenerates all branch refs

**Expected Output:**
```
Enumerating objects: N, done.
Counting objects: 100% (N, N)
Compressing objects: 100% (N, N)
Writing objects: 100% (N, N), done.
Updating refs: 100% (refs, refs), done
Rewrite succeeded with 0 changes made in 1 pass.  (Time taken: X.XX s)
```

### Step 4: Push Rewritten History

```bash
cd ekklesia.git

# Verify mirror integrity
git fsck --full

# Push all branches and tags (force required)
git push --mirror --force https://github.com/sosialistaflokkurinn/ekklesia.git
```

**This command:**
- Overwrites all branches on GitHub (including `main`, `feature/security-hardening`, etc.)
- Overwrites all tags
- **Is irreversible on GitHub** (previous history is preserved only in local backups)

---

## Post-Purge Recovery

### For All Team Members

```bash
# Back up current work
git stash
git branch -av > ~/my-branches-backup.txt

# Fetch rewritten history
git fetch --all --prune

# Rebuild local branch tracking
git checkout main
git reset --hard origin/main

# Remove old refs
git reflog expire --all --expire=now
git gc --prune=now --aggressive
```

### Verify Purge Success

```bash
# Search for any remaining password fragments in the rewritten history
# After force-push to GitHub, all team members should verify:
git log --all --source -S 'Ab6/lTT' -- .
git log --all --source -S 'Vladimir Ilyich' -- .

# Expected result: Only HISTORY_PURGE_PLAN.md should appear (this document itself)
# If HISTORY_PURGE_PLAN.md is the ONLY result, the purge succeeded!

# To verify HISTORY_PURGE_PLAN.md is the only match:
git log --all --source -S 'Ab6/lTT' -- . | grep -v "HISTORY_PURGE_PLAN"

# If this command returns nothing, purge is complete and verified.
```

---

## Rollback Plan (If Something Goes Wrong)

If the purge fails or succeeds but causes issues:

1. **Keep the original mirror backup:**
   ```bash
   cp -r ekklesia.git ekklesia.git.backup-$(date +%s)
   ```

2. **Restore from backup (if needed before push):**
   ```bash
   rm -rf ekklesia.git
   cp -r ekklesia.git.backup-* ekklesia.git
   ```

3. **If already pushed:** Contact GitHub Support to restore from backup. This is why we maintain local backups!

---

## Monitoring Post-Purge

After the force push completes:

1. **GitHub Status:**
   - Verify `git log --all` shows rewritten commits
   - Check that no credentials appear in web UI file history
   - Confirm all CI/CD workflows still trigger (may use new commit SHAs)

2. **Team Notifications:**
   - Send message to Slack with rewritten history summary
   - Include link to post-purge recovery steps above
   - Advise force-pulling all branches

3. **Audit Trail:**
   - Document purge timestamp in issue #48 comment
   - Archive this plan document in `archive/ops/` for future reference
   - Update `docs/security/CRITICAL_SECURITY_RESPONSE.md` with completion status

---

## Why This is Safe (But Destructive)

**Safe because:**
- ✅ Credentials are already rotated/expired in production (Secret Manager)
- ✅ We're using a mirror clone (GitHub is authoritative after push)
- ✅ Local backups preserve original history for recovery
- ✅ `git-filter-repo` is battle-tested and widely used for this purpose

**Destructive because:**
- ❌ All commit SHAs will change
- ❌ GitHub branch protection rules may block force push (need admin override)
- ❌ CI/CD build numbers will be orphaned
- ❌ Local branches will diverge (require force-pull to fix)
- ❌ Open PRs will reference old commits (should be closed/rebased)

---

## Related Issues

- **Issue #48:** CRITICAL: Rotate database password (exposed in git history) — ✅ Rotation complete
- **PR #34:** Security Hardening, Secret Manager Integration & Documentation Audit — Blocking fix
- **Commit:** `d675af8` — "REDACT: Remove plaintext passwords from documentation" (this change)

---

## Command Quick Reference

```bash
# All-in-one (after setup)
git clone --mirror https://github.com/sosialistaflokkurinn/ekklesia.git /tmp/ekklesia.git && \
cd /tmp/ekklesia.git && \
git-filter-repo --replace-text ~/passwords-to-filter.txt --force --prune-empty=auto && \
git fsck --full && \
git push --mirror --force https://github.com/sosialistaflokkurinn/ekklesia.git
```

---

**Next Step:** Human operator executes the commands above. This document remains as an audit trail.
