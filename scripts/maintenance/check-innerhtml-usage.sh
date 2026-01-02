#!/bin/bash
# Check for innerHTML usage that could be XSS vulnerable
# Usage: ./scripts/maintenance/check-innerhtml-usage.sh

set -e
cd "$(dirname "$0")/../.."

echo "🔍 Scanning for innerHTML usage..."
echo ""

# Find innerHTML assignments (potential XSS)
echo "📋 Files with innerHTML assignments:"
grep -rn "\.innerHTML\s*=" \
    --include="*.js" \
    --exclude-dir=node_modules \
    --exclude-dir=tmp \
    --exclude-dir=vendor \
    apps/ services/ 2>/dev/null || echo "   None found"

echo ""
echo "💡 Safe alternatives:"
echo "   • element.textContent = text    (plain text, auto-escaped)"
echo "   • element.appendChild(node)      (DOM nodes)"
echo "   • util-dom.js: escapeHtml()     (escape before innerHTML)"
echo ""
echo "⚠️  innerHTML is OK for:"
echo "   • Static HTML templates (no user input)"
echo "   • Already-escaped content"
echo ""
echo "❌ innerHTML is DANGEROUS for:"
echo "   • User-provided content"
echo "   • API response data"
echo "   • URL parameters"
