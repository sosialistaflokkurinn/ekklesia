# GitHub PR Review Reply Workflow

**Purpose**: How to properly respond to inline PR review comments using GitHub CLI with threaded replies
**Last Updated**: 2025-10-15
**Status**: Draft - Awaiting Review
**Primary Method**: GraphQL API (Method 3) - Fully tested and verified ✅

---

## Overview

This workflow focuses on **Method 3 (GraphQL API)** as the primary method for responding to PR review comments because it:
- Creates true threaded replies (shows directly under the review comment)
- Appears in the Files Changed view
- Allows resolving conversations after reply
- Provides proper reviewer notifications

**Alternative methods** (Method 1: Web UI, Method 2: General PR comment) are documented but should only be used when Method 3 is not feasible.

---

## ❌ WRONG: Editing the Reviewer's Comment

**DO NOT DO THIS**:

```bash
# This OVERWRITES the reviewer's comment! ❌
gh api repos/OWNER/REPO/pulls/comments/COMMENT_ID \
  --method PATCH \
  -f body="Your response here"
```

**What happens**:
- The original comment is **replaced** with your response
- The reviewer's text is **lost** (unless you have a backup)
- The comment author remains the reviewer (confusing!)
- Edit timestamp shows you modified their comment

**Why this is bad**:
- Destroys the reviewer's original feedback
- Breaks the conversation thread
- Violates GitHub etiquette
- Can only be undone if you have the original text saved

---

## ✅ CORRECT: Replying to Review Comments

### Method 1: Reply via Web UI (Recommended for Single Comments)

1. Navigate to the PR review comment on GitHub
2. Click the **"Reply..."** button under the comment
3. Type your response
4. Click **"Add single comment"** or **"Start a review"**

**Pros**:
- Simple and foolproof
- Visual confirmation before posting
- Can see full diff context

**Cons**:
- Manual process (not scriptable)
- Time-consuming for many comments

---

### Method 2: Reply via GitHub CLI (Recommended for Batch Responses)

**For inline review comments**, post a **general PR comment** that references the review comment ID:

```bash
# Post a reply that references the specific review comment
gh pr comment PR_NUMBER --body "$(cat <<'EOF'
## Response to r2425305983 (Correlation ID suggestion)

[Your detailed response here...]

**Related**: https://github.com/OWNER/REPO/pull/PR_NUMBER#discussion_r2425305983
EOF
)"
```

**Example**:

```bash
gh pr comment 29 --body "$(cat <<'EOF'
## Response to r2425305983 (Correlation ID - audit_id)

Sammála! Þetta er frábær hugmynd.

**Implementation**:
- Add `audit_id UUID` column to both databases
- Generate in Events service when issuing token
- Pass to Elections via S2S endpoint
- Log audit_id instead of PII

**Related Issue**: #44 - Add correlation ID (audit_id)

**Related Comment**: https://github.com/sosialistaflokkurinn/ekklesia/pull/29#discussion_r2425305983
EOF
)"
```

**Pros**:
- Scriptable (can respond to many comments)
- Original review comments remain intact
- Clear reference to which comment you're responding to
- All responses visible in PR conversation tab

**Cons**:
- Not directly threaded under the inline comment
- Requires manual cross-reference links

---

### Method 3: GraphQL API for Direct Reply (Advanced)

**NOTE**: This is the "proper" way to reply directly to inline comments, but requires GraphQL.

**✅ TESTED AND WORKING** (2025-10-15)

```bash
# Step 1: Find the review thread ID for the comment
THREAD_ID=$(gh api graphql -f query='
query {
  repository(owner: "OWNER", name: "REPO") {
    pullRequest(number: PR_NUMBER) {
      reviewThreads(first: 100) {
        nodes {
          id
          comments(first: 1) {
            nodes {
              databaseId
            }
          }
        }
      }
    }
  }
}' --jq '.data.repository.pullRequest.reviewThreads.nodes[] |
  select(.comments.nodes[0].databaseId == COMMENT_DATABASE_ID) | .id')

# Step 2: Post reply using the thread ID
gh api graphql -f query='
mutation($threadId: ID!, $body: String!) {
  addPullRequestReviewThreadReply(input: {
    pullRequestReviewThreadId: $threadId
    body: $body
  }) {
    comment {
      id
      url
    }
  }
}
' -f threadId="$THREAD_ID" -f body="Your response here"
```

**Complete Example**:

```bash
# Reply to comment database ID 2425305983
COMMENT_ID=2425305983

# Find thread ID
THREAD_ID=$(gh api graphql -f query='
query {
  repository(owner: "sosialistaflokkurinn", name: "ekklesia") {
    pullRequest(number: 29) {
      reviewThreads(first: 100) {
        nodes {
          id
          comments(first: 1) {
            nodes {
              databaseId
            }
          }
        }
      }
    }
  }
}' --jq ".data.repository.pullRequest.reviewThreads.nodes[] |
  select(.comments.nodes[0].databaseId == $COMMENT_ID) | .id")

echo "Thread ID: $THREAD_ID"

# Post threaded reply
gh api graphql -f query='
mutation($threadId: ID!, $body: String!) {
  addPullRequestReviewThreadReply(input: {
    pullRequestReviewThreadId: $threadId
    body: $body
  }) {
    comment {
      url
    }
  }
}
' -f threadId="$THREAD_ID" -f body="$(cat <<'EOF'
## Response to correlation ID suggestion

Sammála! Þetta er frábær hugmynd.

**Implementation**: Add audit_id UUID column...
EOF
)" --jq '.data.addPullRequestReviewThreadReply.comment.url'
```

**Pros**:
- ✅ Directly threaded under the review comment (true inline reply)
- ✅ Native GitHub conversation flow
- ✅ Proper notification to reviewer
- ✅ Shows up in the Files Changed view under the comment
- ✅ Can resolve the conversation thread after replying

**Cons**:
- ❌ Complex GraphQL syntax (2-step process)
- ❌ Requires understanding of thread IDs vs comment IDs
- ❌ More error-prone than simple `gh pr comment`
- ❌ Need to query for thread ID first (cannot use comment ID directly)

---

## Pre-Response Verification Checklist

**CRITICAL**: Before responding to any review comment, verify your answer against the **current code** on the branch.

### Step 1: Identify the File and Line

```bash
# Get comment details
gh api repos/OWNER/REPO/pulls/comments/COMMENT_ID --jq '{
  file: .path,
  line: .line,
  original_line: .original_line,
  diff_hunk: .diff_hunk
}'
```

### Step 2: Read Current Code

```bash
# Read the actual file on the branch
FILE_PATH=$(gh api repos/OWNER/REPO/pulls/comments/COMMENT_ID --jq '.path')
LINE=$(gh api repos/OWNER/REPO/pulls/comments/COMMENT_ID --jq '.line')

# Read file from current branch
git show HEAD:$FILE_PATH | cat -n | sed -n "$((LINE-10)),$((LINE+10))p"

# Or use Read tool to read the entire file
# Then analyze the specific line/section
```

### Step 3: Verify Your Understanding

**Ask these questions**:

1. ✅ **Is the code still like this on HEAD?**
   - Code may have changed since review comment was posted
   - Always check current state, not the diff

2. ✅ **Does my answer match the actual implementation?**
   - Quote actual line numbers
   - Quote actual code snippets
   - Don't guess or assume

3. ✅ **Have I checked related files?**
   ```bash
   # Example: If comment is about database config
   # Check: migrations, schema files, config files
   ls -la elections/migrations/
   ls -la events/migrations/
   ```

4. ✅ **Is there existing documentation I should reference?**
   ```bash
   # Check relevant docs
   ls -la docs/design/
   ls -la docs/status/
   ```

5. ✅ **Should I test this claim?**
   ```bash
   # If claiming "X returns 404"
   # Actually check the code path
   grep -r "404" elections/src/routes/
   ```

### Step 4: Cross-Reference with Issues

```bash
# Check if there's already an issue for this
gh issue list --search "keyword from comment" --json number,title

# Check if issue was already created
cat docs/reviews/PR29_REVIEW_INDEX.md | grep -i "keyword"
```

### Verification Example

**Comment**: "Þetta constraint myndi valda því að það er ekki hægt að bæta við nýjum færslum eftir meira en 1 ár"

**File**: `elections/migrations/001_initial_schema.sql:69`

**Verification steps**:

```bash
# 1. Read the actual line
sed -n '69p' elections/migrations/001_initial_schema.sql

# Output: CONSTRAINT recent_audit CHECK (timestamp >= NOW() - INTERVAL '1 year')

# 2. Understand what NOW() does
# NOW() is evaluated at INSERT time, not schema creation time
# Test this claim with SQL knowledge

# 3. Draft response explaining NOW() moves forward with time

# 4. Verify no related issues exist
gh issue list --search "audit constraint" --json number,title
```

**✅ VERIFIED** - Response is accurate, based on actual code, tested understanding of SQL behavior.

---

## Workflow: Responding to Multiple Comments

### Step 1: Fetch All Unresolved Comments

```bash
# Fetch all PR review comments
gh api graphql -f query='
query {
  repository(owner: "OWNER", name: "REPO") {
    pullRequest(number: PR_NUMBER) {
      reviewThreads(first: 100) {
        nodes {
          isResolved
          comments(first: 10) {
            nodes {
              id
              databaseId
              body
              author { login }
              path
              line
            }
          }
        }
      }
    }
  }
}
' --jq '[.data.repository.pullRequest.reviewThreads.nodes[] |
  select(.isResolved == false) |
  .comments.nodes[0] |
  {id: .databaseId, author: .author.login, file: .path, line: .line, body: .body}
]' > /tmp/unresolved_comments.json
```

**Save this output** - you'll need the original text if you make mistakes!

### Step 2: Analyze Comments by Category

```bash
# Group by file
cat /tmp/unresolved_comments.json | jq -r '
  group_by(.file) |
  map({file: .[0].file, count: length}) |
  sort_by(.count) |
  reverse[] |
  "\(.count) comments - \(.file)"
'
```

### Step 3: Draft Responses (DO NOT POST YET)

Create response drafts in a file:

```bash
# Create response template
cat > /tmp/responses.md <<'EOF'
# PR Review Responses

## Response to r2425305983 (Correlation ID)
[Draft your response here...]

## Response to r2425328175 (Idempotency)
[Draft your response here...]
EOF
```

### Step 4: Review Your Drafts

**IMPORTANT**: Have the user review your drafts before posting!

```bash
# Show drafts to user
cat /tmp/responses.md
```

### Step 5: Post Responses (After Approval)

```bash
# Post each response as a separate comment
gh pr comment 29 --body "$(cat <<'EOF'
## Response to r2425305983 (Correlation ID)

Your approved response text here...
EOF
)"
```

---

## Error Recovery: Restoring Overwritten Comments

If you accidentally edited reviewer comments instead of replying:

### Step 1: Check if You Have Original Text

```bash
# If you saved the original comments earlier:
cat /tmp/unresolved_comments.json | jq -r '.[] | select(.id == COMMENT_ID) | .body'
```

### Step 2: Restore Original Comment

```bash
# Save original text to file
cat /tmp/unresolved_comments.json | jq -r '.[] | select(.id == COMMENT_ID) | .body' > /tmp/restore.txt

# Restore the comment
gh api repos/OWNER/REPO/pulls/comments/COMMENT_ID \
  --method PATCH \
  --field body=@/tmp/restore.txt
```

### Step 3: Post Your Response Separately

```bash
# Now post YOUR response as a new comment
gh pr comment PR_NUMBER --body "Your response..."
```

---

## Best Practices

### DO ✅

1. **Save original comments** before starting work
   ```bash
   gh api graphql ... > /tmp/unresolved_comments.json
   ```

2. **Use clear response headers** with comment IDs
   ```markdown
   ## Response to r2425305983 (Short description)
   ```

3. **Include cross-reference links**
   ```markdown
   **Related**: https://github.com/OWNER/REPO/pull/29#discussion_r2425305983
   ```

4. **Draft responses in batches** and get approval before posting

5. **Use `gh pr comment`** for general responses
   ```bash
   gh pr comment 29 --body "..."
   ```

### DON'T ❌

1. **Never use `--method PATCH`** on review comments
   ```bash
   # ❌ WRONG - This edits the comment
   gh api repos/.../pulls/comments/ID --method PATCH -f body="..."
   ```

2. **Don't post without saving originals first**
   - Always backup comment data before any operations

3. **Don't reply to all comments at once**
   - Post in batches (5-10 at a time)
   - Allow time for reviewer to see responses

4. **Don't use complex GraphQL** unless necessary
   - Prefer simple `gh pr comment` for most cases

---

## Quick Reference

### Get Comment ID from URL

```
URL: https://github.com/OWNER/REPO/pull/29#discussion_r2425305983
Comment ID: r2425305983 (display ID)
Database ID: 2425305983 (for API calls)
```

### Post Response to Specific Comment

```bash
gh pr comment 29 --body "$(cat <<'EOF'
## Response to r2425305983

Your response here...

**Related**: https://github.com/OWNER/REPO/pull/29#discussion_r2425305983
EOF
)"
```

### Check Comment Status

```bash
# See if comment was edited
gh api repos/OWNER/REPO/pulls/comments/COMMENT_ID --jq '{
  author: .user.login,
  created: .created_at,
  updated: .updated_at,
  body_preview: .body[0:100]
}'
```

---

## Example: Complete Workflow

```bash
# 1. Fetch all unresolved comments
gh api graphql -f query='...' > /tmp/unresolved.json

# 2. Count comments
echo "Total unresolved: $(cat /tmp/unresolved.json | jq length)"

# 3. Review first comment
cat /tmp/unresolved.json | jq -r '.[0] | {id, file, line, body}'

# 4. Draft response (in editor)
nano /tmp/response_1.md

# 5. Post response (after user approval)
gh pr comment 29 --body "$(cat /tmp/response_1.md)"

# 6. Verify posted
gh pr view 29 --comments | tail -20
```

---

## Troubleshooting

### "Comment not found" error

**Cause**: Using display ID (`r2425305983`) instead of database ID (`2425305983`)

**Fix**: Remove the `r` prefix
```bash
# Wrong: r2425305983
# Right: 2425305983
```

### Response not showing under comment

**Cause**: Using `gh pr comment` posts a general comment, not a threaded reply

**Solution**: This is expected behavior with the CLI method. For true threading, use the web UI or GraphQL method.

### Accidentally edited reviewer's comment

**Fix**: Follow "Error Recovery" section above to restore original text

---

## Related Documentation

- [GitHub CLI PR Comment Docs](https://cli.github.com/manual/gh_pr_comment)
- [GitHub GraphQL API - PR Comments](https://docs.github.com/en/graphql/reference/mutations#addpullrequestreviewcomment)
- [GitHub REST API - Review Comments](https://docs.github.com/en/rest/pulls/comments)

---

**Last Updated**: 2025-10-15
**Status**: ✅ Production-Tested (PR#29 campaign - 74 responses)
**Validation**: PR#29 review response campaign (Oct 15, 2025)

---

## 🎯 Production Results

**Method 3 (GraphQL API)** was successfully used in PR#29 campaign:
- ✅ 74 responses posted
- ✅ 0 posting errors
- ✅ 100% threaded replies
- ✅ Average 2.5 min per response
- ✅ Python subprocess method (reliable string handling)

**See Also**: [PR29_CAMPAIGN_LEARNINGS.md](../PR29_CAMPAIGN_LEARNINGS.md) for real-world best practices and velocity analysis
