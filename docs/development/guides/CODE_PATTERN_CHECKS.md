# Code Pattern Checks

Automated detection of common code quality issues based on GitHub Copilot review findings.

## Overview

The `scripts/check-code-patterns.sh` script performs static analysis to detect patterns that have been flagged by automated code reviews (GitHub Copilot, GitHub Advanced Security, etc.).

## What It Checks

### 🚨 Critical Issues (Exit Code 1)

1. **Wrong createBadge API Usage**
   ```javascript
   // ❌ Wrong:
   const badge = createBadge({text: 'Success', variant: 'success'});

   // ✅ Correct:
   const badge = createBadge('Success', {variant: 'success'});
   ```

2. **Wrong Button API Usage**
   ```javascript
   // ❌ Wrong:
   button.setDisabled(true);

   // ✅ Correct:
   button.disable();
   button.enable();
   ```

### ⚠️ Warnings (Non-blocking)

3. **Development Markers**
   - `// TODO:`, `// FIXME:`, `// HACK:`, `// XXX:`
   - Should be addressed or removed before merge

4. **Unrealistic Documentation Examples**
   ```javascript
   // ⚠️ Unrealistic:
   // Example: 0000000000

   // ✅ Realistic:
   // Example: 010300-9999 (Jan 3, 2000)
   ```

5. **Async Event Listeners**
   - Flags async event listeners for manual review
   - Ensures try-catch error handling is present
   ```javascript
   // ✅ Good:
   button.addEventListener('click', async () => {
     try {
       await doSomething();
     } catch (error) {
       handleError(error);
     }
   });
   ```

6. **Missing Callback Parameters**
   - Detects callback references that may not be in function signature
   - Requires manual verification

7. **innerHTML Usage (XSS Risk)**
   ```javascript
   // ⚠️ Potential XSS:
   element.innerHTML = userInput;

   // ✅ Safe:
   element.textContent = userInput;
   // or
   const li = document.createElement('li');
   li.textContent = userInput;
   element.appendChild(li);
   ```

## Usage

### Command Line

```bash
# Check default path (apps/members-portal/js/)
./scripts/check-code-patterns.sh

# Check specific path
./scripts/check-code-patterns.sh apps/members-portal/admin-elections/js/

# Check all JavaScript
./scripts/check-code-patterns.sh apps/
```

### Exit Codes

- `0`: All checks passed (or only warnings)
- `1`: Critical issues found

### Pre-commit Hook

Add to `.git/hooks/pre-commit` (optional, not enabled by default):

```bash
#!/bin/bash

echo "Running code pattern checks..."
if ! ./scripts/check-code-patterns.sh; then
  echo ""
  echo "❌ Code pattern check failed!"
  echo "Fix issues or run: git commit --no-verify"
  exit 1
fi
```

### GitHub Actions

The check runs automatically on all PRs via `.github/workflows/code-quality.yml`:

```yaml
- name: Check code patterns
  run: ./scripts/check-code-patterns.sh
```

## Adding New Patterns

To add a new pattern check:

1. Add pattern detection in `scripts/check-code-patterns.sh`
2. Decide if it's critical (exit 1) or warning (exit 0)
3. Provide helpful error message with fix suggestion
4. Document pattern here

Example:
```bash
# Pattern X: Description
echo -e "${BLUE}X️⃣  Checking for pattern X...${NC}"
if grep -rn "badPattern" "$SEARCH_PATH" 2>/dev/null; then
  echo -e "   ${RED}❌ Found bad pattern${NC}"
  echo -e "   ${YELLOW}💡 Should be: goodPattern${NC}"
  FOUND_ISSUES=$((FOUND_ISSUES + 1))
else
  echo -e "   ${GREEN}✅ No bad pattern found${NC}"
fi
```

## History

All patterns are based on real issues found in code reviews:

- **createBadge/Button API**: Found in PR #250 Copilot Review #2, #3 (Issues #263, #266)
- **Development markers**: Found in PR #250 Copilot Review #1 (Issue #262)
- **Kennitala examples**: Found in PR #250 Copilot Review #1 (Issue #261)
- **Async error handling**: Found in PR #250 Copilot Review #2 (Issue #264)
- **Missing callbacks**: Found in PR #250 Copilot Review #3 (Issue #267)
- **innerHTML XSS**: Found in PR #250 GitHub Advanced Security (Issue #258)

## Related

- [AI Assistant Setup](./AI_ASSISTANT_SETUP.md) - GitHub Copilot setup
- [GitHub Workflows](../../operations/GITHUB_WORKFLOWS_STATUS.md) - CI/CD and security scanning
- [Git Hooks](../../../git-hooks/README.md) - Pre-commit hooks
