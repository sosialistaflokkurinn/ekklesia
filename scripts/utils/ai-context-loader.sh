#!/bin/bash
# AI Assistant Context Loader
# Use this script to load essential context when working with AI assistants in terminal

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 Ekklesia AI Assistant Context Loader"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Loading essential context for AI assistants..."
echo ""

# Essential docs to load
DOCS=(
    "docs/SESSION_START_REMINDER.md"
    "docs/status/CURRENT_DEVELOPMENT_STATUS.md"
    "docs/infrastructure/CLOUD_RUN_SERVICES.md"
    "docs/operations/OPERATIONAL_PROCEDURES.md"
)

for doc in "${DOCS[@]}"; do
    doc_path="$PROJECT_ROOT/$doc"
    if [ -f "$doc_path" ]; then
        echo "═══════════════════════════════════════════════════"
        echo "📄 $doc"
        echo "═══════════════════════════════════════════════════"
        echo ""
        cat "$doc_path"
        echo ""
        echo ""
    else
        echo "⚠️  Warning: $doc not found (skipping)"
        echo ""
    fi
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Context Loaded Successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 Usage:"
echo "   Tell your AI assistant:"
echo "   \"Please reference the context loaded above for this project.\""
echo ""
echo "📖 DOCUMENTATION-FIRST WORKFLOW:"
echo "   ⚠️  ALWAYS read relevant docs BEFORE starting any task!"
echo ""
echo "   1️⃣  BEFORE: Read docs → Understand architecture → Plan"
echo "   2️⃣  DURING: Follow documented patterns → Note discrepancies"
echo "   3️⃣  AFTER:  Fix code → Update inaccurate docs → Commit both"
echo ""
echo "   Example: If docs say 'DJANGO_API_TOKEN' but Firebase creates"
echo "            'django-api-token', fix BOTH code AND documentation!"
echo ""
echo "📚 Full documentation map:"
echo "   docs/DOCUMENTATION_MAP.md"
echo ""
echo "🔗 GitHub Copilot users:"
echo "   Context automatically loaded from .github/copilot-instructions.md"
echo ""
