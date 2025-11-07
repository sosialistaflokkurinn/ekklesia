#!/bin/bash
# Replace potentially real-looking fake data with obviously fake values
# This prevents PII hook false positives and ensures documentation safety

set -e

echo "🔄 Replacing potentially real-looking fake data with obviously fake values..."

# Function to replace in git-tracked files only (MUCH faster than find)
replace_in_git_files() {
  local pattern=$1
  local replacement=$2
  local description=$3
  
  echo "  Replacing $description..."
  
  # Find files containing the pattern (git grep is FAST)
  local files=$(git grep -l "$pattern" 2>/dev/null || true)
  
  if [ -n "$files" ]; then
    # Replace in all files at once (sed supports multiple files)
    echo "$files" | xargs sed -i "s/$pattern/$replacement/g"
    local count=$(echo "$files" | wc -l)
    echo "    ✓ Updated $count files"
  else
    echo "    ✓ No matches found"
  fi
}

# Kennitala replacements (could be real people born 1990-01-01, 1990-03-01, 2000-03-01)
replace_in_git_files "010190-2939" "000000-0000" "kennitala 010190-2939 → 000000-0000"
replace_in_git_files "010190-1234" "111111-1111" "kennitala 010190-1234 → 111111-1111"
replace_in_git_files "010300-3390" "999999-9999" "kennitala 010300-3390 → 999999-9999"
replace_in_git_files "0103003390" "9999999999" "kennitala 0103003390 → 9999999999"

# Phone number replacements (could be real Icelandic numbers)
replace_in_git_files "\\+3547758492" "+354-999-9999" "phone +3547758492 → +354-999-9999"
replace_in_git_files "775-8492" "999-9999" "phone 775-8492 → 999-9999"
replace_in_git_files "7758492" "9999999" "phone 7758492 → 9999999"
replace_in_git_files "780-8188" "000-0000" "phone 780-8188 → 000-0000"
replace_in_git_files "7808188" "0000000" "phone 7808188 → 0000000"

echo ""
echo "✅ Replacement complete!"
echo ""
echo "Summary of replacements:"
echo "  Kennitalur:"
echo "    010190-2939 → 000000-0000 (invalid date)"
echo "    010190-1234 → 111111-1111 (clearly fake)"
echo "    010300-3390 → 999999-9999 (invalid date)"
echo "    0103003390  → 9999999999  (invalid date)"
echo "  Phone numbers:"
echo "    775-8492    → 999-9999"
echo "    7758492     → 9999999"
echo "    +3547758492 → +354-999-9999"
echo "    780-8188    → 000-0000"
echo "    7808188     → 0000000"
