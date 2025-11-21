# Code Pattern Checks

Automated code quality checks for common patterns and anti-patterns.

**Script**: `scripts/check-code-patterns.sh`
**Last Updated**: 2025-11-13 (Issue #272)

---

## Table of Contents

1. [Overview](#overview)
2. [Current Patterns](#current-patterns)
3. [Adding New Patterns](#adding-new-patterns)
4. [Pattern Examples](#pattern-examples)
5. [CI Integration](#ci-integration)
6. [False Positives](#false-positives)

---

## Overview

The code pattern checker (`scripts/check-code-patterns.sh`) scans the codebase for common issues discovered through:

- GitHub Copilot reviews
- Human code reviews
- Production bugs
- Security scans

**Benefits:**
- Catches issues before code review
- Enforces consistent patterns
- Prevents common mistakes
- Documents team standards

**Usage:**
```bash
# Check default path (apps/members-portal/js/)
./scripts/check-code-patterns.sh

# Check specific path
./scripts/check-code-patterns.sh services/elections/

# Check everything
./scripts/check-code-patterns.sh .
```

---

## Current Patterns

### Pattern 1: createBadge API Misuse

**Issue**: Incorrect argument order for `createBadge()`

**❌ Wrong:**
```javascript
createBadge({ text: 'Active', variant: 'success' });
```

**✅ Correct:**
```javascript
createBadge('Active', { variant: 'success' });
```

**Detection**: Grep for `createBadge({`
**Level**: Critical
**Added**: PR #250
**Related**: Issue #265

---

### Pattern 2: Button API Misuse

**Issue**: Using deprecated `.setDisabled()` instead of `.disable()` / `.enable()`

**❌ Wrong:**
```javascript
button.setDisabled(true);
button.setDisabled(false);
```

**✅ Correct:**
```javascript
button.disable();
button.enable();
```

**Detection**: Grep for `.setDisabled(`
**Level**: Critical
**Added**: PR #250

---

### Pattern 3: Development Markers

**Issue**: TODO/FIXME comments left in code

**Markers:**
- `// TODO:`
- `// FIXME:`
- `// HACK:`
- `// XXX:`
- `// NEW:` (from AI code generation)

**Action**: Address or remove before merge

**Detection**: Grep for marker comments
**Level**: Warning
**Added**: PR #250

---

### Pattern 4: Unrealistic Documentation Examples

**Issue**: Documentation examples with unrealistic kennitalas

**❌ Wrong:**
```javascript
/**
 * @param {string} kennitala - Kennitala (e.g., "0000000000")
 */
```

**✅ Correct:**
```javascript
/**
 * @param {string} kennitala - Kennitala (e.g., "010300-9999")
 */
```

**Format**: `DDMMYY-SSSS` (e.g., Jan 3, 2000)

**Detection**: Grep for `0000000000`, `9999999999`, `XXXXXXXXXX` in docs
**Level**: Warning
**Added**: PR #250

---

### Pattern 5: Async Event Listeners Without Error Handling

**Issue**: Async event listeners that might throw unhandled errors

**❌ Wrong:**
```javascript
button.addEventListener('click', async () => {
  await doSomething(); // Unhandled rejection risk
});
```

**✅ Correct:**
```javascript
button.addEventListener('click', async () => {
  try {
    await doSomething();
  } catch (error) {
    handleError(error);
  }
});
```

**Detection**: Grep for `addEventListener.*async.*=>`
**Level**: Warning (manual review needed)
**Added**: PR #250

---

### Pattern 6: Missing Callback Parameters

**Issue**: Callback parameters used but not declared in function signature

**Example:**
```javascript
function submit() {
  // ...
  onSuccess(result); // Where is onSuccess defined?
}

// Should be:
function submit(onSuccess, onError) {
  // ...
  onSuccess(result);
}
```

**Detection**: Grep for common callback names (`onSuccess`, `onError`, `callback`)
**Level**: Warning (heuristic check)
**Added**: PR #250

---

### Pattern 7: innerHTML Usage (XSS Risk)

**Issue**: Using `.innerHTML =` can introduce XSS vulnerabilities

**❌ Unsafe:**
```javascript
element.innerHTML = userInput; // XSS risk!
```

**✅ Safe:**
```javascript
element.textContent = userInput; // Safe

// Or use DOM API
const li = document.createElement('li');
li.textContent = userInput;
element.appendChild(li);
```

**Exceptions:**
- `innerHTML = ''` (clearing) is okay
- Trusted static HTML is okay (no user input)

**Detection**: Grep for `.innerHTML =` (excluding `= ''`)
**Level**: Warning
**Added**: PR #250

---

### Pattern 8: Component Factory API Consistency

**Issue**: Component factories returning raw HTMLElements instead of `{element, ...methods}` API

**❌ Wrong:**
```javascript
export function createCard(options = {}) {
  const card = document.createElement('div');
  // ... setup ...
  return card; // Raw element
}
```

**✅ Correct:**
```javascript
export function createCard(options = {}) {
  const card = document.createElement('div');
  // ... setup ...

  return {
    element: card,
    setTitle: (title) => { /* ... */ },
    destroy: () => card.remove()
  };
}
```

**Exception**: Utility modules (like `status.js`) are valid exceptions

**Detection**: Grep for `export function create*()` with `return element;` or `return container;`
**Level**: Warning
**Added**: Issue #274
**Documentation**: docs/development/COMPONENT_PATTERNS.md

---

### Pattern 9: console.log/error in Cloud Run Services

**Issue**: Using `console.log/error/warn` instead of Winston structured logger

**❌ Wrong:**
```javascript
console.error('[Vote] Error:', error);
console.log('[S2S] Token registered:', token_hash);
```

**✅ Correct:**
```javascript
const logger = require('./utils/logger');

logger.error('Vote error', {
  error: error.message,
  stack: error.stack,
  correlationId: req.correlationId
});

logger.info('Token registered', {
  operation: 's2s_register_token',
  correlationId: correlation_id
});
```

**Benefits:**
- Structured JSON logs
- PII sanitization
- Cloud Logging integration
- Queryable metadata

**Exceptions:**
- Database connection startup logs (informational)
- Graceful shutdown logs
- logger.js itself

**Detection**: Grep for `console.(log|error|warn)` in `services/` directory
**Level**: Warning
**Added**: Issue #271, #272
**Documentation**: services/events/src/utils/LOGGING_USAGE.md

---

## Adding New Patterns

### When to Add a Pattern

Add a pattern check when:

1. **Recurring Issue**: Same mistake appears in 3+ code reviews
2. **Automatable**: Can be detected with regex/grep
3. **Clear Fix**: Solution is well-documented and consistent
4. **Low False Positives**: < 10% false positive rate

**Don't add patterns for:**
- One-off mistakes
- Subjective style preferences
- Complex logic that requires deep analysis
- Issues better caught by linters (ESLint, TypeScript)

---

### Process for Adding Patterns

**Step 1: Pattern Discovery**

Document the issue:
- What is the anti-pattern?
- Why is it problematic?
- What is the correct approach?
- How common is it?

**Step 2: Pattern Analysis**

Determine detection method:
```bash
# Test detection regex
grep -rn "pattern_regex" apps/members-portal/js/

# Check false positive rate
# Goal: < 10% false positives
```

**Step 3: Implementation**

Add to `scripts/check-code-patterns.sh`:

```bash
# Pattern N: Description
echo -e "${BLUE}N️⃣  Checking for [description]...${NC}"

PATTERN_RESULTS=$(grep -rn "pattern_regex" "$SEARCH_PATH" 2>/dev/null | \
  grep -v node_modules | \
  grep -v "exclusions" | \
  head -10 || true)

if [ -n "$PATTERN_RESULTS" ]; then
  echo "$PATTERN_RESULTS"
  echo -e "   ${YELLOW}⚠️  Found [issue description]${NC}"
  echo -e "   ${YELLOW}💡 [Recommended fix]${NC}"
  echo -e "   ${YELLOW}   Example:${NC}"
  echo -e "   ${YELLOW}   [code example]${NC}"

  # Choose severity level
  WARNINGS=$((WARNINGS + 1))  # Or FOUND_ISSUES for critical
else
  echo -e "   ${GREEN}✅ [Success message]${NC}"
fi
echo ""
```

**Step 4: Documentation**

Add to this file (`CODE_PATTERN_CHECKS.md`):
- Pattern number and description
- Wrong vs. correct examples
- Detection method
- Severity level
- Related issues/PRs
- Exceptions (if any)

**Step 5: Testing**

```bash
# Test on codebase
./scripts/check-code-patterns.sh

# Verify no false positives
# Review each result manually
```

**Step 6: Team Communication**

- Update team in standups/Slack
- Add to onboarding docs
- Reference in code review comments

---

## Pattern Examples

### Example 1: Adding "Hardcoded Production URLs" Pattern

**Pattern Discovery:**
```
Issue: Found hardcoded production URLs in 5+ files
Why problematic: Makes testing difficult, violates DRY
Fix: Use environment variables and config
```

**Pattern Analysis:**
```bash
# Test detection
grep -rn "https://ekklesia-prod" apps/

# Found 8 instances, 1 false positive (comment)
# False positive rate: 12.5% (acceptable)
```

**Implementation:**
```bash
# Pattern 10: Hardcoded production URLs
echo -e "${BLUE}🔟  Checking for hardcoded production URLs...${NC}"

HARDCODED_URLS=$(grep -rn "https://ekklesia-prod" "$SEARCH_PATH" 2>/dev/null | \
  grep -v node_modules | \
  grep -v "// " | \
  head -5 || true)

if [ -n "$HARDCODED_URLS" ]; then
  echo "$HARDCODED_URLS"
  echo -e "   ${YELLOW}⚠️  Found hardcoded production URLs${NC}"
  echo -e "   ${YELLOW}💡 Use environment variables instead${NC}"
  echo -e "   ${YELLOW}   Example: const url = process.env.API_URL;${NC}"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "   ${GREEN}✅ No hardcoded URLs found${NC}"
fi
echo ""
```

**Documentation:** Add to this file with examples

**Testing:**
```bash
./scripts/check-code-patterns.sh

# Review results
# Update exclusions if needed
```

---

### Example 2: Adding "SQL Injection Risk" Pattern

**Pattern Discovery:**
```
Issue: String concatenation in SQL queries
Why problematic: SQL injection vulnerability
Fix: Use parameterized queries
```

**Pattern Analysis:**
```bash
# Test detection
grep -rn 'query.*\${' services/

# Check for: query(`SELECT * FROM users WHERE id = ${userId}`)
```

**Implementation:**
```bash
# Pattern 11: SQL injection risk (string interpolation)
echo -e "${BLUE}1️⃣1️⃣  Checking for SQL injection risks...${NC}"

SQL_INJECTION=$(grep -rn 'query.*\${' "$SEARCH_PATH" 2>/dev/null | \
  grep -v node_modules | \
  grep -v "// " | \
  head -5 || true)

if [ -n "$SQL_INJECTION" ]; then
  echo "$SQL_INJECTION"
  echo -e "   ${RED}❌ Found potential SQL injection risk${NC}"
  echo -e "   ${YELLOW}💡 Use parameterized queries${NC}"
  echo -e "   ${YELLOW}   Example: query('SELECT * FROM users WHERE id = \$1', [userId])${NC}"
  FOUND_ISSUES=$((FOUND_ISSUES + 1))  # Critical!
else
  echo -e "   ${GREEN}✅ No SQL injection risks found${NC}"
fi
echo ""
```

**Note**: This is marked as CRITICAL (not warning) because SQL injection is a security vulnerability.

---

## CI Integration

### Current Setup

Pattern checks run automatically via git hooks:

**Pre-commit Hook**: `.git/hooks/commit-msg`
- Runs on every commit
- Blocks commit if critical issues found
- Allows warnings (but shows them)

**GitHub Actions**: (To be implemented - Issue #272)
```yaml
name: Code Quality
on: [pull_request]

jobs:
  pattern-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run pattern checks
        run: ./scripts/check-code-patterns.sh
```

---

### Adding to CI

**Step 1**: Create GitHub Actions workflow

File: `.github/workflows/code-quality.yml`
```yaml
name: Code Quality Checks

on:
  pull_request:
    paths:
      - 'apps/**/*.js'
      - 'services/**/*.js'

jobs:
  pattern-checks:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Run code pattern checks
        run: |
          chmod +x scripts/check-code-patterns.sh
          ./scripts/check-code-patterns.sh

      - name: Comment PR if warnings
        if: failure()
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '⚠️ Code pattern checks found issues. Run `./scripts/check-code-patterns.sh` locally to see details.'
            })
```

**Step 2**: Test workflow
```bash
# Create PR
gh pr create --title "Test: CI pattern checks"

# Verify workflow runs
gh run list --workflow=code-quality.yml
```

**Step 3**: Add badge to README
```markdown
![Code Quality](https://github.com/sosialistaflokkurinn/ekklesia/workflows/Code%20Quality%20Checks/badge.svg)
```

---

## False Positives

### Handling False Positives

**Strategy 1: Exclude specific files**
```bash
PATTERN=$(grep -rn "pattern" "$SEARCH_PATH" | \
  grep -v "excluded_file.js" | \
  grep -v "another_exception.js")
```

**Strategy 2: Exclude comments**
```bash
PATTERN=$(grep -rn "pattern" "$SEARCH_PATH" | \
  grep -v "// ")
```

**Strategy 3: Contextual filtering**
```bash
# Only check specific file types
PATTERN=$(grep -rn "pattern" "$SEARCH_PATH" | \
  grep "\.js$" | \
  grep -v "test.js$")
```

**Strategy 4: Document exceptions**
```bash
if [ -n "$PATTERN" ]; then
  echo -e "   ${YELLOW}Note: Utility modules (like status.js) are valid exceptions${NC}"
fi
```

---

### Common False Positives

**Pattern 3 (Development Markers):**
- False Positive: `// TODO` in documentation explaining what TODOs are
- Fix: Exclude `.md` files

**Pattern 5 (Async Listeners):**
- False Positive: Async listeners that don't throw
- Fix: Manual review required (warning level, not critical)

**Pattern 7 (innerHTML):**
- False Positive: `innerHTML = ''` for clearing content
- Fix: Exclude empty string assignments

**Pattern 8 (Component APIs):**
- False Positive: Utility modules like `status.js`
- Fix: Document as valid exception

**Pattern 9 (console.log):**
- False Positive: Database startup logs
- Fix: Warning level (not critical), manual review

---

## Maintenance

### Regular Reviews

**Monthly:**
- Review pattern effectiveness
- Check false positive rates
- Update exclusions if needed
- Add new patterns from code reviews

**Quarterly:**
- Document pattern statistics
- Update team training
- Review CI integration
- Archive obsolete patterns

---

### Pattern Statistics

Track pattern effectiveness:

```bash
# Run on entire codebase
./scripts/check-code-patterns.sh . > pattern-report.txt

# Count findings per pattern
grep "⚠️" pattern-report.txt | wc -l
grep "❌" pattern-report.txt | wc -l
```

**Goal Metrics:**
- False positive rate: < 10%
- Code review mentions of patterns: Decreasing over time
- Pattern violations in PRs: < 5 per week

---

## Related Documentation

- **COMPONENT_PATTERNS.md**: Component factory patterns (Pattern 8)
- **LOGGING_USAGE.md**: Winston logger usage (Pattern 9)
- **Issue #272**: Extend code pattern checks
- **PR #250**: Original pattern checker implementation

---

## Questions?

For questions or suggestions about pattern checks:
1. Review this document and examples
2. Test pattern locally with `./scripts/check-code-patterns.sh`
3. Check existing patterns for similar examples
4. Discuss in code review if adding new pattern

**Remember**: Patterns should help, not hinder. If a pattern has > 10% false positives, refine or remove it.

---

**Document Version**: 1.0
**Last Updated**: 2025-11-13
**Maintained by**: Development Team
