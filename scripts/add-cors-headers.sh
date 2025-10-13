#!/bin/bash
# Add CORS headers via Cloudflare Transform Rules

CF_TOKEN="gD0MXa-Y6K3n8pDDxbkyJnJuy-YIGl2KTOyD3Rn7"
CF_ZONE="4cab51095e756bd898cc3debec754828"

curl -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/rulesets/phases/http_response_headers_transform/entrypoint" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "rules": [
      {
        "expression": "(http.host in {\"auth.si-xj.org\" \"api.si-xj.org\" \"vote.si-xj.org\" \"verify.si-xj.org\"})",
        "description": "Add CORS headers for all Ekklesia services",
        "action": "rewrite",
        "action_parameters": {
          "headers": {
            "Access-Control-Allow-Origin": {
              "operation": "set",
              "value": "*"
            },
            "Access-Control-Allow-Methods": {
              "operation": "set",
              "value": "GET, POST, OPTIONS"
            },
            "Access-Control-Allow-Headers": {
              "operation": "set",
              "value": "Content-Type, Authorization"
            }
          }
        }
      }
    ]
  }' | jq '.'
