# Cloudflare DNS Setup Plan - Improved with API Script

**Created**: 2025-10-12
**Branch**: feature/security-hardening
**Status**: 🔍 Investigation Phase
**Related**: SECURITY_HARDENING_PLAN.md (Issue #31 - Rate Limiting)

---

## Discovery

### Existing Cloudflare Infrastructure

**Found**: `/home/gudro/Development/projects/ekklesia/archive/zitadel-legacy/gcp/deployment/cloudflare-dns.sh`

This is a bash script that uses **Cloudflare API v4** to manage DNS records programmatically. The script shows previous work on domain `si-xj.org`.

**Key Functions**:
- `list` - List all DNS records
- `create-cname` - Create CNAME records (what we need for Cloud Run)
- `update` - Update existing records
- `delete` - Delete records
- `get-id` - Get record ID by name

**API Authentication**: Uses `CF_API_TOKEN` environment variable

---

## Current Status

### ❌ Cloudflare CLI Not Installed
```bash
# Checked for:
which cloudflared  # Not found
which flarectl     # Not found
which cf-cli       # Not found
```

### ❌ No API Token Configured
```bash
# No environment variable:
env | grep CF_  # Nothing

# No secret in GCP Secret Manager:
gcloud secrets list  # No Cloudflare secrets
```

### ✅ API Script Available
- Script location: `archive/zitadel-legacy/gcp/deployment/cloudflare-dns.sh`
- Uses curl + jq for API calls
- Ready to use once API token is obtained

---

## Investigation Required

### Question 1: Domain Ownership

**✅ VERIFIED (Oct 12, 2025): SÍ owns these domains:**

**Primary**: `sosialistaflokkurinn.is`
- Registrant: SI320-IS (confirmed SÍ)
- Status: Active (WordPress site)
- Use: All Ekklesia services

**Alternative**: `xj.is`
- Registrant: SI320-IS (same as sosialistaflokkurinn.is)
- Status: Active (redirects to sosialistaflokkurinn.is)
- Use: Short URLs (e.g., vote.xj.is)

**NOT SÍ**: `samstodin.is` (registrant: SE5217-IS, different organization)

**Action Needed**: Contact SÍ to:
1. Get DNS management access for sosialistaflokkurinn.is
2. Check if Cloudflare account exists
3. Get Cloudflare API token (if account exists)

### Question 2: Previous si-xj.org Setup

The archived script references `si-xj.org`:

```bash
# From cloudflare-dns.sh:8
DOMAIN="si-xj.org"
```

**✅ VERIFIED (Oct 12, 2025)**:
1. si-xj.org IS on Cloudflare (nameservers: bristol.ns.cloudflare.com, jakub.ns.cloudflare.com)
2. Appears to be test/legacy domain (no longer primary)
3. May have existing Cloudflare account we can reuse

**Investigation Command**:
```bash
# Check if si-xj.org exists and its nameservers
dig si-xj.org NS
dig si-xj.org SOA

# If it's on Cloudflare, nameservers will be like:
# *.ns.cloudflare.com
```

---

## Improved Implementation Plan

### Phase 1: Investigation & Preparation (30 minutes)

**Step 1: Check si-xj.org**
```bash
# See if domain exists and is on Cloudflare
dig si-xj.org NS
dig si-xj.org A
dig si-xj.org AAAA

# Check who owns it
whois si-xj.org
```

**Step 2: Contact SÍ**

Questions to ask:
1. ✅ sosialistaflokkurinn.is is confirmed SÍ domain (SI320-IS)
2. Who has access to DNS management?
3. Is there an existing Cloudflare account? (si-xj.org is on Cloudflare)
4. Can we get API token access?

**Step 3: Get Cloudflare API Token**

If Cloudflare account exists:
1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Create token with permissions:
   - Zone.DNS - Edit
   - Zone.Zone Settings - Read
3. Copy token

If no account:
1. Create free Cloudflare account
2. Add domain to Cloudflare
3. Update nameservers at domain registrar
4. Get API token (as above)

---

### Phase 2: Setup API Access (15 minutes)

**Option A: Use Existing Script (Recommended)**

```bash
# 1. Copy script to project root for easy access
cp archive/zitadel-legacy/gcp/deployment/cloudflare-dns.sh .

# 2. Make executable
chmod +x cloudflare-dns.sh

# 3. Update domain in script
# Edit line 8:
# OLD: DOMAIN="si-xj.org"
# NEW: DOMAIN="sosialistaflokkurinn.is"  # (or actual domain)

# 4. Set API token
export CF_API_TOKEN='your-token-here'

# 5. Test connection
./cloudflare-dns.sh list
```

**Option B: Store Token in Secret Manager (More Secure)**

```bash
# Store Cloudflare API token securely
echo -n 'your-cloudflare-api-token' | \
  gcloud secrets create cloudflare-api-token \
  --project ekklesia-prod-10-2025 \
  --replication-policy automatic \
  --data-file=-

# Retrieve when needed
export CF_API_TOKEN=$(gcloud secrets versions access latest \
  --secret cloudflare-api-token \
  --project ekklesia-prod-10-2025)

# Test
./cloudflare-dns.sh list
```

---

### Phase 3: Create DNS Records for Ekklesia (20 minutes)

**Current Cloud Run URLs** (from production):
```
handlekenniauth:    handlekenniauth-521240388393.europe-west2.run.app
verifymembership:   verifymembership-521240388393.europe-west2.run.app
events-service:     events-service-521240388393.europe-west2.run.app
elections-service:  elections-service-521240388393.europe-west2.run.app
```

**Target DNS Records**:
```
auth.sosialistaflokkurinn.is    → handlekenniauth-xxx.run.app    (Proxied)
verify.sosialistaflokkurinn.is  → verifymembership-xxx.run.app   (Proxied)
api.sosialistaflokkurinn.is     → events-service-xxx.run.app     (Proxied)
vote.sosialistaflokkurinn.is    → elections-service-xxx.run.app  (Proxied)
```

**Create Records Using Script**:

```bash
# Set API token
export CF_API_TOKEN='your-token-here'

# Create CNAME for OAuth endpoint (proxied for rate limiting)
./cloudflare-dns.sh create-cname auth \
  handlekenniauth-521240388393.europe-west2.run.app \
  true

# Create CNAME for membership verification (proxied)
./cloudflare-dns.sh create-cname verify \
  verifymembership-521240388393.europe-west2.run.app \
  true

# Create CNAME for Events API (proxied for rate limiting)
./cloudflare-dns.sh create-cname api \
  events-service-521240388393.europe-west2.run.app \
  true

# Create CNAME for Elections/Voting API (proxied for rate limiting)
./cloudflare-dns.sh create-cname vote \
  elections-service-521240388393.europe-west2.run.app \
  true

# Verify records were created
./cloudflare-dns.sh list
```

**Expected Output**:
```
DNS Records for sosialistaflokkurinn.is:
CNAME   auth.sosialistaflokkurinn.is    handlekenniauth-xxx.run.app    true
CNAME   verify.sosialistaflokkurinn.is  verifymembership-xxx.run.app   true
CNAME   api.sosialistaflokkurinn.is     events-service-xxx.run.app     true
CNAME   vote.sosialistaflokkurinn.is    elections-service-xxx.run.app  true
```

---

### Phase 4: Configure Rate Limiting (Cloudflare Dashboard)

**Note**: Rate limiting rules must be configured in Cloudflare dashboard (not via API script)

**Step 1: Go to Dashboard**
```
https://dash.cloudflare.com → Select domain → Security → WAF
```

**Step 2: Create Rate Limiting Rules**

**Rule 1: Protect OAuth Endpoint**
```
Name: "Rate limit OAuth"
If:
  - Hostname equals "auth.sosialistaflokkurinn.is"
When rate exceeds:
  - 100 requests per 1 minute
  - From same IP address
Then:
  - Block for 10 minutes
  - Log event
```

**Rule 2: Protect API Endpoints**
```
Name: "Rate limit API"
If:
  - Hostname matches "api.sosialistaflokkurinn.is" OR
  - Hostname matches "vote.sosialistaflokkurinn.is"
When rate exceeds:
  - 300 requests per 1 minute (allow voting spike)
  - From same IP address
Then:
  - Challenge (CAPTCHA) for 5 minutes
  - Log event
```

**Rule 3: Protect Membership Verification**
```
Name: "Rate limit membership check"
If:
  - Hostname equals "verify.sosialistaflokkurinn.is"
When rate exceeds:
  - 60 requests per 1 minute
  - From same IP address
Then:
  - Block for 5 minutes
  - Log event
```

---

### Phase 5: Implement Origin Protection (2-3 hours) 🔴 CRITICAL

**⚠️ IMPORTANT**: Before updating application URLs, you MUST implement origin protection to prevent Cloudflare bypass attacks.

**The Problem**: Cloudflare DNS only protects traffic that goes through Cloudflare. The direct Cloud Run URLs remain publicly accessible:

```
Direct URLs (Still Exposed):
❌ https://elections-service-521240388393.europe-west2.run.app
❌ https://events-service-521240388393.europe-west2.run.app
❌ https://handlekenniauth-521240388393.europe-west2.run.app
❌ https://verifymembership-521240388393.europe-west2.run.app
```

**The Solution**: Implement IP filtering middleware to only accept traffic from Cloudflare IP ranges.

**See Complete Implementation Guide**: [docs/security/CLOUDFLARE_BYPASS_PROTECTION.md](../security/CLOUDFLARE_BYPASS_PROTECTION.md)

**Implementation Checklist**:
- [ ] Create `shared/middleware/cloudflare-check.js` (Node.js services)
- [ ] Create `members/functions/cloudflare_check.py` (Python Cloud Functions)
- [ ] Add middleware to events-service
- [ ] Add middleware to elections-service
- [ ] Add decorator to handlekenniauth
- [ ] Add decorator to verifymembership
- [ ] Test direct URL access (should get 403 Forbidden)
- [ ] Test Cloudflare URL access (should work normally)

**Why This Is Critical**: Without origin protection, attackers can bypass Cloudflare's rate limiting, DDoS protection, and WAF by directly hitting the Cloud Run URLs.

---

### Phase 6: Update Application URLs (30 minutes)

**Files to Update**:

#### 1. Members Service Frontend

**File**: `members/public/index.html`
```javascript
// Find and update Cloud Function URL
// OLD:
const HANDLE_KENNI_AUTH_URL =
  'https://handlekenniauth-521240388393.europe-west2.run.app';

// NEW:
const HANDLE_KENNI_AUTH_URL =
  'https://auth.sosialistaflokkurinn.is/handleKenniAuth';
```

**File**: `members/public/dashboard.html` (if it calls verifyMembership)
```javascript
// OLD:
const VERIFY_URL =
  'https://verifymembership-521240388393.europe-west2.run.app';

// NEW:
const VERIFY_URL =
  'https://verify.sosialistaflokkurinn.is';
```

**File**: `members/public/test-events.html`
```javascript
// OLD:
const EVENTS_API_URL =
  'https://events-service-521240388393.europe-west2.run.app';

// NEW:
const EVENTS_API_URL =
  'https://api.sosialistaflokkurinn.is';
```

#### 2. Events Service (S2S calls to Elections)

**File**: `events/src/services/electionsClient.js`
```javascript
// OLD:
const ELECTIONS_SERVICE_URL =
  process.env.ELECTIONS_SERVICE_URL ||
  'https://elections-service-521240388393.europe-west2.run.app';

// NEW:
const ELECTIONS_SERVICE_URL =
  process.env.ELECTIONS_SERVICE_URL ||
  'https://vote.sosialistaflokkurinn.is';
```

#### 3. OAuth Redirect URI (Kenni.is)

**Action**: Update redirect URI in Kenni.is developer console

```
OLD: https://handlekenniauth-521240388393.europe-west2.run.app/
NEW: https://auth.sosialistaflokkurinn.is/
```

**Steps**:
1. Log in to Kenni.is developer console
2. Find Ekklesia application
3. Update redirect URIs
4. Save changes

#### 4. Firebase Hosting Configuration

**File**: `members/firebase.json`
```json
{
  "hosting": {
    "public": "public",
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**",
        "headers": [
          {
            "key": "Content-Security-Policy",
            "value": "default-src 'self' https://auth.sosialistaflokkurinn.is https://api.sosialistaflokkurinn.is https://vote.sosialistaflokkurinn.is https://verify.sosialistaflokkurinn.is;"
          }
        ]
      }
    ]
  }
}
```

---

### Phase 6: Testing (30 minutes + 24-48 hours DNS propagation)

**Immediate Tests** (after DNS records created):

```bash
# 1. Check DNS propagation
dig auth.sosialistaflokkurinn.is
dig api.sosialistaflokkurinn.is
dig vote.sosialistaflokkurinn.is
dig verify.sosialistaflokkurinn.is

# 2. Test HTTPS endpoints (should work via Cloudflare)
curl -I https://auth.sosialistaflokkurinn.is/
curl -I https://api.sosialistaflokkurinn.is/health
curl -I https://vote.sosialistaflokkurinn.is/health
curl -I https://verify.sosialistaflokkurinn.is/

# 3. Test rate limiting (send 101 requests)
for i in {1..101}; do
  curl -X POST https://auth.sosialistaflokkurinn.is/handleKenniAuth \
    -H "Content-Type: application/json" \
    -d '{"test":"data"}' \
    -w "\nStatus: %{http_code}\n"
done
# Should get 429 (Too Many Requests) after 100 requests
```

**After DNS Propagation** (24-48 hours):

1. Test full OAuth flow from production frontend
2. Test voting flow end-to-end
3. Monitor Cloudflare dashboard for traffic
4. Verify rate limiting rules are working

---

## Decision Tree

### Scenario A: SÍ Has Cloudflare + Domain

**Timeline**: 2-3 hours + DNS propagation

1. Get API token → 5 min
2. Configure script → 10 min
3. Create DNS records → 15 min
4. Configure rate limiting (dashboard) → 20 min
5. Update application URLs → 30 min
6. Test → 30 min
7. Wait for DNS propagation → 24-48 hours

**Cost**: $0 (Cloudflare Free)

### Scenario B: SÍ Has Domain, No Cloudflare

**Timeline**: 4-5 hours + DNS propagation

1. Create Cloudflare account → 10 min
2. Add domain to Cloudflare → 10 min
3. Update nameservers at registrar → 5 min
4. Wait for nameserver propagation → 1-2 hours
5. Get API token → 5 min
6. Then follow Scenario A steps 2-7

**Cost**: $0 (Cloudflare Free)

### Scenario C: No Domain Available

**Timeline**: 1-2 hours (no DNS wait)

Use Firebase App Check instead (see SECURITY_HARDENING_PLAN.md Option B)

**Cost**: $0 (Firebase free tier)

---

## Advantages of Using Existing Script

✅ **Already battle-tested** - Used before for si-xj.org
✅ **Simple bash + curl** - No new dependencies
✅ **API-based** - Programmatic, reproducible
✅ **Documented** - Has usage examples
✅ **Version controllable** - Can commit to git

vs. Manual Dashboard Setup:
❌ **Point-and-click** - Not reproducible
❌ **Human error** - Typos in DNS records
❌ **No audit trail** - Can't see what changed when

---

## Recommended Workflow

### Step 1: Investigation (Today)
```bash
# Check if si-xj.org is still available/owned
dig si-xj.org NS
whois si-xj.org

# Contact SÍ about DNS management access
# Questions:
# 1. What domain do you own?
# 2. Who manages DNS?
# 3. Do you have Cloudflare account?
```

### Step 2: Preparation (After domain confirmed)
```bash
# Copy script to project root
cp archive/zitadel-legacy/gcp/deployment/cloudflare-dns.sh .

# Update domain in script (line 8)
# Edit: DOMAIN="sosialistaflokkurinn.is"

# Get API token and store in Secret Manager
echo -n 'token-here' | gcloud secrets create cloudflare-api-token \
  --project ekklesia-prod-10-2025 \
  --replication-policy automatic \
  --data-file=-

# Test connection
export CF_API_TOKEN=$(gcloud secrets versions access latest \
  --secret cloudflare-api-token --project ekklesia-prod-10-2025)
./cloudflare-dns.sh list
```

### Step 3: Implementation (After DNS access confirmed)
```bash
# Create all DNS records (using script)
./cloudflare-dns.sh create-cname auth handlekenniauth-xxx.run.app true
./cloudflare-dns.sh create-cname verify verifymembership-xxx.run.app true
./cloudflare-dns.sh create-cname api events-service-xxx.run.app true
./cloudflare-dns.sh create-cname vote elections-service-xxx.run.app true

# Configure rate limiting (Cloudflare dashboard)
# Update application URLs (code changes)
# Test everything
```

---

## Next Actions

**Immediate** (Today):
1. ✅ Investigate si-xj.org domain
2. ✅ Verified SÍ domain ownership (sosialistaflokkurinn.is, xj.is)
3. ✅ Determine if Cloudflare account exists

**If Domain Available** (Day 2):
1. Get Cloudflare API token
2. Store token in Secret Manager
3. Copy and configure cloudflare-dns.sh script
4. Test API connection

**If Domain + API Access** (Day 3):
1. Create DNS records using script
2. Configure rate limiting in dashboard
3. Update application URLs
4. Deploy changes
5. Test and monitor

---

## Cost Analysis (Updated)

| Option | Setup Time | Cost/Month | Effectiveness | Needs Domain? |
|--------|-----------|------------|---------------|---------------|
| **Cloudflare API** | 2-3 hours | **$0** | ⭐⭐⭐⭐⭐ | Yes |
| Firebase App Check | 1-2 hours | $0 | ⭐⭐⭐ | No |
| Cloud Armor | 2-3 hours | $0.75+ | ⭐⭐⭐⭐ | No |

**Recommendation**: Use Cloudflare API script if domain available (best value + effectiveness)

---

## Rollback Plan

If Cloudflare causes issues:

```bash
# 1. Get record IDs
./cloudflare-dns.sh get-id auth
./cloudflare-dns.sh get-id api
./cloudflare-dns.sh get-id vote
./cloudflare-dns.sh get-id verify

# 2. Delete records
./cloudflare-dns.sh delete <record-id>

# 3. Revert application URLs back to *.run.app

# 4. Redeploy
```

**Timeline**: 30 minutes to rollback

---

**Document Version**: 1.0
**Last Updated**: 2025-10-12
**Status**: Investigation Phase
**Next Step**: ✅ Domains verified - Contact SÍ for DNS management access
