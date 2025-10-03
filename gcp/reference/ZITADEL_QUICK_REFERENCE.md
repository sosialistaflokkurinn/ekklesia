# 🚀 ZITADEL Deployment Quick Reference

**Service URL:** https://zitadel-521240388393.europe-west2.run.app  
**Status:** ✅ Operational (awaiting domain configuration)  
**Updated:** 2025-10-02

---

## 🔑 Critical Configuration

### Correct Environment Variables
```bash
# ✅ CORRECT - Use these
ZITADEL_DATABASE_POSTGRES_USER_PASSWORD=<from secret>
ZITADEL_DATABASE_POSTGRES_ADMIN_PASSWORD=<from secret>

# ❌ WRONG - Don't use this
ZITADEL_DATABASE_POSTGRES_PASSWORD  # Missing "USER_"
```

### Masterkey Format
```bash
# ✅ CORRECT - 32 alphanumeric characters
--masterkey 2qdgHOCmyXmynPwcmk9jMZnn1fxzNvx9

# ❌ WRONG - Base64 encoded (44 chars)
--masterkey nDHYk1lJyhYfh8nL6vy45TSJgYurahs2F6ZIYnmnovk=
```

### Command Path
```bash
# ✅ CORRECT - Full path
--command=/app/zitadel

# ❌ WRONG - Relative path
--command=zitadel
```

---

## 📋 Quick Commands

### Check Service Status
```bash
gcloud run services describe zitadel \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025 \
  --format="value(status.conditions[0].status,status.url)"
```

### View Logs
```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=zitadel" \
  --limit=50 \
  --project=ekklesia-prod-10-2025 \
  --format="value(textPayload)"
```

### Test Endpoint
```bash
curl -I https://zitadel-521240388393.europe-west2.run.app
```

### Update Service
```bash
gcloud run services update zitadel \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025 \
  --update-env-vars="KEY=VALUE"
```

---

## 🗄️ Database Operations

### List Users
```bash
gcloud sql users list \
  --instance=zitadel-db \
  --project=ekklesia-prod-10-2025
```

### List Databases
```bash
gcloud sql databases list \
  --instance=zitadel-db \
  --project=ekklesia-prod-10-2025
```

### Update User Password
```bash
# Get password from secret
ZITADEL_PWD=$(gcloud secrets versions access latest \
  --secret=zitadel-db-password \
  --project=ekklesia-prod-10-2025)

# Update user
gcloud sql users set-password zitadel \
  --instance=zitadel-db \
  --password="$ZITADEL_PWD" \
  --project=ekklesia-prod-10-2025
```

---

## 🔐 Secrets Management

### View Secret
```bash
gcloud secrets versions access latest \
  --secret=zitadel-db-password \
  --project=ekklesia-prod-10-2025
```

### Create/Update Secret
```bash
echo "your-password-here" | gcloud secrets create my-secret \
  --data-file=- \
  --project=ekklesia-prod-10-2025

# Or update existing
echo "new-password" | gcloud secrets versions add my-secret \
  --data-file=- \
  --project=ekklesia-prod-10-2025
```

### List Secrets
```bash
gcloud secrets list --project=ekklesia-prod-10-2025
```

---

## 🚨 Common Issues & Fixes

### Issue: "password authentication failed"
**Cause:** Database user password doesn't match secret  
**Fix:**
```bash
# Sync database password with secret
ZITADEL_PWD=$(gcloud secrets versions access latest --secret=zitadel-db-password --project=ekklesia-prod-10-2025)
gcloud sql users set-password zitadel --instance=zitadel-db --password="$ZITADEL_PWD" --project=ekklesia-prod-10-2025
```

### Issue: "masterkey must be 32 bytes, but is 44"
**Cause:** Masterkey is base64-encoded instead of raw  
**Fix:**
```bash
# Generate new 32-char masterkey
MASTERKEY=$(tr -dc A-Za-z0-9 </dev/urandom | head -c 32)
echo $MASTERKEY  # Use this in deployment
```

### Issue: "failed to resolve binary path"
**Cause:** Using `zitadel` instead of `/app/zitadel`  
**Fix:**
```bash
# Always use full path
--command=/app/zitadel
```

### Issue: Cloud SQL connection refused
**Cause:** Missing IAM permission  
**Fix:**
```bash
gcloud projects add-iam-policy-binding ekklesia-prod-10-2025 \
  --member="serviceAccount:521240388393-compute@developer.gserviceaccount.com" \
  --role="roles/cloudsql.client"
```

---

## 📦 Full Deployment Command

```bash
gcloud run deploy zitadel \
  --image=gcr.io/ekklesia-prod-10-2025/zitadel:latest \
  --region=europe-west2 \
  --platform=managed \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --timeout=300 \
  --command=/app/zitadel \
  --args=start-from-init,--masterkey,YOUR_32_CHAR_KEY,--tlsMode,disabled \
  --set-cloudsql-instances=ekklesia-prod-10-2025:europe-west2:zitadel-db \
  --set-secrets=ZITADEL_DATABASE_POSTGRES_USER_PASSWORD=zitadel-db-password:latest,ZITADEL_DATABASE_POSTGRES_ADMIN_PASSWORD=zitadel-postgres-admin-password:latest \
  --set-env-vars="ZITADEL_DATABASE_POSTGRES_HOST=/cloudsql/ekklesia-prod-10-2025:europe-west2:zitadel-db,ZITADEL_DATABASE_POSTGRES_PORT=5432,ZITADEL_DATABASE_POSTGRES_DATABASE=zitadel,ZITADEL_DATABASE_POSTGRES_USER_USERNAME=zitadel,ZITADEL_DATABASE_POSTGRES_USER_SSL_MODE=disable,ZITADEL_DATABASE_POSTGRES_ADMIN_USERNAME=postgres,ZITADEL_DATABASE_POSTGRES_ADMIN_SSL_MODE=disable,ZITADEL_EXTERNALSECURE=true,ZITADEL_TLS_ENABLED=false,ZITADEL_FIRSTINSTANCE_ORG_NAME=Ekklesia" \
  --allow-unauthenticated \
  --project=ekklesia-prod-10-2025
```

---

## 🎯 Next Steps Checklist

- [ ] Configure custom domain (auth.ekklesia.is)
- [ ] Update ZITADEL_EXTERNALDOMAIN environment variable
- [ ] Create first admin user via console
- [ ] Configure OAuth application for Ekklesia
- [ ] Set up SMTP for email delivery
- [ ] Configure monitoring and alerts
- [ ] Test OAuth flow end-to-end
- [ ] Document client credentials
- [ ] Set up backup verification
- [ ] Review security settings

---

## 🔗 Quick Links

**GCP Console:**
- [Cloud Run Service](https://console.cloud.google.com/run/detail/europe-west2/zitadel?project=ekklesia-prod-10-2025)
- [Cloud SQL Instance](https://console.cloud.google.com/sql/instances/zitadel-db/overview?project=ekklesia-prod-10-2025)
- [Logs](https://console.cloud.google.com/logs/query?project=ekklesia-prod-10-2025)
- [Secrets](https://console.cloud.google.com/security/secret-manager?project=ekklesia-prod-10-2025)

**Documentation:**
- ZITADEL_DEPLOYMENT_SUCCESS.md - Full deployment report
- [ZITADEL Docs](https://zitadel.com/docs)
- [Cloud Run Docs](https://cloud.google.com/run/docs)

---

**Maintained by:** Guðröður  
**Last verified:** 2025-10-02
