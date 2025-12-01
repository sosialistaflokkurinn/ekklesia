#!/bin/bash
# Check if key documentation files are up-to-date
# Usage: ./check-docs-freshness.sh [--days DAYS]
# Exit code: 0 if all docs are fresh, 1 if any are stale
#
# Supports YAML frontmatter with 'updated:' field:
#   ---
#   updated: 2025-01-15
#   ---
# Falls back to git commit date if frontmatter not present

set -e

# Configuration
DAYS_THRESHOLD=${1:-7}  # Default: warn if not updated in 7 days
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

# Key documentation files
DOCS=(
    "docs/status/CURRENT_DEVELOPMENT_STATUS.md"
    "docs/development/guides/workflows/USAGE_CONTEXT.md"
    "docs/operations/OPERATIONAL_PROCEDURES.md"
)

# Function to extract frontmatter 'updated' field
extract_frontmatter_date() {
    local file="$1"

    # Check if file starts with '---'
    if ! head -n 1 "$file" | grep -q '^---$'; then
        return 1
    fi

    # Extract frontmatter block (between first --- and second ---)
    local frontmatter=$(awk '/^---$/{if(++n==2)exit;next}n==1' "$file")

    # Extract updated date (supports: updated: 2025-01-15 or updated: "2025-01-15")
    local updated_date=$(echo "$frontmatter" | grep -E '^updated:' | sed -E 's/^updated:\s*"?([0-9]{4}-[0-9]{2}-[0-9]{2})"?.*/\1/')

    if [[ -n "$updated_date" ]]; then
        echo "$updated_date"
        return 0
    fi

    return 1
}

echo "📝 Checking documentation freshness..."
echo "Threshold: ${DAYS_THRESHOLD} days"
echo "Priority: YAML frontmatter 'updated:' field → git commit date"
echo ""

cd "$REPO_ROOT"

STALE_COUNT=0
CURRENT_TIMESTAMP=$(date +%s)

for doc in "${DOCS[@]}"; do
    if [[ ! -f "$doc" ]]; then
        echo "❌ MISSING: $doc"
        STALE_COUNT=$((STALE_COUNT + 1))
        continue
    fi

    # Try to get date from frontmatter first
    FRONTMATTER_DATE=$(extract_frontmatter_date "$doc" 2>/dev/null || echo "")

    if [[ -n "$FRONTMATTER_DATE" ]]; then
        # Use frontmatter date
        LAST_UPDATE="$FRONTMATTER_DATE"
        LAST_TIMESTAMP=$(date -d "$FRONTMATTER_DATE" +%s 2>/dev/null || date -j -f "%Y-%m-%d" "$FRONTMATTER_DATE" +%s)
        SOURCE="frontmatter"
    else
        # Fall back to git commit date
        LAST_COMMIT=$(git log -1 --format='%ci' -- "$doc" 2>/dev/null)

        if [[ -z "$LAST_COMMIT" ]]; then
            echo "⚠️  NEVER COMMITTED (no frontmatter): $doc"
            STALE_COUNT=$((STALE_COUNT + 1))
            continue
        fi

        LAST_UPDATE="$LAST_COMMIT"
        LAST_TIMESTAMP=$(date -d "$LAST_COMMIT" +%s 2>/dev/null || date -j -f "%Y-%m-%d %H:%M:%S %z" "$LAST_COMMIT" +%s)
        SOURCE="git"
    fi

    # Calculate days since last update
    DAYS_AGO=$(( (CURRENT_TIMESTAMP - LAST_TIMESTAMP) / 86400 ))

    if [[ $DAYS_AGO -gt $DAYS_THRESHOLD ]]; then
        echo "⚠️  STALE (${DAYS_AGO} days, $SOURCE): $doc"
        echo "   Last updated: $LAST_UPDATE"
        STALE_COUNT=$((STALE_COUNT + 1))
    else
        echo "✅ FRESH (${DAYS_AGO} days, $SOURCE): $doc"
    fi
done

echo ""

if [[ $STALE_COUNT -gt 0 ]]; then
    echo "❌ Found $STALE_COUNT stale/missing documentation file(s)"
    echo ""
    echo "💡 To update docs, see:"
    echo "   docs/development/guides/DOCUMENTATION_MAINTENANCE.md"
    exit 1
else
    echo "✅ All documentation files are up-to-date!"
    exit 0
fi
