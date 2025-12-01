#!/bin/bash
set -e

echo "========================================"
echo "🔐 Ekklesia Login Helper"
echo "========================================"

echo ""
echo "🔵 1. Logging into Google Cloud (gcloud)..."
# This will open a browser or ask for a code
gcloud auth login

echo "⚙️  Setting default project..."
gcloud config set project ekklesia-prod-10-2025
echo "✅ gcloud configured for project: ekklesia-prod-10-2025"

echo ""
echo "🔥 2. Logging into Firebase..."
# This will open a browser or ask for a code
firebase login

echo "✅ Firebase logged in"

echo ""
echo "========================================"
echo "🎉 Login complete!"
echo "You can now run deployment scripts."
echo "========================================"
