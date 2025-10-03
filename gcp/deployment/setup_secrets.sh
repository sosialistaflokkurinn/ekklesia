#!/bin/bash
# Setup GCP Secret Manager with ZITADEL secrets

echo "======================================"
echo "🔐 Setting up GCP Secrets"
echo "======================================"
echo ""

# Check if project is set
PROJECT=$(gcloud config get-value project)
if [ -z "$PROJECT" ]; then
    echo "❌ No project set. Run ./quick_setup.sh first"
    exit 1
fi

echo "Project: $PROJECT"
echo ""

# Check if .env.zitadel exists
ENV_FILE="../.env.zitadel"
if [ ! -f "$ENV_FILE" ]; then
    echo "⚠️  Warning: $ENV_FILE not found"
    echo "You'll need to enter secrets manually"
    echo ""
fi

echo "Creating secrets in GCP Secret Manager..."
echo ""

# Function to create or update a secret
create_secret() {
    local name=$1
    local value=$2
    
    echo -n "Creating secret '$name'... "
    
    # Check if secret exists
    if gcloud secrets describe $name &>/dev/null; then
        echo "exists, updating..."
        echo -n "$value" | gcloud secrets versions add $name --data-file=-
    else
        echo -n "$value" | gcloud secrets create $name --data-file=-
    fi
    
    if [ $? -eq 0 ]; then
        echo "✅"
    else
        echo "❌ Failed"
    fi
}

# Load values from .env.zitadel if it exists
if [ -f "$ENV_FILE" ]; then
    echo "Loading from .env.zitadel..."
    source $ENV_FILE
    
    # Create secrets
    create_secret "kenni-client-id" "$KENNI_CLIENT_ID"
    create_secret "kenni-client-secret" "$KENNI_CLIENT_SECRET"
    create_secret "kenni-issuer" "$KENNI_ISSUER"
    create_secret "zitadel-org-id" "$ZITADEL_ORG_ID"
    create_secret "zitadel-project-id" "$ZITADEL_PROJECT_ID"
else
    echo "Manual secret creation:"
    echo ""
    echo "Run these commands with your actual values:"
    echo ""
    echo "echo -n '@sosi-kosningakerfi.is/rafr-nt-kosningakerfi-s-s' | \\"
    echo "  gcloud secrets create kenni-client-id --data-file=-"
    echo ""
    echo "echo -n 'YOUR_SECRET_HERE' | \\"
    echo "  gcloud secrets create kenni-client-secret --data-file=-"
    echo ""
fi

echo ""
echo "======================================"
echo "📋 Created Secrets:"
echo "======================================"
gcloud secrets list --format="table(NAME,CREATED)"

echo ""
echo "======================================"
echo "🔑 Granting Access"
echo "======================================"
echo ""
echo "To allow Cloud Run to access secrets:"
echo ""
echo "gcloud secrets add-iam-policy-binding kenni-client-secret \\"
echo "  --member='serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com' \\"
echo "  --role='roles/secretmanager.secretAccessor'"
echo ""
echo "Replace PROJECT_NUMBER with your actual project number"