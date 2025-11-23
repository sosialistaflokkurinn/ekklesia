````markdown
# Code Health Checking Guide

Detailed instructions for code health checker scripts.

## 📋 Quick Reference

```bash
# Basic check
python3 scripts/maintenance/check-code-health.py

# Detailed output (shows all INFO items)
python3 scripts/maintenance/check-code-health.py --verbose

# Run bash version (faster but less thorough)
./scripts/maintenance/check-code-health.sh
```

## 🎯 What Gets Checked

### 1. Missing initNavigation() ⚠️

**Problem**: Page with navigation menu but initNavigation() not called.

**Example:**
```html
<!-- HTML has navigation -->
<nav class="nav">...</nav>
```

```javascript
// ❌ JS doesn't initialize nav
async function init() {
  await loadData();
}
```

**Fix:**
```javascript
// ✅ Add import and call
import { initNavigation } from './js/nav.js';

async function init() {
  initNavigation();  // Add this!
  await loadData();
}
```

---

### 2. Missing Imports ❌ (CRITICAL)

**Problem**: Usage without import - code won't run.

**Common Issues:**

#### R.string without import
```javascript
// ❌ Won't work
const title = R.string.page_title;

// ✅ Fix
import { R } from './i18n/strings-loader.js';
const title = R.string.page_title;
```

#### debug without import
```javascript
// ❌ Won't work
debug.log('Hello');

// ✅ Fix
import { debug } from './utils/debug.js';
debug.log('Hello');
```

#### showToast without import
```javascript
// ❌ Won't work
showToast('Saved!', 'success');

// ✅ Fix
import { showToast } from './components/toast.js';
showToast('Saved!', 'success');
```

---

### 3. console.log Usage ⚠️

**Problem**: Using console.log instead of debug system.

**Why it matters**:
- debug.log can be disabled in production
- Structured logging with categories
- Better filtering and searching
- Consistent across codebase

**Fix:**
```javascript
// ❌ Bad
console.log('User logged in:', user);
console.warn('API slow:', duration);
console.error('Failed:', error);

// ✅ Good
import { debug } from './utils/debug.js';
debug.log('User logged in:', user);
debug.warn('API slow:', duration);
debug.error('Failed:', error);
```

**Exception**: OK in example code or comments:
```javascript
/**
 * Example:
 *   onChange: (value) => console.log('Selected:', value)  // OK in docs
 */
```

---

### 4. Hardcoded URLs ℹ️

**Problem**: API URLs hardcoded in fetch calls.

**Fix:**
```javascript
// ❌ Hardcoded
const response = await fetch('https://elections-service-521240388393.europe-west2.run.app/api/elections');

// ✅ Use constant
const ELECTIONS_API_BASE = 'https://elections-service-521240388393.europe-west2.run.app';
const response = await fetch(`${ELECTIONS_API_BASE}/api/elections`);

// ✅ Even better: centralized config
import { API_ENDPOINTS } from './config/api.js';
const response = await fetch(`${API_ENDPOINTS.ELECTIONS}/api/elections`);
```

---

### 5. Error Handling ℹ️

**Problem**: Async functions without try-catch.

**Fix:**
```javascript
// ❌ No error handling
async function loadData() {
  const response = await fetch('/api/data');
  const data = await response.json();
  return data;
}

// ✅ With error handling
async function loadData() {
  try {
    const response = await fetch('/api/data');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data;
  } catch (error) {
    debug.error('Failed to load data:', error);
    showToast('Villa við að hlaða gögnum', 'error');
    throw error;  // Re-throw if caller needs to handle
  }
}
```

---

### 6. Memory Leaks ℹ️

**Problem**: addEventListener without removeEventListener.

**When it matters**:
- SPA pages that get recreated
- Dynamic components
- Repeated initialization

**Not a problem**:
- One-time page init
- Static pages
- Module-level code

**Fix:**
```javascript
// ❌ Potential leak (if called multiple times)
function setupListeners() {
  document.getElementById('btn').addEventListener('click', handleClick);
}

// ✅ Option 1: Remove before adding
function setupListeners() {
  const btn = document.getElementById('btn');
  btn.removeEventListener('click', handleClick);  // Clean up old
  btn.addEventListener('click', handleClick);      // Add new
}

// ✅ Option 2: Add comment if OK
function setupListeners() {
  // Module cleanup not needed - one-time page init
  document.getElementById('btn').addEventListener('click', handleClick);
}

// ✅ Option 3: AbortController (modern approach)
const controller = new AbortController();
document.getElementById('btn').addEventListener('click', handleClick, {
  signal: controller.signal
});
// Later: controller.abort(); // Removes all listeners
```

---

## 🔧 Bulk Fixing

### Find all files with specific issue

```bash
# All files with R.string but no import
python3 scripts/check-code-health.py 2>&1 | grep "R.string" | cut -d: -f1 | sort -u

# All files with console.log
python3 scripts/check-code-health.py 2>&1 | grep "console.log" | cut -d: -f1 | sort -u
```

### Fix pattern across multiple files

```bash
# Add R.string import to all policy-session files (example)
for file in apps/members-portal/policy-session/js/*.js; do
  if grep -q "R\.string" "$file" && ! grep -q "import.*R.*from.*i18n" "$file"; then
    # Add import after first import statement
    sed -i "1 a import { R } from '../../i18n/strings-loader.js';" "$file"
    echo "Fixed: $file"
  fi
done
```

⚠️ **Warning**: Always review changes before committing!

---

## 📊 Current Status (2025-11-17)

**Run results:**
```
Found 14 errors, 24 warnings, 31 info
```

**Top issues:**
1. ❌ 14 missing imports (mostly R.string in policy-session)
2. ⚠️  24 console.log in admin-elections
3. ⚠️  2 pages missing initNavigation()

**Priority fixes:**
1. Fix missing imports (breaks code)
2. Add initNavigation() to admin-elections pages
3. Replace console.log with debug.log (code cleanup)

---

## 🔄 Integration

### Git Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running code health check..."
python3 scripts/check-code-health.py

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Code health check failed!"
  echo "Fix errors or use 'git commit --no-verify' to skip"
  exit 1
fi
```

### GitHub Actions CI

```yaml
# .github/workflows/code-health.yml
name: Code Health Check

on:
  push:
    branches: [ main, develop, feature/* ]
  pull_request:
    branches: [ main, develop ]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.x'
      
      - name: Run code health check
        run: python3 scripts/check-code-health.py
```

### VS Code Task

```json
// .vscode/tasks.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Code Health Check",
      "type": "shell",
      "command": "python3 scripts/check-code-health.py",
      "group": {
        "kind": "test",
        "isDefault": true
      },
      "presentation": {
        "reveal": "always",
        "panel": "new"
      }
    }
  ]
}
```

Then run with: `Ctrl+Shift+B` → "Code Health Check"

---

## 🎓 Teaching Tool

This script is also a teaching tool! It shows developers:

1. **Best practices** - What patterns to use
2. **Common mistakes** - What to avoid
3. **Code consistency** - How the codebase should look
4. **Import patterns** - How modules connect

**For new developers:**
```bash
# See all patterns in use
python3 scripts/check-code-health.py --verbose > code-review.txt

# Review with mentor
less code-review.txt
```

---

## 💡 Tips & Tricks

### Check only specific area

```bash
# Modify script temporarily or use grep
python3 scripts/check-code-health.py 2>&1 | grep "admin-elections"
```

### Export results for tracking

```bash
# Create issue tracking file
python3 scripts/check-code-health.py > /tmp/code-health-$(date +%Y-%m-%d).txt

# Compare with previous run
diff /tmp/code-health-2025-11-10.txt /tmp/code-health-2025-11-17.txt
```

### Focus on errors only

```bash
python3 scripts/check-code-health.py 2>&1 | grep "❌"
```

### Count issues by type

```bash
python3 scripts/check-code-health.py 2>&1 | grep -oP '(R\.string|debug|showToast|console\.log)' | sort | uniq -c
```

---

## 🚀 Future Enhancements

Potential additions:

1. **Auto-fix mode** - `--fix` flag to automatically fix common issues
2. **Severity levels** - Configure what's error vs warning
3. **Ignore patterns** - `.healthcheckignore` file
4. **Custom rules** - Project-specific checks
5. **Performance metrics** - Track improvement over time
6. **IDE integration** - Real-time checking in editor

---

## 📝 Related

- [check-code-patterns.sh](./check-code-patterns.sh) - Pattern checking
- [CODE_STANDARDS_MAP.md](../docs/CODE_STANDARDS_MAP.md) - Code standards
- [DEVELOPMENT_MAP.md](../docs/DEVELOPMENT_MAP.md) - Dev guide

---

**Last Updated:** 2025-11-17  
**Maintained by:** Development Team
