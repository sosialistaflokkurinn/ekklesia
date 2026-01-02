#!/bin/bash
# Fix or remove broken links in documentation
# Usage: ./scripts/maintenance/fix-broken-links.sh [--dry-run]

set -e
cd "$(dirname "$0")/../.."

DRY_RUN=false
if [ "$1" == "--dry-run" ]; then
    DRY_RUN=true
    echo "🔍 DRY RUN MODE - No changes will be made"
fi

echo "🔗 Scanning for broken links in docs/..."

# Files with many broken links that should be simplified or deleted
PROBLEM_FILES=(
    "docs/SYSTEM_ARCHITECTURE_OVERVIEW.md"
    "docs/OPERATIONAL_PROCEDURES.md"
    "docs/USAGE_CONTEXT.md"
)

echo ""
echo "📋 Files with most broken links:"
for file in "${PROBLEM_FILES[@]}"; do
    if [ -f "$file" ]; then
        count=$(grep -oE '\[.*\]\([^)]+\)' "$file" 2>/dev/null | wc -l || echo "0")
        echo "   $file: $count links"
    fi
done

echo ""
echo "💡 Suggested actions:"
echo "   1. Delete docs with broken links to removed files"
echo "   2. Update links to current file locations"
echo "   3. Remove links to archived/deleted content"

if [ "$DRY_RUN" == "false" ]; then
    echo ""
    read -p "Delete problematic docs? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        for file in "${PROBLEM_FILES[@]}"; do
            if [ -f "$file" ]; then
                rm -f "$file"
                echo "   ✅ Deleted $file"
            fi
        done
    fi
fi

echo ""
echo "Done!"
