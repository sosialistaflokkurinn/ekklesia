# 🔄 Load Balancer + Custom Domain Setup

**Date:** 2025-10-02
**Status:** ✅ Configured and operational (SSL provisioning in progress)
**Custom Domain:** auth.si-xj.org
**Load Balancer IP:** 34.8.250.20

---

## 📋 Overview

This document describes the complete setup of a Google Cloud Load Balancer to enable custom domain access for ZITADEL with automatic SSL certificate provisioning.

### Why Load Balancer?

Cloud Run services come with a default `*.run.app` domain and SSL certificate. To use a custom domain like `auth.si-xj.org`, you need:

1. **Load Balancer** - Routes traffic from your custom domain to Cloud Run
2. **Serverless NEG** - Connects Load Balancer to Cloud Run service
3. **Google-Managed SSL Certificate** - Automatic HTTPS for your domain
4. **Global IP Address** - Static IP for DNS configuration

---

## 🏗️ Architecture

```
Internet
   ↓
DNS: auth.si-xj.org → 34.8.250.20
   ↓
Global Load Balancer (HTTPS:443)
   ↓
SSL Certificate (Google-managed)
   ↓
Backend Service
   ↓
Serverless NEG (europe-west2)
   ↓
Cloud Run: zitadel
   ↓
Cloud SQL: zitadel-db
```

---

## 🚀 Setup Steps

### Step 1: Create Global IP Address

```bash
gcloud compute addresses create zitadel-ip \
  --global \
  --project=ekklesia-prod-10-2025
```

**Result:** IP `34.8.250.20` allocated

**Purpose:** Static IP address for DNS A record

---

### Step 2: Create Serverless Network Endpoint Group (NEG)

```bash
gcloud compute network-endpoint-groups create zitadel-neg \
  --region=europe-west2 \
  --network-endpoint-type=serverless \
  --cloud-run-service=zitadel \
  --project=ekklesia-prod-10-2025
```

**Purpose:** Connects Load Balancer to Cloud Run service

---

### Step 3: Create Backend Service

```bash
gcloud compute backend-services create zitadel-backend \
  --global \
  --load-balancing-scheme=EXTERNAL_MANAGED \
  --project=ekklesia-prod-10-2025
```

**Purpose:** Manages traffic distribution to backends

---

### Step 4: Add NEG to Backend Service

```bash
gcloud compute backend-services add-backend zitadel-backend \
  --global \
  --network-endpoint-group=zitadel-neg \
  --network-endpoint-group-region=europe-west2 \
  --project=ekklesia-prod-10-2025
```

**Purpose:** Links backend service to Cloud Run

---

### Step 5: Create Google-Managed SSL Certificate

```bash
gcloud compute ssl-certificates create zitadel-cert \
  --domains=auth.si-xj.org \
  --global \
  --project=ekklesia-prod-10-2025
```

**Status:** PROVISIONING (takes 15-60 minutes)

**Purpose:** Automatic SSL/TLS certificate for HTTPS

**Note:** Certificate will only provision after DNS is correctly configured

---

### Step 6: Create URL Map

```bash
gcloud compute url-maps create zitadel-lb \
  --default-service=zitadel-backend \
  --global \
  --project=ekklesia-prod-10-2025
```

**Purpose:** Routes incoming requests to backend service

---

### Step 7: Create HTTPS Proxy

```bash
gcloud compute target-https-proxies create zitadel-https-proxy \
  --url-map=zitadel-lb \
  --ssl-certificates=zitadel-cert \
  --global \
  --project=ekklesia-prod-10-2025
```

**Purpose:** Terminates SSL and forwards to backend

---

### Step 8: Create Forwarding Rule

```bash
gcloud compute forwarding-rules create zitadel-https-rule \
  --global \
  --target-https-proxy=zitadel-https-proxy \
  --address=zitadel-ip \
  --ports=443 \
  --project=ekklesia-prod-10-2025
```

**Purpose:** Directs traffic from IP to HTTPS proxy

---

## 🌐 DNS Configuration

### Cloudflare DNS Setup

**Domain:** si-xj.org (registered with Cloudflare)

**Record:**
```
Type: A
Name: auth
IPv4 Address: 34.8.250.20
Proxy Status: DNS only (gray cloud)
TTL: Auto
```

**Important:** Cloudflare proxy MUST be disabled (DNS only) for Google-managed SSL to work

---

## 📊 Resource Summary

| Resource Type | Name | Region/Scope | Purpose |
|--------------|------|--------------|---------|
| IP Address | zitadel-ip | Global | Static IP (34.8.250.20) |
| NEG | zitadel-neg | europe-west2 | Cloud Run endpoint |
| Backend Service | zitadel-backend | Global | Traffic distribution |
| SSL Certificate | zitadel-cert | Global | HTTPS for auth.si-xj.org |
| URL Map | zitadel-lb | Global | Request routing |
| HTTPS Proxy | zitadel-https-proxy | Global | SSL termination |
| Forwarding Rule | zitadel-https-rule | Global | Traffic forwarding |

---

## 🔍 Verification Commands

### Check SSL Certificate Status

```bash
gcloud compute ssl-certificates describe zitadel-cert \
  --global \
  --project=ekklesia-prod-10-2025 \
  --format="value(managed.status)"
```

**Expected:** PROVISIONING → ACTIVE (takes 15-60 minutes)

---

### Check Load Balancer Status

```bash
gcloud compute forwarding-rules describe zitadel-https-rule \
  --global \
  --project=ekklesia-prod-10-2025
```

---

### Check Backend Health

```bash
gcloud compute backend-services get-health zitadel-backend \
  --global \
  --project=ekklesia-prod-10-2025
```

---

### Test DNS Resolution

```bash
dig +short auth.si-xj.org
```

**Expected:**
```
34.8.250.20
```

---

### Test HTTPS Connection (after SSL provisions)

```bash
curl -I https://auth.si-xj.org
```

**Expected:** HTTP 200 or 302 (ZITADEL redirect)

---

## ⏰ SSL Certificate Provisioning Timeline

| Time | Status | Action |
|------|--------|--------|
| 0 min | PROVISIONING | DNS configured, certificate requested |
| 5-10 min | PROVISIONING | Google verifying DNS ownership |
| 15-30 min | PROVISIONING | Certificate being issued |
| 30-60 min | ACTIVE | ✅ Certificate ready, HTTPS working |

**Current Status:** Check with:
```bash
gcloud compute ssl-certificates list --project=ekklesia-prod-10-2025
```

---

## 🐛 Common Issues

### Issue 1: Certificate Stuck in PROVISIONING

**Symptoms:**
- Certificate status shows PROVISIONING for > 2 hours
- Domain shows FAILED_NOT_VISIBLE

**Causes:**
1. DNS not pointing to correct IP
2. Cloudflare proxy enabled (orange cloud)
3. DNS not fully propagated

**Solution:**
```bash
# Verify DNS
dig +short auth.si-xj.org

# Should show: 34.8.250.20

# Check certificate status
gcloud compute ssl-certificates describe zitadel-cert \
  --global \
  --project=ekklesia-prod-10-2025
```

**Fix:** Ensure Cloudflare proxy is DISABLED (gray cloud, DNS only)

---

### Issue 2: 502 Bad Gateway

**Symptoms:**
- DNS resolves correctly
- SSL certificate is ACTIVE
- Getting 502 error

**Cause:** Backend service can't reach Cloud Run

**Solution:**
```bash
# Check backend health
gcloud compute backend-services get-health zitadel-backend \
  --global \
  --project=ekklesia-prod-10-2025

# Verify NEG exists
gcloud compute network-endpoint-groups describe zitadel-neg \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025
```

---

### Issue 3: 404 Not Found

**Symptoms:**
- Load balancer responds
- Getting 404 error

**Cause:** URL map not configured correctly

**Solution:**
```bash
# Check URL map
gcloud compute url-maps describe zitadel-lb \
  --global \
  --project=ekklesia-prod-10-2025
```

---

## 💰 Cost Estimate

| Resource | Monthly Cost (Estimated) |
|----------|-------------------------|
| Load Balancer | ~$18/month (basic forwarding rules) |
| Global IP Address | ~$7/month (in use) |
| SSL Certificate | Free (Google-managed) |
| Bandwidth | ~$0.08/GB (outbound) |
| **Total (excluding bandwidth)** | **~$25/month** |

**Note:** Costs may vary based on traffic volume

---

## 🔐 Security Considerations

### SSL/TLS
- ✅ Google-managed certificate (automatic renewal)
- ✅ TLS 1.2+ only
- ✅ Strong cipher suites

### Network
- ✅ Global HTTPS load balancing
- ✅ DDoS protection (Cloud Armor available)
- ✅ Cloud Run requires authentication

### DNS
- ⚠️ Cloudflare proxy disabled (no WAF/DDoS from Cloudflare)
- ✅ DNSSEC available (enable in Cloudflare)

---

## 📈 Monitoring

### Load Balancer Metrics

**Console:** https://console.cloud.google.com/net-services/loadbalancing/list/loadBalancers?project=ekklesia-prod-10-2025

**Key Metrics:**
- Request count
- Error rate (5xx, 4xx)
- Latency (p50, p95, p99)
- Backend health

### Logging

```bash
# View load balancer logs
gcloud logging read "resource.type=http_load_balancer" \
  --project=ekklesia-prod-10-2025 \
  --limit=50
```

---

## 🔄 Updating Configuration

### Add Additional Domains

```bash
# Create new certificate
gcloud compute ssl-certificates create zitadel-cert-2 \
  --domains=auth2.si-xj.org \
  --global \
  --project=ekklesia-prod-10-2025

# Update HTTPS proxy to use both certificates
gcloud compute target-https-proxies update zitadel-https-proxy \
  --ssl-certificates=zitadel-cert,zitadel-cert-2 \
  --global \
  --project=ekklesia-prod-10-2025
```

---

### Update Backend Service

```bash
# Update backend service settings
gcloud compute backend-services update zitadel-backend \
  --global \
  --timeout=30s \
  --project=ekklesia-prod-10-2025
```

---

## 🗑️ Cleanup Commands

**⚠️ WARNING:** These commands will delete the load balancer and make the custom domain inaccessible

```bash
# Delete in reverse order of creation

# 1. Delete forwarding rule
gcloud compute forwarding-rules delete zitadel-https-rule \
  --global \
  --project=ekklesia-prod-10-2025

# 2. Delete HTTPS proxy
gcloud compute target-https-proxies delete zitadel-https-proxy \
  --global \
  --project=ekklesia-prod-10-2025

# 3. Delete URL map
gcloud compute url-maps delete zitadel-lb \
  --global \
  --project=ekklesia-prod-10-2025

# 4. Delete SSL certificate
gcloud compute ssl-certificates delete zitadel-cert \
  --global \
  --project=ekklesia-prod-10-2025

# 5. Delete backend service
gcloud compute backend-services delete zitadel-backend \
  --global \
  --project=ekklesia-prod-10-2025

# 6. Delete NEG
gcloud compute network-endpoint-groups delete zitadel-neg \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025

# 7. Delete IP address
gcloud compute addresses delete zitadel-ip \
  --global \
  --project=ekklesia-prod-10-2025
```

---

## 📚 Related Documentation

- **ZITADEL_DEPLOYMENT_SUCCESS.md** - ZITADEL deployment details
- **ZITADEL_QUICK_REFERENCE.md** - ZITADEL commands
- **DOCUMENTATION_INDEX.md** - All documentation

---

## 🎯 Next Steps

1. ⏳ **Wait for SSL provisioning** (15-60 minutes)
2. ✅ **Verify HTTPS access** at https://auth.si-xj.org
3. 📝 **Configure ZITADEL** external domain settings
4. 🔐 **Set up first admin user** in ZITADEL
5. 🔄 **Configure OIDC applications** for Ekklesia

---

## 📊 Status Checklist

- [x] Global IP created (34.8.250.20)
- [x] Serverless NEG created
- [x] Backend service configured
- [x] SSL certificate requested
- [x] Load balancer configured
- [x] DNS A record added (Cloudflare)
- [x] ZITADEL external domain updated
- [ ] SSL certificate active (⏳ provisioning)
- [ ] HTTPS access verified
- [ ] ZITADEL admin configured

---

**Setup completed:** 2025-10-02
**DNS corrected:** 2025-10-03 (Changed from CNAME to A record)
**SSL Status:** Provisioning (check in 30-60 minutes)
**Access URL:** https://auth.si-xj.org (available after SSL provisions)

---

## 🔄 Update 2025-10-03: DNS Configuration Fixed

**Issue Found:** DNS was initially configured with CNAME record instead of A record
- ❌ **Wrong:** CNAME → zitadel-ymzrguoifa-nw.a.run.app
- ✅ **Correct:** A record → 34.8.250.20

**What was done:**
1. ✅ Saved Cloudflare API token to Secret Manager (`cloudflare-api-token`)
2. ✅ Deleted incorrect CNAME record
3. ✅ Created correct A record pointing to Load Balancer IP
4. ✅ Verified DNS resolution: `dig +short auth.si-xj.org` returns `34.8.250.20`
5. ⏳ SSL certificate now provisioning correctly (was FAILED_NOT_VISIBLE, now PROVISIONING)

**Commands used:**
```bash
# Authenticate and save token
gcloud auth login
echo -n "TOKEN" | gcloud secrets create cloudflare-api-token --data-file=-

# Fix DNS using cloudflare-dns.sh
export CF_API_TOKEN="$(gcloud secrets versions access latest --secret=cloudflare-api-token)"
./cloudflare-dns.sh delete <old-cname-record-id>
./cloudflare-dns.sh create-a auth 34.8.250.20 false

# Verify
dig +short auth.si-xj.org  # Should return: 34.8.250.20
gcloud compute ssl-certificates describe zitadel-cert --global --format="value(managed.status)"
```
