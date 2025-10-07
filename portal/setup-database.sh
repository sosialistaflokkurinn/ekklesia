#!/bin/bash
set -e

# Ekklesia Portal - Database Setup Script
PROJECT_ID="ekklesia-prod-10-2025"
DB_INSTANCE="ekklesia-db"
DB_NAME="ekklesia_portal"
DB_USER="ekklesia_portal"

# Get the database password from Secret Manager (must be created first)
echo "📊 Setting up database for Ekklesia Portal..."

# Create database
echo "Creating database: ${DB_NAME}..."
gcloud sql databases create ${DB_NAME} \
    --instance=${DB_INSTANCE} \
    --project=${PROJECT_ID} \
    --charset=UTF8 \
    || echo "Database ${DB_NAME} may already exist"

# Create user
echo "Creating user: ${DB_USER}..."
DB_PASSWORD=$(gcloud secrets versions access latest --secret=portal-db-password --project=${PROJECT_ID})

gcloud sql users create ${DB_USER} \
    --instance=${DB_INSTANCE} \
    --project=${PROJECT_ID} \
    --password="${DB_PASSWORD}" \
    || echo "User ${DB_USER} may already exist"

# Grant privileges (done via psql)
echo "Granting privileges to ${DB_USER}..."
echo "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" | \
    gcloud sql connect ${DB_INSTANCE} \
    --project=${PROJECT_ID} \
    --user=postgres \
    --database=postgres

echo "✅ Database setup complete!"
echo ""
echo "📝 Connection details:"
echo "  Database: ${DB_NAME}"
echo "  User: ${DB_USER}"
echo "  Instance: ${DB_INSTANCE}"
echo "  Connection: ${PROJECT_ID}:europe-west2:${DB_INSTANCE}"
