# GitHub Pull Request Management with CLI

**Created**: 2025-10-14
**Purpose**: Complete guide for managing PRs using `gh` CLI
**Project**: Ekklesia - Kosningakerfi Sósíalistaflokksins

---

## Prerequisites

```bash
# Install GitHub CLI (if not already installed)
# Already installed: gh version 2.65.0

# Authenticate (if not already)
gh auth login

# Set default repo (optional)
gh repo set-default sosialistaflokkurinn/ekklesia
```

---

## 1. Viewing PR Information

### Basic Info
```bash
# View PR summary
gh pr view 29

# View PR in browser
gh pr view 29 --web

# View specific fields (JSON)
gh pr view 29 --json number,title,state,reviewRequests,assignees,labels,projectItems
```

### List All PRs
```bash
# List all open PRs
gh pr list

# List all PRs (including closed)
gh pr list --state all

# List PRs by author
gh pr list --author gudrodur

# List PRs assigned to you
gh pr list --assignee @me
```

---

## 2. Creating a Pull Request

### Basic PR Creation
```bash
# Create PR from current branch
gh pr create --title "feat: add new feature" --body "Description here"

# Create PR interactively
gh pr create

# Create PR with reviewer
gh pr create --title "feat: new feature" --reviewer agustka

# Create draft PR
gh pr create --draft --title "WIP: new feature"
```

### PR Creation with Full Metadata
```bash
gh pr create \
  --title "feat: implement Events and Elections services" \
  --body "Complete implementation of Events and Elections services with S2S integration" \
  --reviewer agustka \
  --assignee gudrodur \
  --label "Backend,DevOps" \
  --milestone "Phase 5: Events and Elections Services"
```

---

## 3. Managing Reviewers

### Add Reviewers
```bash
# Add single reviewer
gh pr edit 29 --add-reviewer agustka

# Add multiple reviewers
gh pr edit 29 --add-reviewer agustka,otheruser

# Add team as reviewer
gh pr edit 29 --add-reviewer sosialistaflokkurinn/core-team
```

### Remove Reviewers
```bash
# Remove reviewer
gh pr edit 29 --remove-reviewer agustka
```

### Check Review Status
```bash
# View review requests
gh pr view 29 --json reviewRequests

# View completed reviews
gh pr view 29 --json reviews
```

---

## 4. Managing Assignees

### Add Assignees
```bash
# Assign to yourself
gh pr edit 29 --add-assignee @me

# Assign to specific user
gh pr edit 29 --add-assignee gudrodur

# Assign to multiple users
gh pr edit 29 --add-assignee gudrodur,agustka
```

### Remove Assignees
```bash
# Remove assignee
gh pr edit 29 --remove-assignee gudrodur
```

---

## 5. Managing Labels

### Add Labels
```bash
# Add single label
gh pr edit 29 --add-label "Backend"

# Add multiple labels
gh pr edit 29 --add-label "Backend,DevOps"

# List available labels
gh label list
```

### Remove Labels
```bash
# Remove label
gh pr edit 29 --remove-label "Backend"
```

### Create New Labels
```bash
# Create label
gh label create "Security" --color "ff0000" --description "Security-related changes"

# List all labels
gh label list
```

---

## 6. Managing Projects

### View Project Items
```bash
# View PR's project status
gh pr view 29 --json projectItems

# Example output:
# "projectItems": [{
#   "status": {"name": "In review"},
#   "title": "Kosningakerfi Sósíalistaflokksins"
# }]
```

### Update Project Status
```bash
# Move to "In review" status
# Note: This requires project item ID, which is complex via CLI
# Recommendation: Use GitHub web interface for project status changes

# Alternative: Use GitHub API directly
gh api graphql -f query='
  mutation {
    updateProjectV2ItemFieldValue(
      input: {
        projectId: "PROJECT_ID"
        itemId: "ITEM_ID"
        fieldId: "FIELD_ID"
        value: { singleSelectOptionId: "OPTION_ID" }
      }
    ) {
      projectV2Item { id }
    }
  }
'
```

**Recommendation**: For project status changes, use the **GitHub web interface** as it's simpler.

---

## 7. Managing Milestones

### Add Milestone
```bash
# Add milestone to PR
gh pr edit 29 --milestone "Phase 5: Events and Elections Services"

# Remove milestone
gh pr edit 29 --milestone ""
```

### List Milestones
```bash
# List all milestones
gh api repos/:owner/:repo/milestones

# Or more readable:
gh api repos/sosialistaflokkurinn/ekklesia/milestones --jq '.[] | {title, number}'
```

### Create Milestone
```bash
# Create new milestone
gh api repos/:owner/:repo/milestones -f title="Phase 6" -f description="Phase 6 implementation"
```

---

## 8. Draft PR Management

### Convert to Draft
```bash
# Mark PR as draft
gh pr ready 29 --undo

# Or using API
gh pr edit 29 --draft
```

### Mark as Ready for Review
```bash
# Mark PR as ready
gh pr ready 29
```

---

## 9. Merging Pull Requests

### Merge with Squash (Recommended for main branch)
```bash
# Squash and merge (combines all commits into one)
gh pr merge 29 --squash --delete-branch

# With custom commit message
gh pr merge 29 --squash --delete-branch --subject "feat: add Events and Elections services"

# Auto-merge when checks pass
gh pr merge 29 --squash --auto --delete-branch
```

### Other Merge Methods
```bash
# Regular merge (creates merge commit)
gh pr merge 29 --merge --delete-branch

# Rebase and merge
gh pr merge 29 --rebase --delete-branch
```

---

## 10. PR Comments and Reviews

### Add Comment
```bash
# Add comment to PR
gh pr comment 29 --body "This looks good to me!"

# Add comment to specific file/line
gh pr comment 29 --body "Fix this typo" --file src/index.js --line 42
```

### Review PR
```bash
# Approve PR
gh pr review 29 --approve --body "LGTM! Great work!"

# Request changes
gh pr review 29 --request-changes --body "Please fix the tests"

# Comment without approval
gh pr review 29 --comment --body "Some thoughts on this approach..."
```

### View Comments
```bash
# View all comments
gh pr view 29 --comments

# View reviews
gh pr view 29 --json reviews
```

---

## 11. Checking PR Status

### Check CI/CD Status
```bash
# View PR checks status
gh pr checks 29

# Watch checks in real-time
gh pr checks 29 --watch

# View detailed checks
gh pr view 29 --json statusCheckRollup
```

### View PR Diff
```bash
# View files changed
gh pr diff 29

# View files changed with stats
gh pr view 29 --json files

# View specific file diff
gh pr diff 29 -- path/to/file.js
```

---

## 12. Closing and Reopening PRs

### Close PR
```bash
# Close PR without merging
gh pr close 29

# Close with comment
gh pr close 29 --comment "Closing due to duplicate work"

# Delete branch after closing
gh pr close 29 --delete-branch
```

### Reopen PR
```bash
# Reopen closed PR
gh pr reopen 29
```

---

## 13. Complete PR Update Example

Here's how to update PR #29 with all metadata:

```bash
# Update PR #29 with complete metadata
gh pr edit 29 \
  --add-reviewer agustka \
  --add-assignee gudrodur \
  --add-label "Backend" \
  --add-label "DevOps" \
  --milestone "Phase 5: Events and Elections Services" \
  --title "feat: implement Events and Elections services with S2S integration (#17, #18, #19)" \
  --body "$(cat <<'EOF'
# Events and Elections Services Implementation

## Overview
Complete implementation of Events and Elections services with server-to-server (S2S) integration.

## Changes
- Events Service: Token issuance and member eligibility
- Elections Service: Anonymous voting and ballot recording
- S2S API: Secure communication between services
- Complete documentation and operational guides

## Closes Issues
- Closes #17 (Epic 3a: Events - Member Experience)
- Closes #18 (Epic 4: Voting Service Core)
- Closes #19 (Epic 5: Voting Writer & Queue)

## Testing
- ✅ Local testing complete
- ✅ Production deployment successful
- ✅ Health checks verified

## Next Steps
- Await review from @agustka
- Merge using "Squash and merge"
- Deploy to production
EOF
)"
```

---

## 14. Quick Reference Cheat Sheet

### Common Commands
```bash
# View PR
gh pr view <number>
gh pr view <number> --web

# Create PR
gh pr create --title "title" --body "description"

# Edit PR
gh pr edit <number> --add-reviewer <user>
gh pr edit <number> --add-assignee <user>
gh pr edit <number> --add-label <label>
gh pr edit <number> --milestone <milestone>

# Review PR
gh pr review <number> --approve
gh pr review <number> --request-changes
gh pr review <number> --comment

# Merge PR
gh pr merge <number> --squash --delete-branch

# Check status
gh pr checks <number>
gh pr diff <number>
gh pr status
```

### Flags Reference
| Flag | Purpose | Example |
|------|---------|---------|
| `--add-reviewer` | Add reviewer | `--add-reviewer agustka` |
| `--add-assignee` | Add assignee | `--add-assignee @me` |
| `--add-label` | Add label | `--add-label "Backend"` |
| `--milestone` | Set milestone | `--milestone "Phase 5"` |
| `--draft` | Mark as draft | `--draft` |
| `--web` | Open in browser | `--web` |
| `--json` | JSON output | `--json title,state` |
| `--squash` | Squash merge | `--squash` |
| `--delete-branch` | Delete after merge | `--delete-branch` |

---

## 15. Automation Examples

### Update All Open PRs with Label
```bash
# Add label to all open PRs
for pr in $(gh pr list --json number --jq '.[].number'); do
  gh pr edit $pr --add-label "needs-review"
done
```

### List PRs Waiting for Review
```bash
# List PRs with review requests
gh pr list --json number,title,reviewRequests \
  --jq '.[] | select(.reviewRequests | length > 0) | {number, title}'
```

### Check All PRs Status
```bash
# Check CI status for all open PRs
gh pr list --json number,title,statusCheckRollup \
  --jq '.[] | {number, title, status: .statusCheckRollup[0].state}'
```

---

## 16. Troubleshooting

### Permission Issues
```bash
# Check authentication
gh auth status

# Re-authenticate
gh auth login

# Check repository access
gh repo view
```

### Common Errors
| Error | Solution |
|-------|----------|
| "Not found" | Check repo name and PR number |
| "Permission denied" | Need write access to repo |
| "Resource not accessible" | May need admin rights |

---

## Example: PR #29 Update Commands

Based on your screenshot, here are the commands to update PR #29:

```bash
# 1. Request review from agustka (already done ✅)
gh pr edit 29 --add-reviewer agustka

# 2. Assign to yourself (if needed)
gh pr edit 29 --add-assignee gudrodur

# 3. Verify labels (already has Backend, DevOps ✅)
gh pr view 29 --json labels

# 4. Set milestone (if not already set)
gh pr edit 29 --milestone "Phase 5: Events and Elections Services"

# 5. Check project status (already "In review" ✅)
gh pr view 29 --json projectItems

# 6. View complete PR status
gh pr view 29
```

### PR #34 Update Commands

```bash
# Update PR #34 with same metadata
gh pr edit 34 \
  --add-reviewer agustka \
  --add-assignee gudrodur \
  --add-label "Backend" \
  --add-label "DevOps" \
  --add-label "Security"
```

---

## Best Practices

1. **Always use `--squash` for merging to main branch**
   - Keeps git history clean
   - One commit per PR

2. **Request reviews early**
   - Use `--draft` if work is still in progress
   - Mark ready when complete

3. **Use descriptive labels**
   - Makes filtering and searching easier
   - Helps categorize work

4. **Set milestones**
   - Tracks progress toward goals
   - Groups related work

5. **Delete branches after merge**
   - Keeps repository clean
   - Use `--delete-branch` flag

---

**Last Updated**: 2025-10-14
**Author**: Ekklesia Development Team
**Related**: BRANCH_STRATEGY.md (archived)
