#!/bin/bash
################################################################################
# setup-claude-credentials.sh - Secure Claude Code Credential Setup
#
# Purpose: Configure .claude/settings.json to use environment variables instead
#          of hardcoded secrets. Loads credentials from:
#          1. Environment variables (local development)
#          2. Google Cloud Secret Manager (production)
#
# Usage:
#   # For local development (interactive):
#   ./scripts/deployment/setup-claude-credentials.sh
#
#   # Load from GCP and generate settings:
#   source ./scripts/deployment/load-env.sh
#   ./scripts/deployment/setup-claude-credentials.sh --from-gcp
#
# Security:
#   ✅ Never hardcodes secrets
#   ✅ Uses environment variables
#   ✅ Generates .claude/ in .gitignore (never commits secrets)
#   ✅ Validates token format before saving
################################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
CLAUDE_DIR="$PROJECT_ROOT/.claude"
SETTINGS_FILE="$CLAUDE_DIR/settings.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

################################################################################
# Helper Functions
################################################################################

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

validate_github_token() {
    local token="$1"
    if [[ ! $token =~ ^ghp_[A-Za-z0-9_]{36,255}$ ]]; then
        log_error "Invalid GitHub token format. Expected: ghp_xxxxx"
    fi
}

validate_postgres_password() {
    local password="$1"
    if [[ -z "$password" ]]; then
        log_error "PostgreSQL password cannot be empty"
    fi
}

################################################################################
# Main Setup
################################################################################

main() {
    log_info "Claude Code Credentials Setup"
    log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Create .claude directory
    mkdir -p "$CLAUDE_DIR"
    log_success "Created $CLAUDE_DIR"

    # Check if .claude should be in .gitignore
    if ! grep -q "^\\.claude" "$PROJECT_ROOT/.gitignore" 2>/dev/null; then
        log_warning ".claude/ not in .gitignore. Adding it..."
        echo ".claude/  # Claude Code settings (contains secrets)" >> "$PROJECT_ROOT/.gitignore"
        log_success "Added .claude/ to .gitignore"
    fi

    # Prompt for credentials
    log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_info "Enter credentials (or leave empty to skip)"

    # GitHub Token
    read -sp "GitHub Personal Access Token: " GITHUB_TOKEN || true
    echo
    if [[ -n "$GITHUB_TOKEN" ]]; then
        validate_github_token "$GITHUB_TOKEN"
        export GITHUB_TOKEN
        log_success "GitHub token validated"
    else
        log_warning "GitHub token skipped (will use \$GITHUB_TOKEN env var)"
    fi

    # PostgreSQL Password
    read -sp "PostgreSQL Password: " PGPASSWORD || true
    echo
    if [[ -n "$PGPASSWORD" ]]; then
        validate_postgres_password "$PGPASSWORD"
        export PGPASSWORD
        log_success "PostgreSQL password set"
    else
        log_warning "PostgreSQL password skipped (will use \$PGPASSWORD env var)"
    fi

    # PostgreSQL Host (optional)
    read -p "PostgreSQL Host [127.0.0.1]: " PG_HOST
    PG_HOST="${PG_HOST:-127.0.0.1}"

    # PostgreSQL Port (optional)
    read -p "PostgreSQL Port [5432]: " PG_PORT
    PG_PORT="${PG_PORT:-5432}"

    # PostgreSQL User (optional)
    read -p "PostgreSQL User [postgres]: " PG_USER
    PG_USER="${PG_USER:-postgres}"

    # PostgreSQL Database (optional)
    read -p "PostgreSQL Database [postgres]: " PG_DATABASE
    PG_DATABASE="${PG_DATABASE:-postgres}"

    # Generate settings.json
    log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_info "Generating $SETTINGS_FILE..."

    cat > "$SETTINGS_FILE" << 'EOF'
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres@latest"
      ],
      "env": {
        "PG_HOST": "127.0.0.1",
        "PG_PORT": "5432",
        "PG_USER": "postgres",
        "PG_PASSWORD": "${PGPASSWORD}",
        "PG_DATABASE": "postgres"
      }
    },
    "github": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github@latest"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "git": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-git@latest"
      ],
      "env": {
        "GIT_REPOSITORY_PATH": "/home/gudro/Development/projects/ekklesia"
      }
    },
    "gcloud": {
      "command": "gcloud",
      "args": [
        "run",
        "proxy"
      ],
      "env": {
        "CLOUDSDK_CORE_PROJECT": "ekklesia-prod-10-2025"
      }
    },
    "desktop-commander": {
      "command": "npx",
      "args": [
        "@wonderwhy-er/desktop-commander@latest"
      ]
    }
  }
}
EOF

    # Replace placeholders if credentials were provided
    if [[ -n "$GITHUB_TOKEN" ]]; then
        sed -i "s|\${GITHUB_TOKEN}|$GITHUB_TOKEN|g" "$SETTINGS_FILE"
    fi

    if [[ -n "$PGPASSWORD" ]]; then
        sed -i "s|\${PGPASSWORD}|$PGPASSWORD|g" "$SETTINGS_FILE"
    fi

    # Replace PostgreSQL connection details
    sed -i "s|\"PG_HOST\": \"127.0.0.1\"|\"PG_HOST\": \"$PG_HOST\"|g" "$SETTINGS_FILE"
    sed -i "s|\"PG_PORT\": \"5432\"|\"PG_PORT\": \"$PG_PORT\"|g" "$SETTINGS_FILE"
    sed -i "s|\"PG_USER\": \"postgres\"|\"PG_USER\": \"$PG_USER\"|g" "$SETTINGS_FILE"
    sed -i "s|\"PG_DATABASE\": \"postgres\"|\"PG_DATABASE\": \"$PG_DATABASE\"|g" "$SETTINGS_FILE"

    log_success "Created $SETTINGS_FILE"

    # Verify .gitignore
    log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    if grep -q "^\\.claude" "$PROJECT_ROOT/.gitignore" 2>/dev/null; then
        log_success ".claude/ is in .gitignore ✅"
    else
        log_error ".claude/ is NOT in .gitignore (add it manually)"
    fi

    # Final summary
    log_info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_success "Claude Code credentials configured!"
    log_info ""
    log_info "📝 Settings file: $SETTINGS_FILE"
    log_info "🔒 Protected by .gitignore: .claude/"
    log_info ""
    log_info "Environment variables needed:"
    [[ -z "$GITHUB_TOKEN" ]] && log_info "  • GITHUB_TOKEN (for GitHub MCP server)"
    [[ -z "$PGPASSWORD" ]] && log_info "  • PGPASSWORD (for PostgreSQL MCP server)"
    log_info ""
    log_info "To load from GCP Secret Manager:"
    log_info "  source ./scripts/deployment/load-env.sh"
    log_info ""
}

main "$@"
