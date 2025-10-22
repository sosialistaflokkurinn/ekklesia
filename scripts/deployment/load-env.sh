#!/bin/bash
# Source this file to load environment variables from Secret Manager
# Usage: source ./scripts/load-env.sh

PROJECT_ID="ekklesia-prod-10-2025"

echo "Loading secrets from Secret Manager..."

export PGPASSWORD=$(gcloud secrets versions access latest --secret=postgres-password --project="$PROJECT_ID" 2>/dev/null)
export ELECTIONS_API_KEY=$(gcloud secrets versions access latest --secret=elections-s2s-api-key --project="$PROJECT_ID" 2>/dev/null)
export CLOUDFLARE_TOKEN=$(gcloud secrets versions access latest --secret=cloudflare-api-token --project="$PROJECT_ID" 2>/dev/null)

echo "✅ Environment variables loaded"
echo "   - PGPASSWORD (${#PGPASSWORD} chars)"
echo "   - ELECTIONS_API_KEY (${#ELECTIONS_API_KEY} chars)"
echo "   - CLOUDFLARE_TOKEN (${#CLOUDFLARE_TOKEN} chars)"
