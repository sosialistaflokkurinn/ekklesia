# Ekklesia Branch Strategy

**Created**: 2025-10-09
**Last Updated**: 2025-10-12
**Status**: ✅ PR #28 Merged - PR #29 Awaiting Review
**Context**: Using "Squash and merge" strategy for clean git history

---

## Current Branch Structure (Oct 12, 2025)

```
main ────────────────────────────────────────────────────▶ (PR #28 merged Oct 10)
         │
         └─ feature/elections-design-and-ops-docs ───────▶ (PR #29, awaiting Ágúst review)
                           │
                           └─ feature/security-hardening ─▶ (current: security improvements)
```

---

## Active Branches

### main (Updated Oct 10, 2025)
- ✅ PR #28 merged: Members service (Firebase migration)
- ✅ Merge method: **Squash and merge** (commit: `8d0c8c2`)
- ✅ Production ready

### feature/elections-design-and-ops-docs (PR #29)
- 🔄 Status: **Awaiting Ágúst review**
- Contains: Events + Elections + S2S + Documentation (89 commits)
- Will be merged using: **Squash and merge** (same as PR #28)

### feature/security-hardening (Current)
- ✅ Created: Oct 12, 2025
- 🔨 Status: **Active development**
- Based on: `feature/elections-design-and-ops-docs`
- Planned method: **Squash and merge** (when ready for PR)
- Purpose: Security improvements (issues #30-33)
  - Rate limiting for Cloud Functions (#31)
  - CSRF protection verification (#33)
  - Idempotency for user creation (#32)
  - Firestore security rules review (#30)

---

## Branch Strategy: Squash and Merge

### Why Squash and Merge?

**Historical Success**: PR #28 used "Squash and merge" successfully → one clean commit (`8d0c8c2`)

**Benefits**:
- ✅ Combines many commits into one clean commit
- ✅ Eliminates duplicate commits automatically
- ✅ Clean git history on main
- ✅ Easy to revert if needed
- ✅ Proven approach in this project

### PR #29 Merge Process

**Ágúst will:**
1. Review and approve PR #29
2. Click **"Squash and merge"** button (NOT "Merge pull request")
3. Edit squash commit message
4. Confirm merge

**Result**: One clean commit on main with all work preserved

---

## Creating New Branches

### Option A: Before PR #29 Merges (Current Situation)

**When**: You want to start new work while waiting for Ágúst's review

**How**: Branch from current feature branch

```bash
# Stay on current branch (has all Events/Elections code)
git checkout feature/elections-design-and-ops-docs

# Create new branch from here
git checkout -b feature/your-new-feature-name

# Push to remote
git push -u origin feature/your-new-feature-name
```

**Pros**:
- ✅ Can start work immediately
- ✅ Has all Events/Elections code
- ✅ Independent from PR #29 review timeline

**What happens when PR #29 merges?**
- Nothing! Continue working on your branch
- When ready, create PR from your branch → main
- GitHub will use "Squash and merge" again
- Clean history maintained

---

### Option B: After PR #29 Merges

**When**: PR #29 is merged to main

**How**: Branch from updated main

```bash
# Update main
git checkout main
git pull origin main

# Create new branch from clean main
git checkout -b feature/your-new-feature-name

# Push to remote
git push -u origin feature/your-new-feature-name
```

**Pros**:
- ✅ Cleanest starting point
- ✅ Based on latest main

---

## Branch Naming Convention

### Format
`feature/[description]` or `feature/[issue-type]-[brief-name]`

### Examples
- `feature/security-hardening` - Security improvements (#30-33)
- `feature/member-portal-ui` - Member portal UI (#23, #25-27)
- `feature/admin-election-management` - Admin features (#24)
- `feature/load-testing-phase-6` - Load testing (Phase 6)
- `feature/rate-limiting` - Specific feature

---

## Workflow Summary

### Current State (Oct 12)
1. ✅ main has Members service (PR #28, squash merged)
2. 🔄 PR #29 awaiting Ágúst review (Events + Elections)
3. 🆕 Can create new branch now from current feature branch

### For New Work
```bash
# 1. Create branch from current feature branch
git checkout feature/elections-design-and-ops-docs
git checkout -b feature/your-feature-name
git push -u origin feature/your-feature-name

# 2. Work on your feature
# Make commits as needed

# 3. When ready, create PR
# PR will target: feature/your-feature-name → main

# 4. Ágúst will review and use "Squash and merge"
# Result: One clean commit on main
```

### Key Points
- ✅ **Always use "Squash and merge"** for ALL PRs to main
- ✅ **Branch names** should be descriptive
- ✅ **Can branch before PR #29 merges** - no problem!
- ✅ **Each PR** gets squashed to one commit (consistent history)
- ✅ **feature/security-hardening** will also use "Squash and merge"

---

## Historical Record

### PR #28 (Members Service)
- Created: Oct 8, 2025
- Merged: Oct 10, 2025
- Method: **Squash and merge** ✅
- Result: One commit `8d0c8c2`
- Status: ✅ Success

### PR #29 (Events + Elections)
- Created: Oct 10, 2025
- Status: Awaiting Ágúst review
- Planned method: **Squash and merge**
- Contains: 89 commits → will become 1 commit

### feature/security-hardening (Future PR)
- Created: Oct 12, 2025
- Branched from: `feature/elections-design-and-ops-docs`
- Purpose: Security improvements (#30-33)
- Planned method: **Squash and merge**
- Status: Active development
- Will create PR to main when ready

---

## Quick Reference Commands

```bash
# Check current branch
git branch --show-current

# Create new branch from current location
git checkout -b feature/new-branch-name

# Push new branch to remote
git push -u origin feature/new-branch-name

# Update main after PR merges
git checkout main
git pull origin main

# View recent commits
git log --oneline -10

# View all branches
git branch -a
```

---

**Last Updated**: 2025-10-12
**Key Strategy**: Use "Squash and merge" for all PRs to maintain clean git history
