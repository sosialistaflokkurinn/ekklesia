#!/bin/bash
# Clone repository and add only the requested authentication work

echo "======================================"
echo "Git Setup - Issues #2, #3, #4 Only"
echo "======================================"
echo ""

cd /home/gudro/Development/projects

# Backup current work
echo "→ Backing up current work..."
cp -r ekklesia /tmp/ekklesia-backup-$(date +%Y%m%d-%H%M%S)

# Move current directory
mv ekklesia ekklesia-local

# Clone repository
echo "→ Cloning repository..."
git clone git@github.com:sosialistaflokkurinn/ekklesia.git
cd ekklesia

# Checkout feature branch
echo "→ Switching to feature branch..."
git fetch --all
git checkout feature/zitadel-auth-development

echo ""
echo "======================================"
echo "Adding Files for Issues #2, #3, #4"
echo "======================================"

# Copy ONLY the requested documentation
echo "→ Copying identity documentation..."
cp ../ekklesia-local/docs/identity.md docs/ 2>/dev/null
cp ../ekklesia-local/docs/ZITADEL_SETUP_CHECKLIST.md docs/ 2>/dev/null
cp ../ekklesia-local/docs/GCP_MIGRATION_PLAN.md docs/ 2>/dev/null
cp ../ekklesia-local/docs/ARCHITECTURE_DEV_VS_PROD.md docs/ 2>/dev/null

# Copy authentication implementation
echo "→ Copying auth implementation..."
cp -r ../ekklesia-local/auth . 2>/dev/null

echo ""
echo "→ Files to be committed:"
git status --short

echo ""
echo "======================================"
echo "Ready to Commit"
echo "======================================"
echo ""
echo "Add and commit:"
echo "  git add docs/identity.md docs/ZITADEL_SETUP_CHECKLIST.md docs/GCP_MIGRATION_PLAN.md docs/ARCHITECTURE_DEV_VS_PROD.md auth/"
echo "  git commit -m \"feat: add ZITADEL authentication setup (issues #2, #3, #4)\""
echo "  git push origin feature/zitadel-auth-development"
echo ""