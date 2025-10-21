# Ekklesia Scripts

This directory contains automation scripts for managing the Ekklesia platform infrastructure.

## Available Scripts

### 🔧 disable-cloudflare-proxy.sh

**Purpose**: Disable Cloudflare proxy (orange cloud → grey cloud) for Cloud Run compatibility.

**Background**: Cloud Run services only accept their native `*.run.app` hostnames in the Host header. When Cloudflare proxy forwards requests with custom domain hostnames, Cloud Run returns 404. DNS-only mode (grey cloud) resolves this by sending the native hostname.

**Quick Start**:
```bash
./scripts/disable-cloudflare-proxy.sh
```

**What It Does**:
1. Fetches all 4 DNS record IDs from Cloudflare API
2. Updates each record: `proxied: true` → `proxied: false`
3. Waits 60 seconds for DNS propagation
4. Verifies DNS resolution (should show Cloud Run IPs, not Cloudflare IPs)
5. Tests HTTP access (should work or show origin protection)

**Expected Output**:
```
✓ All records updated to DNS-only mode (grey cloud)
✓ DNS propagation complete
✓ auth.si-xj.org: Resolves to 34.x.x.x
✓ api.si-xj.org: Resolves to 34.x.x.x
✓ verify.si-xj.org: Resolves to 34.x.x.x
✓ vote.si-xj.org: Resolves to 34.x.x.x
✓ HTTP tests: 200 OK or 403 (origin protection)
```

**Prerequisites**:
- Cloudflare API token with DNS edit permissions
- Zone ID for si-xj.org
- `jq` installed: `sudo dnf install jq`

**Timeline**: 2-3 minutes total

**Security Note**: Origin protection middleware remains active (CF-Ray + IP validation).

**Documentation**: See [docs/security/CLOUDFLARE_HOST_HEADER_INVESTIGATION.md](../docs/security/CLOUDFLARE_HOST_HEADER_INVESTIGATION.md)

---

### 🔒 cloudflare-setup.sh

**Purpose**: Automate complete Cloudflare configuration for all Ekklesia services.

**Features**:
- ✅ DNS record creation (CNAME records for all services)
- ✅ Rate limiting rule configuration (combined rule for free tier)
- ✅ Verification and testing tools
- ✅ Cleanup utilities
- ✅ Full automation support

**Quick Start**:
```bash
# Complete setup (recommended for first-time setup)
./cloudflare-setup.sh full

# Individual operations
./cloudflare-setup.sh setup-dns          # Create DNS records only
./cloudflare-setup.sh setup-rate-limit   # Create rate limiting rule only
./cloudflare-setup.sh verify             # Verify current configuration
./cloudflare-setup.sh test               # Test protections
./cloudflare-setup.sh cleanup            # Remove all configurations

# Help
./cloudflare-setup.sh help
```

**Prerequisites**:
- Cloudflare account with zone already added (si-xj.org)
- API token with permissions: `Zone.DNS`, `Zone.SSL`, `Zone.WAF`
- `jq` installed: `sudo dnf install jq`
- `curl` installed (usually pre-installed)

**Environment Variables**:
You can override defaults by setting these environment variables:

```bash
export CF_API_TOKEN="your-cloudflare-api-token"
export CF_ZONE_ID="your-zone-id"
export CF_ZONE_NAME="si-xj.org"
export GCP_PROJECT="ekklesia-prod-10-2025"
export GCP_REGION="europe-west2"
```

Or edit the configuration section at the top of the script.

**What It Does**:

1. **DNS Setup** (`setup-dns`):
   - Creates CNAME records for all 4 services:
     - `auth.si-xj.org` → handleKenniAuth Cloud Function
     - `api.si-xj.org` → Events Service (Cloud Run)
     - `vote.si-xj.org` → Elections Service (Cloud Run)
     - `verify.si-xj.org` → Membership Verification (Cloud Function)
   - Enables Cloudflare proxy (orange cloud) for all records
   - Skips records that already exist

2. **Rate Limiting** (`setup-rate-limit`):
   - Creates combined rate limiting rule (free tier limitation: 1 rule only)
   - Protects all 4 services with single rule
   - Default: 100 requests per 10 seconds (600/minute)
   - Blocks offending IP for 10 seconds
   - Configurable via script variables

3. **Verification** (`verify`):
   - Validates API token
   - Checks DNS propagation via Cloudflare DNS (1.1.1.1)
   - Verifies rate limiting rules are active
   - Tests origin protection (direct URLs should return 403)
   - Tests Cloudflare routing (custom domains should work)

4. **Testing** (`test`):
   - Tests origin protection (direct Cloud Run URLs blocked)
   - Tests Cloudflare routing (CF-Ray header present)
   - Tests rate limiting (sends rapid requests to trigger block)

5. **Cleanup** (`cleanup`):
   - Removes all DNS records
   - Removes rate limiting rules
   - Requires confirmation (destructive operation)

**Example Output**:

```
═══════════════════════════════════════════════════════════
  Ekklesia Cloudflare Setup Script
═══════════════════════════════════════════════════════════

[INFO] Checking dependencies...
[SUCCESS] All dependencies installed
[INFO] Verifying Cloudflare API token...
[SUCCESS] API token is valid

[INFO] Setting up DNS records for all services...
[INFO] Creating DNS record: auth.si-xj.org → handlekenniauth-521240388393.europe-west2.run.app
[SUCCESS] Created DNS record: auth.si-xj.org (ID: abc123...)
[INFO] Creating DNS record: api.si-xj.org → events-service-521240388393.europe-west2.run.app
[SUCCESS] Created DNS record: api.si-xj.org (ID: def456...)
...

[INFO] Setting up rate limiting rule...
[SUCCESS] Rate limiting rule created (ID: 9e3a46b...)
[INFO] Rule protects: "auth.si-xj.org" "api.si-xj.org" "vote.si-xj.org" "verify.si-xj.org"

[SUCCESS] Done!
```

**Troubleshooting**:

| Issue | Solution |
|-------|----------|
| `jq: command not found` | Install jq: `sudo dnf install jq` |
| `Invalid Cloudflare API token` | Check `CF_API_TOKEN` is correct and has WAF permissions |
| `Rate limiting rule failed` | Free tier only allows 1 rule - delete existing rules first |
| DNS not propagating | Wait 5-10 minutes, then run `./cloudflare-setup.sh verify` |
| `403 Forbidden` on API | Check API token has correct zone permissions |

**Configuration Details**:

The script uses these defaults (can be overridden):

```bash
# Cloudflare
CF_API_TOKEN="gD0MXa-Y6K3n8pDDxbkyJnJuy-YIGl2KTOyD3Rn7"
CF_ZONE_ID="4cab51095e756bd898cc3debec754828"
CF_ZONE_NAME="si-xj.org"

# GCP
GCP_PROJECT="ekklesia-prod-10-2025"
GCP_PROJECT_NUMBER="521240388393"
GCP_REGION="europe-west2"

# Rate Limiting
RATE_LIMIT_PERIOD=10           # seconds (free tier: must be 10)
RATE_LIMIT_REQUESTS=100        # requests per period
RATE_LIMIT_TIMEOUT=10          # block duration (free tier: must be 10)
```

**Free Tier Limitations**:

Cloudflare Free tier has these restrictions (handled automatically by the script):
- ❌ Only **1 rate limiting rule** (script creates combined rule)
- ❌ Period must be **10 seconds** (not 60)
- ❌ Mitigation timeout must be **10 seconds** (not 600)
- ✅ Still provides excellent protection (100 req/10sec = 600/min)

**Safety Features**:
- ✅ Checks for existing records before creating (no duplicates)
- ✅ Validates API token before making changes
- ✅ Requires confirmation for destructive operations (cleanup)
- ✅ Color-coded output (errors in red, success in green)
- ✅ Exits on error (set -e)

**Integration with CI/CD**:

This script can be used in automated deployments:

```bash
# Non-interactive mode (use environment variables)
export CF_API_TOKEN="your-token"
export CF_ZONE_ID="your-zone"

# Run setup
./cloudflare-setup.sh full

# Exit code: 0 = success, 1 = failure
```

**Related Documentation**:
- [docs/security/CLOUDFLARE_SETUP.md](../docs/security/CLOUDFLARE_SETUP.md) - Complete manual setup guide
- [docs/status/SECURITY_HARDENING_PLAN.md](../docs/status/SECURITY_HARDENING_PLAN.md) - Security hardening overview

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
