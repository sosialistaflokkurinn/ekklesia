````markdown
# Code Health Checking Guide

Detailed instructions for code health checker scripts.

## 📋 Quick Reference

```bash
# Basic check
python3 scripts/maintenance/check_code_health.py

# Detailed output (shows all INFO items)
python3 scripts/maintenance/check_code_health.py --verbose

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
python3 scripts/check_code_health.py 2>&1 | grep "R.string" | cut -d: -f1 | sort -u

# All files with console.log
python3 scripts/check_code_health.py 2>&1 | grep "console.log" | cut -d: -f1 | sort -u
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
python3 scripts/check_code_health.py

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
        run: python3 scripts/check_code_health.py
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
      "command": "python3 scripts/check_code_health.py",
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
python3 scripts/check_code_health.py --verbose > code-review.txt

# Review with mentor
less code-review.txt
```

---

## 💡 Tips & Tricks

### Check only specific area

```bash
# Modify script temporarily or use grep
python3 scripts/check_code_health.py 2>&1 | grep "admin-elections"
```

### Export results for tracking

```bash
# Create issue tracking file
python3 scripts/check_code_health.py > /tmp/code-health-$(date +%Y-%m-%d).txt

# Compare with previous run
diff /tmp/code-health-2025-11-10.txt /tmp/code-health-2025-11-17.txt
```

### Focus on errors only

```bash
python3 scripts/check_code_health.py 2>&1 | grep "❌"
```

### Count issues by type

```bash
python3 scripts/check_code_health.py 2>&1 | grep -oP '(R\.string|debug|showToast|console\.log)' | sort | uniq -c
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

---

## 📊 Metadata Analysis Scripts

Scripts for analyzing codebase metadata and generating inventory files.

### Available Scripts

#### 1. CSS Metadata Analysis
```bash
python3 scripts/maintenance/analyze_css_metadata.py
```
**Output:** `.metadata_store/css_inventory.json`

**Analyzes:**
- BEM methodology usage
- CSS custom properties
- Hardcoded colors/spacing
- File dependencies

#### 2. HTML Metadata Analysis
```bash
python3 scripts/maintenance/analyze_html_metadata.py
```
**Output:** `.metadata_store/html_inventory.json`

**Analyzes:**
- Page structure
- Script/style dependencies
- i18n usage
- Navigation patterns

#### 3. JavaScript Metadata Analysis
```bash
python3 scripts/maintenance/analyze_js_metadata.py
```
**Output:** `.metadata_store/js_inventory.json`

**Analyzes:**
- Import/export patterns
- Function definitions
- API calls
- Complexity metrics

#### 4. Python Metadata Analysis
```bash
python3 scripts/maintenance/analyze_py_metadata.py
```
**Output:** `.metadata_store/py_inventory.json`

**Analyzes:**
- Import statements
- Function/class definitions
- Type hints
- Docstrings

#### 5. Markdown Metadata Analysis ⭐ NEW
```bash
python3 scripts/maintenance/analyze_md_metadata.py
```
**Output:** `.metadata_store/md_inventory.json`

**Analyzes:**
- Heading structure (h1-h6)
- Code blocks and inline code
- Links (internal vs external)
- TODOs (checked vs unchecked)
- Lists, tables, images
- File size and line count

#### 6. Markdown Insights Analysis
```bash
python3 scripts/maintenance/analyze_md_insights.py
```
**Output:** Console report with insights

**Provides:**
- Documentation quality metrics
- TODO completion rates
- Size distribution analysis
- Structure quality assessment
- Actionable recommendations

### Usage Examples

#### Run all metadata analyzers
```bash
cd /home/gudro/Development/projects/ekklesia
python3 scripts/maintenance/analyze_css_metadata.py
python3 scripts/maintenance/analyze_html_metadata.py
python3 scripts/maintenance/analyze_js_metadata.py
python3 scripts/maintenance/analyze_py_metadata.py
python3 scripts/maintenance/analyze_md_metadata.py
```

#### Query markdown metadata
```bash
# Find files without H1 heading
cat .metadata_store/md_inventory.json | \
  jq '.[] | select(.structure.has_h1 == false) | .filepath'

# Find TODO-heavy files
cat .metadata_store/md_inventory.json | \
  jq 'sort_by(-.todos.unchecked) | .[0:10] | .[] | {filepath, unchecked: .todos.unchecked}'

# Find largest markdown files
cat .metadata_store/md_inventory.json | \
  jq 'sort_by(-.stats.size_bytes) | .[0:10] | .[] | {filepath, size_kb: (.stats.size_bytes / 1024)}'
```

#### Compare metadata over time
```bash
# Create dated backup
cp .metadata_store/md_inventory.json .metadata_store/md_inventory_$(date +%Y-%m-%d).json

# Compare with previous version
diff <(jq '.[] | .filepath' .metadata_store/md_inventory_2025-11-20.json) \
     <(jq '.[] | .filepath' .metadata_store/md_inventory.json)
```

### Output Structure

All inventory files follow this pattern:
```json
[
  {
    "filepath": "relative/path/to/file",
    "filename": "file.ext",
    "category": "docs/development",
    "stats": {
      "size_bytes": 12345,
      "line_count": 456,
      "last_modified": "2025-11-24T10:11:12"
    },
    "analysis": { /* file-type specific metrics */ }
  }
]
```

### Metadata Store Location

All metadata is stored in:
```
.metadata_store/
├── css_inventory.json    (13 KB)
├── html_inventory.json   (21 KB)
├── js_inventory.json     (22 KB)
├── py_inventory.json     (23 KB)
└── md_inventory.json     (252 KB)
```

### Related Documentation

- [Markdown Insights Report](../../tmp/github-issues/MARKDOWN_INSIGHTS.md) - Full markdown analysis
- [Election Anonymization Status](../../tmp/github-issues/ELECTION_ANONYMIZATION_STATUS.md) - Security analysis
- [GitHub Issues Index](../../tmp/github-issues/ISSUES_INDEX.md) - Open issues report

---

**Last Updated:** 2025-11-24
**New Scripts:** `analyze_md_metadata.py`, `analyze_md_insights.py`

---

## 📋 Documentation Quality Strategies

Strategic documents for improving documentation quality based on markdown metadata analysis.

### 🎯 Master Implementation Plan ⭐ NEW

**Document:** [docs/standards/DOCUMENTATION_QUALITY_IMPLEMENTATION_PLAN.md](../../docs/standards/DOCUMENTATION_QUALITY_IMPLEMENTATION_PLAN.md)

**Purpose:** Comprehensive 4-week plan to implement all documentation quality strategies

**Scope:**
- Week 1: Foundation & Quick Wins (baseline, archive, mark completed)
- Week 2: TODO Consolidation (split checklists, GitHub migration)
- Week 3: Visual Documentation (diagrams, screenshots)
- Week 4: Standards & Maintenance (frontmatter, automation)

**Target Metrics:**
- TODO Health Score: 40/100 → 70+/100
- Unchecked TODOs: 1,780 → <800 (55% reduction)
- Completion Rate: 13.8% → >30%
- Files with images: 6 → 35+ (1.8% → 10%)

**Quick Start:**
```bash
# Run baseline analysis
python3 scripts/maintenance/check_todo_health.py --verbose > tmp/analysis/baseline-$(date +%Y-%m-%d).txt

# Start Week 1 work
# See implementation plan for detailed daily tasks
```

**Status:** Planning complete, ready for implementation

---

### Available Strategies

#### 1. TODO Cleanup Strategy ⭐ NEW
**Document:** [docs/standards/TODO_CLEANUP_STRATEGY.md](../../docs/standards/TODO_CLEANUP_STRATEGY.md)

**Purpose:** Systematic approach to managing 1,780 unchecked TODOs across documentation

**Key Features:**
- 4-state TODO lifecycle (Active, Completed, Archived, Deferred)
- 6 priority categories (🔴 Critical, 🟡 High, 🔵 Medium, ⚪ Low, 📝 Doc, 🧪 Test)
- 4-week implementation plan
- File-specific recommendations for top 5 worst offenders
- Tools & automation suggestions
- Success metrics tracking

**Quick Start:**
```bash
# Analyze current TODO status
cat .metadata_store/md_inventory.json | \
  jq '[.[] | select(.todos.total > 0)] |
      {total_todos: (map(.todos.total) | add),
       unchecked: (map(.todos.unchecked) | add),
       checked: (map(.todos.checked) | add),
       files: length}'

# Find TODO-heavy files (>20 TODOs)
cat .metadata_store/md_inventory.json | \
  jq '[.[] | select(.todos.total > 20)] |
      sort_by(-.todos.unchecked) |
      .[] | {filepath, unchecked: .todos.unchecked}'
```

**Implementation Tools:**
- TODO health check script (see below)
- GitHub sync script for migrating TODOs to issues
- Weekly TODO report automation

---

#### 2. Checklist Splitting Recommendations ⭐ NEW
**Document:** [docs/standards/CHECKLIST_SPLITTING_RECOMMENDATIONS.md](../../docs/standards/CHECKLIST_SPLITTING_RECOMMENDATIONS.md)

**Purpose:** Guidelines for splitting large, unwieldy checklists into manageable files

**Key Features:**
- Analysis of 34 TODO-heavy files (>20 TODOs each)
- Specific splitting strategies for top 5 files
- ✅ **COMPLETED:** ELECTION_FEATURE_CHECKLIST.md (1,441 lines → 6 focused files) - 2025-11-24
- Splitting guidelines (when to split, how to split)
- 4 splitting patterns: By phase, By concern, By team, GitHub Issues

**Top Recommendations:**
1. ~~**ELECTION_FEATURE_CHECKLIST.md** (198 TODOs)~~ ✅ **COMPLETED 2025-11-24**
   - ✅ Split into: Backend, Frontend, i18n, A11y, Testing, Deployment
   - ✅ Created OVERVIEW.md with progress tracking

2. **I18N_POST_DEPLOYMENT_TEST** (61 TODOs)
   - Archive (historical test from Nov 5)

3. **CODE_QUALITY_IMPROVEMENT_PLAN** (60 TODOs)
   - Consolidate with CODE_QUALITY_CHECKLIST
   - Split into 5 phase files

4. **EPIC_87 & EPIC_24** (103 TODOs total)
   - Migrate to GitHub Issues + Project Boards
   - Simplify markdown to overview

**Expected Impact:** 422 TODOs → ~150 in docs + ~200 in GitHub Issues

---

#### 3. Diagram Recommendations ⭐ NEW
**Document:** [docs/standards/DIAGRAM_RECOMMENDATIONS.md](../../docs/standards/DIAGRAM_RECOMMENDATIONS.md)

**Purpose:** Identify where diagrams, screenshots, and images would improve documentation

**Key Features:**
- Analysis showing only 1.8% of files have images (6/327)
- Prioritized list of 18 files needing diagrams
- Specific diagram type recommendations (sequence, architecture, ER, flow, etc.)
- Recommended tools (Mermaid.js, draw.io, Excalidraw, dbdiagram.io)
- Diagram standards and best practices
- 4-week implementation plan

**Top Priorities:**
1. **Infrastructure Diagrams** (7 files)
   - CLOUD_RUN_SERVICES.md - Architecture overview, auth flow
   - DJANGO_BACKEND_SYSTEM.md - API flow, database schema
   - FIREBASE_APP_CHECK_RESEARCH.md - Security flow

2. **Security & Compliance** (4 files)
   - VOTING_ANONYMITY_MODEL.md - Token/member flows
   - GDPR_VOTING_ANONYMITY_ANALYSIS.md - Compliance tree

3. **Component Documentation** (5 files)
   - Component README - Dependency graph
   - ELECTION_FEATURE_CHECKLIST - Workflow diagram

4. **User Journeys** (3 files)
   - Login flow screenshots
   - Voting flow screenshots

**Expected Impact:** 6 files with images → 35+ files (10%)

---

### Implementation Scripts

#### TODO Health Check Script (Planned)

**File:** `scripts/maintenance/check_todo_health.py` (to be created)

**Purpose:** Monitor TODO health across markdown files

**Features:**
```python
#!/usr/bin/env python3
"""
Check TODO health across markdown files
Reports completion rates, stale files, etc.
"""

def check_todo_health():
    # Find files with 0% completion and >20 TODOs
    # Find files not modified in 90+ days with unchecked TODOs
    # Calculate completion rates by category
    # Generate actionable recommendations
```

**Usage:**
```bash
# Run health check
python3 scripts/maintenance/check_todo_health.py

# Output:
# Stale TODO files: 25
# Old unchecked TODOs: 12
# Completion rate by category:
#   docs/development: 8.0%
#   docs/features: 6.8%
#   tmp: 31.1%
```

---

#### GitHub TODO Sync Script (Planned)

**File:** `scripts/maintenance/sync-todos-to-github.py` (to be created)

**Purpose:** Sync critical TODOs to GitHub Issues

**Features:**
```python
#!/usr/bin/env python3
"""
Sync critical TODOs (🔴 CRITICAL, 🟡 HIGH) to GitHub Issues
"""

def sync_todos_to_github():
    # Parse markdown files for priority TODOs
    # Create GitHub issues via gh CLI
    # Link back to documentation
    # Add appropriate labels
```

**Usage:**
```bash
# Sync all critical TODOs
python3 scripts/maintenance/sync-todos-to-github.py --priority critical

# Sync specific file
python3 scripts/maintenance/sync-todos-to-github.py --file docs/features/EPIC_87.md
```

---

### Quick Reference Commands

#### TODO Analysis
```bash
# Total TODO count
cat .metadata_store/md_inventory.json | \
  jq '[.[] | .todos.total] | add'

# Completion rate
cat .metadata_store/md_inventory.json | \
  jq '[.[] | .todos] |
      {total: (map(.total) | add),
       checked: (map(.checked) | add)} |
      {completion_rate: ((.checked / .total) * 100)}'

# Files with 0% completion and >20 TODOs
cat .metadata_store/md_inventory.json | \
  jq '[.[] | select(.todos.total > 20 and .todos.checked == 0)] |
      length'
```

#### Checklist Size Analysis
```bash
# Files over 500 lines
cat .metadata_store/md_inventory.json | \
  jq '[.[] | select(.stats.line_count > 500)] |
      sort_by(-.stats.line_count) |
      .[] | {filepath, lines: .stats.line_count, todos: .todos.total}'

# Largest checklists (by TODO count)
cat .metadata_store/md_inventory.json | \
  jq 'sort_by(-.todos.total) | .[0:10] |
      .[] | {filepath, todos: .todos.total, size_kb: (.stats.size_bytes / 1024 | floor)}'
```

#### Image/Diagram Analysis
```bash
# Files without images (large docs only)
cat .metadata_store/md_inventory.json | \
  jq '[.[] | select(.content.images == 0 and .stats.size_bytes > 10000)] |
      sort_by(-.stats.size_bytes) |
      .[0:20] |
      .[] | {filepath, size_kb: (.stats.size_bytes / 1024 | floor)}'

# Files that already have images
cat .metadata_store/md_inventory.json | \
  jq '[.[] | select(.content.images > 0)] |
      .[] | {filepath, images: .content.images}'
```

---

### Related Strategy Documents

- [TODO Cleanup Strategy](../../docs/standards/TODO_CLEANUP_STRATEGY.md) - Managing 1,780 unchecked TODOs
- [Checklist Splitting Recommendations](../../docs/standards/CHECKLIST_SPLITTING_RECOMMENDATIONS.md) - Breaking down large checklists
- [Diagram Recommendations](../../docs/standards/DIAGRAM_RECOMMENDATIONS.md) - Adding visual documentation
- [Markdown Insights Report](../../tmp/github-issues/MARKDOWN_INSIGHTS.md) - Full markdown analysis

---

**Documentation Quality Initiative**
**Date:** 2025-11-24
**Status:** Master implementation plan created, strategies documented, ready to begin Week 1
**Documents:**
- [DOCUMENTATION_QUALITY_IMPLEMENTATION_PLAN.md](../../docs/standards/DOCUMENTATION_QUALITY_IMPLEMENTATION_PLAN.md) - 4-week master plan
- [TODO_CLEANUP_STRATEGY.md](../../docs/standards/TODO_CLEANUP_STRATEGY.md) - TODO management strategy
- [CHECKLIST_SPLITTING_RECOMMENDATIONS.md](../../docs/standards/CHECKLIST_SPLITTING_RECOMMENDATIONS.md) - Checklist splitting guide
- [DIAGRAM_RECOMMENDATIONS.md](../../docs/standards/DIAGRAM_RECOMMENDATIONS.md) - Visual documentation plan
**Next Steps:** Begin Week 1 - Run baseline analysis, archive historical files, mark completed TODOs
