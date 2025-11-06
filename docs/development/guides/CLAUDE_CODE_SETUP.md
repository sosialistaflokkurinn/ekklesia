# Claude Code Setup Guide

**Quick reference for starting a new AI session with proper environment configuration.**

---

## Prerequisites

Before starting Claude Code, you need access to:
1. **GCP Project**: `ekklesia-prod-10-2025`
2. **Database credentials** (via Secret Manager)
3. **Firebase authentication** (members portal login)

---

## Quick Start (2 minutes)

### Step 1: Set Environment Variables

```bash
# PostgreSQL password (from Secret Manager)
export PGPASSWORD="$(gcloud secrets versions access latest \
  --secret=postgres-password \
  --project=ekklesia-prod-10-2025)"

# Firebase token (get from browser after login)
# 1. Go to: https://ekklesia-prod-10-2025.web.app
# 2. Login with Kenni.is
# 3. Open console (F12) and run: localStorage.getItem('firebaseToken')
export FIREBASE_TOKEN="<paste-token-here>"

# Django API token (optional, for membership sync)
export DJANGO_API_TOKEN="$(gcloud secrets versions access latest \
  --secret=django-api-token \
  --project=ekklesia-prod-10-2025)"
```

### Step 2: Verify Setup

```bash
# Check environment variables are set
echo "PGPASSWORD: ${PGPASSWORD:0:10}..."
echo "FIREBASE_TOKEN: ${FIREBASE_TOKEN:0:20}..."

# Test database connection
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "SELECT version();"
```

### Step 3: Start Claude Code

```bash
cd /home/gudro/Development/projects/ekklesia
claude
```

---

## What Happens on Session Start?

Claude Code automatically loads project context by reading:

1. **Development Status** (`docs/status/CURRENT_DEVELOPMENT_STATUS.md`)
   - Current phase (Phase 5 - Feature Development)
   - Active branches and epics
   - Infrastructure status
   - Known issues

2. **Usage Context** (`docs/development/guides/workflows/USAGE_CONTEXT.md`)
   - Meeting patterns (monthly meetings, 50-500 attendees)
   - Load characteristics (300 votes/sec spike)
   - Performance requirements
   - Cost optimization strategy

3. **Operations** (`docs/operations/OPERATIONAL_PROCEDURES.md`)
   - Meeting preparation procedures
   - Scaling guidelines (Cloud Run, Cloud SQL)
   - Emergency response protocols
   - Cost management

**Result:** The AI assistant has immediate context about the project without you needing to explain.

---

## Common Tasks

### Database Queries

**Prerequisites**: Cloud SQL Proxy must be running in the background

```bash
# Start Cloud SQL Proxy (in separate terminal or background)
# This script now uses the DB_CONNECTION_NAME from scripts/deployment/set-env.sh
./scripts/database/start-proxy.sh

# Now you can query the database
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "SELECT * FROM users LIMIT 5;"
```

**Note**: If database queries fail with "connection refused", the Cloud SQL Proxy is not running. Start it with the command above.

### Testing Authenticated Endpoints

```bash
# Firebase token is available via $FIREBASE_TOKEN
curl -H "Authorization: Bearer $FIREBASE_TOKEN" \
  https://ekklesia-prod-10-2025.web.app/api/profile
```

### Membership Sync Operations

```bash
# Django API token is available via $DJANGO_API_TOKEN
curl -H "Authorization: Token $DJANGO_API_TOKEN" \
  https://starf.sosialistaflokkurinn.is/felagar/api/full/ \
  | jq -r '.count + " members in Django database"'

# Get single member by ID
curl -H "Authorization: Token $DJANGO_API_TOKEN" \
  https://starf.sosialistaflokkurinn.is/felagar/api/full/1/ \
  | jq '.'
```

---

## Token Expiration

### Firebase Token (expires after 1 hour)

**Symptoms:**
- 401 Unauthorized errors
- "Token expired" messages

**Solution:**
1. Re-login to members portal
2. Get new token from console: `localStorage.getItem('firebaseToken')`
3. Update environment variable:
   ```bash
   export FIREBASE_TOKEN="<new-token>"
   ```

### Database Password (rarely changes)

**If password is rotated:**
```bash
# Get latest password from Secret Manager
export PGPASSWORD="$(gcloud secrets versions access latest \
  --secret=database-password \
  --project=ekklesia-prod-10-2025)"
```

---

## Pre-Configured Permissions

Claude Code has pre-approved permissions for common operations:

✅ **Allowed without asking:**
- Git operations (commit, push, pull, branch)
- Database queries (psql, schema inspection)
- GCP operations (gcloud, gsutil)
- GitHub operations (gh CLI - issues, PRs, labels)
- File operations (read, edit, write)
- Testing scripts (/tmp/test_*.sh)

❌ **Will ask for approval:**
- Destructive operations (git push --force, rm -rf)
- Production deployments (firebase deploy, gcloud run deploy)
- Credential rotation (password changes)

**Full list:** See `.claude/settings.local.json` (permissions.allow array)

---

## Troubleshooting

### Issue: "PGPASSWORD not set"

```bash
# Check if variable exists
env | grep PGPASSWORD

# If missing, set it:
export PGPASSWORD="$(gcloud secrets versions access latest \
  --secret=postgres-password \
  --project=ekklesia-prod-10-2025)"
```

### Issue: "Firebase token expired"

```bash
# Get new token from browser
# 1. Login to: https://ekklesia-prod-10-2025.web.app
# 2. Console: localStorage.getItem('firebaseToken')
export FIREBASE_TOKEN="<new-token>"
```

### Issue: "Permission denied for bash command"

**Cause:** Command not in pre-approved list

**Solution:** Either:
1. Use a pre-approved wildcard pattern (e.g., `git log:*`)
2. Add specific command to `.claude/settings.local.json`
3. Claude Code will ask for permission (approve once)

### Issue: "Session context not loaded"

**Cause:** Hook files may have moved

**Check hooks are pointing to correct files:**
```bash
# Verify files exist
ls -la docs/status/CURRENT_DEVELOPMENT_STATUS.md
ls -la docs/development/guides/workflows/USAGE_CONTEXT.md
ls -la docs/operations/OPERATIONAL_PROCEDURES.md
```

**Update hooks if needed:** Edit `.claude/settings.local.json` → `hooks.SessionStart`

---

## Persistence (Optional)

To avoid setting environment variables every session, add to `~/.bashrc`:

```bash
# Add to ~/.bashrc
export EKKLESIA_HOME="/home/gudro/Development/projects/ekklesia"

# Auto-load database password on terminal start
if command -v gcloud &> /dev/null; then
  export PGPASSWORD="$(gcloud secrets versions access latest \
    --secret=postgres-password \
    --project=ekklesia-prod-10-2025 2>/dev/null || echo '')"
fi

# Alias for quick Firebase token refresh
alias refresh-firebase='export FIREBASE_TOKEN="$(xclip -o)"'  # Linux
# Or: alias refresh-firebase='export FIREBASE_TOKEN="$(pbpaste)"'  # macOS
```

Then:
```bash
source ~/.bashrc
```

---

## Security Reminders

✅ **DO:**
- Keep tokens in environment variables only
- Regenerate Firebase tokens regularly (they expire anyway)
- Use Secret Manager for database passwords
- Keep `.claude/settings.local.json` in `.gitignore`

❌ **DON'T:**
- Commit `.claude/settings.local.json` (already gitignored)
- Share tokens in docs/chat/email
- Hardcode credentials in scripts
- Use production credentials in test data

---

## Related Documentation

- **Claude Config**: `.claude/README.md` - Full configuration reference
- **GitHub Automation**: `.github/GITHUB_AUTOMATION_GUIDE.md` - GitHub CLI workflows
- **Operations**: `docs/operations/OPERATIONAL_PROCEDURES.md` - Meeting procedures
- **Security**: `docs/security/` - Security policies and incident responses

---

**Last Updated:** 2025-10-27
**Status:** Active - Required for all Claude Code sessions
