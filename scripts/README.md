# Ekklesia Scripts

This directory contains automation scripts for managing the Ekklesia platform infrastructure.

## Available Scripts

> **Note**: Cloudflare-related scripts have been archived. See [archive/scripts/cloudflare/README.md](../../archive/scripts/cloudflare/README.md) for historical reference. The platform uses [Firebase Hosting](https://firebase.google.com/docs/hosting) instead.

---

### 🏥 check-code-health.py ⭐ NEW!

**Purpose**: Comprehensive code health checker - finds common issues like missing imports, console.log usage, memory leaks, etc.

**Quick Start**:
```bash
python3 scripts/check-code-health.py          # Basic check
python3 scripts/check-code-health.py --verbose # Detailed output
```

**What It Checks**:
- ❌ Missing imports (initNavigation, debug, showToast, R.string)
- ⚠️  console.log usage (should use debug.log)
- ⚠️  Missing initNavigation() on pages with navigation
- ℹ️  Hardcoded URLs (should use constants)
- ℹ️  Async functions without try-catch
- ℹ️  addEventListener without removeEventListener (memory leaks)
- ℹ️  TODO/FIXME comments

**Example Output**:
```
🔍 Ekklesia Code Health Check
==================================================

📦 Checking for missing imports...
  ❌ apps/members-portal/js/rbac.js:405
      Uses R.string without importing it

Found 14 errors, 24 warnings, 31 info
```

**Use Cases**:
- Before committing code
- Code review preparation
- Finding patterns across codebase
- Onboarding new developers (shows best practices)

**See Also**: [scripts/README-CODE-HEALTH.md](./README-CODE-HEALTH.md) for detailed guide

---

### 🔐 get-secret.sh

**Purpose**: Retrieve secrets from Google Cloud Secret Manager.

**Quick Start**:
```bash
./scripts/get-secret.sh postgres-password
./scripts/get-secret.sh elections-s2s-api-key
```

**What It Does**:
- Retrieves the latest version of a secret from Secret Manager
- Outputs secret value to stdout (for use in scripts/pipelines)
- Returns non-zero exit code if secret doesn't exist

**Available Secrets**:
- `postgres-password` - PostgreSQL database password
- `elections-s2s-api-key` - Elections service API key
- `kenni-client-secret` - Kenni.is OAuth client secret
- `cloudflare-api-token` - Cloudflare API token

**Example Usage**:
```bash
# Store in variable
DB_PASSWORD=$(./scripts/get-secret.sh postgres-password)

# Use directly
psql -h 127.0.0.1 -p 5433 -U postgres -d postgres \
  --password="$(./scripts/get-secret.sh postgres-password)"
```

**Prerequisites**: Authenticated with gcloud (`gcloud auth login`)

---

### 🗄️ psql-cloud.sh

**Purpose**: Connect to PostgreSQL database via Cloud SQL Proxy with automatic password retrieval.

**Quick Start**:
```bash
# Query database
./scripts/psql-cloud.sh -c "SELECT COUNT(*) FROM elections.ballots;"

# List tables
./scripts/psql-cloud.sh -c "\dt elections.*"

# Execute SQL file
./scripts/psql-cloud.sh -f reset-election.sql

# Interactive psql session
./scripts/psql-cloud.sh
```

**What It Does**:
1. Retrieves postgres-password from Secret Manager
2. Sets PGPASSWORD environment variable
3. Connects to database via Cloud SQL Proxy (127.0.0.1:5433)
4. Passes all arguments to `psql` command

**Prerequisites**:
- Cloud SQL Proxy running on port 5433
- Authenticated with gcloud (`gcloud auth login`)

**Connection Details**:
- Host: 127.0.0.1 (Cloud SQL Proxy)
- Port: 5433
- Database: postgres
- User: postgres
- Password: Retrieved from Secret Manager automatically

**Security Benefits**:
- ✅ No password in command history
- ✅ No password in scripts/config files
- ✅ Automatic credential rotation support
- ✅ Audit trail via Secret Manager access logs

---

### 🌍 load-env.sh

**Purpose**: Load all secrets from Secret Manager into environment variables.

**Quick Start**:
```bash
# Source the script (must use 'source' or '.')
source ./scripts/load-env.sh

# Now use environment variables
echo $PGPASSWORD
echo $ELECTIONS_API_KEY
echo $CLOUDFLARE_TOKEN
```

**What It Does**:
- Retrieves all secrets from Secret Manager
- Exports them as environment variables
- Displays confirmation with character counts (not actual values)

**Exported Variables**:
- `PGPASSWORD` - PostgreSQL database password
- `ELECTIONS_API_KEY` - Elections service API key
- `CLOUDFLARE_TOKEN` - Cloudflare API token

**Example Workflow**:
```bash
# Load environment
source ./scripts/load-env.sh

# Use database directly
psql -h 127.0.0.1 -p 5433 -U postgres -d postgres -c "SELECT 1;"

# Use API key
curl -H "Authorization: Bearer $ELECTIONS_API_KEY" \
  https://elections-service-....run.app/api/s2s/results
```

**Note**: This script must be **sourced**, not executed directly, otherwise variables won't persist in your shell.

---

## Script Development Guidelines

When creating new scripts for this directory:

1. **Shebang**: Always use `#!/bin/bash`
2. **Error Handling**: Use `set -e` and `set -u`
3. **Documentation**: Include comprehensive header comments
4. **Logging**: Use color-coded output functions (log_info, log_success, log_error)
5. **Dependencies**: Check for required tools with `command -v`
6. **Idempotency**: Scripts should be safe to run multiple times
7. **Testing**: Include verification/testing commands
8. **Help**: Provide `--help` or `help` command
9. **Environment Variables**: Support configuration via env vars
10. **Exit Codes**: Return 0 for success, non-zero for failure

**Example Script Template**:

```bash
#!/bin/bash

################################################################################
# Script Name
#
# Description of what this script does
#
# Usage:
#   ./script-name.sh [options]
#
# Author: Your Name
# Date: YYYY-MM-DD
################################################################################

set -e
set -u

# Configuration
VARIABLE="${VARIABLE:-default_value}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Helper functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Main logic
main() {
    log_info "Starting script..."
    # Your code here
    log_success "Done!"
}

main "$@"
```

---

## Future Scripts (Ideas)

These scripts would be useful additions:

- **gcp-deploy.sh** - Automate Cloud Run service deployments
- **backup.sh** - Backup Firestore and Cloud SQL databases
- **monitoring-setup.sh** - Configure Cloud Monitoring alerts
- **cost-analysis.sh** - Generate cost reports and optimization recommendations
- **security-audit.sh** - Run security checks on all services
- **testing-suite.sh** - Run end-to-end integration tests

---

**Last Updated**: 2025-10-12
**Maintainer**: Ekklesia Development Team
