#!/bin/bash
# Enable required GCP APIs

echo "======================================"
echo "📚 Enabling Required GCP APIs"
echo "======================================"
echo ""

# Check if we have a project set
PROJECT=$(gcloud config get-value project)
if [ -z "$PROJECT" ]; then
    echo "❌ No project set. Run ./quick_setup.sh first"
    exit 1
fi

echo "Project: $PROJECT"
echo ""

# APIs to enable
APIS=(
    "compute.googleapis.com"           # Compute Engine
    "run.googleapis.com"               # Cloud Run
    "secretmanager.googleapis.com"     # Secret Manager
    "sqladmin.googleapis.com"          # Cloud SQL
    "cloudbuild.googleapis.com"        # Cloud Build
    "containerregistry.googleapis.com" # Container Registry
    "cloudresourcemanager.googleapis.com" # Resource Manager
)

echo "Enabling APIs..."
echo "This may take a few minutes..."
echo ""

for api in "${APIS[@]}"; do
    echo -n "Enabling $api... "
    if gcloud services enable $api 2>/dev/null; then
        echo "✅"
    else
        echo "⚠️  (may already be enabled)"
    fi
done

echo ""
echo "======================================"
echo "📋 Enabled APIs:"
echo "======================================"
gcloud services list --enabled --format="table(NAME,TITLE)"

echo ""
echo "✅ API setup complete!"