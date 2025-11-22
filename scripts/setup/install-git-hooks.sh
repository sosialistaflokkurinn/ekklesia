#!/bin/bash
# Install Git hooks for Ekklesia repository
# Run this after cloning or pulling hook updates

set -e

echo "🔧 Installing Ekklesia Git Hooks..."
echo ""

HOOKS_DIR="git-hooks"
GIT_HOOKS_DIR=".git/hooks"

# Check if we're in a git repository
if [ ! -d ".git" ]; then
  echo "❌ Error: Not in a git repository"
  echo "   Run this script from the repository root"
  exit 1
fi

# Check if hooks directory exists
if [ ! -d "$HOOKS_DIR" ]; then
  echo "❌ Error: $HOOKS_DIR directory not found"
  echo "   Are you in the repository root?"
  exit 1
fi

# Install pre-commit hook
if [ -f "$HOOKS_DIR/pre-commit" ]; then
  echo "📋 Installing pre-commit hook..."
  cp "$HOOKS_DIR/pre-commit" "$GIT_HOOKS_DIR/pre-commit"
  chmod +x "$GIT_HOOKS_DIR/pre-commit"
  echo "   ✅ pre-commit hook installed"
else
  echo "   ⚠️ pre-commit hook not found in $HOOKS_DIR"
fi

echo ""
echo "✅ Git hooks installation complete!"
echo ""
echo "Installed hooks:"
ls -la "$GIT_HOOKS_DIR" | grep -E "(pre-commit|commit-msg|pre-push)" || echo "  (none found)"
echo ""
echo "To test the pre-commit hook:"
echo "  .git/hooks/pre-commit"
echo ""
echo "To bypass hooks (emergency only):"
echo "  git commit --no-verify"
echo ""
echo "For more information:"
echo "  cat git-hooks/README.md"
