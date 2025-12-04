#!/bin/bash
# Git Local-Only Strategy Analysis Tool
# Helps understand and manage the "Track All, Push Selectively" strategy
#
# Usage: ./scripts/utils/git-local-analysis.sh [command]
# Commands:
#   status    - Show current status (default)
#   blocked   - List files that would be blocked by pre-push
#   simplify  - Show what to change to simplify the strategy
#   pr        - Create a clean PR branch (excludes local-only files)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

REPO_ROOT="$(git rev-parse --show-toplevel)"
LOCAL_ONLY_FILE="$REPO_ROOT/.git-local-only"

# Get patterns from .git-local-only (excluding comments and empty lines)
get_patterns() {
    if [ -f "$LOCAL_ONLY_FILE" ]; then
        grep -v '^#' "$LOCAL_ONLY_FILE" | grep -v '^$' | grep -v '^[[:space:]]*$'
    fi
}

# Check if a file matches any local-only pattern
is_local_only() {
    local file="$1"
    while IFS= read -r pattern; do
        if echo "$file" | grep -qE "$pattern"; then
            echo "$pattern"
            return 0
        fi
    done < <(get_patterns)
    return 1
}

# Command: status
cmd_status() {
    echo -e "${BLUE}=== Git Local-Only Strategy Status ===${NC}"
    echo ""

    # Count patterns
    local pattern_count=$(get_patterns | wc -l)
    echo -e "Patterns in .git-local-only: ${YELLOW}$pattern_count${NC}"
    echo ""

    # Count tracked files that match local-only patterns
    echo -e "${BLUE}Tracked files matching local-only patterns:${NC}"
    local blocked_count=0
    local blocked_files=""

    while IFS= read -r file; do
        if pattern=$(is_local_only "$file"); then
            ((blocked_count++))
            blocked_files+="  $file (pattern: $pattern)\n"
        fi
    done < <(git ls-files)

    if [ $blocked_count -eq 0 ]; then
        echo -e "  ${GREEN}None - all tracked files can be pushed${NC}"
    else
        echo -e "  ${YELLOW}$blocked_count files would be blocked:${NC}"
        echo -e "$blocked_files" | head -20
        if [ $blocked_count -gt 20 ]; then
            echo -e "  ... and $((blocked_count - 20)) more"
        fi
    fi
    echo ""

    # Show untracked directories that are gitignored
    echo -e "${BLUE}Key directories status:${NC}"
    for dir in tmp/ archive-code/ archive-i18n/ docs/archive/ docs/audits/ docs/policy/ .claude/; do
        if [ -d "$REPO_ROOT/$dir" ]; then
            local file_count=$(find "$REPO_ROOT/$dir" -type f 2>/dev/null | wc -l)
            if git check-ignore -q "$dir" 2>/dev/null; then
                echo -e "  $dir: ${RED}gitignored${NC} ($file_count files, AI cannot see)"
            elif is_local_only "$dir" >/dev/null 2>&1; then
                echo -e "  $dir: ${YELLOW}tracked but blocked${NC} ($file_count files)"
            else
                echo -e "  $dir: ${GREEN}tracked and pushable${NC} ($file_count files)"
            fi
        else
            echo -e "  $dir: ${BLUE}does not exist${NC}"
        fi
    done
    echo ""

    # Complexity score
    echo -e "${BLUE}Complexity Assessment:${NC}"
    local complexity="LOW"
    local issues=0

    if [ $pattern_count -gt 10 ]; then
        ((issues++))
        echo -e "  ${YELLOW}! Many patterns ($pattern_count) - hard to remember${NC}"
    fi

    if [ $blocked_count -gt 50 ]; then
        ((issues++))
        echo -e "  ${YELLOW}! Many blocked files ($blocked_count) - PR creation complex${NC}"
    fi

    if [ $issues -eq 0 ]; then
        echo -e "  ${GREEN}Strategy is manageable${NC}"
    elif [ $issues -eq 1 ]; then
        echo -e "  ${YELLOW}Strategy has some complexity${NC}"
        complexity="MEDIUM"
    else
        echo -e "  ${RED}Strategy is complex - consider simplifying${NC}"
        complexity="HIGH"
    fi
    echo ""
    echo -e "Overall complexity: ${YELLOW}$complexity${NC}"
}

# Command: blocked
cmd_blocked() {
    echo -e "${BLUE}=== Files Blocked by Pre-Push Hook ===${NC}"
    echo ""

    local count=0
    while IFS= read -r file; do
        if pattern=$(is_local_only "$file"); then
            echo -e "  ${YELLOW}$file${NC}"
            echo -e "    Pattern: $pattern"
            ((count++))
        fi
    done < <(git ls-files)

    echo ""
    echo -e "Total: ${YELLOW}$count${NC} files blocked from push"
}

# Command: simplify
cmd_simplify() {
    echo -e "${BLUE}=== Simplification Options ===${NC}"
    echo ""

    echo -e "${YELLOW}Option 1: Keep current strategy but reduce patterns${NC}"
    echo "  - Remove archive directories from .git-local-only"
    echo "  - Only block truly sensitive files (.env, credentials)"
    echo "  - Pros: AI still sees everything"
    echo "  - Cons: Archive files go to remote (not harmful)"
    echo ""

    echo -e "${YELLOW}Option 2: Go back to simple .gitignore${NC}"
    echo "  - Add sensitive directories back to .gitignore"
    echo "  - Remove pre-push hook complexity"
    echo "  - Use /tmp/ for temp files AI can see"
    echo "  - Pros: Simple, standard git workflow"
    echo "  - Cons: AI can't see gitignored files"
    echo ""

    echo -e "${YELLOW}Option 3: Hybrid approach${NC}"
    echo "  - .gitignore for truly local files (tmp/, .env)"
    echo "  - Track archives and docs (they're not sensitive)"
    echo "  - Only block PII files in pre-push"
    echo "  - Pros: Balance of simplicity and AI visibility"
    echo ""

    echo -e "${BLUE}Recommended changes for simplification:${NC}"
    echo ""
    echo "1. Remove from .git-local-only:"
    echo "   - ^archive-code/"
    echo "   - ^archive-i18n/"
    echo "   - ^docs/archive/"
    echo "   - ^\.claude/"
    echo ""
    echo "2. Keep in .git-local-only (truly sensitive):"
    echo "   - \.env\$"
    echo "   - .*\.key\.json\$"
    echo "   - ^docs/policy/.*\.md\$ (meeting notes with PII)"
    echo "   - ^tmp/ (temporary working files)"
}

# Command: pr
cmd_pr() {
    local branch_name="${1:-pr/clean-branch}"

    echo -e "${BLUE}=== Creating Clean PR Branch ===${NC}"
    echo ""

    # Get current branch
    local current=$(git branch --show-current)
    echo "Current branch: $current"
    echo "New branch: $branch_name"
    echo ""

    # List directories to exclude
    local excludes=""
    for dir in tmp/ archive-code/ archive-i18n/ docs/archive/ docs/audits/ docs/policy/ .claude/ .gemini/ .metadata_store/; do
        if [ -d "$REPO_ROOT/$dir" ]; then
            excludes+=" ':!$dir'"
        fi
    done

    echo "Excluding directories:$excludes"
    echo ""

    read -p "Continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted"
        exit 1
    fi

    # Create branch from main
    git checkout main
    git pull origin main --ff-only
    git checkout -b "$branch_name"

    # Squash merge excluding directories
    echo "Merging changes from $current..."
    git merge --squash "$current"

    # Unstage excluded directories
    for dir in tmp/ archive-code/ archive-i18n/ docs/archive/ docs/audits/ docs/policy/ .claude/ .gemini/ .metadata_store/; do
        git reset HEAD -- "$dir" 2>/dev/null || true
    done

    # Clean up
    rm -rf tmp/ archive-code/ archive-i18n/ docs/archive/ docs/audits/ docs/policy/ .claude/ .gemini/ .metadata_store/ 2>/dev/null || true

    echo ""
    echo -e "${GREEN}Branch $branch_name ready for commit${NC}"
    echo "Run: git commit -m 'your message'"
    echo "Then: git push -u origin $branch_name"
}

# Main
case "${1:-status}" in
    status)
        cmd_status
        ;;
    blocked)
        cmd_blocked
        ;;
    simplify)
        cmd_simplify
        ;;
    pr)
        cmd_pr "$2"
        ;;
    *)
        echo "Usage: $0 [status|blocked|simplify|pr <branch-name>]"
        exit 1
        ;;
esac
