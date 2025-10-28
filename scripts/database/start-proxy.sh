#!/bin/bash
# scripts/database/start-proxy.sh

# Check if proxy already running
if pgrep -f "cloud-sql-proxy.*ekklesia-db" > /dev/null; then
    echo "✅ Proxy already running"
    exit 0
fi

# Start proxy in background
cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:ekklesia-db --port 5432 &
PROXY_PID=$!

# Wait for startup
echo "⏳ Starting proxy (PID: $PROXY_PID)..."
sleep 3

# Test connection
if psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Proxy started successfully"
else
    echo "❌ Proxy failed to start"
    kill $PROXY_PID
    exit 1
fi
