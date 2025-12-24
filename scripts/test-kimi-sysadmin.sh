#!/bin/bash
# Sysadmin-focused Kimi test questions
# Tests troubleshooting, monitoring, security, and operational questions

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
echo -e "${CYAN}║         Kimi Sysadmin Test - Kerfisstjóraspurningar        ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Sysadmin questions by category
declare -a QUESTIONS=(
  # === TROUBLESHOOTING / VILLULEIT ===
  "Hvernig finn ég villur í Cloud Run logs?"
  "Hvað geri ég ef gagnagrunnurinn svarar ekki?"
  "Hvernig debugga ég Firebase Functions?"
  "Hvað þýðir 429 villa?"
  "Hvernig finn ég hvers vegna innskráning virkar ekki?"

  # === MONITORING / EFTIRLIT ===
  "Hvernig fylgist ég með afköstum kerfisins?"
  "Hvar sé ég CPU og minni notkun?"
  "Hvernig set ég upp alerts fyrir villur?"
  "Hvað er eðlilegur response time?"

  # === SECURITY / ÖRYGGI ===
  "Hvar eru API lyklar geymdir?"
  "Hvernig virkar rate limiting?"
  "Hvað gerist ef einhver reynir brute force?"
  "Hvernig athuga ég audit logs?"
  "Er gagnagrunnurinn dulkóðaður?"

  # === BACKUP / RECOVERY ===
  "Hvernig er backup háttað?"
  "Hvernig endurheimti ég gögn?"
  "Hvað gerist ef Cloud SQL krassar?"
  "Er disaster recovery plan til staðar?"

  # === SCALING / STÆKKUN ===
  "Hvað gerist ef traffic eykst mikið?"
  "Hvernig skala ég Cloud Run?"
  "Þarf ég að gera eitthvað ef félagafjöldi tvöfaldast?"
  "Hversu marga samtímis notendur ræður kerfið við?"

  # === DATABASE / GAGNAGRUNNUR ===
  "Hvernig tengi ég við gagnagrunninn?"
  "Hvernig keyri ég SQL query?"
  "Hvernig bý ég til nýja töflu?"
  "Hvað er connection pooling?"

  # === DEPLOYMENT / UPPSETNING ===
  "Hvernig rollback-a ég deployment?"
  "Hvernig uppfæri ég bara eina function?"
  "Hvað ef deployment mistekst?"
  "Hvernig prófa ég breytingar fyrir deploy?"

  # === LOGS / LOGGAR ===
  "Hvar eru loggar geymdir?"
  "Hvernig leita ég í loggum?"
  "Hversu lengi eru loggar geymdir?"
  "Hvað á ég að logga?"

  # === COST / KOSTNAÐUR ===
  "Hvað kostar að bæta við nýrri þjónustu?"
  "Hvernig minnka ég Cloud SQL kostnað?"
  "Er ódýrara að nota Firestore?"
  "Hvað kostar hvert API kall?"

  # === INTEGRATIONS / SAMÞÆTTINGAR ===
  "Hvernig virkar Facebook sync?"
  "Hvernig bæti ég við nýju API?"
  "Hvernig tengi ég við ytri þjónustu?"

  # === MAINTENANCE / VIÐHALD ===
  "Hvað þarf ég að gera reglulega?"
  "Hvernig uppfæri ég dependencies?"
  "Þarf ég að uppfæra Node.js?"
  "Hvenær ætti ég að hreinsa gömul gögn?"
)

TOTAL=${#QUESTIONS[@]}
echo -e "${BLUE}$TOTAL kerfisstjóraspurningar til að prófa${NC}"
echo ""

# Allow selecting specific question or range
if [ -n "$1" ]; then
  if [ "$1" == "list" ]; then
    echo -e "${YELLOW}Allar spurningar:${NC}"
    for i in "${!QUESTIONS[@]}"; do
      echo "  $((i+1)). ${QUESTIONS[$i]}"
    done
    exit 0
  fi

  # Single question by number
  IDX=$((${1} - 1))
  if [ $IDX -ge 0 ] && [ $IDX -lt $TOTAL ]; then
    echo -e "${YELLOW}Prófa spurning $1:${NC} ${QUESTIONS[$IDX]}"
    echo ""
    "$TEST_SCRIPT" "${QUESTIONS[$IDX]}"
    exit $?
  else
    echo -e "${RED}Villa: Spurning $1 er ekki til (1-$TOTAL)${NC}"
    exit 1
  fi
fi

# Interactive mode - pick random or sequential
echo -e "${YELLOW}Valmöguleikar:${NC}"
echo "  1) Prófa allar (tekur ~15 mín)"
echo "  2) Prófa 5 handahófskenndar"
echo "  3) Velja flokk"
echo "  4) Sjá lista (./test-kimi-sysadmin.sh list)"
echo ""
echo -n "Val (1-4): "
read -r CHOICE

case $CHOICE in
  1)
    # Run all
    PASSED=0
    FAILED=0
    for i in "${!QUESTIONS[@]}"; do
      QUESTION="${QUESTIONS[$i]}"
      NUM=$((i + 1))
      echo -e "${YELLOW}━━━ $NUM/$TOTAL ━━━${NC}"
      echo -e "${BLUE}$QUESTION${NC}"
      if OUTPUT=$("$TEST_SCRIPT" "$QUESTION" 2>&1); then
        RESPONSE=$(echo "$OUTPUT" | sed -n '/=== Kimi Response ===/,/=====================/p' | grep -v "===")
        echo "$RESPONSE" | head -20
        echo -e "${GREEN}✓${NC}"
        ((PASSED++))
      else
        echo -e "${RED}✗ Villa${NC}"
        ((FAILED++))
      fi
      echo ""
      [ $NUM -lt $TOTAL ] && sleep 3
    done
    echo -e "${CYAN}Niðurstaða: $PASSED/$TOTAL tókust${NC}"
    ;;

  2)
    # Random 5
    echo -e "${YELLOW}Prófa 5 handahófskenndar spurningar...${NC}"
    RANDOM_INDICES=($(shuf -i 0-$((TOTAL-1)) -n 5))
    for IDX in "${RANDOM_INDICES[@]}"; do
      QUESTION="${QUESTIONS[$IDX]}"
      echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
      echo -e "${BLUE}$QUESTION${NC}"
      "$TEST_SCRIPT" "$QUESTION" 2>&1 | sed -n '/=== Kimi Response ===/,/=====================/p' | grep -v "==="
      echo ""
      sleep 3
    done
    ;;

  3)
    # By category
    echo ""
    echo "Flokkar:"
    echo "  1) Villuleit (5 spurningar)"
    echo "  2) Eftirlit (4 spurningar)"
    echo "  3) Öryggi (5 spurningar)"
    echo "  4) Backup (4 spurningar)"
    echo "  5) Stækkun (4 spurningar)"
    echo "  6) Gagnagrunnur (4 spurningar)"
    echo "  7) Deployment (4 spurningar)"
    echo "  8) Loggar (4 spurningar)"
    echo "  9) Kostnaður (4 spurningar)"
    echo "  10) Samþættingar (3 spurningar)"
    echo "  11) Viðhald (4 spurningar)"
    echo -n "Flokkur (1-11): "
    read -r CAT

    case $CAT in
      1) START=0; END=5 ;;
      2) START=5; END=9 ;;
      3) START=9; END=14 ;;
      4) START=14; END=18 ;;
      5) START=18; END=22 ;;
      6) START=22; END=26 ;;
      7) START=26; END=30 ;;
      8) START=30; END=34 ;;
      9) START=34; END=38 ;;
      10) START=38; END=41 ;;
      11) START=41; END=45 ;;
      *) echo "Ógilt val"; exit 1 ;;
    esac

    for ((i=START; i<END; i++)); do
      QUESTION="${QUESTIONS[$i]}"
      echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
      echo -e "${BLUE}$QUESTION${NC}"
      "$TEST_SCRIPT" "$QUESTION" 2>&1 | sed -n '/=== Kimi Response ===/,/=====================/p' | grep -v "==="
      echo ""
      sleep 3
    done
    ;;

  *)
    echo "Ógilt val"
    exit 1
    ;;
esac
