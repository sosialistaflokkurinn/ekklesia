#!/bin/bash

# Create Members app in ZITADEL

ZITADEL_URL="https://auth.si-xj.org"
ZITADEL_TOKEN="jmZEli4KItLLXm7n860tZCGFXPZuCfBkBDB-x81GarHJ048gvrju4nOjspXFzrs40eKk0Bw"
PROJECT_ID="338582775940525773"  # Ekklesia project

echo "Creating Members OIDC app in ZITADEL..."
echo "Project ID: $PROJECT_ID"
echo ""

# Create the OIDC app
curl -X POST \
  "${ZITADEL_URL}/management/v1/projects/${PROJECT_ID}/apps/oidc" \
  -H "Authorization: Bearer ${ZITADEL_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Members",
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
echo "✅ Members app created!"
