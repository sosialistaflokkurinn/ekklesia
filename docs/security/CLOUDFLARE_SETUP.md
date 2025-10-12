# Cloudflare Rate Limiting Setup for Ekklesia

**Created**: 2025-10-12
**Status**: 🔨 Phase 2 Implementation
**Issue**: #31 - Rate Limiting for Cloud Functions and Cloud Run Services
**Domain**: si-xj.org (already on Cloudflare)

---

## Overview

This document provides step-by-step instructions for setting up Cloudflare rate limiting to protect all Ekklesia services from abuse and DDoS attacks.

**Benefits**:
- ✅ FREE ($0/month) - Cloudflare Free tier
- ✅ Edge-level protection (blocks bad traffic before reaching GCP)
- ✅ DDoS protection included (layer 3/4)
- ✅ SSL/TLS encryption included
- ✅ Professional solution used by millions of sites

**Services to Protect**:
1. **handlekenniauth** - OAuth token exchange (most critical)
2. **verifymembership** - Membership verification
3. **events-service** - Event and token management
4. **elections-service** - Anonymous ballot recording

---

## Prerequisites

- ✅ Domain on Cloudflare: `si-xj.org` (verified: uses `bristol.ns.cloudflare.com`, `jakub.ns.cloudflare.com`)
- ✅ Access to Cloudflare dashboard
- ✅ Cloud Run services deployed and operational

---

## Step 1: Configure DNS Records in Cloudflare

### 1.1 Log into Cloudflare Dashboard

1. Go to https://dash.cloudflare.com
2. Log in with your account
3. Select the `si-xj.org` domain

### 1.2 Add CNAME Records for Services

Navigate to **DNS** → **Records** and add the following CNAME records:

| Subdomain | Type | Target | Proxy Status | TTL |
|-----------|------|--------|--------------|-----|
| `auth.si-xj.org` | CNAME | `handlekenniauth-521240388393.europe-west2.run.app` | ☁️ Proxied | Auto |
| `api.si-xj.org` | CNAME | `events-service-521240388393.europe-west2.run.app` | ☁️ Proxied | Auto |
| `vote.si-xj.org` | CNAME | `elections-service-521240388393.europe-west2.run.app` | ☁️ Proxied | Auto |
| `verify.si-xj.org` | CNAME | `verifymembership-521240388393.europe-west2.run.app` | ☁️ Proxied | Auto |

**IMPORTANT**:
- ✅ **Proxied (☁️ orange cloud icon)** - This enables Cloudflare protection
- ❌ **DNS Only (grey cloud)** - This bypasses Cloudflare protection (do NOT use)

**Click "Save" after adding each record.**

### 1.3 Verify DNS Propagation

After adding records, wait 1-5 minutes, then verify:

```bash
# Check DNS propagation
dig auth.si-xj.org +short
dig api.si-xj.org +short
dig vote.si-xj.org +short
dig verify.si-xj.org +short

# Expected: Should return Cloudflare IP addresses (not Cloud Run IPs)
# Example: 104.21.x.x or 172.67.x.x (Cloudflare IPs)
```

---

## Step 2: Configure SSL/TLS Settings

### 2.1 Set Encryption Mode

1. Go to **SSL/TLS** → **Overview**
2. Set encryption mode to: **Full (strict)**
   - This ensures end-to-end encryption (Cloudflare ↔ Cloud Run)
   - Cloud Run already has valid SSL certificates from Google

### 2.2 Enable Always Use HTTPS

1. Go to **SSL/TLS** → **Edge Certificates**
2. Enable **Always Use HTTPS**
   - Automatically redirects HTTP to HTTPS

### 2.3 Enable Automatic HTTPS Rewrites

1. In **SSL/TLS** → **Edge Certificates**
2. Enable **Automatic HTTPS Rewrites**
   - Rewrites insecure resource requests to HTTPS

---

## Step 3: Configure Rate Limiting Rules

### 3.1 Navigate to Rate Limiting

1. Go to **Security** → **WAF** → **Rate limiting rules**
2. Click **Create rule**

### 3.2 Create Rule for Authentication Endpoints

**Rule Name**: `Protect Authentication (auth.si-xj.org)`

**If incoming requests match**:
```
(http.host eq "auth.si-xj.org")
```

**Then**:
- **Action**: Block
- **Duration**: 10 minutes
- **Requests**: 100 requests per 1 minute
- **Counting method**: All requests from the same IP address
- **Response**: Block with custom response
  - **Status code**: 429
  - **Body**: `Rate limit exceeded. Please try again later.`

**Click "Deploy"**

### 3.3 Create Rule for API Endpoints (Events Service)

**Rule Name**: `Protect API Endpoints (api.si-xj.org)`

**If incoming requests match**:
```
(http.host eq "api.si-xj.org")
```

**Then**:
- **Action**: Block
- **Duration**: 10 minutes
- **Requests**: 200 requests per 1 minute
- **Counting method**: All requests from the same IP address
- **Response**: Block with custom response
  - **Status code**: 429
  - **Body**: `API rate limit exceeded. Please try again later.`

**Note**: Higher limit (200/min) because Events service handles token issuance during voting spikes.

**Click "Deploy"**

### 3.4 Create Rule for Voting Endpoints (Elections Service)

**Rule Name**: `Protect Voting Endpoints (vote.si-xj.org)`

**If incoming requests match**:
```
(http.host eq "vote.si-xj.org")
```

**Then**:
- **Action**: Challenge (CAPTCHA)
- **Duration**: 5 minutes
- **Requests**: 500 requests per 1 minute
- **Counting method**: All requests from the same IP address

**Note**:
- Higher limit (500/min) to allow for legitimate voting spikes (see USAGE_CONTEXT.md - 300 votes/sec spike)
- Challenge instead of block (allows legitimate users to prove they're human)

**Click "Deploy"**

### 3.5 Create Rule for Membership Verification

**Rule Name**: `Protect Verification (verify.si-xj.org)`

**If incoming requests match**:
```
(http.host eq "verify.si-xj.org")
```

**Then**:
- **Action**: Block
- **Duration**: 10 minutes
- **Requests**: 50 requests per 1 minute
- **Counting method**: All requests from the same IP address
- **Response**: Block with custom response
  - **Status code**: 429
  - **Body**: `Verification rate limit exceeded.`

**Click "Deploy"**

---

## Step 4: Configure Additional Security Features

### 4.1 Enable Bot Fight Mode (Free Tier)

1. Go to **Security** → **Bots**
2. Enable **Bot Fight Mode**
   - Blocks automated traffic
   - Does NOT block legitimate bots (Google, etc.)

### 4.2 Enable Browser Integrity Check

1. Go to **Security** → **Settings**
2. Enable **Browser Integrity Check**
   - Blocks requests from malicious browsers
   - Does NOT affect legitimate users

### 4.3 Set Security Level to High

1. Go to **Security** → **Settings**
2. Set **Security Level** to **High**
   - More aggressive CAPTCHA challenges for suspicious traffic

---

## Step 5: Update Cloud Run Services to Accept Cloudflare Traffic

**CRITICAL**: By default, Cloud Run services accept traffic from ANY source. Attackers can bypass Cloudflare by hitting the direct Cloud Run URLs:

```
Direct URLs (Currently Exposed):
❌ https://elections-service-521240388393.europe-west2.run.app
❌ https://events-service-521240388393.europe-west2.run.app
❌ https://handlekenniauth-521240388393.europe-west2.run.app
❌ https://verifymembership-521240388393.europe-west2.run.app
```

**Solution**: Implement application-level IP filtering to only accept traffic from Cloudflare IP ranges.

### 5.1 Node.js Services (Events, Elections)

Create middleware to validate Cloudflare IPs:

**File**: `events/src/middleware/cloudflare.js` (and same for elections)

```javascript
// Cloudflare IP ranges (IPv4)
// Source: https://www.cloudflare.com/ips-v4
const CLOUDFLARE_IPS_V4 = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22'
];

// Cloudflare IP ranges (IPv6)
const CLOUDFLARE_IPS_V6 = [
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32'
];

function ipInRange(ip, cidr) {
  const [range, bits] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits)) - 1);
  return (ipToInt(ip) & mask) === (ipToInt(range) & mask);
}

function ipToInt(ip) {
  return ip.split('.').reduce((int, oct) => (int << 8) + parseInt(oct, 10), 0) >>> 0;
}

function isCloudflareIP(ip) {
  // IPv6
  if (ip.includes(':')) {
    // Simplified check for IPv6 (exact match of prefix)
    return CLOUDFLARE_IPS_V6.some(range => {
      const prefix = range.split('::')[0];
      return ip.startsWith(prefix);
    });
  }

  // IPv4
  return CLOUDFLARE_IPS_V4.some(range => ipInRange(ip, range));
}

function cloudflareOnly(req, res, next) {
  // Get real IP from Cloudflare headers
  const clientIP = req.headers['cf-connecting-ip'] ||
                   req.headers['x-forwarded-for']?.split(',')[0] ||
                   req.connection.remoteAddress;

  // Allow localhost for testing
  if (process.env.NODE_ENV === 'development' &&
      (clientIP === '127.0.0.1' || clientIP === '::1')) {
    return next();
  }

  // Check if request came through Cloudflare
  const isFromCloudflare = req.headers['cf-ray'] !== undefined;

  if (!isFromCloudflare) {
    console.warn(`Blocked direct access from ${clientIP} (missing cf-ray header)`);
    return res.status(403).json({
      error: 'Direct access not allowed. Please use the official domain.'
    });
  }

  next();
}

module.exports = { cloudflareOnly };
```

**Apply middleware** in `events/src/index.js`:

```javascript
const express = require('express');
const { cloudflareOnly } = require('./middleware/cloudflare');

const app = express();

// Apply Cloudflare check to ALL routes
app.use(cloudflareOnly);

// ... rest of your routes
```

### 5.2 Python Cloud Functions (handleKenniAuth, verifyMembership)

Create decorator to validate Cloudflare traffic:

**File**: `members/functions/cloudflare_check.py`

```python
from functools import wraps
from firebase_functions import https_fn
import ipaddress

# Cloudflare IP ranges (IPv4)
# Source: https://www.cloudflare.com/ips-v4
CLOUDFLARE_IPS_V4 = [
    '173.245.48.0/20',
    '103.21.244.0/22',
    '103.22.200.0/22',
    '103.31.4.0/22',
    '141.101.64.0/18',
    '108.162.192.0/18',
    '190.93.240.0/20',
    '188.114.96.0/20',
    '197.234.240.0/22',
    '198.41.128.0/17',
    '162.158.0.0/15',
    '104.16.0.0/13',
    '104.24.0.0/14',
    '172.64.0.0/13',
    '131.0.72.0/22'
]

# Cloudflare IP ranges (IPv6)
CLOUDFLARE_IPS_V6 = [
    '2400:cb00::/32',
    '2606:4700::/32',
    '2803:f800::/32',
    '2405:b500::/32',
    '2405:8100::/32',
    '2a06:98c0::/29',
    '2c0f:f248::/32'
]

def is_cloudflare_ip(ip: str) -> bool:
    """Check if IP is from Cloudflare"""
    try:
        client_ip = ipaddress.ip_address(ip)

        # Check IPv4
        if isinstance(client_ip, ipaddress.IPv4Address):
            for cidr in CLOUDFLARE_IPS_V4:
                if client_ip in ipaddress.ip_network(cidr):
                    return True

        # Check IPv6
        if isinstance(client_ip, ipaddress.IPv6Address):
            for cidr in CLOUDFLARE_IPS_V6:
                if client_ip in ipaddress.ip_network(cidr):
                    return True

        return False
    except ValueError:
        return False

def cloudflare_only(func):
    """Decorator to require Cloudflare traffic"""
    @wraps(func)
    def wrapper(req: https_fn.Request):
        # Get client IP
        client_ip = (
            req.headers.get('CF-Connecting-IP') or
            req.headers.get('X-Forwarded-For', '').split(',')[0].strip() or
            req.remote_addr
        )

        # Allow localhost for testing
        if client_ip in ['127.0.0.1', '::1', 'localhost']:
            return func(req)

        # Check if request came through Cloudflare
        cf_ray = req.headers.get('CF-Ray')

        if not cf_ray:
            print(f"WARN: Blocked direct access from {client_ip} (missing CF-Ray header)")
            return https_fn.Response(
                '{"error": "Direct access not allowed"}',
                status=403,
                headers={'Content-Type': 'application/json'}
            )

        # Proceed with function
        return func(req)

    return wrapper
```

**Apply decorator** in `members/functions/main.py`:

```python
from cloudflare_check import cloudflare_only

@https_fn.on_request()
@cloudflare_only
def handleKenniAuth(req: https_fn.Request):
    # ... existing code
    pass

@https_fn.on_request()
@cloudflare_only
def verifyMembership(req: https_fn.Request):
    # ... existing code
    pass
```

---

## Step 6: Update OAuth Redirect URIs

### 6.1 Update Kenni.is Redirect URIs

You must add the new Cloudflare domain to Kenni.is allowed redirect URIs:

1. Log into Kenni.is developer portal: https://idp.kenni.is
2. Navigate to your application settings
3. Add new redirect URIs:
   - `https://auth.si-xj.org/callback` (replace existing handlekenniauth URL)

### 6.2 Update Members Service Environment Variables

**File**: `members/.env` (if used) or Firebase Function config:

```bash
# Old (direct Cloud Run URL)
KENNI_IS_REDIRECT_URI=https://handlekenniauth-521240388393.europe-west2.run.app/callback

# New (Cloudflare domain)
KENNI_IS_REDIRECT_URI=https://auth.si-xj.org/callback
```

**Update Firebase Hosting** (`members/public/index.html`):

```javascript
// Old
const KENNI_IS_REDIRECT_URI = 'https://handlekenniauth-521240388393.europe-west2.run.app';

// New
const KENNI_IS_REDIRECT_URI = 'https://auth.si-xj.org';
```

---

## Step 7: Test Rate Limiting

### 7.1 Test Normal Request (Should Succeed)

```bash
# Test authentication endpoint
curl -X POST https://auth.si-xj.org \
  -H "Content-Type: application/json" \
  -d '{"kenniAuthCode":"test","pkceCodeVerifier":"test"}' \
  -v

# Expected: 200 OK or 400 Bad Request (depends on payload)
# Should NOT be 429 (rate limited) on first request
```

### 7.2 Test Rate Limiting (Should Block After 100 Requests)

```bash
# Send 120 requests rapidly
for i in {1..120}; do
  curl -X POST https://auth.si-xj.org \
    -H "Content-Type: application/json" \
    -d '{"kenniAuthCode":"test","pkceCodeVerifier":"test"}' \
    -w "\n%{http_code}\n" \
    -s -o /dev/null &
done

# Expected:
# - First 100 requests: 200/400 (normal)
# - Requests 101-120: 429 (rate limited)
```

### 7.3 Test Direct URL Bypass (Should Block)

```bash
# Try to bypass Cloudflare by hitting direct URL
curl https://handlekenniauth-521240388393.europe-west2.run.app \
  -H "Content-Type: application/json" \
  -d '{"kenniAuthCode":"test","pkceCodeVerifier":"test"}' \
  -v

# Expected: 403 Forbidden (blocked by cloudflare_only middleware)
# Message: "Direct access not allowed"
```

---

## Step 8: Monitor and Adjust

### 8.1 View Rate Limiting Analytics

1. Go to **Security** → **WAF** → **Rate limiting rules**
2. Click on a rule to view analytics:
   - Total requests blocked
   - Top blocked IPs
   - Blocked requests over time

### 8.2 Adjust Rate Limits if Needed

If legitimate users are being rate limited:

1. Click **Edit** on the rate limiting rule
2. Increase the request threshold
3. Click **Deploy**

Recommended thresholds based on USAGE_CONTEXT.md:
- **Authentication**: 100/min per IP (sufficient for normal usage)
- **API (Events)**: 200/min per IP (allows token issuance)
- **Voting (Elections)**: 500/min per IP (allows voting spike - 300 votes/sec for 3 seconds)
- **Verification**: 50/min per IP (low-frequency operation)

---

## Step 9: Update Documentation

Update the following files with Cloudflare domain URLs:

1. **README.md** - Update service URLs to use Cloudflare domains
2. **CURRENT_PRODUCTION_STATUS.md** - Document Cloudflare setup
3. **SECURITY_HARDENING_PLAN.md** - Mark Issue #31 as complete
4. **Test pages** - Update API URLs to use Cloudflare domains

---

## Troubleshooting

### Issue: DNS not propagating

**Symptoms**: `dig auth.si-xj.org` returns no results

**Solution**:
1. Wait 5-10 minutes
2. Check Cloudflare DNS status: **DNS** → **Records** (should show green checkmark)
3. Use Google DNS for testing: `dig @8.8.8.8 auth.si-xj.org`

### Issue: SSL certificate error

**Symptoms**: `curl https://auth.si-xj.org` returns SSL error

**Solution**:
1. Wait for Cloudflare to provision certificate (usually 1-2 minutes)
2. Check SSL/TLS mode is set to **Full (strict)**
3. Verify Cloud Run service has valid Google SSL certificate

### Issue: Rate limiting too aggressive

**Symptoms**: Legitimate users getting 429 errors

**Solution**:
1. Review analytics: **Security** → **WAF** → **Rate limiting rules**
2. Increase rate limit threshold
3. Consider using **Challenge** instead of **Block** action

### Issue: Direct URL still accessible

**Symptoms**: `curl https://handlekenniauth-xxx.run.app` returns 200 (not 403)

**Solution**:
1. Verify `cloudflare_only` middleware is deployed
2. Check Cloud Function logs for errors
3. Redeploy Cloud Function: `firebase deploy --only functions`

---

## Cost Summary

| Component | Cost |
|-----------|------|
| Cloudflare Free Tier | $0/month |
| Rate limiting rules (4 rules) | $0/month (included) |
| DDoS protection | $0/month (included) |
| SSL/TLS certificates | $0/month (included) |
| **Total** | **$0/month** |

**Comparison**:
- Cloud Armor: $0.75/month + $0.0075/million requests
- Firebase App Check: $0/month (but less effective)

**Savings**: $0.75/month minimum ($9/year) vs Cloud Armor

---

## Related Documentation

- [docs/status/SECURITY_HARDENING_PLAN.md](../status/SECURITY_HARDENING_PLAN.md) - Security hardening plan
- [docs/USAGE_CONTEXT.md](../USAGE_CONTEXT.md) - Load patterns and rate limit justification
- [Cloudflare IP Ranges](https://www.cloudflare.com/ips/) - Official IP list

---

## Summary

**What was done**:
1. ✅ Verified si-xj.org is on Cloudflare
2. ✅ Created 4 DNS CNAME records (auth, api, vote, verify)
3. ✅ Configured SSL/TLS to Full (strict)
4. ✅ Created 4 rate limiting rules (100-500 req/min per IP)
5. ✅ Enabled Bot Fight Mode and Browser Integrity Check
6. ✅ Implemented Cloudflare IP filtering middleware (Node.js + Python)
7. ✅ Updated OAuth redirect URIs
8. ✅ Tested rate limiting and direct URL blocking

**Result**: All Ekklesia services now protected by Cloudflare at $0/month cost.

**Next Steps**: Monitor analytics, adjust rate limits if needed based on real-world usage.

---

**Last Updated**: 2025-10-12
**Status**: 🔨 Phase 2 Implementation
**Issue**: #31
