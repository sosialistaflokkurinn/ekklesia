#!/bin/bash
# scripts/database/start-proxy.sh
#
# IMPORTANT: Uses --gcloud-auth to avoid ADC credential issues
# See: scripts/database/README.md - Troubleshooting section

# Source the environment variables
source "$(dirname "$0")/../deployment/set-env.sh"

# Check if proxy already running
if pgrep -f "cloud-sql-proxy.*ekklesia-db" > /dev/null; then
    echo "✅ Proxy already running"
    exit 0
fi

# Start proxy in background with --gcloud-auth flag
# This ensures proxy uses gcloud user credentials instead of ADC
cloud-sql-proxy $DB_CONNECTION_NAME --port 5433 --gcloud-auth &
PROXY_PID=$!

# Wait for startup
echo "⏳ Starting proxy (PID: $PROXY_PID)..."
sleep 3

# Test connection
if psql -h 127.0.0.1 -p 5433 -U postgres -d postgres -c "SELECT 1;" > /dev/null 2> psql_error.log; then
    echo "✅ Proxy started successfully on port 5433"
    echo "💡 Using gcloud user credentials (not ADC)"
else
    PSQL_ERROR=$(cat psql_error.log)
    echo "❌ Proxy failed to start: $PSQL_ERROR"
    rm psql_error.log
    kill $PROXY_PID
    exit 1
fi
