# Documentation Maintenance Guide

**Document Type**: Development Guide
**Last Updated**: 2025-11-09
**Status**: ✅ Active
**Purpose**: Guide for keeping key documentation files up-to-date

---

## Overview

This project has **key documentation files** that are loaded at every Claude Code session start. These files provide critical context about the system's current state, operational procedures, and security rules.

**Critical**: These docs **MUST** be kept up-to-date or sessions will have outdated context!

---

## Key Documentation Files

### 1. CURRENT_DEVELOPMENT_STATUS.md

**Location**: `docs/status/CURRENT_DEVELOPMENT_STATUS.md`
**Purpose**: Current infrastructure and system state
**Update Frequency**: After every deployment or infrastructure change

**When to Update**:
- ✅ New Cloud Run service deployed
- ✅ Database schema changed
- ✅ New Cloud Function added
- ✅ Service version updated
- ✅ Known issues identified or resolved

**What to Update**:
- Service versions and revision IDs
- Database connection strings (without secrets!)
- Infrastructure topology
- Known issues section
- Last updated date

### 2. USAGE_CONTEXT.md

**Location**: `docs/development/guides/workflows/USAGE_CONTEXT.md`
**Purpose**: System usage patterns and integration context
**Update Frequency**: When workflows or integration patterns change

**When to Update**:
- ✅ New integration pattern established
- ✅ Common workflow discovered
- ✅ User behavior patterns change
- ✅ New API endpoints added
- ✅ Authentication flow updated

**What to Update**:
- Integration examples
- Workflow descriptions
- Common use cases
- API usage patterns

### 3. OPERATIONAL_PROCEDURES.md

**Location**: `docs/operations/OPERATIONAL_PROCEDURES.md`
**Purpose**: Operational rules and procedures
**Update Frequency**: When operational procedures change

**When to Update**:
- ✅ Deployment process updated
- ✅ New incident response procedure
- ✅ Database operation procedure changed
- ✅ Rollback procedure updated
- ✅ New monitoring/alerting setup

**What to Update**:
- Step-by-step procedures
- Command examples
- Troubleshooting steps
- Contact information

### 4. SESSION_START_REMINDER.md

**Location**: `docs/SESSION_START_REMINDER.md`
**Purpose**: Security rules, PII protection, and session checklists
**Update Frequency**: When security rules or gitignore patterns change

**When to Update**:
- ✅ New gitignore pattern added
- ✅ New security rule established
- ✅ PII handling procedure updated
- ✅ New sensitive directory created
- ✅ Authentication requirements changed

**What to Update**:
- Security warnings
- Gitignore patterns
- PII protection rules
- Checklists
- Last updated date

---

## Automated Maintenance Tools

### 1. Documentation Freshness Checker

**Script**: `scripts/admin/documentation-maintenance/check-docs-freshness.sh`

```bash
# Check if docs are up-to-date (7 day threshold)
./scripts/admin/documentation-maintenance/check-docs-freshness.sh 7

# Output:
# ✅ FRESH (2 days): docs/status/CURRENT_DEVELOPMENT_STATUS.md
# ⚠️  STALE (15 days): docs/operations/OPERATIONAL_PROCEDURES.md
```

**Usage**:
- Run manually before starting complex work
- Runs automatically via GitHub Actions weekly
- Runs automatically on push to main

### 2. Git Post-Commit Hook

**Script**: `scripts/admin/documentation-maintenance/post-commit-reminder.sh`

**Install**:
```bash
./scripts/admin/documentation-maintenance/install-git-hook.sh
```

**What it does**:
- Runs after every `git commit`
- Shows reminder if commit seems significant (feat:, deploy, etc.)
- Skips reminder if docs were already updated in the commit

**Example output**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 Documentation Update Reminder
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This commit appears significant and may need documentation updates:

  "feat: Add new elections API endpoint"

Consider updating (if needed):

  ✓ CURRENT_DEVELOPMENT_STATUS.md - Infrastructure/deployments
  ✓ OPERATIONAL_PROCEDURES.md     - New procedures/workflows
  ✓ SESSION_START_REMINDER.md     - Security rules/gitignore
  ✓ USAGE_CONTEXT.md              - System usage patterns

Check freshness: ./scripts/admin/documentation-maintenance/check-docs-freshness.sh

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 3. GitHub Actions Workflow

**File**: `.github/workflows/check-docs-freshness.yml`

**Triggers**:
- Every push to `main`
- Weekly on Mondays at 9:00 AM UTC
- Manual dispatch

**What it does**:
1. Runs `check-docs-freshness.sh` with 14-day threshold
2. If docs are stale, creates GitHub issue with checklist
3. If run on PR, adds comment reminding to update docs

**Issue example**:
```markdown
## 📝 Key Documentation Files Need Updates

The following key documentation files have not been updated recently (threshold: 14 days):

### Files to Review:
- [ ] docs/status/CURRENT_DEVELOPMENT_STATUS.md
- [ ] docs/development/guides/workflows/USAGE_CONTEXT.md
- [ ] docs/operations/OPERATIONAL_PROCEDURES.md
- [ ] docs/SESSION_START_REMINDER.md

### Action Required:
1. Review each file and update with recent changes
...
```

---

## Claude Code Session Integration

### SessionStart Hooks

**Location**: `.claude/settings.local.json`

These docs are **automatically loaded** at session start:

```json
"hooks": {
  "SessionStart": [
    {
      "hooks": [
        { "type": "command", "command": "cat docs/status/CURRENT_DEVELOPMENT_STATUS.md" },
        { "type": "command", "command": "cat docs/development/guides/workflows/USAGE_CONTEXT.md" },
        { "type": "command", "command": "cat docs/operations/OPERATIONAL_PROCEDURES.md" },
        { "type": "command", "command": "cat docs/SESSION_START_REMINDER.md" }
      ]
    }
  ]
}
```

**New Instruction Hook**: Documentation Maintenance Reminder

Reminds Claude at session start:
- Which docs are loaded
- When to update each doc
- What to update in each doc
- Command to check freshness

---

## Maintenance Workflow

### At End of Session

Before ending a Claude Code session, run this checklist:

```bash
# 1. Check what was changed
git log --since="1 day ago" --oneline --decorate

# 2. Check if docs are fresh
./scripts/admin/documentation-maintenance/check-docs-freshness.sh 7

# 3. Identify docs that need updates
# Did I:
# - Deploy infrastructure? → Update CURRENT_DEVELOPMENT_STATUS.md
# - Change procedures? → Update OPERATIONAL_PROCEDURES.md
# - Add security rules? → Update SESSION_START_REMINDER.md
# - Change workflows? → Update USAGE_CONTEXT.md

# 4. Update relevant docs
# (edit files as needed)

# 5. Commit doc updates
git add docs/
git commit -m "docs: Update session context files after [changes]"
```

### Weekly Review

Every Monday (automated via GitHub Actions):

1. GitHub Action runs freshness check
2. If docs are stale (>14 days), issue is created
3. Assign issue to on-call developer
4. Review and update all flagged docs
5. Close issue when done

### Before Major Work

Before starting major infrastructure work:

```bash
# Ensure you have fresh context
./scripts/admin/documentation-maintenance/check-docs-freshness.sh 7

# If any docs are stale, review and update them first
# This ensures you start with accurate system context
```

---

## Best Practices

### DO ✅

- Update docs **immediately** after deployments
- Include doc updates in the **same commit** as code changes
- Use the freshness checker **before starting work**
- Install the git post-commit hook
- Review the weekly GitHub issue
- Keep "Last Updated" dates accurate

### DON'T ❌

- Let docs go >14 days without review
- Ignore the post-commit hook reminders
- Update only code without updating docs
- Skip doc updates because "it's just a small change"
- Leave stale information that contradicts reality

---

## Troubleshooting

### "Docs are stale but nothing changed"

If docs show as stale but system hasn't changed:

```bash
# Add a commit updating "Last Reviewed" date
git add docs/status/CURRENT_DEVELOPMENT_STATUS.md
git commit -m "docs: Review CURRENT_DEVELOPMENT_STATUS.md - no changes needed"
```

### "Git hook doesn't show reminder"

Check if hook is installed:

```bash
ls -la .git/hooks/post-commit
# Should be a symlink to scripts/admin/documentation-maintenance/post-commit-reminder.sh

# If not, reinstall:
./scripts/admin/documentation-maintenance/install-git-hook.sh
```

### "GitHub Action failing"

Check script permissions:

```bash
chmod +x scripts/admin/documentation-maintenance/check-docs-freshness.sh
git add scripts/admin/documentation-maintenance/
git commit -m "fix: Make doc freshness script executable"
```

---

## Related Documentation

- [SESSION_START_REMINDER.md](../../SESSION_START_REMINDER.md) - Security checklist
- [USAGE_CONTEXT.md](workflows/USAGE_CONTEXT.md) - System usage patterns
- [OPERATIONAL_PROCEDURES.md](../../operations/OPERATIONAL_PROCEDURES.md) - Operations
- [CURRENT_DEVELOPMENT_STATUS.md](../../status/CURRENT_DEVELOPMENT_STATUS.md) - System state

---

## Summary

**Key Takeaways**:

1. 📝 Four key docs are loaded at every Claude session start
2. ⏰ Docs must be updated after deployments, procedure changes, or security updates
3. 🤖 Three automated tools help maintain docs:
   - Freshness checker script
   - Git post-commit hook
   - GitHub Actions workflow
4. ✅ Install git hook and run freshness checker regularly
5. 🔄 Include doc updates in the same commit as code changes

**Install automation now**:
```bash
# Install git hook
./scripts/admin/documentation-maintenance/install-git-hook.sh

# Check freshness
./scripts/admin/documentation-maintenance/check-docs-freshness.sh 7
```

---

**Last Updated**: 2025-11-09
**Maintained By**: Development Team
**Review Frequency**: After major infrastructure changes
