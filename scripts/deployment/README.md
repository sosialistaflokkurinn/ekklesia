# Deployment Scripts - Environment & Deployment Tools

**Location**: `/scripts/deployment/`
**Purpose**: Environment setup, configuration, and deployment helper scripts

---

## Overview

This directory contains scripts for setting up development environments, managing secrets, deploying services, and other deployment-related tasks. These scripts are essential for getting a development environment up and running quickly.

---

## Scripts

### Environment Setup

#### `load-env.sh`
**Purpose**: Load environment variables from various sources

**Description**: Sources environment variables from multiple locations (Secret Manager, local files, etc.) and makes them available to the current shell session.

**Usage**:
```bash
# Load environment variables
source scripts/deployment/load-env.sh

# Variables are now available
echo $PGPASSWORD
echo $FIREBASE_TOKEN
echo $DJANGO_API_TOKEN
```

**Features**:
- Loads from Secret Manager (GCP)
- Loads from local .env files (if present)
- Validates required variables
- Provides helpful error messages

**Environment Variables Loaded**:
- `PGPASSWORD` - PostgreSQL database password
- `FIREBASE_TOKEN` - Firebase authentication token
- `DJANGO_API_TOKEN` - Django API token for member sync

---

#### `set-env.sh`
**Purpose**: Set up environment variables for current session

**Description**: Interactive script to configure environment variables needed for development. Creates or updates .env files and exports variables to current shell.

**Usage**:
```bash
# Interactive setup
./scripts/deployment/set-env.sh

# Non-interactive (reads from Secret Manager)
./scripts/deployment/set-env.sh --auto
```

**Features**:
- Interactive prompts for manual entry
- Automatic retrieval from Secret Manager
- Validates credentials
- Creates .env file for persistence
- Exports to current shell

**Last Updated**: 2025-10-31

---

#### `get-secret.sh`
**Purpose**: Retrieve secrets from Google Cloud Secret Manager

**Description**: Helper script to fetch secrets from GCP Secret Manager. Used by other scripts for secure credential retrieval.

**Usage**:
```bash
# Get specific secret
./scripts/deployment/get-secret.sh postgres-password

# Get Django API token
./scripts/deployment/get-secret.sh django-api-token

# Get Firebase config
./scripts/deployment/get-secret.sh firebase-config
```

**Requirements**:
- `gcloud` CLI installed and authenticated
- Access to `ekklesia-prod-10-2025` project
- Permissions to read secrets

**Output**: Prints secret value to stdout (be careful with logging!)

---

### Deployment Tools

#### `setup-claude-credentials.sh`
**Purpose**: Set up credentials for Claude Code sessions

**Description**: Configures environment for Claude Code AI assistant sessions by retrieving necessary credentials and setting up the development environment.

**Usage**:
```bash
# Run setup (typically at start of Claude session)
./scripts/deployment/setup-claude-credentials.sh
```

**What it Does**:
1. Retrieves credentials from Secret Manager
2. Exports environment variables
3. Validates database connection
4. Sets up Firebase authentication
5. Configures Claude Code environment

**Last Updated**: 2025-10-26

**Related**: See [Claude Code Setup Guide](../../docs/development/guides/CLAUDE_CODE_SETUP.md)

---

#### `install-git-hooks.sh`
**Purpose**: Install git pre-commit hooks

**Description**: Installs pre-commit hooks for security scanning, political identity checks, and other validations. Ensures code quality and security before commits.

**Usage**:
```bash
# Install hooks
./scripts/deployment/install-git-hooks.sh

# Hooks will run automatically on git commit
git commit -m "test commit"
```

**Hooks Installed**:
- Political identity checker (Socialist Party branding)
- Secret scanner (detects exposed credentials)
- Kennitala validator (prevents PII leaks)

**Location After Install**: `.git/hooks/pre-commit`

---

### Testing & Validation

#### `test_admin_reset.sh`
**Purpose**: Test admin password reset functionality

**Description**: Automated test script for the admin reset feature. Validates that password reset flows work correctly.

**Usage**:
```bash
# Run admin reset test
./scripts/deployment/test_admin_reset.sh
```

**What it Tests**:
- Password reset request flow
- Token generation and validation
- Email notification (if configured)
- Security validations

**Output**: Test results with pass/fail status

---

### GitHub Integration

#### `update-issue-metadata.sh`
**Purpose**: Update GitHub issue metadata in bulk

**Description**: Script for bulk updating GitHub issues with labels, milestones, projects, and other metadata. Useful for project organization.

**Usage**:
```bash
# Update issues from file
./scripts/deployment/update-issue-metadata.sh issues.txt

# Update specific issues
./scripts/deployment/update-issue-metadata.sh 50 51 52
```

**Features**:
- Bulk label updates
- Milestone assignment
- Project board integration
- Status updates

**Requirements**:
- GitHub CLI (`gh`) installed
- Authenticated with GitHub

---

#### `link-subissues.sh`
**Purpose**: Create parent-child relationships between GitHub issues

**Description**: Uses GitHub GraphQL API to link issues as sub-issues, creating hierarchical task structures.

**Usage**:
```bash
# Link issue #50 as sub-issue of #86
./scripts/deployment/link-subissues.sh 86 50

# Link multiple sub-issues
./scripts/deployment/link-subissues.sh 86 50 51 52
```

**Features**:
- Creates parent-child relationships
- Updates issue sidebar to show parent
- Maintains project board connections
- GraphQL API integration

---

### Frontend Development

#### `convert-to-bem.js`
**Purpose**: Convert CSS to BEM (Block Element Modifier) methodology

**Description**: Node.js script that converts existing CSS class names to BEM naming convention. Used during CSS refactoring for Epic #87.

**Usage**:
```bash
# Convert CSS file
node scripts/deployment/convert-to-bem.js input.css output.css

# Convert directory
node scripts/deployment/convert-to-bem.js styles/ styles-bem/
```

**What it Does**:
- Identifies CSS class patterns
- Converts to BEM naming: `.block__element--modifier`
- Preserves functionality
- Generates migration report

**Last Used**: Epic #87 (Election Discovery UI)

---

## Common Workflows

### Initial Development Setup (New Developer)

```bash
# Step 1: Authenticate with GCP
gcloud auth login
gcloud config set project ekklesia-prod-10-2025

# Step 2: Set up environment
./scripts/deployment/set-env.sh

# Step 3: Install git hooks
./scripts/deployment/install-git-hooks.sh

# Step 4: Verify setup
source scripts/deployment/load-env.sh
echo "PGPASSWORD set: $([ -n "$PGPASSWORD" ] && echo 'YES' || echo 'NO')"
echo "FIREBASE_TOKEN set: $([ -n "$FIREBASE_TOKEN" ] && echo 'YES' || echo 'NO')"

# Step 5: Test database connection
./scripts/database/start-proxy.sh
./scripts/database/psql-cloud.sh -c "SELECT 1"
```

---

### Daily Development Session

```bash
# Start of day: Load environment
source scripts/deployment/load-env.sh

# Start database proxy if needed
./scripts/database/start-proxy.sh

# Work on code...
# (git hooks run automatically on commit)

# End of day: No cleanup needed (env vars expire with session)
```

---

### Claude Code Session Setup

```bash
# At start of Claude Code session
./scripts/deployment/setup-claude-credentials.sh

# Claude Code can now access:
# - Database (via PGPASSWORD)
# - Firebase (via FIREBASE_TOKEN)
# - Django API (via DJANGO_API_TOKEN)
```

---

### Deploying After Code Changes

```bash
# Step 1: Ensure hooks are installed (one-time)
./scripts/deployment/install-git-hooks.sh

# Step 2: Make changes
# Edit code...

# Step 3: Commit (hooks run automatically)
git add .
git commit -m "feat: add new feature"
# Pre-commit hooks validate code...

# Step 4: Push
git push origin feature/my-branch

# Step 5: Deploy service (example: elections)
cd services/elections
./deploy.sh
```

---

### Updating GitHub Issues in Bulk

```bash
# Example: Add "Epic #103" label to multiple issues
for issue in 35 36 37 38; do
  gh issue edit $issue --add-label "Epic #103"
done

# Or use the script
./scripts/deployment/update-issue-metadata.sh 35 36 37 38
```

---

## Environment Variables Reference

### Required Variables

**`PGPASSWORD`**
- **Purpose**: PostgreSQL database authentication
- **Source**: Secret Manager (`postgres-password`)
- **Usage**: Automatic with psql and database scripts

**`FIREBASE_TOKEN`**
- **Purpose**: Firebase CLI authentication
- **Source**: Browser console (`await firebase.auth().currentUser.getIdToken()`)
- **Usage**: Firebase deployments and API calls
- **Lifetime**: ~1 hour (refresh when expired)

**`DJANGO_API_TOKEN`**
- **Purpose**: Django backend API authentication
- **Source**: Secret Manager (`django-api-token`)
- **Usage**: Member sync operations (Epic #43)

### Optional Variables

**`GOOGLE_APPLICATION_CREDENTIALS`**
- **Purpose**: GCP service account authentication
- **Usage**: Needed for some gcloud operations
- **Default**: Uses `gcloud auth` if not set

**`PROJECT_ID`**
- **Purpose**: GCP project identifier
- **Default**: `ekklesia-prod-10-2025`
- **Usage**: Automatic project selection

---

## Secret Manager Secrets

### Available Secrets

| Secret Name | Purpose | Access |
|-------------|---------|--------|
| `postgres-password` | PostgreSQL database password | Database connections |
| `django-api-token` | Django API authentication | Member sync |
| `firebase-config` | Firebase project config | Firebase services |

### Accessing Secrets

```bash
# Using get-secret.sh (recommended)
./scripts/deployment/get-secret.sh postgres-password

# Using gcloud directly
gcloud secrets versions access latest \
  --secret=postgres-password \
  --project=ekklesia-prod-10-2025
```

### Adding New Secrets

```bash
# Create new secret
echo -n "secret-value" | gcloud secrets create secret-name \
  --data-file=- \
  --project=ekklesia-prod-10-2025

# Update existing secret
echo -n "new-value" | gcloud secrets versions add secret-name \
  --data-file=- \
  --project=ekklesia-prod-10-2025
```

---

## Security Best Practices

### ⚠️ Important Security Notes

1. **Never commit secrets** - Use Secret Manager only
2. **Use environment variables** - Never hardcode credentials
3. **Rotate regularly** - Update secrets periodically
4. **Limit access** - Only authorized developers should access secrets
5. **Audit access** - All Secret Manager access is logged

### Secure Script Usage

**DO**:
- ✅ Use `source scripts/deployment/load-env.sh` for env vars
- ✅ Store all credentials in Secret Manager
- ✅ Use `./scripts/deployment/get-secret.sh` for retrieval
- ✅ Export variables only in current shell (don't save to files)
- ✅ Validate credentials before use

**DON'T**:
- ❌ Echo or print secret values
- ❌ Save secrets to files (.env should be gitignored)
- ❌ Share credentials via chat/email
- ❌ Hardcode secrets in scripts
- ❌ Log secret values

---

## Troubleshooting

### Issue: "gcloud: command not found"
**Solution**: Install Google Cloud SDK
```bash
# Install gcloud CLI
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Authenticate
gcloud auth login
gcloud config set project ekklesia-prod-10-2025
```

### Issue: "Permission denied" accessing secrets
**Solution**: Verify GCP permissions
```bash
# Check current account
gcloud auth list

# Check project
gcloud config get-value project

# Request access from project admin
```

### Issue: FIREBASE_TOKEN expired
**Solution**: Refresh token from browser
```javascript
// In browser console at ekklesia site:
await firebase.auth().currentUser.getIdToken()

// Copy token and export
export FIREBASE_TOKEN="<new-token>"
```

### Issue: Environment variables not persisting
**Solution**: Use `source` command
```bash
# Wrong: Runs in subshell (variables lost)
./scripts/deployment/load-env.sh

# Correct: Sources into current shell
source scripts/deployment/load-env.sh

# Verify
echo $PGPASSWORD
```

### Issue: Git hooks not running
**Solution**: Reinstall hooks
```bash
# Reinstall
./scripts/deployment/install-git-hooks.sh

# Verify installation
ls -la .git/hooks/pre-commit

# Test manually
.git/hooks/pre-commit
```

---

## Related Documentation

- [Claude Code Setup Guide](../../docs/development/guides/CLAUDE_CODE_SETUP.md) - Comprehensive environment setup
- [Deployment Guide](../../docs/setup/MEMBERS_DEPLOYMENT_GUIDE.md) - Service deployment procedures
- [Git Hooks README](../git-hooks/README.md) - Pre-commit hook details
- [Database Scripts README](../database/README.md) - Database connection tools

---

## Maintenance Notes

**Last Updated**: 2025-11-04
**Scripts Count**: 10 scripts
**Most Recent Addition**: `set-env.sh` (2025-10-31)
**Status**: ✅ All scripts operational
**Next Review**: Add automated deployment scripts (Epic TBD)
