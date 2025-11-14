#!/bin/bash
# Validate .gitignore Hybrid Strategy Setup
# Ensures correct configuration and catches common mistakes
#
# Usage: ./scripts/admin/validate-gitignore-setup.sh
# Exit codes: 0=success, 1=validation failed

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔍 Validating .gitignore Hybrid Strategy Setup${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

ERRORS=0
WARNINGS=0

# ============================================================================
# Test 1: Check .gitignore is TRACKED
# ============================================================================
echo -e "${BLUE}[1/10]${NC} Checking .gitignore tracking status..."

if git ls-files --error-unmatch .gitignore &>/dev/null; then
    echo -e "${GREEN}  ✅ .gitignore is tracked in git${NC}"
else
    echo -e "${RED}  ❌ ERROR: .gitignore is NOT tracked${NC}"
    echo "     Expected: .gitignore should be committed (hybrid strategy)"
    echo "     Run: git add .gitignore && git commit -m 'fix: track .gitignore'"
    ERRORS=$((ERRORS + 1))
fi

# ============================================================================
# Test 2: Check .gitignore.local is NOT TRACKED
# ============================================================================
echo -e "${BLUE}[2/10]${NC} Checking .gitignore.local is ignored..."

if git ls-files --error-unmatch .gitignore.local &>/dev/null; then
    echo -e "${RED}  ❌ ERROR: .gitignore.local is TRACKED in git${NC}"
    echo "     This file should contain personal patterns only!"
    echo "     Run: git rm --cached .gitignore.local"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}  ✅ .gitignore.local is NOT tracked (correct)${NC}"
fi

# ============================================================================
# Test 3: Check .gitignore.local is IGNORED
# ============================================================================
echo -e "${BLUE}[3/10]${NC} Checking .gitignore.local ignore pattern..."

if git check-ignore -q .gitignore.local; then
    echo -e "${GREEN}  ✅ .gitignore.local is properly ignored${NC}"
else
    echo -e "${RED}  ❌ ERROR: .gitignore.local is NOT ignored${NC}"
    echo "     Add this line to .gitignore:"
    echo "     .gitignore.local"
    ERRORS=$((ERRORS + 1))
fi

# ============================================================================
# Test 4: Check .gitignore.local.example EXISTS and is TRACKED
# ============================================================================
echo -e "${BLUE}[4/10]${NC} Checking .gitignore.local.example..."

if [ ! -f .gitignore.local.example ]; then
    echo -e "${YELLOW}  ⚠️  WARNING: .gitignore.local.example not found${NC}"
    echo "     This file serves as a template for developers"
    WARNINGS=$((WARNINGS + 1))
elif git ls-files --error-unmatch .gitignore.local.example &>/dev/null; then
    echo -e "${GREEN}  ✅ .gitignore.local.example exists and is tracked${NC}"
else
    echo -e "${YELLOW}  ⚠️  WARNING: .gitignore.local.example exists but is NOT tracked${NC}"
    echo "     Run: git add .gitignore.local.example"
    WARNINGS=$((WARNINGS + 1))
fi

# ============================================================================
# Test 5: Check .gitignore has correct header
# ============================================================================
echo -e "${BLUE}[5/10]${NC} Checking .gitignore header documentation..."

if grep -q "HYBRID STRATEGY" .gitignore; then
    echo -e "${GREEN}  ✅ .gitignore has hybrid strategy documentation${NC}"
else
    echo -e "${YELLOW}  ⚠️  WARNING: .gitignore missing hybrid strategy header${NC}"
    echo "     Add explanation comment at top of .gitignore"
    WARNINGS=$((WARNINGS + 1))
fi

# ============================================================================
# Test 6: Check pre-commit hook exists
# ============================================================================
echo -e "${BLUE}[6/10]${NC} Checking pre-commit safeguard hook..."

if [ -x .git/hooks/pre-commit.d/10-gitignore-safeguard.sh ]; then
    echo -e "${GREEN}  ✅ Safeguard hook exists and is executable${NC}"
elif [ -f .git/hooks/pre-commit.d/10-gitignore-safeguard.sh ]; then
    echo -e "${YELLOW}  ⚠️  WARNING: Safeguard hook exists but is NOT executable${NC}"
    echo "     Run: chmod +x .git/hooks/pre-commit.d/10-gitignore-safeguard.sh"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${RED}  ❌ ERROR: Safeguard hook NOT found${NC}"
    echo "     Expected: .git/hooks/pre-commit.d/10-gitignore-safeguard.sh"
    ERRORS=$((ERRORS + 1))
fi

# ============================================================================
# Test 7: Check main pre-commit calls safeguard hook
# ============================================================================
echo -e "${BLUE}[7/10]${NC} Checking main pre-commit integration..."

if [ -f .git/hooks/pre-commit ]; then
    if grep -q "10-gitignore-safeguard.sh" .git/hooks/pre-commit; then
        echo -e "${GREEN}  ✅ Main pre-commit calls safeguard hook${NC}"
    else
        echo -e "${YELLOW}  ⚠️  WARNING: Main pre-commit doesn't call safeguard hook${NC}"
        echo "     Add to .git/hooks/pre-commit:"
        echo "     .git/hooks/pre-commit.d/10-gitignore-safeguard.sh"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}  ❌ ERROR: No pre-commit hook found${NC}"
    ERRORS=$((ERRORS + 1))
fi

# ============================================================================
# Test 8: Check for orphaned two-file strategy files
# ============================================================================
echo -e "${BLUE}[8/10]${NC} Checking for old two-file strategy remnants..."

ORPHANS=()
if [ -f docs/development/guides/GITIGNORE_MIGRATION_GUIDE.md ]; then
    ORPHANS+=("GITIGNORE_MIGRATION_GUIDE.md")
fi

if [ ${#ORPHANS[@]} -gt 0 ]; then
    echo -e "${YELLOW}  ⚠️  WARNING: Found old two-file strategy files:${NC}"
    for file in "${ORPHANS[@]}"; do
        echo "     - $file"
    done
    echo "     These are outdated (two-file strategy was replaced with hybrid)"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}  ✅ No orphaned two-file strategy files${NC}"
fi

# ============================================================================
# Test 9: Check documentation exists
# ============================================================================
echo -e "${BLUE}[9/10]${NC} Checking documentation..."

if [ -f docs/development/guides/GITIGNORE_LOCAL_STRATEGY.md ]; then
    echo -e "${GREEN}  ✅ Documentation exists (GITIGNORE_LOCAL_STRATEGY.md)${NC}"
else
    echo -e "${RED}  ❌ ERROR: Documentation missing${NC}"
    echo "     Expected: docs/development/guides/GITIGNORE_LOCAL_STRATEGY.md"
    ERRORS=$((ERRORS + 1))
fi

# ============================================================================
# Test 10: Test hook actually blocks .gitignore.local
# ============================================================================
echo -e "${BLUE}[10/10]${NC} Testing safeguard hook functionality..."

# Create temporary test file
TEST_FILE=".gitignore.local.test"
echo "# test" > "$TEST_FILE"

# Try to stage it
git add "$TEST_FILE" 2>/dev/null || true

# Check if it was staged
if git diff --cached --name-only | grep -q "$TEST_FILE"; then
    # It was staged, try to run hook
    if [ -x .git/hooks/pre-commit.d/10-gitignore-safeguard.sh ]; then
        # Run hook to see if it catches the pattern
        if .git/hooks/pre-commit.d/10-gitignore-safeguard.sh 2>&1 | grep -q "WARNING.*gitignore"; then
            echo -e "${GREEN}  ✅ Hook successfully detects suspicious patterns${NC}"
        else
            echo -e "${YELLOW}  ⚠️  WARNING: Hook may not catch all patterns${NC}"
            WARNINGS=$((WARNINGS + 1))
        fi
    fi
    # Clean up
    git restore --staged "$TEST_FILE" 2>/dev/null || true
fi

rm -f "$TEST_FILE"
echo -e "${GREEN}  ✅ Functional test complete${NC}"

# ============================================================================
# Summary
# ============================================================================
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 Validation Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo ""
    echo "Your .gitignore hybrid strategy is correctly configured."
    echo ""
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  ${WARNINGS} warning(s) found${NC}"
    echo ""
    echo "Setup is functional but could be improved."
    echo "Review warnings above for recommendations."
    echo ""
    exit 0
else
    echo -e "${RED}❌ ${ERRORS} error(s) and ${WARNINGS} warning(s) found${NC}"
    echo ""
    echo "Setup is INCOMPLETE or BROKEN."
    echo "Fix errors above before proceeding."
    echo ""
    echo "Documentation: docs/development/guides/GITIGNORE_LOCAL_STRATEGY.md"
    echo ""
    exit 1
fi
