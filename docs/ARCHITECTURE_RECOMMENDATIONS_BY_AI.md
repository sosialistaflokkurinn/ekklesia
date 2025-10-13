# Architecture Recommendations (By AI) — Ekklesia Voting Platform

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

### Cost Impact Summary
- Current monthly cost: ~$7–13/month
- After changes (typical month): ~$7–13/month (no ongoing increase)
- During a large meeting day (if DB tiered up for one day): ~$7 + ~$0.80 prorated = ~$8/month effective
- Annual delta: ~+$10/year worst case (negligible)

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
- Timeouts: 1.0–1.5s for Elections S2S; 500–800ms for internal DB calls
- Retries: 2 attempts with full jitter (25–100ms) on 5xx/429 only; idempotency keys
- Circuit-breaker: simple “consecutive failure threshold” in code (open 2s, half-open thereafter)
- Idempotency: S2S endpoints accept Idempotency-Key; dedupe server-side by that key
- Auth: maintain per-tenant API keys (anticipates multi-tenancy), rotate via Secret Manager

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

Baseline (A):
- Structured logs everywhere {request_id, correlation_id, org_id, path, status, latency_ms, token_hash_prefix}
- Dashboards (Cloud Monitoring):
  1) Elections: requests/sec, p95 latency, error rate, instance count
  2) Database: connections %, lock waits, TPS
- Alerts:
  - Elections error rate >5% (5-min window)
  - Elections p95 latency >300ms (5-min window)
  - DB connections >80% of max (5-min window)
  - DB lock waits sustained > X/sec (tune via testing)

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

If NOWAIT throws lock error → return 409/423 + “retry-with-jitter” guidance. Ensure client idempotency key for duplicate submissions.

### C. SLO Targets (Meeting Window)
- Elections p95 latency < 300ms
- Elections error rate < 5%
- DB connections < 80% of max
- Lock waits not sustained > X/sec (define via tests)

---

End of document.
