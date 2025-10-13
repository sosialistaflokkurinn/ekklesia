# Cloudflare DNS Fix Plan

**Date Created**: 2025-10-13
**Status**: 📋 Planning
**Priority**: Medium (system functional with temporary workaround)
**Estimated Time**: 30-45 minutes
**Prerequisites**: Cloudflare dashboard access OR API token with DNS permissions

---

## Problem Summary

The Cloudflare DNS records are pointing to incorrect Cloud Run URLs, causing 404 errors when accessing services via custom domains (auth.si-xj.org, api.si-xj.org, etc.).

### Root Cause

The `cloudflare-setup.sh` script assumed Cloud Run URLs follow this pattern:
```
{service}-{project-number}.{region}.run.app
```

But Cloud Functions Gen2 actually use random suffixes:
```
{service}-{random-suffix}.{region}.a.run.app
```

**Example**:
- **Expected**: `handlekenniauth-521240388393.europe-west2.run.app`
- **Actual**: `handlekenniauth-ymzrguoifa-nw.a.run.app`

### Current Workaround (Temporary)

- Using direct Cloud Run URLs in `strings.xml` instead of Cloudflare domains
- Added origin protection bypass for Firebase Hosting in all middleware
- System is operational but bypassing Cloudflare security features

### Impact of Not Fixing

**Medium Priority** because:
- ✅ System is functional with direct URLs
- ⚠️ Missing Cloudflare benefits:
  - Rate limiting not applied (relies on direct URL origin protection)
  - CDN caching not utilized
  - DDoS protection bypassed
  - Analytics not tracked
  - SSL certificate management not leveraged

---

## Plan Overview

### Phase 1: Verify Access & Gather Information (5 minutes)
- Confirm Cloudflare dashboard access or API token permissions
- Document current DNS record state
- Verify actual Cloud Run URLs

### Phase 2: Update DNS Records (10 minutes)
- Update 4 CNAME records to point to correct Cloud Run URLs
- Verify DNS propagation

### Phase 3: Update Application Code (10 minutes)
- Update `strings.xml` to use Cloudflare domains
- Remove temporary origin protection bypasses
- Deploy updated code

### Phase 4: Testing & Verification (10 minutes)
- Test login flow via Cloudflare domains
- Verify CORS headers
- Verify origin protection working
- Test rate limiting

### Phase 5: Update Scripts & Documentation (5 minutes)
- Fix `cloudflare-setup.sh` to detect actual URLs
- Update documentation
- Remove temporary workaround notes

---

## Phase 1: Verify Access & Gather Information

### 1.1 Check Cloudflare Access

**Option A: Dashboard Access (Preferred)**
```bash
# Navigate to Cloudflare Dashboard
# URL: https://dash.cloudflare.com/
# Account: Check with team for login credentials
# Zone: si-xj.org (Zone ID: 4cab51095e756bd898cc3debec754828)
```

**Option B: API Token Permissions**
```bash
# Test current API token permissions
CF_TOKEN="gD0MXa-Y6K3n8pDDxbkyJnJuy-YIGl2KTOyD3Rn7"
curl -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json"

# If successful, check permissions:
# Required: Zone.DNS (edit)
# Current token has: Zone.SSL, Zone.WAF (but NOT Zone.DNS)
```

**Action Required**:
- If dashboard access: ✅ Proceed
- If API token: Create new token with Zone.DNS permission at https://dash.cloudflare.com/profile/api-tokens

### 1.2 Document Current DNS State

```bash
# Get actual Cloud Run URLs
gcloud functions describe handleKenniAuth \
  --region=europe-west2 --gen2 --project=ekklesia-prod-10-2025 \
  --format="value(serviceConfig.uri)"

gcloud functions describe verifyMembership \
  --region=europe-west2 --gen2 --project=ekklesia-prod-10-2025 \
  --format="value(serviceConfig.uri)"

gcloud run services describe events-service \
  --region=europe-west2 --project=ekklesia-prod-10-2025 \
  --format="value(status.url)"

gcloud run services describe elections-service \
  --region=europe-west2 --project=ekklesia-prod-10-2025 \
  --format="value(status.url)"
```

**Expected Output**:
```
https://handlekenniauth-ymzrguoifa-nw.a.run.app
https://verifymembership-ymzrguoifa-nw.a.run.app
https://events-service-ymzrguoifa-nw.a.run.app
https://elections-service-ymzrguoifa-nw.a.run.app
```

**Save these URLs** - you'll need them for DNS updates.

### 1.3 Check Current DNS Records (Optional)

```bash
# Check what DNS is currently resolving to
dig auth.si-xj.org +short
dig api.si-xj.org +short
dig vote.si-xj.org +short
dig verify.si-xj.org +short
```

These will show Cloudflare IPs (proxied), not the actual CNAME targets.

---

## Phase 2: Update DNS Records

### Method A: Via Cloudflare Dashboard (Recommended)

1. **Login to Cloudflare Dashboard**
   - URL: https://dash.cloudflare.com/
   - Select zone: `si-xj.org`

2. **Navigate to DNS Records**
   - Click "DNS" in the left sidebar
   - Filter by: CNAME records

3. **Update Each Record**

   For each of the 4 records, click "Edit" and update the "Target" field:

   | Name | Type | Target (Update to) | Proxy Status | TTL |
   |------|------|-------------------|--------------|-----|
   | auth | CNAME | `handlekenniauth-ymzrguoifa-nw.a.run.app` | ✅ Proxied (orange cloud) | Auto |
   | api | CNAME | `events-service-ymzrguoifa-nw.a.run.app` | ✅ Proxied (orange cloud) | Auto |
   | vote | CNAME | `elections-service-ymzrguoifa-nw.a.run.app` | ✅ Proxied (orange cloud) | Auto |
   | verify | CNAME | `verifymembership-ymzrguoifa-nw.a.run.app` | ✅ Proxied (orange cloud) | Auto |

4. **Save Each Record**
   - Click "Save" after each update
   - Verify the green checkmark appears

### Method B: Via API (If You Have Permissions)

```bash
# Set variables
CF_TOKEN="YOUR_NEW_TOKEN_WITH_DNS_PERMISSIONS"
CF_ZONE="4cab51095e756bd898cc3debec754828"
GCP_PROJECT="ekklesia-prod-10-2025"
GCP_REGION="europe-west2"

# Get Cloud Run URLs
AUTH_URL=$(gcloud functions describe handleKenniAuth --region=$GCP_REGION --gen2 \
  --project=$GCP_PROJECT --format="value(serviceConfig.uri)" | sed 's|https://||')

VERIFY_URL=$(gcloud functions describe verifyMembership --region=$GCP_REGION --gen2 \
  --project=$GCP_PROJECT --format="value(serviceConfig.uri)" | sed 's|https://||')

API_URL=$(gcloud run services describe events-service --region=$GCP_REGION \
  --project=$GCP_PROJECT --format="value(status.url)" | sed 's|https://||')

VOTE_URL=$(gcloud run services describe elections-service --region=$GCP_REGION \
  --project=$GCP_PROJECT --format="value(status.url)" | sed 's|https://||')

echo "URLs to update:"
echo "  auth.si-xj.org → $AUTH_URL"
echo "  verify.si-xj.org → $VERIFY_URL"
echo "  api.si-xj.org → $API_URL"
echo "  vote.si-xj.org → $VOTE_URL"

# Get existing record IDs
AUTH_RECORD_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records?name=auth.si-xj.org" \
  -H "Authorization: Bearer $CF_TOKEN" | jq -r '.result[0].id')

VERIFY_RECORD_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records?name=verify.si-xj.org" \
  -H "Authorization: Bearer $CF_TOKEN" | jq -r '.result[0].id')

API_RECORD_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records?name=api.si-xj.org" \
  -H "Authorization: Bearer $CF_TOKEN" | jq -r '.result[0].id')

VOTE_RECORD_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records?name=vote.si-xj.org" \
  -H "Authorization: Bearer $CF_TOKEN" | jq -r '.result[0].id')

# Update records
curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records/$AUTH_RECORD_ID" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"type":"CNAME","name":"auth","content":"'$AUTH_URL'","ttl":1,"proxied":true}'

curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records/$VERIFY_RECORD_ID" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"type":"CNAME","name":"verify","content":"'$VERIFY_URL'","ttl":1,"proxied":true}'

curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records/$API_RECORD_ID" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"type":"CNAME","name":"api","content":"'$API_URL'","ttl":1,"proxied":true}'

curl -X PATCH "https://api.cloudflare.com/client/v4/zones/$CF_ZONE/dns_records/$VOTE_RECORD_ID" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"type":"CNAME","name":"vote","content":"'$VOTE_URL'","ttl":1,"proxied":true}'
```

### 2.3 Verify DNS Propagation

```bash
# Wait 1-2 minutes for Cloudflare to update
sleep 120

# Test each domain
curl -I https://auth.si-xj.org/ -H 'Origin: https://ekklesia-prod-10-2025.web.app' -X OPTIONS
curl -I https://api.si-xj.org/health
curl -I https://vote.si-xj.org/health
curl -I https://verify.si-xj.org/health
```

**Expected**: All should return 204 or 200 (not 404)

---

## Phase 3: Update Application Code

### 3.1 Update strings.xml to Use Cloudflare Domains

```bash
cd /home/gudro/Development/projects/ekklesia
```

Edit `members/public/i18n/values-is/strings.xml`:

```xml
<!-- Before (temporary direct URLs) -->
<string name="config_api_handle_auth">https://handlekenniauth-ymzrguoifa-nw.a.run.app</string>
<string name="config_api_events">https://events-service-ymzrguoifa-nw.a.run.app</string>
<string name="config_api_elections">https://elections-service-ymzrguoifa-nw.a.run.app</string>

<!-- After (Cloudflare domains) -->
<string name="config_api_handle_auth">https://auth.si-xj.org</string>
<string name="config_api_events">https://api.si-xj.org</string>
<string name="config_api_elections">https://vote.si-xj.org</string>
```

### 3.2 Remove Temporary Origin Protection Bypasses

**File 1**: `members/functions/cloudflare_check.py`

Remove lines 125-130:
```python
# TEMPORARY: Allow direct access until Cloudflare DNS is fixed
# TODO: Remove this once Cloudflare DNS records are updated
origin = req.headers.get('Origin', '')
if 'firebase' in origin or 'web.app' in origin or 'firebaseapp.com' in origin:
    print(f"INFO: Allowing Firebase Hosting access (temporary): {origin}")
    return func(req)
```

**File 2**: `events/src/middleware/cloudflare.js`

Remove lines 104-110:
```javascript
// TEMPORARY: Allow direct access from Firebase Hosting until Cloudflare DNS is fixed
// TODO: Remove this once Cloudflare DNS records are updated
const origin = req.headers['origin'] || '';
if (origin.includes('firebase') || origin.includes('web.app') || origin.includes('firebaseapp.com')) {
  console.log(`INFO: Allowing Firebase Hosting access (temporary): ${origin}`);
  return next();
}
```

**File 3**: `elections/src/middleware/cloudflare.js`

Remove lines 104-110 (same as above).

### 3.3 Deploy Updated Code

```bash
# Deploy Cloud Functions
cd members/functions
gcloud functions deploy handleKenniAuth --gen2 --runtime=python311 \
  --region=europe-west2 --source=. --entry-point=handleKenniAuth \
  --trigger-http --allow-unauthenticated --memory=512MB --timeout=60s \
  --env-vars-file=.env.yaml \
  --set-secrets=KENNI_IS_CLIENT_SECRET=kenni-client-secret:latest \
  --project=ekklesia-prod-10-2025

# Deploy Events service
cd ../../events
./deploy.sh

# Deploy Elections service
cd ../elections
./deploy.sh

# Deploy Firebase Hosting
cd ../members
firebase deploy --only hosting
```

**Expected time**: 5-8 minutes total

---

## Phase 4: Testing & Verification

### 4.1 Test Login Flow

```bash
# Open browser to:
https://ekklesia-prod-10-2025.web.app

# Steps:
# 1. Click "Skrá inn með Kenni.is"
# 2. Authenticate with Kenni.is test credentials
# 3. Verify redirect to dashboard
# 4. Check browser console - no errors
```

**Expected**: Successful login via Cloudflare domain (auth.si-xj.org)

### 4.2 Verify CORS Headers via Cloudflare

```bash
curl -I https://auth.si-xj.org/ \
  -H 'Origin: https://ekklesia-prod-10-2025.web.app' \
  -H 'Access-Control-Request-Method: POST' \
  -X OPTIONS
```

**Expected**:
```
HTTP/2 204
access-control-allow-origin: *
access-control-allow-methods: GET, POST, OPTIONS
access-control-allow-headers: Content-Type, Authorization
cf-ray: <some-value>
```

### 4.3 Verify Origin Protection Working

```bash
# Test direct URL (should be blocked)
curl -I https://handlekenniauth-ymzrguoifa-nw.a.run.app/

# Expected: 403 Forbidden
# {"error": "Direct access not allowed"}
```

```bash
# Test via Cloudflare (should work)
curl -I https://auth.si-xj.org/ \
  -H 'Origin: https://ekklesia-prod-10-2025.web.app' \
  -X OPTIONS

# Expected: 204 No Content with CORS headers
```

### 4.4 Test Rate Limiting (Optional)

```bash
# Send 101 requests in quick succession
for i in {1..101}; do
  curl -s -o /dev/null -w "%{http_code}\n" https://auth.si-xj.org/
done | tail -10
```

**Expected**: Last few requests should return `429` (rate limited)

### 4.5 Run Verification Script

```bash
cd /home/gudro/Development/projects/ekklesia
./scripts/cloudflare-setup.sh verify
```

**Expected Output**:
```
✅ API token is valid
✅ vote.si-xj.org resolves to 104.21.6.57
✅ verify.si-xj.org resolves to 172.67.154.247
✅ api.si-xj.org resolves to 104.21.6.57
✅ auth.si-xj.org resolves to 104.21.6.57
✅ Rate limiting rules active: 1
✅ elections-service: Origin protection working (403 Forbidden)
✅ events-service: Origin protection working (403 Forbidden)
✅ handlekenniauth: Origin protection working (403 Forbidden)
✅ vote.si-xj.org: Routing through Cloudflare ✓
✅ api.si-xj.org: Routing through Cloudflare ✓
✅ auth.si-xj.org: Routing through Cloudflare ✓
```

---

## Phase 5: Update Scripts & Documentation

### 5.1 Fix cloudflare-setup.sh Script

Edit `scripts/cloudflare-setup.sh` line 168:

```bash
# Before (incorrect URL format assumption)
local target="${service}-${GCP_PROJECT_NUMBER}.${GCP_REGION}.run.app"

# After (detect actual Cloud Run URLs)
local target=""
if [ "$service" = "handlekenniauth" ] || [ "$service" = "verifymembership" ]; then
  # Cloud Functions (use gcloud functions describe)
  target=$(gcloud functions describe $service --region=$GCP_REGION --gen2 \
    --project=$GCP_PROJECT --format="value(serviceConfig.uri)" | sed 's|https://||')
else
  # Cloud Run services (use gcloud run services describe)
  target=$(gcloud run services describe $service --region=$GCP_REGION \
    --project=$GCP_PROJECT --format="value(status.url)" | sed 's|https://||')
fi

if [ -z "$target" ]; then
  log_error "Failed to get Cloud Run URL for service: $service"
  continue
fi
```

### 5.2 Update CURRENT_PRODUCTION_STATUS.md

Edit `docs/status/CURRENT_PRODUCTION_STATUS.md`:

**Remove** the "TEMPORARY" note:
```markdown
<!-- Before -->
API endpoints (using direct Cloud Run URLs until Cloudflare DNS is fixed)

<!-- After -->
API endpoints (via Cloudflare CDN for security and rate limiting)
```

Update service URLs table:
```markdown
| Service | Public URL (Cloudflare) | Status |
|---------|--------------------------|--------|
| **elections-service** | https://vote.si-xj.org | ✅ Active |
| **events-service** | https://api.si-xj.org | ✅ Active |
| **handlekenniauth** | https://auth.si-xj.org | ✅ Active |
| **verifymembership** | https://verify.si-xj.org | ✅ Active |
```

### 5.3 Update DEBUGGING Document

Edit `docs/status/DEBUGGING_2025-10-13_CORS_AND_TOKEN_ERRORS.md`:

Add a "Resolution Update" section at the top:
```markdown
## Resolution Update (2025-10-XX)

**Status**: ✅ Permanent Fix Applied

The temporary workarounds described in this document have been removed:
- Cloudflare DNS records updated to correct Cloud Run URLs
- `strings.xml` now uses Cloudflare domains (auth.si-xj.org, etc.)
- Temporary Firebase Hosting origin bypasses removed from all middleware
- Origin protection now enforced via Cloudflare only
- System fully operational with all security features enabled

**Commits**:
- DNS fix: `<commit-hash>`
- Code cleanup: `<commit-hash>`
```

### 5.4 Remove Temporary Script Files

```bash
cd /home/gudro/Development/projects/ekklesia
rm scripts/add-cors-headers.sh
rm scripts/fix-dns-records.sh
```

These were exploratory scripts that didn't work due to API permissions.

---

## Rollback Plan (If Issues Occur)

If the DNS update causes issues:

### Quick Rollback (Restore Service Immediately)

```bash
# Revert strings.xml to direct URLs
cd members/public/i18n/values-is
git checkout HEAD~1 strings.xml

# Redeploy Firebase Hosting
cd ../../../
firebase deploy --only hosting
```

**Time to restore**: 2-3 minutes

### Full Rollback (Restore All Changes)

```bash
# Revert to previous commit (before DNS fix)
git revert HEAD
git push

# Redeploy all services
cd members/functions
gcloud functions deploy handleKenniAuth --gen2 --runtime=python311 \
  --region=europe-west2 --source=. --entry-point=handleKenniAuth \
  --trigger-http --allow-unauthenticated --memory=512MB --timeout=60s \
  --env-vars-file=.env.yaml \
  --set-secrets=KENNI_IS_CLIENT_SECRET=kenni-client-secret:latest \
  --project=ekklesia-prod-10-2025

cd ../../events && ./deploy.sh
cd ../elections && ./deploy.sh
cd ../members && firebase deploy --only hosting
```

**Time to restore**: 10-12 minutes

---

## Success Criteria

Before considering this fix complete, verify:

- [ ] All 4 Cloudflare domains resolve correctly (auth, api, vote, verify)
- [ ] Login flow works via auth.si-xj.org
- [ ] CORS headers present on OPTIONS requests via Cloudflare
- [ ] Origin protection blocks direct Cloud Run URLs (403 Forbidden)
- [ ] Rate limiting active (test with 101 requests → 429 on last few)
- [ ] No console errors in browser
- [ ] Token issuance works via api.si-xj.org
- [ ] Profile page loads without errors
- [ ] All temporary code removed (search codebase for "TEMPORARY")
- [ ] Scripts updated to detect actual URLs
- [ ] Documentation updated

---

## Estimated Timeline

| Phase | Task | Time |
|-------|------|------|
| 1 | Verify access & gather info | 5 min |
| 2 | Update DNS records | 10 min |
| 3 | Update application code | 10 min |
| 4 | Testing & verification | 10 min |
| 5 | Update scripts & docs | 5 min |
| **Total** | | **40 min** |

Add 10 minutes buffer if using API method instead of dashboard.

---

## Prerequisites Checklist

Before starting:

- [ ] Cloudflare dashboard access OR API token with DNS permissions
- [ ] GCP credentials configured (`gcloud auth list`)
- [ ] Firebase CLI authenticated (`firebase login`)
- [ ] Git working tree clean (`git status`)
- [ ] Cloud SQL Proxy running (if testing locally)
- [ ] Test Kenni.is credentials available (for login testing)

---

## Notes

- **Best time to do this**: During low-traffic period (not during a meeting!)
- **Communication**: No user notification needed (transparent change)
- **Risk level**: Low (can rollback quickly if issues)
- **Impact**: Improves security posture (restores Cloudflare protections)

---

## Related Documents

- [DEBUGGING_2025-10-13_CORS_AND_TOKEN_ERRORS.md](../status/DEBUGGING_2025-10-13_CORS_AND_TOKEN_ERRORS.md) - Original debugging session
- [CLOUDFLARE_SETUP.md](../security/CLOUDFLARE_SETUP.md) - Cloudflare configuration guide
- [CURRENT_PRODUCTION_STATUS.md](../status/CURRENT_PRODUCTION_STATUS.md) - Production status
- [SECURITY_HARDENING_PLAN.md](../status/SECURITY_HARDENING_PLAN.md) - Security hardening phases

---

**Status**: 📋 Ready for implementation
**Owner**: DevOps / Infrastructure team
**Priority**: Medium (system functional with workaround)
**Next Step**: Obtain Cloudflare dashboard access or API token with DNS permissions
