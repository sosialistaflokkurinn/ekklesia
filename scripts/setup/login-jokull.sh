#!/bin/bash
set -e

echo "========================================"
echo "🔐 Ekklesia Login Helper"
echo "========================================"
echo "Account: jokull@sosialistaflokkurinn.is"
echo "Project: ekklesia-prod-10-2025"
echo "========================================"

ACCOUNT="jokull@sosialistaflokkurinn.is"
PROJECT="ekklesia-prod-10-2025"

# Detect OS and set browser opener
if [[ "$OSTYPE" == "darwin"* ]]; then
	# macOS
	BROWSER_CMD="open"
else
	# Linux
	BROWSER_CMD="xdg-open"
fi

# Create temporary browser wrapper
BROWSER_WRAPPER=$(mktemp)
cat > "$BROWSER_WRAPPER" << EOF
#!/bin/bash
$BROWSER_CMD "\$1" 2>/dev/null
EOF
chmod +x "$BROWSER_WRAPPER"

# Cleanup on exit
trap "rm -f '$BROWSER_WRAPPER'" EXIT

echo ""
echo "🔵 1. Logging into Google Cloud (gcloud)..."
echo "   Veldu reikninginn: $ACCOUNT"
BROWSER="$BROWSER_WRAPPER" gcloud auth login

echo ""
echo "⚙️  Setting account and project..."
gcloud config set account "$ACCOUNT"
gcloud config set project "$PROJECT"
echo "✅ gcloud configured"

echo ""
echo "🔵 2. Setting up Application Default Credentials..."
echo "   (Required for Cloud SQL proxy, local scripts, SDK)"
BROWSER="$BROWSER_WRAPPER" gcloud auth application-default login

echo ""
echo "🔥 3. Logging into Firebase..."
BROWSER="$BROWSER_WRAPPER" firebase login --reauth --interactive

echo "✅ Firebase logged in"

echo ""
echo "========================================"
echo "🎉 Login complete!"
echo "========================================"
echo "You can now:"
echo "  - Deploy services: ./deploy.sh"
echo "  - Use Cloud SQL proxy: cloud-sql-proxy ... --gcloud-auth"
echo "  - Run Firebase commands: firebase deploy"
echo "========================================"
