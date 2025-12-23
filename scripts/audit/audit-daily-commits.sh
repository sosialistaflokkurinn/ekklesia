#!/bin/bash
# =============================================================================
# Daily Commit Audit Script
# Analyzes all commits from a given date for security and code quality issues
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default to today
DATE=${1:-$(date +%Y-%m-%d)}
OUTPUT_DIR="tmp/audit-reports"
REPORT_FILE="$OUTPUT_DIR/audit-$DATE.md"

echo -e "${BLUE}=== Daily Commit Audit ===${NC}"
echo -e "Date: ${CYAN}$DATE${NC}"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Get commits for the date
COMMITS=$(git log --oneline --since="$DATE 00:00" --until="$DATE 23:59:59" --reverse)
COMMIT_COUNT=$(echo "$COMMITS" | grep -c . || echo "0")

echo -e "${BLUE}Found ${CYAN}$COMMIT_COUNT${BLUE} commits${NC}"
echo ""

# Initialize report
cat > "$REPORT_FILE" << EOF
# Daily Audit Report: $DATE

Generated: $(date '+%Y-%m-%d %H:%M:%S')

## Summary

- **Commits Analyzed:** $COMMIT_COUNT
- **Date:** $DATE

## Commits

\`\`\`
$COMMITS
\`\`\`

---

EOF

# Initialize counters
TOTAL_ERRORS=0
TOTAL_WARNINGS=0
TOTAL_INFO=0

# Function to check a single commit
audit_commit() {
    local HASH=$1
    local MSG=$2

    echo -e "${YELLOW}Auditing: ${NC}$HASH $MSG"

    # Get changed files
    FILES=$(git diff-tree --no-commit-id --name-only -r "$HASH" 2>/dev/null || echo "")
    FILE_COUNT=$(echo "$FILES" | grep -c . || echo "0")

    # Get diff stats
    STATS=$(git show --stat "$HASH" | tail -1)

    # Check for security issues in diff
    DIFF=$(git show "$HASH" --no-color 2>/dev/null || echo "")

    local COMMIT_ERRORS=0
    local COMMIT_WARNINGS=0
    local ISSUES=""

    # Check for hardcoded secrets patterns
    if echo "$DIFF" | grep -iE "(password|secret|api.?key|token)\s*[:=]\s*['\"][^'\"]{8,}" > /dev/null 2>&1; then
        ISSUES+="  - **CRITICAL:** Potential hardcoded secret detected\n"
        ((COMMIT_ERRORS++))
    fi

    # Check for console.log in JS files
    if echo "$FILES" | grep -E "\.js$" > /dev/null 2>&1; then
        if echo "$DIFF" | grep -E "^\+.*console\.log" > /dev/null 2>&1; then
            ISSUES+="  - **WARNING:** console.log added (use debug module)\n"
            ((COMMIT_WARNINGS++))
        fi
    fi

    # Check for SQL injection patterns (string interpolation)
    if echo "$DIFF" | grep -E "^\+.*f['\"].*SELECT|^\+.*f['\"].*INSERT|^\+.*f['\"].*UPDATE|^\+.*f['\"].*DELETE" > /dev/null 2>&1; then
        if echo "$DIFF" | grep -E "^\+.*\{[a-zA-Z_]+\}.*FROM|^\+.*\{[a-zA-Z_]+\}.*WHERE" > /dev/null 2>&1; then
            ISSUES+="  - **CRITICAL:** Potential SQL injection (f-string with variable)\n"
            ((COMMIT_ERRORS++))
        fi
    fi

    # Check for missing error handling in async functions
    if echo "$DIFF" | grep -E "^\+.*async\s+function|^\+.*async\s+\(" > /dev/null 2>&1; then
        if ! echo "$DIFF" | grep -E "^\+.*try\s*\{|^\+.*\.catch\(" > /dev/null 2>&1; then
            ISSUES+="  - **WARNING:** Async function without try/catch or .catch()\n"
            ((COMMIT_WARNINGS++))
        fi
    fi

    # Check for direct innerHTML usage
    if echo "$DIFF" | grep -E "^\+.*\.innerHTML\s*=" > /dev/null 2>&1; then
        if ! echo "$DIFF" | grep -E "escapeHTML|sanitize" > /dev/null 2>&1; then
            ISSUES+="  - **WARNING:** innerHTML used without escapeHTML\n"
            ((COMMIT_WARNINGS++))
        fi
    fi

    # Check for hardcoded URLs
    if echo "$DIFF" | grep -E "^\+.*(http://|https://).*\.(com|is|net|org)" > /dev/null 2>&1; then
        if ! echo "$DIFF" | grep -E "localhost|127\.0\.0\.1|example\.com" > /dev/null 2>&1; then
            ISSUES+="  - **INFO:** Hardcoded URL detected (verify if intentional)\n"
            ((TOTAL_INFO++))
        fi
    fi

    # Check for Firebase direct imports
    if echo "$DIFF" | grep -E "^\+.*from\s+['\"]firebase" > /dev/null 2>&1; then
        ISSUES+="  - **WARNING:** Direct Firebase import (use wrapper)\n"
        ((COMMIT_WARNINGS++))
    fi

    # Check for rate limiting in Cloud Functions
    if echo "$FILES" | grep -E "fn_.*\.py$" > /dev/null 2>&1; then
        if echo "$DIFF" | grep -E "^\+.*def\s+\w+_handler" > /dev/null 2>&1; then
            if ! echo "$DIFF" | grep -E "check_uid_rate_limit|check_rate_limit" > /dev/null 2>&1; then
                ISSUES+="  - **WARNING:** Handler function may be missing rate limiting\n"
                ((COMMIT_WARNINGS++))
            fi
        fi
    fi

    # Check for proper authorization
    if echo "$FILES" | grep -E "fn_.*\.py$" > /dev/null 2>&1; then
        if echo "$DIFF" | grep -E "^\+.*def\s+\w+_handler" > /dev/null 2>&1; then
            if ! echo "$DIFF" | grep -E "require_auth|require_admin|require_superuser" > /dev/null 2>&1; then
                ISSUES+="  - **WARNING:** Handler function may be missing authorization check\n"
                ((COMMIT_WARNINGS++))
            fi
        fi
    fi

    # Check for TODO/FIXME comments
    if echo "$DIFF" | grep -E "^\+.*(TODO|FIXME|HACK|XXX):" > /dev/null 2>&1; then
        ISSUES+="  - **INFO:** TODO/FIXME comment added\n"
        ((TOTAL_INFO++))
    fi

    # Update totals
    TOTAL_ERRORS=$((TOTAL_ERRORS + COMMIT_ERRORS))
    TOTAL_WARNINGS=$((TOTAL_WARNINGS + COMMIT_WARNINGS))

    # Write to report
    cat >> "$REPORT_FILE" << EOF
### $HASH: $MSG

**Files Changed:** $FILE_COUNT
**Stats:** $STATS

**Changed Files:**
\`\`\`
$FILES
\`\`\`

EOF

    if [ -n "$ISSUES" ]; then
        echo -e "**Issues Found:**" >> "$REPORT_FILE"
        echo -e "$ISSUES" >> "$REPORT_FILE"
    else
        echo "**Issues Found:** None" >> "$REPORT_FILE"
    fi

    echo "" >> "$REPORT_FILE"
    echo "---" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"

    # Console output
    if [ $COMMIT_ERRORS -gt 0 ]; then
        echo -e "  ${RED}Errors: $COMMIT_ERRORS${NC}"
    fi
    if [ $COMMIT_WARNINGS -gt 0 ]; then
        echo -e "  ${YELLOW}Warnings: $COMMIT_WARNINGS${NC}"
    fi
    if [ $COMMIT_ERRORS -eq 0 ] && [ $COMMIT_WARNINGS -eq 0 ]; then
        echo -e "  ${GREEN}No issues${NC}"
    fi
}

# Process each commit
echo ""
while IFS= read -r line; do
    if [ -n "$line" ]; then
        HASH=$(echo "$line" | cut -d' ' -f1)
        MSG=$(echo "$line" | cut -d' ' -f2-)
        audit_commit "$HASH" "$MSG"
    fi
done <<< "$COMMITS"

# Summary
echo ""
echo -e "${BLUE}=== Audit Summary ===${NC}"
echo -e "Total Commits: ${CYAN}$COMMIT_COUNT${NC}"
echo -e "Total Errors: ${RED}$TOTAL_ERRORS${NC}"
echo -e "Total Warnings: ${YELLOW}$TOTAL_WARNINGS${NC}"
echo -e "Total Info: ${BLUE}$TOTAL_INFO${NC}"
echo ""

# Add summary to report
cat >> "$REPORT_FILE" << EOF
## Audit Summary

| Metric | Count |
|--------|-------|
| Commits Analyzed | $COMMIT_COUNT |
| Errors | $TOTAL_ERRORS |
| Warnings | $TOTAL_WARNINGS |
| Info | $TOTAL_INFO |

---

## Recommendations

EOF

if [ $TOTAL_ERRORS -gt 0 ]; then
    echo "- **CRITICAL:** Review and fix all error-level issues before merge" >> "$REPORT_FILE"
fi

if [ $TOTAL_WARNINGS -gt 0 ]; then
    echo "- **HIGH:** Review all warning-level issues" >> "$REPORT_FILE"
fi

echo "" >> "$REPORT_FILE"
echo "*Generated by audit-daily-commits.sh*" >> "$REPORT_FILE"

echo -e "Report saved to: ${GREEN}$REPORT_FILE${NC}"

# Exit with error if critical issues found
if [ $TOTAL_ERRORS -gt 0 ]; then
    exit 1
fi

exit 0
