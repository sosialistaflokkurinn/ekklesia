#!/bin/bash
# Helper script to retrieve secrets from Google Cloud Secret Manager
# Usage: ./scripts/get-secret.sh <secret-name>

set -e

SECRET_NAME="$1"

# Source centralized environment variables
source "$(dirname "$0")/set-env.sh"

if [ -z "$SECRET_NAME" ]; then
  echo "Usage: $0 <secret-name>" >&2
  echo "Available secrets: postgres-password, elections-s2s-api-key, kenni-client-secret, cloudflare-api-token" >&2
  exit 1
fi

gcloud secrets versions access latest \
  --secret="$SECRET_NAME" \
  --project="$PROJECT_ID" \
  2>/dev/null
