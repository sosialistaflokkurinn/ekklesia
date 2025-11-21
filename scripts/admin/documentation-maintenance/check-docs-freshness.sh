#!/bin/bash
# Check if key documentation files are up-to-date
# Usage: ./check-docs-freshness.sh [--days DAYS]
# Exit code: 0 if all docs are fresh, 1 if any are stale

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

echo "📝 Checking documentation freshness..."
echo "Threshold: ${DAYS_THRESHOLD} days"
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

    # Get last commit date for this file
    LAST_COMMIT=$(git log -1 --format='%ci' -- "$doc" 2>/dev/null)

    if [[ -z "$LAST_COMMIT" ]]; then
        echo "⚠️  NEVER COMMITTED: $doc"
        STALE_COUNT=$((STALE_COUNT + 1))
        continue
    fi

    # Calculate days since last update
    LAST_TIMESTAMP=$(date -d "$LAST_COMMIT" +%s 2>/dev/null || date -j -f "%Y-%m-%d %H:%M:%S %z" "$LAST_COMMIT" +%s)
    DAYS_AGO=$(( (CURRENT_TIMESTAMP - LAST_TIMESTAMP) / 86400 ))

    if [[ $DAYS_AGO -gt $DAYS_THRESHOLD ]]; then
        echo "⚠️  STALE (${DAYS_AGO} days): $doc"
        echo "   Last updated: $LAST_COMMIT"
        STALE_COUNT=$((STALE_COUNT + 1))
    else
        echo "✅ FRESH (${DAYS_AGO} days): $doc"
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
