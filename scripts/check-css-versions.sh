#!/bin/bash
# =============================================================================
# CSS Version Check Script
# =============================================================================
#
# Checks if CSS files have been modified but their version parameters
# in HTML files haven't been updated. This prevents cache issues.
#
# Usage:
#   ./scripts/check-css-versions.sh          # Check only (exit 1 if issues)
#   ./scripts/check-css-versions.sh --fix    # Auto-update versions
#
# Run before deploy to catch cache busting issues!
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PORTAL_DIR="$PROJECT_ROOT/apps/members-portal"

# Today's date for version bumping
TODAY=$(date +%Y%m%d)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FIX_MODE=false
if [[ "$1" == "--fix" ]]; then
    FIX_MODE=true
fi

echo "=== CSS Version Check ==="
echo ""

ISSUES_FOUND=0

# Function to check a CSS file and its references
check_css_file() {
    local css_file="$1"
    local css_basename=$(basename "$css_file")
    local css_dir=$(dirname "$css_file")

    # Get last modified date from git (not filesystem, which changes on merge/checkout)
    local css_date=$(git log -1 --format="%cd" --date=format:"%Y%m%d" -- "$css_file" 2>/dev/null)
    if [[ -z "$css_date" ]]; then
        # Fallback to filesystem if not tracked by git
        local css_mtime=$(stat -c %Y "$css_file" 2>/dev/null || stat -f %m "$css_file")
        css_date=$(date -d "@$css_mtime" +%Y%m%d 2>/dev/null || date -r "$css_mtime" +%Y%m%d)
    fi

    # Find HTML files that reference this CSS
    local html_files=$(grep -rl "$css_basename?v=" "$PORTAL_DIR" --include="*.html" 2>/dev/null || true)

    if [[ -z "$html_files" ]]; then
        return 0
    fi

    for html_file in $html_files; do
        # Extract version from HTML
        local version=$(grep -o "${css_basename}?v=[0-9a-zA-Z]*" "$html_file" | head -1 | sed "s/${css_basename}?v=//")

        if [[ -z "$version" ]]; then
            continue
        fi

        # Extract date part from version (first 8 chars)
        local version_date="${version:0:8}"

        # Check if CSS was modified after the version date
        if [[ "$css_date" > "$version_date" ]]; then
            ISSUES_FOUND=$((ISSUES_FOUND + 1))

            local relative_css="${css_file#$PROJECT_ROOT/}"
            local relative_html="${html_file#$PROJECT_ROOT/}"

            echo -e "${RED}OUTDATED:${NC} $relative_css"
            echo "  CSS modified: $css_date"
            echo "  Version in HTML: $version (date: $version_date)"
            echo "  File: $relative_html"

            if [[ "$FIX_MODE" == true ]]; then
                local new_version="${TODAY}a"
                sed -i "s/${css_basename}?v=${version}/${css_basename}?v=${new_version}/g" "$html_file"
                echo -e "  ${GREEN}FIXED:${NC} Updated to v=$new_version"
            fi
            echo ""
        fi
    done
}

# Check key CSS files
echo "Checking CSS files..."
echo ""

# Find all CSS files in the portal
while IFS= read -r css_file; do
    check_css_file "$css_file"
done < <(find "$PORTAL_DIR" -name "*.css" -type f 2>/dev/null | grep -v node_modules | grep -v bundle.css)

# Summary
echo "=== Summary ==="
if [[ $ISSUES_FOUND -eq 0 ]]; then
    echo -e "${GREEN}All CSS versions are up to date!${NC}"
    exit 0
else
    echo -e "${YELLOW}Found $ISSUES_FOUND file(s) with outdated CSS versions${NC}"
    if [[ "$FIX_MODE" == true ]]; then
        echo -e "${GREEN}All issues have been fixed.${NC}"
        echo ""
        echo "Don't forget to commit the changes and redeploy!"
        exit 0
    else
        echo ""
        echo "Run with --fix to auto-update versions:"
        echo "  ./scripts/check-css-versions.sh --fix"
        exit 1
    fi
fi
