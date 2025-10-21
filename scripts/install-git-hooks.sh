#!/bin/bash

################################################################################
# Install Git Hooks for Ekklesia Project
#
# This script installs git hooks that prevent common mistakes:
# - Prevents committing .gitignore (local-only file)
# - Prevents committing AUTOMATION.md files (local-only docs)
# - Prevents duplicate scripts in root (should be in scripts/)
# - Prevents political identity mistakes (wrong party names)
# - Warns about potential security issues
#
# Usage:
#   ./scripts/install-git-hooks.sh
#
# Author: Ekklesia Project
# Date: 2025-10-14
################################################################################

set -e

HOOKS_DIR=".git/hooks"
PRE_COMMIT="$HOOKS_DIR/pre-commit"
COMMIT_MSG="$HOOKS_DIR/commit-msg"

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

# Backup existing hooks if they exist
if [ -f "$PRE_COMMIT" ]; then
    BACKUP="${PRE_COMMIT}.backup.$(date +%Y%m%d_%H%M%S)"
    echo "⚠️  Existing pre-commit hook found"
    echo "   Backing up to: ${BACKUP}"
    cp "$PRE_COMMIT" "$BACKUP"
fi

if [ -f "$COMMIT_MSG" ]; then
    BACKUP="${COMMIT_MSG}.backup.$(date +%Y%m%d_%H%M%S)"
    echo "⚠️  Existing commit-msg hook found"
    echo "   Backing up to: ${BACKUP}"
    cp "$COMMIT_MSG" "$BACKUP"
fi

# Create pre-commit hook
echo "📝 Creating pre-commit hook..."

cat > "$PRE_COMMIT" << 'HOOK_EOF'
#!/bin/bash

# Ekklesia Pre-Commit Hook
# Prevents committing files that should stay local-only
# Prevents political identity mistakes

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

# Check for political identity mistakes in staged content
echo "🏴 Checking political identity in staged files..."

# Note: Commit message is checked separately by commit-msg hook

# Check staged file content for wrong party names (only in user-facing files)
STAGED_FILES=$(git diff --cached --name-only | grep -E '\.(md|html|txt|js)$' | grep -v 'node_modules' | grep -v 'archive/')

if [ -n "$STAGED_FILES" ]; then
    for file in $STAGED_FILES; do
        if [ -f "$file" ]; then
            # Check for "Social Democratic" (wrong party)
            if git diff --cached "$file" | grep -E '^\+.*Social Democratic' > /dev/null; then
                echo "❌ BLOCKED: File '$file' contains 'Social Democratic'"
                echo "   This refers to Samfylkingin, NOT Sósíalistaflokkurinn"
                echo "   Use 'Socialist Party' instead"
                BLOCKED=1
            fi

            # Check for "Samfylkingin" (wrong party)
            if git diff --cached "$file" | grep -E '^\+.*Samfylkingin' > /dev/null; then
                echo "❌ BLOCKED: File '$file' mentions 'Samfylkingin'"
                echo "   This is a different political party"
                echo "   Use 'Sósíalistaflokkurinn' for SÍ"
                BLOCKED=1
            fi

            # Warn about "Samstaða" (ambiguous, needs review)
            if git diff --cached "$file" | grep -E '^\+.*Samstaða' > /dev/null; then
                echo "⚠️  WARNING: File '$file' contains 'Samstaða'"
                echo "   This is ambiguous and should usually be 'Sósíalistaflokkurinn'"
                echo "   Only OK if referring to solidarity concept, not party name"
                echo ""
                read -p "   Is this referring to the party? (yes/no): " response
                if [ "$response" = "yes" ]; then
                    echo "   ❌ Use 'Sósíalistaflokkurinn' instead"
                    BLOCKED=1
                fi
            fi
        fi
    done
fi

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
STAGED_FILES_ALL=$(git diff --cached --name-only)
if echo "$STAGED_FILES_ALL" | grep -qE "\.(env|key|pem|p12|pfx|credentials)$"; then
    echo "⚠️  WARNING: Potential secrets detected!"
    echo "   Files matched: $(echo "$STAGED_FILES_ALL" | grep -E "\.(env|key|pem|p12|pfx|credentials)$" | tr '\n' ' ')"
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

# Create commit-msg hook
echo "📝 Creating commit-msg hook..."

cat > "$COMMIT_MSG" << 'HOOK_EOF'
#!/bin/bash

# Ekklesia Commit Message Hook
# Prevents political identity mistakes in commit messages

COMMIT_MSG_FILE="$1"
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")

echo "🏴 Checking commit message for political identity..."

# Check for wrong party names in commit message
if echo "$COMMIT_MSG" | grep -iE "(Social Democratic|Samfylkingin|Samstaða|Krattaflokkur)" > /dev/null; then
    echo ""
    echo "❌ BLOCKED: Commit message contains incorrect party reference"
    echo ""
    echo "   Found: $(echo "$COMMIT_MSG" | grep -iEo "(Social Democratic|Samfylkingin|Samstaða|Krattaflokkur)" | head -1)"
    echo ""
    echo "   ⚠️  POLITICAL IDENTITY ERROR:"
    echo "   This project is for: Sósíalistaflokkur Íslands (Socialist Party)"
    echo "   NOT for: Samfylkingin (Social Democratic Alliance)"
    echo ""
    echo "   ✅ Use instead:"
    echo "      - Sósíalistaflokkur Íslands"
    echo "      - Socialist Party"
    echo "      - SÍ"
    echo ""
    echo "   📄 See: archive/docs/docs-2025-10-13/docs/PROJECT_IDENTITY.md"
    echo ""
    echo "   To edit your commit message, use: git commit --amend"
    echo ""
    exit 1
fi

echo "✅ Commit message political identity check passed"
exit 0
HOOK_EOF

# Make hook executable
chmod +x "$COMMIT_MSG"

echo "✅ Commit-msg hook installed successfully"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Hook Features"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✓ Prevents committing .gitignore (local-only)"
echo "✓ Prevents committing AUTOMATION.md files"
echo "✓ Prevents duplicate scripts in root directory"
echo "✓ Prevents political identity mistakes (wrong party names)"
echo "✓ Warns about potential secrets (*.env, *.key, etc.)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Testing"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "To test file protection:"
echo "  git add -f .gitignore"
echo "  git commit -m \"test\""
echo "  Expected: Hook should BLOCK the commit ✓"
echo ""
echo "To test political identity check:"
echo "  echo '# Test' > docs/test.md"
echo "  git add docs/test.md"
echo "  git commit -m \"docs: add Social Democratic info\""
echo "  Expected: Hook should BLOCK the commit ✓"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

exit 0
