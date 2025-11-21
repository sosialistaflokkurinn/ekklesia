# Bug Fix: Rate Limiter IPv6 Validation Errors

**Date:** 2025-11-16  
**Status:** ✅ Fixed and Deployed  
**Severity:** 🔴 Critical - Service startup errors, user-facing failures  
**Deployment:** elections-service-00022-b9g

---

## Summary

Elections service experienced ValidationError at every startup since Nov 15, causing intermittent failures for election creation. Fixed by removing custom keyGenerator and using express-rate-limit defaults with trust proxy enabled.

---

## Problem Description

### User Report (Nov 15, 2025 21:00-22:00 UTC)

**Reporter:** [REDACTED - superuser]

**Symptoms:**
- Attempted to create election "Besti sósíalistinn"
- Saw "býr til kosningu" popup briefly
- Was redirected to home page
- No election was created
- **NO ERROR shown to user** (silent failure)

**Expected Election Data:**
```
Heiti: Besti sósíalistinn
Spurning: Er [REDACTED] ekki bara besti sósíalistinn?
Tegund: Eitt val (single-choice)
Svarmöguleikar: Já auðvitað, Að sjálfsögðu dont be silly
Tímasetning: Strax eftir stofnun, 2 klukkustundir
Endar: 15. nóvember 2025 kl. 23:23
```

### Error Logs

**Timestamps of Validation Errors:**
- **2025-11-15 20:09:31 UTC** - Initial deployment (commit 0a24cdf)
- **2025-11-15 21:22:32 UTC** - During user's election creation attempt
- **2025-11-16 09:34:13 UTC** - Most recent before fix

**Error Message:**
```
ValidationError: Custom keyGenerator appears to use request IP 
without calling the ipKeyGenerator helper function for IPv6 addresses.

at Object.keyGeneratorIpFallback (/app/node_modules/express-rate-limit/dist/index.cjs:637:13)
at wrappedValidations.<computed> [as keyGeneratorIpFallback] (/app/node_modules/express-rate-limit/dist/index.cjs:680:22)
at parseOptions (/app/node_modules/express-rate-limit/dist/index.cjs:750:16)
at rateLimit (/app/node_modules/express-rate-limit/dist/index.cjs:831:18)
at Object.<anonymous> (/app/src/middleware/rateLimiter.js:48:22)
```

**Affected Rate Limiters:**
- Line 28: `readLimiter`
- Line 48: `writeLimiter`
- Line 67: `voteLimiter`
- Line 92: `adminLimiter`

All rate limiters failed validation at module load time.

---

## Root Cause

### The "Fix" That Broke It

**Commit:** 0a24cdf (Nov 15, 2025)  
**Title:** fix(admin-elections): resolve "Failed to fetch" error with timeout and retry logic

This commit attempted to fix rate limiter IPv6 handling by creating a custom `ipKeyGenerator`:

```javascript
// BROKEN CODE (commit 0a24cdf)
const ipKeyGenerator = (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
  return ip;
};

// Used in all rate limiters:
const readLimiter = rateLimit({
  // ...
  keyGenerator: ipKeyGenerator  // ❌ Validation fails!
});
```

### Why It Failed

express-rate-limit v7.5.1 requires custom key generators to:
1. Call the built-in `ipKeyGenerator()` helper for IPv6 normalization
2. Follow specific validation rules to prevent IPv6 bypass vulnerabilities

**From express-rate-limit docs:**
```javascript
// CORRECT way (what we should have done):
const { ipKeyGenerator } = require('express-rate-limit');

const customKeyGen = (req) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  return ipKeyGenerator(req, { ip }); // ✅ Use helper!
};
```

Our custom function returned the IP directly without calling the helper, triggering validation errors.

---

## Solution

**Approach:** Remove custom keyGenerator entirely, use express-rate-limit defaults

### Changes Made

#### 1. Remove Custom keyGenerator (rateLimiter.js)

**Before:**
```javascript
const ipKeyGenerator = (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
  return ip;
};

const readLimiter = rateLimit({
  // ...
  keyGenerator: ipKeyGenerator
});
```

**After:**
```javascript
// No custom keyGenerator defined

const readLimiter = rateLimit({
  // ...
  // Uses default keyGenerator (req.ip) - IPv6 handled automatically
});
```

#### 2. Enable Trust Proxy (index.js)

**Added:**
```javascript
const app = express();

// Trust proxy - Required for Cloud Run to correctly populate req.ip from X-Forwarded-For
app.set('trust proxy', true);
```

### Why This Works

1. **express-rate-limit's default keyGenerator uses `req.ip`**
2. **Express populates `req.ip` from X-Forwarded-For when trust proxy enabled**
3. **Built-in keyGenerator handles IPv6 normalization automatically**
4. **No custom code = no validation errors**

---

## Testing & Verification

### Pre-Deployment Testing

**Local Test:**
```bash
cd services/elections
node src/index.js
```

**Result:** ✅ No validation errors, server starts successfully

### Post-Deployment Verification

**Deployment:** elections-service-00022-b9g (Nov 16, 2025 09:48 UTC)

**Health Check:**
```bash
curl https://elections-service-521240388393.europe-west2.run.app/health
```

**Result:**
```json
{
  "status": "healthy",
  "service": "elections-service",
  "version": "1.0.0",
  "timestamp": "2025-11-16T09:50:09.599Z",
  "environment": "production"
}
```

**Error Logs Check:**
```bash
gcloud logging read "resource.labels.service_name=elections-service AND \
resource.labels.revision_name=elections-service-00022-b9g AND \
severity>=ERROR" --limit=20
```

**Result:** ✅ **NO ERRORS** - Rate limiter fix successful!

---

## Impact Assessment

### User Impact

| Aspect | Impact | Status |
|--------|--------|--------|
| **Election Creation** | ❌ Failed for [REDACTED user] (Nov 15, 21:22 UTC) | ✅ Fixed |
| **Service Availability** | ⚠️ Intermittent errors during restarts | ✅ Stable |
| **User Experience** | ⛔ Silent failure (no error shown) | ✅ Would show error with current frontend |
| **Data Loss** | ✅ None (election never created) | N/A |
| **Security** | ✅ No breach (availability issue only) | N/A |

### Timeline

| Time (UTC) | Event | Status |
|------------|-------|--------|
| 2025-11-15 20:09:31 | Initial deployment with broken fix (0a24cdf) | ❌ |
| 2025-11-15 21:22:32 | User attempted election creation, failed | ❌ |
| 2025-11-16 09:34:13 | Most recent validation error | ❌ |
| 2025-11-16 09:48:22 | Fixed deployment (ef5c487) | ✅ |
| 2025-11-16 09:50:09 | Health check confirmed stable | ✅ |

---

## Related Issues & Commits

### Commits

- **ef5c487** (Nov 16, 2025) - fix(elections): Fix rate limiter IPv6 validation errors ✅
- **0a24cdf** (Nov 15, 2025) - fix(admin-elections): resolve "Failed to fetch" error (CAUSED THE BUG) ❌
- **c17b430** (Nov 15, 2025) - chore(gitignore): Remove personal patterns

### Issues

- **Issue #276** - Rate limiter IPv6 warnings (documented pattern)
- **User Report** - [REDACTED user] election creation failure (Nov 15)

### Investigation Reports

- `/tmp/2025-11-15-election-creation-silent-failure-investigation.md` - Initial investigation
- `/tmp/rate-limiter-fix-analysis.md` - Root cause analysis

---

## Lessons Learned

1. **express-rate-limit v7+ has strict validation** - Custom keyGenerators must call helper functions
2. **Trust proxy is essential for Cloud Run** - Express needs this to populate req.ip correctly
3. **Default implementations are often better** - Built-in keyGenerator handles IPv6 automatically
4. **Test deployments immediately** - Validation errors happened at startup, not during traffic
5. **Silent failures are critical UX bugs** - Frontend should always show errors to users

---

## Prevention Measures

### For Future Rate Limiter Changes

1. ✅ **Use default keyGenerator** - Only customize if absolutely necessary
2. ✅ **Enable trust proxy** - Required for Cloud Run deployments
3. ✅ **Test locally first** - Verify server starts without errors
4. ✅ **Check startup logs** - Validation errors appear immediately
5. ✅ **Read library docs** - express-rate-limit v7 has specific requirements

### For User Experience

1. ✅ **Frontend error handling** - Always show errors to users (already fixed in commit 0a24cdf)
2. ✅ **Retry logic** - Help users recover from transient failures (already implemented)
3. ✅ **Health check integration** - Consider checking backend health before critical operations

---

## Status

**Fix Status:** ✅ Deployed and Verified (elections-service-00022-b9g)  
**Error Rate:** 0% (no validation errors in new revision)  
**Service Health:** Stable  
**User Impact:** Resolved

**Follow-up:** Monitor Cloud Logs for 48 hours to confirm no recurrence.

---

**Author:** GitHub Copilot  
**Reviewer:** [REDACTED]  
**Date:** 2025-11-16
