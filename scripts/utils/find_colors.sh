#!/bin/bash

# Define search directories (adjust as needed)
SEARCH_DIRS="apps services"

# Define exclusion patterns
EXCLUDES="--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=build --exclude-dir=coverage --exclude=*.min.css --exclude=*.min.js --exclude=*.map"

echo "=== Searching for Hex Color Definitions (#...) ==="
grep -r $EXCLUDES -E "#[0-9a-fA-F]{3,6}" $SEARCH_DIRS | grep -v "var(" | head -n 20
echo "... (truncated)"

echo ""
echo "=== Searching for RGB/RGBA Definitions ==="
grep -r $EXCLUDES -E "rgba?\(" $SEARCH_DIRS | grep -v "var(" | head -n 20
echo "... (truncated)"

echo ""
echo "=== Searching for HSL/HSLA Definitions ==="
grep -r $EXCLUDES -E "hsla?\(" $SEARCH_DIRS | grep -v "var(" | head -n 20
echo "... (truncated)"

echo ""
echo "=== Searching for CSS Variable Definitions (--color-...) ==="
grep -r $EXCLUDES -E "^\s*--color-[a-zA-Z0-9-]+\s*:" $SEARCH_DIRS | head -n 20
echo "... (truncated)"

echo ""
echo "=== Summary of files with potential hardcoded colors (excluding global.css) ==="
grep -r $EXCLUDES -l -E "#[0-9a-fA-F]{3,6}|rgba?\(|hsla?\(" $SEARCH_DIRS | grep -v "global.css" | sort | uniq
