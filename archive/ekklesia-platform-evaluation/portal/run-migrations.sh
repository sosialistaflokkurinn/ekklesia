#!/bin/bash
set -e

# Ekklesia Portal - Database Migration Script
# Runs Alembic migrations via Cloud Run Jobs

PROJECT_ID="ekklesia-prod-10-2025"
REGION="europe-west2"
DB_INSTANCE="ekklesia-db"
DB_CONNECTION="${PROJECT_ID}:${REGION}:${DB_INSTANCE}"

echo "🔄 Running database migrations..."

# Build migration image
echo "📦 Building migration container..."
gcloud builds submit \
    --project=${PROJECT_ID} \
    --tag=europe-west2-docker.pkg.dev/${PROJECT_ID}/ekklesia/portal-migrate:latest \
    .

# Run migration as Cloud Run job
echo "⚙️  Executing migrations..."
gcloud run jobs create portal-migrate \
    --project=${PROJECT_ID} \
    --region=${REGION} \
    --image=europe-west2-docker.pkg.dev/${PROJECT_ID}/ekklesia/portal-migrate:latest \
    --set-cloudsql-instances=${DB_CONNECTION} \
    --set-env-vars="EKKLESIA_PORTAL_CONFIG=/app/config.production.yml,DB_NAME=ekklesia_portal,CLOUD_SQL_CONNECTION=${DB_CONNECTION}" \
    --set-secrets="DB_PASSWORD=portal-db-password:latest" \
    --execute-now \
    --wait \
    --task-timeout=5m \
    --args="migrate" \
    || echo "Job may already exist, updating..."

# If job exists, update and execute
gcloud run jobs update portal-migrate \
    --project=${PROJECT_ID} \
    --region=${REGION} \
    --image=europe-west2-docker.pkg.dev/${PROJECT_ID}/ekklesia/portal-migrate:latest \
    --set-cloudsql-instances=${DB_CONNECTION} \
    --set-env-vars="EKKLESIA_PORTAL_CONFIG=/app/config.production.yml,DB_NAME=ekklesia_portal,CLOUD_SQL_CONNECTION=${DB_CONNECTION}" \
    --set-secrets="DB_PASSWORD=portal-db-password:latest" \
    --task-timeout=5m \
    --args="migrate" \
    || true

gcloud run jobs execute portal-migrate \
    --project=${PROJECT_ID} \
    --region=${REGION} \
    --wait

echo "✅ Migrations complete!"
