#!/bin/bash
# Fix Cloud Run public access by modifying organization policy

set -e

PROJECT_ID="ekklesia-prod-10-2025"
SERVICE_NAME="oidc-bridge-proxy"
REGION="europe-west2"

echo "======================================="
echo "🔓 Enabling Public Access for OIDC Proxy"
echo "======================================="
echo "Service: $SERVICE_NAME"
echo "Region: $REGION"
echo ""

echo "Step 1: Removing domain restriction policy..."
gcloud resource-manager org-policies delete iam.allowedPolicyMemberDomains \
  --project=$PROJECT_ID 2>/dev/null || echo "Policy already removed or doesn't exist"

echo ""
echo "Step 2: Adding public access to Cloud Run service..."
gcloud run services add-iam-policy-binding $SERVICE_NAME \
  --region=$REGION \
  --member="allUsers" \
  --role="roles/run.invoker" \
  --project=$PROJECT_ID

echo ""
echo "======================================="
echo "✅ Public access enabled!"
echo "======================================="
echo ""
echo "Test the service:"
echo "  curl https://oidc-bridge-proxy-ymzrguoifa-nw.a.run.app/health"
echo ""
