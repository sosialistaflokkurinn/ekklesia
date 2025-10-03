#!/bin/bash
# Quick gcloud setup for Fedora

echo "======================================"
echo "🚀 Quick GCloud Setup for Fedora"
echo "======================================"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "📦 gcloud CLI not found. Installing..."
    echo ""
    echo "Option 1: Quick install (recommended):"
    echo "----------------------------------------"
    echo "sudo dnf install -y google-cloud-cli"
    echo ""
    echo "Option 2: If that fails, use snap:"
    echo "----------------------------------------"
    echo "sudo dnf install -y snapd"
    echo "sudo snap install google-cloud-cli --classic"
    echo ""
    echo "Option 3: Manual download:"
    echo "----------------------------------------"
    echo "curl -O https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-linux-x86_64.tar.gz"
    echo "tar -xf google-cloud-cli-linux-x86_64.tar.gz"
    echo "./google-cloud-sdk/install.sh"
    echo ""
    echo "Run one of the above commands, then run this script again."
    exit 1
else
    echo "✅ gcloud is already installed!"
    gcloud version
fi

echo ""
echo "======================================"
echo "🔐 Authentication"
echo "======================================"
echo ""

# Check if already authenticated
if gcloud auth list --format="value(account)" | grep -q "@"; then
    echo "✅ Already authenticated as:"
    gcloud auth list --format="value(account)"
else
    echo "❌ Not authenticated. Running login..."
    echo ""
    echo "This will open your browser."
    echo "Login with: gudrodur@sosialistaflokkurinn.is"
    echo ""
    echo "Press Enter to continue..."
    read
    gcloud auth login
fi

echo ""
echo "======================================"
echo "📁 Project Setup"
echo "======================================"
echo ""

# Check current project
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
if [ "$CURRENT_PROJECT" = "ekklesia-voting" ]; then
    echo "✅ Project already set to: ekklesia-voting"
else
    echo "Setting up ekklesia-voting project..."
    echo ""
    
    # Check if project exists
    if gcloud projects list --format="value(projectId)" | grep -q "^ekklesia-voting$"; then
        echo "Project exists. Setting as active..."
        gcloud config set project ekklesia-voting
    else
        echo "Creating new project..."
        echo "Note: This requires billing to be enabled"
        echo ""
        echo "Press Enter to create project or Ctrl+C to skip..."
        read
        gcloud projects create ekklesia-voting \
            --name="Ekklesia Voting System" \
            --organization=sosialistaflokkurinn.is
        gcloud config set project ekklesia-voting
    fi
fi

echo ""
echo "======================================"
echo "⚙️  Default Settings"
echo "======================================"
echo ""

# Set default region
echo "Setting default region to europe-west1 (Belgium, closest to Iceland)..."
gcloud config set compute/region europe-west1
gcloud config set compute/zone europe-west1-b
gcloud config set run/region europe-west1

echo ""
echo "Current configuration:"
gcloud config list

echo ""
echo "======================================"
echo "✅ Setup Complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Enable billing at: https://console.cloud.google.com/billing"
echo "2. Run: ./enable_apis.sh (to enable required APIs)"
echo "3. Create secrets: ./setup_secrets.sh"
echo ""