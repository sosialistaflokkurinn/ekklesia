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

echo -e "${BLUE}🔍 Checking code patterns in: ${SEARCH_PATH}${NC}"
echo ""

FOUND_ISSUES=0
WARNINGS=0

# Pattern 1: Wrong createBadge API usage
echo -e "${BLUE}1️⃣  Checking createBadge API usage...${NC}"
if grep -rn "createBadge({" "$SEARCH_PATH" 2>/dev/null | grep -v node_modules; then
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
if grep -rn "\.setDisabled(" "$SEARCH_PATH" 2>/dev/null | grep -v node_modules; then
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
DEV_MARKERS=$(grep -rn "// NEW:\|// TODO:\|// FIXME:\|// HACK:\|// XXX:" "$SEARCH_PATH" 2>/dev/null | grep -v node_modules | grep -v "check-code-patterns.sh" || true)
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
if grep -rn -E "(0000000000|9999999999|XXXXXXXXXX)" "$SEARCH_PATH" 2>/dev/null | grep -v node_modules | grep -i "kennitala\|example\|@param\|@returns" | head -5; then
  echo -e "   ${YELLOW}⚠️  Found unrealistic kennitala examples${NC}"
  echo -e "   ${YELLOW}💡 Use realistic DDMMYY format: 010300-9999 (Jan 3, 2000)${NC}"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "   ${GREEN}✅ No unrealistic kennitala examples in docs${NC}"
fi
echo ""

# Pattern 5: Async event listeners (warning only - need manual review)
echo -e "${BLUE}5️⃣  Checking async event listeners for error handling...${NC}"
ASYNC_LISTENERS=$(grep -rn "addEventListener.*async.*=>" "$SEARCH_PATH" 2>/dev/null | grep -v node_modules | head -10 || true)
if [ -n "$ASYNC_LISTENERS" ]; then
  echo "$ASYNC_LISTENERS"
  echo -e "   ${YELLOW}⚠️  Found async event listeners${NC}"
  echo -e "   ${YELLOW}💡 Verify each has try-catch error handling${NC}"
  echo -e "   ${YELLOW}   Example:${NC}"
  echo -e "   ${YELLOW}   button.addEventListener('click', async () => {${NC}"
  echo -e "   ${YELLOW}     try { await doSomething(); }${NC}"
  echo -e "   ${YELLOW}     catch (error) { handleError(error); }${NC}"
  echo -e "   ${YELLOW}   });${NC}"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "   ${GREEN}✅ No async event listeners found (or all are safe)${NC}"
fi
echo ""

# Pattern 6: Missing callback parameters (advanced check)
echo -e "${BLUE}6️⃣  Checking for potentially missing callback parameters...${NC}"
# This is a heuristic check - looks for common callback names used in code
# but not defined in nearby function signatures
CALLBACKS_USED=$(grep -rn "onSuccess\|onError\|onSubmit\|callback" "$SEARCH_PATH" 2>/dev/null | grep -v "function\|@param\|\/\/" | grep -v node_modules | head -5 || true)
if [ -n "$CALLBACKS_USED" ]; then
  echo -e "   ${YELLOW}⚠️  Found callback references - verify they're in function params${NC}"
  echo -e "   ${YELLOW}💡 If used, ensure declared in function signature${NC}"
  WARNINGS=$((WARNINGS + 1))
else
  echo -e "   ${GREEN}✅ No obvious missing callback parameters${NC}"
fi
echo ""

# Pattern 7: innerHTML usage (XSS risk)
echo -e "${BLUE}7️⃣  Checking for innerHTML usage (XSS risk)...${NC}"
INNERHTML_USAGE=$(grep -rn "\.innerHTML\s*=" "$SEARCH_PATH" 2>/dev/null | grep -v node_modules | grep -v "innerHTML = ''" | head -5 || true)
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
