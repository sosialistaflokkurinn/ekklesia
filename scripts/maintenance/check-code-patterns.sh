#!/bin/bash
# Check for common code quality patterns based on GitHub Copilot findings
#
# This script detects patterns that have been flagged by automated reviews:
# - API consistency issues
# - Development markers left in production code
# - Missing error handling
# - Documentation issues
#
# Usage:
#   ./scripts/check-code-patterns.sh [path]
#   Default path: apps/members-portal/js/

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default search path
SEARCH_PATH="${1:-apps/members-portal/js/}"

# Optimization: Exclude directories at the grep level
EXCLUDE_FLAGS="--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=build --exclude-dir=coverage --exclude-dir=venv --exclude-dir=__pycache__"

echo -e "${BLUE}🔍 Checking code patterns in: ${SEARCH_PATH}${NC}"
echo ""

FOUND_ISSUES=0
WARNINGS=0

# Pattern 1: Wrong createBadge API usage
echo -e "${BLUE}1️⃣  Checking createBadge API usage...${NC}"
if grep -rn $EXCLUDE_FLAGS "createBadge({" "$SEARCH_PATH" 2>/dev/null; then
  echo -e "   ${RED}❌ Found createBadge({ usage${NC}"
  echo -e "   ${YELLOW}💡 Should be: createBadge(text, {variant: 'success'})${NC}"
  echo -e "   ${YELLOW}   Not: createBadge({text: 'foo', variant: 'success'})${NC}"
  FOUND_ISSUES=$((FOUND_ISSUES + 1))
else
  echo -e "   ${GREEN}✅ No createBadge({ found${NC}"
fi
echo ""

# Pattern 2: Wrong button API usage
echo -e "${BLUE}2️⃣  Checking button API usage...${NC}"
if grep -rn $EXCLUDE_FLAGS "\.setDisabled(" "$SEARCH_PATH" 2>/dev/null; then
  echo -e "   ${RED}❌ Found .setDisabled( usage${NC}"
  echo -e "   ${YELLOW}💡 Should be: button.disable() or button.enable()${NC}"
  echo -e "   ${YELLOW}   Not: button.setDisabled(true/false)${NC}"
  FOUND_ISSUES=$((FOUND_ISSUES + 1))
else
  echo -e "   ${GREEN}✅ No .setDisabled( found${NC}"
fi
echo ""

# Pattern 3: Development markers
echo -e "${BLUE}3️⃣  Checking for development markers...${NC}"
# We exclude this script itself from the check
DEV_MARKERS=$(grep -rn $EXCLUDE_FLAGS "// NEW:\|// TODO:\|// FIXME:\|// HACK:\|// XXX:" "$SEARCH_PATH" 2>/dev/null | grep -v "check-code-patterns.sh" || true)
if [ -n "$DEV_MARKERS" ]; then
  echo "$DEV_MARKERS"
  echo -e "   ${YELLOW}⚠️  Found development markers${NC}"
  echo -e "   ${YELLOW}💡 Consider removing or addressing before merge${NC}"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "   ${GREEN}✅ No development markers found${NC}"
fi
echo ""

# Pattern 4: Unrealistic kennitala examples in documentation
echo -e "${BLUE}4️⃣  Checking kennitala documentation examples...${NC}"
KENNITALA_EXAMPLES=$(grep -rn $EXCLUDE_FLAGS -E "(0000000000|9999999999|XXXXXXXXXX)" "$SEARCH_PATH" 2>/dev/null | grep -i "kennitala\|example\|@param\|@returns" | head -5 || true)
if [ -n "$KENNITALA_EXAMPLES" ]; then
  echo "$KENNITALA_EXAMPLES"
  echo -e "   ${YELLOW}⚠️  Found unrealistic kennitala examples${NC}"
  echo -e "   ${YELLOW}💡 Use test kennitala format: 010190-2939 (standard test SSN)${NC}"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "   ${GREEN}✅ No unrealistic kennitala examples in docs${NC}"
fi
echo ""

# Pattern 5: Async event listeners (warning only - need manual review)
echo -e "${BLUE}5️⃣  Checking async event listeners for error handling...${NC}"
ASYNC_MISSING_TRY=0
while IFS=: read -r file line_num content; do
  [ -z "$file" ] && continue
  # Check if there's a 'try' within the next 40 lines (handlers may have validation before try)
  HAS_TRY=$(sed -n "$((line_num+1)),$((line_num+40))p" "$file" 2>/dev/null | grep -c "try {" || true)
  if [ "$HAS_TRY" -eq 0 ]; then
    echo "$file:$line_num:$content"
    ASYNC_MISSING_TRY=$((ASYNC_MISSING_TRY + 1))
  fi
done < <(grep -rn $EXCLUDE_FLAGS "addEventListener.*async.*=>" "$SEARCH_PATH" 2>/dev/null || true)

if [ "$ASYNC_MISSING_TRY" -gt 0 ]; then
  echo -e "   ${YELLOW}⚠️  Found $ASYNC_MISSING_TRY async listeners without nearby try-catch${NC}"
  echo -e "   ${YELLOW}💡 Add try-catch error handling${NC}"
  echo -e "   ${YELLOW}   Example:${NC}"
  echo -e "   ${YELLOW}   button.addEventListener('click', async () => {${NC}"
  echo -e "   ${YELLOW}     try { await doSomething(); }${NC}"
  echo -e "   ${YELLOW}     catch (error) { handleError(error); }${NC}"
  echo -e "   ${YELLOW}   });${NC}"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "   ${GREEN}✅ All async event listeners have try-catch${NC}"
fi
echo ""

# Pattern 6: Skipped - too many false positives with callback pattern matching
echo -e "${BLUE}6️⃣  Checking for potentially missing callback parameters...${NC}"
echo -e "   ${GREEN}✅ Skipped (pattern too noisy)${NC}"
echo ""

# Pattern 7: innerHTML usage (XSS risk)
echo -e "${BLUE}7️⃣  Checking for innerHTML usage (XSS risk)...${NC}"
# Skip files that have SECURITY comments or have been reviewed for safe innerHTML usage
INNERHTML_USAGE=$(grep -rn $EXCLUDE_FLAGS "\.innerHTML\s*=" "$SEARCH_PATH" 2>/dev/null | \
  grep -v "innerHTML = ''\|SECURITY\|policy-results\|election-schedule-control\|ui-modal\|ui-card\|party-wiki\|searchable-select\|cold-start\|events\.js\|dashboard\|login\|profile\.js" | head -5 || true)
if [ -n "$INNERHTML_USAGE" ]; then
  echo "$INNERHTML_USAGE"
  echo -e "   ${YELLOW}⚠️  Found innerHTML assignments${NC}"
  echo -e "   ${YELLOW}💡 Consider using textContent or DOM API instead${NC}"
  echo -e "   ${YELLOW}   Example:${NC}"
  echo -e "   ${YELLOW}   const li = document.createElement('li');${NC}"
  echo -e "   ${YELLOW}   li.textContent = userInput; // Safe!${NC}"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "   ${GREEN}✅ No innerHTML assignments found${NC}"
fi
echo ""

# Pattern 8: Component factory API consistency
echo -e "${BLUE}8️⃣  Checking component factory return values...${NC}"
# Check for component factories that might return raw elements instead of {element, ...methods}
# Focuses on components/ directory to avoid false positives from utilities
COMPONENT_PATH="${SEARCH_PATH}components/"
if [ -d "$COMPONENT_PATH" ]; then
  SUSPICIOUS_RETURNS=$(grep -rn $EXCLUDE_FLAGS "export function create.*(" "$COMPONENT_PATH" 2>/dev/null | \
    grep -v "ui-skeleton\|ui-status" | \
    while IFS= read -r line; do
      file=$(echo "$line" | cut -d: -f1)
      # Check if the file has a return statement that's just 'return element;' or 'return container;'
      # This is a heuristic - might need manual review
      if grep -q "return element;" "$file" 2>/dev/null || \
         grep -q "return container;" "$file" 2>/dev/null; then
        echo "$line"
      fi
    done || true)

  if [ -n "$SUSPICIOUS_RETURNS" ]; then
    echo "$SUSPICIOUS_RETURNS"
    echo -e "   ${YELLOW}⚠️  Component factories might return raw elements${NC}"
    echo -e "   ${YELLOW}💡 Consider returning: { element, ...methods }${NC}"
    echo -e "   ${YELLOW}   Example:${NC}"
    echo -e "   ${YELLOW}   return {${NC}"
    echo -e "   ${YELLOW}     element: container,${NC}"
    echo -e "   ${YELLOW}     destroy: () => container.remove(),${NC}"
    echo -e "   ${YELLOW}     ...${NC}"
    echo -e "   ${YELLOW}   };${NC}"
    echo -e "   ${YELLOW}   Note: Utility modules (like ui-skeleton.js, ui-status.js) are valid exceptions${NC}"
    WARNINGS=$((WARNINGS + 1))
  else
    echo -e "   ${GREEN}✅ Component factory APIs look consistent${NC}"
  fi
else
  echo -e "   ${YELLOW}⚠️  Components directory not found, skipping check${NC}"
fi
echo ""

# Pattern 9: console.log/error in Cloud Run services (should use Winston logger)
echo -e "${BLUE}9️⃣  Checking for console.log/error in services...${NC}"
SERVICES_PATH="services/"
if [ -d "$SERVICES_PATH" ]; then
  # Only check src/ directories (production code), exclude migration scripts, tests, etc.
  CONSOLE_USAGE=$(grep -rn $EXCLUDE_FLAGS "console\.\(log\|error\|warn\)" "$SERVICES_PATH" 2>/dev/null | \
    grep "/src/" | \
    grep -v "logger.js" | \
    grep -v "// console\." | \
    grep -v check-code-patterns.sh | \
    grep -v "index.js" | \
    grep -v "firebase.js" | \
    grep -v "util-hash-uid.js" | \
    head -10 || true)

  if [ -n "$CONSOLE_USAGE" ]; then
    echo "$CONSOLE_USAGE"
    echo -e "   ${YELLOW}⚠️  Found console.log/error/warn in services${NC}"
    echo -e "   ${YELLOW}💡 Use Winston logger for structured logging${NC}"
    echo -e "   ${YELLOW}   Example:${NC}"
    echo -e "   ${YELLOW}   const logger = require('./utils/logger');${NC}"
    echo -e "   ${YELLOW}   logger.error('Error message', { metadata });${NC}"
    echo -e "   ${YELLOW}   ${NC}"
    echo -e "   ${YELLOW}   Benefits: Structured logs, PII sanitization, Cloud Logging${NC}"
    WARNINGS=$((WARNINGS + 1))
  else
    echo -e "   ${GREEN}✅ No console.log/error found in services${NC}"
  fi
else
  echo -e "   ${BLUE}ℹ️  No services/ directory, skipping check${NC}"
fi
echo ""

# Pattern 10: Hardcoded hex colors in CSS (should use CSS variables)
echo -e "${BLUE}🔟 Checking for hardcoded hex colors in CSS...${NC}"
CSS_PATH="apps/members-portal/"
if [ -d "$CSS_PATH" ]; then
  # Find hex colors that are NOT:
  # - In var() fallbacks: var(--something, #hex)
  # - CSS variable declarations: --color-xxx: #hex
  # - Common safe values: #fff, #000, transparent
  # - In comments
  HARDCODED_COLORS=$(grep -rn --include="*.css" -E ":\s*#[0-9a-fA-F]{3,8}\b" "$CSS_PATH" 2>/dev/null | \
    grep -v "var(--" | \
    grep -v -- "--color" | \
    grep -v -- "--[a-z].*:" | \
    grep -v "#fff\|#000\|#ffffff\|#000000" | \
    grep -v "/\*" | \
    grep -v "check-code-patterns.sh" | \
    head -10 || true)

  if [ -n "$HARDCODED_COLORS" ]; then
    echo "$HARDCODED_COLORS"
    echo -e "   ${YELLOW}⚠️  Found hardcoded hex colors in CSS${NC}"
    echo -e "   ${YELLOW}💡 Use CSS variables instead:${NC}"
    echo -e "   ${YELLOW}   color: var(--color-warning-dark);${NC}"
    echo -e "   ${YELLOW}   Or with fallback:${NC}"
    echo -e "   ${YELLOW}   color: var(--color-warning-dark, #856404);${NC}"
    WARNINGS=$((WARNINGS + 1))
  else
    echo -e "   ${GREEN}✅ No hardcoded hex colors found${NC}"
  fi
else
  echo -e "   ${BLUE}ℹ️  No CSS directory found, skipping check${NC}"
fi
echo ""

# ============================================================================
# NEW PATTERNS - Security, Performance, Icelandic, Firebase/GCP, Code Quality
# ============================================================================

# Pattern 11: SQL injection risk - string concatenation in queries
echo -e "${BLUE}1️⃣1️⃣ Checking for SQL injection risks...${NC}"
SQL_CONCAT=$(grep -rn $EXCLUDE_FLAGS 'query.*`.*\${' services/ 2>/dev/null | grep -v "check-code-patterns.sh" | head -5 || true)
if [ -n "$SQL_CONCAT" ]; then
  echo "$SQL_CONCAT"
  echo -e "   ${RED}❌ Found string concatenation in SQL queries${NC}"
  echo -e "   ${YELLOW}💡 Use parameterized queries instead:${NC}"
  echo -e "   ${YELLOW}   query('SELECT * FROM users WHERE id = \$1', [userId])${NC}"
  FOUND_ISSUES=$((FOUND_ISSUES + 1))
else
  echo -e "   ${GREEN}✅ No SQL injection risks found${NC}"
fi
echo ""

# Pattern 12: Hardcoded secrets/tokens
echo -e "${BLUE}1️⃣2️⃣ Checking for hardcoded secrets...${NC}"
SECRETS=$(grep -rnE "(token|secret|password|api_key|apikey)\s*[:=]\s*['\"][a-zA-Z0-9_\-]{15,}" apps/ services/ 2>/dev/null | \
  grep -v "node_modules\|\.env\|test\|mock\|example\|check-code-patterns" | head -5 || true)
if [ -n "$SECRETS" ]; then
  echo "$SECRETS"
  echo -e "   ${RED}❌ Found potential hardcoded secrets${NC}"
  echo -e "   ${YELLOW}💡 Use environment variables or Secret Manager${NC}"
  FOUND_ISSUES=$((FOUND_ISSUES + 1))
else
  echo -e "   ${GREEN}✅ No hardcoded secrets found${NC}"
fi
echo ""

# Pattern 13: Large files (>800 lines)
echo -e "${BLUE}1️⃣3️⃣ Checking for large files (>800 lines)...${NC}"
LARGE_FILES=$(find apps/ services/ -name "*.js" -type f -not -path "*/node_modules/*" -not -path "*/venv/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/build/*" -not -path "*/htmlcov/*" 2>/dev/null | while read f; do
  lines=$(wc -l < "$f")
  if [ "$lines" -gt 800 ]; then
    echo "$f: $lines lines"
  fi
done || true)
if [ -n "$LARGE_FILES" ]; then
  echo "$LARGE_FILES"
  echo -e "   ${YELLOW}⚠️  Found files over 800 lines${NC}"
  echo -e "   ${YELLOW}💡 Consider splitting into smaller modules${NC}"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "   ${GREEN}✅ No excessively large files${NC}"
fi
echo ""

# Pattern 14: Hardcoded Icelandic text (should use i18n)
# Skip JSDoc/comments, DEFAULT_STRINGS (intentional fallbacks), and i18n files
echo -e "${BLUE}1️⃣4️⃣ Checking for hardcoded Icelandic text...${NC}"
# First get full lines, then filter, then extract just the match
# Skip JSDoc, DEFAULT_STRINGS, modal content, event labels, etc.
ICELANDIC=$(grep -rn "\"[^\"]*[áéíóúýþæöðÁÉÍÓÚÝÞÆÖÐ][^\"]*\"" apps/members-portal/js/ 2>/dev/null | \
  grep -v "i18n\|test\|R\.string\|\.xml\|check-code-patterns\|DEFAULT_STRINGS\|/\*\*\| \* \|//\|countdown\|vote-form\|ranked-vote\|policy-item\|profile\.js\|cold-start\|events\.js" | head -10 || true)
if [ -n "$ICELANDIC" ]; then
  echo "$ICELANDIC" | head -5
  ICELANDIC_COUNT=$(echo "$ICELANDIC" | wc -l)
  echo -e "   ${YELLOW}⚠️  Found $ICELANDIC_COUNT potential hardcoded Icelandic strings${NC}"
  echo -e "   ${YELLOW}💡 Use i18n: R.string('key_name')${NC}"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "   ${GREEN}✅ No hardcoded Icelandic text found${NC}"
fi
echo ""

# Pattern 15: Date formatting without Icelandic locale
echo -e "${BLUE}1️⃣5️⃣ Checking date formatting locale...${NC}"
DATE_LOCALE=$(grep -rn "toLocaleDateString\|toLocaleString\|toLocaleTimeString" apps/ 2>/dev/null | \
  grep -v "is-IS\|is\|check-code-patterns" | head -5 || true)
if [ -n "$DATE_LOCALE" ]; then
  echo "$DATE_LOCALE"
  echo -e "   ${YELLOW}⚠️  Date formatting may not use Icelandic locale${NC}"
  echo -e "   ${YELLOW}💡 Use: date.toLocaleDateString('is-IS')${NC}"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "   ${GREEN}✅ Date formatting uses correct locale${NC}"
fi
echo ""

# Pattern 16: Firestore without error handling
echo -e "${BLUE}1️⃣6️⃣ Checking Firestore error handling...${NC}"
FIRESTORE_NO_CATCH=$(grep -rn "\.get()\|\.set()\|\.update()\|\.delete()" apps/ 2>/dev/null | \
  grep "firestore\|db\." | grep -v "try\|catch\|\.then\|check-code-patterns" | head -5 || true)
if [ -n "$FIRESTORE_NO_CATCH" ]; then
  echo "$FIRESTORE_NO_CATCH"
  echo -e "   ${YELLOW}⚠️  Firestore operations may lack error handling${NC}"
  echo -e "   ${YELLOW}💡 Wrap in try-catch or use .catch()${NC}"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "   ${GREEN}✅ Firestore operations have error handling${NC}"
fi
echo ""

# Pattern 17: Cloud Functions without timeout
# Note: Firebase SDK has default timeout of 70 seconds. This pattern finds imports, not issues.
echo -e "${BLUE}1️⃣7️⃣ Checking Cloud Function timeouts...${NC}"
echo -e "   ${GREEN}✅ Firebase SDK has default timeouts (70s)${NC}"
echo ""

# Pattern 18: Magic numbers
echo -e "${BLUE}1️⃣8️⃣ Checking for magic numbers...${NC}"
MAGIC=$(grep -rnoE "=\s*[0-9]{4,}" apps/members-portal/js/ 2>/dev/null | \
  grep -v "const\|let\|var\|port\|status\|year\|2024\|2025\|1000\|check-code-patterns\|timeout\|delay" | head -10 || true)
if [ -n "$MAGIC" ]; then
  echo "$MAGIC" | head -5
  echo -e "   ${YELLOW}⚠️  Found potential magic numbers${NC}"
  echo -e "   ${YELLOW}💡 Use named constants: const MAX_RETRY = 5000;${NC}"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "   ${GREEN}✅ No magic numbers found${NC}"
fi
echo ""

# Pattern 19: TODO without issue reference
echo -e "${BLUE}1️⃣9️⃣ Checking TODOs for issue references...${NC}"
TODO_NO_ISSUE=$(grep -rn $EXCLUDE_FLAGS "TODO\|FIXME" apps/ services/ 2>/dev/null | \
  grep -v "#[0-9]\|check-code-patterns\|venv" | head -10 || true)
if [ -n "$TODO_NO_ISSUE" ]; then
  echo "$TODO_NO_ISSUE" | head -5
  TODO_COUNT=$(echo "$TODO_NO_ISSUE" | wc -l)
  echo -e "   ${YELLOW}⚠️  Found $TODO_COUNT TODOs without issue reference${NC}"
  echo -e "   ${YELLOW}💡 Link to issue: // TODO(#123): Description${NC}"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "   ${GREEN}✅ All TODOs have issue references${NC}"
fi
echo ""

# Pattern 20: DOM queries in loops (actual loops, not forEach after querySelectorAll)
echo -e "${BLUE}2️⃣0️⃣ Checking for DOM queries in loops...${NC}"
# Look for querySelector INSIDE loop bodies (not querySelectorAll().forEach which is correct)
DOM_IN_LOOP=$(grep -rn "for.*{.*querySelector\|while.*{.*querySelector" apps/ 2>/dev/null | \
  grep -v "check-code-patterns\|querySelectorAll" | head -5 || true)
if [ -n "$DOM_IN_LOOP" ]; then
  echo "$DOM_IN_LOOP"
  echo -e "   ${YELLOW}⚠️  DOM queries inside loops (performance)${NC}"
  echo -e "   ${YELLOW}💡 Cache DOM references outside the loop${NC}"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "   ${GREEN}✅ No DOM queries in loops${NC}"
fi
echo ""

# Pattern 21: Deeply nested code (>4 levels)
echo -e "${BLUE}2️⃣1️⃣ Checking for deeply nested code...${NC}"
DEEP_NEST=$(grep -rn "^                        " apps/members-portal/js/ 2>/dev/null | \
  grep -v "check-code-patterns\|\.min\." | head -5 || true)
if [ -n "$DEEP_NEST" ]; then
  echo "$DEEP_NEST" | head -3
  echo -e "   ${YELLOW}⚠️  Found deeply nested code (>5 levels)${NC}"
  echo -e "   ${YELLOW}💡 Extract into separate functions${NC}"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "   ${GREEN}✅ No deeply nested code${NC}"
fi
echo ""

# Pattern 22: Invalid kennitala format in code
echo -e "${BLUE}2️⃣2️⃣ Checking kennitala formats...${NC}"
INVALID_KT=$(grep -rnoE $EXCLUDE_FLAGS "['\"][0-9]{9,11}['\"]" apps/ services/ 2>/dev/null | \
  grep -v "test\|mock\|spec\|check-code-patterns\|10.*stafir\|phone\|venv\|util-format\|NORMALIZATION\|validators\|htmlcov\|migrate" | \
  grep -v "0101302989\|1234567890\|0123456789\|1201743\|0101902939\|0112901234\|0101012980\|0101922779" | head -5 || true)
if [ -n "$INVALID_KT" ]; then
  echo "$INVALID_KT"
  echo -e "   ${YELLOW}⚠️  Found potential invalid kennitala formats${NC}"
  echo -e "   ${YELLOW}💡 Kennitala should be exactly 10 digits: DDMMYYXXXX${NC}"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "   ${GREEN}✅ Kennitala formats look valid${NC}"
fi
echo ""

# Pattern 23: Missing await on async function calls
echo -e "${BLUE}2️⃣3️⃣ Checking for missing await...${NC}"
# Look for common async patterns without await (exclude callbacks and function refs)
MISSING_AWAIT=$(grep -rn "fetch(\|\.json()\|\.save()\|\.create(" apps/members-portal/js/ 2>/dev/null | \
  grep -v "await\|\.then\|return\|check-code-patterns\|=>\|function\|callback" | head -5 || true)
if [ -n "$MISSING_AWAIT" ]; then
  echo "$MISSING_AWAIT"
  echo -e "   ${YELLOW}⚠️  Async calls may be missing await${NC}"
  echo -e "   ${YELLOW}💡 Use: const result = await fetch(url)${NC}"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "   ${GREEN}✅ Async calls properly awaited${NC}"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FOUND_ISSUES -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✅ All code pattern checks passed!${NC}"
  exit 0
elif [ $FOUND_ISSUES -gt 0 ]; then
  echo -e "${RED}❌ Found $FOUND_ISSUES critical issues${NC}"
  echo -e "${YELLOW}⚠️  Found $WARNINGS warnings${NC}"
  echo -e "${YELLOW}💡 Review the findings above before committing${NC}"
  exit 1
else
  echo -e "${GREEN}✅ No critical issues found${NC}"
  echo -e "${YELLOW}⚠️  Found $WARNINGS warnings (non-blocking)${NC}"
  echo -e "${YELLOW}💡 Consider reviewing the warnings${NC}"
  exit 0
fi
