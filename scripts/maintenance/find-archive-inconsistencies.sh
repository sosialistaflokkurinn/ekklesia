#!/bin/bash
# =============================================================================
# Find Archive Naming Inconsistencies
# =============================================================================
# Finds folders using "historical" instead of the standard "archive" term.
# Also checks remote for archive/historical folders that shouldn't be there.
#
# Usage:
#   ./scripts/maintenance/find-archive-inconsistencies.sh [--remote]
#
# Options:
#   --remote    Also check remote branch for violations
#   --fix       Show git mv commands to fix (doesn't execute)
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Archive/Historical Naming Check ===${NC}"
echo ""

# Find "historical" folders (should be "archive")
echo -e "${YELLOW}Checking for 'historical' folders (should be 'archive')...${NC}"
HISTORICAL_FOLDERS=$(find . -type d -name "*historical*" 2>/dev/null | grep -v node_modules | grep -v .git || true)

if [ -n "$HISTORICAL_FOLDERS" ]; then
    echo -e "${RED}Found 'historical' folders that should be renamed to 'archive':${NC}"
    echo "$HISTORICAL_FOLDERS" | while read -r folder; do
        echo "  - $folder"
    done
    echo ""
else
    echo -e "${GREEN}No 'historical' folders found locally.${NC}"
fi

# List all archive folders for reference
echo ""
echo -e "${YELLOW}Current archive folders:${NC}"
find . -type d -name "*archive*" 2>/dev/null | grep -v node_modules | grep -v .git | sort || echo "  (none)"

# Check remote if requested
if [[ "$1" == "--remote" || "$2" == "--remote" ]]; then
    echo ""
    echo -e "${BLUE}=== Checking Remote ===${NC}"

    BRANCH=$(git rev-parse --abbrev-ref HEAD)
    REMOTE_BRANCH="origin/$BRANCH"

    if git rev-parse --verify "$REMOTE_BRANCH" >/dev/null 2>&1; then
        echo -e "${YELLOW}Checking $REMOTE_BRANCH for archive/historical patterns...${NC}"
        echo ""

        echo -e "${YELLOW}Files in 'historical' folders on remote:${NC}"
        git ls-tree -r --name-only "$REMOTE_BRANCH" 2>/dev/null | grep -E "/historical/" | head -20 || echo "  (none)"

        echo ""
        echo -e "${YELLOW}Files in 'archive' folders on remote:${NC}"
        git ls-tree -r --name-only "$REMOTE_BRANCH" 2>/dev/null | grep -E "(^archive-|/archive/)" | head -20 || echo "  (none)"

        # Check for patterns that should be local-only
        echo ""
        echo -e "${YELLOW}Checking for local-only patterns on remote (should NOT be there):${NC}"
        LOCAL_ONLY_ON_REMOTE=$(git ls-tree -r --name-only "$REMOTE_BRANCH" 2>/dev/null | grep -E "^(\.claude/|\.gemini/|tmp/|archive-code/|archive-i18n/|docs/archive/|docs/audits/)" || true)

        if [ -n "$LOCAL_ONLY_ON_REMOTE" ]; then
            echo -e "${RED}WARNING: Found local-only patterns on remote:${NC}"
            echo "$LOCAL_ONLY_ON_REMOTE" | head -20
        else
            echo -e "${GREEN}No local-only patterns found on remote.${NC}"
        fi
    else
        echo -e "${RED}Remote branch $REMOTE_BRANCH not found${NC}"
    fi
fi

# Show fix commands if requested
if [[ "$1" == "--fix" || "$2" == "--fix" ]]; then
    echo ""
    echo -e "${BLUE}=== Suggested Fix Commands ===${NC}"

    if [ -n "$HISTORICAL_FOLDERS" ]; then
        echo "Run these commands to rename 'historical' to 'archive':"
        echo ""
        echo "$HISTORICAL_FOLDERS" | while read -r folder; do
            new_folder=$(echo "$folder" | sed 's/historical/archive/g')
            echo "git mv \"$folder\" \"$new_folder\""
        done
    else
        echo "No fixes needed - all folders use 'archive' naming."
    fi
fi

echo ""
echo -e "${BLUE}=== Summary ===${NC}"
HISTORICAL_COUNT=$(echo "$HISTORICAL_FOLDERS" | grep -c . || echo 0)
ARCHIVE_COUNT=$(find . -type d -name "*archive*" 2>/dev/null | grep -v node_modules | grep -v .git | wc -l || echo 0)

echo "Historical folders (need rename): $HISTORICAL_COUNT"
echo "Archive folders (correct): $ARCHIVE_COUNT"
echo ""
echo "Standard: Use 'archive/' not 'historical/'"
echo "See: docs/standards/NAMING_CONVENTIONS.md"
