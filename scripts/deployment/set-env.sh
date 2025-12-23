#!/bin/bash
#
# Ekklesia Deployment Configuration
# Single source of truth for critical environment variables.
#
# Usage: source this file from other scripts
#   source "$(dirname "$0")/../../scripts/deployment/set-env.sh"
#
# This script is meant to be sourced by other scripts, not executed directly.
# It exports environment variables that are used across all deployment scripts.

# Core GCP Configuration
export PROJECT_ID="ekklesia-prod-10-2025"
export REGION="europe-west1"
export DB_INSTANCE="ekklesia-db-eu1"

# Validation - Check all required variables are set before deriving others
if [ -z "$PROJECT_ID" ]; then
  echo "ERROR: PROJECT_ID is not set in scripts/deployment/set-env.sh" >&2
  echo "       This should never happen - check the file for corruption." >&2
  return 1
fi

if [ -z "$REGION" ]; then
  echo "ERROR: REGION is not set in scripts/deployment/set-env.sh" >&2
  echo "       This should never happen - check the file for corruption." >&2
  return 1
fi

if [ -z "$DB_INSTANCE" ]; then
  echo "ERROR: DB_INSTANCE is not set in scripts/deployment/set-env.sh" >&2
  echo "       This should never happen - check the file for corruption." >&2
  return 1
fi

# Derived Configuration - Only create after validation passes
# Cloud SQL connection string format: PROJECT_ID:REGION:INSTANCE_NAME
export DB_CONNECTION_NAME="${PROJECT_ID}:${REGION}:${DB_INSTANCE}"

# Success indicator (optional, for debugging)
# Uncomment to see when this file is sourced:
# echo "✅ Environment variables loaded: PROJECT_ID=$PROJECT_ID, REGION=$REGION, DB_CONNECTION_NAME=$DB_CONNECTION_NAME" >&2
