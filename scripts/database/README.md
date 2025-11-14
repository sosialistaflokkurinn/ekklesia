# Database Scripts - PostgreSQL Connection Tools

**Location**: `/scripts/database/`
**Purpose**: Cloud SQL PostgreSQL connection and management scripts

---

## Overview

This directory contains scripts for connecting to the Ekklesia Cloud SQL PostgreSQL database. These scripts simplify the process of establishing secure connections to the production database for development, testing, and administration tasks.

---

## Scripts

### `start-proxy.sh`
**Purpose**: Start Cloud SQL Auth Proxy for local database access

**Description**: Launches the Cloud SQL Auth Proxy that creates a secure tunnel to the PostgreSQL database running in Google Cloud Platform. This allows local connections to the remote database as if it were running on localhost.

**Usage**:
```bash
# Start the proxy (runs in background)
./scripts/database/start-proxy.sh

# Proxy will listen on localhost:5432
# You can now connect using psql or any PostgreSQL client
```

**Requirements**:
- `cloud-sql-proxy` binary installed
- GCP authentication configured (`gcloud auth login`)
- Access to `ekklesia-prod-10-2025` project

**Output**:
- Proxy runs in background
- Logs to console or file
- Database accessible at `localhost:5433`
- Uses gcloud user credentials (not ADC)

**To Stop**:
```bash
# Find the process
ps aux | grep cloud-sql-proxy

# Kill it
kill <PID>
```

---

### `psql-cloud.sh`
**Purpose**: Quick psql connection to Cloud SQL database

**Description**: Establishes a direct psql connection to the Ekklesia Cloud SQL PostgreSQL database. Automatically handles authentication and connection parameters.

**Usage**:
```bash
# Connect to database
./scripts/database/psql-cloud.sh

# You'll be connected to PostgreSQL prompt
# psql (15.1)
# Type "help" for help.
# postgres=>
```

**Requirements**:
- Cloud SQL Auth Proxy running (start-proxy.sh)
- PostgreSQL client (`psql`) installed
- `PGPASSWORD` environment variable set

**Common Commands After Connecting**:
```sql
-- List databases
\l

-- Connect to specific database
\c postgres

-- List schemas
\dn

-- List tables in public schema
\dt public.*

-- List tables in elections schema
\dt elections.*

-- Describe table structure
\d public.users
\d elections.ballots

-- Exit
\q
```

---

### `psql_error.log`
**Purpose**: Error log file for database connection issues

**Description**: Automatically created log file that captures any errors or issues during database connection attempts.

**Common Issues Logged**:
- Authentication failures
- Connection timeouts
- Permission errors
- SQL syntax errors

**Checking Logs**:
```bash
# View recent errors
cat scripts/database/psql_error.log

# Monitor in real-time
tail -f scripts/database/psql_error.log

# Clear log
> scripts/database/psql_error.log
```

---

## Common Workflows

### Initial Setup (First Time)

```bash
# Step 1: Install Cloud SQL Proxy
# Download from: https://cloud.google.com/sql/docs/postgres/sql-proxy
wget https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64 -O cloud-sql-proxy
chmod +x cloud-sql-proxy
sudo mv cloud-sql-proxy /usr/local/bin/

# Step 2: Authenticate with GCP
gcloud auth login
gcloud config set project ekklesia-prod-10-2025

# Step 3: Get database password from Secret Manager
export PGPASSWORD=$(gcloud secrets versions access latest \
  --secret=postgres-password \
  --project=ekklesia-prod-10-2025)

# Step 4: Start proxy
./scripts/database/start-proxy.sh

# Step 5: Connect
./scripts/database/psql-cloud.sh
```

---

### Daily Development

```bash
# Start proxy if not running
./scripts/database/start-proxy.sh

# Connect to database
./scripts/database/psql-cloud.sh

# Run queries...
# When done, just exit psql
\q

# Proxy can stay running for the day
# Or stop it: kill $(pgrep cloud-sql-proxy)
```

---

### Running Migrations

**IMPORTANT**: Always use `--gcloud-auth` flag to avoid ADC credential issues (see Troubleshooting).

```bash
# Step 1: Start proxy with gcloud user credentials
cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:ekklesia-db --port 5433 --gcloud-auth &

# Step 2: Wait for proxy to start (3-4 seconds)
sleep 4

# Step 3: Run migration using psql-cloud.sh script
./scripts/database/psql-cloud.sh -f services/elections/migrations/004_ballots_multi_election.sql

# Step 4: Verify migration succeeded
./scripts/database/psql-cloud.sh -c "\d elections.ballots"
./scripts/database/psql-cloud.sh -c "\df elections.*"

# Step 5: Stop proxy when done
pkill -f "cloud-sql-proxy.*5433"
```

**Alternative: Interactive Migration**
```bash
# Step 1: Start proxy with --gcloud-auth
cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:ekklesia-db --port 5433 --gcloud-auth &
sleep 4

# Step 2: Connect to database
./scripts/database/psql-cloud.sh

# Step 3: Run migration interactively
postgres=> \i services/elections/migrations/004_ballots_multi_election.sql

# Step 4: Verify changes
postgres=> \d elections.ballots
postgres=> \df elections.check_member_voted
postgres=> \q
```

---

### Troubleshooting Database Issues

```bash
# Check if proxy is running
ps aux | grep cloud-sql-proxy

# Check connection
./scripts/database/psql-cloud.sh -c "SELECT 1"

# Check logs for errors
cat scripts/database/psql_error.log

# Test authentication
gcloud sql connect ekklesia-db --user=postgres --project=ekklesia-prod-10-2025
```

---

## Database Information

### Cloud SQL Instance Details

**Instance Name**: `ekklesia-db`
**Database Version**: PostgreSQL 15.1
**Region**: `europe-west2` (London)
**Tier**: `db-f1-micro` (shared core, 0.6 GB RAM)
**Connection Name**: `ekklesia-prod-10-2025:europe-west2:ekklesia-db`

### Schemas

**public** - Shared tables
- `users` - User accounts (kennitala-based)
- `voting_tokens` - Temporary voting authentication
- `sync_log` - Membership sync audit trail

**elections** - Elections service tables
- `elections` - Election metadata
- `questions` - Ballot questions
- `ballots` - Cast votes (anonymous)
- `results` - Aggregated results

### Connection Parameters

**When using localhost (proxy running)**:
```
Host: localhost
Port: 5433
Database: postgres
User: postgres
Password: [from Secret Manager: postgres-password]
```
Note: Port 5433 is used to avoid conflicts with local PostgreSQL installations on port 5432.

**Direct connection (not recommended for development)**:
```
Host: [Cloud SQL proxy endpoint]
Port: 5432
Database: postgres
User: postgres
SSL: Required
```

---

## Environment Variables

### Required

**`PGPASSWORD`**
- PostgreSQL password for authentication
- Retrieve from Secret Manager:
  ```bash
  export PGPASSWORD=$(gcloud secrets versions access latest \
    --secret=postgres-password \
    --project=ekklesia-prod-10-2025)
  ```

**Optional**:
- `PGHOST` - Default: localhost (when proxy running)
- `PGPORT` - Default: 5432
- `PGDATABASE` - Default: postgres
- `PGUSER` - Default: postgres

---

## Security Considerations

### ⚠️ Important Security Notes

1. **Never commit passwords** - Database passwords are in Secret Manager only
2. **Use proxy for development** - Never expose database port publicly
3. **Limit access** - Only authorized developers should have GCP access
4. **Audit access** - All connections are logged in Cloud SQL
5. **Use read-only when possible** - For queries that don't need write access

### Secure Practices

**DO**:
- ✅ Use Cloud SQL Auth Proxy for connections
- ✅ Store password in Secret Manager
- ✅ Use environment variables for credentials
- ✅ Keep proxy logs for audit trail
- ✅ Disconnect when not in use

**DON'T**:
- ❌ Hardcode passwords in scripts
- ❌ Share credentials via chat/email
- ❌ Leave proxy running unnecessarily
- ❌ Run queries on production without testing first
- ❌ Modify data without backups

---

## Troubleshooting

### Issue: "cloud-sql-proxy: command not found"
**Solution**: Install Cloud SQL Proxy
```bash
wget https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64 -O cloud-sql-proxy
chmod +x cloud-sql-proxy
sudo mv cloud-sql-proxy /usr/local/bin/
```

### Issue: "FATAL: password authentication failed"
**Solution**: Update PGPASSWORD from Secret Manager
```bash
export PGPASSWORD=$(gcloud secrets versions access latest \
  --secret=postgres-password \
  --project=ekklesia-prod-10-2025)
```

### Issue: "could not connect to server: Connection refused"
**Solution**: Start Cloud SQL Auth Proxy
```bash
./scripts/database/start-proxy.sh

# Check if running
ps aux | grep cloud-sql-proxy
```

### Issue: "permission denied for schema elections"
**Solution**: Check user permissions
```sql
-- Connect as postgres user
\c postgres postgres

-- Grant permissions
GRANT USAGE ON SCHEMA elections TO your_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA elections TO your_user;
```

### Issue: Proxy crashes or disconnects
**Solution**: Check logs and restart
```bash
# Check error log
cat scripts/database/psql_error.log

# Restart proxy
kill $(pgrep cloud-sql-proxy)
./scripts/database/start-proxy.sh
```

### Issue: "Error 403: NOT_AUTHORIZED - cloudsql.instances.get permission"
**Root Cause**: Application Default Credentials (ADC) has wrong `quota_project_id`

**Symptoms**:
```
failed to get instance metadata: googleapi: Error 403: boss::NOT_AUTHORIZED:
Not authorized to access resource. Possibly missing permission cloudsql.instances.get
```

**Solution**: Use `--gcloud-auth` flag to force proxy to use gcloud user credentials instead of ADC

```bash
# ✅ CORRECT: Use --gcloud-auth flag
cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:ekklesia-db \
  --port 5433 \
  --gcloud-auth

# ❌ WRONG: Default uses ADC which may have wrong project
cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:ekklesia-db --port 5433
```

**Why This Happens**:
- ADC file at `~/.config/gcloud/application_default_credentials.json` may have `quota_project_id` set to wrong project
- Proxy defaults to ADC when available, which uses the wrong credentials
- `--gcloud-auth` flag forces proxy to use your `gcloud auth login` credentials instead

**To Fix ADC Permanently** (optional):
```bash
# Check current ADC config
cat ~/.config/gcloud/application_default_credentials.json | grep quota_project_id

# If it shows wrong project (e.g., "fedora-setup-secrets"), edit it manually:
nano ~/.config/gcloud/application_default_credentials.json
# Change: "quota_project_id": "ekklesia-prod-10-2025"
```

**Best Practice**: Always use `--gcloud-auth` flag for database operations to avoid ADC issues.

---

## Related Documentation

- [Cloud SQL Documentation](https://cloud.google.com/sql/docs/postgres)
- [Cloud SQL Auth Proxy Guide](https://cloud.google.com/sql/docs/postgres/sql-proxy)
- [Database Schema Design](../../docs/design/DATABASE_SCHEMA.md) - If exists
- [Elections Service Migrations](../../services/elections/migrations/) - Migration SQL files
- [Claude Code Setup](../../docs/development/guides/CLAUDE_CODE_SETUP.md) - Environment setup

---

## Maintenance Notes

**Last Updated**: 2025-11-10
**Scripts Count**: 2 active scripts + 1 log file
**Database Version**: PostgreSQL 15
**Instance**: ekklesia-db (ekklesia-prod-10-2025)
**Proxy Port**: 5433 (changed from 5432 to avoid local conflicts)
**Auth Method**: `--gcloud-auth` flag (fixed ADC credential issue)
**Status**: ✅ All scripts operational
