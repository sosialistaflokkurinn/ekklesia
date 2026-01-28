#!/bin/bash
# Local development database initialization
# Runs automatically on first docker compose up via postgres entrypoint.
#
# Creates:
#   - elections schema (used by svc-elections)
#   - socialism user (used by svc-events in production)
#   - All migrations for both services
#
# To re-run: podman-compose down -v && podman-compose up -d

set -e

echo "=== Ekklesia local dev DB init ==="

# --- Create socialism user (used by svc-events) ---
echo "Creating socialism user..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-SQL
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'socialism') THEN
      CREATE ROLE socialism WITH LOGIN PASSWORD 'localdev';
    END IF;
  END
  \$\$;
  GRANT ALL PRIVILEGES ON DATABASE postgres TO socialism;

  -- Roles referenced by migrations
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'elections_member_role') THEN
      CREATE ROLE elections_member_role;
    END IF;
  END
  \$\$;
SQL

# Production ran migrations interleaved across services. For local dev we
# replay them in three phases to satisfy cross-service dependencies:
#   Phase 1: events 001-004  (creates tables in public, moves to elections schema)
#   Phase 2: elections 001-010 (creates elections.elections + more tables)
#   Phase 3: events 005-013  (references elections.elections from phase 2)

echo "Running events migrations (phase 1: 001-004)..."
for f in /migrations/events/001_*.sql /migrations/events/002_*.sql /migrations/events/003_*.sql /migrations/events/004_*.sql; do
  if [ -f "$f" ]; then
    echo "  -> $(basename "$f")"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f"
  fi
done

echo "Running elections migrations (phase 2: 001-010)..."
for f in /migrations/elections/*.sql; do
  if [ -f "$f" ]; then
    echo "  -> $(basename "$f")"
    psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f" 2>&1 || echo "  (warning: $(basename "$f") had non-fatal errors, continuing)"
  fi
done

echo "Running events migrations (phase 3: 005-013)..."
for f in /migrations/events/0{05,06,07,08,09,10,11,12,13}_*.sql; do
  if [ -f "$f" ]; then
    echo "  -> $(basename "$f")"
    psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f" 2>&1 || echo "  (warning: $(basename "$f") had non-fatal errors, continuing)"
  fi
done

# --- Grant socialism user access to all tables ---
echo "Granting socialism user permissions..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-SQL
  -- Public schema (events tables)
  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO socialism;
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO socialism;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO socialism;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO socialism;

  -- Elections schema
  GRANT USAGE ON SCHEMA elections TO socialism;
  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA elections TO socialism;
  GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA elections TO socialism;
  ALTER DEFAULT PRIVILEGES IN SCHEMA elections GRANT ALL ON TABLES TO socialism;
  ALTER DEFAULT PRIVILEGES IN SCHEMA elections GRANT ALL ON SEQUENCES TO socialism;
SQL

echo "=== DB init complete ==="
