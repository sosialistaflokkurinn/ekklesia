#!/bin/bash
# Update Cloudflare DNS records to point to correct Cloud Run URLs

set -e

CF_TOKEN="oKBpSo8FOyZ9w6v17WRcXsBoX3U8ZaxyTOrVX1i8"
CF_ZONE="4cab51095e756bd898cc3debec754828"

# Cloud Run URLs (from production)
AUTH_URL="handlekenniauth-ymzrguoifa-nw.a.run.app"
VERIFY_URL="verifymembership-ymzrguoifa-nw.a.run.app"
API_URL="events-service-ymzrguoifa-nw.a.run.app"
VOTE_URL="elections-service-ymzrguoifa-nw.a.run.app"

echo "=== Getting DNS record IDs ==="
AUTH_RECORD_ID=$(curl -s "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records?name=auth.si-xj.org" -H "Authorization: Bearer $CF_TOKEN" | jq -r '.result[0].id')
VERIFY_RECORD_ID=$(curl -s "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records?name=verify.si-xj.org" -H "Authorization: Bearer $CF_TOKEN" | jq -r '.result[0].id')
API_RECORD_ID=$(curl -s "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records?name=api.si-xj.org" -H "Authorization: Bearer $CF_TOKEN" | jq -r '.result[0].id')
VOTE_RECORD_ID=$(curl -s "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records?name=vote.si-xj.org" -H "Authorization: Bearer $CF_TOKEN" | jq -r '.result[0].id')

echo "auth.si-xj.org: $AUTH_RECORD_ID"
echo "verify.si-xj.org: $VERIFY_RECORD_ID"
echo "api.si-xj.org: $API_RECORD_ID"
echo "vote.si-xj.org: $VOTE_RECORD_ID"
echo ""

echo "=== Updating DNS records ==="
echo "Updating auth.si-xj.org → $AUTH_URL"
curl -s -X PATCH "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records/$AUTH_RECORD_ID" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"type":"CNAME","name":"auth","content":"'$AUTH_URL'","ttl":1,"proxied":true}' | jq '.success'

echo "Updating verify.si-xj.org → $VERIFY_URL"
curl -s -X PATCH "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records/$VERIFY_RECORD_ID" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"type":"CNAME","name":"verify","content":"'$VERIFY_URL'","ttl":1,"proxied":true}' | jq '.success'

echo "Updating api.si-xj.org → $API_URL"
curl -s -X PATCH "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records/$API_RECORD_ID" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"type":"CNAME","name":"api","content":"'$API_URL'","ttl":1,"proxied":true}' | jq '.success'

echo "Updating vote.si-xj.org → $VOTE_URL"
curl -s -X PATCH "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records/$VOTE_RECORD_ID" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"type":"CNAME","name":"vote","content":"'$VOTE_URL'","ttl":1,"proxied":true}' | jq '.success'

echo ""
echo "=== DNS records updated successfully ==="
echo "Waiting 30 seconds for propagation..."
sleep 30

echo ""
echo "=== Testing DNS resolution ==="
curl -I https://auth.si-xj.org/ 2>&1 | head -1
curl -I https://api.si-xj.org/health 2>&1 | head -1
curl -I https://vote.si-xj.org/health 2>&1 | head -1
curl -I https://verify.si-xj.org/health 2>&1 | head -1

echo ""
echo "✅ Done! DNS records updated."
