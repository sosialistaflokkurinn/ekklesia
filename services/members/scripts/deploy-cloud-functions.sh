#!/bin/bash
set -e

# Deploy Cloud Functions for Bi-Directional Sync

# Source environment variables
source "$(dirname "$0")/../../../scripts/deployment/set-env.sh"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Cloud Functions Deployment${NC}"
echo -e "${BLUE}========================================${NC}"

cd "$(dirname "$0")/../functions"

echo -e "\n${YELLOW}Step 1: Deploying bidirectional_sync function...${NC}"
echo "This function syncs changes between Django and Firestore"
echo "Triggered by: Cloud Scheduler (3:30 AM daily) or manual HTTP request"

gcloud functions deploy bidirectional_sync \
  --gen2 \
  --runtime=python311 \
  --region=${REGION} \
  --source=. \
  --entry-point=bidirectional_sync \
  --trigger-http \
  --allow-unauthenticated \
  --timeout=540s \
  --memory=512MB \
  --max-instances=1 \
  --set-env-vars=GCP_PROJECT=${PROJECT_ID}

echo -e "\n${GREEN}✓ bidirectional_sync deployed${NC}"
SYNC_URL=$(gcloud functions describe bidirectional_sync --region=${REGION} --gen2 --format='value(serviceConfig.uri)')
echo -e "${BLUE}Function URL:${NC} ${SYNC_URL}"

echo -e "\n${YELLOW}Step 2: Deploying track_member_changes function...${NC}"
echo "This function tracks changes to Firestore members collection"
echo "Triggered by: Firestore document write (create, update, delete)"

gcloud functions deploy track_member_changes \
  --gen2 \
  --runtime=python311 \
  --region=${REGION} \
  --source=. \
  --entry-point=track_firestore_changes \
  --trigger-event-filters="type=google.cloud.firestore.document.v1.written" \
  --trigger-event-filters="database=(default)" \
  --trigger-event-filters-path-pattern="document=members/{memberId}" \
  --timeout=60s \
  --memory=256MB \
  --max-instances=10 \
  --set-env-vars=GCP_PROJECT=${PROJECT_ID}

echo -e "\n${GREEN}✓ track_member_changes deployed${NC}"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment completed!${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${BLUE}Deployed functions:${NC}"
echo "1. bidirectional_sync - HTTP trigger"
echo "   URL: ${SYNC_URL}"
echo "   Purpose: Sync Django ↔ Firestore (scheduled 3:30 AM)"
echo ""
echo "2. track_member_changes - Firestore trigger"
echo "   Purpose: Track changes to /members/ collection"
echo "   Trigger: Document write on members/{memberId}"

echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Set up Cloud Scheduler: ./setup-scheduler.sh"
echo "2. Test sync manually:"
echo "   curl -X POST ${SYNC_URL}"
echo "3. Check logs:"
echo "   gcloud functions logs read bidirectional_sync --region=${REGION} --gen2 --limit=50"
