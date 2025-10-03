#!/bin/bash

# Members Service - Cloud Run Deployment Script
# Deploys the Members service to Google Cloud Run

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-ekklesia-prod-10-2025}"
REGION="${REGION:-europe-west2}"
SERVICE_NAME="members"
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/ekklesia/${SERVICE_NAME}"

echo "=== Members Service Deployment ==="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"
echo ""

# Check if gcloud is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
  echo "❌ Error: Not authenticated with gcloud"
  echo "Run: gcloud auth login"
  exit 1
fi

# Set project
echo "Setting project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# Check if Artifact Registry repository exists, create if not
echo "Checking Artifact Registry repository..."
if ! gcloud artifacts repositories describe ekklesia --location=$REGION &>/dev/null; then
  echo "Creating Artifact Registry repository..."
  gcloud artifacts repositories create ekklesia \
    --repository-format=docker \
    --location=$REGION \
    --description="Ekklesia container images"
fi

# Build container image
echo ""
echo "Building container image..."
docker build -t $SERVICE_NAME:latest .

# Tag image for Artifact Registry
echo "Tagging image for Artifact Registry..."
docker tag $SERVICE_NAME:latest $IMAGE_NAME:latest

# Configure Docker for Artifact Registry
echo "Configuring Docker authentication..."
gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet

# Push image to Artifact Registry
echo ""
echo "Pushing image to Artifact Registry..."
docker push $IMAGE_NAME:latest

# Deploy to Cloud Run
echo ""
echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image=$IMAGE_NAME:latest \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --port=3000 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --set-env-vars="NODE_ENV=production,LOG_LEVEL=info,ZITADEL_ISSUER=https://zitadel-ymzrguoifa-nw.a.run.app,ZITADEL_CLIENT_ID=338586423189856794,ZITADEL_REDIRECT_URI=https://members-ymzrguoifa-nw.a.run.app/callback" \
  --set-secrets="SESSION_SECRET=members-session-secret:latest" \
  --quiet

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --format='value(status.url)')

echo ""
echo "=== Deployment Complete ==="
echo "Service URL: $SERVICE_URL"
echo ""
echo "Test endpoints:"
echo "  Health: curl $SERVICE_URL/healthz"
echo "  Root:   curl $SERVICE_URL/"
echo ""
