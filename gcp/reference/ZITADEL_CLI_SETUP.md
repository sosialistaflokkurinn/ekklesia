# 🔧 ZITADEL CLI Setup Guide

**Date:** 2025-10-03
**Status:** ✅ **WORKING - Service account with IAM Owner access**

---

## 📋 Overview

This guide covers setting up ZITADEL CLI/API access using a service account with Personal Access Token (PAT).

**What's Configured:**
- ✅ Service account "cli" created
- ✅ Personal Access Token generated
- ✅ IAM Owner role assigned
- ✅ API access tested and working

---

## 🔑 Service Account Details

### Account Information
```yaml
Name: cli
Description: Service account for CLI/API access
Username: zitadel
User ID: 340499069199721595
Type: Machine User (Service Account)
Status: Active
Created: 02. October 2025, 23:54
```

### Roles & Permissions
```yaml
Organization: Ekklesia
Type: IAM
Role: IAM Owner
Access: Full administrative access to ZITADEL instance
```

### Personal Access Token
```yaml
Token: jmZEli4KItLLXm7n860tZCGFXPZuCfBkBDB-x81GarHJ048gvrju4nOjspXFzrs40eKk0Bw
Status: Active
Created: 02. October 2025, 23:57
Expiration: No expiration (until manually revoked)
```

---

## 🚀 How to Use the CLI

### Option 1: Direct API Calls with cURL

#### Set Environment Variable
```bash
export ZITADEL_TOKEN="jmZEli4KItLLXm7n860tZCGFXPZuCfBkBDB-x81GarHJ048gvrju4nOjspXFzrs40eKk0Bw"
export ZITADEL_URL="https://zitadel-ymzrguoifa-nw.a.run.app"
```

#### Test Authentication
```bash
curl -H "Authorization: Bearer $ZITADEL_TOKEN" \
  $ZITADEL_URL/auth/v1/users/me
```

**Expected output:**
```json
{
  "user": {
    "id": "340499069199721595",
    "userName": "zitadel",
    "loginNames": ["zitadel"],
    "machine": {
      "name": "cli",
      "description": "Service account for CLI/API access"
    }
  }
}
```

#### Get Organization Info
```bash
curl -H "Authorization: Bearer $ZITADEL_TOKEN" \
  $ZITADEL_URL/management/v1/orgs/me
```

**Expected output:**
```json
{
  "org": {
    "id": "340493698645225792",
    "name": "Ekklesia",
    "primaryDomain": "ekklesia.zitadel-ymzrguoifa-nw.a.run.app",
    "state": "ORG_STATE_ACTIVE"
  }
}
```

---

### Option 2: ZITADEL CLI (Official)

#### Install ZITADEL CLI
```bash
# Linux/macOS
curl -L https://github.com/zitadel/zitadel-tools/releases/latest/download/zitadel-linux-amd64 -o zitadel
chmod +x zitadel
sudo mv zitadel /usr/local/bin/

# Or use package manager
# brew install zitadel/tap/zitadel  # macOS
# go install github.com/zitadel/zitadel-tools/cmd/zitadel@latest  # Go
```

#### Login with PAT
```bash
export ZITADEL_TOKEN="jmZEli4KItLLXm7n860tZCGFXPZuCfBkBDB-x81GarHJ048gvrju4nOjspXFzrs40eKk0Bw"

zitadel login \
  --issuer https://zitadel-ymzrguoifa-nw.a.run.app \
  --token $ZITADEL_TOKEN
```

#### Common CLI Commands
```bash
# List users
zitadel users list

# Get user details
zitadel users get --user-id 340504966944793723

# List organizations
zitadel orgs list

# List projects
zitadel projects list

# Create user
zitadel users create human \
  --email newuser@example.com \
  --first-name "New" \
  --last-name "User"
```

---

## 📖 Common API Endpoints

### Authentication APIs

#### Get Current User
```bash
GET /auth/v1/users/me
```

#### List User's Grants
```bash
GET /auth/v1/usergrants
```

### Management APIs (Organization Level)

#### List Users
```bash
GET /management/v1/users
```

#### Get Organization
```bash
GET /management/v1/orgs/me
```

#### List Projects
```bash
GET /management/v1/projects
```

#### List Applications
```bash
GET /management/v1/projects/{project_id}/apps
```

### Admin APIs (Instance Level)

#### Get Instance
```bash
GET /admin/v1/instance
```

#### List Organizations
```bash
POST /admin/v1/orgs/_search
```

---

## 🔧 Setup Steps (For Reference)

### Step 1: Create Service Account

1. Go to ZITADEL Console: https://zitadel-ymzrguoifa-nw.a.run.app/ui/console
2. Navigate to: **Users** → **New** → **Service Account**
3. Fill in:
   - Name: `cli`
   - Description: `Service account for CLI/API access`
4. Click **Create**

### Step 2: Generate Personal Access Token

1. Click on the newly created service account
2. Go to: **Personal Access Tokens** tab
3. Click **New**
4. Optional: Set expiration date (or leave empty for no expiration)
5. Click **Add**
6. **Copy the token immediately** (it won't be shown again!)

### Step 3: Grant IAM Owner Role

1. Click on service account
2. Go to: **Memberships** tab
3. You should see:
   - Display Name: Ekklesia
   - Type: IAM
4. Click on the row to edit
5. Select Role: **IAM Owner**
6. Save

### Step 4: Test Access

```bash
export TOKEN="your-token-here"
curl -H "Authorization: Bearer $TOKEN" \
  https://zitadel-ymzrguoifa-nw.a.run.app/auth/v1/users/me
```

---

## 🛡️ Security Best Practices

### Token Storage

**❌ Don't:**
- Commit tokens to Git
- Share tokens in plain text
- Store tokens in unencrypted files

**✅ Do:**
- Use environment variables
- Store in secret managers (e.g., GCP Secret Manager)
- Use `.env` files (add to `.gitignore`)
- Rotate tokens periodically

### Example: Store in Secret Manager
```bash
# Store token in GCP Secret Manager
echo -n "jmZEli4KItLLXm7n860tZCGFXPZuCfBkBDB-x81GarHJ048gvrju4nOjspXFzrs40eKk0Bw" | \
  gcloud secrets create zitadel-cli-token --data-file=-

# Retrieve when needed
export ZITADEL_TOKEN=$(gcloud secrets versions access latest --secret=zitadel-cli-token)
```

### Token Rotation

When to rotate:
- ✅ Periodically (e.g., every 90 days)
- ✅ When team member leaves
- ✅ If token is compromised
- ✅ Before production deployment

How to rotate:
1. Generate new PAT in ZITADEL Console
2. Update stored token in Secret Manager
3. Test new token
4. Revoke old token

---

## 🧪 Verification Tests

### Test 1: Authentication ✅
```bash
curl -H "Authorization: Bearer $ZITADEL_TOKEN" \
  https://zitadel-ymzrguoifa-nw.a.run.app/auth/v1/users/me

# Expected: User info with id 340499069199721595
```

### Test 2: Organization Access ✅
```bash
curl -H "Authorization: Bearer $ZITADEL_TOKEN" \
  https://zitadel-ymzrguoifa-nw.a.run.app/management/v1/orgs/me

# Expected: Organization "Ekklesia" details
```

### Test 3: Admin Permissions ✅
```bash
curl -X POST \
  -H "Authorization: Bearer $ZITADEL_TOKEN" \
  -H "Content-Type: application/json" \
  https://zitadel-ymzrguoifa-nw.a.run.app/admin/v1/orgs/_search

# Expected: List of organizations (requires IAM Owner role)
```

---

## 📚 API Documentation

**Official ZITADEL API Docs:**
- **API Reference:** https://zitadel.com/docs/apis/introduction
- **Authentication:** https://zitadel.com/docs/guides/integrate/token-introspection
- **Management API:** https://zitadel.com/docs/apis/resources/mgmt/management-service-list-users
- **Admin API:** https://zitadel.com/docs/apis/resources/admin/admin-service-healthz

**OpenAPI Specs:**
```bash
# Get OpenAPI spec for your instance
curl https://zitadel-ymzrguoifa-nw.a.run.app/openapi/v2/swagger.json > zitadel-api.json
```

---

## 🐛 Troubleshooting

### Error: "Unauthenticated"
**Cause:** Token not valid or expired
**Solution:**
```bash
# Check if token is set
echo $ZITADEL_TOKEN

# Test authentication
curl -H "Authorization: Bearer $ZITADEL_TOKEN" \
  https://zitadel-ymzrguoifa-nw.a.run.app/auth/v1/users/me
```

### Error: "Permission Denied"
**Cause:** Service account doesn't have required role
**Solution:**
1. Go to ZITADEL Console → Users → cli
2. Navigate to Memberships tab
3. Verify "IAM Owner" role is assigned
4. If missing, add the role

### Error: "Not Found" (404)
**Cause:** Wrong API endpoint
**Solution:**
```bash
# Check ZITADEL version and available endpoints
curl https://zitadel-ymzrguoifa-nw.a.run.app/debug/validate

# Use correct API version (v1, v2, etc.)
```

---

## 💡 Tips & Tricks

### Create Bash Alias
```bash
# Add to ~/.bashrc or ~/.zshrc
alias zauth='curl -H "Authorization: Bearer $ZITADEL_TOKEN"'

# Usage
zauth https://zitadel-ymzrguoifa-nw.a.run.app/auth/v1/users/me
```

### Pretty Print JSON
```bash
curl -H "Authorization: Bearer $ZITADEL_TOKEN" \
  https://zitadel-ymzrguoifa-nw.a.run.app/management/v1/orgs/me | jq .
```

### Create Helper Script
```bash
#!/bin/bash
# zitadel-api.sh

ZITADEL_TOKEN="${ZITADEL_TOKEN:-jmZEli4KItLLXm7n860tZCGFXPZuCfBkBDB-x81GarHJ048gvrju4nOjspXFzrs40eKk0Bw}"
ZITADEL_URL="https://zitadel-ymzrguoifa-nw.a.run.app"

curl -H "Authorization: Bearer $ZITADEL_TOKEN" \
  -H "Content-Type: application/json" \
  "$ZITADEL_URL$@"
```

Usage:
```bash
./zitadel-api.sh /management/v1/orgs/me | jq .
```

---

## ✅ Success Criteria

All verified working:
- [x] Service account created and active
- [x] Personal Access Token generated
- [x] IAM Owner role assigned
- [x] Authentication working
- [x] Organization access verified
- [x] Admin permissions confirmed

---

## 🔗 Related Documentation

- **PHASE_4_COMPLETE.md** - Overall project completion
- **ZITADEL_CONSOLE_SUCCESS.md** - ZITADEL deployment details
- **KENNI_INTEGRATION_SUCCESS.md** - Authentication integration

---

**Service Account Status:** ✅ **ACTIVE and READY**
**API Access:** ✅ **WORKING with IAM Owner permissions**
**Last Updated:** 2025-10-03

---

**Quick Reference:**
```bash
# Service Account
User ID: 340499069199721595
Username: zitadel
Name: cli
Role: IAM Owner

# PAT Token
jmZEli4KItLLXm7n860tZCGFXPZuCfBkBDB-x81GarHJ048gvrju4nOjspXFzrs40eKk0Bw

# ZITADEL URL
https://zitadel-ymzrguoifa-nw.a.run.app
```
