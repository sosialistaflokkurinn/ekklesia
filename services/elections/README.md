# Elections Service MVP

**Status**: 🔨 Implementation Complete - Ready for Testing
**Type**: REST API (Node.js 18 + Express + PostgreSQL)
**Purpose**: Anonymous ballot recording for Prófunarkosning 2025

---

## Overview

The Elections service is a secure, anonymous ballot recording system that:
- ✅ Validates one-time voting tokens (from Events service via S2S)
- ✅ Records ballots anonymously (no PII, no member information)
- ✅ Enforces one-token-one-vote constraint (database UNIQUE)
- ✅ Returns results to Events service (S2S)
- ✅ Supports yes/no/abstain voting (MVP scope)

**Key Principle**: This service has **zero knowledge** of member identities. It only knows token hashes.

**⚠️ Critical Design Constraint**: Must handle **300 votes/second spike** during first 3 seconds of voting.

---

## Quick Start

### Prerequisites

- Node.js 18+
- Cloud SQL Proxy (for local development)
- PostgreSQL client (psql)
- gcloud CLI configured

### Local Development Setup

```bash
# 1. Install dependencies
cd elections
npm install

# 2. Start Cloud SQL Proxy (in separate terminal)
# This script now uses the DB_CONNECTION_NAME from scripts/deployment/set-env.sh
./scripts/database/start-proxy.sh

# 3. (Optional) Export database password manually
export DB_PASSWORD=$(gcloud secrets versions access latest \
  --secret=postgres-password \
  --project=ekklesia-prod-10-2025)

# 4. Run database migrations (helper script fetches password + uses proxy)
./scripts/psql-cloud.sh -f migrations/001_initial_schema.sql
```

> ℹ️ `scripts/psql-cloud.sh` automatically retrieves the password from Secret Manager and connects through the proxy. If you must hit the public IP directly, add `sslmode=require` because the instance now enforces TLS.

```bash
# 5. Create .env file
cp .env.example .env
# Edit .env and add:
#   DATABASE_PASSWORD=<from step 3 or Secret Manager>
#   S2S_API_KEY=<generate with: openssl rand -hex 32>

# 6. Start server
npm start
```

Server runs on http://localhost:8081

### Verify Installation

```bash
# Health check
curl http://localhost:8081/health

# Expected output:
# {
#   "status": "healthy",
#   "service": "elections-service",
#   "version": "1.0.0",
#   ...
# }
```

---

## API Endpoints

### Public Endpoints (Token-based)

#### POST /api/vote
Submit a ballot using one-time token

**Headers**:
```
Authorization: Bearer <token-from-events>
Content-Type: application/json
```

**Body**:
```json
{
  "answer": "yes"  // or "no" or "abstain"
}
```

**Response** (201):
```json
{
  "success": true,
  "ballot_id": "uuid",
  "message": "Vote recorded successfully"
}
```

**Errors**:
- 401: Missing/invalid token
- 404: Token not registered
- 409: Token already used
- 400: Invalid answer
- 503: Service temporarily unavailable (retry)

#### GET /api/token-status
Check if token is valid (pre-flight check)

**Headers**:
```
Authorization: Bearer <token-from-events>
```

**Response** (200):
```json
{
  "valid": true,
  "used": false,
  "registered_at": "2025-10-09T12:00:00Z",
  "election_title": "Prófunarkosning 2025",
  "election_question": "Do you support this proposal?"
}
```

#### GET /health
Health check endpoint (no auth required)

**Response** (200):
```json
{
  "status": "healthy",
  "service": "elections-service",
  "version": "1.0.0",
  "timestamp": "2025-10-09T12:00:00Z",
  "environment": "development"
}
```

### S2S Endpoints (Events Service Only)

All S2S endpoints require `X-API-Key` header.

#### POST /api/s2s/register-token
Register voting token (called by Events when member requests token)

**Headers**:
```
X-API-Key: <shared-secret>
Content-Type: application/json
```

**Body**:
```json
{
  "token_hash": "a1b2c3d4..." // 64 hex chars (SHA-256)
}
```

**Response** (201):
```json
{
  "success": true,
  "token_hash": "a1b2c3d4...",
  "message": "Token registered successfully"
}
```

**Errors**:
- 400: Invalid token hash format
- 409: Token already registered

#### GET /api/s2s/results
Fetch election results (called by Events after election closes)

**Headers**:
```
X-API-Key: <shared-secret>
```

**Response** (200):
```json
{
  "total_ballots": 287,
  "results": {
    "yes": 145,
    "no": 92,
    "abstain": 50
  },
  "election_title": "Prófunarkosning 2025"
}
```

---

## Database Schema

**Schema**: `elections` (separate from `public` schema used by Events)

**Tables**:
- `voting_tokens` - One-time tokens (registered by Events via S2S)
- `ballots` - Anonymous ballot records (no PII)
- `audit_log` - System audit trail (no PII, token hash prefix only)

See [migrations/README.md](migrations/README.md) for details.

---

## Deployment

### Production Deployment

```bash
# Deploy to Cloud Run
./deploy.sh
```

**Configuration** (optimized for 300 votes/sec spike):
- Max instances: 100
- Concurrency: 50 (database-bound)
- Memory: 512Mi
- CPU: 1 (with startup boost)
- Timeout: 5s (fail fast)
- Min instances: 0 (cost optimization, scale up before meetings)

### Manual Deployment

```bash
# Build image
gcloud builds submit --tag gcr.io/ekklesia-prod-10-2025/elections-service .

# Deploy
gcloud run deploy elections-service \
  --image gcr.io/ekklesia-prod-10-2025/elections-service \
  --region europe-west2 \
  --max-instances 100 \
  --concurrency 50 \
  --cpu-boost \
  ...
```

See [deploy.sh](deploy.sh) for complete configuration.

---

## Testing

### Manual Testing (Local)

```bash
# 1. Register token (S2S - simulate Events service)
curl -X POST http://localhost:8081/api/s2s/register-token \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"token_hash":"a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef"}'

# 2. Check token status
curl http://localhost:8081/api/token-status \
  -H "Authorization: Bearer test-token-plain-text"

# 3. Submit vote
curl -X POST http://localhost:8081/api/vote \
  -H "Authorization: Bearer test-token-plain-text" \
  -H "Content-Type: application/json" \
  -d '{"answer":"yes"}'

# 4. Get results (S2S)
curl http://localhost:8081/api/s2s/results \
  -H "X-API-Key: your-api-key"
```

### Load Testing (REQUIRED before production)

**Critical**: Must test 300 votes/sec spike before first large meeting.

See [docs/USAGE_CONTEXT.md](../docs/USAGE_CONTEXT.md) for load test requirements.

---

## Security

### Anonymity Guarantees
- ✅ **No PII**: Service never receives member identity
- ✅ **No IP logging**: Intentionally omit IP addresses
- ✅ **Timestamp rounding**: Ballot submission time rounded to nearest minute
- ✅ **Token hashing**: SHA-256, never stores plain tokens
- ✅ **Unlinkability**: No way to connect ballot to member (only Events has that mapping)

### S2S Authentication
- **API key**: Shared secret between Events and Elections services
- **Header-based**: `X-API-Key` header (not query param)
- **Key rotation**: Stored in Secret Manager (elections-s2s-api-key)

### Database Constraints
- **UNIQUE(token_hash)**: Prevents double voting
- **FOR UPDATE NOWAIT**: Fail-fast locking (no queue wait)
- **CHECK(answer)**: Only valid answers (yes/no/abstain)
- **Foreign key**: Ensures token exists before ballot

---

## Performance Optimization

**Critical for 300 votes/sec spike**:

1. **Connection pooling**: 2 connections per instance (max 5)
2. **Fail-fast locking**: `FOR UPDATE NOWAIT` (return 503 instead of waiting)
3. **Startup CPU boost**: Fast cold start for Cloud Run scaling
4. **Transaction optimization**: <10ms target transaction time
5. **503 Retry response**: Client retries instead of server queuing

See [docs/USAGE_CONTEXT.md](../docs/USAGE_CONTEXT.md) for load patterns.
See [docs/OPERATIONAL_PROCEDURES.md](../docs/OPERATIONAL_PROCEDURES.md) for meeting day operations.

---

## Monitoring

### Key Metrics (Cloud Run)
- **Request rate**: Should reach 300/sec during voting spike
- **Instance count**: Should scale to 45-100 during spike
- **Error rate**: Target <5%
- **Request latency (p95)**: Target <300ms

### Audit Logs

```sql
-- Recent audit logs
SELECT timestamp, action, success, details
FROM elections.audit_log
ORDER BY timestamp DESC
LIMIT 20;

-- Failed ballots
SELECT timestamp, details
FROM elections.audit_log
WHERE action = 'record_ballot' AND success = FALSE
ORDER BY timestamp DESC;
```

---

## Troubleshooting

### Issue: Connection pool exhausted

**Symptoms**: 500 errors, "connection pool timeout"

**Solution**:
1. Increase `DATABASE_POOL_MAX` in .env
2. Upgrade database to db-g1-small (100 connections)
3. Return 503 (retry) instead of queuing

### Issue: Lock contention

**Symptoms**: Many 503 errors, slow transactions

**Solution**:
- Already using `FOR UPDATE NOWAIT` (fail-fast)
- Clients should retry after 1 second
- Monitor `pg_locks` table during voting spike

### Issue: Cloud Run not scaling fast enough

**Symptoms**: High latency, few instances

**Solution**:
1. Pre-warm before meetings: `--min-instances=10`
2. Enable `--cpu-boost` (already enabled)
3. Verify `--max-instances=100` is set

---

## Related Documentation

- **[docs/design/ELECTIONS_SERVICE_MVP.md](../docs/design/ELECTIONS_SERVICE_MVP.md)** - Design document
- **[docs/USAGE_CONTEXT.md](../docs/USAGE_CONTEXT.md)** - **CRITICAL: Load patterns (300 votes/sec)**
- **[docs/OPERATIONAL_PROCEDURES.md](../docs/OPERATIONAL_PROCEDURES.md)** - Meeting day operations
- **[docs/SYSTEM_ARCHITECTURE_OVERVIEW.md](../docs/SYSTEM_ARCHITECTURE_OVERVIEW.md)** - Overall architecture
- [migrations/README.md](migrations/README.md) - Database migrations

---

## Cost Estimation

**Monthly Cost** (1 meeting, 300 attendees):
- Cloud Run: $0.50 (mostly idle, scales for meetings)
- Cloud SQL: $7 (shared with Events service)
- **Total**: ~$0.50/month for Elections service

**Large Meeting Cost** (500 attendees, database upgrade):
- Cloud Run: $2 (300 votes/sec spike)
- Cloud SQL upgrade: $0.83/day (db-g1-small prorated)
- **Total**: ~$3 per large meeting

See [docs/OPERATIONAL_PROCEDURES.md](../docs/OPERATIONAL_PROCEDURES.md) for cost optimization strategies.

---

**Status**: ✅ Implementation complete, ready for Phase 1 testing (database + local API)
**Next Step**: Run migrations, test endpoints, then deploy to Cloud Run
