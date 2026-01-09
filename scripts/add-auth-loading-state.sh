#!/bin/bash
# Script to add auth loading state to all authenticated pages
#
# This script finds JS files that use initSession + requireSuperuser/requireAdmin
# and reports which ones need updating.
#
# Usage: ./scripts/add-auth-loading-state.sh [--check | --update]
#   --check: Just report which files need updating (default)
#   --update: Automatically update files (with backup)

set -e

PORTAL_DIR="apps/members-portal"

echo "=== Auth Loading State Update Script ==="
echo ""

# Find all JS files that import initSession
echo "Scanning for files that use initSession..."
echo ""

# Files that have initSession but NOT showAuthenticatedContent
NEEDS_UPDATE=()

while IFS= read -r file; do
    # Check if file has requireSuperuser or requireAdmin
    if grep -q "requireSuperuser\|requireAdmin" "$file"; then
        # Check if file already has showAuthenticatedContent
        if ! grep -q "showAuthenticatedContent" "$file"; then
            NEEDS_UPDATE+=("$file")
        fi
    fi
done < <(grep -l "initSession" "$PORTAL_DIR"/**/*.js 2>/dev/null || true)

echo "=== Files that need updating ==="
echo ""

if [ ${#NEEDS_UPDATE[@]} -eq 0 ]; then
    echo "All files are up to date!"
    exit 0
fi

for file in "${NEEDS_UPDATE[@]}"; do
    echo "  - $file"
done

echo ""
echo "Total: ${#NEEDS_UPDATE[@]} file(s) need updating"
echo ""

# If --update flag, show instructions
if [ "$1" == "--update" ]; then
    echo "=== Update Instructions ==="
    echo ""
    echo "For each file above, you need to:"
    echo ""
    echo "1. Change import from:"
    echo "   import { initSession } from '../../session/init.js';"
    echo "   to:"
    echo "   import { initSession, showAuthenticatedContent } from '../../session/init.js';"
    echo ""
    echo "2. Add after 'await requireSuperuser();' or 'await requireAdmin();':"
    echo "   showAuthenticatedContent();"
    echo ""
    echo "Example:"
    echo "   await initSession();"
    echo "   await requireSuperuser();"
    echo "   showAuthenticatedContent();  // <-- Add this line"
    echo ""
else
    echo "Run with --update for instructions on how to fix these files."
fi
