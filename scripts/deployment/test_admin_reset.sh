#!/bin/bash
#
# Admin Reset Endpoint Test Script
#
# Usage: FIREBASE_TOKEN="<your-id-token>" ./scripts/test_admin_reset.sh
#
# Purpose: Validate admin reset endpoint with both scope="mine" and scope="all"
# Reference: docs/testing/ADMIN_RESET_CHECKLIST.md

set -euo pipefail

EVENTS_SERVICE_URL="https://events-service-ymzrguoifa-nw.a.run.app"

echo "=========================================="
echo "Admin Reset Endpoint Test"
echo "=========================================="
echo ""

# Check if token is provided
if [ -z "${FIREBASE_TOKEN:-}" ]; then
  echo "❌ ERROR: FIREBASE_TOKEN not set"
  echo ""
  echo "Get your Firebase ID token from browser Network tab:"
  echo "1. Log in to https://ekklesia-prod-10-2025.web.app"
  echo "2. Open Developer Tools → Network tab"
  echo "3. Find request to 'handlekenniauth' endpoint"
  echo "4. Copy the 'idToken' from response"
  echo ""
  echo "Then run:"
  echo "  export FIREBASE_TOKEN='<your-id-token>'"
  echo "  $0"
  exit 1
fi

echo "✅ Firebase token loaded"
echo ""

# Test 1: scope="mine" (should succeed)
echo "=========================================="
echo "TEST 1: Reset with scope='mine' (SHOULD SUCCEED)"
echo "=========================================="
echo ""

response1=$(curl -s -w "\n%{http_code}" -X POST \
  "${EVENTS_SERVICE_URL}/api/admin/reset-election" \
  -H "Authorization: Bearer ${FIREBASE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"scope": "mine"}')

http_code1=$(echo "$response1" | tail -n 1)
body1=$(echo "$response1" | head -n -1)

echo "HTTP Status: $http_code1"
echo "Response:"
echo "$body1" | jq . 2>/dev/null || echo "$body1"
echo ""

if [ "$http_code1" = "200" ]; then
  echo "✅ TEST 1 PASSED: scope='mine' succeeded"
else
  echo "❌ TEST 1 FAILED: Expected 200, got $http_code1"
fi

echo ""
echo "=========================================="
echo "TEST 2: Reset with scope='all' (SHOULD BE BLOCKED)"
echo "=========================================="
echo ""

# Wait a second between requests
sleep 1

response2=$(curl -s -w "\n%{http_code}" -X POST \
  "${EVENTS_SERVICE_URL}/api/admin/reset-election" \
  -H "Authorization: Bearer ${FIREBASE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"scope": "all", "confirm": "RESET ALL"}')

http_code2=$(echo "$response2" | tail -n 1)
body2=$(echo "$response2" | head -n -1)

echo "HTTP Status: $http_code2"
echo "Response:"
echo "$body2" | jq . 2>/dev/null || echo "$body2"
echo ""

if [ "$http_code2" = "403" ]; then
  echo "✅ TEST 2 PASSED: scope='all' blocked by guardrail"
else
  echo "❌ TEST 2 FAILED: Expected 403, got $http_code2"
fi

echo ""
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo "Test 1 (scope=mine):  $([ "$http_code1" = "200" ] && echo "✅ PASSED" || echo "❌ FAILED")"
echo "Test 2 (scope=all):   $([ "$http_code2" = "403" ] && echo "✅ PASSED" || echo "❌ FAILED")"
echo ""
echo "Next steps:"
echo "1. Capture audit logs:"
echo "   gcloud logging read \\"
echo "     'resource.type=cloud_run_revision AND resource.labels.service_name=events-service AND jsonPayload.message:reset' \\"
echo "     --limit=10 --format=json --project=ekklesia-prod-10-2025"
echo ""
echo "2. Update test report: docs/testing/ADMIN_RESET_TEST_REPORT.md"
echo ""
echo "3. See full checklist: docs/testing/ADMIN_RESET_CHECKLIST.md"
echo ""
