#!/bin/bash
# Initialize git repository and push authentication work to feature branch

echo "======================================"
echo "Setting up Git Repository"
echo "======================================"

cd /home/gudro/Development/projects/ekklesia

# Check if git repo exists
if [ ! -d ".git" ]; then
    echo "→ Initializing git repository..."
    git init
    
    echo "→ Adding remote origin..."
    git remote add origin git@github.com:sosialistaflokkurinn/ekklesia.git
    
    echo "→ Fetching from remote..."
    git fetch origin
    
    echo "→ Setting up main branch..."
    git checkout -b main origin/main
else
    echo "→ Git repository already initialized"
    git fetch origin
fi

echo ""
echo "→ Creating and switching to feature branch..."
git checkout -b feature/zitadel-auth-development origin/feature/zitadel-auth-development 2>/dev/null || \
git checkout feature/zitadel-auth-development

echo ""
echo "======================================"
echo "Adding Authentication Files"
echo "======================================"

# Documentation files
echo "→ Adding documentation..."
git add docs/identity.md 2>/dev/null
git add docs/ZITADEL_SETUP_CHECKLIST.md 2>/dev/null
git add docs/GCP_MIGRATION_PLAN.md 2>/dev/null
git add docs/ARCHITECTURE_DEV_VS_PROD.md 2>/dev/null

# Authentication implementation
echo "→ Adding auth implementation..."
git add auth/ 2>/dev/null

# Technical solution
echo "→ Adding technical solution..."
git add TECHNICAL_SOLUTION.md 2>/dev/null

# Project files
echo "→ Adding project config files..."
git add .code-rules 2>/dev/null
git add .gitignore-auth 2>/dev/null

echo ""
echo "======================================"
echo "Git Status"
echo "======================================"
git status

echo ""
echo "======================================"
echo "Next Steps:"
echo "======================================"
echo ""
echo "1. Review the staged files above"
echo ""
echo "2. Commit with:"
echo "   git commit -m \"feat: implement ZITADEL auth development setup (closes #2, #3, #4)\""
echo ""
echo "3. Push to remote:"
echo "   git push origin feature/zitadel-auth-development"
echo ""
echo "4. Optional - Create a Draft PR:"
echo "   - Title: 'WIP: ZITADEL Authentication Infrastructure'"
echo "   - Description: 'Development setup for issues #2, #3, #4'"
echo "   - Mark as Draft PR to indicate work in progress"
echo "======================================"