#!/bin/bash
set -e

# Ekklesia Portal - Cloud Run Deployment Script
PROJECT_ID="ekklesia-prod-10-2025"
REGION="europe-west2"
SERVICE_NAME="portal"
DB_INSTANCE="ekklesia-db"
DB_CONNECTION="${PROJECT_ID}:${REGION}:${DB_INSTANCE}"

echo "🚀 Deploying Ekklesia Portal to Cloud Run..."

# Step 1: Build and push container image
echo "📦 Building container image..."
gcloud builds submit \
    --project=${PROJECT_ID} \
    --tag=europe-west2-docker.pkg.dev/${PROJECT_ID}/ekklesia/portal:latest \
    .

# Step 2: Deploy to Cloud Run
echo "🌐 Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
    --project=${PROJECT_ID} \
    --image=europe-west2-docker.pkg.dev/${PROJECT_ID}/ekklesia/portal:latest \
    --region=${REGION} \
    --platform=managed \
    --allow-unauthenticated \
    --memory=512Mi \
    --cpu=1 \
    --timeout=300 \
    --concurrency=80 \
    --min-instances=0 \
    --max-instances=10 \
    --set-cloudsql-instances=${DB_CONNECTION} \
    --set-env-vars="EKKLESIA_PORTAL_CONFIG=/app/config.production.yml,DB_NAME=ekklesia_portal,CLOUD_SQL_CONNECTION=${DB_CONNECTION}" \
    --set-secrets="DB_PASSWORD=portal-db-password:latest,SESSION_SECRET_KEY=portal-session-secret:latest"

echo "✅ Deployment complete!"
echo "🔗 Service URL: $(gcloud run services describe ${SERVICE_NAME} --project=${PROJECT_ID} --region=${REGION} --format='value(status.url)')"
