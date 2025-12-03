#!/bin/bash
set -e

# Set up Cloud Scheduler for Bi-Directional Sync

# Source environment variables
source "$(dirname "$0")/../../../scripts/deployment/set-env.sh"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Cloud Scheduler Setup${NC}"
echo -e "${BLUE}========================================${NC}"

# Configuration
JOB_NAME="bidirectional-member-sync"
SCHEDULE="30 3 * * *"  # 3:30 AM daily
TIMEZONE="Atlantic/Reykjavik"
DESCRIPTION="Bi-directional sync between Django and Firestore (3:30 AM daily)"

# Get function URL
echo -e "\n${YELLOW}Getting bidirectional_sync function URL...${NC}"
FUNCTION_URL=$(gcloud functions describe bidirectional_sync \
  --region=${REGION} \
  --gen2 \
  --format='value(serviceConfig.uri)' 2>/dev/null)

if [ -z "$FUNCTION_URL" ]; then
    echo -e "${RED}Error: bidirectional_sync function not found${NC}"
    echo "Deploy the function first: ./deploy-cloud-functions.sh"
    exit 1
fi

echo -e "${GREEN}Function URL: ${FUNCTION_URL}${NC}"

# Check if job already exists
echo -e "\n${YELLOW}Checking if scheduler job already exists...${NC}"
if gcloud scheduler jobs describe ${JOB_NAME} --location=${REGION} &>/dev/null; then
    echo -e "${YELLOW}Job already exists. Deleting old job...${NC}"
    gcloud scheduler jobs delete ${JOB_NAME} --location=${REGION} --quiet
fi

# Create scheduler job
echo -e "\n${YELLOW}Creating Cloud Scheduler job...${NC}"
gcloud scheduler jobs create http ${JOB_NAME} \
  --location=${REGION} \
  --schedule="${SCHEDULE}" \
  --time-zone="${TIMEZONE}" \
  --uri="${FUNCTION_URL}" \
  --http-method=POST \
  --description="${DESCRIPTION}" \
  --attempt-deadline=600s

echo -e "\n${GREEN}✓ Cloud Scheduler job created${NC}"

# Display job details
echo -e "\n${BLUE}Job Details:${NC}"
gcloud scheduler jobs describe ${JOB_NAME} --location=${REGION}

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Cloud Scheduler setup completed!${NC}"
echo -e "${GREEN}========================================${NC}"

echo -e "\n${BLUE}Schedule:${NC} ${SCHEDULE} (${TIMEZONE})"
echo -e "${BLUE}Next run:${NC}"
gcloud scheduler jobs describe ${JOB_NAME} --location=${REGION} --format='value(schedule)' 

echo -e "\n${YELLOW}Manual testing:${NC}"
echo "Run sync now:"
echo "  gcloud scheduler jobs run ${JOB_NAME} --location=${REGION}"
echo ""
echo "Or trigger function directly:"
echo "  curl -X POST ${FUNCTION_URL}"

echo -e "\n${YELLOW}View logs:${NC}"
echo "  gcloud functions logs read bidirectional_sync --region=${REGION} --gen2 --limit=50"

echo -e "\n${YELLOW}Disable scheduled sync:${NC}"
echo "  gcloud scheduler jobs pause ${JOB_NAME} --location=${REGION}"

echo -e "\n${YELLOW}Re-enable scheduled sync:${NC}"
echo "  gcloud scheduler jobs resume ${JOB_NAME} --location=${REGION}"
