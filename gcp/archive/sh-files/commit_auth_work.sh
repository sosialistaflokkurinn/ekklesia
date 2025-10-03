#!/bin/bash
# Script to commit authentication work to feature branch

echo "======================================"
echo "Committing ZITADEL Auth Development"
echo "======================================"

cd /home/gudro/Development/projects/ekklesia

# Switch to the feature branch
echo "→ Switching to feature/zitadel-auth-development branch..."
git fetch origin
git checkout feature/zitadel-auth-development

# Check current status
echo ""
echo "→ Current git status:"
git status

# Files to add for authentication work
echo ""
echo "→ Adding authentication files..."

# Documentation files
git add docs/identity.md 2>/dev/null
git add docs/ZITADEL_SETUP_CHECKLIST.md 2>/dev/null
git add docs/GCP_MIGRATION_PLAN.md 2>/dev/null
git add docs/ARCHITECTURE_DEV_VS_PROD.md 2>/dev/null

# Authentication implementation
git add auth/ 2>/dev/null

# Technical solution doc
git add TECHNICAL_SOLUTION.md 2>/dev/null

# Code rules and gitignore
git add .code-rules 2>/dev/null
git add .gitignore-auth 2>/dev/null

echo ""
echo "→ Files staged for commit:"
git status --short

echo ""
echo "======================================"
echo "Ready to commit!"
echo ""
echo "Suggested commit message:"
echo "feat: implement ZITADEL authentication infrastructure (issues #2, #3, #4)"
echo ""
echo "Or use a more detailed message:"
echo "feat: ZITADEL auth development setup"
echo ""
echo "- Configure ZITADEL Cloud tenant (issue #2)"
echo "- Setup Kenni.is IdP with bridge proxy (issue #3)"  
echo "- Register Members OIDC app with PKCE (issue #4)"
echo "- Add Python implementation and test scripts"
echo "- Document migration plan to GCP"
echo ""
echo "Note: This is temporary development setup pending GCP migration"
echo "======================================"
echo ""
echo "To commit, run:"
echo "git commit -m 'your message here'"
echo ""
echo "Then push:"
echo "git push origin feature/zitadel-auth-development"