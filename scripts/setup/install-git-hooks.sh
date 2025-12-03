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

# Install pre-push hook (blocks sensitive files from being pushed)
if [ -f "$HOOKS_DIR/pre-push" ]; then
  echo "🔒 Installing pre-push hook..."
  cp "$HOOKS_DIR/pre-push" "$GIT_HOOKS_DIR/pre-push"
  chmod +x "$GIT_HOOKS_DIR/pre-push"
  echo "   ✅ pre-push hook installed"
  echo "   📄 See .git-local-only for blocked patterns"
else
  echo "   ⚠️ pre-push hook not found in $HOOKS_DIR"
fi

# Install commit-msg hook (if exists)
if [ -f "$HOOKS_DIR/commit-msg" ]; then
  echo "📝 Installing commit-msg hook..."
  cp "$HOOKS_DIR/commit-msg" "$GIT_HOOKS_DIR/commit-msg"
  chmod +x "$GIT_HOOKS_DIR/commit-msg"
  echo "   ✅ commit-msg hook installed"
fi

echo ""
echo "✅ Git hooks installation complete!"
echo ""
echo "Installed hooks:"
ls -la "$GIT_HOOKS_DIR" | grep -E "(pre-commit|commit-msg|pre-push)" || echo "  (none found)"
echo ""
echo "To test hooks:"
echo "  .git/hooks/pre-commit    # Test pre-commit"
echo "  .git/hooks/pre-push      # Test pre-push (with dummy refs)"
echo ""
echo "Strategy: 'Track All, Push Selectively'"
echo "  - All files tracked locally (AI can see everything)"
echo "  - pre-push hook blocks sensitive files (see .git-local-only)"
echo ""
echo "To bypass hooks (DANGEROUS - emergency only):"
echo "  git commit --no-verify"
echo "  git push --no-verify"
echo ""
echo "For more information:"
echo "  cat git-hooks/README.md"
echo "  cat .git-local-only"
