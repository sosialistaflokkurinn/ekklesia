# GitHub Issue & Label Management Guide

## Overview

This guide documents best practices for managing GitHub issues and labels in the Ekklesia project, covering three approaches:
1. **GitHub CLI** (`gh issue`, `gh api`) - Command-line tools
2. **GitHub MCP Tools** - AI assistant integration (when available)
3. **Direct API** - REST/GraphQL for custom automation

---

## Tools Comparison: `gh issue` vs `gh api` vs **MCP Tools**

### 🤖 When to Use GitHub MCP Tools (Preferred)

**Best for: AI-assisted operations with built-in error handling**

GitHub MCP (Model Context Protocol) tools provide AI-integrated GitHub operations through your development environment.

**Check if available:**
- VSCode: Look for `chat.mcp.discovery.enabled` in settings
- Claude Desktop: Check MCP server configuration
- Cursor/Windsurf: Check MCP integrations

**Common MCP tools:**
- `mcp__github_create_issue` - Create issues with templates
- `mcp__github_update_issue` - Update issue fields (title, body, labels, assignees)
- `mcp__github_search_issues` - Advanced issue queries
- `mcp__github_list_issues` - List issues with filters
- `mcp__github_create_comment` - Add comments to issues/PRs
- `mcp__github_get_issue` - Fetch issue details

**Pros:**
- ✅ **Best error handling** - Retry logic, validation built-in
- ✅ **Structured data** - JSON input/output, no shell escaping
- ✅ **Context-aware** - AI can validate before executing
- ✅ **Transactional** - Can rollback on errors
- ✅ **Rate limit aware** - Automatic throttling
- ✅ **Logging** - Built-in audit trail

**Cons:**
- ❌ Requires MCP server configuration
- ❌ May not be available in all environments
- ❌ Tool availability depends on MCP server version

**Example usage (when working with AI assistant):**
```markdown
User: "Update issues #35, #38, #40 to add 'Priority: High' label"

Assistant uses MCP tools internally:
- mcp__github_update_issue(35, {add_labels: ["Priority: High"]})
- mcp__github_update_issue(38, {add_labels: ["Priority: High"]})
- mcp__github_update_issue(40, {add_labels: ["Priority: High"]})

Benefits:
✅ Atomic operations (each succeeds or fails independently)
✅ Detailed error messages if issue doesn't exist
✅ Automatic retry on network errors
✅ Can verify labels exist before applying
```

**When to fallback to `gh` CLI:**
- MCP tools not available in environment
- Need shell script integration
- Interactive terminal operations
- Git + GitHub combined workflows

---

## Tools Comparison: `gh issue` vs `gh api`

### When to Use `gh issue edit`

**Best for: Single issue operations**

```bash
# Update single issue
gh issue edit 35 --add-label "Priority: High"

# Update single issue with multiple changes
gh issue edit 35 \
  --add-label "Priority: High" \
  --add-label "Security" \
  --remove-label "Priority: Medium"
```

**Pros:**
- ✅ Simple, readable syntax
- ✅ Built-in validation
- ✅ Good for interactive use

**Cons:**
- ❌ Slow for bulk operations (1 API call per issue)
- ❌ No custom fields support
- ❌ Limited to basic CRUD operations

---

### When to Use `gh api`

**Best for: Bulk operations, custom fields, automation**

```bash
# Update multiple issues in parallel
gh api graphql -f query='
mutation {
  issue1: updateIssue(input: {id: "I_kwDO...", labelIds: ["LA_kwDO..."]}) {
    issue { number }
  }
  issue2: updateIssue(input: {id: "I_kwDO...", labelIds: ["LA_kwDO..."]}) {
    issue { number }
  }
}
'
```

**Pros:**
- ✅ Single API call for multiple operations (rate limit friendly)
- ✅ Access to GraphQL (custom fields, projects, advanced queries)
- ✅ Atomic operations (all succeed or all fail)
- ✅ Can update labels without fetching current state

**Cons:**
- ❌ More complex syntax
- ❌ Requires node IDs (not issue numbers)
- ❌ Steeper learning curve

---

## Common Operations

### 1. Bulk Label Changes

#### Problem: Update priority labels for 10+ issues

**❌ Bad (Slow):**
```bash
# 10 API calls, slow, not atomic
for i in 35 36 37 38 39 40; do
  gh issue edit $i --add-label "Priority: High"
done
```

**✅ Good (Fast):**
```bash
# Step 1: Get node IDs
gh api graphql -f query='
{
  repository(owner: "sosialistaflokkurinn", name: "ekklesia") {
    issue35: issue(number: 35) { id }
    issue36: issue(number: 36) { id }
    issue37: issue(number: 37) { id }
  }
}
' > /tmp/issue-ids.json

# Step 2: Get label ID
gh api graphql -f query='
{
  repository(owner: "sosialistaflokkurinn", name: "ekklesia") {
    label(name: "Priority: High") { id }
  }
}
' > /tmp/label-id.json

# Step 3: Bulk update (single API call)
gh api graphql -f query='
mutation {
  issue35: updateIssue(input: {
    id: "I_kwDOPqze0M6RrXYZ",
    labelIds: ["LA_kwDOPqze0M8AAAACNKAhuQ"]
  }) { issue { number } }

  issue36: updateIssue(input: {
    id: "I_kwDOPqze0M6RrXab",
    labelIds: ["LA_kwDOPqze0M8AAAACNKAhuQ"]
  }) { issue { number } }
}
'
```

---

### 2. Add Label Without Removing Existing

#### Problem: Add "Security" label but keep existing labels

**❌ Bad (REST API - replaces all labels):**
```bash
# This REPLACES all labels (dangerous!)
gh api repos/sosialistaflokkurinn/ekklesia/issues/35 \
  -X PATCH \
  -f labels='["Security","Priority: High"]'
```

**✅ Good (GraphQL - additive):**
```bash
# Step 1: Get current label IDs + new label ID
ISSUE_ID=$(gh api graphql -f query='{
  repository(owner: "sosialistaflokkurinn", name: "ekklesia") {
    issue(number: 35) {
      id
      labels(first: 100) {
        nodes { id }
      }
    }
  }
}' --jq '.data.repository.issue')

CURRENT_LABELS=$(echo "$ISSUE_ID" | jq -r '.labels.nodes[].id')
ISSUE_NODE_ID=$(echo "$ISSUE_ID" | jq -r '.id')

SECURITY_LABEL_ID=$(gh api graphql -f query='{
  repository(owner: "sosialistaflokkurinn", name: "ekklesia") {
    label(name: "Security") { id }
  }
}' --jq '.data.repository.label.id')

# Step 2: Merge label IDs
ALL_LABELS=$(echo "$CURRENT_LABELS" "$SECURITY_LABEL_ID" | jq -Rs 'split("\n") | map(select(length > 0))')

# Step 3: Update with merged list
gh api graphql -f query="
mutation {
  updateIssue(input: {
    id: \"$ISSUE_NODE_ID\",
    labelIds: $ALL_LABELS
  }) {
    issue { number }
  }
}
"
```

**✅ Better (Use `gh issue edit` for single additions):**
```bash
# For single label addition, gh issue edit is simpler
gh issue edit 35 --add-label "Security"
```

---

### 3. Create Label with Specific Color

#### Creating consistent label families

```bash
# Create Priority labels with color gradient
gh label create "Priority: Critical" \
  --color "b60205" \
  --description "Critical security or blocking issue"

gh label create "Priority: High" \
  --color "d93f0b" \
  --description "Should fix soon"

gh label create "Priority: Medium" \
  --color "ffc107" \
  --description "Normal priority"

gh label create "Priority: Low" \
  --color "bfd4f2" \
  --description "Nice to have / backlog"
```

**Color Scheme:**
- Critical: `b60205` (dark red)
- High: `d93f0b` (orange-red)
- Medium: `ffc107` (amber)
- Low: `bfd4f2` (light blue)

---

### 4. Bulk Query: Find Issues Missing Priority Labels

```bash
# Find all open issues without Priority label
gh api graphql -f query='
{
  repository(owner: "sosialistaflokkurinn", name: "ekklesia") {
    issues(first: 100, states: OPEN) {
      nodes {
        number
        title
        labels(first: 10) {
          nodes { name }
        }
      }
    }
  }
}
' | jq -r '
  .data.repository.issues.nodes[] |
  select(
    [.labels.nodes[].name | select(startswith("Priority:"))] | length == 0
  ) |
  "\(.number): \(.title)"
'
```

---

### 5. Batch Comment on Multiple Issues

#### Problem: Add status update to all issues in Epic #24

```bash
# Get all issues with specific label
ISSUES=$(gh api graphql -f query='
{
  repository(owner: "sosialistaflokkurinn", name: "ekklesia") {
    label(name: "Epic #24") {
      issues(first: 50) {
        nodes {
          id
          number
        }
      }
    }
  }
}
' --jq '.data.repository.label.issues.nodes')

# Add comment to each (GraphQL mutation)
echo "$ISSUES" | jq -r '.[] | .id' | while read issue_id; do
  gh api graphql -f query="
    mutation {
      addComment(input: {
        subjectId: \"$issue_id\",
        body: \"Status update: RBAC finalization (#83) is now complete. This issue is unblocked.\"
      }) {
        commentEdge { node { id } }
      }
    }
  "
done
```

---

### 6. Custom Fields (Projects v2)

#### Set custom field value for issues

```bash
# Step 1: Get project ID and field ID
PROJECT_ID=$(gh api graphql -f query='
{
  repository(owner: "sosialistaflokkurinn", name: "ekklesia") {
    projectsV2(first: 1) {
      nodes { id }
    }
  }
}
' --jq '.data.repository.projectsV2.nodes[0].id')

# Step 2: Get custom field ID (e.g., "Effort" field)
FIELD_ID=$(gh api graphql -f query="
{
  node(id: \"$PROJECT_ID\") {
    ... on ProjectV2 {
      fields(first: 20) {
        nodes {
          ... on ProjectV2FieldCommon {
            id
            name
          }
        }
      }
    }
  }
}
" --jq '.data.node.fields.nodes[] | select(.name == "Effort") | .id')

# Step 3: Update field value
gh api graphql -f query="
mutation {
  updateProjectV2ItemFieldValue(input: {
    projectId: \"$PROJECT_ID\",
    itemId: \"PVTI_...\",
    fieldId: \"$FIELD_ID\",
    value: {number: 2.5}
  }) {
    projectV2Item { id }
  }
}
"
```

---

## Best Practices

### 1. Use `gh api` for:
- ✅ Updating 5+ issues at once
- ✅ Complex queries (filter by multiple criteria)
- ✅ Custom fields and Projects v2
- ✅ Atomic operations (all-or-nothing)
- ✅ Automation scripts

### 2. Use `gh issue edit` for:
- ✅ Single issue updates
- ✅ Interactive terminal work
- ✅ Simple label additions/removals
- ✅ Quick fixes

### 3. Label Naming Conventions

**Family-based prefixes:**
```
Priority: Critical
Priority: High
Priority: Medium
Priority: Low

Type: Bug
Type: Feature
Type: Task
Type: Epic

Status: Blocked
Status: In Progress
Status: Review
```

**Benefits:**
- Easy to query: `startswith("Priority:")`
- Visual grouping in UI
- Clear hierarchy

### 4. Avoid REST API for Labels

**❌ Don't use:**
```bash
# REST replaces ALL labels
gh api repos/OWNER/REPO/issues/123 \
  -X PATCH \
  -f labels='["new-label"]'
```

**✅ Use instead:**
```bash
# GraphQL is additive
gh issue edit 123 --add-label "new-label"
```

---

## Automation Examples

### Daily Label Hygiene Script

```bash
#!/bin/bash
# Check for issues missing priority labels

MISSING=$(gh api graphql -f query='
{
  repository(owner: "sosialistaflokkurinn", name: "ekklesia") {
    issues(first: 100, states: OPEN) {
      nodes {
        number
        title
        labels(first: 10) { nodes { name } }
      }
    }
  }
}
' | jq -r '
  .data.repository.issues.nodes[] |
  select(
    [.labels.nodes[].name | select(startswith("Priority:"))] | length == 0
  ) |
  "#\(.number): \(.title)"
')

if [ -n "$MISSING" ]; then
  echo "⚠️ Issues missing Priority labels:"
  echo "$MISSING"
  exit 1
else
  echo "✅ All issues have Priority labels"
fi
```

**Add to GitHub Actions:**
```yaml
name: Label Hygiene Check
on:
  schedule:
    - cron: '0 9 * * *'  # Daily at 9 AM UTC
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: bash scripts/check-labels.sh
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Common Gotchas

### 1. Node IDs vs Issue Numbers

```bash
# ❌ Wrong: Using issue number in GraphQL
gh api graphql -f query='
mutation {
  updateIssue(input: {id: "35", labelIds: ["..."]}) { ... }
}
'

# ✅ Correct: Using node ID
gh api graphql -f query='
mutation {
  updateIssue(input: {id: "I_kwDOPqze0M6RrXYZ", labelIds: ["..."]}) { ... }
}
'
```

**How to get node ID:**
```bash
gh api graphql -f query='
{
  repository(owner: "OWNER", name: "REPO") {
    issue(number: 35) { id }
  }
}
' --jq '.data.repository.issue.id'
```

### 2. GraphQL Pagination

```bash
# ❌ Only gets first 100 issues
gh api graphql -f query='{
  repository(owner: "OWNER", name: "REPO") {
    issues(first: 100) { nodes { number } }
  }
}'

# ✅ Paginated query
gh api graphql --paginate -f query='{
  repository(owner: "OWNER", name: "REPO") {
    issues(first: 100, after: $endCursor) {
      pageInfo { hasNextPage endCursor }
      nodes { number }
    }
  }
}'
```

### 3. Rate Limiting

**REST API:**
- 5,000 requests/hour (authenticated)
- Each `gh issue edit` = 1 request

**GraphQL API:**
- 5,000 points/hour (authenticated)
- Complex queries cost more points
- Check cost: Add `rateLimit { cost remaining }` to query

```bash
# Check remaining rate limit
gh api graphql -f query='
{
  rateLimit {
    limit
    remaining
    resetAt
  }
}
'
```

---

## Quick Reference

### Get Node IDs
```bash
# Issue node ID
gh api repos/OWNER/REPO/issues/35 --jq '.node_id'

# Label node ID
gh api repos/OWNER/REPO/labels/Security --jq '.node_id'

# Repository node ID
gh api repos/OWNER/REPO --jq '.node_id'
```

### Bulk Operations Template
```bash
# 1. Query: Get data
gh api graphql -f query='{ ... }' > data.json

# 2. Transform: Process with jq
cat data.json | jq -r '...' > ids.txt

# 3. Mutate: Batch update
cat ids.txt | while read id; do
  gh api graphql -f query="mutation { ... }"
done
```

### Useful Filters
```bash
# Issues with label X but not label Y
gh api graphql -f query='
{
  repository(owner: "OWNER", name: "REPO") {
    issues(first: 100, labels: ["Security"]) {
      nodes {
        number
        labels(first: 10) { nodes { name } }
      }
    }
  }
}
' | jq '.data.repository.issues.nodes[] |
  select([.labels.nodes[].name] | index("Blocked") | not)'
```

---

## Resources

- [GitHub GraphQL API Explorer](https://docs.github.com/en/graphql/overview/explorer)
- [GitHub CLI Manual](https://cli.github.com/manual/)
- [GraphQL Schema Reference](https://docs.github.com/en/graphql/reference)
- [Rate Limiting](https://docs.github.com/en/rest/overview/resources-in-the-rest-api#rate-limiting)

---

## Examples from Ekklesia

### Ekklesia-Specific Operations

```bash
# Get all issues in Epic #24 (issues #71-#85)
gh api graphql -f query='
{
  repository(owner: "sosialistaflokkurinn", name: "ekklesia") {
    issues(first: 15, filterBy: {labels: ["Epic #24"]}) {
      nodes {
        number
        title
        labels(first: 10) { nodes { name } }
      }
    }
  }
}
'

# Find security issues missing Priority: High
gh api graphql -f query='
{
  repository(owner: "sosialistaflokkurinn", name: "ekklesia") {
    issues(first: 100, labels: ["Security"], states: OPEN) {
      nodes {
        number
        title
        labels(first: 10) { nodes { name } }
      }
    }
  }
}
' | jq -r '
  .data.repository.issues.nodes[] |
  select([.labels.nodes[].name] | index("Priority: High") | not) |
  "#\(.number): \(.title)"
'
```

---

## Decision Matrix: Which Tool to Use?

| Scenario | MCP Tools | `gh issue` | `gh api` | Custom Script |
|----------|-----------|------------|----------|---------------|
| **AI assistant available** | ✅ **Best** | ⚠️ Fallback | ❌ | ❌ |
| **Single issue, human review** | ✅ Good | ✅ **Best** | ❌ Overkill | ❌ Overkill |
| **5-10 issues, AI-assisted** | ✅ **Best** | ⚠️ Slow | ✅ Good | ❌ Setup overhead |
| **50+ issues, bulk update** | ✅ **Best** | ❌ Too slow | ✅ Good | ✅ Best (complex logic) |
| **Complex queries** | ✅ **Best** | ❌ Can't do | ✅ Good | ✅ Best |
| **Recurring automation** | ✅ **Best** | ❌ No state | ⚠️ OK | ✅ Best |
| **One-time audit with AI** | ✅ **Best** | ✅ Good | ⚠️ OK | ❌ Overkill |
| **Shell script integration** | ❌ | ✅ **Best** | ✅ Good | ✅ Best |
| **Error recovery needed** | ✅ **Built-in** | ⚠️ Manual | ⚠️ Custom | ✅ Full control |
| **Rollback required** | ✅ **Built-in** | ❌ No | ⚠️ Custom | ✅ Yes |

---

## Recommended Workflow

### For AI-Assisted Issue Management (Preferred)

When working with an AI assistant (Claude, GitHub Copilot, etc.), use MCP tools:

```markdown
# Example conversation
You: "Review issues #31-40 and update priorities based on security impact"

AI Assistant:
1. Uses mcp__github_list_issues to fetch issues #31-40
2. Analyzes each issue (security keywords, CVSS scores, etc.)
3. Uses mcp__github_update_issue to update priorities
4. Provides summary of changes made

Benefits:
✅ No shell escaping issues
✅ Automatic error handling
✅ Validation before changes
✅ Audit trail in conversation
```

### For Manual Terminal Work

**Single issue:**
```bash
gh issue edit 35 --add-label "Priority: High"
```

**Multiple issues (5-10):**
```bash
# If AI assistant available, ask it to use MCP tools
# Otherwise, use gh api for atomic operation (see section above)
```

**Bulk operations (50+):**
```bash
# Use custom Node.js script with Octokit (see examples)
```

---

## Conclusion

**Updated Golden Rule:**

1. **With AI Assistant**: Use **MCP tools** (best error handling, validation, logging)
2. **Terminal, single issue**: Use **`gh issue edit`** (simple, fast)
3. **Terminal, bulk**: Use **`gh api`** GraphQL (atomic operations)
4. **Complex automation**: Use **custom script** (Node.js + Octokit)

**For Ekklesia's issue tracking:**

- ✅ **Prefer MCP tools** when AI assistant is available
- ✅ **Use `gh issue edit`** for interactive single-issue work
- ✅ **Use `gh api`** for bulk operations (5+ issues)
- ✅ **Use custom scripts** for recurring automation with complex logic

This ensures:
- Efficient use of API rate limits
- Reduced risk of partial updates
- Better error handling and validation
- Audit trail for security-critical changes
