# Admin Elections - Failed to Fetch Error

**Date:** 2025-11-15  
**Component:** Admin Elections Interface  
**Severity:** High  
**Status:** RESOLVED

## Problem

Users experienced "Villa: Failed to fetch" errors when creating elections through the admin interface. The error occurred during the final POST request to submit election data.

## Root Cause

Fetch API has no default timeout. When network connections stall or slow down, requests hang indefinitely until the browser eventually aborts with a generic "Failed to fetch" error.

Cloud Logging analysis confirmed that POST requests never reached the backend, indicating client-side timeout issues rather than server problems.

## Solution

### Frontend (`apps/members-portal/admin-elections/js/election-create.js`)

Added robust error handling to election creation:

```javascript
// 30-second timeout using AbortController
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);

// Automatic retry logic (1 retry after 1s delay)
async function fetchWithRetry(url, options, maxRetries = 1) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (error) {
      if (attempt < maxRetries && error.name !== 'AbortError') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      throw error;
    }
  }
}

// User-friendly error messages in Icelandic
if (error.name === 'AbortError') {
  alert('Beiðni tók of langan tíma. Vinsamlegast reyndu aftur.');
} else if (error.message === 'Failed to fetch') {
  alert('Nettenging mistókst. Athugaðu nettenginguna þína.');
}
```

### Backend (`services/elections/src/middleware/rateLimiter.js`)

Fixed IPv6 validation warnings by creating shared key generator:

```javascript
const ipKeyGenerator = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip;
  return ip || 'unknown';
};
```

## Testing

All automated tests passed:
- ✅ Backend connectivity (2/2)
- ✅ Code modifications (4/4)
- ✅ JavaScript syntax (2/2)
- ✅ Documentation (3/3)

Production test successful:
- Election created successfully (ID: 518381aa-9670-4666-8810-f3b3d4543ccf)
- Response time: ~800ms
- Full CRUD cycle verified

## Impact

- **Network resilience:** Automatic recovery from transient network issues
- **User experience:** Clear error messages in Icelandic
- **Observability:** Enhanced logging with request context
- **Reliability:** 30-second timeout prevents indefinite hangs

## Deployment

```bash
# Backend
cd services/elections && ./deploy.sh

# Frontend
firebase deploy --only hosting
```

## Related Files

- Frontend: `apps/members-portal/admin-elections/js/election-create.js`
- Backend: `services/elections/src/middleware/rateLimiter.js`
- Tests: `scripts/bugfixes/2025-11-15-test-election-creation-fix.sh`

## Lessons Learned

1. **Always add timeouts to fetch requests** - Fetch API has no default timeout
2. **Retry logic is cheap insurance** - One retry catches most transient failures
3. **Cloud Logging is essential** - Helped confirm client vs server issues
4. **User-facing errors in native language** - Improves user experience significantly
