#!/bin/bash
# Check and report broken links in documentation
# Usage: ./scripts/maintenance/fix-broken-links.sh [--check]

set -e
cd "$(dirname "$0")/../.."

CHECK_ONLY=false
if [ "$1" == "--check" ]; then
    CHECK_ONLY=true
fi

echo "🔗 Scanning for broken links in docs/..."
echo ""

BROKEN_COUNT=0
declare -A BROKEN_FILES

# Function to check if link target exists
check_link() {
    local source_file=$1
    local link=$2
    local source_dir=$(dirname "$source_file")

    # Skip external links
    if [[ "$link" == http* ]] || [[ "$link" == "#"* ]]; then
        return 0
    fi

    # Remove anchor from link
    local clean_link="${link%%#*}"

    # Resolve relative path
    local target
    if [[ "$clean_link" == /* ]]; then
        target="$clean_link"
    else
        target="$source_dir/$clean_link"
    fi

    # Normalize path
    target=$(realpath -m "$target" 2>/dev/null || echo "$target")

    # Check if target exists
    if [ ! -e "$target" ]; then
        BROKEN_COUNT=$((BROKEN_COUNT + 1))
        BROKEN_FILES["$source_file"]=1
        if [ "$CHECK_ONLY" == "true" ]; then
            echo "   ❌ $source_file → $link"
        fi
        return 1
    fi
    return 0
}

# Find all markdown files in docs/
while IFS= read -r file; do
    # Extract all markdown links [text](path)
    while IFS= read -r link; do
        # Clean up the link - remove ]( prefix and ) suffix
        clean=$(echo "$link" | sed 's/^](//' | sed 's/)$//')
        check_link "$file" "$clean" || true
    done < <(grep -oE '\]\([^)]+\)' "$file" 2>/dev/null | grep -v '](http' || true)
done < <(find docs -name "*.md" -type f 2>/dev/null)

echo ""
if [ "$BROKEN_COUNT" -eq 0 ]; then
    echo "✅ No broken links found!"
else
    echo "❌ Found $BROKEN_COUNT broken links in ${#BROKEN_FILES[@]} files:"
    echo ""
    for file in "${!BROKEN_FILES[@]}"; do
        echo "   📄 $file"
    done
    echo ""
    echo "💡 To see details: ./scripts/maintenance/fix-broken-links.sh --check"
    echo ""
    echo "Common fixes:"
    echo "   • events/ → services/svc-events/"
    echo "   • members/ → services/svc-members/"
    echo "   • archive/ → (remove reference, archive deleted)"
fi
