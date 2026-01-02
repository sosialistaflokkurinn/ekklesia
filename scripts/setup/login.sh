#!/bin/bash
set -e

echo "========================================"
echo "🔐 Ekklesia Login Helper"
echo "========================================"
echo "Account: gudrodur@sosialistaflokkurinn.is"
echo "Project: ekklesia-prod-10-2025"
echo "========================================"

echo ""
echo "🔵 1. Logging into Google Cloud (gcloud)..."
gcloud auth login

echo ""
echo "⚙️  Setting account and project..."
gcloud config set account gudrodur@sosialistaflokkurinn.is
gcloud config set project ekklesia-prod-10-2025
echo "✅ gcloud configured"

echo ""
echo "🔵 2. Setting up Application Default Credentials..."
echo "   (Required for Cloud SQL proxy, local scripts, SDK)"
gcloud auth application-default login

echo ""
echo "🔥 3. Logging into Firebase..."
firebase login --reauth

echo "✅ Firebase logged in"

echo ""
echo "========================================"
echo "🎉 Login complete!"
echo "========================================"
echo "You can now:"
echo "  - Deploy services: ./deploy.sh"
echo "  - Use Cloud SQL proxy: cloud-sql-proxy ... --gcloud-auth"
echo "  - Run Firebase commands: firebase deploy"
echo "========================================"
