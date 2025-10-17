# GitHub Integration Guidelines

**Version:** 1.0  
**Last Updated:** October 17, 2025  
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

## Tools & Libraries

### GitHub CLI
- **Installation:** `brew install gh` or `apt install gh`
- **Docs:** https://cli.github.com/manual/
- **Auth:** `gh auth login`

### GitHub API (Node.js)
- **Library:** `@octokit/rest` (REST) or `@octokit/graphql` (GraphQL)
- **Install:** `npm install @octokit/rest`
- **Docs:** https://octokit.github.io/rest.js/

### GitHub API (Python)
- **Library:** `PyGithub`
- **Install:** `pip install PyGithub`
- **Docs:** https://pygithub.readthedocs.io/

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

**If 3+ answers point to API:** Use GitHub API  
**If 3+ answers point to CLI:** Use `gh` CLI  
**If mixed:** Start with CLI for prototyping, migrate to API if recurring

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

## Review & Updates

This guideline should be reviewed:
- **Quarterly:** Check if patterns have changed
- **After major incidents:** If automation causes issues
- **When GitHub updates:** New API features may change best practices

**Last Review:** October 17, 2025  
**Next Review:** January 17, 2026

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
