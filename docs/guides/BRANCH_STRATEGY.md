# Ekklesia Branch Strategy

**Created**: 2025-10-09
**Last Updated**: 2025-10-11
**Status**: ✅ PR #28 Merged - Awaiting PR #29 Review
**Context**: Multiple services developed in feature branches, PR #28 merged Oct 10, PR #29 awaiting Ágúst review

---

## Current Branch Structure (Oct 11, 2025)

```
main ────────────────────────────────────────────────────▶ (PR #28 merged Oct 10)
         │
         └─ feature/elections-design-and-ops-docs ───────▶ (PR #29, awaiting review)
                           │
                           └─ (88 commits: Members + Events + Elections + Docs)
```

### Branch Status

**main** (Updated Oct 10, 2025):
- ✅ PR #28 merged: Members service (Firebase migration)
- ✅ Merge method: **Squash and merge** (one commit: `8d0c8c2`)
- ✅ Includes: Firebase Authentication, Kenni.is OAuth PKCE flow
- ✅ Production ready

**feature/elections-design-and-ops-docs** (PR #29, Current):
- Based on old `feature/firebase-members-auth` branch
- ⚠️ Contains 88 commits including:
  - Members service work (already in main via PR #28) - **duplicate commits**
  - Events service implementation (5 commits) - ✅ Production (Oct 9)
  - Elections service implementation (1 commit) - ✅ Production (Oct 9-10)
  - S2S integration (Phase 5) - ✅ Complete (Oct 10)
  - Documentation and operational guides - ✅ Complete
  - Code audit and cleanup (Oct 11) - ✅ Complete
- 🔄 Status: **Awaiting Ágúst review** before merge

---

## ✅ Recommended Strategy: Squash and Merge PR #29

### Why Squash and Merge?

**Historical Context**: PR #28 (Members service) was successfully merged using **"Squash and merge"** on Oct 10, 2025, creating one clean commit (`8d0c8c2`) on main.

PR #29 contains 88 commits with duplicate Members commits (already in main via PR #28). Using GitHub's **"Squash and merge"** button will:

- ✅ Combine all 88 commits into **one clean commit** (same as PR #28)
- ✅ Eliminate duplicate Members commits automatically
- ✅ Create clean git history on main
- ✅ Preserve all functionality (Events + Elections + Documentation)
- ✅ Easier to revert if needed (single commit)
- ✅ **Proven approach**: Successfully used for PR #28

### Merge Process (After Ágúst Review)

**Step 1: Wait for Ágúst Review**
- 🔄 PR #29 awaiting review: https://github.com/sosialistaflokkurinn/ekkleia/pull/29
- ⏳ Do not merge until approved

**Step 2: Use GitHub Web Interface "Squash and merge"**
1. Go to PR #29 on GitHub
2. Click **"Squash and merge"** button (NOT "Merge pull request")
3. Edit squash commit message:
   ```
   feat: implement Events and Elections services with S2S integration (#17, #18, #19)

   - Events service: Token issuance and election administration (Oct 9)
   - Elections service: Anonymous ballot recording (Oct 9-10)
   - S2S integration: Phase 5 complete (Oct 10)
   - Documentation: Operational guides, usage context, code audit (Oct 11)
   - Closes #17, #18, #19
   ```
4. Confirm squash and merge

**Step 3: Clean Up After Merge**
```bash
# Update local main
git checkout main
git pull origin main

# Delete feature branch (local and remote)
git branch -d feature/elections-design-and-ops-docs
git push origin --delete feature/elections-design-and-ops-docs

# Verify clean state
git log --oneline -10
```

**Result**: Main will have one clean commit with all Events + Elections + Documentation work.

---

## Creating New Branch (After PR #29 Merges)

### For Next Phase Work (e.g., Load Testing, Phase 6)

```bash
# 1. Ensure main is up to date
git checkout main
git pull origin main

# 2. Create new branch from clean main
git checkout -b feature/load-testing-phase-6

# 3. Start new work
# All Events and Elections code is now in main
```

### For Independent Feature Work

```bash
# Create feature branch from main
git checkout main
git pull origin main
git checkout -b feature/your-feature-name

# Work on feature independently
```

---

## Previous Strategy (Archived for Reference)

### Phase 1: Documentation Branch (Now - SUPERSEDED)

**Current branch**: `feature/elections-design-and-ops-docs`

**Commit only documentation** (no Elections implementation):
- ✅ ELECTIONS_SERVICE_MVP.md (design document)
- ✅ USAGE_CONTEXT.md (load patterns, 300 votes/sec)
- ✅ OPERATIONAL_PROCEDURES.md (meeting day operations)
- ✅ .gitignore updates
- ❌ **Do NOT commit** `elections/` directory (implementation)

**Why**: Keep design/planning separate from implementation.

### Phase 2: Wait for PR #28 Merge

Agusti needs to review and approve PR #28 (Members service).

**PR #28**: https://github.com/sosialistaflokkurinn/ekklesia/pull/28

### Phase 3: Rebase Events Branch (After #28 Merges)

Once PR #28 merges to main:

```bash
# 1. Update main
git checkout main
git pull origin main

# 2. Rebase Events branch to remove duplicate Members commits
git checkout feature/events-service-mvp
git rebase main

# This removes Members commits (already in main)
# Keeps only 5 Events commits

# 3. Force push (if already pushed to remote)
git push origin feature/events-service-mvp --force-with-lease
```

### Phase 4: Create Elections Implementation Branch (After #28 Merges)

**Create new branch from main** for Elections service:

```bash
# 1. Make sure main is up to date
git checkout main
git pull origin main

# 2. Create new Elections branch from clean main
git checkout -b feature/elections-service-mvp

# 3. Copy Elections implementation from current branch
# (Use git cherry-pick or manual copy)

# OR: Work on Elections implementation fresh from design doc
```

**Why separate branch**:
- ✅ Clean git history (no duplicate commits)
- ✅ Independent PR review (Elections separate from Events)
- ✅ Easier to revert if needed
- ✅ Follows same pattern as Events service

### Phase 5: Create Pull Requests

After PR #28 merges:

1. **PR for Elections Design** (from `feature/elections-design-and-ops-docs`):
   - Documentation only
   - USAGE_CONTEXT, OPERATIONAL_PROCEDURES, design docs
   - Should be quick review

2. **PR for Events Service** (from `feature/events-service-mvp` after rebase):
   - 5 commits with Events implementation
   - Clean history (no Members commits)

3. **PR for Elections Service** (from `feature/elections-service-mvp`):
   - Elections implementation
   - Created after #28 merges
   - Based on clean main

---

## What NOT to Do

❌ **Don't commit Elections implementation on current branch**
- Elections service (`elections/` directory)
- Keep for local testing only

❌ **Don't merge current branch to main before PR #28**
- Would create duplicate Members commits

❌ **Don't create Elections PR before #28 merges**
- Would have all Members commits as dependencies

---

## Timeline

1. **Now** (Oct 9):
   - ✅ Events service deployed to production
   - ✅ Elections design complete
   - 🔨 Commit Elections design docs (not implementation)

2. **Wait**: Agusti merges PR #28 to main

3. **After #28 merges**:
   - Rebase `feature/events-service-mvp` on main
   - Create `feature/elections-service-mvp` from main
   - Implement Elections service on new branch

4. **Create PRs**:
   - PR: Elections design docs
   - PR: Events service (rebased)
   - PR: Elections service (new branch)

---

## Handling the Elections Implementation

### Current State

Elections service is implemented locally but **not committed**:
- `elections/` directory exists
- Database migrations tested
- API endpoints tested
- Ready for Cloud Run deployment

### What to Do

**Option A: Stash for later** (Recommended)
```bash
# 1. Stash Elections implementation
git stash push -m "Elections implementation (for later branch)" elections/

# 2. Commit only documentation
git add docs/design/ELECTIONS_SERVICE_MVP.md
git add docs/USAGE_CONTEXT.md
git add docs/OPERATIONAL_PROCEDURES.md
git add .gitignore
git commit -m "docs: add Elections service design and operational procedures"

# 3. After PR #28 merges, create new branch and apply stash
git checkout main
git pull origin main
git checkout -b feature/elections-service-mvp
git stash pop

# 4. Commit Elections implementation on new branch
git add elections/
git commit -m "feat(elections): implement Elections service MVP"
```

**Option B: Keep local only**
```bash
# 1. Don't commit elections/ at all
# 2. After PR #28 merges, recreate Elections branch
# 3. Re-implement or copy from local files
```

---

## Rebase Explanation

### Before Rebase (feature/events-service-mvp):
```
main ────────────────────────A (PR #28 merged - Members commits)
                             │
feature/events-service-mvp:  A──B──C──D──E──F
                             ▲           ▲▲▲▲▲
                             │           │││││
                        (Members)    (Events - 5 commits)
```

### After Rebase:
```
main ────────────────────────A (Members already here)
                             │
feature/events-service-mvp:  └──B──C──D──E──F
                                ▲▲▲▲▲▲▲▲▲▲▲▲▲
                                (Events only - 5 commits)
```

**Result**: Clean PR with only Events changes, no duplicate Members commits.

---

## Commands Quick Reference

```bash
# Check current branch
git branch --show-current

# See all branches
git branch -a

# Stash Elections implementation
git stash push -m "Elections for later" elections/

# After PR #28 merges - Rebase Events
git checkout main && git pull origin main
git checkout feature/events-service-mvp
git rebase main
git push origin feature/events-service-mvp --force-with-lease

# Create new Elections branch
git checkout main && git pull origin main
git checkout -b feature/elections-service-mvp
git stash pop  # If you stashed it earlier

# View commit history
git log --oneline --graph --all --decorate | head -30
```

---

## Benefits of This Strategy

✅ **Independent Services**: Each service has its own PR and review cycle
✅ **Clean History**: No duplicate commits in any PR
✅ **Easy Review**: Reviewers see only relevant changes per PR
✅ **Flexible Rollback**: Can revert one service without affecting others
✅ **Parallel Work**: Can work on Elections while waiting for PR #28
✅ **Clear Dependencies**: Elections design → Events service → Elections implementation

---

## Current Status Summary (Oct 11, 2025)

### Completed Work
- ✅ **PR #28**: Members service - **MERGED** Oct 10, 2025
- ✅ **PR #29**: Events + Elections + Documentation - **Awaiting Ágúst review**
- ✅ **Events service**: Deployed to production (Oct 9)
- ✅ **Elections service**: Deployed to production (Oct 9-10)
- ✅ **Phase 5**: S2S integration complete (Oct 10)
- ✅ **Documentation**: Code audit and cleanup (Oct 11)

### What's in PR #29 (88 commits)
1. Members service work (duplicate of PR #28) - will be eliminated by squash merge
2. Events service implementation (5 commits)
3. Elections service implementation (1 commit)
4. S2S integration (Phase 5)
5. Operational procedures and usage context
6. Code audit (Oct 11)
7. Documentation cleanup (Oct 11)

### Next Steps
1. ⏳ **Wait for Ágúst review** of PR #29
2. ✅ **Squash and merge** PR #29 using GitHub web interface
3. 🆕 **Create new branch** from main for next phase work

---

## Notes

- **PR #28**: Created Oct 8, merged Oct 10, 2025 (Members service)
  - Merge method: **Squash and merge** ✅
  - Result: One commit `8d0c8c2` on main
  - Merged by: gudrodur (Guðröður Atli Jónsson)
- **PR #29**: Created Oct 10, 2025 - 88 commits awaiting review
  - Recommended merge method: **Squash and merge** (same as PR #28)
  - Will create one clean commit on main
- **Branch strategy**: Use "Squash and merge" to clean up duplicate commits
- **Future branches**: Always create from updated main after PR #29 merges

**Key Decision**: Use GitHub's "Squash and merge" button to handle duplicate commits automatically.

**Historical Validation**: PR #28 proved this approach works successfully - one clean commit, no issues.
