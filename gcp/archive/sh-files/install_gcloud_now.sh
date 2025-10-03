#!/bin/bash
# Add Google Cloud repository and install gcloud CLI

echo "======================================"
echo "Installing Google Cloud CLI on Fedora"
echo "======================================"
echo ""

# Step 1: Add the repository
echo "Step 1: Adding Google Cloud repository..."
sudo tee /etc/yum.repos.d/google-cloud-sdk.repo << 'EOF'
[google-cloud-cli]
name=Google Cloud CLI
baseurl=https://packages.cloud.google.com/yum/repos/cloud-sdk-el9-x86_64
enabled=1
gpgcheck=1
repo_gpgcheck=0
gpgkey=https://packages.cloud.google.com/yum/doc/rpm-package-key.gpg
EOF

echo ""
echo "Step 2: Installing google-cloud-cli..."
sudo dnf install -y google-cloud-cli

echo ""
echo "Step 3: Verifying installation..."
gcloud version

echo ""
echo "✅ Installation complete!"
echo ""
echo "Next: Run gcloud init to set up your account"