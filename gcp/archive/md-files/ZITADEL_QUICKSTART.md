# 🚀 ZITADEL Self-Hosting Quick Start

**Goal:** Deploy self-hosted ZITADEL á GCP í stað cloud ZITADEL  
**Time:** ~3-4 hours fyrir basic setup  
**Cost:** ~$10-15/month

---

## ✅ Phase 0: OIDC Bridge (DONE!)

- ✅ OIDC Bridge Proxy deployed
- ✅ Public access enabled
- ✅ All endpoints virka
- ✅ Ready fyrir ZITADEL integration

---

## 📋 Phase 1: Database Setup (30 min)

### Step 1: Create Cloud SQL PostgreSQL
```bash
cd /home/gudro/dev/projects/ekklesia/gcp

# Create instance
gcloud sql instances create zitadel-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=europe-west2 \
  --storage-type=SSD \
  --storage-size=10GB \
  --storage-auto-increase \
  --backup-start-time=03:00 \
  --enable-bin-log \
  --retained-backups-count=7 \
  --project=ekklesia-prod-10-2025
```

### Step 2: Create Database & User
```bash
# Create database
gcloud sql databases create zitadel \
  --instance=zitadel-db \
  --project=ekklesia-prod-10-2025

# Generate secure password
DB_PASSWORD=$(openssl rand -base64 32)

# Create user
gcloud sql users create zitadel \
  --instance=zitadel-db \
  --password="$DB_PASSWORD" \
  --project=ekklesia-prod-10-2025

# Save password to Secret Manager
echo -n "$DB_PASSWORD" | \
  gcloud secrets create zitadel-db-password \
    --data-file=- \
    --replication-policy=automatic \
    --project=ekklesia-prod-10-2025

echo "✅ Database password saved to Secret Manager"
```

### Step 3: Test Connection (Optional)
```bash
# Get connection name
INSTANCE_CONNECTION_NAME=$(gcloud sql instances describe zitadel-db \
  --project=ekklesia-prod-10-2025 \
  --format='value(connectionName)')

echo "Connection name: $INSTANCE_CONNECTION_NAME"
```

---

## 📋 Phase 2: Deploy ZITADEL (1 hour)

### Step 1: Deploy to Cloud Run
```bash
# Deploy ZITADEL
gcloud run deploy zitadel \
  --image=ghcr.io/zitadel/zitadel:latest \
  --region=europe-west2 \
  --platform=managed \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --timeout=300 \
  --set-cloudsql-instances=ekklesia-prod-10-2025:europe-west2:zitadel-db \
  --set-secrets=ZITADEL_DATABASE_POSTGRES_PASSWORD=zitadel-db-password:latest \
  --set-env-vars="\
ZITADEL_DATABASE_POSTGRES_HOST=/cloudsql/ekklesia-prod-10-2025:europe-west2:zitadel-db,\
ZITADEL_DATABASE_POSTGRES_PORT=5432,\
ZITADEL_DATABASE_POSTGRES_DATABASE=zitadel,\
ZITADEL_DATABASE_POSTGRES_USER_USERNAME=zitadel,\
ZITADEL_DATABASE_POSTGRES_USER_SSL_MODE=disable,\
ZITADEL_EXTERNALSECURE=true,\
ZITADEL_TLS_ENABLED=false,\
ZITADEL_MASTERKEY=CHANGE_THIS_TO_SECURE_KEY,\
ZITADEL_FIRSTINSTANCE_ORG_NAME=Ekklesia" \
  --allow-unauthenticated \
  --project=ekklesia-prod-10-2025
```

### Step 2: Get ZITADEL URL
```bash
ZITADEL_URL=$(gcloud run services describe zitadel \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025 \
  --format='value(status.url)')

echo ""
echo "✅ ZITADEL deployed!"
echo "🔗 URL: $ZITADEL_URL"
echo "👤 Login: Open $ZITADEL_URL in browser"
```

### Step 3: Initial Setup
1. Open ZITADEL URL í browser
2. Follow setup wizard
3. Create admin user
4. Note down credentials

---

## 📋 Phase 3: Configure Kenni.is (1 hour)

### Step 1: Add External IDP í ZITADEL

1. Login til ZITADEL admin console
2. Go to: **Settings → Identity Providers**
3. Click **"Add Provider"**
4. Select **"Generic OIDC"**

### Step 2: Configure Provider

**Provider Settings:**
```
Name: Kenni.is
Issuer: https://oidc-bridge-proxy-ymzrguoifa-nw.a.run.app
Discovery Endpoint: https://oidc-bridge-proxy-ymzrguoifa-nw.a.run.app/.well-known/openid-configuration
```

**Client Credentials:**
```bash
# Get from Secret Manager
gcloud secrets versions access latest \
  --secret=kenni-client-id \
  --project=ekklesia-prod-10-2025

gcloud secrets versions access latest \
  --secret=kenni-client-secret \
  --project=ekklesia-prod-10-2025
```

**Scopes:**
```
openid
profile
email
national_id
phone_number
```

**Claims Mapping:**
- `sub` → `national_id`
- `email` → `email`
- `name` → `name`
- `phone_number` → `phone`

### Step 3: Test Authentication
1. Create test project í ZITADEL
2. Add Kenni.is sem login option
3. Test login flow
4. Verify claims eru mappað rétt

---

## 📋 Phase 4: Update Ekklesia App (30 min)

### Step 1: Update Configuration

**Old (Cloud ZITADEL):**
```
Authority: https://sosi-auth-nocfrq.us1.zitadel.cloud
```

**New (Self-hosted):**
```
Authority: https://YOUR-ZITADEL-URL (from Cloud Run)
```

### Step 2: Test End-to-End
1. Open ekklesia app
2. Click "Login with Kenni.is"
3. Should redirect through ZITADEL → OIDC Bridge → Kenni.is
4. Complete login
5. Verify redirect back með token

### Step 3: Monitor
```bash
# ZITADEL logs
gcloud run services logs tail zitadel --region=europe-west2

# OIDC Bridge logs
gcloud run services logs tail oidc-bridge-proxy --region=europe-west2
```

---

## 🎯 Verification Checklist

- [ ] Cloud SQL instance running
- [ ] Database created og accessible
- [ ] ZITADEL deployed to Cloud Run
- [ ] Admin console accessible
- [ ] Kenni.is IDP configured
- [ ] Test user can login
- [ ] Ekklesia app updated
- [ ] End-to-end authentication virkar
- [ ] Logs show successful flows
- [ ] No errors í monitoring

---

## 📊 Expected Results

### Health Checks
```bash
# ZITADEL health
curl https://YOUR-ZITADEL-URL/debug/healthz

# OIDC Bridge health (already working!)
curl https://oidc-bridge-proxy-ymzrguoifa-nw.a.run.app/health
```

### Performance
- ZITADEL response: <300ms
- OIDC Bridge response: <100ms
- Total login flow: <2 seconds

### Cost
- Cloud SQL: ~$7-10/month
- ZITADEL Cloud Run: ~$2-5/month
- OIDC Bridge: <$1/month
- **Total: ~$10-15/month**

---

## 🆘 Quick Troubleshooting

### ZITADEL Won't Start
```bash
# Check logs
gcloud run services logs read zitadel --region=europe-west2 --limit=100

# Common issues:
# - Database connection failed → Check Cloud SQL instance
# - Masterkey error → Set ZITADEL_MASTERKEY properly
# - Migration error → Check database permissions
```

### Can't Connect to Database
```bash
# Verify Cloud SQL instance
gcloud sql instances describe zitadel-db --project=ekklesia-prod-10-2025

# Check if running
gcloud sql instances list --project=ekklesia-prod-10-2025

# Test connection via Cloud SQL proxy
# (if needed for debugging)
```

### Kenni.is Auth Fails
```bash
# Test OIDC Bridge directly
curl https://oidc-bridge-proxy-ymzrguoifa-nw.a.run.app/.well-known/openid-configuration

# Check ZITADEL IDP config
# - Verify issuer URL
# - Check client_id og client_secret
# - Verify scopes
```

---

## 📚 Next Steps After Basic Setup

### Production Hardening
1. Set up custom domain (auth.ekklesia.is)
2. Configure SSL certificate
3. Set up monitoring alerts
4. Configure backup retention
5. Security audit
6. Load testing
7. Disaster recovery plan

### Documentation
1. Admin runbook
2. User guide
3. Troubleshooting guide
4. Architecture diagram
5. Security documentation

---

## 💡 Tips

**Database:**
- Start með db-f1-micro (shared CPU)
- Upgrade til dedicated ef performance issues
- Monitor disk usage og auto-increase enabled

**ZITADEL:**
- Use latest stable image
- Set appropriate memory (1GB recommended)
- Min instances=0 fyrir cost savings
- Max instances=3 fyrir reliability

**Monitoring:**
- Set up Cloud Monitoring dashboards
- Alert on high error rates
- Monitor database connections
- Track response times

---

## 🎉 Ready to Start?

**Suggested Order:**
1. ✅ Read full plan: `ZITADEL_SELFHOSTING_PLAN.md`
2. ⏰ Create database (30 min)
3. ⏰ Deploy ZITADEL (1 hour)
4. ⏰ Configure Kenni.is (1 hour)
5. ⏰ Test authentication (30 min)
6. ⏰ Production hardening (later)

**Viltu byrja núna?** 🚀

---

**Status:**
- ✅ OIDC Bridge ready
- ⏰ Database: Not started
- ⏰ ZITADEL: Not started
- ⏰ Configuration: Not started
- ⏰ Testing: Not started
