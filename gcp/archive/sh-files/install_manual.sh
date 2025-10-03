#!/bin/bash
# Alternative: Direct download installation

echo "======================================"
echo "Alternative: Manual Installation"
echo "======================================"
echo ""
echo "Since the repository method isn't working,"
echo "let's use the direct download method:"
echo ""

# Go to home directory
cd ~

# Download
echo "1. Downloading Google Cloud SDK..."
curl -O https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-linux-x86_64.tar.gz

# Extract
echo ""
echo "2. Extracting..."
tar -xf google-cloud-cli-linux-x86_64.tar.gz

# Install
echo ""
echo "3. Installing..."
./google-cloud-sdk/install.sh

echo ""
echo "4. Reload your shell configuration:"
echo "   source ~/.bashrc"
echo ""
echo "Or open a new terminal"
echo ""
echo "5. Then verify with:"
echo "   gcloud version"