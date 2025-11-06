#!/bin/bash
# Helper script for PostgreSQL connections using Cloud SQL Proxy
# Retrieves password from Secret Manager automatically
# Usage: ./scripts/psql-cloud.sh [psql arguments]

set -e

# Source centralized environment variables
source "$(dirname "$0")/../deployment/set-env.sh"

DB_PASSWORD=$(gcloud secrets versions access latest \
  --secret=postgres-password \
  --project="$PROJECT_ID" \
  2>/dev/null)

# Default connection via Cloud SQL Proxy
export PGPASSWORD="$DB_PASSWORD"
psql -h 127.0.0.1 -p 5433 -U postgres -d postgres "$@"
