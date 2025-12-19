# Ekklesia Scripts

This directory contains automation scripts for managing the Ekklesia platform infrastructure.

## Directory Structure

| Directory | Purpose |
|-----------|---------|
| `admin/` | Administrative tasks (user management, API testing, documentation maintenance) |
| `database/` | Database management (Cloud SQL proxy, migrations, psql wrappers) |
| `deployment/` | Core deployment configuration (env vars, secrets) |
| `maintenance/` | Code health checks and pattern validation |
| `setup/` | Setup scripts (git hooks, credentials) |
| `utils/` | Utility scripts (AI context, string management, BEM conversion) |
| `bugfixes/` | Temporary scripts for specific bug investigations |

## Key Scripts

### 🏥 Code Health Checks & Analysis

Located in `scripts/maintenance/`:

- **`check_code_health.py`**: Comprehensive code health checker (missing imports, console.log usage, etc.)
- **`check-code-patterns.sh`**: Shell-based pattern validation.
- **`analyze_*.py`**: Metadata analysis scripts for CSS, HTML, JS, and Python.
- **`summarize_metadata.py`**: Summarizes analysis results.

**Usage**:
```bash
python3 scripts/maintenance/check_code_health.py
python3 scripts/maintenance/summarize_metadata.py
```

### 🛠️ Utilities

Located in `scripts/utils/`:

- **`find_colors.sh`**: Scans codebase for hex color usage.
- **`ai-context-loader.sh`**: Generates context for AI sessions.

### 🚀 Deployment & Environment

Located in `scripts/deployment/`:

- **`set-env.sh`**: Single source of truth for environment variables. Source this in other scripts.
- **`load-env.sh`**: Loads secrets from Secret Manager into environment variables.

### 🛠️ Setup

Located in `scripts/setup/`:

- **`install-git-hooks.sh`**: Installs pre-commit hooks for security and code quality.
- **`setup-claude-credentials.sh`**: Sets up credentials for AI assistance.

### 🗄️ Database

Located in `scripts/database/`:

- **`start-proxy.sh`**: Starts the Cloud SQL Auth Proxy.
- **`psql-cloud.sh`**: Connects to the production database via proxy.

## Historical Note

Cloudflare-related scripts have been archived. See [archive/scripts/cloudflare/README.md](../../archive/scripts/cloudflare/README.md) for historical reference.
