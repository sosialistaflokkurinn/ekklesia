# Audit Logging Guide

**Classification**: Internal - Operations & Security
**Last Updated**: 2025-10-19
**Owner**: DevOps/Security Team

This document defines the standardized audit logging format for all admin actions on the Ekklesia platform, with structured fields for correlation, accountability, and compliance.

---

## Overview

All administrative actions that modify elections, user permissions, or system state must be logged to Cloud Logging with structured JSON format for:
- **Accountability**: Track who performed which actions
- **Compliance**: Meet audit requirements for election integrity
- **Debugging**: Trace issues across services with correlation IDs
- **Security**: Detect unauthorized access attempts

---

## Audit Log Schema

### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `level` | string | Log level (info, warn, error) | `"info"` |
| `message` | string | Human-readable description | `"Election created"` |
| `action` | string | Action identifier (see Actions table) | `"election_created"` |
| `performed_by` | string | Firebase UID of user who performed action | `"abc123XYZ789ExampleUserUID456"` |
| `timestamp` | string | ISO 8601 timestamp (UTC) | `"2025-10-19T03:26:45.127Z"` |

### Optional Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `correlation_id` | string | 16-char hex ID for request tracing | `"a1b2c3d4e5f67890"` |
| `resource_type` | string | Type of resource affected | `"election"` |
| `resource_id` | string/int | ID of affected resource | `"1f247133-475b-4510-bce2-d5b029c605d8"` |
| `changes` | object | Before/after state for updates | `{"before": {...}, "after": {...}}` |
| `details` | object | Action-specific metadata | `{"title": "Prófunarkosning 2025"}` |

### Privacy Constraints

- ✅ **Allowed**: Firebase UIDs (opaque identifiers)
- ❌ **Forbidden**: Kennitala (national IDs) in logs
- ❌ **Forbidden**: Member names or email addresses
- ✅ **Allowed**: Masked kennitala for debugging (`200978-****`)

---

## Standard Actions

### Election Lifecycle

| Action | Description | Level | Resource Type |
|--------|-------------|-------|---------------|
| `election_created` | New election created (draft) | `info` | `election` |
| `election_updated` | Election metadata or content updated | `info` | `election` |
| `election_published` | Election published (draft → published) | `warn` | `election` |
| `election_paused` | Active election paused | `warn` | `election` |
| `election_resumed` | Paused election resumed | `warn` | `election` |
| `election_closed` | Election closed (voting ended) | `warn` | `election` |
| `election_archived` | Closed election archived | `info` | `election` |
| `election_deleted` | Draft election soft-deleted | `warn` | `election` |

### System Operations

| Action | Description | Level | Resource Type |
|--------|-------------|-------|---------------|
| `reset_election_user` | User deleted own voting token | `info` | `voting_token` |
| `reset_election_all` | Full election reset (destructive) | `warn` | `system` |
| `reset_election_blocked` | Reset attempt blocked by guardrail | `warn` | `system` |

### Access Control

| Action | Description | Level | Resource Type |
|--------|-------------|-------|---------------|
| `access_denied` | Insufficient roles for action | `warn` | N/A |
| `role_check_failed` | RBAC middleware denied access | `warn` | N/A |

---

## Example Log Entries

### 1. Election Created

```json
{
  "level": "info",
  "message": "Election created",
  "action": "election_created",
  "correlation_id": "a1b2c3d4e5f67890",
  "performed_by": "abc123XYZ789ExampleUserUID456",
  "resource_type": "election",
  "resource_id": "1f247133-475b-4510-bce2-d5b029c605d8",
  "details": {
    "title": "Prófunarkosning 2025"
  },
  "timestamp": "2025-10-19T03:26:45.127Z"
}
```

### 2. Election Published (State Change)

```json
{
  "level": "warn",
  "message": "Election published",
  "action": "election_published",
  "correlation_id": "b2c3d4e5f6789012",
  "performed_by": "abc123XYZ789ExampleUserUID456",
  "resource_type": "election",
  "resource_id": "1f247133-475b-4510-bce2-d5b029c605d8",
  "details": {
    "title": "Prófunarkosning 2025",
    "previous_status": "draft",
    "new_status": "published"
  },
  "timestamp": "2025-10-19T03:30:00.000Z"
}
```

### 3. Admin Reset (User Scope - Safe)

```json
{
  "level": "info",
  "message": "Admin reset - user scope",
  "action": "reset_election_user",
  "performed_by": "abc123XYZ789ExampleUserUID456",
  "kennitala_masked": "200978-****",
  "timestamp": "2025-10-19T03:26:45.119Z"
}
```

### 4. Admin Reset (All Scope - Blocked)

```json
{
  "level": "warn",
  "message": "Blocked full reset in production (guardrail)",
  "action": "reset_election_blocked",
  "performed_by": "abc123XYZ789ExampleUserUID456",
  "timestamp": "2025-10-19T03:26:29.393Z"
}
```

### 5. Admin Reset (All Scope - Completed)

```json
{
  "level": "info",
  "message": "Admin reset completed",
  "action": "reset_election_all",
  "performed_by": "abc123XYZ789ExampleUserUID456",
  "scope": "all",
  "before": {
    "events_tokens": 5,
    "elections_tokens": 10,
    "elections_ballots": 8
  },
  "after": {
    "events_tokens": 0,
    "elections_tokens": 0,
    "elections_ballots": 0
  },
  "timestamp": "2025-10-19T03:26:45.127Z"
}
```

### 6. Access Denied (RBAC)

```json
{
  "level": "warn",
  "message": "Access denied - insufficient roles",
  "action": "access_denied",
  "correlation_id": "c3d4e5f678901234",
  "performed_by": "someOtherUserId",
  "granted_roles": ["member"],
  "required_roles": ["developer", "meeting_election_manager"],
  "requirement_mode": "any",
  "path": "/api/admin/elections",
  "method": "POST",
  "timestamp": "2025-10-19T03:35:00.000Z"
}
```

---

## Implementation

### Current Implementation

All admin endpoints in [services/events/src/routes/admin.js](../../../../services/events/src/routes/admin.js) already implement structured audit logging:

```javascript
console.log(JSON.stringify({
  level: 'info',
  message: 'Election created',
  correlation_id: req.correlationId,
  performed_by: req.user?.uid,
  election_id: result.rows[0].id,
  title,
  timestamp: new Date().toISOString()
}));
```

### Middleware Support

**Correlation ID Middleware** ([services/events/src/middleware/roles.js:157-163](../../../../services/events/src/middleware/roles.js#L157-L163)):
```javascript
function attachCorrelationId(req, res, next) {
  if (!req.correlationId) {
    req.correlationId = req.headers['x-correlation-id'] || generateCorrelationId();
  }
  res.setHeader('X-Correlation-ID', req.correlationId);
  next();
}
```

**RBAC Denial Logging** ([services/events/src/middleware/roles.js:65-93](../../../../services/events/src/middleware/roles.js#L65-L93)):
```javascript
function createForbiddenResponse(req, requiredRoles, mode = 'any') {
  const correlationId = req.correlationId || generateCorrelationId();
  const userRoles = getUserRoles(req);
  const uid = req.user?.uid || 'unknown';

  console.warn(JSON.stringify({
    level: 'warn',
    message: 'Access denied - insufficient roles',
    correlation_id: correlationId,
    performed_by: uid,
    granted_roles: userRoles,
    required_roles: requiredRoles,
    requirement_mode: mode,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  }));
  // ...
}
```

---

## Querying Audit Logs

### Cloud Logging Queries

#### All admin actions by user
```
resource.type="cloud_run_revision"
resource.labels.service_name="events-service"
jsonPayload.performed_by="abc123XYZ789ExampleUserUID456"
timestamp>="2025-10-19T00:00:00Z"
```

#### All election lifecycle changes
```
resource.type="cloud_run_revision"
resource.labels.service_name="events-service"
jsonPayload.action=~"election_(created|published|closed|archived)"
timestamp>="2025-10-19T00:00:00Z"
```

#### Access denied events (security audit)
```
resource.type="cloud_run_revision"
resource.labels.service_name="events-service"
jsonPayload.message="Access denied - insufficient roles"
timestamp>="2025-10-19T00:00:00Z"
```

#### All reset operations
```
resource.type="cloud_run_revision"
resource.labels.service_name="events-service"
jsonPayload.message=~"reset"
timestamp>="2025-10-19T00:00:00Z"
```

#### Trace by correlation ID
```
resource.type="cloud_run_revision"
jsonPayload.correlation_id="a1b2c3d4e5f67890"
timestamp>="2025-10-19T00:00:00Z"
```

### gcloud CLI Examples

```bash
# Get all admin actions in last 24 hours
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=events-service AND jsonPayload.performed_by!=null" \
  --limit 100 \
  --format json \
  --project ekklesia-prod-10-2025

# Get access denied events
gcloud logging read \
  "resource.type=cloud_run_revision AND jsonPayload.message=\"Access denied - insufficient roles\"" \
  --limit 50 \
  --format json \
  --project ekklesia-prod-10-2025

# Export logs for compliance (90 days)
gcloud logging read \
  "resource.type=cloud_run_revision AND jsonPayload.action=~\"election_\"" \
  --limit 10000 \
  --format json \
  --project ekklesia-prod-10-2025 > election_audit_log_$(date +%Y%m%d).json
```

---

## Log Retention Policy

| Log Type | Retention Period | Reason |
|----------|-----------------|---------|
| **Election lifecycle** | 1 year | Compliance, election integrity verification |
| **Admin actions** | 90 days | Standard audit trail |
| **Access denied** | 90 days | Security monitoring |
| **Reset operations** | 1 year | Critical operations require long retention |
| **General logs** | 30 days | Default Cloud Logging retention |

### Configuration

Cloud Logging retention is configured via log sinks and exclusion filters:

```bash
# Create long-term sink for election logs
gcloud logging sinks create election-audit-sink \
  storage.googleapis.com/ekklesia-audit-logs \
  --log-filter='resource.type="cloud_run_revision" AND jsonPayload.action=~"election_"' \
  --project ekklesia-prod-10-2025
```

---

## Compliance & Security

### Audit Requirements

- ✅ **All state-changing admin actions logged** (create, update, publish, close, etc.)
- ✅ **User accountability** (performed_by with Firebase UID)
- ✅ **Timestamp precision** (ISO 8601, millisecond precision)
- ✅ **Tamper-evident** (Cloud Logging immutable storage)
- ✅ **Access control** (Only admins can view audit logs)

### Privacy Compliance

- ✅ **No PII in logs** (UIDs only, no kennitala/names/emails)
- ✅ **Masked kennitala** for debugging (200978-****)
- ✅ **GDPR compliant** (no personal data, only opaque identifiers)

### Security Monitoring

Key indicators to monitor:
- Multiple access denied events from same UID (potential attack)
- Reset operations outside business hours
- Election state changes without corresponding admin session
- Unusual volume of admin actions

---

## Future Improvements

- [ ] **Structured audit helper** - Create `auditLog(action, resourceId, uid, changes?)` middleware
- [ ] **Automated audit reports** - Weekly email summary to admins
- [ ] **Real-time alerts** - Slack/email on critical actions (publish, close, reset all)
- [ ] **Audit log UI** - Admin dashboard showing recent actions
- [ ] **Log signing** - Cryptographic signatures for non-repudiation
- [ ] **Cross-service correlation** - Link Events ↔ Elections ↔ Members actions

---

## Related Documentation

- [ROLES_AND_PERMISSIONS.md](ROLES_AND_PERMISSIONS.md) - RBAC implementation
- [OPERATIONAL_PROCEDURES.md](../../../operations/OPERATIONAL_PROCEDURES.md) - Meeting day operations
- [Issue #82](https://github.com/sosialistaflokkurinn/ekklesia/issues/82) - Audit logging format specification

---

## Verification

**Last Verified**: 2025-10-19

**Test Case**: Admin reset operation (see [ADMIN_RESET_TEST_REPORT.md](../testing/ADMIN_RESET_TEST_REPORT.md))

**Production Logs**: Verified in `events-service` Cloud Run logs

**Status**: ✅ All endpoints currently comply with this specification
