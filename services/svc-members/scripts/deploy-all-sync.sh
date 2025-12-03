#!/bin/bash
set -e

# Master Deployment Script for Bi-Directional Sync
# Deploys all components in the correct order

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BOLD}${BLUE}========================================${NC}"
echo -e "${BOLD}${BLUE}Bi-Directional Sync Deployment${NC}"
echo -e "${BOLD}${BLUE}========================================${NC}"

echo -e "\n${YELLOW}This script will deploy:${NC}"
echo "1. Django backend code (models, API endpoints, signals)"
echo "2. Cloud Functions (bidirectional_sync, track_member_changes)"
echo "3. Cloud Scheduler (3:30 AM daily sync)"
echo "4. Frontend updates (member-profile.js with sync queue)"

echo -e "\n${RED}⚠️  WARNING: This will modify production systems${NC}"
echo -e "${YELLOW}Press Ctrl+C to cancel, or Enter to continue...${NC}"
read -r

# Step 1: Deploy Django backend
echo -e "\n${BOLD}${BLUE}========================================${NC}"
echo -e "${BOLD}${BLUE}Step 1/4: Deploy Django Backend${NC}"
echo -e "${BOLD}${BLUE}========================================${NC}"

if [ -f "${SCRIPT_DIR}/deploy-django-sync.sh" ]; then
    bash "${SCRIPT_DIR}/deploy-django-sync.sh"
else
    echo -e "${RED}Error: deploy-django-sync.sh not found${NC}"
    exit 1
fi

echo -e "\n${GREEN}✓ Django backend deployed${NC}"
echo -e "${YELLOW}Pausing 10 seconds for Django to restart...${NC}"
sleep 10

# Step 2: Deploy Cloud Functions
echo -e "\n${BOLD}${BLUE}========================================${NC}"
echo -e "${BOLD}${BLUE}Step 2/4: Deploy Cloud Functions${NC}"
echo -e "${BOLD}${BLUE}========================================${NC}"

if [ -f "${SCRIPT_DIR}/deploy-cloud-functions.sh" ]; then
    bash "${SCRIPT_DIR}/deploy-cloud-functions.sh"
else
    echo -e "${RED}Error: deploy-cloud-functions.sh not found${NC}"
    exit 1
fi

echo -e "\n${GREEN}✓ Cloud Functions deployed${NC}"

# Step 3: Set up Cloud Scheduler
echo -e "\n${BOLD}${BLUE}========================================${NC}"
echo -e "${BOLD}${BLUE}Step 3/4: Set up Cloud Scheduler${NC}"
echo -e "${BOLD}${BLUE}========================================${NC}"

if [ -f "${SCRIPT_DIR}/setup-scheduler.sh" ]; then
    bash "${SCRIPT_DIR}/setup-scheduler.sh"
else
    echo -e "${RED}Error: setup-scheduler.sh not found${NC}"
    exit 1
fi

echo -e "\n${GREEN}✓ Cloud Scheduler configured${NC}"

# Step 4: Deploy Frontend
echo -e "\n${BOLD}${BLUE}========================================${NC}"
echo -e "${BOLD}${BLUE}Step 4/4: Deploy Frontend${NC}"
echo -e "${BOLD}${BLUE}========================================${NC}"

echo -e "${YELLOW}Deploying frontend to Firebase Hosting...${NC}"
cd "${SCRIPT_DIR}/../"

# Build admin area (if build script exists)
if [ -f "build-admin.sh" ]; then
    echo "Building admin area..."
    bash build-admin.sh
fi

# Deploy to Firebase
echo "Deploying to Firebase Hosting..."
firebase deploy --only hosting

echo -e "\n${GREEN}✓ Frontend deployed${NC}"

# All done!
echo -e "\n${BOLD}${GREEN}========================================${NC}"
echo -e "${BOLD}${GREEN}Deployment Complete! 🎉${NC}"
echo -e "${BOLD}${GREEN}========================================${NC}"

echo -e "\n${BLUE}Summary:${NC}"
echo "✓ Django backend updated with sync models and API endpoints"
echo "✓ Cloud Functions deployed:"
echo "  - bidirectional_sync (HTTP trigger)"
echo "  - track_member_changes (Firestore trigger)"
echo "✓ Cloud Scheduler configured (runs 3:30 AM daily)"
echo "✓ Frontend updated with sync queue support"

echo -e "\n${YELLOW}Testing:${NC}"
echo "1. Test manual sync:"
echo "   gcloud scheduler jobs run bidirectional-member-sync --location=europe-west2"
echo ""
echo "2. Edit a member in admin portal and check sync queue:"
echo "   https://console.firebase.google.com/u/0/project/ekklesia-prod-10-2025/firestore/databases/-default-/data/~2Fsync_queue"
echo ""
echo "3. Check Django admin for sync queue:"
echo "   https://starf.sosialistaflokkurinn.is/admin/membership/membersyncqueue/"

echo -e "\n${YELLOW}Monitoring:${NC}"
echo "Cloud Function logs:"
echo "  gcloud functions logs read bidirectional_sync --region=europe-west2 --gen2 --limit=50"
echo ""
echo "Django logs:"
echo "  ~/django-ssh.sh 'journalctl -u gunicorn -n 100 --no-pager'"

echo -e "\n${YELLOW}Rollback:${NC}"
echo "If issues occur:"
echo "1. Pause scheduler:"
echo "   gcloud scheduler jobs pause bidirectional-member-sync --location=europe-west2"
echo ""
echo "2. Restore Django backup:"
echo "   ~/django-ssh.sh 'cd /home/manager/socialism/membership/backups && ls -lt | head -5'"
echo ""
echo "3. Re-deploy old sync_members function:"
echo "   cd functions && gcloud functions deploy sync_members --trigger-http"

echo -e "\n${BOLD}${GREEN}Next sync scheduled for: 3:30 AM (Atlantic/Reykjavik)${NC}"
