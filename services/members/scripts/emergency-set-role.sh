#!/bin/bash
# Emergency Role Assignment Script
#
# Use this script when set-user-roles.js fails due to credential issues.
# This uses the Identity Toolkit REST API directly with gcloud credentials.
#
# Usage:
#   ./emergency-set-role.sh <UID> <ROLE> [KENNITALA] [EMAIL] [PHONE]
#
# Example:
#   ./emergency-set-role.sh abc123XYZ789ExampleUserUID456 developer 010190-2939 jon.jonsson@example.com +3545551234
#
# Note: This overwrites ALL custom claims. You must provide all existing claims
# (kennitala, email, phoneNumber, isMember) to avoid losing them.

set -e

# Check arguments
if [ $# -lt 2 ]; then
    echo "Usage: $0 <UID> <ROLE> [KENNITALA] [EMAIL] [PHONE]"
    echo ""
    echo "Examples:"
    echo "  $0 abc123xyz developer"
    echo "  $0 abc123xyz developer 123456-7890 user@example.com +3541234567"
    exit 1
fi

UID=$1
ROLE=$2
KENNITALA=${3:-""}
EMAIL=${4:-""}
PHONE=${5:-""}

# Source centralized environment variables
source "$(dirname "$0")/../../../scripts/deployment/set-env.sh"

echo "⚠️  WARNING: This script overwrites ALL custom claims."
echo ""
echo "User ID: $UID"
echo "Role to set: $ROLE"
echo "Kennitala: ${KENNITALA:-"(not provided - will be lost if exists)"}"
echo "Email: ${EMAIL:-"(not provided - will be lost if exists)"}"
echo "Phone: ${PHONE:-"(not provided - will be lost if exists)"}"
echo ""
read -p "Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

# Get access token
echo "Getting access token..."
TOKEN=$(gcloud auth print-access-token --project=$PROJECT_ID)

# Build custom attributes JSON
CUSTOM_ATTRS="{\"roles\":[\"$ROLE\"]"

if [ -n "$KENNITALA" ]; then
    CUSTOM_ATTRS="$CUSTOM_ATTRS,\"kennitala\":\"$KENNITALA\""
fi

if [ -n "$EMAIL" ]; then
    CUSTOM_ATTRS="$CUSTOM_ATTRS,\"email\":\"$EMAIL\""
fi

if [ -n "$PHONE" ]; then
    CUSTOM_ATTRS="$CUSTOM_ATTRS,\"phoneNumber\":\"$PHONE\""
fi

CUSTOM_ATTRS="$CUSTOM_ATTRS,\"isMember\":true}"

echo "Setting custom claims..."
RESPONSE=$(curl -s -X POST "https://identitytoolkit.googleapis.com/v1/projects/$PROJECT_ID/accounts:update" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: $PROJECT_ID" \
  -d "{\"localId\":\"$UID\",\"customAttributes\":\"$CUSTOM_ATTRS\"}")

if echo "$RESPONSE" | grep -q "error"; then
    echo "❌ Error setting custom claims:"
    echo "$RESPONSE" | jq '.'
    exit 1
fi

echo "✅ Custom claims set successfully!"
echo ""
echo "Response:"
echo "$RESPONSE" | jq '.'
echo ""
echo "⚠️  User must sign out and sign in again for changes to take effect."
