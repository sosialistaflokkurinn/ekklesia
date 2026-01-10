#!/bin/bash
#
# Database Password Rotation Script
# Rotates Cloud SQL password and updates Secret Manager
#
# Usage: ./rotate-db-password.sh [--dry-run]
#
# Prerequisites:
# - gcloud CLI authenticated with correct account
# - Permission to update Cloud SQL users
# - Permission to update Secret Manager secrets
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="ekklesia-prod-10-2025"
CLOUD_SQL_INSTANCE="ekklesia-db-eu1"
REGION="europe-west1"
DB_USER="socialism"

# Secrets to update (both should have the same password)
SECRETS=(
    "postgres-password"
    "django-socialism-db-password"
)

# Parse arguments
DRY_RUN=false
if [[ "$1" == "--dry-run" ]]; then
    DRY_RUN=true
    echo -e "${YELLOW}=== DRY RUN MODE - No changes will be made ===${NC}\n"
fi

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Database Password Rotation Script                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Verify gcloud authentication
echo -e "${YELLOW}Checking authentication...${NC}"
CURRENT_ACCOUNT=$(gcloud config get-value account 2>/dev/null)
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)

if [[ "$CURRENT_PROJECT" != "$PROJECT_ID" ]]; then
    echo -e "${RED}ERROR: Wrong project. Expected $PROJECT_ID, got $CURRENT_PROJECT${NC}"
    echo "Run: gcloud config set project $PROJECT_ID"
    exit 1
fi

echo -e "  Account: ${GREEN}$CURRENT_ACCOUNT${NC}"
echo -e "  Project: ${GREEN}$CURRENT_PROJECT${NC}"
echo ""

# Generate new password (32 chars, alphanumeric + special chars)
echo -e "${YELLOW}Generating new password...${NC}"
NEW_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9!@#$%^&*' | head -c 32)

if [[ -z "$NEW_PASSWORD" ]]; then
    echo -e "${RED}ERROR: Failed to generate password${NC}"
    exit 1
fi

echo -e "  Password length: ${GREEN}${#NEW_PASSWORD} characters${NC}"
echo ""

# Show current secret versions
echo -e "${YELLOW}Current secret versions:${NC}"
for SECRET in "${SECRETS[@]}"; do
    VERSION=$(gcloud secrets versions list "$SECRET" --project="$PROJECT_ID" --limit=1 --format="value(name)" 2>/dev/null | head -1)
    echo -e "  $SECRET: ${BLUE}$VERSION${NC}"
done
echo ""

# Confirmation
if [[ "$DRY_RUN" == false ]]; then
    echo -e "${RED}⚠️  WARNING: This will change the database password!${NC}"
    echo ""
    echo "This script will:"
    echo "  1. Update Cloud SQL user '$DB_USER' password"
    echo "  2. Update Secret Manager secrets: ${SECRETS[*]}"
    echo ""
    echo -e "${YELLOW}Services will need to restart to pick up the new password.${NC}"
    echo ""
    read -p "Continue? (yes/no): " CONFIRM

    if [[ "$CONFIRM" != "yes" ]]; then
        echo -e "${YELLOW}Aborted.${NC}"
        exit 0
    fi
    echo ""
fi

# Step 1: Update Cloud SQL user password
echo -e "${YELLOW}Step 1: Updating Cloud SQL user password...${NC}"
if [[ "$DRY_RUN" == true ]]; then
    echo -e "  ${BLUE}[DRY RUN] Would run: gcloud sql users set-password $DB_USER --instance=$CLOUD_SQL_INSTANCE --password=***${NC}"
else
    gcloud sql users set-password "$DB_USER" \
        --instance="$CLOUD_SQL_INSTANCE" \
        --project="$PROJECT_ID" \
        --password="$NEW_PASSWORD" \
        --quiet
    echo -e "  ${GREEN}✓ Cloud SQL user password updated${NC}"
fi
echo ""

# Step 2: Update Secret Manager secrets
echo -e "${YELLOW}Step 2: Updating Secret Manager secrets...${NC}"
for SECRET in "${SECRETS[@]}"; do
    if [[ "$DRY_RUN" == true ]]; then
        echo -e "  ${BLUE}[DRY RUN] Would add new version to: $SECRET${NC}"
    else
        echo -n "$NEW_PASSWORD" | gcloud secrets versions add "$SECRET" \
            --project="$PROJECT_ID" \
            --data-file=-
        echo -e "  ${GREEN}✓ $SECRET updated${NC}"
    fi
done
echo ""

# Step 3: Verify new secret versions
echo -e "${YELLOW}Step 3: Verifying new secret versions...${NC}"
for SECRET in "${SECRETS[@]}"; do
    VERSION=$(gcloud secrets versions list "$SECRET" --project="$PROJECT_ID" --limit=1 --format="value(name)" 2>/dev/null | head -1)
    echo -e "  $SECRET: ${GREEN}$VERSION${NC}"
done
echo ""

# Summary
if [[ "$DRY_RUN" == true ]]; then
    echo -e "${YELLOW}=== DRY RUN COMPLETE - No changes were made ===${NC}"
else
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║     Password Rotation Complete!                            ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "  1. Restart Cloud Functions to pick up new password:"
    echo -e "     ${BLUE}cd services/svc-members && firebase deploy --only functions${NC}"
    echo ""
    echo "  2. Restart Cloud Run services:"
    echo -e "     ${BLUE}gcloud run services update django-socialism --region=europe-west2 --project=$PROJECT_ID${NC}"
    echo -e "     ${BLUE}gcloud run services update elections-service --region=europe-west1 --project=$PROJECT_ID${NC}"
    echo -e "     ${BLUE}gcloud run services update events-service --region=europe-west1 --project=$PROJECT_ID${NC}"
    echo ""
    echo "  3. Verify database connectivity:"
    echo -e "     ${BLUE}cloud-sql-proxy $PROJECT_ID:$REGION:$CLOUD_SQL_INSTANCE --port 5433 --gcloud-auth${NC}"
    echo -e "     ${BLUE}PGPASSWORD='<new-password>' psql -h localhost -p 5433 -U $DB_USER -d socialism -c '\\conninfo'${NC}"
    echo ""
    echo -e "${RED}⚠️  Old password versions are kept in Secret Manager for rollback if needed.${NC}"
    echo ""

    # Log rotation event
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    echo -e "${YELLOW}Rotation logged:${NC}"
    echo "  Timestamp: $TIMESTAMP"
    echo "  User: $CURRENT_ACCOUNT"
    echo "  Instance: $CLOUD_SQL_INSTANCE"
    echo "  DB User: $DB_USER"
fi
