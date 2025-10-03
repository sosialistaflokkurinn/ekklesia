#!/bin/bash

# Members Service - Cloud Build Deployment Script
# Builds and deploys using Google Cloud Build

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-ekklesia-prod-10-2025}"
REGION="${REGION:-europe-west2}"
SERVICE_NAME="members"

echo "=== Members Service Deployment (Cloud Build) ==="
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

# Submit build to Cloud Build
echo ""
echo "Submitting build to Cloud Build..."
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_REGION=$REGION \
  --region=$REGION

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --format='value(status.url)' 2>/dev/null || echo "")

if [ -n "$SERVICE_URL" ]; then
  echo ""
  echo "=== Deployment Complete ==="
  echo "Service URL: $SERVICE_URL"
  echo ""
  echo "Test endpoints:"
  echo "  Health: curl $SERVICE_URL/healthz"
  echo "  Root:   curl $SERVICE_URL/"
  echo ""
else
  echo ""
  echo "⚠️  Could not retrieve service URL"
  echo "Check deployment status in Cloud Console"
fi
