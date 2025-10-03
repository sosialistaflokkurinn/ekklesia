#!/bin/bash

# Add gudrodur@gmail.com to Ekklesia organization

TOKEN="jmZEli4KItLLXm7n860tZCGFXPZuCfBkBDB-x81GarHJ048gvrju4nOjspXFzrs40eKk0Bw"
URL="https://zitadel-ymzrguoifa-nw.a.run.app"
USER_ID="340504966944793723"  # gudrodur@gmail.com

echo "Adding gudrodur@gmail.com to Ekklesia organization..."

# Add user as organization member with ORG_OWNER role
curl -X POST \
  "${URL}/management/v1/orgs/me/members" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'${USER_ID}'",
    "roles": ["ORG_OWNER"]
  }' | jq '.'

echo ""
echo "✅ User added to organization!"
echo ""
echo "Now try logging in again with Kenni.is at:"
echo "https://auth.si-xj.org/ui/console"
