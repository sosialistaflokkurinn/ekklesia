#!/bin/bash
set -e

# Elections Service Deployment to Cloud Run
# This script deploys the Elections service to Google Cloud Run

# Configuration
PROJECT_ID="ekklesia-prod-10-2025"
REGION="europe-west2"
SERVICE_NAME="elections-service"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Elections Service Deployment${NC}"
echo -e "${BLUE}========================================${NC}"

# Check gcloud authentication
echo -e "\n${YELLOW}Checking gcloud authentication...${NC}"
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "Error: Not authenticated with gcloud. Run: gcloud auth login"
    exit 1
fi

# Set project
echo -e "\n${YELLOW}Setting GCP project to ${PROJECT_ID}...${NC}"
gcloud config set project ${PROJECT_ID}

# Get secrets from Secret Manager
echo -e "\n${YELLOW}Retrieving secrets from Secret Manager...${NC}"
DB_PASSWORD=$(gcloud secrets versions access latest --secret=postgres-password)
S2S_API_KEY=$(gcloud secrets versions access latest --secret=elections-s2s-api-key)

# Build and push image to Container Registry
echo -e "\n${YELLOW}Building and pushing Docker image...${NC}"
gcloud builds submit --tag ${IMAGE_NAME} .

# Deploy to Cloud Run
echo -e "\n${YELLOW}Deploying to Cloud Run...${NC}"
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --max-instances 100 \
  --min-instances 0 \
  --memory 512Mi \
  --cpu 1 \
  --cpu-boost \
  --timeout 5s \
  --concurrency 50 \
  --port 8081 \
  --add-cloudsql-instances ekklesia-prod-10-2025:europe-west2:ekklesia-db \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "DATABASE_HOST=/cloudsql/ekklesia-prod-10-2025:europe-west2:ekklesia-db" \
  --set-env-vars "DATABASE_PORT=5432" \
  --set-env-vars "DATABASE_NAME=postgres" \
  --set-env-vars "DATABASE_USER=postgres" \
  --set-env-vars "DATABASE_PASSWORD=${DB_PASSWORD}" \
  --set-env-vars "DATABASE_POOL_MIN=2" \
  --set-env-vars "DATABASE_POOL_MAX=5" \
  --set-env-vars "DATABASE_POOL_IDLE_TIMEOUT=30000" \
  --set-env-vars "DATABASE_POOL_CONNECTION_TIMEOUT=2000" \
  --set-env-vars "S2S_API_KEY=${S2S_API_KEY}" \
  --update-env-vars "CORS_ORIGINS=https://ekklesia-prod-10-2025.web.app^https://ekklesia-prod-10-2025.firebaseapp.com" \
  --set-env-vars "LOG_LEVEL=info" \
  --set-env-vars "ELECTION_TITLE=Prófunarkosning 2025" \
  --set-env-vars "ELECTION_QUESTION=Do you support this proposal?"

# Get service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
  --platform managed \
  --region ${REGION} \
  --format 'value(status.url)')

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Service URL: ${SERVICE_URL}"
echo -e "Health Check: ${SERVICE_URL}/health"
echo -e "Vote API: ${SERVICE_URL}/api/vote"
echo -e "\n${YELLOW}Test the service:${NC}"
echo -e "curl ${SERVICE_URL}/health"
echo -e "\n${YELLOW}View logs:${NC}"
echo -e "gcloud run services logs read ${SERVICE_NAME} --region ${REGION} --limit 50"
