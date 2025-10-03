#!/bin/bash
# GCP Project Setup Script for ekklesia-voting

echo "======================================"
echo "GCP Setup for ZITADEL Self-Hosting"
echo "======================================"
echo ""
echo "You have GCP access with $300 free credits!"
echo ""

# Project setup commands
cat << 'EOF'
Step 1: Create a new project
-------------------------------
gcloud projects create ekklesia-voting --name="Ekklesia Voting System"
gcloud config set project ekklesia-voting

Step 2: Enable required APIs
-------------------------------
gcloud services enable compute.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable containerregistry.googleapis.com

Step 3: Create Cloud SQL for ZITADEL
-------------------------------
# PostgreSQL instance for ZITADEL database
gcloud sql instances create zitadel-db \
  --database-version=POSTGRES_14 \
  --tier=db-f1-micro \
  --region=europe-west1 \
  --network=default

# Create database
gcloud sql databases create zitadel --instance=zitadel-db

EOF