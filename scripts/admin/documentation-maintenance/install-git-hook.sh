#!/bin/bash
# Install post-commit hook for documentation reminders
# Usage: ./install-git-hook.sh

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
HOOK_SOURCE="$REPO_ROOT/scripts/admin/documentation-maintenance/post-commit-reminder.sh"
HOOK_TARGET="$REPO_ROOT/.git/hooks/post-commit"

echo "📝 Installing documentation reminder git hook..."
echo ""

# Check if hook source exists
if [[ ! -f "$HOOK_SOURCE" ]]; then
    echo "❌ Error: Hook source not found at $HOOK_SOURCE"
    exit 1
fi

# Make hook executable
chmod +x "$HOOK_SOURCE"

# Create symlink
if [[ -e "$HOOK_TARGET" ]]; then
    echo "⚠️  Warning: $HOOK_TARGET already exists"
    echo "   Current target: $(readlink "$HOOK_TARGET" 2>/dev/null || echo "Not a symlink")"
    read -p "   Replace it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Aborted"
        exit 1
    fi
    rm "$HOOK_TARGET"
fi

ln -s "$HOOK_SOURCE" "$HOOK_TARGET"

echo "✅ Git hook installed successfully!"
echo ""
echo "The hook will show a reminder after commits that might need doc updates."
echo ""
echo "To test: Make a commit with 'feat:' prefix and see the reminder."
echo "To uninstall: rm $HOOK_TARGET"
echo ""
