#!/bin/bash
# =============================================================================
# Install Git hooks for Ekklesia repository
# =============================================================================
# Run: ./git-hooks/install-hooks.sh
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${GREEN}${BOLD}🔧 Installing Ekklesia Git Hooks${NC}"
echo ""

HOOKS_DIR="git-hooks"
GIT_HOOKS_DIR=".git/hooks"

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ Error: Not in a git repository${NC}"
    echo "   Run this script from the repository root"
    exit 1
fi

# Check if hooks directory exists
if [ ! -d "$HOOKS_DIR" ]; then
    echo -e "${RED}❌ Error: $HOOKS_DIR directory not found${NC}"
    exit 1
fi

# List of hooks to install
HOOKS=("pre-commit" "commit-msg" "pre-push")

for hook in "${HOOKS[@]}"; do
    if [ -f "$HOOKS_DIR/$hook" ]; then
        echo -e "📋 Installing ${BOLD}$hook${NC} hook..."
        cp "$HOOKS_DIR/$hook" "$GIT_HOOKS_DIR/$hook"
        chmod +x "$GIT_HOOKS_DIR/$hook"
        echo -e "   ${GREEN}✅ $hook installed${NC}"
    else
        echo -e "   ${YELLOW}⚠️  $hook not found in $HOOKS_DIR${NC}"
    fi
done

echo ""
echo -e "${GREEN}${BOLD}✅ Git hooks installation complete!${NC}"
echo ""
echo "Installed hooks:"
ls -la "$GIT_HOOKS_DIR" | grep -E "pre-commit|commit-msg|pre-push" | awk '{print "  " $NF}'
echo ""
echo -e "${BOLD}Hvað gera hooks:${NC}"
echo "  • pre-commit  : Athugar secrets, PII, i18n"
echo "  • commit-msg  : Athugar commit message format"
echo "  • pre-push    : HINDRAR push á main, athugar stærð"
echo ""
echo -e "${YELLOW}${BOLD}MIKILVÆGT:${NC} pre-push hindrar push á main!"
echo "  Notaðu feature branches og PR."
echo ""
echo "Sjá: .github/CONTRIBUTING.md"
echo ""
