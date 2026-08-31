---
description: Full performance and resource-cost audit of the entire the-platform repository (FastAPI/asyncpg/PostgreSQL/Redis/RabbitMQ backend services, the-frontend, shared libraries libs/*, Docker/Kubernetes/Helm infrastructure, k6 load testing in load-testing/) — three independent passes (instrumental profiling, line-by-line code review, architectural review), findings only with measurement (EXPLAIN ANALYZE, py-spy, bundle size, k6 runs), severity, file:line, and a final verdict.
argument-hint: "[path to the previous audit report, if this is a re-audit — optional]"
---

> Mode: analysis and report artifact only. Do not modify the project’s application code.
# Full repository performance and resource-cost audit

For the-platform project: a microservices CRM platform — FastAPI + asyncpg +
PostgreSQL + Redis + RabbitMQ backend services, a React/Vite/TS frontend
(the-frontend), Docker/Kubernetes/Helm infrastructure, load testing with k6
in `load-testing/`.

## ROLE

The company the product is built for is extremely sensitive to the
consumption of compute resources (CPU, RAM, network traffic, infrastructure
cost) — performance and economy are treated as a first-class priority, not as
tech debt to handle "someday later". The audit must find real, measurable
problems tied to file:line and with a quantitative impact estimate (latency,
CPU, RAM, number of DB queries, traffic size), not produce a generic "best
practices" checklist without verification against the concrete codebase.

## INPUT

`$ARGUMENTS` — optionally a path to the previous audit report or to
load-testing/reports for a "before → after" comparison. If not passed, look
for it yourself: `load-testing/ANALYSIS_GUIDE.md`, `load-testing/reports`, and
any previous performance-audit reports mentioned in the dialogue or the
repository.

This is an audit of the WHOLE repository. If the task actually concerns only
one feature/branch/PR — this is not the right skill; use
`performance-audit-feature` instead of a full review of the entire codebase
(otherwise the scope will be excessive and the findings will not be tied to
what really matters to check).

## KEY PRINCIPLE: MEASURE, DON'T GUESS

The main reason performance audits fail or, conversely, do harm is two
symmetric failures: (a) findings without proof of real impact ("this may be
slow") and (b) blindly piling on "optimizations" (caching, memoization,
denormalization) where there is no measured problem, which complicates the
code and creates a new class of bugs (stale cache, race condition) for a
nonexistent gain. Neither failure should occur:

1. For each finding where technically possible, confirm the impact by
   measurement: EXPLAIN ANALYZE for a SQL query, profiling (py-spy/cProfile)
   for a CPU hotspot, the real bundle size for the frontend, the output of
   existing k6 scenarios from `load-testing/` for the load characteristics of
   the API. A finding without a number is a hypothesis, not a finding; flag it
   explicitly as "not confirmed by measurement" and state what is needed to
   confirm it.
2. Do not propose optimization where there is no proven problem. If code is
   "non-idiomatic" but is not on a hot path and does not consume noticeable
   resources — record it as cosmetic/low, not as a performance finding. Three
   identical lines are better than premature abstraction; the same principle
   applies to caches and memoization.
3. Distinguish "theoretically suboptimal" from "really expensive at the
   current/expected data volume". An N+1 query on a table with 10 rows in the
   dev environment is not the same as an N+1 on a contacts/deals table with
   hundreds of thousands of rows in prod. Explicitly state at what data volume
   the finding becomes critical.
4. If an optimization was already made earlier (check git log/comments) —
   check whether it later regressed (e.g. a cache was added but invalidation
   was forgotten when a neighboring module was refactored).
5. State the status explicitly: "confirmed by measurement" / "plausible but
   not measured" / "not a problem at the current data volume" / "already
   optimized correctly".

## METHODOLOGY: THREE INDEPENDENT PASSES

Run the audit by three independent methods and do not let one pass substitute
for another — they have different blind spots.

### PASS 1 — Instrumental analysis and profiling

- **Backend (Python/FastAPI)**: enable SQL logging
  (echo=True/aiosqlalchemy debug) on the key scenarios and find N+1 queries
  and queries without LIMIT/pagination; where a DB connection is available —
  run EXPLAIN ANALYZE on the most frequent/heavy queries and record missing
  indexes (a seq scan where an index scan is expected); use py-spy/cProfile to
  profile CPU on suspect hot paths (webhook handlers, sync jobs,
  serialization of large responses).
- **Database**: pg_stat_statements (if enabled) for the top queries by total
  time and by number of calls; a list of tables without indexes on the columns
  used in WHERE/JOIN/ORDER BY (cross-check with each service's migration
  schema); table size and growth over time, if metrics are accessible.
- **Redis**: patterns of keys without TTL (risk of unbounded memory growth),
  KEYS/SCAN commands over the whole key space in the hot path, value size
  (serializing whole objects instead of the needed fields).
- **RabbitMQ**: prefetch/QoS configuration, queue depth, retry policies
  without backoff/DLQ.
- **Docker images**: dive or `docker history` on each built image — layer
  sizes, unused build tools and dev dependencies that ended up in the final
  image; compare against multi-stage build where it exists/is absent.
- **Frontend (the-frontend)**: build the production bundle and analyze it
  (`vite build --mode production` + rollup-plugin-visualizer/
  source-map-explorer, if wired in, or manual analysis of dist/ by chunk
  size); Lighthouse (or an analogue) on the key pages for LCP/TBT/bundle size
  metrics, if it is possible to bring up the frontend locally.
- **Load testing**: the repository already has k6 scenarios and reports in
  `load-testing/` (see `load-testing/ANALYSIS_GUIDE.md`, `load-testing/k6`,
  `load-testing/reports`). Read the existing reports — which bottlenecks were
  found earlier and not resolved; if the environment can be brought up — re-run
  the current scenarios and compare against the saved baseline reports.
- **Kubernetes/Helm**: checkov/kube-linter or a manual review of the charts
  for resources requests/limits (empty/missing — a risk of noisy neighbor and
  throttling; oversized — direct overspend of the infrastructure budget),
  liveness/readiness probe intervals (too-frequent probes = constant
  background load on N replicas), HPA configuration and its thresholds.

### PASS 2 — Manual line-by-line code review

Split the codebase into independent zones and review EACH (not diagonally,
not relying only on grep patterns):

- Each backend service separately (gateway, all `*-service` directories in
  `services/`).
- Frontend / SPA (`the-frontend`).
- Background handlers, bots, and external-API integrations
  (telegram-bot-service, telegram-connector-service,
  whatsapp-personal-service, kommo-integration-service,
  verification-bot-service, ai-bot-service) — this is the code with the
  highest risk of constant background load (polling, syncs, long-polling), not
  just request-response on demand.
- Shared libraries (`libs/shared_auth`, `libs/shared_metrics`) — code that
  runs on EVERY request of EVERY service; even a small inefficiency here is
  multiplied by the number of services and replicas.
- Infrastructure configs (`helm/`, `docker-compose*.yml`, `deploy/`,
  `infrastructure/`).

For each zone, look for (detailed checklist below) and for each finding
record: file:line, problem type, a quantitative impact estimate (or a "not
measured" mark), severity, status (see above).

### PASS 3 — Architectural review

Independently of the line-by-line review, assess whether the current
architecture can HOLD economy as load grows, not just be free of obvious
problems today:

- A "chatty" inter-service architecture: how many sequential synchronous HTTP
  calls one user request makes through gateway → services → services (build
  the chain for the 2-3 most frequent scenarios: login, deals/leads list,
  sending a chat message). Every extra hop is latency and CPU/network,
  multiplied by traffic.
- Whether a fixed replica count is justified (in
  `docker-compose.microservices.yml` the gateway is brought up in 3 instances,
  etc.) — is there real load data justifying this number, or is it "just in
  case"? The same for analogous decisions in helm-values (replicaCount).
- Duplication of shared libraries (shared_auth, shared_metrics) across
  services instead of a single package — if a performance fix/optimization is
  made in one copy, does it propagate automatically to the rest, or does the
  patch have to be rolled out N times (the same risk as for security patches)?
- A general caching strategy: does one even exist as a deliberate decision
  (what is cached, at what level, with what invalidation), or is a cache added
  pinpoint and unsystematically wherever someone once noticed a slowdown?
- Combining OLTP load (transactional services) and heavy analytics (Superset,
  analytics-service) on the same DB/instance — contention for resources.
- Presence of a process: is load testing (k6 in `load-testing/`) run regularly
  or one-off; is there a performance budget for the frontend bundle and API
  latency, enforced in CI rather than only "by feel"?

## DETAILED CATEGORY CHECKLIST

1. **Async backend: blocking calls in the event loop** — synchronous HTTP
   clients (requests, etc.) instead of httpx.AsyncClient/aiohttp inside async
   handlers; synchronous I/O (opening files, time.sleep, synchronous DB
   drivers) inside `async def`; CPU-heavy operations (parsing large JSON/XML,
   encryption, image processing) on the event loop without
   ThreadPoolExecutor/ProcessPoolExecutor; sequential `await` where the calls
   are independent and could go in parallel via `asyncio.gather` (a typical
   pattern in the gateway when calling several services to assemble one
   response).
2. **Database (PostgreSQL)** — N+1 queries (a loop with a DB query inside where
   one JOIN/`selectinload`/`joinedload` would do); missing indexes on columns
   in WHERE/ORDER BY/JOIN, especially on foreign keys (user_id, tenant_id,
   integration_id) and multi-tenant filtering; `SELECT *`/full serialization
   where 2-3 fields are needed; list endpoints without pagination/LIMIT;
   connection pool size relative to the number of replicas and the PostgreSQL
   limit; long transactions with external HTTP calls inside (a categorically
   unacceptable pattern); repeated identical queries within one request-response
   cycle.
3. **Caching (Redis)** — keys without TTL; absence of a cache for expensive,
   frequently repeated, and rarely changing computations (dashboard aggregates,
   reference data, roles); cache stampede (no lock/single-flight on
   expiration); a cache without invalidation when the source data changes
   (record separately as a correctness problem, not only a perf one); KEYS/SCAN
   over the whole database in the hot path; storing large blobs instead of
   specialized storage.
4. **Inter-service communication (HTTP)** — absence of timeouts on outbound
   requests; absence of retry with exponential backoff (or retry without
   backoff — a thundering herd during a partial incident); duplicate calls to
   one service instead of a batched call; full forwarding of heavy payloads
   where only part of the data is needed.
5. **Queues (RabbitMQ) and background handlers** — prefetch/QoS (too large
   overloads the consumer, too small underuses parallelism); poison message
   without DLQ; external-API polling frequency (kommo-integration-service,
   telegram-connector-service, whatsapp-personal-service) relative to the real
   need, batch size, rate-limit handling (429/retries).
6. **Serialization and payload size** — Pydantic models returning
   significantly more fields than are actually used; logging large
   objects/payloads in full in the hot path; absence of compression
   (gzip/brotli) on the gateway for large JSON responses.
7. **Frontend (React/Vite/TS)** — production bundle size and absence of
   code-splitting/lazy-loading for rarely used routes; unoptimized
   images/static assets; excessive re-renders on large lists/tables
   (leads/deals) — absence of virtualization, new objects/callbacks in render
   without memo where the profiler clearly shows a hotspot (do not add
   memo/useCallback everywhere "just in case" — that also costs resources
   without a measured benefit); waterfall data loading instead of parallel;
   too-frequent polling where WebSocket/SSE would be more appropriate, or a
   WebSocket with excessive reconnect/heartbeat.
8. **Docker images** — final image size per Dockerfile (services/*,
   the-frontend); absence of multi-stage build where build dependencies end up
   in the final layer; an oversized base image (full OS instead of
   slim/alpine/distroless), if that does not create compatibility problems.
9. **Kubernetes/Helm** — resources requests/limits: missing (noisy neighbor,
   OOM-kill) and, at the same time, oversized "with a margin" without a basis
   in real consumption; liveness/readiness/startup probe intervals/timeouts on
   a large number of replicas; replicaCount and HPA thresholds — are they
   justified by numbers; init containers and pod startup logic — do they block
   readiness longer than necessary?
10. **Observability as a source of overhead** — metric cardinality
    (shared_metrics): high-cardinality labels (user_id, request_id as a label
    instead of a value); trace sampling frequency/volume; logging volume and
    level in prod (DEBUG logs "for convenience"); synchronous sending of
    metrics/traces in the hot path instead of batching/async sending.
11. **Algorithmic efficiency and data structures** — quadratic and
    worse-complexity operations over collections that will become a bottleneck
    at real data volumes (leads/contacts/chat-message lists grow over time);
    repeated parsing/recomputation of the same data within one request;
    unnecessary deep copying of large structures; absence of batching for bulk
    operations (leads import, syncs with external CRMs) where the operation
    volume is regularly large.
12. **Load testing and performance budgets** — currency of the k6 scenarios
    (load-testing/k6) relative to the current API contracts; discrepancy
    between the bottlenecks documented in load-testing/reports and
    load-testing/ANALYSIS_GUIDE.md and the current state of the code (are they
    actually fixed, or did the report remain un-updated — "fixed on paper");
    presence or absence of recorded performance budgets in CI (maximum bundle
    size, maximum p95 latency) — without such a gate, performance regressions
    slip into prod unnoticed.

## EDGE CASES OFTEN MISSED

- "Runs fast on dev data" — the problem shows only at real customer data
  volumes (thousands of leads, tens of thousands of chat messages); always
  estimate the expected growth.
- Debug conveniences forgotten in prod: verbose logging, disabled response
  compression, disabled cache "to make debugging easier" — and not turned back
  on.
- Health/readiness probes that hit the DB or external services on every
  N-second check, multiplied by the number of replicas — in total a noticeable
  background load on the DB with no business value.
- Several independent services polling the same external API redundantly
  instead of a shared cache/single synchronization point.
- Retry logic without backoff, amplifying load precisely at the moment of a
  partial incident (when resources are already scarce).
- Heavy analytical queries (Superset/analytics-service) running on the same
  DB/instance as the transactional load, during CRM peak load hours.
- "Optimization for optimization's sake": a cache/memoization/denormalization
  added without a measured problem — increases the complexity and volume of
  code that must be maintained and that itself consumes resources (cache
  memory, synchronization), without a proven benefit. Record such findings
  too — propose simplification.
- Configuration differences between environments (dev/staging/prod) in
  docker-compose/helm-values — an optimization made for one environment may be
  absent in another.
- Feature flags forgotten after experiments, doubling the work (writing to the
  old and the new system at once "during the migration", which finished long
  ago).

## REPORT FORMAT

1. Executive summary (for leadership, no technical jargon): what consumes
   resources most noticeably, what can be optimized without risk to
   functionality first, the approximate effect (in terms of
   latency/load/infrastructure resources).
2. KPI table: number of findings by severity (critical/high/medium/low),
   number of findings confirmed by measurement vs "plausible but not
   measured"; the approximate total resource savings from eliminating the
   critical findings, if it can be estimated.
3. If this is a re-audit — a comparison table "previous-report/load-testing
   item → current state (file:line) → status (not fixed / on paper /
   selectively / fixed)".
4. A "fixed but not working" section separately (e.g. an index was added in the
   migration, but the query still does a seq scan due to a type/function
   mismatch in WHERE).
5. Full list of findings tied to file:line, with a quantitative impact estimate
   (or an explicit "not measured" mark and what is needed to measure it),
   severity, and a concrete remediation recommendation (not "optimize the
   query", but "add an index on (tenant_id, created_at)", "replace the N+1 with
   selectinload", "move the external API call out of the transaction body").
6. A "what was done well" section — efficient patterns in the codebase worth
   replicating to other services rather than redoing.
7. Action plan by timeframe: quick pinpoint fixes without regression risk
   (indexes, timeouts, fixing N+1) — first; changes requiring testing under
   load — second; architectural decisions (rethinking the caching strategy,
   reducing the number of inter-service hops, a scaling plan) — as
   leadership/team-lead-level decisions.
8. A "methodology and coverage limitations" section — which tools and
   measurements were used, which services/zones were NOT profiled or loaded and
   why (no access to prod metrics, no ability to bring up the environment,
   etc.), so the absence of findings in an uncovered zone does not read as
   "everything there is optimal".

## FINDING FORMATTING RULES

For each finding, the following are mandatory:

- The file path and line number (or range).
- The problem name and category (see the checklist above).
- A quantitative impact estimate: measured (number of DB queries, EXPLAIN
  ANALYZE output, profiling time, bundle/image size in MB, p50/p95 latency) or
  explicitly marked as an unmeasured estimate with justification for why it is
  likely.
- The condition under which the problem becomes critical (data volume, number
  of concurrent users, call frequency) — if it does not hold today but will
  hold as things grow, state it explicitly; do not under- or over-state the
  urgency.
- Severity with justification (what share of traffic/data is affected, which
  resource is consumed: CPU, RAM, network traffic, number of DB connections,
  infrastructure cost).
- Status relative to the previous audit/load-testing report, if applicable.
- A remediation recommendation — concrete and preserving the current
  functionality (the audit should not propose changing the system's behavior,
  only the efficiency of its implementation).

## RUNNING THE AUDIT (practical instructions)

1. Determine the scope: list all backend services (services/*), the frontend
   (the-frontend), shared libraries (libs/*), background bots/connectors,
   infrastructure configs (helm/, docker-compose*.yml, deploy/,
   infrastructure/), existing load tests (load-testing/).
2. Read the existing load-testing artifacts (load-testing/ANALYSIS_GUIDE.md,
   load-testing/reports) BEFORE starting the manual review — it is a ready
   source of already known bottlenecks; don't duplicate work, just check
   whether they are resolved.
3. Run the available tools of PASS 1 on each service/image/chart where possible
   in the current environment; save the raw output for report appendices.
4. Split the manual review of PASS 2 into independent chunks (by service/zone)
   — if the Agent tool is available, launch several independent subagents on
   different zones in parallel (in foreground, if the result is needed
   immediately in this dialogue), so as not to miss volume and not to let one
   agent "cut corners" across the whole codebase at once.
5. Perform the architectural review of PASS 3 separately, independently of the
   PASS 2 results.
6. Consolidate all three passes into a single report per the format above,
   remove duplicates, but do not merge findings of different natures (a tool
   found a suspicious pattern ≠ manual review confirmed real impact — record
   both facts if both exist, with the corresponding confirmation status).
7. If this is a re-audit — be sure to re-verify EACH item of the previous
   report and each finding from load-testing/reports against the current state
   of the code, rather than relying on the status claimed by the team.
8. Explicitly state which checks were NOT performed (no access to prod
   metrics/pg_stat_statements, no ability to bring up the environment for
   profiling or a k6 run, no data on real customer data volumes) — this is part
   of an honest report, not its weakness.
9. No recommendation should change the observable behavior/functionality of the
   system — only the efficiency of the implementation. If an optimization
   inevitably requires a behavior change (e.g. tightening default pagination) —
   note this separately and explicitly.

This is an audit, not implementation: the developer makes the changes based on
the report, not you within this skill.

