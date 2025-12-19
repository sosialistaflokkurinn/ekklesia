#!/bin/bash
#
# Master Documentation Validation Script
#
# Runs all documentation validation checks in logical order.
# This is a READ-ONLY script - it does not modify any files.
#
# Usage:
#   ./validate-all.sh
#   ./validate-all.sh --verbose
#
# Exit codes:
#   0 - All validations passed
#   1 - One or more validations failed
#   2 - Script error
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Verbose mode
VERBOSE=false
if [[ "$1" == "--verbose" ]]; then
    VERBOSE=true
fi

# Track failures
FAILED=0

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     📚 DOCUMENTATION VALIDATION SUITE                          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Repository: $REPO_ROOT"
echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Change to repository root
cd "$REPO_ROOT"

#######################################################################
# 1. Validate DOCUMENTATION_MAP.md
#######################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 1: Validating DOCUMENTATION_MAP.md${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if python3 "$SCRIPT_DIR/validate_documentation_map.py"; then
    echo -e "${GREEN}✅ DOCUMENTATION_MAP.md validation passed${NC}"
else
    echo -e "${RED}❌ DOCUMENTATION_MAP.md validation failed${NC}"
    FAILED=1
fi

echo ""

#######################################################################
# 2. Validate markdown links
#######################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 2: Validating markdown links${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if python3 "$SCRIPT_DIR/validate_links.py"; then
    echo -e "${GREEN}✅ Link validation passed${NC}"
else
    echo -e "${RED}❌ Link validation failed${NC}"
    FAILED=1
fi

echo ""

#######################################################################
# Summary
#######################################################################

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     📊 VALIDATION SUMMARY                                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ ALL VALIDATIONS PASSED${NC}"
    echo ""
    echo "Your documentation is in good shape!"
    echo ""
    exit 0
else
    echo -e "${RED}❌ SOME VALIDATIONS FAILED${NC}"
    echo ""
    echo "Please review the errors above and fix the issues."
    echo ""
    echo "Common fixes:"
    echo "  - Update broken links to point to correct files"
    echo "  - Remove references to archived/deleted files"
    echo "  - Add missing files to DOCUMENTATION_MAP.md"
    echo ""
    exit 1
fi
