# Cloudflare Bypass Protection - Direct URL Attack Mitigation

**Document Type**: Security Analysis & Mitigation
**Created**: 2025-10-12
**Status**: 🔴 CRITICAL - Must Implement Before Production Use
**Related**: Issue #31 (Rate Limiting), SECURITY_HARDENING_PLAN.md

---

## The Problem: Cloudflare Can Be Bypassed

### Attack Surface

When you set up Cloudflare DNS with custom domains, you create these mappings:

```
Custom Domains (Protected by Cloudflare):
✅ https://auth.sosialistaflokkurinn.is → handlekenniauth
✅ https://verify.sosialistaflokkurinn.is → verifymembership
✅ https://api.sosialistaflokkurinn.is → events-service
✅ https://vote.sosialistaflokkurinn.is → elections-service
```

**BUT** the original Cloud Run URLs are still publicly accessible:

```
Direct URLs (NOT Protected by Cloudflare):
❌ https://handlekenniauth-521240388393.europe-west2.run.app
❌ https://verifymembership-521240388393.europe-west2.run.app
❌ https://events-service-521240388393.europe-west2.run.app
❌ https://elections-service-521240388393.europe-west2.run.app
```

### Why This Is a Problem

**Cloudflare only protects traffic that goes through Cloudflare.** If an attacker discovers the direct Cloud Run URLs, they can:

1. **Bypass rate limiting** - Hit direct URLs unlimited times
2. **Bypass DDoS protection** - Direct connection to your GCP resources
3. **Bypass WAF rules** - No web application firewall filtering
4. **Bypass bot detection** - No Cloudflare challenge pages

### How Attackers Discover Direct URLs

The direct URLs are **not secret**:

1. **DNS Resolution**: Anyone can resolve the custom domain and see the CNAME target
   ```bash
   dig auth.sosialistaflokkurinn.is CNAME
   # Returns: handlekenniauth-521240388393.europe-west2.run.app
   ```

2. **HTTP Headers**: Cloud Run adds identifying headers
   ```bash
   curl -I https://auth.sosialistaflokkurinn.is
   # May include: X-Cloud-Trace-Context, X-Forwarded-For
   ```

3. **SSL Certificates**: Certificate may reveal origin server
   ```bash
   openssl s_client -connect auth.sosialistaflokkurinn.is:443
   # Shows: CN=*.run.app
   ```

4. **Public Documentation**: GitHub repos, documentation may reference direct URLs

**Conclusion**: You must assume attackers can find the direct URLs.

---

## The Solution: Origin Server Protection

### Strategy: Make Cloud Run Services Reject Direct Access

The solution is to configure Cloud Run services to **only accept traffic from Cloudflare**, and reject all other traffic.

### Implementation Options

#### Option 1: Ingress Control (Recommended - Easiest)

**Make services internal-only**, then use Cloudflare as the public ingress point.

**Limitation**: Cloud Run does not support "only allow from specific IPs" directly. You must use one of these approaches:

##### Approach A: Cloud Run + Cloud Armor (NOT FREE)

```bash
# Create security policy (requires Cloud Load Balancer)
gcloud compute security-policies create cloudflare-only \
  --project ekklesia-prod-10-2025

# Allow only Cloudflare IP ranges
gcloud compute security-policies rules create 1000 \
  --security-policy cloudflare-only \
  --expression "inIpRange(origin.ip, '173.245.48.0/20') || inIpRange(origin.ip, '103.21.244.0/22') || ..." \
  --action "allow"

# Deny all other IPs
gcloud compute security-policies rules create 2000 \
  --security-policy cloudflare-only \
  --expression "true" \
  --action "deny-403"
```

**Cost**: $0.75/month + $0.0075/million requests
**Limitation**: Requires Cloud Load Balancer ($18/month), **NOT cost-effective**

##### Approach B: Application-Level IP Allowlist (Recommended - Free)

Add middleware to each Cloud Run service to check the source IP against Cloudflare's IP ranges.

**Cost**: $0 (code change only)
**Effort**: 2-3 hours (implement once, reuse across all services)

---

### Implementation: Application-Level Protection

#### Step 1: Get Cloudflare IP Ranges

Cloudflare publishes their IP ranges at: https://www.cloudflare.com/ips/

```bash
# Download Cloudflare IP ranges
curl https://www.cloudflare.com/ips-v4 > cloudflare-ips-v4.txt
curl https://www.cloudflare.com/ips-v6 > cloudflare-ips-v6.txt
```

**Current Cloudflare IP Ranges** (as of Oct 2025):
```
173.245.48.0/20
103.21.244.0/22
103.22.200.0/22
103.31.4.0/22
141.101.64.0/18
108.162.192.0/18
190.93.240.0/20
188.114.96.0/20
197.234.240.0/22
198.41.128.0/17
162.158.0.0/15
104.16.0.0/13
104.24.0.0/14
172.64.0.0/13
131.0.72.0/22
2400:cb00::/32
2606:4700::/32
2803:f800::/32
2405:b500::/32
2405:8100::/32
2a06:98c0::/29
2c0f:f248::/32
```

#### Step 2: Add IP Allowlist Middleware

##### For Node.js Services (events-service, elections-service)

**File**: `shared/middleware/cloudflare-check.js` (create new file)

```javascript
/**
 * Cloudflare Origin Protection Middleware
 *
 * Ensures requests only come from Cloudflare proxy servers.
 * Rejects direct access to Cloud Run URLs.
 *
 * Security: Rate limiting and DDoS protection only work if traffic
 * goes through Cloudflare. This middleware prevents bypass attacks.
 */

const CLOUDFLARE_IPV4_RANGES = [
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
  '131.0.72.0/22',
];

const CLOUDFLARE_IPV6_RANGES = [
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
];

/**
 * Check if IP is in CIDR range
 */
function ipInCIDR(ip, cidr) {
  const [range, bits] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits)) - 1);

  const ipNum = ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
  const rangeNum = range.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;

  return (ipNum & mask) === (rangeNum & mask);
}

/**
 * Check if IPv6 is in CIDR range (simplified)
 */
function ipv6InCIDR(ip, cidr) {
  // For IPv6, use simple prefix matching for now
  const [prefix, bits] = cidr.split('/');
  const prefixGroups = Math.ceil(parseInt(bits) / 16);

  const ipGroups = ip.split(':').slice(0, prefixGroups);
  const rangeGroups = prefix.split(':').slice(0, prefixGroups);

  return ipGroups.join(':') === rangeGroups.join(':');
}

/**
 * Middleware: Only allow requests from Cloudflare
 */
function requireCloudflare(options = {}) {
  const {
    enableBypass = process.env.NODE_ENV === 'development',
    bypassHeader = 'X-Bypass-Cloudflare-Check',
    bypassSecret = process.env.CLOUDFLARE_BYPASS_SECRET,
  } = options;

  return (req, res, next) => {
    // Development bypass (for local testing)
    if (enableBypass && req.headers[bypassHeader.toLowerCase()] === bypassSecret) {
      console.log('⚠️  Cloudflare check bypassed (development mode)');
      return next();
    }

    // Get client IP (Cloudflare sets CF-Connecting-IP header)
    const cloudflareIP = req.headers['cf-connecting-ip'];
    const forwardedFor = req.headers['x-forwarded-for'];
    const clientIP = cloudflareIP || (forwardedFor ? forwardedFor.split(',')[0].trim() : req.ip);

    if (!clientIP) {
      console.error('❌ No client IP found, rejecting request');
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Direct access not allowed. Please use the official domain.',
      });
    }

    // Check if IP is from Cloudflare
    const isIPv6 = clientIP.includes(':');
    const ranges = isIPv6 ? CLOUDFLARE_IPV6_RANGES : CLOUDFLARE_IPV4_RANGES;
    const checkFn = isIPv6 ? ipv6InCIDR : ipInCIDR;

    const isCloudflare = ranges.some(range => {
      try {
        return checkFn(clientIP, range);
      } catch (err) {
        console.error(`Error checking IP ${clientIP} against range ${range}:`, err);
        return false;
      }
    });

    if (!isCloudflare) {
      console.warn(`⚠️  Blocked direct access from non-Cloudflare IP: ${clientIP}`);
      console.warn(`   Request: ${req.method} ${req.path}`);
      console.warn(`   User-Agent: ${req.headers['user-agent']}`);

      return res.status(403).json({
        error: 'Forbidden',
        message: 'Direct access not allowed. Please use https://api.sosialistaflokkurinn.is or https://vote.sosialistaflokkurinn.is',
      });
    }

    // IP is from Cloudflare, allow request
    console.log(`✅ Request from Cloudflare IP: ${clientIP}`);
    next();
  };
}

module.exports = { requireCloudflare };
```

**Usage in events-service**:

```javascript
// events/src/index.js
const express = require('express');
const { requireCloudflare } = require('./middleware/cloudflare-check');

const app = express();

// Apply Cloudflare protection to all routes (except health check)
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Protect all other routes
app.use(requireCloudflare({
  enableBypass: process.env.NODE_ENV === 'development',
  bypassSecret: process.env.CLOUDFLARE_BYPASS_SECRET,
}));

// Your API routes (now protected)
app.get('/api/election', ...);
app.post('/api/request-token', ...);
```

**Usage in elections-service**:

```javascript
// elections/src/index.js
const express = require('express');
const { requireCloudflare } = require('./middleware/cloudflare-check');

const app = express();

// Health check (no protection)
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Protect all other routes
app.use(requireCloudflare({
  enableBypass: process.env.NODE_ENV === 'development',
  bypassSecret: process.env.CLOUDFLARE_BYPASS_SECRET,
}));

// S2S endpoints (protected - must come from Cloudflare)
app.post('/api/s2s/register-token', ...);
app.get('/api/s2s/results', ...);

// Public voting endpoint (protected)
app.post('/api/vote', ...);
```

##### For Python Cloud Functions (handlekenniauth, verifymembership)

**File**: `members/functions/cloudflare_check.py` (create new file)

```python
"""
Cloudflare Origin Protection for Cloud Functions

Ensures requests only come from Cloudflare proxy servers.
Rejects direct access to Cloud Function URLs.
"""

import ipaddress
import os
from typing import List
from flask import Request, jsonify

CLOUDFLARE_IPV4_RANGES = [
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
    '131.0.72.0/22',
]

CLOUDFLARE_IPV6_RANGES = [
    '2400:cb00::/32',
    '2606:4700::/32',
    '2803:f800::/32',
    '2405:b500::/32',
    '2405:8100::/32',
    '2a06:98c0::/29',
    '2c0f:f248::/32',
]


def is_cloudflare_ip(ip: str) -> bool:
    """Check if IP address is from Cloudflare"""
    try:
        ip_obj = ipaddress.ip_address(ip)

        # Check appropriate ranges based on IP version
        if ip_obj.version == 4:
            ranges = [ipaddress.ip_network(r) for r in CLOUDFLARE_IPV4_RANGES]
        else:
            ranges = [ipaddress.ip_network(r) for r in CLOUDFLARE_IPV6_RANGES]

        return any(ip_obj in network for network in ranges)

    except ValueError:
        print(f"ERROR: Invalid IP address: {ip}")
        return False


def require_cloudflare(req: Request, allow_bypass: bool = True):
    """
    Decorator/middleware to require requests from Cloudflare

    Args:
        req: Flask request object
        allow_bypass: Allow bypass in development mode

    Returns:
        None if check passes, otherwise returns 403 response
    """
    # Development bypass
    if allow_bypass and os.getenv('NODE_ENV') == 'development':
        bypass_secret = os.getenv('CLOUDFLARE_BYPASS_SECRET')
        if req.headers.get('X-Bypass-Cloudflare-Check') == bypass_secret:
            print("⚠️  Cloudflare check bypassed (development mode)")
            return None

    # Get client IP (Cloudflare sets CF-Connecting-IP)
    cloudflare_ip = req.headers.get('CF-Connecting-IP')
    forwarded_for = req.headers.get('X-Forwarded-For')
    client_ip = cloudflare_ip or (forwarded_for.split(',')[0].strip() if forwarded_for else req.remote_addr)

    if not client_ip:
        print("❌ No client IP found, rejecting request")
        return jsonify({
            'error': 'Forbidden',
            'message': 'Direct access not allowed. Please use the official domain.'
        }), 403

    # Check if IP is from Cloudflare
    if not is_cloudflare_ip(client_ip):
        print(f"⚠️  Blocked direct access from non-Cloudflare IP: {client_ip}")
        print(f"   Request: {req.method} {req.path}")
        print(f"   User-Agent: {req.headers.get('User-Agent', 'N/A')}")

        return jsonify({
            'error': 'Forbidden',
            'message': 'Direct access not allowed. Please use https://auth.sosialistaflokkurinn.is'
        }), 403

    # IP is from Cloudflare, allow request
    print(f"✅ Request from Cloudflare IP: {client_ip}")
    return None
```

**Usage in handlekenniauth**:

```python
# members/functions/main.py
from firebase_functions import https_fn
from cloudflare_check import require_cloudflare

@https_fn.on_request()
def handleKenniAuth(req: https_fn.Request):
    # Check Cloudflare origin first
    cloudflare_check = require_cloudflare(req, allow_bypass=True)
    if cloudflare_check:
        return cloudflare_check  # Return 403 response

    # Rest of your OAuth logic
    if req.method != 'POST':
        return https_fn.Response(
            json.dumps({'error': 'Method not allowed'}),
            status=405
        )

    # ... existing code ...
```

**Usage in verifymembership**:

```python
# members/functions/main.py
@https_fn.on_request()
def verifyMembership(req: https_fn.Request):
    # Check Cloudflare origin first
    cloudflare_check = require_cloudflare(req, allow_bypass=True)
    if cloudflare_check:
        return cloudflare_check  # Return 403 response

    # Rest of your membership verification logic
    # ... existing code ...
```

---

### Testing the Protection

#### Test 1: Direct URL Should Be Blocked

```bash
# Try to access service directly (should get 403)
curl -X POST https://events-service-521240388393.europe-west2.run.app/api/request-token \
  -H "Authorization: Bearer fake-token" \
  -H "Content-Type: application/json"

# Expected response:
# {
#   "error": "Forbidden",
#   "message": "Direct access not allowed. Please use https://api.sosialistaflokkurinn.is"
# }
```

#### Test 2: Cloudflare URL Should Work

```bash
# Access via Cloudflare domain (should work)
curl -X POST https://api.sosialistaflokkurinn.is/api/request-token \
  -H "Authorization: Bearer fake-token" \
  -H "Content-Type: application/json"

# Expected: Normal API response
```

#### Test 3: Development Bypass

```bash
# Set bypass secret in .env
CLOUDFLARE_BYPASS_SECRET=supersecretdevkey123

# Use bypass header for local testing
curl -X POST http://localhost:8080/api/request-token \
  -H "X-Bypass-Cloudflare-Check: supersecretdevkey123" \
  -H "Authorization: Bearer fake-token"

# Expected: Normal API response (bypass works)
```

---

## Alternative: Make Services Private

### Option 2: Cloud Run Ingress Settings (Partial Protection)

You can configure Cloud Run to only accept requests from specific sources:

```bash
# Option A: Allow only Cloud Load Balancer + internal (NOT USEFUL for Cloudflare)
gcloud run services update events-service \
  --ingress=internal-and-cloud-load-balancing \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025

# Option B: Allow only internal traffic (BREAKS public access)
gcloud run services update events-service \
  --ingress=internal \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025
```

**Limitation**: Cloudflare is NOT a Cloud Load Balancer, so option A doesn't help. Option B blocks ALL public traffic, which breaks the service entirely.

**Conclusion**: Ingress settings alone cannot protect against Cloudflare bypass. You must use application-level IP filtering.

---

## Maintenance

### Updating Cloudflare IP Ranges

Cloudflare occasionally adds new IP ranges. You should:

1. **Check for updates monthly**:
   ```bash
   curl https://www.cloudflare.com/ips-v4
   curl https://www.cloudflare.com/ips-v6
   ```

2. **Compare with your code**:
   - If new ranges are added, update the middleware/decorator
   - Redeploy services with updated IP ranges

3. **Subscribe to Cloudflare announcements**:
   - https://www.cloudflare.com/ips/
   - Cloudflare usually announces IP range changes weeks in advance

### Automation (Optional)

You can automate IP range updates:

```javascript
// shared/scripts/update-cloudflare-ips.js
const https = require('https');
const fs = require('fs');

function fetchIPs(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data.trim().split('\n')));
    }).on('error', reject);
  });
}

async function updateCloudflareIPs() {
  const ipv4 = await fetchIPs('https://www.cloudflare.com/ips-v4');
  const ipv6 = await fetchIPs('https://www.cloudflare.com/ips-v6');

  const code = `
// Auto-generated on ${new Date().toISOString()}
const CLOUDFLARE_IPV4_RANGES = ${JSON.stringify(ipv4, null, 2)};
const CLOUDFLARE_IPV6_RANGES = ${JSON.stringify(ipv6, null, 2)};
`;

  fs.writeFileSync('shared/config/cloudflare-ips.js', code);
  console.log('✅ Cloudflare IP ranges updated');
}

updateCloudflareIPs().catch(console.error);
```

Run monthly:
```bash
node shared/scripts/update-cloudflare-ips.js
```

---

## Summary

### The Attack

❌ **Without IP filtering**: Attackers can bypass Cloudflare by hitting direct Cloud Run URLs
- No rate limiting
- No DDoS protection
- No WAF filtering

### The Solution

✅ **With IP filtering middleware**: Services only accept traffic from Cloudflare
- Direct URLs return 403 Forbidden
- All traffic forced through Cloudflare
- Rate limiting + DDoS protection enforced

### Implementation Checklist

- [ ] Create `shared/middleware/cloudflare-check.js` (Node.js)
- [ ] Create `members/functions/cloudflare_check.py` (Python)
- [ ] Add middleware to events-service
- [ ] Add middleware to elections-service
- [ ] Add decorator to handlekenniauth
- [ ] Add decorator to verifymembership
- [ ] Set `CLOUDFLARE_BYPASS_SECRET` in .env (development)
- [ ] Test direct URL access (should get 403)
- [ ] Test Cloudflare URL access (should work)
- [ ] Deploy updated services
- [ ] Document IP range update process
- [ ] Set calendar reminder to check IP ranges monthly

### Cost

- **Implementation**: 2-3 hours (one-time)
- **Monthly cost**: $0 (code change only)
- **Maintenance**: 15 minutes/month (check IP range updates)

### Next Steps

1. Implement middleware/decorator (this document)
2. Set up Cloudflare DNS (see CLOUDFLARE_SETUP_PLAN.md)
3. Configure rate limiting rules in Cloudflare dashboard
4. Update application URLs to use custom domains
5. Deploy and test

---

**Document Version**: 1.0
**Last Updated**: 2025-10-12
**Status**: 🔴 CRITICAL - Must implement before production use
**Related**: Issue #31, SECURITY_HARDENING_PLAN.md, CLOUDFLARE_SETUP_PLAN.md
