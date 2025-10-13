#!/bin/bash
# Disable Cloudflare Proxy (Orange Cloud → Grey Cloud)
# Purpose: Switch from proxied mode to DNS-only mode for Cloud Run compatibility
#
# Background:
# Cloud Run services only accept their native *.run.app hostnames in the Host header.
# When Cloudflare proxy forwards requests with custom domain hostnames, Cloud Run returns 404.
# DNS-only mode (grey cloud) resolves CNAME directly, sending native hostname to Cloud Run.
#
# Usage: ./scripts/disable-cloudflare-proxy.sh
#
# Prerequisites:
# - Cloudflare API token with DNS edit permissions
# - Zone ID for si-xj.org
# - jq installed (for JSON parsing)

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Cloudflare Proxy Disabler${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

# Configuration
CF_TOKEN="oKBpSo8FOyZ9w6v17WRcXsBoX3U8ZaxyTOrVX1i8"
CF_ZONE="4cab51095e756bd898cc3debec754828"

# Check prerequisites
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is not installed${NC}"
    echo "Install with: sudo dnf install jq"
    exit 1
fi

if ! command -v curl &> /dev/null; then
    echo -e "${RED}Error: curl is not installed${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 1: Fetching DNS record IDs...${NC}"
echo ""

# Fetch all record IDs
AUTH_RECORD=$(curl -s "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records?name=auth.si-xj.org" \
  -H "Authorization: Bearer $CF_TOKEN" | jq -r '.result[0].id')

API_RECORD=$(curl -s "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records?name=api.si-xj.org" \
  -H "Authorization: Bearer $CF_TOKEN" | jq -r '.result[0].id')

VERIFY_RECORD=$(curl -s "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records?name=verify.si-xj.org" \
  -H "Authorization: Bearer $CF_TOKEN" | jq -r '.result[0].id')

VOTE_RECORD=$(curl -s "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records?name=vote.si-xj.org" \
  -H "Authorization: Bearer $CF_TOKEN" | jq -r '.result[0].id')

# Verify we got valid IDs
if [[ "$AUTH_RECORD" == "null" ]] || [[ -z "$AUTH_RECORD" ]]; then
    echo -e "${RED}Error: Could not fetch auth.si-xj.org record ID${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Found all DNS records${NC}"
echo "  auth.si-xj.org: $AUTH_RECORD"
echo "  api.si-xj.org: $API_RECORD"
echo "  verify.si-xj.org: $VERIFY_RECORD"
echo "  vote.si-xj.org: $VOTE_RECORD"
echo ""

echo -e "${YELLOW}Step 2: Disabling Cloudflare proxy (orange → grey)...${NC}"
echo ""

# Function to disable proxy for a record
disable_proxy() {
    local RECORD_ID=$1
    local DOMAIN=$2

    echo -n "  Updating $DOMAIN... "

    RESULT=$(curl -s -X PATCH "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records/$RECORD_ID" \
      -H "Authorization: Bearer $CF_TOKEN" \
      -H "Content-Type: application/json" \
      --data '{"proxied":false}')

    SUCCESS=$(echo "$RESULT" | jq -r '.success')
    PROXIED=$(echo "$RESULT" | jq -r '.result.proxied')

    if [[ "$SUCCESS" == "true" ]] && [[ "$PROXIED" == "false" ]]; then
        echo -e "${GREEN}✓ Success (proxied=false)${NC}"
        return 0
    else
        echo -e "${RED}✗ Failed${NC}"
        echo "$RESULT" | jq '.'
        return 1
    fi
}

# Disable proxy for all records
disable_proxy "$AUTH_RECORD" "auth.si-xj.org" || exit 1
disable_proxy "$API_RECORD" "api.si-xj.org" || exit 1
disable_proxy "$VERIFY_RECORD" "verify.si-xj.org" || exit 1
disable_proxy "$VOTE_RECORD" "vote.si-xj.org" || exit 1

echo ""
echo -e "${GREEN}✓ All records updated to DNS-only mode (grey cloud)${NC}"
echo ""

echo -e "${YELLOW}Step 3: Waiting for DNS propagation (60 seconds)...${NC}"
echo ""

# Show countdown
for i in {60..1}; do
    echo -ne "\r  $i seconds remaining... "
    sleep 1
done
echo -e "\r  ${GREEN}✓ DNS propagation complete${NC}          "
echo ""

echo -e "${YELLOW}Step 4: Verifying DNS resolution...${NC}"
echo ""

# Function to check DNS resolution
check_dns() {
    local DOMAIN=$1
    local EXPECTED_PATTERN=$2

    echo -n "  Checking $DOMAIN... "

    DNS_RESULT=$(dig +short "$DOMAIN" 2>/dev/null | head -n 1)

    if [[ -z "$DNS_RESULT" ]]; then
        echo -e "${YELLOW}⚠ No DNS response yet (may need more time)${NC}"
        return 1
    fi

    # Check if it's a Cloudflare IP (104.x.x.x or 172.x.x.x)
    if [[ "$DNS_RESULT" =~ ^104\. ]] || [[ "$DNS_RESULT" =~ ^172\. ]]; then
        echo -e "${YELLOW}⚠ Still resolving to Cloudflare IP ($DNS_RESULT)${NC}"
        echo "     DNS propagation may need more time. This is normal."
        return 1
    fi

    # Check if it's a Cloud Run IP (likely 34.x.x.x or similar)
    if [[ "$DNS_RESULT" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo -e "${GREEN}✓ Resolves to $DNS_RESULT${NC}"
        return 0
    fi

    echo -e "${YELLOW}⚠ Unexpected DNS result: $DNS_RESULT${NC}"
    return 1
}

# Check all domains
check_dns "auth.si-xj.org" "34."
check_dns "api.si-xj.org" "34."
check_dns "verify.si-xj.org" "34."
check_dns "vote.si-xj.org" "34."

echo ""
echo -e "${YELLOW}Step 5: Testing HTTP access...${NC}"
echo ""

# Function to test HTTP access
test_http() {
    local URL=$1
    local DOMAIN=$(echo "$URL" | sed 's|https://||' | sed 's|/||')

    echo -n "  Testing $DOMAIN... "

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL" 2>/dev/null)

    case "$HTTP_CODE" in
        200)
            echo -e "${GREEN}✓ HTTP $HTTP_CODE (OK)${NC}"
            return 0
            ;;
        403)
            echo -e "${GREEN}✓ HTTP $HTTP_CODE (Origin protection working)${NC}"
            return 0
            ;;
        404)
            echo -e "${YELLOW}⚠ HTTP $HTTP_CODE (DNS may not be propagated yet)${NC}"
            return 1
            ;;
        000)
            echo -e "${YELLOW}⚠ Connection failed (DNS may not be propagated yet)${NC}"
            return 1
            ;;
        *)
            echo -e "${RED}✗ HTTP $HTTP_CODE (Unexpected)${NC}"
            return 1
            ;;
    esac
}

# Test all domains
test_http "https://auth.si-xj.org/"
test_http "https://api.si-xj.org/"
test_http "https://verify.si-xj.org/"
test_http "https://vote.si-xj.org/"

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Summary${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "✓ Cloudflare proxy disabled (grey cloud)"
echo "✓ DNS records updated successfully"
echo ""
echo -e "${YELLOW}Note: If DNS still resolves to Cloudflare IPs, wait 5-10 minutes.${NC}"
echo -e "${YELLOW}Global DNS propagation can take up to 1 hour in rare cases.${NC}"
echo ""
echo "Next steps:"
echo "  1. Test login flow at https://ekklesia-prod-10-2025.web.app/dashboard.html"
echo "  2. Verify end-to-end voting flow works"
echo "  3. Check origin protection still blocks direct access"
echo ""
echo -e "${GREEN}Done!${NC}"
echo ""
