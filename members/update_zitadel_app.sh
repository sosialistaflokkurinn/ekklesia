#!/bin/bash

# Update Members app in ZITADEL with correct redirect URIs

ZITADEL_URL="https://zitadel-ymzrguoifa-nw.a.run.app"
ZITADEL_TOKEN="jmZEli4KItLLXm7n860tZCGFXPZuCfBkBDB-x81GarHJ048gvrju4nOjspXFzrs40eKk0Bw"
PROJECT_ID="338582775940525773"
APP_ID="338586423189856794"

echo "Updating Members app in ZITADEL..."
echo "Project ID: $PROJECT_ID"
echo "App ID: $APP_ID"
echo ""

# Update the OIDC app configuration
curl -X PUT \
  "${ZITADEL_URL}/management/v1/projects/${PROJECT_ID}/apps/oidc/${APP_ID}/config" \
  -H "Authorization: Bearer ${ZITADEL_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "redirectUris": [
      "https://members-ymzrguoifa-nw.a.run.app/callback",
      "http://localhost:3000/callback"
    ],
    "postLogoutRedirectUris": [
      "https://members-ymzrguoifa-nw.a.run.app",
      "http://localhost:3000"
    ],
    "responseTypes": ["OIDC_RESPONSE_TYPE_CODE"],
    "grantTypes": ["OIDC_GRANT_TYPE_AUTHORIZATION_CODE"],
    "appType": "OIDC_APP_TYPE_USER_AGENT",
    "authMethodType": "OIDC_AUTH_METHOD_TYPE_NONE",
    "version": "OIDC_VERSION_1_0",
    "devMode": false,
    "accessTokenType": "OIDC_TOKEN_TYPE_JWT",
    "accessTokenRoleAssertion": false,
    "idTokenRoleAssertion": false,
    "idTokenUserinfoAssertion": true,
    "clockSkew": "0s",
    "additionalOrigins": [],
    "skipNativeAppSuccessPage": false
  }' | jq '.'

echo ""
echo "✅ App configuration updated!"
echo ""
echo "Redirect URIs:"
echo "  - https://members-ymzrguoifa-nw.a.run.app/callback"
echo "  - http://localhost:3000/callback"
echo ""
echo "Post-Logout URIs:"
echo "  - https://members-ymzrguoifa-nw.a.run.app"
echo "  - http://localhost:3000"
