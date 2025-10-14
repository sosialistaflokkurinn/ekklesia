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

Based on the project board screenshot:

| Priority | Level | Use Case |
|----------|-------|----------|
| **P0** | Critical | Blocking issues, production bugs |
| **P1** | High | Important features, security issues |
| **P2** | Medium | Standard features, improvements |
| **P3** | Low | Nice-to-haves, tech debt |
| **No Priority** | - | Not yet triaged |

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
# Replace: PROJECT_ID, ITEM_ID, FIELD_ID, OPTION_ID with actual values

gh api graphql -f query='
  mutation {
    updateProjectV2ItemFieldValue(
      input: {
        projectId: "PROJECT_ID"
        itemId: "ITEM_ID"
        fieldId: "FIELD_ID"
        value: {
          singleSelectOptionId: "OPTION_ID"
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

## 5. Quick Priority Assignment Script

### Setup Script

Create a helper script to assign priorities:

```bash
#!/bin/bash
# save as: scripts/set-project-priority.sh

PROJECT_ID="PVT_kwDOAiQNe84BC_tu"
ISSUE_NUMBER=$1
PRIORITY=$2

if [ -z "$ISSUE_NUMBER" ] || [ -z "$PRIORITY" ]; then
  echo "Usage: $0 <issue-number> <priority>"
  echo "Example: $0 29 P1"
  echo "Priorities: P0, P1, P2, P3"
  exit 1
fi

# First, get the item ID for this issue
ITEM_ID=$(gh api graphql -f query="
  query {
    repository(owner: \"sosialistaflokkurinn\", name: \"ekklesia\") {
      issue(number: $ISSUE_NUMBER) {
        projectItems(first: 10) {
          nodes {
            id
            project {
              id
            }
          }
        }
      }
    }
  }
" | jq -r ".data.repository.issue.projectItems.nodes[] | select(.project.id == \"$PROJECT_ID\") | .id")

if [ -z "$ITEM_ID" ]; then
  echo "Error: Issue #$ISSUE_NUMBER not found in project"
  exit 1
fi

echo "Found item ID: $ITEM_ID"
echo "Setting priority to: $PRIORITY"

# Get field and option IDs (you'll need to run the query in step 1 once to get these)
# Then hardcode them here or fetch dynamically

echo "Priority update would be applied here"
echo "See full documentation for complete implementation"
```

---

## 6. Status Management

### Status Values

Based on your project board:

| Status | Description |
|--------|-------------|
| **Backlog** | Not started yet |
| **Ready** | Ready to be picked up |
| **In progress** | Currently being worked on |
| **In review** | Awaiting review |
| **Done** | Completed |

### Update Status (Web Interface)

1. Go to project board
2. **Drag and drop** items between columns
3. Status updates automatically

### Update Status (CLI)

Similar to priority, requires GraphQL API:

```bash
# Update status field
gh api graphql -f query='
  mutation {
    updateProjectV2ItemFieldValue(
      input: {
        projectId: "PROJECT_ID"
        itemId: "ITEM_ID"
        fieldId: "STATUS_FIELD_ID"
        value: {
          singleSelectOptionId: "STATUS_OPTION_ID"
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

## 8. Current Ekklesia Project Priorities (Oct 14, 2025)

### Suggested Priority Assignments

#### P0 - Critical
- None currently (good sign!)

#### P1 - High Priority
- **PR #29**: Events & Elections implementation (In review)
- **PR #34**: Security Hardening (In review)
- **Issue #30-33**: Security issues (already resolved, can mark done)

#### P2 - Medium Priority
- **Issue #1**: Epic 1 - Platform Bootstrap (foundational)
- **Issue #5**: Provision GCP project (foundational)
- **Issue #6**: Set up Cloud SQL (foundational)
- **Issue #8**: Configure Secret Manager (foundational)

#### P3 - Low Priority
- Future enhancements
- Documentation improvements (unless blocking)

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

### List All Items Without Priority
```bash
# Get all items without priority set
gh api graphql -f query='
  query {
    node(id: "PVT_kwDOAiQNe84BC_tu") {
      ... on ProjectV2 {
        items(first: 50) {
          nodes {
            id
            fieldValues(first: 10) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field {
                    ... on ProjectV2FieldCommon {
                      name
                    }
                  }
                }
              }
            }
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
' | jq '.data.node.items.nodes[] | select(.fieldValues.nodes[] | select(.field.name == "Priority") | .name == null) | {number: .content.number, title: .content.title}'
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

### Recommendation for Ekklesia

**For Priority Assignment:**
- ✅ **Use Web Interface** - Fastest and easiest
- ✅ **Set priorities during weekly planning**
- ✅ **Focus on P1 (High) for current work**

**For Status Updates:**
- ✅ **Drag and drop on board** - Visual and intuitive
- ✅ **Let automation work** - PRs auto-move to "In review"
- ✅ **Use CLI for bulk operations only**

**Current Actions Needed:**
1. Open project: https://github.com/orgs/sosialistaflokkurinn/projects/1
2. Assign priorities to items in "No Priority" column
3. Review "In review" items (PR #29, PR #34)
4. Move completed items to "Done"

---

**Last Updated**: 2025-10-14
**Related Guides**:
- [GITHUB_PR_MANAGEMENT.md](GITHUB_PR_MANAGEMENT.md)
- [BRANCH_STRATEGY.md](../../archive/docs/docs-2025-10-13/docs/guides/BRANCH_STRATEGY.md)
