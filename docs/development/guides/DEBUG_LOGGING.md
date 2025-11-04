# Ekklesia Debug Logging System

**Purpose**: Comprehensive debugging setup for Ekklesia development with AI assistant integration

**Status**: ✅ Fully configured and ready to use
**Last Updated**: 2025-10-30

---

## Quick Start

### 1. Enable Debug Mode

**In Browser Console:**
```javascript
// Enable debug logging
EkklesiaDebug.enable();

// Reload page
location.reload();

// Disable when done
EkklesiaDebug.disable();
```

**OR via URL:**
```
https://ekklesia-prod-10-2025.web.app/members-area/dashboard.html?debug=true
```

### 2. View Structured Logs

All Ekklesia logs are prefixed with `[EKKLESIA:namespace]` for easy filtering:

```
🔍 [EKKLESIA:dashboard] {
  timestamp: "2025-10-30T09:28:00.123Z",
  sessionId: "1730282880123-abc123def",
  namespace: "dashboard",
  level: "DEBUG",
  event: "phone_comparison",
  url: "https://ekklesia-prod-10-2025.web.app/members-area/dashboard.html",
  raw_kenni: "+3547758493",
  raw_members: "7758493",
  normalized_kenni: "7758493",
  normalized_members: "7758493",
  match: true
}
```

---

## Architecture

### Components

1. **Debug Logger** (`js/utils/debug.js`)
   - Structured logging with namespaces
   - Automatic session tracking
   - Remote logging capability
   - Console filtering

2. **Chrome Remote Debugging** (Port 9222)
   - Real-time console monitoring
   - Network request inspection
   - JavaScript execution

3. **CDP Monitor Script** (`scripts/chrome_console_monitor.py`)
   - Python-based console listener
   - Filters and formats logs
   - Writes to file or stdout

4. **MCP Integration** (Optional)
   - Claude Desktop integration
   - Direct browser interaction
   - Automated debugging

---

## Usage Examples

### Basic Logging

```javascript
import { DebugLogger } from './utils/debug.js';

const debug = DebugLogger.create('my-module');

// Info log
debug.log('user_action', { action: 'click', target: 'submit-button' });

// Warning
debug.warn('validation_failed', { field: 'email', value: 'invalid' });

// Error
try {
  throw new Error('API failed');
} catch (error) {
  debug.error('api_error', error, { endpoint: '/api/members' });
}

// Debug (only when debug mode enabled)
debug.debug('function_called', { args: { id: 123 } });

// Success
debug.success('save_completed', { recordId: 456 });
```

### Performance Timing

```javascript
const endTimer = debug.time('expensive_operation');

// Do expensive work
await processLargeDataset();

endTimer(); // Logs duration in ms
```

### Function Tracing

```javascript
async function loadMemberData(memberId) {
  const endTrace = debug.trace('loadMemberData', { memberId });

  try {
    const data = await fetchMember(memberId);
    return data;
  } finally {
    endTrace();
  }
}
```

### Grouped Logs

```javascript
debug.group('Profile Comparison', () => {
  debug.log('comparing_email', { kenni: email1, members: email2 });
  debug.log('comparing_phone', { kenni: phone1, members: phone2 });
  debug.log('comparing_name', { kenni: name1, members: name2 });
});
```

---

## Monitoring Console Logs (Claude Code Integration)

### Method 1: Chrome Remote Debugging + CDP Monitor

**Step 1: Start Chrome with debugging**
```bash
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug
```

**Step 2: Navigate to Ekklesia**
- Open: https://ekklesia-prod-10-2025.web.app/members-area/dashboard.html?debug=true

**Step 3: Start CDP Monitor**
```bash
cd ~/Development/projects/ekklesia
python3 scripts/chrome_console_monitor.py

# OR filter for Ekklesia logs only
python3 scripts/chrome_console_monitor.py --filter "EKKLESIA"

# OR save to file
python3 scripts/chrome_console_monitor.py --output /tmp/ekklesia-console.log
```

**Step 4: Claude Code reads logs**
```bash
# Real-time monitoring
tail -f /tmp/ekklesia-console.log

# Search for specific events
grep "phone_comparison" /tmp/ekklesia-console.log
```

### Method 2: MCP Integration (Advanced)

**Prerequisites:**
- Claude Desktop installed
- MCP server configured (see `.claude/mcp-chrome-devtools.md`)

**Usage in Claude Code:**
```
You: Can you check the Ekklesia console logs for phone comparison?

Claude: Using chrome_get_console_logs with filter="phone_comparison"...
[Shows structured log entries]
```

### Method 3: Cloud Logging

**View in Google Cloud:**
```bash
gcloud logging read "textPayload=~'EKKLESIA'" \
  --limit=50 \
  --project=ekklesia-prod-10-2025 \
  --format=json | jq
```

---

## Debug Namespaces

Current namespaces in use:

| Namespace | Location | Purpose |
|-----------|----------|---------|
| `dashboard` | `js/dashboard.js` | Dashboard page logic |
| `profile` | `js/profile.js` | Profile page logic |
| `auth` | `session/auth.js` | Authentication flows |
| `api` | `utils/api.js` | API client requests |
| `admin` | `admin/js/admin.js` | Admin portal logic |

**Adding new namespace:**
```javascript
import { DebugLogger } from './utils/debug.js';
const debug = DebugLogger.create('my-new-module');
```

---

## Best Practices

### ✅ DO

- Use structured data (objects) for all log data
- Include relevant context (user ID, operation, etc.)
- Use appropriate log levels (debug < log < warn < error)
- Add debug logging before complex operations
- Use `debug.debug()` for verbose logs (auto-filtered in production)

### ❌ DON'T

- Log sensitive data (passwords, full kennitalas, tokens)
- Use `console.log()` directly (use DebugLogger instead)
- Log in tight loops (use sampling or aggregation)
- Leave debug mode enabled in production
- Commit code with `?debug=true` in URLs

### Privacy

**Safe to log:**
- ✅ User roles (admin, member, superuser)
- ✅ Event names and types
- ✅ Operation status (success, failed)
- ✅ Partial kennitala (first 6 digits only)
- ✅ Phone numbers formatted for comparison

**NEVER log:**
- ❌ Full kennitalas (010300-3390) → Use masked version (010300-****)
- ❌ Passwords or tokens
- ❌ Email addresses in error messages
- ❌ Personal health information

---

## Troubleshooting

### Debug Logs Not Showing

1. Check if debug mode is enabled:
   ```javascript
   EkklesiaDebug.isEnabled()
   ```

2. Verify localStorage:
   ```javascript
   localStorage.getItem('EKKLESIA_DEBUG')
   ```

3. Clear and re-enable:
   ```javascript
   EkklesiaDebug.disable();
   EkklesiaDebug.enable();
   location.reload();
   ```

### CDP Monitor Not Connecting

```bash
# Check Chrome is running with debugging
curl http://localhost:9222/json

# Should return JSON with tabs list

# If not, restart Chrome:
pkill -f "chrome.*remote-debugging"
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug
```

### No Logs in Console

1. Open DevTools Console (F12)
2. Check Console filter (should not filter out logs)
3. Try: `EkklesiaDebug.isEnabled()`
4. Force enable: `EkklesiaDebug.enable()` → reload

---

## Related Documentation

- [Chrome Remote Debugging Setup](./CHROME_REMOTE_DEBUGGING.md)
- [MCP Chrome DevTools Config](../../../.claude/mcp-chrome-devtools.md)
- [CDP Monitor Script Usage](../../../scripts/chrome_console_monitor.py)

---

## Examples from Production Code

### Dashboard Phone Comparison
```javascript
// From: apps/members-portal/js/dashboard.js
const kenniPhone = normalizePhoneForComparison(userData.phoneNumber);
const membersPhone = normalizePhoneForComparison(memberProfile.phone);

debug.debug('phone_comparison', {
  raw_kenni: userData.phoneNumber,
  raw_members: memberProfile.phone,
  normalized_kenni: kenniPhone,
  normalized_members: membersPhone,
  match: kenniPhone === membersPhone
});
```

### Expected Console Output
```
🔍 [EKKLESIA:dashboard] {
  timestamp: "2025-10-30T09:28:15.234Z",
  sessionId: "1730282895234-xyz789abc",
  namespace: "dashboard",
  level: "DEBUG",
  event: "phone_comparison",
  url: "https://ekklesia-prod-10-2025.web.app/members-area/dashboard.html",
  raw_kenni: "+3547758493",
  raw_members: "775-8493",
  normalized_kenni: "7758493",
  normalized_members: "7758493",
  match: true
}
```

---

**Status**: ✅ Ready to use
**Action**: Enable debug mode and start developing!
