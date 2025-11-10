# Structured Logging Usage Guide

This document explains how to use the structured logger in Elections Service.

---

## Quick Start

```javascript
const logger = require('./utils/logger');

// Basic logging
logger.info('Server started', { port: 8081 });
logger.warn('High load detected', { requestCount: 1000 });
logger.error('Database connection failed', { error: err });

// With correlation ID (for request tracing)
logger.info('Vote recorded', {
  answer: 'yes',
  correlationId: req.correlationId,
  duration_ms: 45
});
```

---

## Log Levels

- **error**: System errors, failures
- **warn**: Warning conditions, degraded performance
- **info**: Normal operational messages
- **debug**: Detailed debugging information (not in production)

---

## PII Sanitization

The logger automatically sanitizes:

- ✅ **Kennitalas**: `123456-7890` → `[KENNITALA-REDACTED]`
- ✅ **Emails**: `user@gmail.com` → `[EMAIL-REDACTED]`
- ✅ **Phone numbers**: `555-1234` → `[PHONE-REDACTED]`
- ✅ **Token hashes**: `abc123...` → `[TOKEN-REDACTED]`
- ✅ **IP addresses**: `192.168.1.100` → `192.168.***.***`

**Example:**

```javascript
// This is safe - PII will be automatically sanitized
logger.info('User data', {
  name: 'Jón Jónsson',  // OK - public name
  kennitala: '010190-0000',  // ❌ Will be redacted
  email: 'user@example.com',  // ✅ @example.com is allowed
  email2: 'real@gmail.com',  // ❌ Will be redacted
});

// Output:
// {
//   name: 'Jón Jónsson',
//   kennitala: '[KENNITALA-REDACTED]',
//   email: 'user@example.com',
//   email2: '[EMAIL-REDACTED]',
// }
```

---

## Request-Scoped Logging

Use child loggers for request-specific logging:

```javascript
// In route handler
const requestLogger = logger.createChild({
  correlationId: crypto.randomUUID(),
  endpoint: req.path,
  method: req.method
});

requestLogger.info('Request started');
// ... processing ...
requestLogger.info('Request completed', { duration_ms: 123 });
```

---

## Migration from console.log

### Before:

```javascript
console.log('[S2S] Register token:', token_hash);
console.error('[Vote] Ballot submission error:', error);
console.warn('[Vote] Lock contention detected');
```

### After:

```javascript
logger.info('Token registered', {
  operation: 's2s_register_token',
  correlationId: correlation_id
});

logger.error('Ballot submission failed', {
  operation: 'record_ballot',
  error: error.message,
  stack: error.stack,
  correlationId: correlation_id
});

logger.warn('Lock contention detected', {
  operation: 'record_ballot',
  errorCode: '55P03'
});
```

---

## Google Cloud Logging Integration

In production (`NODE_ENV=production`), logs are automatically sent to Google Cloud Logging with:

- **Service name**: `elections-service`
- **Trace context**: Automatically added for request correlation
- **Labels**: `environment`, `version`
- **Structured JSON**: All logs queryable in Cloud Console

**Query examples in Cloud Console:**

```
# Find all errors
severity="ERROR"

# Find specific correlation ID
jsonPayload.correlationId="abc-123-def"

# Find slow requests
jsonPayload.duration_ms > 1000

# Find App Check failures
jsonPayload.operation="app_check_verification"
jsonPayload.success=false
```

---

## Best Practices

### ✅ DO:

```javascript
// Use structured data
logger.info('Vote recorded', { answer, correlationId, duration_ms });

// Include error context
logger.error('Database error', {
  error: err.message,
  stack: err.stack,
  query: 'SELECT ...',
  correlationId
});

// Use correlation IDs for request tracing
const correlationId = crypto.randomUUID();
logger.info('Request started', { correlationId });
```

### ❌ DON'T:

```javascript
// Don't use string concatenation
logger.info(`Vote recorded: ${answer}`);  // ❌ Not queryable

// Don't log token hashes (voter anonymity - Issue #128)
logger.info('Token used', { token_hash });  // ❌ Deanonymization risk

// Don't log raw errors without context
logger.error(err);  // ❌ Missing correlation ID
```

---

## Performance

- **Development**: Logs to console with colors
- **Production**: Async batched sending to Cloud Logging (non-blocking)
- **Overhead**: <1ms per log entry
- **Cost**: Free tier (500k log entries/month)

---

## Related

- **Issue #124**: Enhance Production Logging for Elections Service
- **Issue #128**: Voter Anonymity (no token_hash in logs)
- **Issue #240**: PII Prevention System

---

**Last Updated**: 2025-11-10
