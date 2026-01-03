#!/bin/bash
# Check for console.log statements that should use proper logging
# Usage: ./scripts/maintenance/check-console-logs.sh

set -e
cd "$(dirname "$0")/../.."

echo "🔍 Scanning for console.log in production code..."
echo ""

# Backend services should use proper logging
echo "📋 Backend services (should use logger):"
for svc in services/svc-elections services/svc-events; do
    if [ -d "$svc/src" ]; then
        count=$(grep -rn "console\.log" "$svc/src" --include="*.js" 2>/dev/null | wc -l || echo "0")
        if [ "$count" -gt 0 ]; then
            echo ""
            echo "   $svc/src: $count occurrences"
            grep -rn "console\.log" "$svc/src" --include="*.js" 2>/dev/null | head -5 | sed 's/^/      /'
            if [ "$count" -gt 5 ]; then
                echo "      ... and $((count - 5)) more"
            fi
        fi
    fi
done

echo ""
echo "📋 Frontend code (acceptable for dev, minimize for prod):"
count=$(grep -rn "console\.log" apps/members-portal/js --include="*.js" 2>/dev/null | wc -l || echo "0")
echo "   apps/members-portal/js: $count occurrences"

echo ""
echo "💡 Recommendations:"
echo "   • Backend: Use structured logging (utils_logging.py, service-audit.js)"
echo "   • Frontend: Remove debug logs before deploy, or use DEBUG flag"
echo "   • Keep console.error for actual errors"
