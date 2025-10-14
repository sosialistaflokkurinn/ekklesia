# GitHub Project Management with CLI

**Created**: 2025-10-14
**Purpose**: Guide for managing GitHub Projects (Project V2) using CLI and API
**Project**: Kosningakerfi Sósíalistaflokksins

---

## Overview

GitHub Projects V2 uses a different API than issues/PRs. Priority assignment and status updates require using the GraphQL API.

**Project Details:**
- Name: Kosningakerfi Sósíalistaflokksins
- URL: https://github.com/orgs/sosialistaflokkurinn/projects/1
- ID: `PVT_kwDOAiQNe84BC_tu`

---

## 1. Viewing Project Information

### List Projects
```bash
# List organization projects
gh project list --owner sosialistaflokkurinn

# View project in browser
gh project view 1 --owner sosialistaflokkurinn --web
```

### View Project Items
```bash
# View all items in project
gh project item-list 1 --owner sosialistaflokkurinn

# View with specific fields
gh project item-list 1 --owner sosialistaflokkurinn --format json
```

---

## 2. Priority Levels

**Priority Field ID**: `PVTSSF_lADOAiQNe84BC_tuzg1C1F8`

| Priority | Level | Use Case | Option ID |
|----------|-------|----------|-----------|
| **P0** | Critical | Blocking issues, production bugs, security vulnerabilities | `79628723` |
| **P1** | High | Important features, foundational work, security hardening | `0a877460` |
| **P2** | Medium | Standard features, improvements, future work | `da944a9c` |
| **No Priority** | - | Not yet triaged | - |

**Note**: This project uses P0-P2 (no P3 currently configured).

---

## 3. Assigning Priorities (Web Interface - Recommended)

**Easiest method**: Use the GitHub web interface

1. Go to: https://github.com/orgs/sosialistaflokkurinn/projects/1
2. Find the item (issue/PR) in the board
3. Click on the item to open details panel
4. Find the "Priority" field dropdown
5. Select priority level (P0, P1, P2, P3)
6. Priority is saved automatically

---

## 4. Assigning Priorities (CLI Method)

### Prerequisites

You need:
1. Project ID: `PVT_kwDOAiQNe84BC_tu`
2. Item ID (from the project)
3. Field ID for Priority
4. Option ID for the priority level (P0, P1, P2, P3)

### Step 1: Get Project Field Information

```bash
# Get project fields including Priority field ID
gh api graphql -f query='
  query {
    node(id: "PVT_kwDOAiQNe84BC_tu") {
      ... on ProjectV2 {
        fields(first: 20) {
          nodes {
            ... on ProjectV2Field {
              id
              name
            }
            ... on ProjectV2SingleSelectField {
              id
              name
              options {
                id
                name
              }
            }
          }
        }
      }
    }
  }
'
```

This will show you:
- Priority field ID
- Option IDs for P0, P1, P2, P3

### Step 2: Get Item ID for Issue/PR

```bash
# Get item ID for a specific issue in the project
gh api graphql -f query='
  query {
    node(id: "PVT_kwDOAiQNe84BC_tu") {
      ... on ProjectV2 {
        items(first: 50) {
          nodes {
            id
            content {
              ... on Issue {
                number
                title
              }
              ... on PullRequest {
                number
                title
              }
            }
          }
        }
      }
    }
  }
' | jq '.data.node.items.nodes[] | {id, number: .content.number, title: .content.title}'
```

### Step 3: Update Priority

```bash
# Update priority for an item
# Example: Set issue #29 to P0 (Critical)

PROJECT_ID="PVT_kwDOAiQNe84BC_tu"
ITEM_ID="PVTI_lADOAiQNe84BC_tuzgfvXYs"  # Issue #29 item ID
PRIORITY_FIELD_ID="PVTSSF_lADOAiQNe84BC_tuzg1C1F8"
P0_OPTION_ID="79628723"

gh api graphql -f query='
  mutation {
    updateProjectV2ItemFieldValue(
      input: {
        projectId: "'"$PROJECT_ID"'"
        itemId: "'"$ITEM_ID"'"
        fieldId: "'"$PRIORITY_FIELD_ID"'"
        value: {
          singleSelectOptionId: "'"$P0_OPTION_ID"'"
        }
      }
    ) {
      projectV2Item {
        id
      }
    }
  }
'
```

**Real Example from Oct 14, 2025**:
```bash
# Assign P0 to PR #29 (Events/Elections S2S integration)
gh api graphql -f query='
  mutation {
    updateProjectV2ItemFieldValue(
      input: {
        projectId: "PVT_kwDOAiQNe84BC_tu"
        itemId: "PVTI_lADOAiQNe84BC_tuzgfvXYs"
        fieldId: "PVTSSF_lADOAiQNe84BC_tuzg1C1F8"
        value: {
          singleSelectOptionId: "79628723"
        }
      }
    ) {
      projectV2Item {
        id
      }
    }
  }
'
```

---

## 5. Complete Priority Assignment Script

### Production-Ready Script

```bash
#!/bin/bash
# save as: scripts/assign-project-priority.sh
# Usage: ./scripts/assign-project-priority.sh <item-id> <priority>
# Example: ./scripts/assign-project-priority.sh "PVTI_lADOAiQNe84BC_tuzgfvXYs" P0

PROJECT_ID="PVT_kwDOAiQNe84BC_tu"
PRIORITY_FIELD_ID="PVTSSF_lADOAiQNe84BC_tuzg1C1F8"

# Priority option IDs
declare -A PRIORITY_IDS=(
  ["P0"]="79628723"
  ["P1"]="0a877460"
  ["P2"]="da944a9c"
)

ITEM_ID=$1
PRIORITY=$2

if [ -z "$ITEM_ID" ] || [ -z "$PRIORITY" ]; then
  echo "Usage: $0 <item-id> <priority>"
  echo "Example: $0 PVTI_lADOAiQNe84BC_tuzgfvXYs P0"
  echo "Priorities: P0 (Critical), P1 (High), P2 (Medium)"
  exit 1
fi

PRIORITY_OPTION_ID="${PRIORITY_IDS[$PRIORITY]}"

if [ -z "$PRIORITY_OPTION_ID" ]; then
  echo "Error: Invalid priority '$PRIORITY'"
  echo "Valid priorities: P0, P1, P2"
  exit 1
fi

echo "Assigning priority $PRIORITY to item $ITEM_ID..."

gh api graphql -f query='
  mutation {
    updateProjectV2ItemFieldValue(
      input: {
        projectId: "'"$PROJECT_ID"'"
        itemId: "'"$ITEM_ID"'"
        fieldId: "'"$PRIORITY_FIELD_ID"'"
        value: {
          singleSelectOptionId: "'"$PRIORITY_OPTION_ID"'"
        }
      }
    ) {
      projectV2Item {
        id
      }
    }
  }
' > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "✅ Priority $PRIORITY assigned successfully"
else
  echo "❌ Failed to assign priority"
  exit 1
fi
```

### Helper: Get Item IDs

```bash
#!/bin/bash
# save as: scripts/list-project-items.sh
# Lists all items with their IDs for easy reference

gh api graphql -f query='
{
  organization(login: "sosialistaflokkurinn") {
    projectV2(number: 1) {
      items(first: 50) {
        nodes {
          id
          content {
            ... on Issue {
              number
              title
            }
            ... on PullRequest {
              number
              title
            }
          }
        }
      }
    }
  }
}' | jq -r '.data.organization.projectV2.items.nodes[] |
"#\(.content.number): \(.content.title)\nItem ID: \(.id)\n"'
```

---

## 6. Status Management

### Status Values

**Status Field ID**: `PVTSSF_lADOAiQNe84BC_tuzg1C03s`

| Status | Description | Option ID | Typical Priority |
|--------|-------------|-----------|------------------|
| **Backlog** | Not started yet | `f75ad846` | P2 (future work) |
| **Ready** | Ready to be picked up | `61e4505c` | P1 (next up) |
| **In progress** | Currently being worked on | `47fc9ee4` | P0 (active) |
| **In review** | Awaiting review | `df73e18b` | P0 (review) |
| **Done** | Completed | `98236657` | Mixed |

### Update Status (Web Interface)

1. Go to project board
2. **Drag and drop** items between columns
3. Status updates automatically

### Update Status (CLI)

```bash
# Update status field
PROJECT_ID="PVT_kwDOAiQNe84BC_tu"
STATUS_FIELD_ID="PVTSSF_lADOAiQNe84BC_tuzg1C03s"
ITEM_ID="<your-item-id>"
STATUS_OPTION_ID="47fc9ee4"  # In progress

gh api graphql -f query='
  mutation {
    updateProjectV2ItemFieldValue(
      input: {
        projectId: "'"$PROJECT_ID"'"
        itemId: "'"$ITEM_ID"'"
        fieldId: "'"$STATUS_FIELD_ID"'"
        value: {
          singleSelectOptionId: "'"$STATUS_OPTION_ID"'"
        }
      }
    ) {
      projectV2Item {
        id
      }
    }
  }
'
```

**Real Example - Move PR #34 to In Progress**:
```bash
# PR #34: Security Hardening (current work)
gh api graphql -f query='
  mutation {
    updateProjectV2ItemFieldValue(
      input: {
        projectId: "PVT_kwDOAiQNe84BC_tu"
        itemId: "PVTI_lADOAiQNe84BC_tuzgf2i4o"
        fieldId: "PVTSSF_lADOAiQNe84BC_tuzg1C03s"
        value: {
          singleSelectOptionId: "47fc9ee4"
        }
      }
    ) {
      projectV2Item {
        id
      }
    }
  }
'
```

---

## 7. Recommended Priority Guidelines

### Priority Assignment Rules

**P0 - Critical** (Red):
- Production is broken
- Security vulnerabilities
- Blocking other work
- Data loss risk

**P1 - High** (Orange):
- Important features for upcoming release
- Security hardening
- Performance issues
- User-impacting bugs

**P2 - Medium** (Yellow):
- Standard features
- Improvements
- Non-blocking bugs
- Documentation

**P3 - Low** (Blue):
- Nice-to-haves
- Tech debt
- Future enhancements
- Optimizations

---

## 8. Current Ekklesia Project Status (Oct 14, 2025)

### ✅ Board Organization Complete

**All 34 items organized** by Priority and Status using CLI methods.

#### P0 - Critical (7 items)
**Active Work:**
- **PR #34** [In progress]: Security Hardening, Secret Manager Integration & Documentation Audit
  - Item ID: `PVTI_lADOAiQNe84BC_tuzgf2i4o`
  - Status: In progress (current branch: `feature/security-hardening`)

**Under Review:**
- **PR #29** [In review]: Events and Elections services with S2S integration (#17, #18, #19)
  - Item ID: `PVTI_lADOAiQNe84BC_tuzgfvXYs`
  - Status: Waiting for Agúst's review

**Completed:**
- **PR #28** [Done]: Firebase Members authentication and Events service design
- **Issue #30** [Done]: Security - Firestore security rules
- **Issue #31** [Done]: Security - Rate limiting
- **Issue #32** [Done]: Security - Idempotency
- **Issue #33** [Done]: Security - CSRF protection

#### P1 - High Priority (5 items in Ready)
**Next Up** (all in "Ready" status):
- **Issue #1**: Epic 1: Platform Bootstrap (DevOps/Setup Only) - `PVTI_lADOAiQNe84BC_tuzgesxVY`
- **Issue #5**: Provision GCP project & enable core APIs - `PVTI_lADOAiQNe84BC_tuzges1Ac`
- **Issue #6**: Set up Cloud SQL for PostgreSQL (dev) - `PVTI_lADOAiQNe84BC_tuzges1Ew`
- **Issue #8**: Configure Secret Manager and wire env vars - `PVTI_lADOAiQNe84BC_tuzges1oI`
- **Issue #10**: Set up GitHub Actions CI/CD to Cloud Run - `PVTI_lADOAiQNe84BC_tuzges1z0`

#### P2 - Medium Priority (22 items in Backlog)
**Future Work** (DevOps, Epics, User Stories):
- Issues #9, #11, #12, #13, #15 (DevOps tasks)
- Issues #16, #17, #18, #19, #24 (Epics)
- Issues #20, #21, #22, #23, #25, #26, #27 (User Stories)
- Issues #2, #3, #4, #14 (Legacy ZITADEL - Done)

---

## 9. Adding Items to Project

### Add Issue to Project
```bash
# Add issue #5 to project
gh project item-add 1 --owner sosialistaflokkurinn --url https://github.com/sosialistaflokkurinn/ekklesia/issues/5
```

### Add PR to Project
```bash
# Add PR #29 to project
gh project item-add 1 --owner sosialistaflokkurinn --url https://github.com/sosialistaflokkurinn/ekklesia/pull/29
```

---

## 10. Bulk Operations

### Complete Board Organization Script

This script organizes all items by priority and status (used Oct 14, 2025):

```bash
#!/bin/bash
# save as: scripts/organize-project-board.sh
# Organizes project board: P0→In Progress/Review, P1→Ready, P2→Backlog

PROJECT_ID="PVT_kwDOAiQNe84BC_tu"
PRIORITY_FIELD_ID="PVTSSF_lADOAiQNe84BC_tuzg1C1F8"
STATUS_FIELD_ID="PVTSSF_lADOAiQNe84BC_tuzg1C03s"

# Priority IDs
P0_OPTION_ID="79628723"
P1_OPTION_ID="0a877460"
P2_OPTION_ID="da944a9c"

# Status IDs
BACKLOG_ID="f75ad846"
READY_ID="61e4505c"
IN_PROGRESS_ID="47fc9ee4"
IN_REVIEW_ID="df73e18b"
DONE_ID="98236657"

# Function to update status
update_status() {
  local item_id=$1
  local status_option_id=$2
  local issue_number=$3
  local status_name=$4

  echo "Setting #${issue_number} to '${status_name}'..."

  gh api graphql -f query='
    mutation {
      updateProjectV2ItemFieldValue(
        input: {
          projectId: "'"$PROJECT_ID"'"
          itemId: "'"$item_id"'"
          fieldId: "'"$STATUS_FIELD_ID"'"
          value: {
            singleSelectOptionId: "'"$status_option_id"'"
          }
        }
      ) {
        projectV2Item {
          id
        }
      }
    }' > /dev/null 2>&1

  if [ $? -eq 0 ]; then
    echo "✅ #${issue_number} → ${status_name}"
  else
    echo "❌ Failed #${issue_number}"
  fi
}

echo "=== Organizing Project Board ==="
echo ""

# Example: Move P1 items to Ready
echo "Moving P1 items to Ready..."
update_status "PVTI_lADOAiQNe84BC_tuzgesxVY" "$READY_ID" "1" "Ready"
update_status "PVTI_lADOAiQNe84BC_tuzges1Ac" "$READY_ID" "5" "Ready"
# ... add more as needed

echo ""
echo "✅ Board organization complete!"
```

### View Current Board State

```bash
#!/bin/bash
# save as: scripts/view-board-status.sh
# Shows current priority and status for all items

gh api graphql -f query='
{
  organization(login: "sosialistaflokkurinn") {
    projectV2(number: 1) {
      items(first: 50) {
        nodes {
          content {
            ... on Issue {
              number
              title
            }
            ... on PullRequest {
              number
              title
            }
          }
          fieldValues(first: 20) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                field {
                  ... on ProjectV2SingleSelectField {
                    name
                  }
                }
                name
              }
            }
          }
        }
      }
    }
  }
}' | jq -r '
[.data.organization.projectV2.items.nodes[] |
{
  num: .content.number,
  status: (.fieldValues.nodes[] | select(.field.name == "Status") | .name // "No Status"),
  priority: (.fieldValues.nodes[] | select(.field.name == "Priority") | .name // "No Priority")
}] |
group_by(.status) |
.[] |
"== \(.[0].status) (\(length) items) ==\n" +
(. | sort_by(.priority, .num) | .[] |
"  #\(.num) [\(.priority)]"
) + "\n"
'
```

### List Items by Priority

```bash
# View all P0 items
gh api graphql -f query='
{
  organization(login: "sosialistaflokkurinn") {
    projectV2(number: 1) {
      items(first: 50) {
        nodes {
          content {
            ... on Issue {
              number
              title
            }
            ... on PullRequest {
              number
              title
            }
          }
          fieldValues(first: 20) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                field {
                  ... on ProjectV2SingleSelectField {
                    name
                  }
                }
                name
              }
            }
          }
        }
      }
    }
  }
}' | jq -r '.data.organization.projectV2.items.nodes[] |
select((.fieldValues.nodes[] | select(.field.name == "Priority") | .name) == "P0") |
{num: .content.number, title: .content.title} |
"#\(.num): \(.title)"'
```

---

## 11. Practical Workflow for Ekklesia

### Daily Workflow

1. **Morning**: Check "In progress" column
   ```bash
   gh project view 1 --owner sosialistaflokkurinn --web
   ```

2. **Pick Next Task**: Move from "Ready" to "In progress"
   - Drag item on web interface
   - Or use CLI to update status

3. **Create PR**: Link to project automatically
   ```bash
   gh pr create --title "feat: new feature"
   # PR automatically appears in project
   ```

4. **Review Complete**: Move PR to "In review"
   - Happens automatically when PR is opened
   - Or move manually

5. **After Merge**: Move to "Done"
   - Usually happens automatically
   - Or move manually

### Weekly Review

1. **Triage New Items**: Assign priorities
2. **Review Backlog**: Update priorities
3. **Check Blocked Items**: Move or close
4. **Archive Done Items**: Clean up board

---

## 12. Integration with Issues and PRs

### Auto-Add to Project

You can configure repository to auto-add issues/PRs:

1. Go to: Repository Settings → Projects
2. Enable "Auto-add items"
3. Choose default status (e.g., "Backlog")

### Link Issues to PRs in Project

When creating PRs that close issues:

```bash
gh pr create --title "feat: implement feature" --body "Closes #5"
```

Both the PR and issue will appear in the project, linked.

---

## 13. Quick Reference

### Most Useful Commands

```bash
# View project
gh project view 1 --owner sosialistaflokkurinn --web

# List projects
gh project list --owner sosialistaflokkurinn

# Add item to project
gh project item-add 1 --owner sosialistaflokkurinn --url <issue-or-pr-url>

# List items
gh project item-list 1 --owner sosialistaflokkurinn
```

### Web Interface (Recommended for Priorities)

**Fastest way to assign priorities:**

1. Open: https://github.com/orgs/sosialistaflokkurinn/projects/1
2. Click item → Set priority in sidebar
3. Done!

---

## 14. Complete Example: Setting Up PR #29

```bash
# 1. Ensure PR is in project (already done ✅)
gh project item-add 1 --owner sosialistaflokkurinn --url https://github.com/sosialistaflokkurinn/ekklesia/pull/29

# 2. Set priority via web interface (recommended):
#    - Go to project board
#    - Click PR #29
#    - Set Priority: P1 (High)

# 3. Status is already "In review" ✅

# 4. Add reviewer (already done ✅)
gh pr edit 29 --add-reviewer agustka
```

---

## 15. Troubleshooting

### Item Not Showing in Project

```bash
# Check if item is in project
gh project item-list 1 --owner sosialistaflokkurinn | grep "#29"

# Add if missing
gh project item-add 1 --owner sosialistaflokkurinn --url https://github.com/sosialistaflokkurinn/ekklesia/pull/29
```

### Priority Not Updating

- **Solution**: Use web interface instead
- GraphQL API requires multiple queries to get IDs
- Web interface is much simpler and faster

### Permission Issues

```bash
# Check auth
gh auth status

# Ensure you have write access to project
# Must be org member or have project access
```

---

## 16. Best Practices

### Priority Management

1. **Review priorities weekly**
2. **Limit P0 items** - Should be rare
3. **Most work should be P1/P2**
4. **P3 for backlog items**

### Status Management

1. **Keep "In progress" small** - 3-5 items max per person
2. **Move to "Ready" when possible** - Clear what's next
3. **Archive "Done" items** - Keep board clean
4. **Use "Blocked" status** - If available

### Board Hygiene

1. **Weekly cleanup** - Archive done items
2. **Close old items** - If no longer relevant
3. **Update estimates** - Keep realistic
4. **Link related items** - Use "Relates to #X"

---

## Summary

### ✅ Board Organization Complete (Oct 14, 2025)

All 34 items now have priorities (P0/P1/P2) and proper status (Backlog/Ready/In progress/In review/Done).

**Organization Pattern:**
- **P0 items** → In progress or In review (active work)
- **P1 items** → Ready (next priority)
- **P2 items** → Backlog (future work)
- **Completed** → Done (archived)

### CLI vs Web Interface

**Use CLI for:**
- ✅ Bulk operations (assigning priorities to many items)
- ✅ Automation scripts
- ✅ Learning project structure (field IDs, option IDs)
- ✅ Complex queries (filtering, reporting)

**Use Web Interface for:**
- ✅ Quick single-item updates
- ✅ Visual board organization (drag & drop)
- ✅ Daily workflow (moving items between columns)

### Current State (Oct 14, 2025)

**Active:**
- 1 item in "In progress" (PR #34 - Security Hardening)
- 1 item in "In review" (PR #29 - Events/Elections)

**Next Up:**
- 5 items in "Ready" (P1 - foundational DevOps)

**Backlog:**
- 17 items (P2 - future features)

**Completed:**
- 10 items in "Done"

### Workflow Recommendation

1. **Complete P0 work first**:
   - Finish PR #34 and merge
   - Address PR #29 feedback

2. **Then move to P1 tasks**:
   - Move items from "Ready" to "In progress" as you work
   - Focus on Epic 1 (Platform Bootstrap)

3. **Future P2 work**:
   - Items stay in "Backlog" until prioritized
   - Move to "Ready" when needed

### Quick Access

- **Project Board**: https://github.com/orgs/sosialistaflokkurinn/projects/1
- **Project ID**: `PVT_kwDOAiQNe84BC_tu`
- **Priority Field**: `PVTSSF_lADOAiQNe84BC_tuzg1C1F8`
- **Status Field**: `PVTSSF_lADOAiQNe84BC_tuzg1C03s`

---

**Last Updated**: 2025-10-14
**Status**: ✅ Complete - All items organized
**Related Guides**:
- [GITHUB_PR_MANAGEMENT.md](GITHUB_PR_MANAGEMENT.md) - Pull request workflow
- [GITHUB_PR_QUICK_REFERENCE.md](GITHUB_PR_QUICK_REFERENCE.md) - Quick command reference
- [BRANCH_STRATEGY.md](../../archive/docs/docs-2025-10-13/docs/guides/BRANCH_STRATEGY.md) - Branching strategy
