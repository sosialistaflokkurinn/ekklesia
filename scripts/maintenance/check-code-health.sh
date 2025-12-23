#!/bin/bash
#
# Code Health Check Script
# Finds common issues like missing imports, unused dependencies, etc.
#
# Usage: ./scripts/check-code-health.sh [--fix]
#

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

FIX_MODE=false
if [[ "$1" == "--fix" ]]; then
  FIX_MODE=true
fi

ISSUES_FOUND=0

echo -e "${BLUE}🔍 Ekklesia Code Health Check${NC}"
echo "========================================"
echo ""

# Optimization: Cache file lists to avoid repeated disk scans
echo -e "${BLUE}📂 Indexing files...${NC}"
# Find JS files excluding node_modules
JS_FILES=$(find apps/members-portal -name "*.js" -type f -not -path "*/node_modules/*")
# Find HTML files excluding node_modules
HTML_FILES=$(find apps/members-portal -name "*.html" -type f -not -path "*/node_modules/*")

# Check 1: Missing initNavigation() calls
echo -e "${BLUE}📱 Checking for pages with navigation but no initNavigation()...${NC}"
MISSING_NAV_INIT=0

# Use cached HTML files list
for htmlfile in $HTML_FILES; do
  # Check if file has nav element
  if grep -q '<nav class="nav">' "$htmlfile"; then
    # Extract script src from HTML file (look for type="module")
    module_script=$(grep -oP 'type="module" src="\K[^"]+' "$htmlfile" | head -1)
    
    if [[ -z "$module_script" ]]; then
      # Try alternative: src="..." type="module"
      module_script=$(grep -oP 'src="\K[^"]+(?="[^>]*type="module")' "$htmlfile" | head -1)
    fi
    
    if [[ -n "$module_script" ]]; then
      # Resolve relative path
      html_dir=$(dirname "$htmlfile")
      jsfile="$html_dir/$module_script"
      
      if [[ -f "$jsfile" ]]; then
        # Check if JS file imports and calls initNavigation
        if ! grep -q "initNavigation" "$jsfile"; then
          echo -e "  ${YELLOW}⚠️  Missing initNavigation():${NC}"
          echo "      HTML: $htmlfile"
          echo "      JS:   $jsfile"
          ((MISSING_NAV_INIT++)) || true
          ((ISSUES_FOUND++)) || true
        fi
      fi
    fi
  fi
done

if [[ $MISSING_NAV_INIT -eq 0 ]]; then
  echo -e "  ${GREEN}✅ All pages with navigation have initNavigation()${NC}"
fi
echo ""

# Check 2: Missing debug imports
echo -e "${BLUE}🐛 Checking for debug usage without import...${NC}"
MISSING_DEBUG=0

for jsfile in $JS_FILES; do
  # Check if file uses debug but doesn't import it
  if grep -q "debug\.\(log\|warn\|error\|info\)" "$jsfile"; then
    if ! grep -q "import.*debug.*from" "$jsfile"; then
      echo -e "  ${YELLOW}⚠️  Uses debug without import:${NC} $jsfile"
      ((MISSING_DEBUG++)) || true
      ((ISSUES_FOUND++)) || true
    fi
  fi
done

if [[ $MISSING_DEBUG -eq 0 ]]; then
  echo -e "  ${GREEN}✅ All files using debug have proper import${NC}"
fi
echo ""

# Check 3: Missing showToast imports
echo -e "${BLUE}💬 Checking for showToast usage without import...${NC}"
MISSING_TOAST=0

for jsfile in $JS_FILES; do
  # Check if file uses showToast but doesn't import it
  # Skip files that only use window.showToast (runtime check for global)
  # Skip files that define their own local showToast function
  if grep -q "showToast(" "$jsfile"; then
    if ! grep -q "import.*showToast.*from" "$jsfile"; then
      # Allow window.showToast pattern (runtime fallback check)
      if ! grep -q "window\.showToast" "$jsfile"; then
        # Allow local function definition
        if ! grep -q "function showToast" "$jsfile"; then
          echo -e "  ${YELLOW}⚠️  Uses showToast without import:${NC} $jsfile"
          ((MISSING_TOAST++)) || true
          ((ISSUES_FOUND++)) || true
        fi
      fi
    fi
  fi
done

if [[ $MISSING_TOAST -eq 0 ]]; then
  echo -e "  ${GREEN}✅ All files using showToast have proper import${NC}"
fi
echo ""

# Check 4: Console.log left in code (should use debug)
echo -e "${BLUE}🚫 Checking for console.log (should use debug instead)...${NC}"
CONSOLE_LOGS=0

for jsfile in $JS_FILES; do
  # Exclude debug utilities
  if [[ "$jsfile" == *"debug.js"* ]] || [[ "$jsfile" == *"debug-logger.js"* ]]; then
    continue
  fi
  
  # Check for console.log (skip comments and JSDoc examples)
  if grep -n "console\.log(" "$jsfile" | grep -v "// console.log" | grep -v ":\s*\*"; then
    echo -e "  ${YELLOW}⚠️  Found console.log (use debug.log):${NC} $jsfile"
    ((CONSOLE_LOGS++)) || true
    ((ISSUES_FOUND++)) || true
  fi
done

if [[ $CONSOLE_LOGS -eq 0 ]]; then
  echo -e "  ${GREEN}✅ No console.log found (good!)${NC}"
fi
echo ""

# Check 5: Missing R.string imports in i18n files
echo -e "${BLUE}🌐 Checking for R.string usage without import...${NC}"
MISSING_I18N=0

for jsfile in $JS_FILES; do
  # Check if file uses R.string but doesn't import R
  # Skip files that check for R's existence (using R as global)
  if grep -q "R\.string\." "$jsfile"; then
    if ! grep -q "import.*R.*from.*i18n" "$jsfile"; then
      # Allow files that check if R exists (using global R)
      if ! grep -q "!R\s*||\|!R\.string\|typeof R" "$jsfile"; then
        echo -e "  ${YELLOW}⚠️  Uses R.string without import:${NC} $jsfile"
        ((MISSING_I18N++)) || true
        ((ISSUES_FOUND++)) || true
      fi
    fi
  fi
done

if [[ $MISSING_I18N -eq 0 ]]; then
  echo -e "  ${GREEN}✅ All files using R.string have proper import${NC}"
fi
echo ""

# Check 6: Duplicate event listeners (memory leaks)
echo -e "${BLUE}🔁 Checking for potential duplicate event listeners...${NC}"
DUPLICATE_LISTENERS=0

for jsfile in $JS_FILES; do
  # Check if file has addEventListener but no removeEventListener
  if grep -q "addEventListener(" "$jsfile"; then
    # Count addEventListener vs removeEventListener
    add_count=$(grep -c "addEventListener(" "$jsfile" || true)
    remove_count=$(grep -c "removeEventListener(" "$jsfile" || true)
    
    if [[ $add_count -gt 0 ]] && [[ $remove_count -eq 0 ]]; then
      # Check if it's a one-time init or module that cleans up
      if ! grep -q "// Module cleanup not needed\|// One-time init\|// Cleanup in" "$jsfile"; then
        echo -e "  ${YELLOW}⚠️  addEventListener without cleanup:${NC} $jsfile"
        echo -e "      ${add_count} addEventListener, ${remove_count} removeEventListener"
        ((DUPLICATE_LISTENERS++)) || true
        # Not counting as critical issue, just warning
      fi
    fi
  fi
done

if [[ $DUPLICATE_LISTENERS -eq 0 ]]; then
  echo -e "  ${GREEN}✅ Event listeners look clean${NC}"
fi
echo ""

# Check 7: Missing error handling in async functions
echo -e "${BLUE}⚠️  Checking for async functions without try-catch...${NC}"
MISSING_TRY_CATCH=0

for jsfile in $JS_FILES; do
  # Find async functions
  async_funcs=$(grep -n "async function\|async (" "$jsfile" | wc -l || true)
  
  if [[ $async_funcs -gt 0 ]]; then
    # Count try-catch blocks
    try_catch=$(grep -c "try {" "$jsfile" || true)
    
    # If many async functions but no try-catch, might be issue
    if [[ $async_funcs -gt 2 ]] && [[ $try_catch -eq 0 ]]; then
      echo -e "  ${YELLOW}⚠️  ${async_funcs} async functions, no try-catch:${NC} $jsfile"
      ((MISSING_TRY_CATCH++)) || true
      # Not counting as critical issue
    fi
  fi
done

if [[ $MISSING_TRY_CATCH -eq 0 ]]; then
  echo -e "  ${GREEN}✅ Async error handling looks good${NC}"
fi
echo ""

# Check 8: Hardcoded URLs (should use constants)
echo -e "${BLUE}🔗 Checking for hardcoded API URLs...${NC}"
HARDCODED_URLS=0

for jsfile in $JS_FILES; do
  # Look for https:// in fetch/axios calls
  if grep -n "fetch.*https://\|axios.*https://" "$jsfile" | grep -v "gstatic\|googleapis\|firebasejs"; then
    echo -e "  ${YELLOW}⚠️  Hardcoded URL found:${NC} $jsfile"
    ((HARDCODED_URLS++)) || true
    # Not counting as critical issue
  fi
done

if [[ $HARDCODED_URLS -eq 0 ]]; then
  echo -e "  ${GREEN}✅ No hardcoded URLs found${NC}"
fi
echo ""

# Check 9: TODOs in code
echo -e "${BLUE}📝 Checking for TODO comments...${NC}"
TODO_COUNT=0

for jsfile in $JS_FILES; do
  todos=$(grep -n "// TODO\|// FIXME\|// HACK" "$jsfile" || true)
  if [[ -n "$todos" ]]; then
    echo -e "  ${BLUE}ℹ️  TODOs found:${NC} $jsfile"
    echo "$todos" | head -3 | sed 's/^/      /'
    ((TODO_COUNT++)) || true
  fi
done

if [[ $TODO_COUNT -eq 0 ]]; then
  echo -e "  ${GREEN}✅ No TODOs found${NC}"
else
  echo -e "  ${BLUE}ℹ️  ${TODO_COUNT} files with TODOs (not an issue, just FYI)${NC}"
fi
echo ""

# Summary
echo "========================================"
if [[ $ISSUES_FOUND -eq 0 ]]; then
  echo -e "${GREEN}✅ No critical issues found! Code health looks good.${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠️  Found ${ISSUES_FOUND} issues that need attention.${NC}"
  echo ""
  echo "Run with --fix flag to attempt automatic fixes (not implemented yet)"
  exit 1
fi
