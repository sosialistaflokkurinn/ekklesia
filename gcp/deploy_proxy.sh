#!/bin/bash
# Deploy OIDC Bridge Proxy to Cloud Run
# This script handles the two-step deployment needed to set PROXY_ISSUER

set -e  # Exit on error

PROJECT_ID="ekklesia-prod-10-2025"
REGION="${REGION:-europe-west1}"  # Can be overridden with REGION=europe-north1 ./deploy_proxy.sh
SERVICE_NAME="oidc-bridge-proxy"

echo "======================================="
echo "🚀 Deploying OIDC Bridge Proxy"
echo "======================================="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo ""
echo "💡 Tip: Run ./test_region_latency.sh to find the best region"
echo "    Then set: REGION=best-region ./deploy_proxy.sh"
echo ""

# Check if we're in the right directory
if [ ! -f "oidc-bridge-proxy.js" ]; then
    echo "❌ Error: oidc-bridge-proxy.js not found"
    echo "   Please run this script from the /gcp directory"
    exit 1
fi

if [ ! -f "Dockerfile.bridge-proxy" ]; then
    echo "❌ Error: Dockerfile.bridge-proxy not found"
    exit 1
fi

echo "✅ All required files found"
echo ""

# Step 1: Initial deployment with placeholder PROXY_ISSUER
echo "======================================="
echo "📦 Step 1: Building and deploying..."
echo "======================================="
echo ""

gcloud builds submit \
    --config=cloudbuild.yaml \
    --project=$PROJECT_ID \
    --substitutions=_REGION=$REGION

echo ""
echo "✅ Initial deployment complete!"
echo ""

# Step 2: Get the Cloud Run service URL
echo "======================================="
echo "🔍 Step 2: Getting Cloud Run URL..."
echo "======================================="
echo ""

SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
    --region=$REGION \
    --project=$PROJECT_ID \
    --format='value(status.url)')

if [ -z "$SERVICE_URL" ]; then
    echo "❌ Error: Could not get Cloud Run service URL"
    exit 1
fi

echo "📍 Cloud Run URL: $SERVICE_URL"
echo ""

# Step 3: Update with correct PROXY_ISSUER
echo "======================================="
echo "🔄 Step 3: Updating PROXY_ISSUER..."
echo "======================================="
echo ""

gcloud run services update $SERVICE_NAME \
    --region=$REGION \
    --project=$PROJECT_ID \
    --set-env-vars=PROXY_ISSUER=$SERVICE_URL

echo ""
echo "✅ PROXY_ISSUER updated!"
echo ""

# Verification
echo "======================================="
echo "✅ Deployment Complete!"
echo "======================================="
echo ""
echo "Service Details:"
echo "  Name: $SERVICE_NAME"
echo "  URL: $SERVICE_URL"
echo "  Region: $REGION"
echo ""
echo "📋 OIDC Endpoints:"
echo "  Discovery: $SERVICE_URL/.well-known/openid-configuration"
echo "  JWKS: $SERVICE_URL/.well-known/jwks.json"
echo "  Health: $SERVICE_URL/health"
echo ""
echo "🧪 Test the deployment:"
echo "  curl $SERVICE_URL/health"
echo ""
echo "📝 Next steps:"
echo "  1. Test the health endpoint"
echo "  2. Update ZITADEL external IdP configuration with:"
echo "     - Issuer: $SERVICE_URL"
echo "     - Discovery URL: $SERVICE_URL/.well-known/openid-configuration"
echo ""
