#!/bin/bash
# Commit GCP setup files to feature branch

echo "======================================"
echo "Committing GCP Migration Files"
echo "======================================"

cd /home/gudro/Development/projects/ekklesia

# Check current branch
echo "Current branch: $(git branch --show-current)"

# Add GCP files
echo ""
echo "Adding GCP setup files..."
git add gcp/
git add docs/identity.md  # Updated with GCP access status

# Show what will be committed
echo ""
echo "Files to be committed:"
git status --short

echo ""
echo "======================================"
echo "Ready to commit!"
echo ""
echo "Suggested commit message:"
echo ""
echo "feat: add GCP setup files - migration from dev to production"
echo ""
echo "Or:"
echo ""
echo "feat: GCP infrastructure setup"
echo ""
echo "- Add GCP project setup scripts"
echo "- Add Dockerfile for OIDC bridge proxy"  
echo "- Add Cloud Build configuration"
echo "- Update status: GCP access obtained"
echo ""
echo "Run:"
echo "  git commit -m 'your message'"
echo "  git push origin feature/zitadel-auth-development"