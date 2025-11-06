# GitHub Issue Quick Reference

**Purpose:** Quick commands for creating well-structured issues
**Updated:** 2025-11-06

---

## ⚡ Quick Create

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

**Related:** Epic #XXX
**Priority:** Medium
**Estimate:** X hours
EOF
)" \
  --label "Enhancement,Frontend,Priority: Medium" \
  --milestone "Phase 5: Events and Elections Services"
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

| Epic # | Name | Use For |
|--------|------|---------|
| #192 | Admin Elections Dashboard | Admin UI work |
| #191 | Component Library | Reusable components |
| #186 | Member Voting Experience | Member elections UI |
| #165 | Production Infrastructure | DevOps, security |

---

## 📋 Checklist

- [ ] Title: `type(scope): description`
- [ ] Body: Problem + Solution + Criteria
- [ ] Labels: Type + Area + Priority
- [ ] Milestone: Phase 5 (or none)
- [ ] Epic: Referenced in body
- [ ] Estimate: In body

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

```bash
gh issue close [NUMBER] --comment "✅ Complete - [summary]"
```

---

## 📖 Full Guide

See [GITHUB_ISSUE_CHECKLIST.md](./GITHUB_ISSUE_CHECKLIST.md)
