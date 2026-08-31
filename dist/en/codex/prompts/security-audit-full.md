---
description: Full security audit of the ENTIRE the-platform repository (all backend services, the-frontend, embeddable widgets/extensions, shared libraries libs/*, infrastructure configs helm/k8s/docker) — three independent passes (automated scanning SCA/SAST/secret-scan/IaC, line-by-line code review by zone, architectural review), a detailed 14-category checklist (auth/authz, multi-tenancy, websocket, internal API, injections, SSRF, XSS, secrets/PII, files, dependencies, docker, k8s/helm, error handling, CI/CD), findings with file:line and an exploitation scenario, and a final report for leadership.
argument-hint: "[path to the previous audit report, if this is a re-audit — optional]"
---

> Mode: analysis and report artifact only. Do not modify the project’s application code.
# Full repository security audit

For the-platform project: a microservices CRM platform that processes
customer personal data. Security is a critical priority, not a formality.
The audit must find real, exploitable problems tied to file:line, not
produce a generic checklist without verification. Every finding must be
confirmed by hand, not merely mentioned in a scanner's output.

## INPUT

`$ARGUMENTS` — optionally a path to the previous audit report for a "before →
after" comparison. If not passed, look for it yourself: the registry of past
findings lives in `docs/bugs/security_audit/` (each finding records a
verdict: confirmed / false positive / already fixed), and the regression
check over it is `scripts/verify_audit_fixes.py`, if present in the
repository.

This is an audit of the WHOLE repository. If the task actually concerns only
one feature/branch/PR/YouTrack task, use `security-audit-feature` instead of
a full review of the entire codebase (otherwise the scope will be excessive
and the findings will not be tied to what really needs checking before a
specific release).

## KEY PRINCIPLE: VERIFICATION, NOT TRUST

The main reason security audits fail is taking it on faith that "the fix was
written" is equivalent to "the vulnerability is closed". It is NOT. Verify
every fix adversarially:

1. If a check was added (a flag, an HMAC signature, escaping, authorization),
   make sure it is ENABLED by default and active in all environments
   (dev/staging/prod), not merely implemented in code and turned off by a
   flag.
2. If input escaping was added, verify COMPLETENESS: are all special
   characters escaped (single quote, double quote, backslash, null byte,
   unicode bypass), not just the obvious case? A single unclosed hole in the
   escaping = the vulnerability is not closed.
3. If a protection (an auth secret, middleware, an RBAC filter) is applied to
   one endpoint/service, check the ENTIRE class of same-type
   endpoints/services. A pinpoint fix without covering the whole class is not
   a fix but an illusion of one. Hunt for the "siblings" of the vulnerable
   pattern across the whole codebase (grep by the signature, not by the
   function name).
4. If the code has RBAC/switch/if-else on roles, always check the "else"
   branch (default case). The absence of an else branch with an explicit
   access denial is an allow-by-default, i.e. a hole.
5. Do not accept the explanation "that's an outdated version" or "that's
   already fixed" without independently verifying the current state of the
   repository. If there was a prior report of found risks, re-verify each
   item against the current code, regardless of what the team claims. Start
   the reconciliation from `docs/bugs/security_audit/`, not from a blank page,
   and run `scripts/verify_audit_fixes.py` for the regression check, if
   present. If a new finding effectively coincides with a risk already
   tracked and deliberately accepted there (e.g. a disabled networkPolicy, a
   single replica for an HA component), reference the existing file instead of
   a duplicate, and note it separately only if the current change makes the
   risk worse than it was recorded.
6. State the difference between statuses explicitly: "not fixed" / "fixed on
   paper (code exists, no protection)" / "fixed selectively (part of the
   class covered)" / "fully fixed" / "new finding".

## METHODOLOGY: THREE INDEPENDENT PASSES

Run the audit by three independent methods and do not let one pass substitute
for another — they have different blind spots.

### PASS 1 — Automated scanning

- **Dependencies (SCA)**: pip-audit/safety for Python services, npm audit for
  the frontend and Node services, grype and/or trivy fs/image for all
  dependency manifests and Docker images. Record the critical/high/medium/low
  breakdown and package versions.
- **Secrets in the repository**: gitleaks or trufflehog over the FULL git
  history (not just HEAD — secrets, once committed, remain in history even
  after the file is deleted), plus the trivy secret-scanner on the working
  tree. Explicitly state which directories/paths the scanner did NOT cover
  (exclusions in the scanner config, submodules, generated artifacts) — "0
  findings" on an uncovered directory is not proof that no secrets are
  present.
- **SAST**: semgrep (rules for Python/JS/TS: injection, ssrf, insecure
  deserialization, hardcoded secrets, weak crypto) and/or bandit for Python.
- **IaC/Kubernetes**: checkov and/or kube-linter on all helm charts and
  manifests — networkPolicy, securityContext, resources,
  readOnlyRootFilesystem, capabilities, image tags (:latest forbidden),
  privileged containers, hostPath/hostNetwork.
- **Container security**: trivy image on every built image — CVEs in the base
  image, missing USER (root by default), unnecessary packages.

### PASS 2 — Manual line-by-line code review

Split the codebase into independent zones and review EACH line by line (not
diagonally, not relying only on grep patterns):

- Each backend service separately (gateway, all `*-service` directories in
  `services/`).
- Frontend/SPA (`the-frontend` and any other client applications).
- Browser extensions/embeddable widgets (chat-widget, etc.) — the code runs
  on the client side OUTSIDE your perimeter, and any XSS there is visible to
  the end users of your customers; this is a reputational and regulatory risk,
  not merely internal tech debt.
- Infrastructure configs (`helm/`, k8s manifests, docker-compose, CI/CD
  pipelines).
- Shared libraries (`libs/shared_auth`, `libs/shared_metrics`, and analogues)
  — check whether they are wired in as a single package or copied across
  services (if copied, record it as an architectural risk: a security patch
  does not propagate automatically).

For each zone, look for (detailed checklist below) and for each finding
record: file:line, vulnerability type, a concrete exploitation scenario (not
an abstract "there may be a vulnerability", but "request X with parameter Y
yields result Z"), severity, status (see above).

### PASS 3 — Architectural review

Independently of the line-by-line review, assess whether the current
architecture can HOLD security over time, not just be free of holes today:

- File size and layer mixing (HTTP + SQL + business logic + RBAC in one file
  — reviewing and testing that is practically impossible, and defects
  systematically slip through).
- The number of inter-service communication mechanisms (the more different
  ways to make a call, the lower the chance of a single point to enforce an
  authorization policy).
- Duplication of shared security libraries across services instead of a
  single package.
- Presence/absence of a process: mandatory code review before merge, a
  blocking security gate in CI, an independent verification that previous
  findings are closed (not by the team's self-report).
- Insecure defaults as a systemic pattern (if one flag is off by default,
  check whether this is a systemic practice: are other security
  flags/features in the project also off by default?).

## DETAILED CATEGORY CHECKLIST

1. **Authentication and authorization**
   - Do all endpoints that require authentication actually verify it (are
     there "forgotten" open routes, especially /public/*, /internal/*,
     /health, /debug)?
   - Self-registration: which role is granted by default? is_active=True
     immediately or via confirmation (email/admin approval)? Can an external
     person gain access to someone else's data through self-registration?
   - RBAC/role-based filtering: for EACH role branch — what happens for a role
     that falls into no explicit branch (default/else)? Does this lead to data
     leakage (e.g. no filter by assigned_user_id/owner_id)?
   - User context headers (X-User-Context and analogues): are they
     cryptographically signed? Is the signature verified on receipt, and is
     this verification ENABLED by default in all services that trust the
     header?
   - IDOR/BOLA: can you access someone else's objects (contacts, deals, files,
     dialogs) by changing an ID in the URL/body?
   - Broken function level authorization: are admin operations (bulk delete,
     export, wipe-data) accessible without a role check?
   - Session/token management: where are tokens stored (localStorage vs
     httpOnly cookie), is there invalidation on logout/password change, is
     there a lifetime limit?
   - Password storage: the hashing algorithm (bcrypt/argon2 vs md5/sha1),
     presence of a salt, work factor. Is there MFA/2FA at least for admin
     roles?
   - CORS: `Access-Control-Allow-Origin` not equal to `*` together with
     `Allow-Credentials: true`; the request Origin not reflected into the
     response without checking against an allow-list.
   - Rate limiting/brute-force protection on login, password reset, OTP/2FA
     codes — is there a limit on attempts and a lockout/delay on exceeding it?
   - Mass assignment/over-posting: does the API accept arbitrary request-body
     fields (role, is_admin, company_id, balance, etc.) on create/update, or
     is the list of allowed fields an explicit whitelist?

2. **Multi-tenancy (isolation between customer companies)** — this is a SaaS
   CRM with several customer companies on shared infrastructure; a data leak
   BETWEEN companies is heavier in consequences than an IDOR within one
   company (a regulatory risk, the trust of all platform customers at once),
   so review it separately from the generic IDOR item above, not as a special
   case of it.
   - For EACH data read/write point (REST handler, WebSocket subscription,
     cache key, search index, event queue, export/report) — is it filtered by
     company_id/tenant_id at the DB-query level (WHERE company_id = ...), not
     only checked at the UI/router level?
   - Is the company_id match checked explicitly (comparing the value from the
     token/context against the record's own company_id), rather than assumed
     because "the request comes from an authorized session anyway"?
   - Bulk operations, exports, analytics/dashboards — do they recompute
     aggregates across all companies instead of just their own?
   - Shared resources between services (Redis keys, RabbitMQ queues, file
     storage) — can a key/name collide between different companies given
     identical internal IDs (e.g. contact_id is unique within a company but
     not globally)?

3. **WebSocket / realtime**
   - Is the token/role/company_id checked at connection establishment
     (connect), AND separately at each subscription to a channel/room/dialog
     (join), not just once at connect?
   - Can a client subscribe to someone else's channel by supplying/guessing a
     room-id, dialog-id, user-id, if the server does not check the channel
     owner against the current user?
   - Event broadcast — is the recipient filtered by company_id/role before
     sending, or does the server rely on the client "just not being
     subscribed" to someone else's data?

4. **Internal-API between services**
   - Walk ALL `/internal/*` endpoints in ALL services and build a table:
     service | endpoint | does it require a shared-secret/mTLS | is the secret
     actually verified (not merely declared in environment variables). Look
     for discrepancies — the same class of operation (send-message,
     delete-by-id, wipe-data, sync) protected in one service and unprotected
     in a neighboring one is a systemic hole.
   - Can an internal endpoint be called directly from outside the cluster (is
     there no additional network-level restriction, if auth is weak)?

5. **Injections (SQL / NoSQL / Command / Template / Deserialization)**
   - Find all places that build queries by concatenation/f-string/format
     instead of parameterized queries or ORM. Pay special attention to public
     query parameters (dashboard filters, search, sorting).
   - If there is "manual" escaping, verify completeness (backslash, unicode,
     nested quotes).
   - Command injection: any subprocess/os.system/exec with interpolation of
     user input.
   - Server-side template injection: if user input reaches a template engine.
   - NoSQL injection: if Mongo/analogues are used — operators ($where, $ne)
     from user input.
   - Insecure deserialization: `pickle`, `yaml.load` without `SafeLoader`,
     `jsonpickle`, `eval`/`exec` over data that came from a queue, a webhook,
     or an inter-service call, not just directly from an HTTP request.

6. **SSRF (Server-Side Request Forgery)**
   - Any code that makes an outbound HTTP request to a URL that came from the
     user or from an external system (webhooks, media_url, callback_url,
     integrations with CRMs/messengers) — is there a domain allow-list,
     blocking of private/internal IP ranges (169.254.x.x, 10.x, 172.16-31.x,
     192.168.x, 127.x, cloud metadata endpoints)?
   - Is the webhook's signature/origin verified before the system initiates a
     response request to a URL from the webhook body?

7. **XSS (including Stored XSS in client widgets)**
   - Any use of innerHTML/dangerouslySetInnerHTML/document.write with
     untrusted data.
   - Widgets embedded on third-party sites are code that executes in the
     browsers of the end visitors of your customers' sites. A vulnerability
     there has a wider blast radius than internal XSS — qualify it accordingly
     when assessing severity.
   - Is CSP (Content-Security-Policy) configured and sufficiently strict?
   - Clickjacking: the `X-Frame-Options`/`frame-ancestors` headers — do they
     prevent embedding the main application (not the widget) in someone else's
     iframe?

8. **Secrets and PII handling**
   - Secrets in code/configs tracked by git (values-*.yaml, *-secrets.yaml,
     committed .env, hardcoded API keys/tokens in source).
   - Personal-data export scripts (dumps of contacts/customers) sitting in the
     repository — a risk in themselves regardless of repo access rights.
   - Storage of integration tokens (Telegram/WhatsApp bots, etc.) in the DB —
     plaintext or encrypted?
   - Local messenger client sessions (e.g. TDLib sessions) on disk — are they
     encrypted at rest?
   - Check git history with a command like `git log --all --full-history --
     <path>` for files that are currently deleted but may have contained
     secrets in the past.
   - Secret masking in logs (redaction) — does it work for all types of
     secrets (bot_token, api_key, access_token, passwords, PII), not just for
     some?
   - `.env.example`/config samples — do they by mistake contain a real value
     instead of a placeholder; are environment variables not printed in full
     into CI logs (`env`, `printenv`, debug dump of the config at service
     startup)?

9. **File upload and storage**
   - MIME-type and extension validation on upload (do not trust the client's
     Content-Type without validating the content).
   - File size limit, protection against zip bombs/decompression bombs for
     archives.
   - Public file-serving endpoints (/public/documents, etc.) — do they require
     authentication if the files contain PII or private data?
   - Path traversal when building the save/read path of a file from user
     input.
   - Object storage (S3/MinIO): bucket publicity, versioning, replication.

10. **Dependencies and supply chain**
    - A full breakdown of vulnerabilities by criticality and by service (not a
      single aggregate number, but per service separately — where the risk is
      concentrated).
    - Matching critical libraries used in several services at different
      versions (e.g. different versions of one framework in different services
      — meaning a patch has to be rolled out N times).
    - Docker base images: are outdated/EOL versions used, :latest tags instead
      of pinning by digest/version?
    - Lock files (poetry.lock, package-lock.json, uv.lock) — are they
      committed, do they match the declared versions?
    - Dependency confusion: internal packages (libs/shared_auth,
      libs/shared_metrics, and analogues) — are they installed from a private
      index/by local path, or by a bare name from public PyPI/npm, where a
      same-named public package could substitute them?

11. **Docker / containers**
    - USER set (non-root) in every Dockerfile — build a table across all
      images.
    - readOnlyRootFilesystem, drop: ALL capabilities,
      allowPrivilegeEscalation: false in securityContext.
    - Secrets not passed via ARG/ENV in the Dockerfile (they end up in the
      layer history).
    - Multi-stage build to exclude build tools and dev dependencies from the
      final image.

12. **Kubernetes / Helm**
    - networkPolicy for databases, caches, queues (Redis, PostgreSQL,
      RabbitMQ) — are they enabled in prod, do they restrict traffic to
      trusted pods only?
    - resources requests/limits set (not an empty {} by default) to prevent
      noisy neighbor and DoS through resource exhaustion.
    - liveness/readiness probes for the core business-logic services.
    - Secrets via Kubernetes Secrets/an external secret manager, not in
      values.yaml in plaintext.
    - Single point of failure: the replica count for stateful components
      (Redis, RabbitMQ, MinIO, DB) in prod — 1 replica for a critical
      component is an availability risk; record it separately from security
      findings, but do not ignore it.
    - DB backup strategy — is it documented and automated?

13. **Error handling and observability**
    - The "silent swallowing" pattern of errors (a broad except that logs and
      returns None/an empty result without re-raise/alert) — does this mask
      security failures (e.g. a failed authorization check that is mistakenly
      treated as "allowed")?
    - Are security events (failed authorization attempts, role changes, bulk
      deletes) logged separately and available for monitoring/alerting?
    - Leakage of internal information through error messages (stack traces,
      library versions, DB structure) in API responses to the outside.

14. **CI/CD and process**
    - Is code review before merge into protected branches mandatory?
    - Is there a blocking security gate in CI (SCA/SAST/secret-scan) that
      actually stops the merge on critical/high findings, rather than just
      printing a warning?
    - Is there a regression checklist for previously found vulnerabilities
      that is run before each release?
    - Who owns the "merge/don't merge" decision when a vulnerability is found
      — is there an explicit security owner with the right to block?
    - CI script injection: is unvalidated external input (PR title, branch
      name, issue title) interpolated directly into a `run:` step of the
      pipeline — the classic vector for stealing CI secrets that SCA/SAST do
      not catch?
    - Public admin/debug endpoints in prod: Swagger/OpenAPI UI, framework
      admin panels, interactive debug consoles (e.g. Werkzeug) — are they
      accessible without authentication in the production environment?

## EDGE CASES OFTEN MISSED

- Functionality protected at the UI level (button hidden) but accessible
  directly through the API without a backend check.
- A race condition in "check-then-act" checks (e.g. the role check and the
  subsequent action are not atomic, and you can wedge in between them).
- Behavioral differences for "soft-deleted" records — are they accessible
  through an API that does not account for the deletion flag?
- Bulk operations (bulk endpoints) — they often have weaker authorization than
  their single-item counterparts, because they were added later "quick and
  dirty".
- Webhooks from external systems — is the signature/origin verified, or do we
  trust any request body that arrives at a public URL?
- Security feature flags turned off "temporarily for debugging" and forgotten
  in that state in the default config.
- Differences between environments (dev/staging/prod) — a fix applied in one
  helm-values configuration may be absent in another.
- Data export (CSV/Excel/PDF generation) — is authorization on the exported
  data volume verified as strictly as on ordinary reads through the UI?
- Reuse of the same secret/key across several services — compromise of one
  service grants access to the rest.
- Outdated/unused endpoints left in the code "just in case", undocumented and
  without auth, because "nobody uses them".

## SEVERITY SCALE

A fixed scale is needed so findings are comparable to each other and across
re-audits (otherwise the "previous report → current" comparison table loses
meaning if severity is assigned anew each time). The same scale is used in the
`security-audit-feature` skill.

- **Critical**: an unauthenticated external attacker achieves full compromise
  (RCE, access to all data of all customer companies, full authentication
  bypass).
- **High**: an authenticated user (including one with a minimal role) gains
  access to someone else's data/privileges — including cross-tenant access
  (see section 2) — or an unauthenticated attacker gains access to the data of
  one company/one user.
- **Medium**: requires specific conditions (a race, a particular role, MITM,
  social engineering) or is limited to a limited metadata leak/DoS of a single
  component without data loss.
- **Low**: a best-practice violation with no direct exploitation scenario at
  the time of the audit (e.g. a missing security header with no known attack
  vector in the current architecture).

For each finding, state not only the final level but also who can exploit it
(anonymous / authenticated user / internal network only) and what is lost
(read / write / full compromise) — that is the justification for the level.

## REPORT FORMAT

1. Executive summary (for leadership, no technical jargon): what is critical,
   what is a business/reputational/regulatory risk, what to do first.
2. KPI table: number of critical/high/medium/low findings, number of
   dependency vulnerabilities by criticality, % of containers running
   non-root, number of unclosed risks from the previous report (if this is a
   re-audit).
3. If this is a re-audit — a comparison table "previous-report item → current
   state (file:line) → status (not fixed / on paper / selectively / fixed)".
   Do not accept past explanations without re-verification.
4. A "fixed but not working" section separately — this is the most telling
   signal of process maturity; call it out explicitly.
5. Full list of findings tied to file:line, with a concrete exploitation
   scenario, severity (a CVSS-like score or critical/high/medium/low), and a
   recommendation.
6. A "what was done well" section — strong patterns in the codebase worth
   replicating rather than redoing. An audit without balance loses trust and
   is harder to use to motivate the team.
7. Action plan by timeframe: 24-48 hours (vectors exploitable today), 1 week
   (the remaining critical), 2-4 weeks (process and architecture),
   leadership-level decisions (a security owner, independent re-verification,
   architectural decisions that cannot be solved with pinpoint patches).
8. A "methodology and coverage limitations" section — which tools were used,
   which directories/services were NOT scanned and why, so the absence of
   findings in an uncovered zone does not read as "everything there is clean".

## FINDING FORMATTING RULES

For each finding, the following are mandatory:

- A stable finding ID (e.g. `SEC-2026-08-04-001`) — so that at re-audit you
  can reference a specific finding by ID rather than retelling it in your own
  words (a retelling can quietly "drift" from the original wording and break
  the status mapping between audits).
- The file path and line number (or range).
- The vulnerability name and category (may reference OWASP Top 10 / OWASP API
  Security Top 10 / CWE).
- A concrete exploitation scenario: "if you make request X with parameter Y,
  the system will return/do Z" — not abstract wording like "there may be a
  vulnerability".
- Severity with justification (who can use it: authenticated user / any
  external / internal network only; what is lost: data read / write / full
  compromise).
- Status relative to the previous audit, if applicable.
- A remediation recommendation — concrete (not "improve security", but "add an
  else branch with an explicit denial", "enable flag X by default", "replace
  the f-string with a parameterized query").

## RUNNING THE AUDIT (practical instructions)

1. Determine the scope: list all services (top-level directories in
   `services/`), frontend applications, embeddable widgets/extensions,
   infrastructure configs.
2. Read the registry of past findings in `docs/bugs/security_audit/` BEFORE
   starting the manual review, if it exists — it is a ready source of already
   known problems; don't duplicate work, just check whether they are fixed.
3. Run the automated tools of PASS 1 on each service/image/chart where
   possible in the current environment, and save the raw output for report
   appendices. Filter out obvious false positives (test fixtures, placeholder
   values like "changeme"/"example_key") with an explicit list in the
   limitations section, not silently — so it is visible that they were
   considered, not skipped.
4. Split the manual review of PASS 2 into independent chunks (by service/zone)
   — if the Agent tool is available, launch several independent subagents on
   different zones in parallel (in foreground, if the result is needed
   immediately in this dialogue), so as not to miss volume and not to let one
   agent "cut corners" across the whole codebase at once. The codebase is
   large (a dozen+ services) — give each subagent a concrete list of
   files/directories for its zone and the applicable sections of this skill
   (checklist, severity scale, finding format), not a retelling in your own
   words. Record confirmed findings in an intermediate file as you review each
   zone, rather than keeping them only in context until the final report:
   otherwise, when a long dialogue is compacted, earlier findings can be lost.
5. Perform the architectural review of PASS 3 separately, independently of the
   PASS 2 results.
6. Consolidate all three passes into a single report per the format above,
   remove duplicates, but do not merge findings of different natures (a
   secret-scanner found a file ≠ manual review confirmed the secret is real
   and active — record both facts if both exist).
7. If this is a re-audit — be sure to re-verify EACH item of the previous
   report against the current state of the code, rather than relying on the
   status claimed by the team.
8. Explicitly state which checks were NOT performed (environment limitations,
   no access to prod secrets, no access to runtime logs, etc.) — this is part
   of an honest report, not its weakness.
9. Save the final report as a file in `docs/bugs/security_audit/` (e.g.
   `full-audit-<date>.md`) — this is the same place where the registry of past
   findings is kept, and the next re-audit should find it during
   reconciliation.

This is an audit, not implementation: the developer makes the changes based on
the report, not you within this skill.

