# GitHub Issue Quick Reference

**Purpose:** Quick commands for creating well-structured issues
**Updated:** 2025-11-06

---

## ⚡ Quick Create

### Standard Issue

```bash
gh issue create --repo sosialistaflokkurinn/ekklesia \
  --title "type(scope): description" \
  --body "$(cat <<'EOF'
## Problem
[What's wrong/missing]

## Solution
[What to do]

## Acceptance Criteria
- [ ] Item 1
- [ ] Item 2

**Related:** Epic #192
**Priority:** Medium
**Estimate:** X hours
EOF
)" \
  --label "Enhancement,Frontend,Priority: Medium" \
  --milestone "Phase 5: Events and Elections Services"
```

### Sub-Issue (linked to Epic)

```bash
# 1. Create issue first
gh issue create --repo sosialistaflokkurinn/ekklesia \
  --title "feat(admin): Elections list dashboard with filters" \
  --body "$(cat <<'EOF'
## Problem
Epic #192 needs a dashboard to view all elections.

## Solution
Build elections list table with status filters and search.

## Acceptance Criteria
- [ ] Table showing all elections
- [ ] Filter by status (draft/active/closed/hidden)
- [ ] Search by title
- [ ] Action buttons (Edit, Hide, Delete)

**Parent:** Epic #192 - Admin Elections Dashboard
**Estimate:** 8-10 hours
EOF
)" \
  --label "Enhancement,Frontend,Priority: High" \
  --milestone 2

# 2. Note the issue number from output (e.g., #201)

# 3. Link to parent epic using MCP GitHub or web UI
# Via GitHub web: Go to Epic #192 → Add sub-issue → Enter #201
```

---

## 🏷️ Labels Cheat Sheet

**Type (choose ONE):**
```bash
--add-label "Bug"           # Something broken
--add-label "Enhancement"   # New feature
--add-label "Task"          # Work item
--add-label "Epic"          # Multiple issues
```

**Area (choose ONE+):**
```bash
--add-label "Frontend"      # HTML/CSS/JS
--add-label "Backend"       # API/Server
--add-label "UI"            # Design
--add-label "Security"      # Auth/hardening
```

**Priority (choose ONE):**
```bash
--add-label "Priority: Critical"  # P0
--add-label "Priority: High"      # P1
--add-label "Priority: Medium"    # P2
--add-label "Priority: Low"       # P3
```

---

## 🎯 Epic Mapping

| Epic # | Name | Milestone | Use For |
|--------|------|-----------|---------|
| #192 | Admin Elections Dashboard | Phase 5 | Admin UI work, CRUD interface |
| #191 | Component Library | Phase 5 | Reusable components |
| #186 | Member Voting Experience | Phase 5 | Member elections UI |
| #165 | Production Infrastructure | Phase 5 | DevOps, security |

**Current Milestone:** Phase 5: Events and Elections Services (Due: Nov 14, 2025)

---

## 📝 Sub-Issue Management

### Create Sub-Issue

```bash
# Step 1: Create the issue
gh issue create --repo sosialistaflokkurinn/ekklesia \
  --title "feat(scope): description" \
  --body "$(cat <<'EOF'
## Problem
[What's wrong/missing]

## Solution
[What to do]

## Acceptance Criteria
- [ ] Item 1
- [ ] Item 2

**Related:** Epic #192
**Estimate:** X hours
EOF
)" \
  --label "Enhancement,Backend,Priority: High" \
  --milestone "Phase 5: Events and Elections Services"

# Step 2: Get the issue number from output (e.g., #200)

# Step 3: Link as sub-issue to epic
gh api repos/sosialistaflokkurinn/ekklesia/issues/192/sub_issues \
  -X POST \
  -f sub_issue_number=200
```

### Example: Backend API Sub-Issue

```bash
# Issue #200 - Admin Elections API (COMPLETED)
gh issue create --repo sosialistaflokkurinn/ekklesia \
  --title "feat(backend): Admin Elections API - 10 CRUD endpoints with RBAC" \
  --label "Enhancement,Backend,Priority: High" \
  --milestone 2

# Then link to Epic #192
# Sub-issue ID obtained from GitHub API response
```

---

## 📋 Checklist

### Standard Issue
- [ ] Title: `type(scope): description`
- [ ] Body: Problem + Solution + Criteria
- [ ] Labels: Type + Area + Priority
- [ ] Milestone: Phase 5 (or current phase)
- [ ] Epic: Referenced in body
- [ ] Estimate: In body

### Sub-Issue (Epic Child)
- [ ] Title: `type(scope): specific feature`
- [ ] Body: Reference parent epic (`**Parent:** Epic #XXX`)
- [ ] Labels: Same as parent + specific area
- [ ] Milestone: Same as parent epic
- [ ] Link to parent: After creation (GitHub UI or API)
- [ ] Estimate: Specific hours for this sub-task

---

## 🔗 Link Epic

**Option 1: In body**
```markdown
**Related:** Epic #191 (Component Library)
```

**Option 2: As comment**
```bash
gh issue comment [NUMBER] --body "**Related:** Epic #191"
```

---

## ✅ Close Issue

### Simple Close

```bash
gh issue close [NUMBER] --comment "✅ Complete - [summary]"
```

### Close Sub-Issue with Context

```bash
# Example: Closing #200 (Admin Backend API)
gh issue close 200 --comment "✅ **COMPLETE** 

**Delivered:**
- 10 admin CRUD endpoints with RBAC
- Database migration 003 (hidden, voting_type, max_selections)
- Firebase authentication middleware
- Deployed to Cloud Run

**Files:**
- services/elections/src/routes/admin.js (991 lines)
- services/elections/migrations/003_admin_features.sql

**Next:** Frontend integration (Epic #192)
**Docs:** docs/development/guides/ADMIN_ELECTION_BACKEND_IMPLEMENTATION_CHECKLIST.md"
```

---

## 📊 Real Examples

### Example 1: Backend Sub-Issue (COMPLETED)

**Issue #200** - Admin Elections API
- **Parent:** Epic #192
- **Type:** Enhancement, Backend
- **Priority:** High
- **Milestone:** Phase 5
- **Status:** ✅ CLOSED
- **Time:** 24 hours
- **Branch:** feature/epic-186-member-voting-experience
- **Commits:** c4ede05, 0e9ab11, db1e8c9

**Created with:**
```bash
gh issue create \
  --title "feat(backend): Admin Elections API - 10 CRUD endpoints with RBAC" \
  --label "Enhancement,Backend,Priority: High" \
  --milestone 2
```

---

## 🔗 Milestones

### Active Milestone

**Phase 5: Events and Elections Services**
- **Number:** 2
- **Due:** November 14, 2025
- **Use for:** Elections service, Events service, Admin dashboards

### Set Milestone

```bash
# By name
--milestone "Phase 5: Events and Elections Services"

# By number (faster)
--milestone 2
```

---

## 📖 Full Guide

See [GITHUB_ISSUE_CHECKLIST.md](./GITHUB_ISSUE_CHECKLIST.md)
