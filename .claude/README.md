# Claude Code Configuration

This directory contains configuration for Claude Code AI assistant.

## Files

### `settings.json`
**Purpose:** MCP (Model Context Protocol) server configurations

**What it does:**
- Configures postgres MCP server for database access
- Configures github MCP server for GitHub API access
- Configures git MCP server for repository operations
- Configures gcloud MCP server for Google Cloud operations
- Configures desktop-commander for system operations

**Security:** Uses environment variables for sensitive credentials (see below)

---

### `settings.local.json`
**Purpose:** Local permissions and session hooks

**What it does:**
- Defines allowed bash commands (pre-approved operations)
- Sets up SessionStart hooks to load project context
- Configures co-authoring preferences

**Security:** Contains environment variable references only (no hardcoded secrets)

⚠️ **This file is in .gitignore** - never commit it!

---

## Required Environment Variables

For Claude Code to function properly with this project, you need these environment variables set:

### 1. PostgreSQL Database Access

```bash
export PGPASSWORD="your-postgres-password-here"
```

**Used for:**
- Local database queries via `psql` commands
- Cloud SQL Proxy connections
- Database migrations and testing

**How to get it:**
```bash
# From Secret Manager (requires gcloud auth)
gcloud secrets versions access latest --secret="database-password" --project=ekklesia-prod-10-2025
```

---

### 2. Firebase Authentication Token

```bash
export FIREBASE_TOKEN="your-firebase-jwt-token-here"
```

**Used for:**
- Testing authenticated API endpoints
- Admin operations in members portal
- Cloud Functions testing

**How to get it:**
1. Login to members portal: https://ekklesia-prod-10-2025.web.app
2. Open browser developer console (F12)
3. Run: `localStorage.getItem('firebaseToken')`
4. Copy the token (starts with `eyJ...`)

**Note:** Tokens expire after 1 hour, regenerate as needed.

---

### 3. Django API Token (Optional)

```bash
export DJANGO_API_TOKEN="your-django-api-token-here"
```

**Used for:**
- Membership sync operations
- Django backend API testing
- Legacy member data access

**How to get it:**
Ask system administrator for API token, or generate via Django admin:
```bash
ssh gudro@172.105.71.207
cd /home/manager/socialism
sudo -u manager venv/bin/python manage.py drf_create_token <username>
```

---

## Quick Setup

**For a new AI session:**

```bash
# 1. Set environment variables (add to ~/.bashrc for persistence)
export PGPASSWORD="$(gcloud secrets versions access latest --secret=database-password --project=ekklesia-prod-10-2025)"
export FIREBASE_TOKEN="<get-from-browser-console>"
export DJANGO_API_TOKEN="<get-from-admin>"

# 2. Verify setup
echo "PGPASSWORD: ${PGPASSWORD:0:10}..." # Show first 10 chars
echo "FIREBASE_TOKEN: ${FIREBASE_TOKEN:0:20}..." # Show first 20 chars
echo "DJANGO_API_TOKEN: ${DJANGO_API_TOKEN:0:10}..." # Show first 10 chars

# 3. Test database connection
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "SELECT version();"
```

---

## Session Start Hooks

When Claude Code starts a new session, it automatically loads project context by running:

1. **Development Status**: `docs/status/CURRENT_DEVELOPMENT_STATUS.md`
   - Current phase and progress
   - Active feature branches
   - Known issues and blockers

2. **Usage Context**: `docs/development/guides/workflows/USAGE_CONTEXT.md`
   - Load patterns and capacity planning
   - Meeting characteristics
   - Performance targets

3. **Operations**: `docs/operations/OPERATIONAL_PROCEDURES.md`
   - Meeting preparation procedures
   - Scaling guidelines
   - Emergency protocols

This gives the AI assistant immediate context about:
- What you're currently working on
- System architecture and constraints
- Operational procedures
- Recent changes and decisions

---

## Security Best Practices

### ✅ DO:
- Keep `settings.local.json` in `.gitignore` (already configured)
- Use environment variables for all secrets
- Regenerate Firebase tokens regularly (they expire)
- Store database password in Secret Manager
- Rotate credentials if exposed

### ❌ DON'T:
- Commit `settings.local.json` to version control
- Hardcode secrets in any config files
- Share tokens in chat/email/docs
- Use production credentials in test scripts
- Leave expired tokens in permission list

---

## Troubleshooting

### Issue: "PGPASSWORD not set"

```bash
# Check if variable is set
echo $PGPASSWORD

# If empty, set it:
export PGPASSWORD="$(gcloud secrets versions access latest --secret=database-password --project=ekklesia-prod-10-2025)"
```

---

### Issue: "Firebase token expired"

**Symptoms:** 401 Unauthorized errors when calling Firebase APIs

**Solution:**
1. Re-login to members portal
2. Get new token from browser console
3. Update environment variable:
```bash
export FIREBASE_TOKEN="<new-token-from-console>"
```

---

### Issue: "Permission denied for bash command"

**Cause:** Command not in `settings.local.json` allowlist

**Solution:** Add pattern to `permissions.allow` array:
```json
{
  "permissions": {
    "allow": [
      "Bash(your-new-command:*)"
    ]
  }
}
```

---

## File Backup

A backup of the previous `settings.local.json` (with hardcoded tokens) is saved as:
```
.claude/settings.local.json.backup
```

This is kept temporarily for reference. **Delete after verifying new setup works.**

---

## Related Documentation

- [GitHub Automation Guide](../.github/GITHUB_AUTOMATION_GUIDE.md)
- [Development Status](../docs/status/CURRENT_DEVELOPMENT_STATUS.md)
- [Security Guidelines](../docs/security/)
- [Operational Procedures](../docs/operations/OPERATIONAL_PROCEDURES.md)

---

**Last Updated:** 2025-10-27
**Status:** Active configuration
