#!/bin/bash
# Remove **Author**: and **Authors**: metadata labels from markdown files
# These are redundant - git history tracks authorship

set -e

cd "$(dirname "$0")/.."

echo "Finding files with **Author**: or **Authors**: labels..."

# Find all matches first (excluding node_modules, tmp, vendor directories)
files_with_author=$(grep -rl '^\*\*Authors\?\*\*:' --include="*.md" \
    --exclude-dir=node_modules --exclude-dir=tmp --exclude-dir=vendor . 2>/dev/null || true)

if [ -z "$files_with_author" ]; then
    echo "No files found with author labels."
    exit 0
fi

echo "Files to modify:"
echo "$files_with_author"
echo ""

# Remove lines starting with **Author**: or **Authors**: or **Author:**
for file in $files_with_author; do
    echo "Processing: $file"
    # Pattern 1: **Author**: or **Authors**: (colon outside bold)
    sed -i '/^\*\*Authors\?\*\*:/d' "$file"
    # Pattern 2: **Author:** (colon inside bold)
    sed -i '/^\*\*Author:\*\*/d' "$file"
done

echo ""
echo "Done! Author labels removed."
echo "Run 'git diff' to review changes."
