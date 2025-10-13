# Credential Migration Plan - Secret Manager Integration

**Document Type**: Security Implementation Plan
**Status**: 📋 Planned
**Created**: 2025-10-13
**Purpose**: Migrate from hardcoded credentials in settings.local.json to Google Cloud Secret Manager

---

## Overview

Currently, [.claude/settings.local.json](../../.claude/settings.local.json) contains hardcoded credentials in bash permission patterns. This is **technical debt** that should be resolved by using Google Cloud Secret Manager.

**Current State**:
- ✅ Secrets stored in Secret Manager (postgres-password, elections-s2s-api-key, etc.)
- ❌ Secrets also hardcoded in 20+ permission patterns
- ❌ Credentials embedded directly in bash commands

**Target State**:
- ✅ Secrets only in Secret Manager
- ✅ Generic permission patterns (e.g., `Bash(psql:*)`)
- ✅ Credentials retrieved dynamically via `gcloud secrets versions access`

---

## Current Secret Inventory

### Active Secrets in Secret Manager

| Secret Name | Purpose | Used By | Created |
|-------------|---------|---------|---------|
| **postgres-password** | PostgreSQL database password | Events, Elections services | Oct 9, 2025 |
| **elections-s2s-api-key** | Service-to-service API key | Events ↔ Elections | Oct 9, 2025 |
| **kenni-client-secret** | Kenni.is OAuth client secret | Members service | Oct 1, 2025 |
| **cloudflare-api-token** | Cloudflare API token | DNS automation (archived) | Oct 12, 2025 |

### Hardcoded Credentials in settings.local.json

**Lines with embedded secrets**:
1. **postgres-password** (`***REMOVED***`): Lines 7-76, 80 (20+ occurrences)
2. **elections-s2s-api-key** (`18049af1...`): Line 44
3. **cloudflare-api-token** (3 tokens): Lines 124-145

---

## Migration Strategy

### Phase 1: Create Helper Script for Credential Retrieval

**File**: `scripts/get-secret.sh`

```bash
#!/bin/bash
# Helper script to retrieve secrets from Google Cloud Secret Manager
# Usage: ./scripts/get-secret.sh <secret-name>

set -e

SECRET_NAME="$1"
PROJECT_ID="ekklesia-prod-10-2025"

if [ -z "$SECRET_NAME" ]; then
  echo "Usage: $0 <secret-name>" >&2
  echo "Available secrets: postgres-password, elections-s2s-api-key, kenni-client-secret, cloudflare-api-token" >&2
  exit 1
fi

gcloud secrets versions access latest \
  --secret="$SECRET_NAME" \
  --project="$PROJECT_ID" \
  2>/dev/null
```

**Permissions to add**:
```json
"Bash(./scripts/get-secret.sh:*)",
"Bash(scripts/get-secret.sh:*)"
```

### Phase 2: Create Database Connection Helper

**File**: `scripts/psql-cloud.sh`

```bash
#!/bin/bash
# Helper script for PostgreSQL connections using Cloud SQL Proxy
# Retrieves password from Secret Manager automatically
# Usage: ./scripts/psql-cloud.sh [psql arguments]

set -e

PROJECT_ID="ekklesia-prod-10-2025"
DB_PASSWORD=$(gcloud secrets versions access latest \
  --secret=postgres-password \
  --project="$PROJECT_ID" \
  2>/dev/null)

# Default connection via Cloud SQL Proxy
export PGPASSWORD="$DB_PASSWORD"
psql -h 127.0.0.1 -p 5433 -U postgres -d postgres "$@"
```

**Usage Examples**:
```bash
# Query elections
./scripts/psql-cloud.sh -c "SELECT * FROM elections.ballots LIMIT 10;"

# List tables
./scripts/psql-cloud.sh -c "\dt elections.*"

# Execute SQL file
./scripts/psql-cloud.sh -f reset-election.sql
```

### Phase 3: Simplified Permissions Pattern

**Replace 20+ specific patterns with:**
```json
{
  "permissions": {
    "allow": [
      // Database access (via helper script)
      "Bash(./scripts/psql-cloud.sh:*)",
      "Bash(scripts/psql-cloud.sh:*)",

      // Secret retrieval (generic pattern)
      "Bash(./scripts/get-secret.sh:*)",
      "Bash(scripts/get-secret.sh:*)",

      // Direct gcloud secrets access (read-only)
      "Bash(gcloud secrets versions access:*)",
      "Bash(gcloud secrets list:*)",
      "Bash(gcloud secrets versions list:*)",

      // Remove all PGPASSWORD=... patterns
      // Remove all API_KEY=... patterns
      // Remove all CF_TOKEN=... patterns
    ]
  }
}
```

### Phase 4: Environment Variable Approach (Alternative)

**For development workflow**, create `.env.local` (gitignored):

```bash
# .env.local (automatically loaded by scripts)
export PGPASSWORD=$(gcloud secrets versions access latest --secret=postgres-password --project=ekklesia-prod-10-2025)
export ELECTIONS_API_KEY=$(gcloud secrets versions access latest --secret=elections-s2s-api-key --project=ekklesia-prod-10-2025)
export CLOUDFLARE_TOKEN=$(gcloud secrets versions access latest --secret=cloudflare-api-token --project=ekklesia-prod-10-2025)
```

**Load script**: `scripts/load-env.sh`
```bash
#!/bin/bash
# Source this file to load environment variables
# Usage: source ./scripts/load-env.sh

PROJECT_ID="ekklesia-prod-10-2025"

echo "Loading secrets from Secret Manager..."

export PGPASSWORD=$(gcloud secrets versions access latest --secret=postgres-password --project="$PROJECT_ID")
export ELECTIONS_API_KEY=$(gcloud secrets versions access latest --secret=elections-s2s-api-key --project="$PROJECT_ID")
export CLOUDFLARE_TOKEN=$(gcloud secrets versions access latest --secret=cloudflare-api-token --project="$PROJECT_ID")

echo "✅ Environment variables loaded"
echo "   - PGPASSWORD (${#PGPASSWORD} chars)"
echo "   - ELECTIONS_API_KEY (${#ELECTIONS_API_KEY} chars)"
echo "   - CLOUDFLARE_TOKEN (${#CLOUDFLARE_TOKEN} chars)"
```

**Usage**:
```bash
# Load environment
source ./scripts/load-env.sh

# Now use psql directly
psql -h 127.0.0.1 -p 5433 -U postgres -d postgres -c "SELECT COUNT(*) FROM elections.ballots;"

# Or curl with API key
curl -H "Authorization: Bearer $ELECTIONS_API_KEY" https://elections-service-....run.app/api/s2s/results
```

---

## Implementation Checklist

### Immediate Actions (Phase 1-2)

- [ ] Create `scripts/get-secret.sh` helper script
- [ ] Create `scripts/psql-cloud.sh` database connection helper
- [ ] Make scripts executable: `chmod +x scripts/*.sh`
- [ ] Test secret retrieval: `./scripts/get-secret.sh postgres-password`
- [ ] Test database connection: `./scripts/psql-cloud.sh -c "SELECT 1;"`

### Permissions Update (Phase 3)

- [ ] Add helper script patterns to settings.local.json:
  - `Bash(./scripts/get-secret.sh:*)`
  - `Bash(./scripts/psql-cloud.sh:*)`
  - `Bash(gcloud secrets versions access:*)`
- [ ] Remove all patterns with embedded `PGPASSWORD=`
- [ ] Remove all patterns with embedded `API_KEY=`
- [ ] Remove all patterns with embedded `CF_TOKEN=`
- [ ] Keep generic patterns: `Bash(psql:*)` if using environment variables

### Optional Environment Approach (Phase 4)

- [ ] Create `scripts/load-env.sh`
- [ ] Add to .gitignore: `.env.local`
- [ ] Document usage in session start rules
- [ ] Test environment loading workflow

### Validation

- [ ] Verify Secret Manager access works
- [ ] Verify database queries work via helper script
- [ ] Verify no secrets in settings.local.json
- [ ] Verify .gitignore blocks any new credential files
- [ ] Update .code-rules with new workflow

---

## Security Benefits

### Before Migration
- ❌ 20+ hardcoded password instances
- ❌ API keys in plaintext
- ❌ Difficult to rotate credentials (must update 20+ lines)
- ❌ Easy to accidentally expose in logs
- ⚠️ Gitignored but represents technical debt

### After Migration
- ✅ Single source of truth (Secret Manager)
- ✅ Credentials never stored in files
- ✅ Easy rotation (update Secret Manager once)
- ✅ Audit trail via Secret Manager access logs
- ✅ Follows Google Cloud best practices

---

## Credential Rotation Process (Post-Migration)

### When Credentials Need Rotation

**Triggers**:
- Suspected compromise
- Regular security policy (e.g., every 90 days)
- Personnel changes
- After development testing

**Process**:
1. Generate new credential
2. Add as new version in Secret Manager:
   ```bash
   echo -n "new-password-here" | gcloud secrets versions add postgres-password \
     --project=ekklesia-prod-10-2025 \
     --data-file=-
   ```
3. Update service environment variables (Cloud Run, Cloud Functions)
4. Verify services work with new credentials
5. Disable old version in Secret Manager:
   ```bash
   gcloud secrets versions disable 1 --secret=postgres-password \
     --project=ekklesia-prod-10-2025
   ```

**No changes needed** in settings.local.json - helper scripts automatically use latest version!

---

## Cost Impact

**Secret Manager Pricing**:
- Active secret versions: $0.06 per month per version
- Access operations: $0.03 per 10,000 operations
- Current usage: 4 secrets × 1 version = $0.24/month
- Rotation (1 version disabled): 4 secrets × 2 versions = $0.48/month

**Cost increase**: ~$0.24/month (~$3/year)

**Value**: Significantly improved security posture and operational efficiency

---

## Migration Timeline

| Phase | Duration | Effort | Priority |
|-------|----------|--------|----------|
| Phase 1-2: Create helper scripts | 30 minutes | Low | High |
| Phase 3: Update permissions | 15 minutes | Low | High |
| Phase 4: Environment approach (optional) | 20 minutes | Low | Medium |
| Validation & testing | 30 minutes | Medium | High |
| **Total** | **1-2 hours** | **Low-Medium** | **High** |

**Recommendation**: Complete Phase 1-3 in this session, defer Phase 4 if not immediately needed.

---

## Related Documentation

- [docs/security/SECURITY_DEFENSE_ANALYSIS.md](SECURITY_DEFENSE_ANALYSIS.md) - Security architecture
- [docs/security/FIREBASE_APP_CHECK_RESEARCH.md](FIREBASE_APP_CHECK_RESEARCH.md) - App Check implementation
- [.code-rules](../../.code-rules) - Session initialization rules
- [scripts/README.md](../../scripts/README.md) - Scripts documentation

---

## Rollback Plan

If migration causes issues:

1. **Immediate**: Keep existing hardcoded patterns in settings.local.json (already there)
2. **Temporary**: Comment out new helper script patterns
3. **Fix**: Debug helper scripts, ensure gcloud auth works
4. **Resume**: Re-enable new patterns once working

**Low risk**: Both approaches can coexist during transition.

---

**Status**: 📋 Ready for Implementation
**Owner**: Development Team
**Next Step**: Create helper scripts (Phase 1-2)
**Estimated Completion**: Same day (1-2 hours)
