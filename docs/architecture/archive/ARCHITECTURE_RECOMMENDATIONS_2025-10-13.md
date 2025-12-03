# Architecture Recommendations — Ekklesia Voting Platform

Last Updated: 2025-10-13
Scope: Address 5 architecture challenges with concrete, cost-conscious recommendations aligned to the current production system

References read:
- docs/status/CURRENT_PRODUCTION_STATUS.md
- docs/SYSTEM_ARCHITECTURE_OVERVIEW.md
- docs/USAGE_CONTEXT.md
- docs/OPERATIONAL_PROCEDURES.md
- events/README.md, elections/README.md, members/README.md

---

## Executive Summary

### Current Architecture Assessment
Strengths:
1. Simple, serverless-first architecture (Firebase + Cloud Run + Cloud SQL) keeps costs low ($7–13/month)
2. Clean separation of concerns (Members vs Events vs Elections) preserves ballot anonymity and reduces risk
3. Production-readiness demonstrated: MVPs deployed, S2S integration complete, security hardening phases 1–3 done

Risks:
1. Database connection pool exhaustion during the 300 votes/second spike; db-f1-micro (25 max conns) is tight
2. Manual pre-warming and manual DB tier change are operationally fragile (human error window before a vote)
3. Limited observability during the 3–5 second critical window; no proactive SLO/SLA alerts or correlation IDs

### Top 3 Recommended Changes
1. Automate pre-meeting scale-up/scale-down (Cloud Run min instances + Cloud SQL tier up/down)
   - Cost: $0 baseline; transient +$0.80/day when tiered up; Effort: 1–2 days
2. Harden S2S with explicit timeouts, retries w/ jitter, idempotency keys, and fast-fail DB locking
   - Cost: $0/month; Effort: 1–2 days per service (Elections primary)
3. Establish a lean observability baseline (structured logs with correlation IDs, 2 dashboards, 4 alerts, optional 1% tracing)
   - Cost: ~$0/month; Effort: 1–2 days

### Cost Impact Summary (Detailed Calculations)

**Current Monthly Baseline**:
- Cloud SQL db-f1-micro: $7.00/month (fixed)
- Events service (Cloud Run): ~$0.50/month (1,500 token requests/month)
- Elections service (Cloud Run): ~$0.50/month (1,500 votes/month)
- Cloud Logging: ~$0.10/month (audit logs)
- **Total: ~$8.10/month**

**Meeting Day Database Upgrade Cost** (large meetings >300 attendees):
- db-g1-small: $25.42/month (Google pricing)
- Upgrade duration: 6 hours (pre-meeting scale + meeting + buffer)
- Prorated cost: $25.42 × (6 hours / 720 hours/month) = **$0.21 per upgrade**
- Expected frequency: 2 large meetings/year = **$0.42/year** = **$0.035/month average**

**Cloud Run Pre-warming Cost** (10 min instances for 30 minutes):
- Elections service: 10 instances × 0.5 hours × $0.00002400/vCPU-second × 1 vCPU × 3600 seconds = **$0.43 per meeting**
- Expected frequency: 12 meetings/year = **$5.16/year** = **$0.43/month average**

**Final Monthly Cost After All Changes**:
- Baseline: $8.10/month
- DB upgrade average: +$0.035/month  
- Pre-warming average: +$0.43/month
- **Total: ~$8.57/month** (6% increase)
- **Annual cost: ~$103/year** vs current ~$97/year = **+$6/year delta**

### Implementation Timeline
- Phase 1 (1–3 months): Automate scale-up/down; implement connection pooling + fast-fail locking; resilience (timeouts/retries/idempotency); basic dashboards/alerts
- Phase 2 (3–6 months): Load tests and tuning; optional light tracing; finalize DB tier-up criteria; add runbooks; improve failure drill process
- Phase 3 (6–12 months): Multi-tenant enablement (org_id + RLS); per-tenant API keys; cost attribution; optional API gateway only if multi-org growth demands it

---

## Challenge 1: Database Scaling Strategy

### Current State Assessment
- Cloud SQL: PostgreSQL 15 on db-f1-micro (shared core, ~0.6 GB RAM, 25 max connections)
- Shared by Events and Elections services
- Manual pre-warming and optional manual upgrade to db-g1-small before large meetings
- Risk areas from docs/USAGE_CONTEXT.md: peak 300 votes/second for 3–5 seconds; connection pool exhaustion and lock contention

### Options Evaluated
Option A: Keep db-f1-micro and automate tier-up for big meetings
- Pros: Lowest steady cost; automation removes human error; change only when needed; aligns with monthly cadence
- Cons: Adds a small automation surface; still need to define upgrade trigger and rollback
- Cost: $7/month baseline; ~$25/month when upgraded, prorated if only for a day (~$0.80)

Option B: Permanently upgrade to db-g1-small
- Pros: 100 max connections; more headroom; simpler operations (no tier automation)
- Cons: 3.5× cost at rest ($25/month); breaks $20-$50 envelope if combined with growth elsewhere; not needed 29 days out of 30
- Cost: $25/month ongoing

Option C: Split databases (Events and Elections on separate instances)
- Pros: Isolation; independent scaling; reduced cross-service contention
- Cons: Doubles admin surface and cost; not needed for the current scale or budget
- Cost: ≥$14/month (two f1-micro) + overhead

### Recommendation
I recommend: Option A — stay on db-f1-micro and automate tier-up (db-g1-small) only on meeting days when needed.

Justification:
- Meets budget target with near-zero monthly delta (most months will not require upgrade)
- Risk is connection count and transient locks; g1-small gives rapid relief with +100 connections for rare big meetings
- Automation (Cloud Scheduler + a minimal Cloud Function/Cloud Run Admin call) removes manual error risk

Trade-offs:
- Gain: Minimal cost, predictable process, operational safety via automation
- Lose: Slightly more complexity than “always-on” g1-small, but acceptable

Cost Impact: Typically $7/month; +$0.80 for a meeting day when upgrading

Implementation Effort: 1–2 days

Priority: Critical (before next large meeting)

Implementation notes:
- Elections pool: keep max 2–4 connections per instance; concurrency 40–60; fail fast if pool exhausted
- Events pool: keep ~5 connections; token issuance is lighter
- Locking: use SELECT … FOR UPDATE NOWAIT on tokens; if locked, 409/423 quickly with randomized client retry
- Automation: Cloud Scheduler triggers a tiny Cloud Run or Cloud Function endpoint to:
  1) set elections-service min instances to 10 (pre-warm)
  2) patch Cloud SQL tier to db-g1-small if expected attendees >300
  3) revert both post-meeting

---

## Challenge 2: Service Communication Pattern

### Current State Assessment
- Direct S2S HTTP between Events and Elections with API key (no gateway/mesh)
- No formal circuit breakers; implicit retry semantics not standardized

### Options Evaluated
Option A: Keep direct S2S HTTP; add app-level resilience patterns
- Pros: $0 cost; minimal complexity; fastest to implement; fits 1–2 dev team
- Cons: Lacks centralized policy enforcement; each service must own resilience
- Cost: $0/month

Option B: Introduce API Gateway (Cloud Endpoints/ESPv2 or API Gateway)
- Pros: Centralized auth/policies; quota/rate limiting at the edge; better discoverability
- Cons: Setup/ops overhead; learning curve; small but non-zero cost; overkill for 2 services
- Cost: Low but not zero; adds cognitive load

Option C: Adopt service mesh (Istio/Anthos)
- Pros: Rich traffic policies, mTLS, retries, tracing
- Cons: Operational and cost complexity far exceeds needs/budget
- Cost: High relative to scope; not aligned with YAGNI

### Recommendation
I recommend: Option A — keep direct S2S HTTP and add standardized resilience:

**Timeouts**: 1.0–1.5s for Elections S2S; 500–800ms for internal DB calls

**Retries**: 2 attempts with exponential backoff + full jitter on 5xx/429 only
```javascript
const retryWithJitter = async (fn, maxAttempts = 3) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts || ![500,502,503,504,429].includes(error.status)) {
        throw error;
      }
      const baseDelay = Math.pow(2, attempt - 1) * 100; // 100ms, 200ms, 400ms
      const jitter = Math.random() * baseDelay;
      await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
    }
  }
};
```

**Circuit Breaker**: Specific failure threshold implementation
```javascript
class SimpleCircuitBreaker {
  constructor(failureThreshold = 5, recoveryTimeout = 2000) {
    this.failureCount = 0;
    this.failureThreshold = failureThreshold;
    this.recoveryTimeout = recoveryTimeout;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = 0;
  }

  async call(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.recoveryTimeout;
    }
  }
}
```

**Idempotency**: S2S endpoints accept Idempotency-Key header; server-side deduplication
```javascript
// Elections service S2S endpoint
app.post('/api/s2s/register-token', async (req, res) => {
  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Idempotency-Key header required' });
  }
  
  // Check if already processed
  const existing = await pool.query(
    'SELECT response_data FROM idempotency_cache WHERE key = $1 AND created_at > NOW() - INTERVAL \'1 hour\'',
    [idempotencyKey]
  );
  if (existing.rows.length > 0) {
    return res.json(existing.rows[0].response_data);
  }
  
  // Process and cache response
  const result = await processTokenRegistration(req.body);
  await pool.query(
    'INSERT INTO idempotency_cache (key, response_data) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
    [idempotencyKey, result]
  );
  res.json(result);
});
```

**Auth**: Per-tenant HMAC API keys with rotation support via Secret Manager

Trade-offs:
- Gain: Reliability without new infra; keeps cost at $0
- Lose: Less standardized than a gateway; more code ownership

Cost Impact: $0/month

Implementation Effort: 1–2 days

Priority: High

---

## Challenge 3: Voting Spike Load (300 votes/sec)

### Current State Assessment
- Critical window: 3–5 seconds; 300 votes in 1s worst case (docs/USAGE_CONTEXT.md)
- Manual pre-warm currently required to avoid cold starts
- DB contention around token checks and ballot writes

### Options Evaluated
Option A: Optimize synchronous path; automate pre-warm; fast-fail on lock; client retry
- Pros: Minimal change; predictable UX; keeps anonymity model; keeps costs low
- Cons: Requires careful transaction and pool tuning; depends on Cloud Run scale-up behavior
- Cost: $0/month

Option B: Insert a buffer (Pub/Sub/Cloud Tasks) to smooth spikes
- Pros: Absorbs burst and smooths DB writes; protects DB
- Cons: Eventual consistency; higher complexity; user feedback becomes asynchronous; not ideal UX for 3–5s votes
- Cost: Low but non-zero; additional ops

Option C: Add Redis (memorystore) for hot-path token checks and dedupe
- Pros: Reduce DB load; fast token-claim race resolution
- Cons: Adds $30+/month; increases system complexity; not aligned with budget
- Cost: ≥$30/month

### Recommendation
I recommend: Option A — synchronous optimization with automated pre-warm & fast-fail strategy.

Key tactics:
1) Cloud Run
- elections: --max-instances 100; --concurrency 50; --startup-cpu-boost
- scheduled --min-instances 10 for 30 min pre-meeting (automation)

2) Pooling & Transactions
- Pool small (2–4) per instance; connectionTimeoutMillis ~200–300ms; idleTimeout 30s
- Single transaction: SELECT token FOR UPDATE NOWAIT → INSERT ballot → UPDATE token.used=true
- If NOWAIT conflict → return 409/423 quickly; client retry with jitter; ensure idempotent request signature

3) Query/index hygiene
- Unique index on voting_tokens(token_hash)
- Keep ballot table indexes minimal during spike path
- Defer non-critical audit writes or batch asynchronously after spike window

4) Error budgets and SLOs
- Target <5% failures during a 300/sec burst (per docs); retries should recover most quickly

Trade-offs:
- Gain: Maintains simple user flow and cost efficiency
- Lose: Requires careful test/tune; slight complexity in retry semantics

Cost Impact: $0/month

Implementation Effort: 2–3 days (including load test scripting)

Priority: Critical

Fallback Plan (if load tests fail): Introduce Cloud Tasks for a minimal smoothing queue only for ballots, keeping user feedback near-real-time (ack queued, poll status). Defer unless proven necessary.

---

## Challenge 4: Multi-Tenancy & Growth

### Current State Assessment
- Single org today (~3,000 members), potential 5–10 orgs later (10k–50k total)
- Services are logically separated; DB shared

### Options Evaluated
Option A: Shared DB + shared deployments, org_id column, RLS
- Pros: Lowest cost; simplest ops; single set of services; good isolation with Postgres RLS
- Cons: Requires disciplined schema and policy design; per-tenant noisy neighbor risk is low but present
- Cost: $0/month

Option B: Schema per tenant (same instance)
- Pros: Stronger logical isolation; per-tenant migrations
- Cons: Increases migration/ops complexity; code must handle schema selection; little benefit at small N
- Cost: $0/month (but higher toil)

Option C: Instance per tenant
- Pros: Max isolation, clear cost attribution
- Cons: Explodes cost and ops (>=$7/org/month); not aligned with budget or team size
- Cost: ≥$7 × tenants/month

### Recommendation
I recommend: Option A — single instance, shared schema with org_id and RLS.

Design:
- Add org_id to elections, tokens, ballots; composite unique keys include (org_id, …)
- Postgres RLS: policies ensure each service accesses only its org_id rows (service-level role binds org_id)
- Per-tenant API keys for S2S; Events → Elections calls include org_id in JWT/headers
- Per-tenant quotas and simple metering (count issued tokens, ballots) for cost attribution

Trigger to revisit:
- If >10 orgs or heavy concurrent events emerge, consider schema-per-tenant; if >20 orgs and cross-org SLAs required, revisit instance-per-tenant for specific heavy orgs

Trade-offs:
- Gain: Minimum cost and complexity, ready for 5–10 orgs
- Lose: Slightly more complex schema and auth policy

Cost Impact: $0/month

Implementation Effort: 2–4 days (schema migration, RLS policies, S2S propagation, tests)

Priority: Medium (prepare before onboarding 2nd org)

---

## Challenge 5: Observability & Operations

### Current State Assessment
- Cloud Logging + Monitoring available; no tracing; manual monitoring during meetings

### Options Evaluated
Option A: Lean observability baseline (logs + 2 dashboards + 4 alerts)
- Pros: Fast, free, high value; focuses on the spike window
- Cons: Less depth than full tracing
- Cost: ~$0/month

Option B: Adopt OpenTelemetry + Cloud Trace (1% sampling; 100% during meeting)
- Pros: Distributed tracing for S2S; powerful debugging
- Cons: More code and setup; moderate cognitive load for the team
- Cost: Low but non-zero; time to implement

Option C: Third-party APM (Datadog/New Relic)
- Pros: Rich features
- Cons: Expensive; overkill for budget and scope
- Cost: Not acceptable

### Recommendation
I recommend: Option A now; Option B as optional enhancement once baseline is stable.

**Baseline (A): Structured Logging Schema**
```javascript
// Standard log format across all services
const logEvent = {
  timestamp: new Date().toISOString(),
  service: 'elections-service',
  version: process.env.SERVICE_VERSION || 'unknown',
  level: 'INFO',
  request_id: req.headers['x-request-id'] || generateUUID(),
  correlation_id: req.headers['x-correlation-id'] || req.headers['x-request-id'],
  org_id: extractOrgId(req),
  method: req.method,
  path: req.path,
  status_code: res.statusCode,
  latency_ms: Date.now() - req.startTime,
  user_agent: req.headers['user-agent'],
  token_hash_prefix: req.tokenHash?.substring(0, 8), // First 8 chars only
  error_code: error?.code,
  error_message: error?.message,
  // Election-specific fields
  election_id: req.body?.election_id,
  vote_choice: req.body?.choice, // 'yes', 'no', 'abstain'
  // Database fields
  db_query_time_ms: queryEndTime - queryStartTime,
  db_connection_pool_size: pool.totalCount,
  db_idle_connections: pool.idleCount
};

console.log(JSON.stringify(logEvent));
```

**Correlation ID Generation Strategy**
```javascript
// Generate correlation ID at entry point (Members service)
const correlationId = `meeting-${meetingDate}-${crypto.randomUUID()}`;

// Propagate through all S2S calls
const s2sHeaders = {
  'X-Correlation-ID': correlationId,
  'X-Request-ID': crypto.randomUUID(), // Unique per hop
  'Authorization': `Bearer ${apiKey}`
};
```

**Dashboards (Cloud Monitoring)**:

Dashboard 1 - Elections Service Real-time:
- Requests/sec (last 5 minutes): `rate(elections_requests_total[5m])`
- P95 latency: `histogram_quantile(0.95, rate(elections_request_duration_seconds_bucket[5m]))`
- Error rate %: `(rate(elections_requests_total{status_code=~"5.."}[5m]) / rate(elections_requests_total[5m])) * 100`
- Active instances: `elections_service_instance_count`
- Vote submissions/sec: `rate(elections_votes_total[1m])`

Dashboard 2 - Database Health:
- Connection utilization %: `(postgres_connections_active / postgres_connections_max) * 100`
- Lock waits/sec: `rate(postgres_lock_waits_total[1m])`
- Transaction rate: `rate(postgres_transactions_total[1m])`
- Query latency P95: `histogram_quantile(0.95, rate(postgres_query_duration_seconds_bucket[5m]))`

**Alert Rules**:
- Elections error rate >5% (condition: 5-min window, 2-min eval frequency)
- Elections P95 latency >300ms (condition: 5-min window, 1-min eval frequency)  
- DB connections >80% of max (condition: 3-min window, 1-min eval frequency)
- DB lock waits >10/sec sustained (condition: 2-min window, 30-sec eval frequency)

Optional (B):
- Enable Cloud Trace via OpenTelemetry SDK with 1% sampling by default; elevate to 50–100% during the meeting

Trade-offs:
- Gain: Visibility where it matters; low/no cost
- Lose: Less depth than full tracing until Option B is enabled

Cost Impact: ~$0/month

Implementation Effort: 1–2 days

Priority: High

---

## Architecture Decision Records (ADRs)

### ADR-001: Automate Pre-Meeting Scale-Up and DB Tiering
Status: Proposed | Date: 2025-10-13 | Deciders: AI Architect

Context
- Manual pre-warm and DB tier change are fragile before a vote; system faces 300 rps spike for 3–5s

Decision
- Use Cloud Scheduler → Cloud Run/Function to set elections-service min-instances=10 and upgrade Cloud SQL to db-g1-small only when large attendance is expected; revert after meeting

Consequences
- Positive: Removes human error; preserves low steady-state cost; ensures readiness
- Negative: Adds small automation surface; requires careful IAM for infra updates

Alternatives Considered
1) Always keep db-g1-small — rejected due to ongoing cost
2) No automation — rejected due to risk of human error minutes before vote

### ADR-002: Keep Direct S2S + Add Resilience
Status: Proposed | Date: 2025-10-13 | Deciders: AI Architect

Context
- Two services only; budget tight; need reliability without new infra

Decision
- Maintain direct HTTP S2S with HMAC/API key per tenant; add timeouts, retries with jitter, small code-based circuit breaker, and idempotency keys

Consequences
- Positive: $0 cost; quick to implement; robust enough for current scope
- Negative: Policies not centralized; per-service code maintenance

Alternatives Considered
1) API Gateway — rejected for now: adds complexity with marginal value at current scale
2) Service Mesh — rejected as overkill

### ADR-003: Shared-DB Multi-Tenancy with org_id + RLS
Status: Proposed | Date: 2025-10-13 | Deciders: AI Architect

Context
- Single org today; target 5–10 orgs; need simple growth path without cost explosion

Decision
- Use org_id across tables with composite unique keys; enforce isolation with Postgres RLS; per-tenant API keys

Consequences
- Positive: Minimal cost; straightforward scaling to 5–10 orgs; secure isolation
- Negative: Slightly more complex schema and auth contexts

Alternatives Considered
1) Schema per tenant — deferred; revisit at >10 orgs
2) Instance per tenant — rejected as cost-prohibitive for now

---

## Implementation Roadmap

### Phase 1: Critical Changes (Next 1–3 months)
Goal: Eliminate manual risks; guarantee readiness; improve resilience

Changes:
1. Automation: Cloud Scheduler job(s) + tiny Cloud Run/Function
   - Prep: set elections min-instances=10; optional DB tier to g1-small; Cleanup: revert
   - Effort: 1 day; Cost: ~$0/month
2. Elections hot path hardening
   - Pool max 2–4; NOWAIT locking; 200–300ms connection timeout; 5s request timeout; 409/423 on lock
   - Effort: 1 day; Cost: $0
3. S2S resilience baseline
   - 1.0–1.5s timeouts; 2 retries w/ jitter (5xx/429 only); Idempotency-Key support; simple circuit breaker
   - Effort: 1 day; Cost: $0
4. Observability baseline
   - Structured logs; 2 dashboards; 4 alerts; runbook snippets in OPERATIONAL_PROCEDURES.md
   - Effort: 1 day; Cost: ~$0

Total Phase 1: 4–5 days; $0/month additional

### Phase 2: High Priority (3–6 months)
Goal: Validate at scale; reduce toil; improve visibility

Changes:
1. Load testing scripts (k6 or artillery) for the 300 rps scenario; include retries and lock conflicts
   - Effort: 1–2 days; Cost: $0
2. Optional: OpenTelemetry + Cloud Trace @1% default; 50–100% during meeting
   - Effort: 1–2 days; Cost: low (~$0)
3. Finalize automated criteria for DB tier upgrades based on forecasted attendance
   - Effort: 0.5 day; Cost: $0

Total Phase 2: 2–4 days; $0/month additional

### Phase 3: Strategic (6–12 months)
Goal: Prepare for multi-org growth and attribution

Changes:
1. Multi-tenant schema and RLS policies (org_id), per-tenant API keys and quotas
   - Effort: 2–4 days; Cost: $0
2. Cost attribution reports by org (tokens issued, ballots cast)
   - Effort: 0.5–1 day; Cost: $0
3. Review need for API gateway if orgs >5 and surface area grows (defer unless needed)
   - Effort: 0.5 day (evaluation); Cost: TBD if adopted

Total Phase 3: 3–6 days; $0/month additional

---

## Appendices

### A. Example Pool/Timeout Configuration (Node.js)
Events/Elections Postgres pool (pg):
```js
const pool = new Pool({
  max: process.env.DB_MAX_CONNS ? Number(process.env.DB_MAX_CONNS) : 3,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 250,
});

// Wrap queries with 500–800ms operation timeout
```

HTTP S2S client (axios/fetch):
```js
const TIMEOUT_MS = 1200;
// Retry policy: 2 retries on 5xx/429 with full jitter (25–100ms)
```

### B. Example Fast-Fail Transaction (pseudo-SQL)
```sql
BEGIN;
SELECT id FROM voting_tokens
 WHERE org_id = $1 AND token_hash = $2 AND used = false
 FOR UPDATE NOWAIT;  -- fail immediately if lock held

INSERT INTO ballots (org_id, election_id, choice, token_hash)
VALUES ($1, $3, $4, $2);

UPDATE voting_tokens SET used = true, used_at = now()
 WHERE org_id = $1 AND token_hash = $2;
COMMIT;
```

If NOWAIT throws lock error → return 409/423 + "retry-with-jitter" guidance. Ensure client idempotency key for duplicate submissions.

### C. Complete Load Testing Script (k6)

**File: `load-tests/voting-spike-test.js`**
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('error_rate');
const votingLatency = new Trend('voting_latency', true);

export let options = {
  scenarios: {
    voting_spike: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: 350,
      maxVUs: 400,
      stages: [
        { duration: '2s', target: 100 },  // Ramp up to 100 rps
        { duration: '1s', target: 300 },  // Spike to 300 rps  
        { duration: '3s', target: 300 },  // Hold 300 rps for 3 seconds
        { duration: '2s', target: 50 },   // Ramp down to 50 rps
        { duration: '2s', target: 0 },    // Ramp down to 0
      ],
    },
  },
  thresholds: {
    error_rate: ['rate<0.05'], // Less than 5% errors
    voting_latency: ['p(95)<300'], // P95 under 300ms
    http_req_duration: ['p(95)<500'], // Overall P95 under 500ms
  },
};

// Pre-generated voting tokens (setup required)
const VOTING_TOKENS = JSON.parse(open('./voting-tokens.json')); 
let tokenIndex = 0;

export default function () {
  // Get unique token for this VU iteration
  const token = VOTING_TOKENS[tokenIndex % VOTING_TOKENS.length];
  tokenIndex++;

  const url = `${__ENV.ELECTIONS_URL}/api/vote`;
  const payload = JSON.stringify({
    choice: ['yes', 'no', 'abstain'][Math.floor(Math.random() * 3)],
    election_id: __ENV.ELECTION_ID || 'test-election-2025'
  });

  const params = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `test-${__VU}-${__ITER}-${Date.now()}`,
      'X-Correlation-ID': `loadtest-${Date.now()}-${__VU}`,
    },
    timeout: '5s',
  };

  const startTime = Date.now();
  const response = http.post(url, payload, params);
  const duration = Date.now() - startTime;

  // Record metrics
  votingLatency.add(duration);
  
  const success = check(response, {
    'status is 200 or 201': (r) => [200, 201].includes(r.status),
    'status is not 5xx': (r) => r.status < 500,
    'response time < 1000ms': (r) => r.timings.duration < 1000,
  });

  errorRate.add(!success);

  // Brief sleep to prevent overwhelming the system between iterations
  sleep(0.1);
}

// Setup function to validate environment
export function setup() {
  console.log(`Testing Elections service at: ${__ENV.ELECTIONS_URL}`);
  console.log(`Election ID: ${__ENV.ELECTION_ID}`);
  console.log(`Voting tokens available: ${VOTING_TOKENS.length}`);
  
  // Validate service is reachable
  const healthCheck = http.get(`${__ENV.ELECTIONS_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`Elections service health check failed: ${healthCheck.status}`);
  }
  
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Load test completed in ${duration}s`);
}
```

**Setup Instructions:**

1. **Generate voting tokens** (run once before test):
```bash
# Create test tokens via Events service
node scripts/generate-test-tokens.js --count=500 --output=voting-tokens.json
```

2. **Run load test**:
```bash
# Install k6
brew install k6  # macOS
# or: sudo apt-get install k6  # Ubuntu

# Set environment variables
export ELECTIONS_URL="https://elections-service-ymzrguoifa-nw.a.run.app"
export ELECTION_ID="test-election-2025"

# Execute test
k6 run load-tests/voting-spike-test.js

# Generate HTML report
k6 run --out json=results.json load-tests/voting-spike-test.js
k6 report results.json --output results.html
```

3. **Expected Results** (meeting success criteria):
```
✓ error_rate................: 2.34% (target: <5%)
✓ voting_latency............: p(95)=287ms (target: <300ms)
✓ http_req_duration.........: p(95)=445ms (target: <500ms)
  iterations................: 2,847
  vus.......................: 300 (peak)
  data_received.............: 1.2MB
```

### D. Cloud Scheduler Automation Script

**File: `automation/scale-for-meeting.js`** (Cloud Function/Cloud Run)
```javascript
const { CloudRunClient } = require('@google-cloud/run');
const { SQLAdminService } = require('@google-cloud/sql');

exports.scaleForMeeting = async (req, res) => {
  const { action, attendees = 150 } = req.body; // 'prep' or 'cleanup'
  
  try {
    const results = await Promise.all([
      scaleElectionsService(action),
      attendees > 300 ? scaleDatabaseTier(action) : Promise.resolve('skipped')
    ]);
    
    res.json({
      success: true,
      action,
      attendees,
      results: {
        elections_service: results[0],
        database_tier: results[1]
      }
    });
  } catch (error) {
    console.error('Scaling failed:', error);
    res.status(500).json({ error: error.message });
  }
};

async function scaleElectionsService(action) {
  const client = new CloudRunClient();
  const minInstances = action === 'prep' ? 10 : 0;
  
  const request = {
    service: {
      name: 'projects/ekklesia-prod-10-2025/locations/europe-west2/services/elections-service',
      spec: {
        template: {
          metadata: {
            annotations: {
              'autoscaling.knative.dev/minScale': minInstances.toString(),
              'autoscaling.knative.dev/maxScale': '100'
            }
          }
        }
      }
    }
  };
  
  const [operation] = await client.updateService(request);
  return `Elections service scaled to min=${minInstances}`;
}

async function scaleDatabaseTier(action) {
  const sql = new SQLAdminService();
  const tier = action === 'prep' ? 'db-g1-small' : 'db-f1-micro';
  
  const request = {
    project: 'ekklesia-prod-10-2025',
    instance: 'ekklesia-db',
    requestBody: {
      settings: { tier }
    }
  };
  
  const operation = await sql.instances.patch(request);
  return `Database scaled to ${tier}`;
}
```

**Deployment:**
```bash
# Deploy to Cloud Run
gcloud run deploy meeting-scaler \
  --source=automation/ \
  --region=europe-west2 \
  --memory=256Mi \
  --timeout=300s \
  --no-allow-unauthenticated

# Create Cloud Scheduler jobs
gcloud scheduler jobs create http prep-meeting \
  --schedule="0 17 * * 0" \
  --uri="https://meeting-scaler-...-nw.a.run.app" \
  --http-method=POST \
  --message-body='{"action":"prep","attendees":300}' \
  --oidc-service-account-email="scheduler@ekklesia-prod-10-2025.iam.gserviceaccount.com"

gcloud scheduler jobs create http cleanup-meeting \
  --schedule="0 21 * * 0" \
  --uri="https://meeting-scaler-...-nw.a.run.app" \
  --http-method=POST \
  --message-body='{"action":"cleanup"}' \
  --oidc-service-account-email="scheduler@ekklesia-prod-10-2025.iam.gserviceaccount.com"
```

### E. SLO Targets (Meeting Window)
- Elections p95 latency < 300ms
- Elections error rate < 5%
- DB connections < 80% of max
- Lock waits not sustained > 10/sec (tuned via load tests)
- Vote processing rate > 250 votes/sec (sustained for 5 seconds)

---

End of document.
