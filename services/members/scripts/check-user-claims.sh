#!/bin/bash
# Check User Custom Claims Script
#
# Use this script to verify what custom claims a user has.
# Useful for debugging role issues.
#
# Usage:
#   ./check-user-claims.sh <UID>
#
# Example:
#   ./check-user-claims.sh abc123XYZ789ExampleUserUID456

set -e

# Check arguments
if [ $# -lt 1 ]; then
    echo "Usage: $0 <UID>"
    echo ""
    echo "Example:"
    echo "  $0 abc123XYZ789ExampleUserUID456"
    exit 1
fi

UID=$1
PROJECT_ID="ekklesia-prod-10-2025"

echo "Fetching custom claims for user: $UID"
echo ""

# Get access token
TOKEN=$(gcloud auth print-access-token --project=$PROJECT_ID)

# Lookup user
RESPONSE=$(curl -s -X POST "https://identitytoolkit.googleapis.com/v1/projects/$PROJECT_ID/accounts:lookup" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: $PROJECT_ID" \
  -d "{\"localId\":[\"$UID\"]}")

if echo "$RESPONSE" | grep -q "error"; then
    echo "❌ Error fetching user:"
    echo "$RESPONSE" | jq '.'
    exit 1
fi

# Check if user exists
if ! echo "$RESPONSE" | jq -e '.users[0]' > /dev/null 2>&1; then
    echo "❌ User not found: $UID"
    exit 1
fi

# Display user info
echo "User Information:"
echo "$RESPONSE" | jq -r '.users[0] | {
    uid: .localId,
    email: .email,
    displayName: .displayName,
    lastLoginAt: .lastLoginAt,
    createdAt: .createdAt
}'

echo ""
echo "Custom Claims (customAttributes):"
CUSTOM_ATTRS=$(echo "$RESPONSE" | jq -r '.users[0].customAttributes // "{}"')

if [ "$CUSTOM_ATTRS" = "{}" ] || [ -z "$CUSTOM_ATTRS" ]; then
    echo "⚠️  No custom claims set for this user."
else
    echo "$CUSTOM_ATTRS" | jq '.'
fi
