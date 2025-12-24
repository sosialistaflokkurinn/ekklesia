#!/bin/bash
# Batch test Kimi with multiple admin/system questions
# Usage: ./test-kimi-batch.sh
#
# Tests various question categories to verify Kimi's responses

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_SCRIPT="$SCRIPT_DIR/test-kimi-with-context.sh"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║          Kimi Batch Test - Admin/System Questions          ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Test questions by category
declare -a QUESTIONS=(
  # Cost questions
  "Hver er áætlaður kostnaður við kerfið?"
  "Hvað kostar Cloud SQL?"
  "Er ódýrara að nota VM?"

  # Architecture questions
  "Hvaða þjónustur keyra á Cloud Run?"
  "Hvernig er gagnagrunnurinn uppsettur?"
  "Hvar eru Firebase Functions?"

  # Technology decisions
  "Af hverju notið þið ekki React?"
  "Af hverju ekki TypeScript?"
  "Er þetta nútímalegt kerfi?"

  # Health/Status questions
  "Hvernig er heilsa kerfisins?"
  "Er gagnagrunnurinn tengdur?"
  "Hvaða þjónustur eru í gangi?"

  # Deployment questions
  "Hvernig deploy-a ég frontend?"
  "Hvernig uppfæri ég Cloud Function?"

  # Security questions
  "Hvernig virkar auth í kerfinu?"
  "Hvar eru leyniorð geymd?"
)

TOTAL=${#QUESTIONS[@]}
PASSED=0
FAILED=0

echo -e "${BLUE}Running $TOTAL test questions...${NC}"
echo ""

for i in "${!QUESTIONS[@]}"; do
  QUESTION="${QUESTIONS[$i]}"
  NUM=$((i + 1))

  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}Test $NUM/$TOTAL:${NC} $QUESTION"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  # Run test and capture output
  if OUTPUT=$("$TEST_SCRIPT" "$QUESTION" 2>&1); then
    # Extract just the response (between === markers)
    RESPONSE=$(echo "$OUTPUT" | sed -n '/=== Kimi Response ===/,/=====================/p' | grep -v "===")

    if [ -n "$RESPONSE" ]; then
      echo "$RESPONSE"
      echo ""
      echo -e "${GREEN}✓ Response received${NC}"
      ((PASSED++))
    else
      echo -e "${RED}✗ Empty response${NC}"
      ((FAILED++))
    fi
  else
    echo -e "${RED}✗ API call failed${NC}"
    echo "$OUTPUT" | tail -5
    ((FAILED++))
  fi

  echo ""

  # Small delay between requests to avoid rate limiting
  if [ $NUM -lt $TOTAL ]; then
    echo -e "${CYAN}Waiting 2 seconds...${NC}"
    sleep 2
  fi
done

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                       Test Summary                         ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Total:  $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
else
  echo -e "${YELLOW}Some tests failed. Review responses above.${NC}"
  exit 1
fi
