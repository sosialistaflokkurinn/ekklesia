#!/bin/bash
# Git post-commit hook to remind about documentation updates
# Install: ln -s ../../scripts/admin/documentation-maintenance/post-commit-reminder.sh .git/hooks/post-commit

# Configuration
REPO_ROOT="$(git rev-parse --show-toplevel)"
LAST_COMMIT_MSG=$(git log -1 --pretty=%B)

# Check if this was a significant commit that might need doc updates
SIGNIFICANT_PATTERNS=(
    "^(feat|fix|refactor|perf):"  # Conventional commits
    "deploy"
    "infrastructure"
    "security"
    "procedure"
)

IS_SIGNIFICANT=false
for pattern in "${SIGNIFICANT_PATTERNS[@]}"; do
    if echo "$LAST_COMMIT_MSG" | grep -qiE "$pattern"; then
        IS_SIGNIFICANT=true
        break
    fi
done

# Only show reminder for significant commits
if [[ "$IS_SIGNIFICANT" == "false" ]]; then
    exit 0
fi

# Check if any docs were already updated in this commit
DOCS_UPDATED=$(git diff-tree --no-commit-id --name-only -r HEAD | grep -E "(CURRENT_DEVELOPMENT_STATUS|USAGE_CONTEXT|OPERATIONAL_PROCEDURES|CLAUDE)\.md" || true)

if [[ -n "$DOCS_UPDATED" ]]; then
    # Docs were already updated, no reminder needed
    exit 0
fi

# Show reminder
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Documentation Update Reminder"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "This commit appears significant and may need documentation updates:"
echo ""
echo "  \"$LAST_COMMIT_MSG\""
echo ""
echo "Consider updating (if needed):"
echo ""
echo "  ✓ CURRENT_DEVELOPMENT_STATUS.md - Infrastructure/deployments"
echo "  ✓ OPERATIONAL_PROCEDURES.md     - New procedures/workflows"
echo "  ✓ CLAUDE.md                     - AI guidelines/security rules"
echo "  ✓ USAGE_CONTEXT.md              - System usage patterns"
echo ""
echo "Check freshness: ./scripts/admin/documentation-maintenance/check-docs-freshness.sh"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
