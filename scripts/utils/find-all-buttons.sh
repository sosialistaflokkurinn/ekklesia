#!/bin/bash
#
# find-all-buttons.sh
# 
# Finds all button classes and their definitions in the members-portal.
# Useful for auditing button styles and ensuring consistent theming.
#
# Usage: ./scripts/utils/find-all-buttons.sh
#
# Created: 2025-12-02

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PORTAL_DIR="$PROJECT_ROOT/apps/members-portal"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║              BUTTON CLASS AUDIT - Members Portal               ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# ─────────────────────────────────────────────────────────────────────
# 1. Find all button classes used in HTML/JS files
# ─────────────────────────────────────────────────────────────────────
echo "┌──────────────────────────────────────────────────────────────────┐"
echo "│ 1. BUTTON CLASSES IN USE (HTML & JS)                            │"
echo "└──────────────────────────────────────────────────────────────────┘"
echo ""

echo "Standard .btn classes:"
grep -rh "class=\"[^\"]*btn[^\"]*\"" "$PORTAL_DIR" --include="*.html" --include="*.js" 2>/dev/null | \
  grep -oE 'class="[^"]*"' | \
  grep -E "btn" | \
  sed 's/class="//;s/"$//' | \
  tr ' ' '\n' | \
  grep -E "^btn" | \
  sort | uniq -c | sort -rn || echo "  (none found)"

echo ""
echo "Filter/toggle buttons:"
grep -rh "class=\"[^\"]*btn[^\"]*\"" "$PORTAL_DIR" --include="*.html" --include="*.js" 2>/dev/null | \
  grep -oE 'class="[^"]*"' | \
  grep -E "filter-btn|duration-btn|toggle" | \
  sed 's/class="//;s/"$//' | \
  sort | uniq -c | sort -rn || echo "  (none found)"

echo ""

# ─────────────────────────────────────────────────────────────────────
# 2. Find CSS files that define button styles
# ─────────────────────────────────────────────────────────────────────
echo "┌──────────────────────────────────────────────────────────────────┐"
echo "│ 2. CSS FILES WITH BUTTON DEFINITIONS                            │"
echo "└──────────────────────────────────────────────────────────────────┘"
echo ""

echo "Files defining .btn classes:"
grep -rl "\.btn" "$PORTAL_DIR/styles" --include="*.css" 2>/dev/null | \
  sed "s|$PROJECT_ROOT/||" | sort || echo "  (none found)"

echo ""

# ─────────────────────────────────────────────────────────────────────
# 3. Check which button variants exist in button.css
# ─────────────────────────────────────────────────────────────────────
echo "┌──────────────────────────────────────────────────────────────────┐"
echo "│ 3. BUTTON VARIANTS IN button.css                                │"
echo "└──────────────────────────────────────────────────────────────────┘"
echo ""

BUTTON_CSS="$PORTAL_DIR/styles/components/button.css"
if [[ -f "$BUTTON_CSS" ]]; then
  grep -E "^\.[a-zA-Z]" "$BUTTON_CSS" | \
    grep -v "^/\*" | \
    sed 's/{.*//' | \
    sort | uniq
else
  echo "  button.css not found!"
fi

echo ""

# ─────────────────────────────────────────────────────────────────────
# 4. Find buttons that might not be using the standard system
# ─────────────────────────────────────────────────────────────────────
echo "┌──────────────────────────────────────────────────────────────────┐"
echo "│ 4. NON-STANDARD BUTTON PATTERNS (may need review)               │"
echo "└──────────────────────────────────────────────────────────────────┘"
echo ""

echo "Custom button classes (not using .btn prefix):"
grep -rh "<button" "$PORTAL_DIR" --include="*.html" 2>/dev/null | \
  grep -oE 'class="[^"]*"' | \
  grep -v "btn" | \
  sed 's/class="//;s/"$//' | \
  sort | uniq -c | sort -rn | head -15 || echo "  (none found)"

echo ""

# ─────────────────────────────────────────────────────────────────────
# 5. Check color usage in button styles
# ─────────────────────────────────────────────────────────────────────
echo "┌──────────────────────────────────────────────────────────────────┐"
echo "│ 5. COLOR VARIABLES USED IN BUTTON STYLES                        │"
echo "└──────────────────────────────────────────────────────────────────┘"
echo ""

if [[ -f "$BUTTON_CSS" ]]; then
  echo "Colors in button.css:"
  grep -oE "var\(--color-[a-zA-Z0-9-]+\)" "$BUTTON_CSS" | \
    sort | uniq -c | sort -rn
else
  echo "  button.css not found!"
fi

echo ""

# ─────────────────────────────────────────────────────────────────────
# 6. Summary of files using each button type
# ─────────────────────────────────────────────────────────────────────
echo "┌──────────────────────────────────────────────────────────────────┐"
echo "│ 6. FILES USING EACH BUTTON TYPE                                 │"
echo "└──────────────────────────────────────────────────────────────────┘"
echo ""

for btn_class in "btn--primary" "btn--secondary" "btn--outline" "btn--danger" "btn--back"; do
  count=$(grep -rl "$btn_class" "$PORTAL_DIR" --include="*.html" --include="*.js" 2>/dev/null | wc -l)
  echo "$btn_class: $count files"
  grep -rl "$btn_class" "$PORTAL_DIR" --include="*.html" --include="*.js" 2>/dev/null | \
    sed "s|$PORTAL_DIR/||" | sed 's/^/    /' || true
  echo ""
done

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                        AUDIT COMPLETE                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
