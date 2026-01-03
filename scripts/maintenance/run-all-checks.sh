#!/bin/bash
# Run all maintenance checks
# Usage: ./scripts/maintenance/run-all-checks.sh

set -e
cd "$(dirname "$0")/../.."

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║            EKKLESIA MAINTENANCE CHECKS                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

SCRIPTS_DIR="scripts/maintenance"
PASS=0
WARN=0
FAIL=0

run_check() {
    local name=$1
    local script=$2

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📌 $name"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if [ -f "$script" ]; then
        bash "$script" 2>&1 || true
    else
        echo "   ⚠️  Script not found: $script"
    fi
    echo ""
}

# Run existing checks
run_check "Code Health" "$SCRIPTS_DIR/check-code-health.sh"
run_check "Code Patterns" "$SCRIPTS_DIR/check-code-patterns.sh"
run_check "Documentation Freshness" "$SCRIPTS_DIR/check-docs-freshness.sh"
run_check "innerHTML Usage (XSS)" "$SCRIPTS_DIR/check-innerhtml-usage.sh"
run_check "Console.log Usage" "$SCRIPTS_DIR/check-console-logs.sh"
run_check "Large Files" "$SCRIPTS_DIR/check-large-files.sh"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    CHECKS COMPLETE                           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "💡 To fix issues:"
echo "   • Broken links: ./scripts/maintenance/fix-broken-links.sh"
echo "   • Validate all:  ./scripts/maintenance/validate-all.sh"
