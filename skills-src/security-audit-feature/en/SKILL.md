---
description: Focused security audit of ONE specific feature/change in the-platform (not the whole repository) — scope taken from a directory/branch/diff, a spec/PRD document, or a YouTrack issue; the same verification discipline as the full audit (adversarial verification, three independent passes, a 14-category checklist — auth/authz, multi-tenancy, websocket, internal API, injections, SSRF, XSS, secrets/PII, files, dependencies, docker, k8s/helm, error handling, CI/CD), with findings tied to file:line and an explicit release-readiness verdict. Use when asked to check the security of a specific feature, branch, PR, or YouTrack task before merge/release, to find vulnerabilities in a new endpoint/integration/file upload/webhook, or to assess whether new functionality opens access to someone else's data or another company — even without the word "audit", e.g. "is this feature leaking between companies", "is this feature OK to merge security-wise", "check this branch for security holes". This is NOT the same as the `security-review` skill (which does a quick review of pending changes on the current branch in ordinary code-review style, with no SCOPE/YouTrack/three-pass requirement, no category checklist, and no audit-report format) — if you need a full security check with this methodology, use this skill, not `security-review`. To audit the entire repository, use `security-audit-full`, not this one.
argument-hint: "[path to a directory/feature, path to a spec document, or a YouTrack issue ID/link]"
---
# Feature-scoped security review (single-feature security audit)

For the-platform project: a microservices CRM platform that processes
customer personal data. Security is a critical priority, not a formality.
The audit must find real, exploitable problems tied to file:line, not
produce a generic checklist without verification. Every finding must be
confirmed by hand, not merely mentioned in a scanner's output.

This is the focused version of the full repository audit (see the
`security-audit-full` skill if the task is the whole repository rather than
a single feature). The verification principles are the same, but the scope,
findings, and report are strictly limited to the code that belongs to this
feature and to what it touches. The manual-analysis work can be delegated
through the Agent tool — use parallelization by zone as described in the
"Running the check" section below.

## INPUT: HOW TO DETERMINE THE FEATURE

Feature: `$ARGUMENTS`

The feature is passed in one of three forms — figure out which one you have
and build the review scope accordingly. The scope is ALWAYS wider than the
literal input: include direct consumers/calling code (the router that
registers the handler; the frontend that hits the API; the neighboring
service that receives the inter-service call).

**A. DIRECTORY/BRANCH/DIFF** (e.g. `services/xxx-service/feature_y/` or
"diff between dev and the feature/PROJ-XXXX branch"):
- Scope = the entire contents of the directory (or the files from
  `git diff --stat` against the base branch) + modules that import it
  (`grep -r` on the package/module name outside the directory) + the
  routes/DI that register it (main.py/app factory/router include).
- If the directory is a shared library (libs/shared_auth,
  libs/shared_metrics, etc.), be sure to identify ALL consumers of the
  library across all services — a vulnerability in shared code multiplies
  across the whole list of consumers.

**B. DOCUMENT** (path to a spec/design document/PRD, .md/.txt/.docx):
- Read the document in full. Extract from it: endpoint/route names,
  model/table names, roles and permissions, UI component/screen names, and
  any mentioned external integrations (webhooks, callback URLs, third-party
  APIs).
- For each extracted term, `grep`/search the codebase to translate the
  "what should exist" description into concrete file:line "what actually
  exists". Do not settle for the document saying something is "implemented"
  — verify the code, not the document text.
- If the document describes intent rather than fact (a draft spec), flag
  explicitly in the report which items have no counterpart in the code
  (this is a finding too: a mismatch between spec and implementation may
  mean an unfinished access control).

**C. YOUTRACK ISSUE** (an ID of the form `PROJ-XXXX` or a link):
- Fetch the issue text (title, description, comments, acceptance criteria)
  through whatever tracker-integration mechanism the project provides (a
  YouTrack/Jira/GitHub/Linear MCP tool, if connected). If no programmatic
  access exists, ask the user directly for the issue text and links to
  related PRs — do not invent the content.
- Find related commits and files by ticket ID: commits in this repository
  are conventionally tagged with the ticket number in the message (e.g.
  `PROJ-1042`, `PROJ-1031`, `PROJ-318`) — use `git log --all
  --grep=<ISSUE-ID> --oneline`, then `git show --stat <hash>` / `git log
  --all -- <files from commit>` to build the list of affected files and
  services.
- If the ticket references a PR/branch, review that branch's diff
  specifically (`git diff main...<branch>`), not just the final state of
  main, so you do not miss intermediate versions if the branch is not yet
  merged.

If none of the three sources determines the scope unambiguously, stop and
explicitly list what needs to be clarified with the task author, rather than
blindly reviewing the entire service.

Explicitly record at the top of the report the final scope (the list of
files/directories/services) that resulted from this step — this is your
working SCOPE, and the rest of the audit runs on it, plus the points of
contact with the rest of the system (see PASS 3 below).

## KEY PRINCIPLE: VERIFICATION, NOT TRUST

The reason feature checks fail is taking it on faith that "the code was
written to spec" is equivalent to "the feature is secure". It is NOT.
Verify adversarially:

1. If the feature adds a check (a flag, an HMAC signature, escaping,
   authorization), make sure it is ENABLED by default and active in all
   environments (dev/staging/prod), not merely implemented in code and
   turned off by a flag.
2. If the feature adds input escaping, verify COMPLETENESS (single quote,
   double quote, backslash, null byte, unicode bypass), not just the
   obvious case.
3. If the feature protects one endpoint/service, check whether it has
   "siblings" of the same class of operation elsewhere in the codebase that
   were left unprotected (e.g. the feature added auth on POST but not on
   DELETE of the same resource, or on an analogous bulk endpoint).
4. If the feature has RBAC/switch/if-else on roles, check the "else" branch
   (default case). The absence of an explicit access denial by default is a
   hole.
5. Do not accept the ticket/spec description ("this is already protected",
   "it uses the shared middleware here") without independently verifying the
   current code.
6. State the status explicitly: "not implemented" / "implemented on paper
   (code exists, no protection)" / "implemented selectively (part of the
   class covered)" / "fully implemented" / "new finding outside the
   feature's scope".

## METHODOLOGY: THREE INDEPENDENT PASSES (within the feature SCOPE)

### PASS 1 — Focused automated scanning

- If the feature added new dependencies (a new entry in
  requirements/pyproject/package.json), run pip-audit/npm audit focused on
  the changed lock file, not on the whole repository.
- semgrep/bandit on the files in SCOPE (injection, ssrf, insecure
  deserialization, hardcoded secrets, weak crypto).
- If the feature touches Dockerfile/helm-values/k8s manifests, run checkov/
  kube-linter focused on the changed files.
- gitleaks/trufflehog on the feature's diff (`git diff`/`git log -p` on the
  affected files and commits) — a secret may have been committed and then
  deleted within the same branch.

### PASS 2 — Manual line-by-line review of the feature code

Review every file in SCOPE line by line (not diagonally), applying the
category checklist below — only those categories that actually apply to what
the feature does (see the applicability hints before the checklist). For
each finding: file:line, vulnerability type, a concrete exploitation
scenario ("request X with parameter Y yields result Z"), severity, status.

If the SCOPE is large (several services/directories) and the Agent tool is
available, split it into independent zones and use several subagents, one
zone each, so you don't cut corners across the whole volume at once (see
"Running the check" below).

### PASS 3 — Points of contact with the rest of the system

Independently of the line-by-line review, answer: how does the feature fit
into the platform's existing security invariants, not just "are there holes
in its own code"?

- Does the feature use the existing authentication/authorization/multi-
  tenancy mechanisms, or does it invent its own path that bypasses them (a
  new handler that does not go through the shared auth middleware/RBAC
  decorator)?
- If the feature adds a new internal endpoint between services, is it
  protected by the same shared-secret/mTLS mechanism as the rest of the
  `/internal/*` endpoint class, or is it an exception?
- If the feature adds a new data read/write point, is it filtered by
  company_id/tenant_id the same way as the other points of the same type in
  the system?
- If the feature reuses a shared library (libs/shared_auth, etc.), does it
  use the current version as a single package, or did it copy/fork the logic
  into itself?
- Does the feature break any of the existing security invariants documented
  in previous repository audits? In this project that is not an abstract
  caveat — the registry of past findings lives in
  `docs/bugs/security_audit/` (each past-audit finding records a verdict:
  confirmed / false positive / already fixed), and the regression check over
  it is `scripts/verify_audit_fixes.py`. If the feature SCOPE overlaps by
  topic or by files with one of the findings in that folder, be sure to run
  the script (if present in the repository) and explicitly reconcile the
  current status, rather than reopening the finding from scratch.
- If a feature finding effectively coincides with a risk already tracked in
  `docs/bugs/security_audit/` that was deliberately accepted (a low replica
  count for HA, a disabled networkPolicy, etc.), reference the existing
  finding file instead of raising a duplicate as a "new feature finding";
  note it only if the feature makes the risk worse than it was recorded.

## CATEGORY CHECKLIST (apply the ones relevant to the feature)

Before the review, quickly classify the feature: which of the blocks below
apply (a new API endpoint → blocks 1,2,5,6,10; a new UI screen → blocks 1,7;
file upload → block 9; integration/webhook → blocks 4,6,8; infrastructure
change → blocks 11,12). Do not skip a block just because "the feature is
small" — small features are typically exactly the source of pinpoint holes
(see "Edge cases" below).

1. **Authentication and authorization**
   - Does the new/changed endpoint require authentication the same way as
     the other endpoints of the same service (is there a "forgotten" open
     route)?
   - RBAC branches: what happens for a role that falls into no explicit
     branch (default/else)? Does this lead to a leak (no filter by
     assigned_user_id/owner_id)?
   - IDOR/BOLA: can you access someone else's object that the feature
     operates on by changing an ID in the URL/body?
   - Broken function level authorization: is the new administrative/bulk
     operation accessible without a role check?
   - Mass assignment/over-posting: does the new/changed API accept arbitrary
     request-body fields (role, is_admin, company_id, balance, etc.), or is
     the list of allowed fields an explicit whitelist?
   - Session/token: if the feature touches sessions/tokens — where is the
     storage, is there invalidation, is there a lifetime limit?
   - Rate limiting: if the feature adds a login/password reset/OTP-like flow
     — is there a limit on attempts?

2. **Multi-tenancy (isolation between customer companies)** — review this
   separately from generic IDOR; a cross-tenant leak is heavier in
   consequences.
   - Every new read/write point (REST handler, WS subscription, cache key,
     search index, queue, export) — is it filtered by company_id/tenant_id
     at the DB-query level, not just at the UI/router level?
   - Is the company_id match checked by an explicit comparison of the value
     from the token/context against the record's company_id, rather than
     assumed?
   - Shared resources (Redis keys, RabbitMQ queues, file storage) — can a
     key/name collide between companies given identical internal IDs?
   - A new Alembic migration/DDL: does a new table/column that stores a
     specific company's data have `company_id`/`tenant_id` and an index on
     it — a structural gap at the schema level cannot be caught by a
     line-by-line query review if the column itself is missing.

3. **WebSocket / realtime** (if the feature touches a realtime channel)
   - Is the token/role/company_id checked at connect AND separately at each
     channel/room subscription (join)?
   - Can a client subscribe to someone else's channel by supplying/guessing
     a room-id/dialog-id/user-id?
   - Is broadcast filtered by company_id/role before sending, or does the
     server rely on the client "just not being subscribed"?

4. **Internal-API between services** (if the feature adds/changes
   `/internal/*`)
   - Does it require a shared-secret/mTLS the same way as the other
     endpoints of the same class of operation in other services? Is the
     secret actually verified (not merely declared in env)?
   - Can the new internal endpoint be called directly from outside the
     cluster?

5. **Injections (SQL / NoSQL / Command / Template / Deserialization)**
   - Building queries by concatenation/f-string/format instead of
     parameterized queries/ORM — especially in new query parameters
     (filters, search, sorting).
   - "Manual" escaping — verify completeness (backslash, unicode, nested
     quotes).
   - Command injection: new subprocess/os.system/exec with user input.
   - Insecure deserialization of new data from a queue/webhook/inter-service
     call (pickle, yaml.load without SafeLoader, eval/exec).

6. **SSRF** (if the feature makes an outbound HTTP request to an external
   URL)
   - Is there a domain allow-list, blocking of private/internal IP ranges
     (169.254.x.x, 10.x, 172.16-31.x, 192.168.x, 127.x, cloud metadata)?
   - Is the webhook's signature/origin verified before the system initiates
     a response request to a URL from its body?

7. **XSS** (including client-side widgets, if the feature is a
   frontend/embeddable component)
   - innerHTML/dangerouslySetInnerHTML/document.write with untrusted data.
   - If the feature is a widget embedded on third-party sites: the
     vulnerability is visible to the end users of your platform's customers —
     qualify severity accounting for the expanded blast radius.
   - Are CSP/clickjacking headers not weakened by the new code?

8. **Secrets and PII handling** (if the feature touches
   integrations/tokens/PII)
   - New secrets in code/configs tracked by git.
   - New integration tokens in the DB — plaintext or encrypted?
   - Secret masking in new logs — does it work for the new data types the
     feature introduced?

9. **File upload and storage** (if the feature adds upload/download)
   - MIME-type/extension validation (do not trust the client's
     Content-Type).
   - Size limits, protection against zip bombs.
   - Path traversal when building a path from user input.
   - Public serving — does it require authentication if the files contain
     PII?

10. **Dependencies and supply chain** (if the feature added new packages)
    - Criticality of new dependencies, whether a safer alternative exists.
    - A new internal package — installed from a private index/local path, or
      by a bare name that can be substituted from public PyPI/npm (dependency
      confusion)?

11. **Docker / containers** (if the feature changes the Dockerfile)
    - Is USER set (non-root)? Are secrets not passed via ARG/ENV?

12. **Kubernetes / Helm** (if the feature changes values/manifests)
    - Are networkPolicy/securityContext/resources not weakened by the new
      values file relative to the project's existing baseline?
    - Secrets via Kubernetes Secrets, not plaintext in values.yaml?

13. **Error handling and observability**
    - A new broad except that logs and returns None/an empty result without
      re-raise — does this mask a failed authorization check as "allowed"?
    - Are new security events (failed authorizations, role changes) logged
      separately?
    - Leakage of internal information through new error messages to the
      outside.

14. **CI/CD** (if the feature changes the pipeline)
    - CI script injection: is unvalidated external input (PR title, branch
      name) interpolated directly into a `run:` step?
    - Does the new security gate actually block the merge, or does it only
      print a warning?

## EDGE CASES OFTEN MISSED WHEN TESTING A FEATURE

- Functionality protected at the UI level (button hidden) but accessible
  directly through the API without a backend check.
- A race condition in "check-then-act" (the role check and the action are
  not atomic).
- Behavior for soft-deleted records — are they accessible through a new
  endpoint that does not account for the deletion flag?
- The bulk variant of the new feature (bulk endpoint) — often added "quick
  and dirty" with weaker-verified authorization than its single-item
  counterpart.
- The webhook the feature adds — is the signature/origin verified?
- The feature's feature flag, turned off "temporarily for debugging" and
  left off by default in the config.
- dev/staging/prod differences — a fix applied in one helm-values
  configuration may be absent in another.
- Data export, if the feature adds it — is authorization on the exported
  volume as strict as on ordinary reads?
- An old/duplicate path left behind after the feature's refactoring (e.g.
  the old endpoint was not removed, it just stopped being called from the
  frontend — it is still reachable and not updated to the new authorization
  logic).

## SEVERITY SCALE (shared with the full repository audit)

A shared scale is needed so findings are comparable across individual
feature checks and full audits (see `security-audit-full`).

- **Critical**: an unauthenticated external attacker achieves full compromise
  through this feature (RCE, access to all data of all customer companies,
  full authentication bypass).
- **High**: an authenticated user (including one with a minimal role) gains
  access to someone else's data/privileges through this feature — including
  cross-tenant access — or an unauthenticated attacker gains access to the
  data of one company/one user.
- **Medium**: requires specific conditions (a race, a particular role, MITM,
  social engineering) or is limited to metadata leakage/DoS without data
  loss.
- **Low**: a best-practice violation with no direct exploitation scenario at
  the time of the check.

For each finding, state who can exploit it (anonymous / authenticated user /
internal network only) and what is lost (read / write / full compromise).

## REPORT FORMAT

1. Executive summary (no technical jargon): is the feature secure to
   release, what is critical, what is a business/regulatory risk, what to do
   first.
2. SCOPE — the final list of reviewed files/directories/services (see the
   "Input" section above) and an explicit note on what was left OUTSIDE the
   SCOPE and why (e.g. "shared library X was not re-reviewed since it did
   not change in this feature").
3. Feature verdict: "ready to release" / "ready with caveats (see
   low/medium)" / "not ready — there are critical/high findings" — in one
   phrase at the top of the report.
4. Full list of findings: file:line, category (may reference OWASP Top 10 /
   OWASP API Security Top 10 / CWE), a concrete exploitation scenario,
   severity with justification, status, remediation recommendation.
5. A "what was done well" section — strong patterns in the feature's
   implementation worth replicating.
6. Action plan: what blocks the release now (critical/high), what can be
   fixed after release with a ticket (medium/low).
7. A "what was not checked" section — coverage limitations (no access to the
   prod environment, no ability to run a scanner, etc.), so the absence of
   findings does not read as "everything there is clean".

## FINDING FORMATTING RULES

Before starting, check whether a report for this same feature already exists
in `docs/bugs/security_audit/` (e.g. by its feature-slug or ISSUE-ID from a
previous run of this same skill). If it does, do not start numbering from
zero: continue the existing ID sequence and update the status of already
known findings ("not fixed" → "fixed", etc.), rather than re-raising them as
new.

For each finding, the following are mandatory:

- A stable finding ID (e.g. `SEC-<ISSUE-ID or feature-slug>-001`), unique
  within the reports for this feature (see above on re-runs).
- The file path and line number (or range).
- The vulnerability name and category (OWASP Top 10 / OWASP API Security Top
  10 / CWE).
- A concrete exploitation scenario: "if you make request X with parameter Y,
  the system will return/do Z" — not abstract wording like "there may be a
  vulnerability".
- Severity with justification (who can use it, what is lost).
- A remediation recommendation — concrete ("add an else branch with an
  explicit denial", "enable flag X by default", "replace the f-string with a
  parameterized query").

## RUNNING THE CHECK (practical instructions)

1. First, YOURSELF (in the main thread), do the "Input" section — determine
   the input type (directory/branch/diff, document, YouTrack issue) and build
   the SCOPE. Do not delegate this step: a subagent starts without the
   conversation context and does not know what was meant by "the feature".
   Record the SCOPE explicitly before moving to the review.
2. Classify the feature by change type (new API, new UI, integration/webhook,
   file upload, infrastructure, etc.) and select the applicable checklist
   blocks.
3. Check whether a report for this feature already exists in
   `docs/bugs/security_audit/` (see "Finding formatting rules") — this is a
   cheap check that saves rework and preserves the continuity of finding
   numbering.
4. Run the focused automated checks of PASS 1 on the files/dependencies in
   SCOPE (semgrep/bandit focused, SCA on the changed lock files, gitleaks on
   the feature's diff).
5. Perform the manual line-by-line review of PASS 2. If the SCOPE spans
   several services/directories and the Agent tool is available, split it
   into independent zones and launch a separate subagent per zone (in
   foreground, if the result is needed for a further decision in this same
   dialogue) so as not to cut corners across the whole volume at once. Give
   each subagent the concrete paths and the applicable sections of this skill
   (checklist, severity scale, finding format) — a subagent does not see this
   file itself. Record confirmed findings in an intermediate file as you
   review each zone, rather than keeping them only in context until the final
   report.
6. Perform PASS 3 — the feature's points of contact with the platform's
   existing security invariants (authentication, multi-tenancy, internal-API,
   shared libraries).
7. Consolidate all three passes into a single report per the format above,
   remove duplicates, but do not merge findings of different natures (a
   scanner found a pattern ≠ manual review confirmed exploitability — record
   both facts if both exist). Save the final report as a file at
   `docs/bugs/security_audit/<feature-slug>-security-review.md` (slug — by
   ISSUE-ID or by feature/directory name) — this is the same place where the
   registry of past audit findings lives, and the next run of this skill on
   the same feature should find and update it, rather than recreating it from
   scratch.
8. Explicitly state which checks were NOT performed (no access to prod
   secrets, no access to runtime logs, no ability to run a scanner, etc.) —
   this is part of an honest report, not its weakness.
9. If the project has a `security-review` skill/agent configured (a quick
   review of pending changes on the current branch), you can use it as a
   starting point for PASS 2 on the changed files, but do not limit yourself
   to the diff: the feature may rely on existing code that did not change in
   the current branch but participates in its security model (see PASS 3).

This is testing, not implementation: the developer makes the changes based on
the report, not you within this skill.
