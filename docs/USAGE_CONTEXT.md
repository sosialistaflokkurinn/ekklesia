# Ekklesia Usage Context & Load Characteristics

**Document Type**: System Requirements - Usage Patterns
**Last Updated**: 2025-10-09
**Status**: ✅ Active - Critical Design Context
**Purpose**: Define real-world usage patterns and load characteristics for capacity planning

---

## Overview

The Ekklesia voting system is designed for **organizational meetings** (board meetings, member assemblies, etc.) held by Sósíalistaflokkur Íslands (Socialist Party of Iceland). Understanding the usage context is critical for:

- **Capacity planning** (Cloud Run scaling)
- **Database connection pooling** (PostgreSQL)
- **Performance testing** (load test scenarios)
- **Cost estimation** (resource allocation)

---

## Meeting Characteristics

### Meeting Format

The system supports three meeting formats:

1. **In-Person Meetings**
   - Physical location (e.g., party headquarters)
   - Members authenticate before/during meeting
   - Voting happens collectively (everyone votes at same time)
   - Highest load spike scenario

2. **Remote Meetings**
   - Online only (video conference)
   - Members authenticate before meeting starts
   - Voting happens when moderator opens ballot
   - Moderate load spike (slightly spread out)

3. **Hybrid Meetings** (Most Common)
   - Mix of in-person and remote attendees
   - Authentication spread over 15 minutes (as people arrive)
   - Voting spike when moderator announces vote
   - **This is the primary design scenario**

---

## Meeting Frequency & Size

### Typical Meeting Schedule

- **Frequency**: At most **once per month**
- **Duration**: 2-4 hours
- **Election Windows**: 5-15 minutes per vote
- **Number of Elections**: 3-10 per meeting

### Attendance Patterns

| Scenario | Typical | Large | Maximum |
|----------|---------|-------|---------|
| Members Present | 50-150 | 200-300 | **500** |
| Percentage of Total (3000) | 5% | 10% | 17% |
| Likelihood | 80% | 15% | 5% |

**Design Target**: System must handle **500 concurrent voters** (very large attendance scenario).

---

## Load Patterns

### Phase 1: Authentication (Login)

**Timeline**: 10-15 minutes before meeting starts

```
Time:   -15min        -10min        -5min         0 (meeting starts)
Load:   ████          █████████     ███████       ██
Users:  50            150           200           300
```

**Characteristics**:
- **Duration**: 10-15 minutes
- **Peak**: ~300 authentications spread over 15 minutes
- **Rate**: ~20 logins/minute (0.3 logins/second)
- **Service**: Members Service (Firebase + Cloud Functions)
- **Impact**: Low - Firebase Authentication handles this easily

**Bottlenecks**: None expected
- Firebase Authentication: 10,000 requests/second limit
- Cloud Functions: Auto-scales to demand
- Kenni.is OAuth: Government infrastructure, highly available

---

### Phase 2: Token Request (Before Vote)

**Timeline**: When member navigates to election page

```
Time:   Vote announced          +30 sec           +60 sec
Load:   ██████████              ████              ██
Tokens: 400 requested           50 requested      30 requested
```

**Characteristics**:
- **Duration**: 1-2 minutes (as members navigate to voting page)
- **Peak**: ~400 token requests in first 30 seconds
- **Rate**: ~13 requests/second peak
- **Service**: Events Service (Cloud Run + PostgreSQL)
- **Impact**: Moderate - Cloud Run handles this with auto-scaling

**Bottlenecks**: Database writes (token issuance)
- Events service writes token_hash to audit table
- PostgreSQL can handle 1000+ writes/second
- Connection pool: 20 connections sufficient

---

### Phase 3: Vote Submission (The Critical Spike) 🔥

**Timeline**: Moderator says "Please vote now"

```
Time:   Vote opens    +1 sec      +2 sec      +3 sec      +5 sec      +10 sec
Load:   ██████████    ██████████  ████████    ████        ██          █
Votes:  150           100         50          20          10          5
Total:  150           250         300         320         330         335
```

**Characteristics**:
- **Duration**: **3-5 seconds** (critical load spike)
- **Peak**: **300 votes in 1 second** (worst case)
- **Sustained**: 150-200 votes/second for first 2-3 seconds
- **Service**: Elections Service (Cloud Run + PostgreSQL)
- **Impact**: **HIGH** - This is the design constraint

**Bottlenecks**: Database transactions (ballot writes)
- Elections service must write ballot + mark token used (atomic transaction)
- PostgreSQL transaction rate: 1000-2000 TPS (depends on instance size)
- Connection pool: Must support 300 concurrent connections (or queue)
- Row-level locking: `FOR UPDATE` on voting_tokens table

**Critical Design Requirements**:
1. **Cloud Run scaling**: Must scale to 300 instances in <3 seconds
2. **Database connection pool**: 50-100 connections per instance (5000-10000 total)
3. **Transaction optimization**: Minimize transaction time (<10ms)
4. **Row-level locking**: Use `FOR UPDATE NOWAIT` to fail fast instead of queuing
5. **Error handling**: Return 503 (retry) if pool exhausted

---

## Load Scenarios (Design Matrix)

### Scenario A: Small Meeting (Expected 80%)

- **Attendees**: 50-150
- **Login Peak**: 10 logins/minute
- **Token Requests**: 100 in 30 seconds (~3/sec)
- **Vote Spike**: 100 votes in 2 seconds (50/sec)
- **System Impact**: Minimal - no scaling needed
- **Cost**: Cloud Run free tier

### Scenario B: Large Meeting (Expected 15%)

- **Attendees**: 200-300
- **Login Peak**: 20 logins/minute
- **Token Requests**: 250 in 30 seconds (~8/sec)
- **Vote Spike**: 250 votes in 3 seconds (83/sec)
- **System Impact**: Moderate - Cloud Run scales to 10-20 instances
- **Cost**: $0.50-1.00 per meeting

### Scenario C: Maximum Capacity (Expected 5%)

- **Attendees**: 500
- **Login Peak**: 30 logins/minute
- **Token Requests**: 400 in 30 seconds (~13/sec)
- **Vote Spike**: **300 votes in 1 second** (300/sec)
- **System Impact**: **High** - Cloud Run scales to 50-100 instances
- **Cost**: $2-5 per meeting
- **Design Constraint**: System must handle this without failures

---

## Performance Requirements

### Response Time Targets

| Operation | Target | Maximum | Notes |
|-----------|--------|---------|-------|
| Login (Kenni.is OAuth) | 2-3 sec | 5 sec | Depends on government IdP |
| Token Request (Events) | <200ms | 500ms | Database write + hash |
| Vote Submission (Elections) | <100ms | 300ms | Critical user experience |
| Results Fetch (S2S) | <500ms | 1 sec | After election closes |

### Availability Requirements

| Service | Target | Notes |
|---------|--------|-------|
| Members (Firebase) | 99.9% | Firebase SLA |
| Events (Cloud Run) | 99.5% | Monthly meetings, not critical |
| Elections (Cloud Run) | 99.9% | **Critical during voting spike** |
| Cloud SQL | 99.95% | Google SLA |

**Rationale**: Elections service must be highly available during the 3-5 second voting spike. Failures during this window are unacceptable.

---

## Database Scaling Considerations

### Current Setup (MVP)

- **Instance**: db-f1-micro (shared core, 0.6 GB RAM)
- **Cost**: $7/month
- **Connections**: 25 max
- **TPS**: ~500 transactions/second

### Scaling Strategy

#### Option 1: Connection Pooling (Recommended for MVP)

```javascript
// Events Service + Elections Service share connection pool
const pool = new Pool({
  max: 20,  // Max connections per service
  min: 2,   // Keep 2 warm
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,  // Fail fast if pool exhausted
});
```

**Calculation**:
- Events service: 10 Cloud Run instances × 5 connections = 50 connections
- Elections service: 50 Cloud Run instances × 2 connections = 100 connections
- Total: 150 connections (need to upgrade from db-f1-micro)

**Action**: Test with db-f1-micro first, upgrade to db-g1-small ($25/month, 100 connections) if needed

#### Option 2: Vertical Scaling (For Large Meetings)

| Instance Type | vCPU | RAM | Max Connections | TPS | Cost/Month |
|---------------|------|-----|-----------------|-----|------------|
| db-f1-micro | Shared | 0.6 GB | 25 | 500 | $7 |
| db-g1-small | Shared | 1.7 GB | 100 | 1000 | $25 |
| db-n1-standard-1 | 1 | 3.75 GB | 500 | 2000+ | $50 |

**Recommendation**: Start with db-f1-micro, monitor during first large meeting, upgrade if connection pool exhaustion occurs.

---

## Cloud Run Scaling Configuration

### Events Service

```yaml
# events/deploy.sh
--min-instances 0          # Cost optimization
--max-instances 10         # Sufficient for token requests (13/sec peak)
--concurrency 80           # Handle 80 requests per instance
--cpu 1
--memory 512Mi
--timeout 10s              # Token request should be fast
```

**Scaling Math**:
- Peak load: 13 token requests/second
- Concurrency: 80 requests per instance
- Required instances: 13 / 80 = **1 instance** (round up to 2 for safety)
- Max instances: 10 (buffer for unexpected load)

### Elections Service

```yaml
# elections/deploy.sh
--min-instances 0          # Cost optimization
--max-instances 100        # Must handle 300 votes/second spike
--concurrency 50           # Lower concurrency for database transactions
--cpu 1
--memory 512Mi
--timeout 5s               # Vote must be fast, fail fast if timeout
--startup-cpu-boost        # Fast cold start for scaling
```

**Scaling Math**:
- Peak load: 300 votes/second
- Transaction time: ~50ms (optimistic)
- Concurrency per instance: 50 requests (database-bound)
- Required instances: 300 votes/sec ÷ (1000ms / 50ms) = **15 instances**
- Buffer for database contention: 3x = **45 instances**
- Max instances: 100 (safety margin)

**Critical**: Elections service must scale from 0 to 45 instances in <3 seconds. Cloud Run supports this with `--startup-cpu-boost`.

---

## Load Testing Requirements

### Test Scenarios

#### Test 1: Authentication Load (Members Service)

- **Scenario**: 300 logins over 15 minutes
- **Rate**: 20 logins/minute
- **Expected**: No failures, <5 sec response time
- **Tool**: `artillery` or `k6`

#### Test 2: Token Request Load (Events Service)

- **Scenario**: 400 token requests over 30 seconds
- **Rate**: 13 requests/second
- **Expected**: No failures, <500ms response time
- **Tool**: `artillery` or `k6`

#### Test 3: Vote Spike Load (Elections Service) 🔥

- **Scenario**: 300 votes in 1 second
- **Rate**: 300 requests/second (1 second burst)
- **Expected**:
  - <5% failures (15 failures acceptable)
  - <300ms p95 response time
  - All ballots eventually recorded (retry successful)
- **Tool**: `artillery` or `k6` with custom script
- **Database**: Monitor connection pool, transaction rate, lock waits

```javascript
// k6 load test example
import http from 'k6/http';

export let options = {
  stages: [
    { duration: '1s', target: 300 },  // Ramp to 300 users in 1 second
    { duration: '3s', target: 300 },  // Hold 300 users for 3 seconds
    { duration: '1s', target: 0 },    // Ramp down
  ],
};

export default function () {
  const token = __ENV.VOTING_TOKEN;  // Each VU has unique token
  const url = 'https://elections-service-....run.app/api/vote';
  const payload = JSON.stringify({ answer: 'yes' });
  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  http.post(url, payload, params);
}
```

---

## Cost Implications

### Monthly Cost Estimate

**Assumptions**:
- 1 meeting per month
- 300 attendees (large meeting)
- 5 elections per meeting
- 300 votes × 5 = 1500 total votes

| Service | Cost | Notes |
|---------|------|-------|
| Cloud SQL (db-f1-micro) | $7.00 | Fixed cost |
| Members (Firebase) | $0.00 | Free tier (300 MAU) |
| Events (Cloud Run) | $0.10 | 1500 token requests |
| Elections (Cloud Run) | $0.50 | 1500 votes + scaling |
| Cloud Logging | $0.05 | Audit logs |
| **Total** | **$7.65** | **~$92/year** |

### Peak Meeting Cost (500 attendees)

| Service | Cost | Notes |
|---------|------|-------|
| Cloud SQL (db-g1-small) | $25.00 | Upgraded for connections |
| Elections (Cloud Run) | $2.00 | 300 votes/sec spike |
| **Total** | **$27.00** | **One-time, only for very large meetings** |

**Cost Optimization**: Keep db-f1-micro, only upgrade temporarily for large meetings if needed.

---

## Monitoring & Alerts

### Key Metrics to Monitor

#### During Login Phase (15 minutes before meeting)
- Firebase Authentication success rate
- Cloud Functions error rate
- Kenni.is OAuth latency

#### During Token Request Phase (1-2 minutes before vote)
- Events service request rate
- Database connection pool usage
- Token issuance latency (p95)

#### During Vote Spike (3-5 seconds) 🔥
- **Elections service request rate** (should reach 300/sec)
- **Elections service error rate** (target <5%)
- **Database connection pool exhaustion** (critical alert)
- **Transaction latency** (p95, p99)
- **Cloud Run instance count** (should scale to 45+)
- **Database lock waits** (monitor pg_locks table)

### Alerts

| Metric | Threshold | Action |
|--------|-----------|--------|
| Elections error rate | >10% | Page on-call, may need manual intervention |
| Database connections | >80% of max | Upgrade instance or reduce pool size |
| Transaction latency | >500ms p95 | Check database slow query log |
| Cloud Run scaling | <30 instances at peak | Check scaling config, may need min-instances |

---

## Failure Scenarios & Mitigation

### Scenario 1: Database Connection Pool Exhausted

**Symptoms**:
- Elections service returns 500 errors
- Error: "connection pool timeout"
- Many votes failing

**Mitigation**:
1. **Immediate**: Elections service returns 503 (retry) instead of 500
2. **Short-term**: Reduce connection timeout (fail fast)
3. **Long-term**: Upgrade to db-g1-small (100 connections)

**Code Change**:
```javascript
pool.on('error', (err) => {
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    res.status(503).json({
      error: 'Service temporarily unavailable, please retry',
      retryAfter: 2  // seconds
    });
  }
});
```

### Scenario 2: Cloud Run Not Scaling Fast Enough

**Symptoms**:
- Elections service has high latency (>1s)
- Only 10-20 instances running (should be 45+)
- Many 429 errors (rate limited)

**Mitigation**:
1. **Immediate**: Set `--min-instances 10` before large meetings
2. **Short-term**: Enable `--startup-cpu-boost` for faster cold starts
3. **Long-term**: Pre-warm instances 5 minutes before vote

### Scenario 3: Database Lock Contention

**Symptoms**:
- Transactions slow (>500ms)
- Many votes waiting on locks
- Database CPU high

**Mitigation**:
1. **Immediate**: Use `FOR UPDATE NOWAIT` (fail fast instead of waiting)
2. **Short-term**: Optimize transaction (reduce critical section)
3. **Long-term**: Vertical scaling (more vCPU)

**Code Change**:
```sql
-- Before (waits for lock)
SELECT used FROM voting_tokens WHERE token_hash = $1 FOR UPDATE;

-- After (fails fast)
SELECT used FROM voting_tokens WHERE token_hash = $1 FOR UPDATE NOWAIT;
```

---

## Design Decisions Based on Usage Context

### ✅ Decisions Made:

1. **No min-instances for MVP**: Cost optimization, meetings are infrequent
2. **High max-instances for Elections**: Must handle 300 votes/sec spike
3. **Connection pooling**: Shared db-f1-micro, upgrade if needed
4. **Fail-fast strategy**: Return 503 (retry) instead of queuing
5. **Startup CPU boost**: Fast cold start for Cloud Run scaling
6. **Row-level locking**: Use `FOR UPDATE NOWAIT` to avoid contention
7. **Transaction optimization**: Minimize time in critical section (<10ms target)
8. **Load testing required**: Must test 300 votes/sec before production use

### 📊 Performance Targets:

| Metric | Target | Reasoning |
|--------|--------|-----------|
| Vote submission latency (p95) | <300ms | Acceptable UX during spike |
| Vote submission error rate | <5% | 15 failures out of 300 acceptable (users retry) |
| Cloud Run scale-up time | <3 seconds | Must reach 45 instances during spike |
| Database connection pool | 100 connections | 50 instances × 2 connections |
| Transaction time | <10ms | Minimize lock contention |

---

## Related Documentation

- [docs/SYSTEM_ARCHITECTURE_OVERVIEW.md](SYSTEM_ARCHITECTURE_OVERVIEW.md) - Overall architecture
- [docs/design/EVENTS_SERVICE_MVP.md](design/EVENTS_SERVICE_MVP.md) - Events service design
- [docs/design/ELECTIONS_SERVICE_MVP.md](design/ELECTIONS_SERVICE_MVP.md) - Elections service design
- [docs/status/CURRENT_PRODUCTION_STATUS.md](status/CURRENT_PRODUCTION_STATUS.md) - Production status

---

## Implementation Checklist

### Before First Large Meeting (500 attendees)

- [ ] Load test Elections service (300 votes/sec)
- [ ] Configure Cloud Run: `--max-instances 100 --startup-cpu-boost`
- [ ] Configure connection pooling: 2 connections per instance
- [ ] Implement `FOR UPDATE NOWAIT` (fail-fast locking)
- [ ] Implement 503 retry logic (connection pool exhaustion)
- [ ] Set up monitoring dashboard (request rate, error rate, latency)
- [ ] Set up alerts (error rate >10%, connections >80%)
- [ ] Test database upgrade path (db-f1-micro → db-g1-small)
- [ ] Document retry strategy for users (if vote fails, retry)
- [ ] Test end-to-end with 50 concurrent users (smaller test)

---

**Last Updated**: 2025-10-09
**Status**: ✅ Active - Must be considered in all design decisions
**Next Review**: After first large meeting (validate assumptions)
