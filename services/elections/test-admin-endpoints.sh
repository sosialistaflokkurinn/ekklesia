#!/bin/bash

# Elections Service - Admin Endpoints Test Script
# Tests all 10 admin CRUD endpoints on deployed Cloud Run service
#
# Usage:
#   1. Get Firebase token from browser console:
#      firebase.auth().currentUser.getIdToken().then(t => console.log(t))
#   2. Run: ./test-admin-endpoints.sh YOUR_FIREBASE_TOKEN

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SERVICE_URL="https://elections-service-ymzrguoifa-nw.a.run.app"
FIREBASE_TOKEN="${1}"

if [ -z "$FIREBASE_TOKEN" ]; then
    echo -e "${RED}Error: Firebase token required${NC}"
    echo ""
    echo "Usage: $0 YOUR_FIREBASE_TOKEN"
    echo ""
    echo "To get token:"
    echo "1. Open browser console (F12)"
    echo "2. Login to https://ekklesia-prod-10-2025.web.app"
    echo "3. Run: firebase.auth().currentUser.getIdToken().then(t => console.log(t))"
    echo "4. Copy the token and run:"
    echo "   $0 <paste-token-here>"
    exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Elections Service - Admin API Tests${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Service URL: $SERVICE_URL"
echo "Token: ${FIREBASE_TOKEN:0:20}...${FIREBASE_TOKEN: -10}"
echo ""

# Test 1: List Elections
echo -e "${YELLOW}Test 1: GET /api/admin/elections (List all elections)${NC}"
curl -X GET "${SERVICE_URL}/api/admin/elections?includeHidden=true" \
  -H "Authorization: Bearer ${FIREBASE_TOKEN}" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  | jq '.' || echo "(Response not JSON)"
echo ""
read -p "Press Enter to continue..."

# Test 2: Get Single Election
echo -e "${YELLOW}Test 2: GET /api/admin/elections/:id (Get election details)${NC}"
echo "Enter election ID (or press Enter to skip):"
read ELECTION_ID
if [ -n "$ELECTION_ID" ]; then
    curl -X GET "${SERVICE_URL}/api/admin/elections/${ELECTION_ID}" \
      -H "Authorization: Bearer ${FIREBASE_TOKEN}" \
      -H "Content-Type: application/json" \
      -w "\nHTTP Status: %{http_code}\n" \
      | jq '.' || echo "(Response not JSON)"
    echo ""
    read -p "Press Enter to continue..."
fi

# Test 3: Create Election (Draft)
echo -e "${YELLOW}Test 3: POST /api/admin/elections (Create new election)${NC}"
NEW_ELECTION=$(cat <<EOF
{
  "title": "Test Admin Election $(date +%s)",
  "question": "Should we test admin endpoints?",
  "description": "Testing admin CRUD operations",
  "answers": [
    {"id": "answer_1", "text": "Yes"},
    {"id": "answer_2", "text": "No"}
  ],
  "voting_type": "single-choice",
  "max_selections": 1
}
EOF
)

CREATED_ELECTION=$(curl -X POST "${SERVICE_URL}/api/admin/elections" \
  -H "Authorization: Bearer ${FIREBASE_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$NEW_ELECTION" \
  -w "\nHTTP Status: %{http_code}\n")

echo "$CREATED_ELECTION" | jq '.' || echo "(Response not JSON)"

# Extract election ID from response
NEW_ELECTION_ID=$(echo "$CREATED_ELECTION" | jq -r '.id // .election_id // empty')
echo ""
echo -e "${GREEN}Created election ID: ${NEW_ELECTION_ID}${NC}"
echo ""
read -p "Press Enter to continue..."

# Test 4: Update Election (Draft)
if [ -n "$NEW_ELECTION_ID" ]; then
    echo -e "${YELLOW}Test 4: PATCH /api/admin/elections/:id (Update draft)${NC}"
    curl -X PATCH "${SERVICE_URL}/api/admin/elections/${NEW_ELECTION_ID}" \
      -H "Authorization: Bearer ${FIREBASE_TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{"description": "Updated description for testing"}' \
      -w "\nHTTP Status: %{http_code}\n" \
      | jq '.' || echo "(Response not JSON)"
    echo ""
    read -p "Press Enter to continue..."
fi

# Test 5: Open Election (Publish)
if [ -n "$NEW_ELECTION_ID" ]; then
    echo -e "${YELLOW}Test 5: POST /api/admin/elections/:id/open (Publish election)${NC}"
    curl -X POST "${SERVICE_URL}/api/admin/elections/${NEW_ELECTION_ID}/open" \
      -H "Authorization: Bearer ${FIREBASE_TOKEN}" \
      -H "Content-Type: application/json" \
      -w "\nHTTP Status: %{http_code}\n" \
      | jq '.' || echo "(Response not JSON)"
    echo ""
    read -p "Press Enter to continue..."
fi

# Test 6: Close Election
if [ -n "$NEW_ELECTION_ID" ]; then
    echo -e "${YELLOW}Test 6: POST /api/admin/elections/:id/close (Close election)${NC}"
    curl -X POST "${SERVICE_URL}/api/admin/elections/${NEW_ELECTION_ID}/close" \
      -H "Authorization: Bearer ${FIREBASE_TOKEN}" \
      -H "Content-Type: application/json" \
      -w "\nHTTP Status: %{http_code}\n" \
      | jq '.' || echo "(Response not JSON)"
    echo ""
    read -p "Press Enter to continue..."
fi

# Test 7: Get Results
if [ -n "$NEW_ELECTION_ID" ]; then
    echo -e "${YELLOW}Test 7: GET /api/admin/elections/:id/results (Get results)${NC}"
    curl -X GET "${SERVICE_URL}/api/admin/elections/${NEW_ELECTION_ID}/results" \
      -H "Authorization: Bearer ${FIREBASE_TOKEN}" \
      -H "Content-Type: application/json" \
      -w "\nHTTP Status: %{http_code}\n" \
      | jq '.' || echo "(Response not JSON)"
    echo ""
    read -p "Press Enter to continue..."
fi

# Test 8: Hide Election (Soft Delete)
if [ -n "$NEW_ELECTION_ID" ]; then
    echo -e "${YELLOW}Test 8: POST /api/admin/elections/:id/hide (Soft delete)${NC}"
    curl -X POST "${SERVICE_URL}/api/admin/elections/${NEW_ELECTION_ID}/hide" \
      -H "Authorization: Bearer ${FIREBASE_TOKEN}" \
      -H "Content-Type: application/json" \
      -w "\nHTTP Status: %{http_code}\n" \
      | jq '.' || echo "(Response not JSON)"
    echo ""
    read -p "Press Enter to continue..."
fi

# Test 9: Unhide Election (Restore)
if [ -n "$NEW_ELECTION_ID" ]; then
    echo -e "${YELLOW}Test 9: POST /api/admin/elections/:id/unhide (Restore)${NC}"
    curl -X POST "${SERVICE_URL}/api/admin/elections/${NEW_ELECTION_ID}/unhide" \
      -H "Authorization: Bearer ${FIREBASE_TOKEN}" \
      -H "Content-Type: application/json" \
      -w "\nHTTP Status: %{http_code}\n" \
      | jq '.' || echo "(Response not JSON)"
    echo ""
    read -p "Press Enter to continue..."
fi

# Test 10: Delete Election (Hard Delete - Superadmin Only)
if [ -n "$NEW_ELECTION_ID" ]; then
    echo -e "${YELLOW}Test 10: DELETE /api/admin/elections/:id (Hard delete - Superadmin only)${NC}"
    echo -e "${RED}WARNING: This permanently deletes the election!${NC}"
    echo "Press Enter to delete, or Ctrl+C to skip..."
    read
    
    curl -X DELETE "${SERVICE_URL}/api/admin/elections/${NEW_ELECTION_ID}" \
      -H "Authorization: Bearer ${FIREBASE_TOKEN}" \
      -H "Content-Type: application/json" \
      -w "\nHTTP Status: %{http_code}\n" \
      | jq '.' || echo "(Response not JSON)"
    echo ""
fi

# Test without authentication (should fail with 401)
echo -e "${YELLOW}Test 11: Endpoint without auth (should return 401)${NC}"
curl -X GET "${SERVICE_URL}/api/admin/elections" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  | jq '.' || echo "(Response not JSON)"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}All tests complete!${NC}"
echo -e "${GREEN}========================================${NC}"
