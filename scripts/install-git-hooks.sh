#!/bin/bash

################################################################################
# Install Git Hooks for Ekklesia Project
#
# This script installs pre-commit hooks that prevent common mistakes:
# - Prevents committing .gitignore (local-only file)
# - Prevents committing AUTOMATION.md files (local-only docs)
# - Prevents duplicate scripts in root (should be in scripts/)
# - Warns about potential security issues
#
# Usage:
#   ./scripts/install-git-hooks.sh
#
# Author: Ekklesia Project
# Date: 2025-10-12
################################################################################

set -e

HOOKS_DIR=".git/hooks"
PRE_COMMIT="$HOOKS_DIR/pre-commit"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Ekklesia Git Hooks Installation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Error: Not in a git repository"
    echo "   Run this from the project root: ./scripts/install-git-hooks.sh"
    exit 1
fi

echo "📁 Hooks directory: $HOOKS_DIR"

# Backup existing pre-commit hook if it exists
if [ -f "$PRE_COMMIT" ]; then
    BACKUP="${PRE_COMMIT}.backup.$(date +%Y%m%d_%H%M%S)"
    echo "⚠️  Existing pre-commit hook found"
    echo "   Backing up to: ${BACKUP}"
    cp "$PRE_COMMIT" "$BACKUP"
fi

# Create pre-commit hook
echo "📝 Creating pre-commit hook..."

cat > "$PRE_COMMIT" << 'HOOK_EOF'
#!/bin/bash

# Ekklesia Pre-Commit Hook
# Prevents committing files that should stay local-only

echo "🔍 Running Ekklesia pre-commit checks..."

# Files that should NEVER be committed
FORBIDDEN_FILES=(
    ".gitignore"
    "docs/security/CLOUDFLARE_AUTOMATION.md"
    "cloudflare-dns.sh"
)

# Check if any forbidden files are staged
BLOCKED=0
for file in "${FORBIDDEN_FILES[@]}"; do
    if git diff --cached --name-only | grep -q "^${file}$"; then
        echo "❌ BLOCKED: Attempting to commit '${file}'"
        echo "   This file should stay local-only!"
        echo "   See .claude/rules.md line 9-10 for details"
        BLOCKED=1
    fi
done

# Check for duplicate scripts in root
if git diff --cached --name-only | grep -E "^[^/]+\.sh$" | grep -v "^scripts/"; then
    echo "❌ BLOCKED: Shell scripts should be in scripts/ directory"
    echo "   Move to scripts/ or add to .gitignore"
    BLOCKED=1
fi

# Check for automation docs
if git diff --cached --name-only | grep -i "AUTOMATION\.md$"; then
    echo "⚠️  WARNING: AUTOMATION.md files are usually local-only"
    echo "   Are you sure this should be committed?"
    echo "   See .claude/rules.md line 10"
    echo ""
    read -p "Continue anyway? (yes/no): " response
    if [ "$response" != "yes" ]; then
        BLOCKED=1
    fi
fi

# Check for potential secrets
STAGED_FILES=$(git diff --cached --name-only)
if echo "$STAGED_FILES" | grep -qE "\.(env|key|pem|p12|pfx|credentials)$"; then
    echo "⚠️  WARNING: Potential secrets detected!"
    echo "   Files matched: $(echo "$STAGED_FILES" | grep -E "\.(env|key|pem|p12|pfx|credentials)$" | tr '\n' ' ')"
    echo ""
    read -p "Are you SURE you want to commit these? (yes/no): " response
    if [ "$response" != "yes" ]; then
        BLOCKED=1
    fi
fi

if [ $BLOCKED -eq 1 ]; then
    echo ""
    echo "❌ Commit BLOCKED by pre-commit hook"
    echo "   Fix the issues above and try again"
    echo ""
    echo "To untrack a file: git rm --cached <file>"
    echo "To bypass hook (NOT RECOMMENDED): git commit --no-verify"
    exit 1
fi

echo "✅ Pre-commit checks passed"
exit 0
HOOK_EOF

# Make hook executable
chmod +x "$PRE_COMMIT"

echo "✅ Pre-commit hook installed successfully"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Hook Features"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✓ Prevents committing .gitignore (local-only)"
echo "✓ Prevents committing AUTOMATION.md files"
echo "✓ Prevents duplicate scripts in root directory"
echo "✓ Warns about potential secrets (*.env, *.key, etc.)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Testing"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "To test the hook, try:"
echo "  git add -f .gitignore"
echo "  git commit -m \"test\""
echo ""
echo "Expected: Hook should BLOCK the commit ✓"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

exit 0
