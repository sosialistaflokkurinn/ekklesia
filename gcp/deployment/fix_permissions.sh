#!/bin/bash
# Fix Cloud Build permissions
# Grants necessary roles to Cloud Build service account

set -e

PROJECT_ID="ekklesia-prod-10-2025"
PROJECT_NUMBER="521240388393"
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

echo "======================================="
echo "🔧 Fixing Cloud Build Permissions"
echo "======================================="
echo "Project: $PROJECT_ID"
echo "Service Account: $SERVICE_ACCOUNT"
echo ""

echo "Granting Cloud Build Service Account role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/cloudbuild.builds.builder"

echo ""
echo "Granting Storage Admin role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/storage.admin"

echo ""
echo "Granting Secret Manager Accessor role (for runtime)..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor"

echo ""
echo "Granting Cloud Run Admin role..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/run.admin"

echo ""
echo "======================================="
echo "✅ Permissions granted!"
echo "======================================="
echo ""
echo "Roles granted to ${SERVICE_ACCOUNT}:"
echo "  - roles/cloudbuild.builds.builder (Build containers)"
echo "  - roles/storage.admin (Access Cloud Storage)"
echo "  - roles/secretmanager.secretAccessor (Read secrets)"
echo "  - roles/run.admin (Deploy to Cloud Run)"
echo ""
echo "You can now run: ./deploy_proxy.sh"
echo ""
