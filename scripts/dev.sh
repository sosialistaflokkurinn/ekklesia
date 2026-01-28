#!/bin/bash
# Ekklesia — Full local development stack
#
# Starts:
#   1. PostgreSQL 15 via Podman Compose (port 5433)
#   2. Firebase Emulators: Firestore (8081), Functions (5001), Hosting (5000), UI (4000)
#   3. Elections service (port 8082)
#   4. Events service (port 8080)
#
# NOTE: Auth emulator is NOT used — Kenni.is OAuth requires real Firebase Auth.
#       The frontend uses production Firebase Auth even in local development.
#
# Usage:
#   ./scripts/dev.sh          # Start everything
#   ./scripts/dev.sh --db     # Only start PostgreSQL
#
# Prerequisites:
#   - Podman + podman-compose (for PostgreSQL)
#   - Firebase CLI (npm i -g firebase-tools)
#   - Java 11+ (for Firebase Emulators)
#   - Node.js 18+
#   - .env files in svc-elections/ and svc-events/ (copy from .env.local.example)
#
# Troubleshooting:
#   If login fails with "auth/network-request-failed", clear browser storage:
#   - Open DevTools > Application > Storage > Clear site data
#   - This clears cached Firebase Auth emulator config from previous sessions

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PIDS=()

cleanup() {
  echo ""
  echo -e "${YELLOW}Shutting down...${NC}"
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
    fi
  done
  echo -e "${GREEN}Done.${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM

# ---- 1. PostgreSQL ----
echo -e "${CYAN}[1/4] Starting PostgreSQL...${NC}"
podman-compose up -d

echo -n "  Waiting for Postgres"
until podman-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; do
  echo -n "."
  sleep 1
done
echo -e " ${GREEN}ready${NC}"

if [ "$1" = "--db" ]; then
  echo -e "${GREEN}PostgreSQL running on port 5433. Ctrl+C to stop.${NC}"
  wait
  exit 0
fi

# ---- 2. Firebase Emulators ----
echo -e "${CYAN}[2/4] Starting Firebase Emulators...${NC}"
(cd services/svc-members && firebase emulators:start 2>&1 | sed 's/^/  [emulators] /') &
PIDS+=($!)
sleep 3

# ---- 3. Check .env files exist ----
check_env() {
  local svc_dir="$1"
  local svc_name="$2"
  if [ ! -f "$svc_dir/.env" ]; then
    echo -e "${YELLOW}  Warning: $svc_dir/.env not found.${NC}"
    echo -e "${YELLOW}  Run: cp $svc_dir/.env.local.example $svc_dir/.env${NC}"
    return 1
  fi
  return 0
}

# ---- 4. Elections service ----
echo -e "${CYAN}[3/4] Starting Elections service (port 8082)...${NC}"
if check_env "services/svc-elections" "elections"; then
  (cd services/svc-elections && npm run dev 2>&1 | sed 's/^/  [elections] /') &
  PIDS+=($!)
fi

# ---- 5. Events service ----
echo -e "${CYAN}[4/4] Starting Events service (port 8080)...${NC}"
if check_env "services/svc-events" "events"; then
  (cd services/svc-events && npm run dev 2>&1 | sed 's/^/  [events] /') &
  PIDS+=($!)
fi

echo ""
echo -e "${GREEN}=== Local stack running ===${NC}"
echo -e "  Frontend:          ${CYAN}http://localhost:5000${NC}"
echo -e "  Emulator UI:       ${CYAN}http://localhost:4000${NC}"
echo -e "  Elections API:     ${CYAN}http://localhost:8082${NC}"
echo -e "  Events API:        ${CYAN}http://localhost:8080${NC}"
echo -e "  PostgreSQL:        ${CYAN}localhost:5433${NC}"
echo ""
echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop all services."
echo ""

wait
