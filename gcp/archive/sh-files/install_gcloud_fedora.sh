#!/bin/bash
# Install and setup Google Cloud SDK on Fedora

echo "======================================"
echo "Google Cloud CLI Installation - Fedora"
echo "======================================"
echo ""

# Step 1: Install gcloud CLI
echo "Step 1: Installing Google Cloud CLI..."
echo "--------------------------------------"
echo ""
echo "Run this command:"
echo ""
echo "sudo dnf install google-cloud-cli"
echo ""
echo "If that doesn't work, try the alternative method:"
echo ""

cat << 'EOF'
# Alternative: Add Google Cloud SDK repo
sudo tee -a /etc/yum.repos.d/google-cloud-sdk.repo << EOM
[google-cloud-cli]
name=Google Cloud CLI
baseurl=https://packages.cloud.google.com/yum/repos/cloud-sdk-el9-x86_64
enabled=1
gpgcheck=1
repo_gpgcheck=0
gpgkey=https://packages.cloud.google.com/yum/doc/rpm-package-key.gpg
EOM

# Then install
sudo dnf install google-cloud-cli
EOF

echo ""
echo "======================================"
echo "Step 2: Initialize gcloud"
echo "======================================"
echo ""
echo "After installation, run:"
echo ""
echo "gcloud init"
echo ""
echo "This will:"
echo "1. Open browser for authentication"
echo "2. Let you select/create a project"
echo "3. Set default compute region (choose europe-west1)"
echo ""

echo "======================================"
echo "Step 3: Authenticate"
echo "======================================"
echo ""
echo "gcloud auth login"
echo ""
echo "Use your gudrodur@sosialistaflokkurinn.is account"
echo ""

echo "======================================"
echo "Step 4: Set Application Default Credentials"
echo "======================================"
echo ""
echo "gcloud auth application-default login"
echo ""
echo "This allows applications to use your credentials"
echo ""

echo "======================================"
echo "Step 5: Create and Set Project"
echo "======================================"
echo ""
echo "# Create new project"
echo "gcloud projects create ekklesia-voting --name=\"Ekklesia Voting System\""
echo ""
echo "# Set as active project"
echo "gcloud config set project ekklesia-voting"
echo ""
echo "# Verify"
echo "gcloud config list"
echo ""

echo "======================================"
echo "Step 6: Enable Billing"
echo "======================================"
echo ""
echo "You need to enable billing in the console:"
echo "https://console.cloud.google.com/billing"
echo ""
echo "Even for free trial, billing must be enabled"
echo ""

echo "======================================"
echo "Step 7: Enable Required APIs"
echo "======================================"
echo ""
echo "gcloud services enable compute.googleapis.com"
echo "gcloud services enable run.googleapis.com"
echo "gcloud services enable secretmanager.googleapis.com"
echo "gcloud services enable sqladmin.googleapis.com"
echo "gcloud services enable cloudbuild.googleapis.com"
echo "gcloud services enable containerregistry.googleapis.com"
echo ""

echo "======================================"
echo "Verification Commands"
echo "======================================"
echo ""
echo "# Check authentication"
echo "gcloud auth list"
echo ""
echo "# Check current project"
echo "gcloud config get-value project"
echo ""
echo "# List all projects"
echo "gcloud projects list"
echo ""
echo "# Check enabled APIs"
echo "gcloud services list --enabled"
echo ""