# GitHub PR Quick Reference Card

**Last Updated:** 2025-10-20  
**Status:** ✅ Current

**Quick commands for managing PRs with `gh` CLI**

## Most Common Commands

```bash
# View PR
gh pr view 29
gh pr view 29 --web              # Open in browser

# Create PR
gh pr create                      # Interactive
gh pr create --draft              # Create as draft

# Update PR metadata
gh pr edit 29 --add-reviewer agustka
gh pr edit 29 --add-assignee gudrodur
gh pr edit 29 --add-label "Backend,DevOps"
gh pr edit 29 --milestone "Phase 5"

# Review PR
gh pr review 29 --approve
gh pr review 29 --request-changes
gh pr comment 29 --body "Looks good!"

# Merge PR (Squash and merge to main branch)
gh pr merge 29 --squash --delete-branch

# Check status
gh pr list
gh pr checks 29
gh pr diff 29
```

## Quick Updates for Ekklesia PRs

### Standard PR Setup
```bash
# Update any PR with standard metadata
gh pr edit <number> \
  --add-reviewer agustka \
  --add-assignee gudrodur \
  --add-label "Backend,DevOps"
```

### Current PRs (Oct 14, 2025)
```bash
# PR #29 - Events & Elections
gh pr view 29 --web

# PR #34 - Security Hardening
gh pr view 34 --web
```

## Project Strategy

**Always use "Squash and merge" to main branch**:
```bash
gh pr merge <number> --squash --delete-branch
```

---

**Full Guide**: [GITHUB_PR_MANAGEMENT.md](GITHUB_PR_MANAGEMENT.md)
