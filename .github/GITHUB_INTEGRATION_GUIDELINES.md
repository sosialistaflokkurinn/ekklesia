# GitHub Integration Guidelines

**Version:** 1.1
**Last Updated:** October 27, 2025
**Status:** Active Policy

## Purpose

This document establishes guidelines for interacting with GitHub issues, pull requests, and repository metadata from automation scripts, AI agents, and development tools.

## Hybrid Approach Rule

**Use the right tool for the job:**
- **GitHub CLI (`gh`)** for interactive, one-time operations
- **GitHub API (REST/GraphQL)** for bulk, recurring, or transactional operations

---

## When to Use GitHub CLI (`gh`)

### ✅ Appropriate Use Cases

1. **Interactive Analysis & Response**
   - Security audits requiring human judgment per issue
   - Code reviews with contextual feedback
   - One-time issue cleanup or triage
   - Quick fixes during development

2. **Sequential Operations**
   - Each operation requires different content/logic
   - Operations depend on previous results
   - Human verification needed between steps

3. **Simple Operations**
   - Creating single issue/PR
   - Adding comment to one issue
   - Updating labels on specific issues
   - Closing/reopening issues after manual review

4. **Shell Integration**
   - Combined with git commands
   - Part of bash/shell scripts
   - Terminal-based workflows

### Example: Good Use of `gh` CLI

```bash
# Security audit: Read issue, analyze, respond with custom feedback
gh issue view 35 --json body,labels
# (Analyze findings...)
gh issue comment 35 -b "Verification complete: ..."
gh issue edit 35 --add-label "Priority: High"
```

---

## When to Use GitHub API

### ✅ Appropriate Use Cases

1. **Bulk Operations**
   - Updating 10+ issues with similar pattern
   - Batch label changes
   - Mass migrations or reorganizations
   - Generating reports from many issues

2. **Recurring Automation**
   - Scheduled bots (weekly security checks)
   - CI/CD integrations
   - Automated issue lifecycle management
   - Metrics collection

3. **Complex Queries**
   - GraphQL to fetch nested data (issues + comments + labels + projects)
   - Cross-referencing multiple issues
   - Dependency analysis across issues/PRs

4. **Transactional Requirements**
   - Need rollback capability
   - Atomic multi-step operations
   - Validation before execution
   - Error recovery and retry logic

5. **Rich Validation**
   - Check constraints before changes
   - Verify issue relationships
   - Ensure data consistency

### Example: Good Use of GitHub API

```javascript
// Weekly security audit automation
const { Octokit } = require('@octokit/rest');

async function weeklySecurityAudit() {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  
  // 1. Fetch all security issues (GraphQL - one query)
  const issues = await octokit.graphql(`
    query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        issues(first: 100, labels: ["Security"], states: OPEN) {
          nodes {
            number
            title
            createdAt
            labels { nodes { name } }
            comments(last: 5) { nodes { body, createdAt } }
          }
        }
      }
    }
  `, { owner: 'sosialistaflokkurinn', repo: 'ekklesia' });

  // 2. Analyze (check for test evidence, age, priority)
  const updates = [];
  for (const issue of issues.repository.issues.nodes) {
    const age = daysSince(issue.createdAt);
    const hasTests = hasTestEvidence(issue.comments.nodes);
    const priority = issue.labels.nodes.find(l => l.name.startsWith('Priority:'));
    
    if (age > 30 && !hasTests) {
      updates.push({
        number: issue.number,
        action: 'request_verification',
        reason: `Open for ${age} days without test evidence`
      });
    }
    
    if (!priority && isCritical(issue)) {
      updates.push({
        number: issue.number,
        action: 'add_priority',
        label: 'Priority: High'
      });
    }
  }

  // 3. Execute updates with error handling
  const results = { success: [], failed: [] };
  
  for (const update of updates) {
    try {
      if (update.action === 'request_verification') {
        await octokit.issues.createComment({
          owner: 'sosialistaflokkurinn',
          repo: 'ekklesia',
          issue_number: update.number,
          body: `⚠️ **Automated Security Audit**\n\n${update.reason}\n\nPlease provide test evidence or close this issue.`
        });
      } else if (update.action === 'add_priority') {
        await octokit.issues.addLabels({
          owner: 'sosialistaflokkurinn',
          repo: 'ekklesia',
          issue_number: update.number,
          labels: [update.label]
        });
      }
      
      results.success.push(update.number);
      console.log(`✅ Updated #${update.number}`);
      
    } catch (error) {
      results.failed.push({ number: update.number, error: error.message });
      console.error(`❌ Failed #${update.number}:`, error.message);
    }
  }

  // 4. Report results
  await createAuditReport(results);
  return results;
}
```

---

## Decision Matrix

| Criteria | Use `gh` CLI | Use GitHub API |
|----------|-------------|----------------|
| **Number of operations** | < 10 | 10+ |
| **Frequency** | One-time | Recurring |
| **Content varies per issue** | ✅ Yes | ❌ No (pattern-based) |
| **Human judgment required** | ✅ Yes | ❌ No (automated logic) |
| **Need rollback** | ❌ No | ✅ Yes |
| **Complex queries** | ❌ Simple | ✅ Nested/joined data |
| **Part of shell script** | ✅ Yes | ❌ No (Node.js/Python) |
| **Error recovery needed** | ❌ Manual retry OK | ✅ Automatic retry |
| **Validation before action** | ❌ Not critical | ✅ Critical |
| **CI/CD integration** | ⚠️ Possible | ✅ Preferred |

---

## Implementation Guidelines

### For `gh` CLI Scripts

1. **Error Handling:**
   ```bash
   if ! gh issue comment 35 -b "..."; then
     echo "❌ Failed to add comment to #35"
     exit 1
   fi
   ```

2. **Escaping:**
   - Avoid complex strings with nested quotes
   - Use heredoc for multi-line content:
     ```bash
     gh issue comment 35 -b "$(cat <<'EOF'
     This is a multi-line comment
     with "quotes" and $variables preserved
     EOF
     )"
     ```

3. **Idempotency:**
   - Check state before acting:
     ```bash
     if gh issue view 35 --json state -q .state | grep -q "OPEN"; then
       gh issue close 35
     fi
     ```

### For GitHub API Scripts

1. **Authentication:**
   ```javascript
   // Use environment variable, never hardcode tokens
   const octokit = new Octokit({ 
     auth: process.env.GITHUB_TOKEN 
   });
   ```

2. **Rate Limiting:**
   ```javascript
   // Check rate limit before bulk operations
   const { data: rateLimit } = await octokit.rateLimit.get();
   if (rateLimit.rate.remaining < 100) {
     console.warn('⚠️ Approaching rate limit, waiting...');
     await sleep(60000); // Wait 1 minute
   }
   ```

3. **Error Recovery:**
   ```javascript
   async function retryOperation(fn, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await fn();
       } catch (error) {
         if (i === maxRetries - 1) throw error;
         await sleep(1000 * Math.pow(2, i)); // Exponential backoff
       }
     }
   }
   ```

4. **Batching (GraphQL):**
   ```javascript
   // Fetch multiple issues in one query
   const query = `
     query($owner: String!, $repo: String!, $numbers: [Int!]!) {
       repository(owner: $owner, name: $repo) {
         ${numbers.map((n, i) => `
           issue${i}: issue(number: ${n}) {
             number
             title
             state
           }
         `).join('\n')}
       }
     }
   `;
   ```

---

## Examples from This Project

### ✅ Good: Used `gh` CLI for Security Review (#31-40)

**Task:** Audit 10 security issues, each requiring custom analysis

**Why `gh` was correct:**
- Each issue needed different feedback (not bulk operation)
- Human judgment required per issue
- One-time audit, not recurring
- Sequential: analyze → verify → comment

**Result:** Efficient and appropriate

```bash
# Issue-by-issue analysis
gh issue view 33 --json body,comments
# (Analyze CSRF implementation...)
gh issue comment 33 -b "Verification complete: State is single-use..."

gh issue view 32 --json body,comments  
# (Analyze idempotency...)
gh issue comment 32 -b "Verification complete: Race conditions handled..."
```

### ❌ Bad Example: Bulk Update with `gh` CLI

**Anti-pattern:** Updating 50 issues with same label

```bash
# DON'T DO THIS - Too slow, no error handling
for i in {1..50}; do
  gh issue edit $i --add-label "Needs Review"
done
```

**Instead, use GitHub API:**

```javascript
// DO THIS - Batch operation with error handling
const issues = Array.from({length: 50}, (_, i) => i + 1);
await Promise.allSettled(
  issues.map(num => 
    octokit.issues.addLabels({
      owner, repo, issue_number: num,
      labels: ['Needs Review']
    })
  )
);
```

---

## Error Handling & Recovery

### Pattern 1: Validate Before Acting (gh CLI)

```bash
#!/bin/bash
set -euo pipefail

update_issue_safely() {
  local issue_num=$1
  local label=$2
  
  # 1. Check if issue exists
  if ! gh issue view "$issue_num" &>/dev/null; then
    echo "❌ Error: Issue #$issue_num does not exist"
    return 1
  fi
  
  # 2. Check if issue is open
  local state=$(gh issue view "$issue_num" --json state -q .state)
  if [ "$state" != "OPEN" ]; then
    echo "⚠️ Warning: Issue #$issue_num is $state (skipping)"
    return 0
  fi
  
  # 3. Check if label already exists
  local has_label=$(gh issue view "$issue_num" --json labels -q ".labels[] | select(.name == \"$label\") | .name")
  if [ -n "$has_label" ]; then
    echo "✓ Issue #$issue_num already has label '$label'"
    return 0
  fi
  
  # 4. Apply label
  if gh issue edit "$issue_num" --add-label "$label"; then
    echo "✅ Added '$label' to #$issue_num"
    return 0
  else
    echo "❌ Failed to add label to #$issue_num"
    return 1
  fi
}

# Usage with error tracking
FAILED=()
for issue in 35 38 40; do
  if ! update_issue_safely "$issue" "Priority: High"; then
    FAILED+=("$issue")
  fi
done

if [ ${#FAILED[@]} -gt 0 ]; then
  echo "❌ Failed issues: ${FAILED[*]}"
  exit 1
fi
```

### Pattern 2: Partial Failure Handling (GraphQL)

```bash
#!/bin/bash
# Handle GraphQL partial errors

QUERY='query {
  issue1: repository(owner: "owner", name: "repo") {
    issue(number: 35) { id }
  }
  issue2: repository(owner: "owner", name: "repo") {
    issue(number: 999) { id }  # Doesn't exist
  }
}'

RESULT=$(gh api graphql -f query="$QUERY" 2>&1)

# Check for errors in response
if echo "$RESULT" | jq -e '.errors' >/dev/null 2>&1; then
  echo "⚠️ GraphQL returned partial errors:"
  echo "$RESULT" | jq -r '.errors[] | "  - \(.path | join("/")): \(.message)"'
  
  # Extract successful results
  echo "$RESULT" | jq -r '.data | to_entries[] | select(.value != null) | .key'
fi
```

### Pattern 3: Retry Logic with Exponential Backoff

```bash
#!/bin/bash
retry_with_backoff() {
  local max_attempts=3
  local timeout=1
  local attempt=1
  local exitCode=0
  
  while [ $attempt -le $max_attempts ]; do
    if "$@"; then
      return 0
    fi
    
    exitCode=$?
    
    if [ $attempt -lt $max_attempts ]; then
      echo "⚠️ Attempt $attempt failed. Retrying in ${timeout}s..."
      sleep $timeout
      timeout=$((timeout * 2))  # Exponential backoff
    fi
    
    attempt=$((attempt + 1))
  done
  
  echo "❌ All $max_attempts attempts failed"
  return $exitCode
}

# Usage
retry_with_backoff gh issue comment 35 -b "Verification complete"
```

### Pattern 4: Rollback Strategy

```bash
#!/bin/bash
# Save state before bulk operation

BACKUP_FILE="/tmp/issues-backup-$(date +%Y%m%d-%H%M%S).json"

# 1. Backup current state
echo "📦 Backing up current state..."
gh api graphql -f query='
  query {
    repository(owner: "owner", name: "repo") {
      issues(first: 100, labels: ["Security"]) {
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
' > "$BACKUP_FILE"

# 2. Perform bulk operation
echo "🔄 Updating issues..."
if ! ./bulk-update.sh; then
  echo "❌ Update failed! Restore from: $BACKUP_FILE"
  
  # 3. Rollback (restore original labels)
  jq -r '.data.repository.issues.nodes[] | 
    @json "\(.number) \(.labels.nodes | map(.name) | join(","))"' \
    "$BACKUP_FILE" | \
  while IFS=' ' read -r issue_num labels; do
    echo "↩️ Restoring #$issue_num labels: $labels"
    # Remove all labels then add original ones
    gh issue edit "$issue_num" --remove-label "$(gh issue view $issue_num --json labels -q '.labels[].name' | tr '\n' ',')"
    IFS=',' read -ra LABEL_ARRAY <<< "$labels"
    for label in "${LABEL_ARRAY[@]}"; do
      gh issue edit "$issue_num" --add-label "$label"
    done
  done
  
  exit 1
fi

echo "✅ Update complete. Backup saved to: $BACKUP_FILE"
```

## Testing Strategy

### Approach 1: Dry-Run Mode

```bash
#!/bin/bash
DRY_RUN=${DRY_RUN:-true}  # Default to dry-run

update_issue() {
  local issue_num=$1
  local label=$2
  
  if [ "$DRY_RUN" = "true" ]; then
    echo "🔍 [DRY-RUN] Would add '$label' to #$issue_num"
    # Validate that command would work
    gh issue view "$issue_num" >/dev/null 2>&1 && echo "  ✓ Issue exists"
    return 0
  else
    echo "✏️ Adding '$label' to #$issue_num"
    gh issue edit "$issue_num" --add-label "$label"
  fi
}

# Usage:
# DRY_RUN=true ./script.sh   # Test mode
# DRY_RUN=false ./script.sh  # Actually execute
```

### Approach 2: Test in GraphQL Explorer First

Before running bulk GraphQL operations:

1. **Open GraphQL Explorer**: https://docs.github.com/en/graphql/overview/explorer
2. **Test query with small dataset**:
   ```graphql
   query {
     repository(owner: "sosialistaflokkurinn", name: "ekklesia") {
       issue(number: 35) {
         id
         number
         title
         labels(first: 5) {
           nodes { name }
         }
       }
     }
   }
   ```
3. **Verify mutation syntax** before running in production
4. **Test on dedicated test issue** (create issue #999 as "Test Issue - OK to modify")

### Approach 3: Test Issue Pattern

```bash
#!/bin/bash
# Create a test issue for validating operations

TEST_ISSUE=$(gh issue create \
  --title "[TEST] Label Management Test" \
  --body "This issue is for testing label operations. Safe to close." \
  --label "test" \
  --json number -q .number)

echo "Created test issue #$TEST_ISSUE"

# Test your operations on this issue
./bulk-label-update.sh "$TEST_ISSUE"

# Verify results
gh issue view "$TEST_ISSUE" --json labels -q '.labels[].name'

# Clean up
gh issue close "$TEST_ISSUE"
```

## Rate Limit Handling

### Check Quota Before Bulk Operations

```bash
#!/bin/bash
check_rate_limit() {
  local resource=$1  # "core" or "graphql"
  
  local limit=$(gh api rate_limit --jq ".resources.$resource")
  local remaining=$(echo "$limit" | jq -r .remaining)
  local reset=$(echo "$limit" | jq -r .reset)
  local reset_time=$(date -d "@$reset" '+%Y-%m-%d %H:%M:%S')
  
  echo "📊 Rate Limit Status ($resource):"
  echo "  Remaining: $remaining / $(echo "$limit" | jq -r .limit)"
  echo "  Resets at: $reset_time"
  
  if [ "$remaining" -lt 100 ]; then
    echo "⚠️ WARNING: Low quota! Only $remaining requests remaining."
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    [[ ! $REPLY =~ ^[Yy]$ ]] && return 1
  fi
  
  return 0
}

# Usage
check_rate_limit "graphql" || exit 1
./bulk-graphql-operation.sh
```

### Smart Rate Limiting

```bash
#!/bin/bash
# Add delays between requests to stay under limits

REQUESTS_PER_MINUTE=30  # Conservative limit
DELAY=$((60 / REQUESTS_PER_MINUTE))

for issue in {1..100}; do
  gh issue edit "$issue" --add-label "Reviewed"
  sleep "$DELAY"  # Throttle requests
done
```

## Tools & Libraries

### GitHub CLI
- **Installation:** `brew install gh` or `apt install gh`
- **Docs:** https://cli.github.com/manual/
- **Auth:** `gh auth login`
- **Rate Limits:** 5,000 requests/hour (authenticated)

### GitHub API (Node.js)
- **Library:** `@octokit/rest` (REST) or `@octokit/graphql` (GraphQL)
- **Install:** `npm install @octokit/rest`
- **Docs:** https://octokit.github.io/rest.js/
- **Rate Limits:** 5,000 requests/hour (authenticated), 60/hour (unauthenticated)

### GitHub API (Python)
- **Library:** `PyGithub`
- **Install:** `pip install PyGithub`
- **Docs:** https://pygithub.readthedocs.io/

### GitHub MCP Tools (Model Context Protocol)

**Status:** Recommended for AI-assisted workflows when available

GitHub MCP tools provide structured interfaces for AI assistants to interact with GitHub. When available, they offer:

✅ **Advantages:**
- Built-in validation and error handling
- Consistent audit trail
- Type-safe operations
- Integrated retry logic
- Better logging

⚠️ **Availability:**
- Depends on VSCode MCP configuration
- Check: `mcp list | grep github` or verify in `.vscode/settings.json`
- Fallback to `gh` CLI if unavailable

📝 **Usage Pattern:**
```bash
# Check if MCP tools are available
if mcp list 2>/dev/null | grep -q "github"; then
  echo "✅ Using GitHub MCP tools"
  # Use MCP-based workflow
else
  echo "⚠️ MCP tools not available, using gh CLI"
  # Fallback to gh CLI
fi
```

**When MCP tools should be preferred:**
- AI assistant performing operations
- Need audit trail of AI actions
- Complex multi-step operations
- Operations requiring validation

**Fallback strategy:**
- Always have `gh` CLI alternative
- Document both approaches in scripts
- Test fallback path regularly

---

## Checklist for New Scripts

Before writing a GitHub integration script, answer these questions:

- [ ] How many issues/PRs will this affect? (< 10 → CLI, 10+ → API)
- [ ] Will this run once or repeatedly? (Once → CLI, Recurring → API)
- [ ] Does content vary per item? (Yes → CLI, Pattern → API)
- [ ] Is human judgment required? (Yes → CLI, Automated → API)
- [ ] Do I need rollback capability? (Yes → API)
- [ ] Is this part of CI/CD? (Yes → API)
- [ ] Do I need complex queries? (Yes → GraphQL API)
- [ ] Have I tested with dry-run mode? (Required before bulk operations)
- [ ] Have I implemented error handling? (Required for production)
- [ ] Have I checked rate limits? (Required for bulk operations)

**If 3+ answers point to API:** Use GitHub API  
**If 3+ answers point to CLI:** Use `gh` CLI  
**If mixed:** Start with CLI for prototyping, migrate to API if recurring

---

## Workflow Integration

### Pre-commit Hook: Validate Issue References

```bash
#!/bin/bash
# .git/hooks/commit-msg

# Extract issue numbers from commit message
COMMIT_MSG_FILE=$1
ISSUES=$(grep -oE '#[0-9]+' "$COMMIT_MSG_FILE" | tr -d '#' | sort -u)

if [ -z "$ISSUES" ]; then
  # No issue references, allow commit
  exit 0
fi

echo "🔍 Validating issue references..."

INVALID=()
for issue in $ISSUES; do
  if ! gh issue view "$issue" &>/dev/null; then
    INVALID+=("$issue")
    echo "  ❌ Issue #$issue does not exist"
  else
    # Check if issue is closed
    state=$(gh issue view "$issue" --json state -q .state)
    if [ "$state" = "CLOSED" ]; then
      echo "  ⚠️ Issue #$issue is closed"
    else
      echo "  ✅ Issue #$issue exists"
    fi
  fi
done

if [ ${#INVALID[@]} -gt 0 ]; then
  echo ""
  echo "❌ Commit references non-existent issues: ${INVALID[*]}"
  echo "Please fix issue numbers or use 'git commit --no-verify' to bypass"
  exit 1
fi

echo "✅ All issue references valid"
exit 0
```

**Installation:**
```bash
cp .git/hooks/commit-msg.sample .git/hooks/commit-msg
chmod +x .git/hooks/commit-msg
# Edit to add validation logic above
```

### GitHub Actions: Auto-label PRs Based on Files

```yaml
# .github/workflows/auto-label-pr.yml
name: Auto-label Pull Requests

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  auto-label:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      contents: read
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Label based on changed files
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          PR_NUMBER=${{ github.event.pull_request.number }}
          
          # Get changed files
          CHANGED_FILES=$(gh pr diff $PR_NUMBER --name-only)
          
          # Security-related files
          if echo "$CHANGED_FILES" | grep -qE '(security|auth|crypto|token)'; then
            gh pr edit $PR_NUMBER --add-label "Security"
            echo "✅ Added Security label"
          fi
          
          # Documentation changes
          if echo "$CHANGED_FILES" | grep -qE '\.(md|txt)$'; then
            gh pr edit $PR_NUMBER --add-label "Documentation"
            echo "✅ Added Documentation label"
          fi
          
          # Test changes
          if echo "$CHANGED_FILES" | grep -qE '(test|spec)\.(js|py)$'; then
            gh pr edit $PR_NUMBER --add-label "Testing"
            echo "✅ Added Testing label"
          fi
          
          # Database migrations
          if echo "$CHANGED_FILES" | grep -qE 'migrations/'; then
            gh pr edit $PR_NUMBER --add-label "Database"
            gh pr edit $PR_NUMBER --add-label "Requires Review"
            echo "✅ Added Database + Requires Review labels"
          fi
```

### GitHub Actions: Issue Hygiene Bot

```yaml
# .github/workflows/issue-hygiene.yml
name: Issue Hygiene

on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9 AM
  workflow_dispatch:  # Manual trigger

jobs:
  hygiene:
    runs-on: ubuntu-latest
    permissions:
      issues: write
    
    steps:
      - name: Check stale security issues
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          # Find security issues open > 30 days without "Verified" label
          gh issue list \
            --label "Security" \
            --state open \
            --json number,createdAt,labels \
            --jq '.[] | select(
              (.createdAt | fromdateiso8601) < (now - 2592000) and
              ([.labels[].name] | contains(["Verified"]) | not)
            ) | .number' | \
          while read -r issue; do
            gh issue comment "$issue" -b "⚠️ **Security Issue Hygiene**

This security issue has been open for over 30 days without verification.

**Required Actions:**
- [ ] Add test evidence demonstrating the fix
- [ ] Add \`Verified\` label once testing complete
- [ ] Close issue if no longer relevant

cc @security-team"
            
            gh issue edit "$issue" --add-label "Needs Verification"
            echo "✅ Reminded on issue #$issue"
          done
      
      - name: Check issues without priority
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          # Find open issues without Priority label
          gh issue list \
            --state open \
            --json number,labels \
            --jq '.[] | select(
              [.labels[].name | startswith("Priority:")] | any | not
            ) | .number' | \
          while read -r issue; do
            gh issue comment "$issue" -b "⚠️ This issue is missing a priority label.

Please add one of:
- \`Priority: High\` - Critical security or blocking issues
- \`Priority: Medium\` - Important improvements
- \`Priority: Low\` - Nice-to-have enhancements"
            
            echo "✅ Requested priority for issue #$issue"
          done
```

### Issue Template with Required Labels

```yaml
# .github/ISSUE_TEMPLATE/security.yml
name: Security Issue
description: Report a security vulnerability or concern
title: "[Security] "
labels: ["Security", "Needs Triage"]
body:
  - type: markdown
    attributes:
      value: |
        ## Security Issue Report
        Please provide details about the security concern.
  
  - type: dropdown
    id: severity
    attributes:
      label: Severity
      description: How critical is this issue?
      options:
        - Critical (exploitable vulnerability)
        - High (significant security risk)
        - Medium (security improvement)
        - Low (security hardening)
    validations:
      required: true
  
  - type: textarea
    id: description
    attributes:
      label: Description
      description: Detailed description of the security issue
    validations:
      required: true
  
  - type: checkboxes
    id: checklist
    attributes:
      label: Security Checklist
      options:
        - label: I have not publicly disclosed this issue
          required: true
        - label: This affects production systems
          required: false
```

### Milestone Automation

```bash
#!/bin/bash
# scripts/auto-milestone.sh
# Auto-assign issues to milestones based on labels

MILESTONE="Security Hardening - Q4 2025"

# Find security issues without milestone
gh issue list \
  --label "Security" \
  --label "Priority: High" \
  --state open \
  --json number,milestone \
  --jq '.[] | select(.milestone == null) | .number' | \
while read -r issue; do
  # Check if milestone exists
  if ! gh api "repos/:owner/:repo/milestones" --jq ".[].title" | grep -q "^$MILESTONE$"; then
    echo "Creating milestone: $MILESTONE"
    gh api "repos/:owner/:repo/milestones" -X POST \
      -f title="$MILESTONE" \
      -f description="Security improvements and vulnerability fixes"
  fi
  
  # Assign to milestone
  gh issue edit "$issue" --milestone "$MILESTONE"
  echo "✅ Added #$issue to milestone: $MILESTONE"
done
```

---

## Migration Path

If a `gh` CLI script needs to be converted to API:

1. **Identify pattern:** What is repeated?
2. **Extract logic:** Separate analysis from execution
3. **Add error handling:** Try/catch, retries, logging
4. **Test with small batch:** Run on 3-5 issues first
5. **Add monitoring:** Log success/failure rates
6. **Schedule:** Set up cron/GitHub Actions

---

## Compliance & Security

### Authentication
- **Never commit tokens:** Use environment variables or GitHub Secrets
- **Scope tokens appropriately:** Only grant needed permissions
- **Rotate tokens:** Replace every 90 days

### Rate Limits
- **GitHub CLI:** 5,000 requests/hour (authenticated)
- **GitHub API:** 5,000 requests/hour (authenticated), 60/hour (unauthenticated)
- **GraphQL:** Separate point-based system (max 5,000 points/hour)

### Audit Trail
- All automated changes should include:
  - Bot identification: `[bot]` in commit messages
  - Rationale: Why the change was made
  - Reference: Link to automation script or job

---

## Security Issue Verification Workflow

### Background

The Weekly Security Hygiene workflow (`.github/workflows/security-hygiene.yml`) runs automated checks every Monday to ensure security issues are properly tracked and verified. This section documents the manual verification routine when the bot identifies unverified security fixes.

### When the Bot Alerts You

The bot sends email notifications for closed security issues missing the `Verified` label:

```
⚠️ Security Verification Missing

This security issue was closed but has not been verified with test evidence.

Required for security fixes:
 □ Add test demonstrating the fix
 □ Verify in production (if deployed)
 □ Add Verified label once confirmed
```

### Verification Routine (Step-by-Step)

**Time Required:** ~5 minutes per issue

#### Step 1: Identify Unverified Issues

```bash
# Find all closed security issues from last 30 days without Verified label
gh issue list --label "Security" --state closed \
  --json number,title,labels,closedAt \
  --jq '.[] | select(
    (.closedAt | fromdateiso8601) > (now - 2592000) and
    ([.labels[].name] | contains(["Verified"]) | not)
  ) | {number, title, closed: .closedAt[:10]}'
```

**Expected Output:**
```json
{"closed":"2025-10-19","number":63,"title":"Cache JWKS client"}
{"closed":"2025-10-19","number":58,"title":"Security improvements"}
{"closed":"2025-10-19","number":50,"title":"CORS restrictions"}
```

#### Step 2: Review Each Issue's Resolution

For each issue, check the comments for resolution evidence:

```bash
# Read issue details and comments
gh issue view 63 --comments | grep -A 20 "Resolution\|Verification\|deployed" -i
```

**Look for:**
- ✅ Implementation commit hash
- ✅ Deployment confirmation (service name, timestamp, URL)
- ✅ Test evidence (manual testing, unit tests, production logs)
- ✅ Performance/security impact measured

#### Step 3: Create Verification Template

Based on the issue type, use appropriate verification comment template:

**Template A: Code Changes with Tests**
```bash
gh issue comment <NUMBER> --body "$(cat <<'EOF'
✅ **Security Fix Verified**

**Implementation:**
- Commit: <HASH>
- Files changed: <FILES>
- Deployment: <SERVICE_NAME> (<TIMESTAMP>)

**Test Evidence:**
- Unit tests: <TEST_FILE>
- Production testing: <DESCRIPTION>
- Results: <OUTCOME>

**Verification Type:** <TYPE>
**Verified By:** @<USERNAME> (<DATE>)
**Label Added:** Verified (<DATE>)

This issue meets all security fix verification requirements.
EOF
)"
```

**Template B: Production Testing Only**
```bash
gh issue comment <NUMBER> --body "$(cat <<'EOF'
✅ **Security Fix Verified**

**Production Testing Evidence:**
- Test performed: <DATE>
- Test description: <WHAT_WAS_TESTED>
- Expected behavior: <EXPECTED>
- Actual behavior: <ACTUAL>
- Result: ✅ Pass

**Configuration Changes:**
- Service: <SERVICE_NAME>
- Environment variables: <VARS>
- Deployment: <TIMESTAMP>

**Verification Type:** Production testing
**Verified By:** @<USERNAME> (<DATE>)
**Label Added:** Verified (<DATE>)

This issue meets all security fix verification requirements.
EOF
)"
```

**Template C: Infrastructure/Config Changes**
```bash
gh issue comment <NUMBER> --body "$(cat <<'EOF'
✅ **Security Fix Verified**

**Infrastructure Changes:**
- Resource: <RESOURCE_NAME>
- Changes applied: <DESCRIPTION>
- Verification commands:
  ```bash
  <COMMAND_1>
  <COMMAND_2>
  ```

**Verification Results:**
- ✅ <ITEM_1>
- ✅ <ITEM_2>
- ✅ <ITEM_3>

**Security Impact:**
- Before: <OLD_STATE>
- After: <NEW_STATE>

**Verification Type:** Infrastructure validation
**Verified By:** @<USERNAME> (<DATE>)
**Label Added:** Verified (<DATE>)

This issue meets all security fix verification requirements.
EOF
)"
```

#### Step 4: Add Verified Label

```bash
# Add Verified label to issue
gh issue edit <NUMBER> --add-label "Verified"
```

#### Step 5: Verify Label Creation (First Time Only)

If the `Verified` label doesn't exist, create it:

```bash
# Create Verified label with green color
gh label create "Verified" \
  --description "Security fix has been verified with test evidence" \
  --color "0e8a16"
```

### Real-World Example (Oct 27, 2025)

**Scenario:** Weekly Security Hygiene bot identified 5 unverified issues

**Issues to Verify:**
- #48 - Database password rotation
- #50 - CORS restrictions
- #58 - Security improvements (body size, audit, errors)
- #62 - Rate limiting
- #63 - JWKS caching

**Execution Log:**

```bash
# Step 1: Find unverified issues
$ gh issue list --label "Security" --state closed \
    --json number,title,closedAt --jq '...'
# Output: 5 issues found

# Step 2: Process each issue
for issue in 48 50 58 62 63; do
  echo "Processing issue #$issue..."

  # Read resolution evidence
  gh issue view $issue --comments | tail -80

  # Add verification comment (using appropriate template)
  gh issue comment $issue --body "$(cat <<'EOF'
✅ **Security Fix Verified**
...evidence details...
EOF
)"

  # Add Verified label
  gh issue edit $issue --add-label "Verified"

  echo "✅ Issue #$issue verified"
done
```

**Result:**
- Time: ~25 minutes total (5 issues × 5 min each)
- All 5 issues properly verified and labeled
- Bot will not send alerts for these issues again

### Batch Processing Script

For multiple issues with similar verification needs:

```bash
#!/bin/bash
# scripts/verify-security-issues.sh

set -euo pipefail

# Issues to verify (space-separated)
ISSUES="48 50 58 62 63"

# Verification template (customize per batch)
TEMPLATE="$(cat <<'EOF'
✅ **Security Fix Verified**

This issue has been verified with test evidence from the resolution comment.

**Verification Type:** Production testing + code review
**Verified By:** @gudrodur (Oct 27, 2025)
**Label Added:** Verified (Oct 27, 2025)

This issue meets all security fix verification requirements.
EOF
)"

# Process each issue
for issue in $ISSUES; do
  echo "🔍 Processing issue #$issue..."

  # Check if already verified
  if gh issue view $issue --json labels \
      --jq '.labels[].name' | grep -q "^Verified$"; then
    echo "  ⏭️  Already verified, skipping"
    continue
  fi

  # Add verification comment
  if gh issue comment $issue --body "$TEMPLATE"; then
    echo "  ✅ Added verification comment"
  else
    echo "  ❌ Failed to add comment"
    continue
  fi

  # Add Verified label
  if gh issue edit $issue --add-label "Verified"; then
    echo "  ✅ Added Verified label"
  else
    echo "  ❌ Failed to add label"
  fi

  echo ""
done

echo "✅ Verification complete"
```

**Usage:**
```bash
chmod +x scripts/verify-security-issues.sh
./scripts/verify-security-issues.sh
```

### Verification Checklist

Before marking an issue as verified, ensure:

- [ ] **Resolution evidence exists** in issue comments
- [ ] **Deployment confirmed** (service name, timestamp, URL)
- [ ] **Test evidence documented** (unit tests, manual tests, or production logs)
- [ ] **Security impact measured** (before/after comparison)
- [ ] **Verification comment added** with all required details
- [ ] **Verified label applied** to issue

### Common Verification Types

| Type | Evidence Required | Example |
|------|------------------|---------|
| **Code Changes** | Commit hash, deployment, unit tests | Rate limiting implementation (#62) |
| **Production Testing** | Test description, commands, results | CORS preflight testing (#50) |
| **Infrastructure** | Config changes, verification commands | Database password rotation (#48) |
| **Performance Fix** | Before/after metrics, load testing | JWKS caching (#63) |
| **Security Hardening** | Multiple tests, audit logs | Body size limits + error sanitization (#58) |

### Troubleshooting

**Issue: Label creation fails**
```bash
# Check if label exists
gh label list | grep Verified

# If exists but wrong color, update it
gh label edit "Verified" --color "0e8a16"
```

**Issue: Cannot find verification evidence**
```bash
# Search all comments for keywords
gh issue view <NUMBER> --comments | grep -i "verification\|tested\|deployed\|commit"

# If no evidence, request it
gh issue comment <NUMBER> --body "⚠️ **Verification Needed**

This issue needs test evidence before it can be marked as verified.

Please provide:
- Commit hash or deployment details
- Test evidence (unit tests, manual testing, production logs)
- Security impact assessment

See: docs/security/VERIFICATION_GUIDELINES.md"
```

**Issue: Bot still sending alerts after verification**
```bash
# Check if Verified label is actually on the issue
gh issue view <NUMBER> --json labels --jq '.labels[].name'

# Ensure label name is exactly "Verified" (case-sensitive)
gh label list | grep -E "^Verified"

# Wait for next weekly run (Mondays 9 AM UTC)
```

### Automation Opportunities

**Future Enhancement:** Auto-detect verification evidence

```bash
# Check if resolution comment contains verification keywords
if gh issue view <NUMBER> --comments | \
    grep -qE "(deployed|tested|verified|commit [a-f0-9]{7})"; then
  echo "✅ Verification evidence detected"
  # Could auto-add Verified label if sufficient evidence
fi
```

### Integration with Weekly Workflow

The verification routine complements the automated workflow:

**Automated (.github/workflows/security-hygiene.yml):**
- Runs every Monday 9 AM UTC
- Identifies unverified issues
- Posts reminder comments
- Sends email notifications

**Manual (this routine):**
- Review bot notifications
- Verify test evidence exists
- Add verification comments
- Apply Verified labels

**Result:**
- All closed security issues have proper verification
- Audit trail for compliance
- No missing test evidence
- Bot stops sending alerts

---

## Review & Updates

This guideline should be reviewed:
- **Quarterly:** Check if patterns have changed
- **After major incidents:** If automation causes issues
- **When GitHub updates:** New API features may change best practices

**Last Review:** October 27, 2025
**Next Review:** January 27, 2026

---

## Questions?

If unsure which approach to use, ask:
1. "Will I need to do this again?" (Recurring → API)
2. "Are there more than 10 items?" (Bulk → API)
3. "Does each item need custom logic?" (Custom → CLI)

When in doubt: **Start with `gh` CLI for prototyping, migrate to API if it becomes recurring.**

---

**Approved by:** Development Team  
**Effective Date:** October 17, 2025  
**Policy Status:** Active
