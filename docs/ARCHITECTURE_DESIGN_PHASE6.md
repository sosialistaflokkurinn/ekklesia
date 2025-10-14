# Ekklesia Architecture Design (Phase 6: Next 6–12 Months)

Document type: Architecture Design Proposal (5–10 pages)
Date: 2025-10-13
Author: Senior Software Architect

---

## Executive Summary

Current system is a pragmatic 3-service architecture optimized for cost and simplicity:
- Members (Firebase Hosting + Cloud Functions, Python) for authentication via Kenni.is and membership verification.
- Events (Cloud Run, Node.js) for election administration and token issuance.
- Elections (Cloud Run, Node.js) for anonymous ballot recording and results.
- PostgreSQL (Cloud SQL, db-f1-micro) shared by Events and Elections; cost ~$7–13/month overall.

Strengths
- Simple, serverless-first design with strong isolation: PII lives only in Members/Events; Elections remains anonymous.
- Proven in production with end-to-end voting and S2S integration; costs are far below alternatives.
- Clear operational playbook; minimal moving parts; small-team friendly.

Key risks
- Voting spike (300 votes/sec) stresses DB connections and Cloud Run scaling; currently mitigated with fail-fast and manual pre-warming.
- Limited observability; no distributed tracing; manual monitoring during meetings.
- Multi-tenancy not yet formalized; org isolation and per-tenant cost/usage tracking need a clear approach.

Top 3 recommendations
1) Keep single Postgres instance; implement strict connection pooling, fail-fast 503 + client retry, and time-boxed pre-warming via Scheduler. Automate temporary db-g1-small upgrade only when needed.
2) Harden S2S communication with HMAC-signed requests, add idempotency keys, and application-level circuit breakers/retries. Keep gateway/mesh out (cost/complexity) for now.
3) Establish a lean observability baseline: JSON structured logs + trace IDs, Cloud Monitoring dashboards and alerts, request sampling traces via OpenTelemetry. Add a 30-minute load test harness and a meeting-day runbook.

Budget impact (steady state): +$0–$3/month; occasional large meetings may temporarily raise Cloud SQL to $25/month for that month only. All-in, remains within $20–50/month envelope.

Implementation timeline
- Phase 1 (1–3 months): connection pooling, scheduler pre-warm toggle, HMAC + idempotency, dashboards/alerts, tracing bootstrap, load test scripts. (~3–6 days of engineering)
- Phase 2 (3–6 months): multi-tenancy schema (org_id, RLS), migration scripts, per-tenant secrets/keys, cost attribution. (~4–8 days)
- Phase 3 (6–12 months): DR drills (backup/restore), optional queue fallback, blue/green DB migrations. (~4–8 days)

---

## Detailed Analysis (per Challenge)

### 1) Database Scaling Strategy

Current state
- Cloud SQL PostgreSQL 15 on db-f1-micro (25 connections); shared by Events and Elections.
- Elections requires short heavy burst (300 votes/sec, 3–5s). Current approach uses row-level locking and fail-fast behavior; manual pre-warm of Cloud Run.

Options evaluated
- A) Stay on single DB; enforce strict pooling (2–5 conns/instance), rely on fail-fast + retry, and temporarily upgrade to db-g1-small for large meetings only.
- B) Add pgbouncer or sidecar pooling. Not a fit for Cloud Run without extra ops cost/containers; adds operational complexity.
- C) Separate DBs per service. Doubles ops/cost; unnecessary for current scale and coupling.
- D) Use a queue (Pub/Sub) to decouple Elections from DB write rate. Adds latency, complexity, and moving parts; may be warranted only if real spikes exceed DB capacity.

Recommendation
- Choose A. Keep single instance and two schemas; tune pooling and fail-fast. Use a scheduled toggle to pre-warm Cloud Run (min instances) and, if needed, upgrade Cloud SQL to db-g1-small only for the meeting month.

Design details
- Elections
  - pg Pool max=2–3 per instance; connectionTimeoutMillis=2000; idleTimeoutMillis=30000.
  - Enforce fail-fast pattern with `FOR UPDATE NOWAIT`; return 503 with short retry-after.
  - Keep transaction tight: verify token status + insert ballot + mark token used in one short transaction; ensure proper indexes.
- Events
  - pg Pool max=5–10 per instance; peak token issuance ~13 rps → ample headroom.
- Operational toggles
  - Cloud Scheduler job to set `--min-instances` for Elections to 10–20 ten minutes before vote; reset to 0 after meeting.
  - Optional: Scheduler/Run job to apply db tier upgrade one day before large meeting and downgrade afterwards.

Trade-offs
- Pro: Minimal cost; retains simplicity; handles realistic spikes via fail-fast + retry and pre-warm.
- Con: Requires a small amount of pre-meeting ops (automated Scheduler scripts). Very large spikes may still return brief 503 bursts (client retries mask user impact).

Cost impact
- Steady state: $7/month.
- Large meeting: temporary db-g1-small: $25 for that month; otherwise unchanged.

Effort & priority
- 1–2 days; Critical.

---

### 2) Service Communication Patterns

Current state
- Members → Events via Firebase JWT; Events → Elections via S2S API key.
- No gateway or mesh; direct HTTPS across Cloud Run URLs.

Options evaluated
- A) Keep direct S2S; add HMAC signing (shared secret), timestamp + nonce (anti-replay), idempotency keys, and retries with exponential backoff.
- B) Add Cloud Endpoints/ESPv2. Modest complexity; some control plane overhead; cost is near-zero, but adds setup/maintenance.
- C) Adopt mesh (Istio) on GKE. Not aligned with budget/complexity.

Recommendation
- Choose A. Keep it simple. Harden S2S with:
  - HMAC signature header over `(method|path|timestamp|nonce|bodyHash)` using Secret Manager key.
  - `X-Idempotency-Key` on S2S writes (token registration) and public vote endpoint.
  - Circuit breaker in Elections for S2S reads (results), with retries and jitter.
  - Structured, signed audit logs for S2S events.

Trade-offs
- Pro: Zero infra cost; minimal latency; full control.
- Con: Custom code to maintain; slightly more app logic.

Cost impact
- $0.

Effort & priority
- 1–2 days; High.

---

### 3) Voting Spike Load (300 votes/sec)

Current state
- Cloud Run: `--max-instances 100`, `--concurrency 50`, startup CPU boost.
- Fail-fast locking and 503 retry recommended; pre-warming done manually.

Options evaluated
- A) Pre-warm via Scheduler; strict pooling; 503+retry client; keep max-instances=100.
- B) Introduce queue (Pub/Sub) to buffer votes, with worker processing. Smooths write burst but adds latency/ops and more failure modes.
- C) Use a small in-memory cache to short-circuit token-status reads. Helpful for token-status GETs, but write path still DB-bound.

Recommendation
- Choose A. Implement scheduler pre-warm; tighten DB transaction & indexes; ensure 503 retry logic in client pages; keep `--concurrency 50` and `--max-instances 100`.

Trade-offs
- Pro: Meets the 3–5s spike without new infrastructure; minimal cost.
- Con: Relies on Cloud Run scale dynamics; some users may see a single retry.

Cost impact
- $0–$2 per big meeting (Cloud Run execution time).

Effort & priority
- 1–2 days; Critical.

---

### 4) Multi-Tenancy & Growth

Current state
- Single org (Sósíalistaflokkurinn). Architecture logically separates concerns; no explicit tenant isolation yet.

Options evaluated
- A) Logical multi-tenancy (single DB, org_id column everywhere, RLS policies, per-tenant API keys/secrets, tenant-aware logging/metrics).
- B) Database-per-tenant. Strong isolation but high cost/ops overhead.
- C) Project-per-tenant. Strongest isolation, highest cost/ops.

Recommendation
- Choose A. Implement logical multi-tenancy:
  - Add `org_id` (UUID) to Elections tables and Events tables; backfill with default tenant.
  - Create Postgres RLS policies enforcing `current_setting('app.org_id')` context (set from API layer per request after auth).
  - Per-tenant S2S API keys (Secret Manager) and per-tenant config in Events.
  - Tenant-aware logging: include `tenant`, `correlation_id` in all logs; label metrics with `org_id`.
  - Cost allocation via log-based metrics and monthly export.

Trade-offs
- Pro: Low cost; fast to implement; flexible scaling.
- Con: Isolation-by-policy (not physical); requires discipline and tests.

Cost impact
- $0 steady-state.

Effort & priority
- 3–5 days; High (implement when onboarding second org is imminent).

---

### 5) Observability & Operations

Current state
- Basic Cloud Logging/Monitoring; no tracing; manual oversight during meetings.

Recommendation
- Logging
  - JSON structured logs across all services with fields: `ts`, `service`, `severity`, `correlation_id`, `tenant`, `user_agent`, `route`, `latency_ms`, and domain fields (e.g., `election_id`).
  - Propagate `X-Correlation-ID` from Members → Events → Elections.
- Metrics & Alerts
  - Dashboards: request rate, error rate, latency (p95), instance count, DB connections, lock waits.
  - Alerts: Elections error rate >5% for 60s; DB connection pool exhaustion; instance count < expected during spike window.
  - Uptime checks on `/health` for Events/Elections.
- Tracing
  - Adopt OpenTelemetry SDK for Node.js (Events/Elections) with sampler (e.g., 5–10%) to Cloud Trace.
  - Tag spans with `tenant`, `route`, `db.statement` excluded or sanitized.
- Runbooks & Load Testing
  - Meeting-day runbook: toggle pre-warm, verify dashboards, perform canary vote, monitor p95 and errors.
  - k6/Artillery scripts to simulate vote spike; store results in repo; run before large meetings.

Cost impact
- $0–$1/month (logs/metrics within free tier given monthly use). Cloud Trace sampling kept low.

Effort & priority
- 2–3 days; High.

---

## Architecture Decision Records (ADRs)

### ADR-001: Database Scaling via Strict Pooling + Pre-Warm + Optional Tier Bump
Status: Proposed
Context: Elections requires brief 300 rps spike; budget is $20–50/month; ops must remain simple.
Decision: Keep single Cloud SQL instance; enforce strict pooling and fail-fast retries; pre-warm Cloud Run via Scheduler; upgrade to db-g1-small only for large meetings when needed.
Consequences: Minimal cost; small operational steps (automated); brief retries expected; avoids new infra.
Alternatives: Queue-based smoothing (more moving parts), multi-DB (higher cost), pgbouncer sidecars (ops complexity).

### ADR-002: Keep Direct S2S with HMAC + Idempotency
Status: Proposed
Context: S2S currently uses API key; need stronger integrity and replay protection without adding gateways.
Decision: Add HMAC signature, timestamp/nonce, and `X-Idempotency-Key`; implement retries/circuit breaker. Keep gateway/mesh out for now.
Consequences: $0 cost; modest code changes; stronger integrity and operational resilience.
Alternatives: Cloud Endpoints (more setup), service mesh (overkill).

### ADR-003: Lean Observability Baseline (Logs, Metrics, Light Tracing)
Status: Proposed
Context: Need better visibility during vote spikes without recurring cost.
Decision: JSON logs with correlation IDs, Cloud Monitoring dashboards + alerts, 5–10% tracing via OpenTelemetry.
Consequences: $0–$1/month; quick to implement; big operational value.
Alternatives: Full APM suites (higher cost, not needed).

---

## Implementation Roadmap

Phase 1 (1–3 months)
- Elections/Events: tighten pg Pool settings; add 503 retry logic on client; confirm DB indexes and short transactions.
- Cloud Scheduler: scripts to set `min-instances` before/after meetings; optional script to upgrade/downgrade DB tier.
- S2S hardening: HMAC signature, timestamp/nonce, idempotency keys; app-level retries with jitter.
- Observability: structured logs, correlation IDs, dashboards (rate/error/latency/instances/db), alerts; add basic OpenTelemetry tracing.
- Load tests: k6 scripts for 300 rps spike; document success criteria (p95 <300ms, <5% errors).

Phase 2 (3–6 months)
- Multi-tenancy: add `org_id`, enforce RLS, backfill data; per-tenant API keys/secrets; tenant-aware logging/metrics.
- Cost attribution: log-based metrics per tenant; monthly report script.
- DR validation: backup/restore documented test for Elections schema.

Phase 3 (6–12 months)
- Optional queue fallback path behind feature flag if real spikes exceed DB: Pub/Sub topic with small worker pool; document latency and failure semantics.
- Zero-downtime DB migrations (blue/green or pg_repack patterns) for future schema changes.
- Continuous load testing pipeline before major meetings.

---

## References (source documents reviewed)
- `docs/status/CURRENT_PRODUCTION_STATUS.md`
- `docs/SYSTEM_ARCHITECTURE_OVERVIEW.md`
- `docs/USAGE_CONTEXT.md`
- `events/README.md`, `elections/README.md`, `members/README.md`
- `docs/security/CREDENTIAL_MIGRATION_PLAN.md`
- Repository configuration and deployment scripts (`events/deploy.sh`, `elections/deploy.sh`)

---

## Appendix

### Suggested pg Pool settings (Node.js `pg`)
```js
const pool = new Pool({
  max: process.env.DB_POOL_MAX ?? 3,           // Elections: 2–3 per instance
  min: process.env.DB_POOL_MIN ?? 0,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,              // fail fast
});
```

### Suggested retry headers (Elections)
- `Retry-After: 1` on 503 responses.
- Client retry policy: up to 2 retries within 3 seconds with jitter.

### Suggested HMAC signature (Events → Elections)
Headers:
- `X-Timestamp`, `X-Nonce`, `X-Signature: base64(hmacSHA256(secret, method|path|timestamp|nonce|bodyHash))`

### Minimal dashboards/alerts
- Dashboard widgets: Request rate, 4xx/5xx, p95 latency, instance count, DB connections, lock waits.
- Alerts: Elections 5xx >5% for 60s; DB connections >80% for 60s; instance count < expected during scheduled spike.
