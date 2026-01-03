#!/bin/bash
# Check for large files that may need refactoring
# Usage: ./scripts/maintenance/check-large-files.sh [threshold]
# Default threshold: 500 lines

set -e
cd "$(dirname "$0")/../.."

THRESHOLD=${1:-500}

echo "🔍 Scanning for files over $THRESHOLD lines..."
echo ""

echo "📋 Large JavaScript files:"
find apps/ services/ -name "*.js" \
    -not -path "*/node_modules/*" \
    -not -path "*/tmp/*" \
    -exec wc -l {} \; 2>/dev/null | \
    awk -v t="$THRESHOLD" '$1 > t {print $1, $2}' | \
    sort -rn | \
    while read lines file; do
        echo "   $lines lines: $file"
    done

echo ""
echo "📋 Large Python files:"
find services/ -name "*.py" \
    -not -path "*/node_modules/*" \
    -not -path "*/__pycache__/*" \
    -not -path "*/venv*/*" \
    -exec wc -l {} \; 2>/dev/null | \
    awk -v t="$THRESHOLD" '$1 > t {print $1, $2}' | \
    sort -rn | \
    while read lines file; do
        echo "   $lines lines: $file"
    done

echo ""
echo "💡 Refactoring suggestions:"
echo "   • 500-800 lines: Consider splitting into modules"
echo "   • 800+ lines: Strongly recommend refactoring"
echo "   • Extract reusable functions to js/utils/ or shared/"
echo "   • Group related functions into feature modules"
