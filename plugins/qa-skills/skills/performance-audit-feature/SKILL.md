---
name: performance-audit-feature
description: Focused performance and resource-cost audit of ONE specific feature/change in the-platform (not the whole codebase) — scope taken from a directory/branch/diff, a requirements document, or a YouTrack issue; the same measurement discipline as the full audit (EXPLAIN ANALYZE, py-spy, bundle size, k6), a "before/after" comparison if the feature replaces existing functionality, an explicit production-readiness verdict. Use when asked to check the performance/resource consumption of a specific feature, branch, PR, or YouTrack task before merge/release, to assess whether a new implementation degraded existing functionality in speed/resources, or to give the resource-cost green light for that specific change — even without the word "audit", e.g. "will this feature take down the database", "how much will this eat at real volumes", "is this branch ready performance-wise".
argument-hint: "[path to a directory/branch/diff, path to a requirements document, or a YouTrack issue ID/link]"
disallowed-tools: Edit, Write
---

# Feature-scoped performance audit

For the-platform project: a microservices CRM platform — FastAPI + asyncpg +
PostgreSQL + Redis + RabbitMQ backend services, a React/Vite/TS frontend
(the-frontend), Docker/Kubernetes/Helm infrastructure, load testing with k6
in `load-testing/`.

This is the focused version of the full repository audit (see the
`performance-audit-full` skill if the task is the whole repository rather
than a single feature). The measurement principles are the same, but the
scope, findings, and report are strictly limited to the code that belongs to
this feature and to what it touches.

## INPUT

Feature: `$ARGUMENTS`

The prompt is universal in input format. Depending on what is passed, first
reconstruct the feature's scope:

**A. Directory/branch/diff** (e.g.
`the-frontend/src/features/leads-import` or "diff between dev and the
feature/PROJ-XXXX branch"):
- Determine the affected files via `git diff --stat` against the base branch
  (main/dev), or read the whole directory contents if it is a self-contained
  module.
- Determine which services/packages those files touch (services/*,
  the-frontend, libs/*) — that is the scope of PASS 2 below.

**B. Requirements document** (path to a .md/.txt/design doc, etc.):
- Read the document in full, write out the described use cases and the
  expected endpoints/screens/background processes.
- Find the code implementing those use cases in the repository (grep by the
  endpoint/route/component names and the names from the document) — if the
  implementation is absent or found only partially, record this explicitly in
  the report as a separate item ("not implemented — testing impossible");
  don't invent it.

**C. YouTrack issue** (an ID or a link):
- Fetch the issue text (through the available YouTrack MCP/API, or ask the
  user to paste the text if there is no direct access) — description,
  acceptance criteria, related commits/PRs.
- If the issue or the related commits specify concrete files/services, that
  is the scope; if not, determine the scope from the description as in item B,
  and by `git log --grep=<ID>` for related commits.

If none of the three sources determines the scope unambiguously (it is
unclear which code belongs to the feature), stop and explicitly list what
needs to be clarified with the task author, rather than blindly testing the
entire service.

## KEY PRINCIPLE: MEASURE, DON'T GUESS

The company is extremely sensitive to the consumption of compute resources
(CPU, RAM, network traffic, infrastructure cost) — this is a first-class
priority. For a feature, which has often not yet been under real load, it is
especially important not to confuse "looks fine on dev data" with "will
withstand prod volume". Follow the same rules as in the full audit:

1. For each finding where technically possible, confirm the impact by
   measurement: EXPLAIN ANALYZE for new/changed SQL queries, profiling
   (py-spy/cProfile) for a new CPU hotspot, the real bundle/chunk size for new
   frontend code, a k6 scenario (a new one or an extended existing one) for
   the load characteristics of the new/changed API. A finding without a number
   is a hypothesis; flag it explicitly as "not confirmed by measurement".
2. Do not propose optimization where there is no proven problem — three
   identical lines are better than premature abstraction; the same principle
   applies to caches and memoization in new code.
3. Explicitly state at what data volume/load the finding becomes critical,
   accounting for realistic growth for this specific feature (e.g. leads
   import — test not on 10 records but on a volume comparable to a real
   customer export). The source for estimating the volume, by priority: (a)
   prod metrics/dashboards, if you have access; (b) the order of magnitude
   from existing load-testing/reports for the same domain; (c) a direct
   question to the task author/PM about the real customer volume. If none of
   the sources is available, record this as a coverage limitation (see
   "methodology and coverage limitations" in the report format), rather than
   substituting an arbitrary number.
4. If the feature replaces/modifies existing functionality, check whether
   performance degraded compared to what was before (a "before/after"
   comparison is mandatory where there is something to compare against).
   Technically obtain the "before" state: `git worktree add` (or switch to a
   copy of the base branch) at the commit before the feature's first commit —
   run the same EXPLAIN ANALYZE/profiling/bundle build on that copy and
   compare the numbers directly; for a single query/component without spinning
   up an environment, `git show <base-ref>:path` is enough to read the prior
   implementation and compare it algorithmically (query count, complexity) —
   flag such a comparison explicitly as "not measured, estimate from code",
   not as a measured result.
5. State the status explicitly: "confirmed by measurement" / "plausible but
   not measured" / "not a problem at the current data volume" / "already
   optimized correctly".

## METHODOLOGY: THREE INDEPENDENT PASSES (within the feature scope)

### PASS 1 — Instrumental analysis and profiling of the new/changed code

- **Backend**: enable SQL logging on this feature's specific scenarios and
  find N+1/queries without LIMIT in the new code; run EXPLAIN ANALYZE on the
  new/changed queries; py-spy/cProfile on the new handlers, if a CPU hotspot
  is suspected.
- **Database**: verify that the feature's new columns/filters are covered by
  indexes (cross-check with the migration schema that introduces this
  feature); if the feature adds a new table, estimate the expected growth and
  access patterns.
- **Redis/queues**: if the feature introduces new Redis keys — is there a TTL;
  if it introduces a new queue/consumer — prefetch/QoS, DLQ, behavior when
  polling an external API.
- **Frontend**: if the feature adds a screen/component — build the prod build
  and check the bundle/chunk size increase from this feature specifically
  (compare before/after size if there is a baseline); check for code-splitting
  for the new route; run Lighthouse (or an analogue) on the new screen for
  LCP/TBT, if the frontend can be brought up locally.
- **Load testing**: check whether load-testing/k6 has a scenario covering this
  feature's new/changed endpoints. If not — where possible, write a minimal k6
  scenario for this feature and run it (if the environment can be brought up);
  if a scenario already exists, run it and compare against the baseline in
  load-testing/reports.
- **Docker/Helm**: only if the feature changes the Dockerfile/values/chart (a
  new service, a new dependency, a change to resources) — otherwise this item
  does not apply; explicitly mark it "not touched by the feature".

### PASS 2 — Manual line-by-line review of the code touched by the feature

Review line by line (not diagonally) all the code identified in the "Input"
step as the feature's scope: new/changed files of the backend service(s),
frontend components, changes in shared libraries (libs/shared_auth,
libs/shared_metrics — if the feature touches them, this is code that runs on
every request of every service; treat it with heightened attention),
background handlers, infrastructure configs. Use the detailed checklist below
— pick from it the categories applicable to the feature type (they need not
all match all 12 — e.g. a pure frontend feature will have no RabbitMQ
findings).

### PASS 3 — The feature's impact on architecture and neighboring scenarios

Independently of the line-by-line review, assess:

- Does the feature add new synchronous inter-service hops to existing
  frequent scenarios (login, deals/leads list, sending a chat message) —
  count the call chain before and after the feature appears.
- If the feature reuses/duplicates existing functionality (yet another poll
  of the same external API, yet another cache for the same data) — can the
  existing mechanism be reused instead of adding a new one?
- Shared resource consumption: does the feature create contention for the same
  DB connection/the same Redis instance/the same queue as an existing hot
  workload?
- Does the feature conform to the project's general caching/observability
  strategy, or does it introduce a pinpoint one-off solution that bypasses it?

## DETAILED CATEGORY CHECKLIST (apply the items relevant to the feature)

1. **Async backend**: synchronous HTTP clients/I/O inside `async def`,
   CPU-heavy operations on the event loop without
   ThreadPoolExecutor/ProcessPoolExecutor, sequential awaits where
   asyncio.gather is possible.
2. **Database**: N+1 queries, missing indexes on new WHERE/JOIN/ORDER BY
   columns (especially user_id/tenant_id/integration_id), SELECT * where 2-3
   fields are needed, list endpoints without pagination, connection pool size,
   long transactions with external HTTP calls inside, repeated identical
   queries within one request-response cycle.
3. **Caching (Redis)**: keys without TTL, absence of a cache for expensive
   frequently repeated computations, cache stampede, a cache without
   invalidation when the source data changes, KEYS/SCAN over the whole
   database in the hot path.
4. **Inter-service communication**: absence of timeouts on outbound requests,
   absence of retry with backoff (or retry without backoff), duplicate calls
   to one service instead of a batched call, full forwarding of heavy payloads
   where only part of the data is needed.
5. **Queues (RabbitMQ) and background handlers**: prefetch/QoS, poison message
   without DLQ, external-API polling frequency relative to real need, batch
   size, rate-limit handling.
6. **Serialization and payload size**: redundant fields in Pydantic model
   responses, logging large objects in full in the hot path, absence of
   gzip/brotli for large JSON responses.
7. **Frontend**: bundle/chunk size increase, absence of
   code-splitting/lazy-loading, excessive re-renders on large lists
   (virtualization), waterfall data loading instead of parallel, too-frequent
   polling instead of WebSocket/SSE; if the feature adds a new
   screen/route — capture Lighthouse (or analogue) LCP/TBT metrics for it, if
   the frontend can be brought up locally.
8. **Docker images** (only if the feature changes the Dockerfile): final image
   size, absence of multi-stage build, an oversized base image.
9. **Kubernetes/Helm** (only if the feature changes charts/values): resources
   requests/limits, liveness/readiness probe intervals, replicaCount/HPA
   thresholds.
10. **Observability**: cardinality of new metrics/labels (user_id/request_id
    as a label), trace sampling for new endpoints, the volume of DEBUG logging
    left in the new code.
11. **Algorithmic efficiency**: quadratic operations over collections that the
    feature introduces and that will become a bottleneck at real volumes,
    repeated parsing of the same data, unnecessary deep copying, absence of
    batching for bulk operations (import/sync) that the feature adds.
12. **Load testing**: does the existing/new k6 scenario cover this feature
    specifically, is a performance budget recorded for it (maximum p95 latency,
    maximum bundle size increase)?

## EDGE CASES CHARACTERISTIC OF FEATURES (rather than the whole repository)

- The feature runs fast on an empty/dev table but was not tested at a volume
  comparable to real customer data — always estimate the realistic growth for
  this specific feature.
- The feature adds a call to an already-existing "expensive" endpoint/query in
  a new place — the finding itself was not in the feature, but in the fact that
  the feature multiplies the call frequency of an already-known problem (check
  whether it is already in load-testing/reports or in a previous audit).
- Debug flags/verbose logging left in the feature code after development and
  not disabled by delivery time.
- The feature's feature flag, because of which the old and new paths run in
  parallel ("during the migration") — doubles the load where this is not the
  only execution path.
- A feature implemented in a shared library (libs/shared_auth,
  libs/shared_metrics) — even a small inefficiency is multiplied across all
  services and all replicas where the library is wired in, not just the
  service where the feature was originally intended.
- The feature's tests/benchmarks are run only on the happy path with a small
  payload, not on the worst realistic case (the maximum file size for upload,
  the maximum number of items in a batch operation that the feature formally
  allows).

## REPORT FORMAT

1. Executive summary (no technical jargon): is the feature performance-ready
   for production at the expected load, what consumes resources most
   noticeably, what can be fixed without risk to functionality.
2. Verdict: "ready" / "ready with caveats (list them)" / "not ready — list the
   critical findings" — state it explicitly; this is testing the feature
   before release, not just a list of observations. Rule for tying it to the
   KPI table (item 3 below): at least one severity-critical finding confirmed
   by measurement — the verdict cannot be "ready" (at minimum "with caveats",
   and where there is a risk of degrading a hot path — "not ready"); critical
   findings without measurement confirmation are recorded as a blocker for
   re-checking before merge; do not downgrade severity after the fact so the
   verdict matches the desired outcome.
3. KPI table: number of findings by severity (critical/high/medium/low),
   number of findings confirmed by measurement vs "plausible but not
   measured".
4. If the feature replaces existing functionality — a "before/after"
   comparison on the key metrics (latency, number of DB queries,
   payload/bundle size).
5. Full list of findings tied to file:line, with a quantitative impact
   estimate (or a "not measured" mark), severity, the condition under which the
   finding becomes critical, and a concrete remediation recommendation (not
   "optimize the query", but "add an index on (tenant_id, created_at)").
6. A "what was done well" section in this feature — efficient solutions worth
   replicating.
7. Action plan: quick pinpoint fixes without regression risk — first; changes
   requiring testing under load — second; architecture/team-lead-level
   questions (e.g. "a separate poll shouldn't have been introduced, there is a
   shared mechanism") — as a separate item for discussion, not as a merge
   blocker unless explicitly critical.
8. A "methodology and coverage limitations" section — which tools/measurements
   were used, what could not be tested (no access to prod metrics, no ability
   to bring up the environment, no realistic volume of test data) —
   explicitly, so the absence of findings does not read as "everything is
   optimal".

## FINDING FORMATTING RULES

For each finding, the following are mandatory: the file path and line number;
the problem name and category (see the checklist); a quantitative impact
estimate (measured, or explicitly marked as an unmeasured estimate with
justification); the condition under which the problem becomes critical;
severity with justification; a remediation recommendation that preserves the
system's current behavior (if the optimization inevitably changes behavior —
e.g. tightening a pagination limit — note this separately and explicitly).

## RUNNING THE TESTING (practical instructions)

Delegate the instrumental review and profiling through the Agent tool to a
separate subagent, rather than running it in the main dialogue thread, if you
have access to the Agent tool:

1. First, YOURSELF (in the main thread), do the "Input" section — determine and
   record the exact feature scope (the list of files/services/endpoints). Do
   not delegate this step: a subagent starts without the conversation context
   and does not know what was meant by "the feature". Here too, check
   load-testing/reports and load-testing/ANALYSIS_GUIDE.md for already
   documented bottlenecks that the feature scope touches (the same
   endpoints/tables/services) — this is a cheap check, and without it the
   subagent risks not learning about an already-known problem that the feature
   merely amplifies by call frequency (see EDGE CASES above) and investigating
   it again from scratch.
2. Launch the Agent tool (general-purpose, or Explore for a purely
   search-oriented sub-step) with a self-contained assignment including: the
   scope determined in step 1 (concrete paths, not "feature PROJ-XXXX" without
   expansion); the "Key principle", "Methodology", and "Detailed checklist"
   sections from this file; a requirement to return findings in the format of
   the "Finding formatting rules" section and a final report per the "Report
   format" section. Launch in foreground (`run_in_background: false`) if the
   result is needed for a further decision in this same dialogue (e.g. before
   merge) — do not continue silently while the agent works.
3. If the feature scope is large (several services + frontend), consider
   launching several subagents in parallel on independent zones (PASS 2 on the
   backend service(s) separately from PASS 2 on the frontend), and PASS 3 (the
   architectural review) as a separate agent or yourself, so as not to let one
   agent "cut corners" across the whole scope at once.
4. If the Agent tool is unavailable in the current environment — perform the
   same steps sequentially in the main thread, explicitly separating PASS
   1/2/3 from each other, and do not let the results of one pass substitute for
   another's check.
5. Consolidate the subagent(s)' results into a single report per the format
   above; if several subagents independently found the same finding — do not
   duplicate it in the report, but strengthen the confirmation status.
6. Before declaring the feature ready, explicitly check the "Edge cases
   characteristic of features" section — these are the typical blind spots of a
   focused, rather than full, audit.

This is testing, not implementation: the developer makes the changes based on
the report, not you within this skill.

