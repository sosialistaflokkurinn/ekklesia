#!/bin/bash
# Add missing iam.serviceaccounts.actAs permission

set -e

PROJECT_ID="ekklesia-prod-10-2025"
PROJECT_NUMBER="521240388393"
COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

echo "======================================="
echo "🔧 Adding Service Account User Role"
echo "======================================="
echo "Project: $PROJECT_ID"
echo "Service Account: $COMPUTE_SA"
echo ""

echo "Granting Service Account User role..."
gcloud iam service-accounts add-iam-policy-binding $COMPUTE_SA \
    --member="serviceAccount:${COMPUTE_SA}" \
    --role="roles/iam.serviceAccountUser" \
    --project=$PROJECT_ID

echo ""
echo "======================================="
echo "✅ Permission granted!"
echo "======================================="
echo ""
echo "The Cloud Build service account can now deploy to Cloud Run."
echo ""
echo "Try deployment again:"
echo "  REGION=europe-west2 ./deploy_proxy.sh"
echo ""
