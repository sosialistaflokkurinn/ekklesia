#!/bin/bash
# Interactive Kimi chat session with full system context
# Usage: ./test-kimi-interactive.sh
#
# Type your questions and get responses. Type 'quit' or 'exit' to stop.

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║           Kimi Interactive Chat (System Context)           ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Type your questions. Type 'quit' or 'exit' to stop.${NC}"
echo -e "${YELLOW}Type 'clear' to start a new conversation.${NC}"
echo ""

# Get API key
echo -e "${BLUE}Fetching API key...${NC}"
KIMI_API_KEY=$(gcloud secrets versions access latest --secret=kimi-api-key 2>/dev/null)

if [ -z "$KIMI_API_KEY" ]; then
  echo -e "${RED}Error: Could not fetch KIMI_API_KEY. Run: gcloud auth login${NC}"
  exit 1
fi

echo -e "${GREEN}Ready!${NC}"
echo ""

# System prompt
read -r -d '' SYSTEM_PROMPT << 'SYSPROMPT' || true
Þú ert Kimi, kerfisstjórnunaraðstoðarmaður og sérfræðingur í Ekklesia kóðagrunni.

## Kerfisarkitektúr
- Firebase Hosting: Frontend (ekklesia-prod-10-2025.web.app)
- Firebase Functions (svc-members): Python 3.12 - Auth, membership, email (47 functions)
- Cloud Run (svc-events): Node.js v20 - Viðburðir, Facebook sync, Kimi
- Cloud Run (svc-elections): Node.js v20 - Atkvæðagreiðslur
- Cloud SQL PostgreSQL: Aðalgagnagrunnur (europe-west1)
- Firestore: Sessions, audit logs
- SendGrid: Tölvupóstur (free tier)

## Tækniákvarðanir
- Vanilla ES6 JavaScript (ekki React) - einfaldara, enginn build step
- Ekki TypeScript - sveigjanleiki, JSDoc notað
- Vanilla CSS - ekkert build step, læsilegra
- Monorepo - samræmd þróun
- 7/10 nútímalegt kerfi

## Kostnaður (~$18-27/mán)
- Cloud SQL: ~$15-20/mán
- Cloud Run: ~$2-5/mán
- Firebase: ~$0-1/mán (free tier)
- SendGrid: ~$0 (free tier)

## VM vs Serverless
- Serverless: Auto-scaling, engin viðhald, HA
- VM: Ódýrara (~$5-15/mán) en handvirkt viðhald

Svaraðu á íslensku, stuttlega og hnitmiðað.
SYSPROMPT

# Initialize conversation history as JSON array
HISTORY="[]"

while true; do
  echo -e -n "${GREEN}Þú:${NC} "
  read -r USER_INPUT

  # Check for exit commands
  if [[ "$USER_INPUT" == "quit" ]] || [[ "$USER_INPUT" == "exit" ]]; then
    echo -e "${CYAN}Bless!${NC}"
    exit 0
  fi

  # Check for clear command
  if [[ "$USER_INPUT" == "clear" ]]; then
    HISTORY="[]"
    echo -e "${YELLOW}Samtal hreinsað.${NC}"
    echo ""
    continue
  fi

  # Skip empty input
  if [ -z "$USER_INPUT" ]; then
    continue
  fi

  # Build messages array with history
  SYSTEM_ESCAPED=$(echo "$SYSTEM_PROMPT" | jq -Rs .)
  USER_ESCAPED=$(echo "$USER_INPUT" | jq -Rs .)

  # Build full messages array
  MESSAGES=$(jq -n \
    --argjson history "$HISTORY" \
    --argjson system "$SYSTEM_ESCAPED" \
    --argjson user "$USER_ESCAPED" \
    '[{role: "system", content: $system}] + $history + [{role: "user", content: $user}]')

  # Make API call
  RESPONSE=$(curl -s -X POST "https://api.moonshot.ai/v1/chat/completions" \
    -H "Authorization: Bearer $KIMI_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"model\": \"kimi-k2-0711-preview\",
      \"messages\": $MESSAGES,
      \"temperature\": 0.7,
      \"max_tokens\": 2000
    }" 2>&1)

  # Check for errors
  if echo "$RESPONSE" | grep -q '"error"'; then
    echo -e "${RED}Villa:${NC}"
    echo "$RESPONSE" | jq -r '.error.message // .error // .' 2>/dev/null
    echo ""
    continue
  fi

  # Extract reply
  REPLY=$(echo "$RESPONSE" | jq -r '.choices[0].message.content' 2>/dev/null)

  if [ -z "$REPLY" ] || [ "$REPLY" == "null" ]; then
    echo -e "${RED}Tómt svar frá Kimi${NC}"
    echo ""
    continue
  fi

  # Display reply
  echo ""
  echo -e "${BLUE}Kimi:${NC} $REPLY"
  echo ""

  # Update history (keep last 10 exchanges)
  HISTORY=$(echo "$HISTORY" | jq \
    --arg user "$USER_INPUT" \
    --arg assistant "$REPLY" \
    '. + [{role: "user", content: $user}, {role: "assistant", content: $assistant}] | .[-20:]')
done
