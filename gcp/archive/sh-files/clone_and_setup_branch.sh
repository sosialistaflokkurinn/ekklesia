#!/bin/bash
# Clone the repository and setup feature branch with authentication work

echo "======================================"
echo "Git Repository Setup for ekklesia"
echo "======================================"
echo ""

# Save current work to a temporary location
echo "→ Backing up your current work..."
cp -r /home/gudro/Development/projects/ekklesia /tmp/ekklesia-backup-$(date +%Y%m%d-%H%M%S)
echo "  Backup saved to /tmp/"

echo ""
echo "→ Moving to parent directory..."
cd /home/gudro/Development/projects
mv ekklesia ekklesia-local-backup

echo ""
echo "→ Cloning the repository..."
git clone git@github.com:sosialistaflokkurinn/ekklesia.git

echo ""
echo "→ Entering repository..."
cd ekklesia

echo ""
echo "→ Fetching all branches..."
git fetch --all

echo ""
echo "→ Switching to feature branch..."
git checkout feature/zitadel-auth-development

echo ""
echo "======================================"
echo "Restoring Your Work"
echo "======================================"

echo "→ Copying your authentication work..."

# Copy documentation
cp -r ../ekklesia-local-backup/docs/* docs/ 2>/dev/null
cp ../ekklesia-local-backup/TECHNICAL_SOLUTION.md . 2>/dev/null

# Copy auth implementation
cp -r ../ekklesia-local-backup/auth . 2>/dev/null

# Copy config files
cp ../ekklesia-local-backup/.code-rules . 2>/dev/null
cp ../ekklesia-local-backup/.gitignore-auth . 2>/dev/null
cp ../ekklesia-local-backup/.env.zitadel* . 2>/dev/null

echo ""
echo "→ Current status:"
git status --short

echo ""
echo "======================================"
echo "Ready to Commit!"
echo "======================================"
echo ""
echo "Your work has been restored to the feature branch."
echo ""
echo "Next steps:"
echo "1. Add files:   git add ."
echo "2. Commit:      git commit -m \"feat: ZITADEL auth development setup (issues #2, #3, #4)\""
echo "3. Push:        git push origin feature/zitadel-auth-development"
echo ""
echo "Your original work is backed up in:"
echo "  ../ekklesia-local-backup/"
echo "======================================"