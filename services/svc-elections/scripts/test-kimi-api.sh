#!/bin/bash
# Test Kimi API directly
# Usage: ./test-kimi-api.sh "Your message here"

set -e

# Get API key from GCP secrets
echo "Fetching KIMI_API_KEY from GCP secrets..."
KIMI_API_KEY=$(gcloud secrets versions access latest --secret=kimi-api-key 2>/dev/null)

if [ -z "$KIMI_API_KEY" ]; then
  echo "Error: Could not fetch KIMI_API_KEY from GCP secrets"
  exit 1
fi

echo "API key fetched successfully (length: ${#KIMI_API_KEY})"

# Default message if none provided
MESSAGE="${1:-Hæ! Geturðu sagt mér hvað þú heitir og hvaða líkan þú notar?}"

echo ""
echo "Sending message to Kimi API..."
echo "Message: $MESSAGE"
echo ""

# Make API call
RESPONSE=$(curl -s -X POST "https://api.moonshot.ai/v1/chat/completions" \
  -H "Authorization: Bearer $KIMI_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"kimi-k2-0711-preview\",
    \"messages\": [
      {\"role\": \"user\", \"content\": \"$MESSAGE\"}
    ],
    \"temperature\": 0.7,
    \"max_tokens\": 2000
  }" 2>&1)

# Check for errors
if echo "$RESPONSE" | grep -q '"error"'; then
  echo "ERROR from Kimi API:"
  echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
  exit 1
fi

# Extract and display reply
echo "=== Kimi Response ==="
echo "$RESPONSE" | jq -r '.choices[0].message.content' 2>/dev/null || echo "$RESPONSE"
echo "===================="
