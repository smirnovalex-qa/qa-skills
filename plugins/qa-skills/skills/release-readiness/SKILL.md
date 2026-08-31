---
name: release-readiness
description: Go/no-go release-readiness checklist — aggregates the statuses of every QA check (functionality, tests, coverage, regression, security, performance, accessibility, open defects, migrations, feature flags, observability, rollback, documentation, dependencies) and issues a single verdict: GO / GO-with-conditions / NO-GO with a list of blockers. Use when asked "is the release ready", "go/no-go", "can we release/deploy/ship this", "pre-prod checklist", "what's left before release", "release readiness of a branch/version", "give the green light to ship", "release review" — even if the word "readiness" isn't said literally and it's phrased as "should we ship this today", "is everything closed before release", "isn't it too early to deploy". This is a top-level aggregator: it does not replace the deep checks (feature-review, security-audit, performance-audit, bug-triage) but folds their statuses into one decision; when data on an item is missing it runs the corresponding check or honestly marks the item as unverified rather than inventing a status.
argument-hint: "[version/tag, branch/PR, or release scope] [links to issues/reports] — all optional, the agent gathers what's missing itself"
disallowed-tools: Edit
---

# Release readiness (go/no-go checklist, QA-status aggregator)

You act as the release engineer / QA lead who makes the **ship or don't ship**
decision. Your job is not to re-run every check from scratch, but to gather and
verify the statuses of all critical areas and fold them into one honest
decision. Discipline: **evidence over assertion** — every item needs proof (CI
output, run number, link to a report, file:line, ticket status), not "seems
fine". An item you could not confirm is marked unverified/BLOCKER, not set green
by default. Work adversarially: the release is considered not ready until proven
otherwise.

You are an aggregator on top of the plugin's other skills. Where depth on a
specific area is insufficient — either run the dedicated skill/subagent
(feature-review, security-audit-feature, performance-audit-feature,
bug-triage/bugfix-audit), or request the status from the user/CI, but do not
fill an item with a guess.

## INPUT / SCOPE (how to determine the release perimeter)

The release perimeter arrives in one of several forms — determine which one you
have and record the final SCOPE at the top of the report. The release perimeter
is ALWAYS broader than the literal input: it is what will actually go to prod in
this rollout (the commit range, the set of services, migrations, config/infra
changes).

- **A. VERSION / TAG / RELEASE BRANCH** (`v2.14.0`, `release/2026-08`,
  `main` after the last tag): perimeter = `git log <prev-tag>..<HEAD>`
  — all commits going into the rollout. Group them by service/package
  (in a monorepo — by `services/*`, frontends, `libs/*`), single out DB
  migrations, helm/k8s/docker changes, CI changes. Determine which features/
  tickets are included (by ticket IDs in commit messages: `git log ... --grep`).
- **B. BRANCH / PR / DIFF** (a single feature before merging into the release
  branch): perimeter = `git diff --stat` against the base branch + the consumers
  of the changed code. Here the checklist is applied to a single change as a
  mini-release.
- **C. SCOPE IN WORDS** ("payments module release", "rollout of the new
  onboarding"): translate the description into concrete files/services via
  `grep` over the codebase and the issue tracker; record exactly what is in and
  what is not.

If the perimeter cannot be determined unambiguously (it's unclear what is
shipping to prod) — stop and clarify with the user: which version/branch/set of
tickets is being released and where (staging/prod). Do not check "the whole
project at random".

Also determine the **project's stack and infrastructure** (via package.json /
pyproject.toml / go.mod / pom.xml / Gemfile / composer.json / CI configs /
docker-compose / helm) so you know where to look for statuses: which CI
(GitHub Actions/GitLab CI/Jenkins/…), which tracker (Jira/YouTrack/GitHub
Issues/Linear), where the tests live, where the migrations are.

## KEY PRINCIPLE: DON'T TRUST "GREEN" WITHOUT EVIDENCE

The reason releases fail in prod is items marked "done" without verification.
Work like this:

1. "Tests are green" — show which run, on which commit, whether all types
   (unit/integration/E2E/API) or only part of them. Green unit with no E2E is
   not "tests passed".
2. "No bugs" — check the tracker by the open + severity filter, not "someone
   told me". An open Critical/High = BLOCKER regardless of the feature author's
   opinion.
3. "We'll roll back if anything happens" — the rollback plan must exist and be
   executable (a reversible migration, the previous version's tag, a procedure),
   not merely implied.
4. Distinguish "item is not applicable" (N/A with justification) from "item was
   not verified" (no data). The second is a risk, not a green.
5. Don't turn the report into a wall of caveats: end with a single verdict
   sentence.

## METHODOLOGY

1. Build the SCOPE (see above) and record it.
2. For each checklist category below, assign a status of one:
   **PASS** (verified, has evidence) / **FAIL** (verified, has a problem) /
   **N/A** (not applicable to this release, with justification) /
   **BLOCKER** (a problem that alone blocks the release) / **NOT VERIFIED**
   (no data/access — stating what is needed to verify it).
3. Where data exists in CI/the tracker/previous reports (`docs/qa/`,
   `docs/bugs/`) — gather it. Where areas require a deep check and it hasn't been
   done yet — run the dedicated skill or a subagent (see "Running it"), or
   explicitly request the status, but do not mark PASS without grounds.
4. Collect all statuses into a table, surface blockers at the top, give a
   verdict.

## READINESS CHECKLIST (by category)

Apply the items relevant to the perimeter. For each — status + evidence
(link to a report/run/ticket/file:line).

1. **Functional readiness**
   - All release requirements are implemented (cross-check with feature-review/
     issue/requirements): every acceptance criterion is closed, no partially
     implemented items marked "done".
   - No "dangling" sub-tasks in the tracker on the tickets included in the
     release.
   - The developer's hidden assumptions do not contradict the requirements.

2. **Code quality and review**
   - Code review is complete on all release PRs (approved, not "in progress").
   - No unresolved "must fix" review comments.
   - Lint/types/format are green (not warning-only, see the CI category below).

3. **Tests**
   - Run the available tests yourself (determine the command from the project)
     OR request the status of the latest CI run on the release commit.
   - Break it down by the pyramid levels: unit / integration / E2E / API
     contract — which exist, which are green, which are missing entirely. A
     missing level is an explicit gap, not a PASS.
   - Flaky tests: is "failed" distinguished from "flickers"? A failure due to
     flakiness is not green, but not necessarily a blocker either; qualify it.

4. **Critical-path coverage**
   - The release's critical business scenarios are covered by automated tests or
     at least passed manually (login, the key flow, payment/checkout, core CRUD).
   - Coverage on the new code/diff (not the overall repository percentage) is at
     a reasonable threshold, with no large uncovered error-handling branches.

5. **Regression**
   - Adjacent modules depending on the changed code are verified (regression
     run/manual check). Existing API/data contracts are not broken.
   - Backward compatibility: old clients/integrations keep working with the
     changed contracts.

6. **Security**
   - Status of the security check of the affected perimeter (from
     security-audit-feature or security-review). No open Critical/High security
     findings.
   - New endpoints have auth/authz; no cross-tenant leakage (if multitenancy is
     applicable); no new secrets in git.

7. **Performance**
   - Status of the performance check (from performance-audit-feature), if the
     release touches a hot path/DB queries/the frontend bundle. No unresolved
     before/after regressions.
   - No obvious N+1s, heavy synchronous calls on the hot path, bundle growth
     beyond the threshold.

8. **Accessibility (a11y)** — if the release touches the user-facing UI
   - Status of the a11y check (WCAG minimum: contrast, focus, semantics,
     keyboard, alt/aria), if applicable. No blocking barriers.

9. **Open defects**
   - Query the tracker: open bugs in the release perimeter, grouped by
     severity (see bug-triage). Any open **Critical/High** = BLOCKER.
   - Medium/Low — list as "known issues" with a resolution: whether they ship in
     the release or are deferred with a ticket.

10. **DB migrations / data schema**
    - Are there migrations in the release? Are they reversible (is there a
      downgrade/rollback path)?
    - Safe for prod volume (no blocking ALTER on large tables without an online
      strategy, no long locks)?
    - Is the deploy ↔ migration ordering coordinated (expand/contract: won't the
      new schema break the old code and vice versa during a phased rollout)?

11. **Feature flags and environment configuration**
    - Is the new functionality behind a feature flag? In what state is the flag
      on prod/staging (on/off) and is that what's expected?
    - No flag "temporarily turned off for debugging" and forgotten off.
    - All new configs/environment variables are provisioned on the target
      environment (not just in dev): URLs, keys, limits, timeouts.

12. **Observability (logs / metrics / alerts)**
    - The new functionality has logs sufficient to diagnose a prod incident
      (without leaking PII/secrets into logs).
    - There are metrics/a dashboard and alerts by which a failure of this feature
      is visible in prod (can you even notice that it broke).

13. **Rollback plan**
    - A concrete rollback plan exists (previous tag/image, procedure, migration
      reversibility, flag rollback). Not "we'll roll back somehow".
    - It has been assessed what to do with data written by the new version upon
      rollback.

14. **Documentation and changelog**
    - README/docs/API spec updated to match the actual implementation.
    - A changelog/release notes has been produced; breaking changes are flagged
      for consumers.

15. **Dependencies and supply chain**
    - New/updated packages: an SCA run (pip-audit/npm audit/…), no high-level
      known CVEs. New internal packages are installed from a trusted index (no
      dependency confusion).

16. **Load check** — if the release is load-critical
    - A load/stress test has been run against the expected traffic profile
      (k6/JMeter/locust or the project's equivalent), results within SLA.
      Otherwise — an explicit risk.

17. **Communication and rollout procedure**
    - The rollout window is defined, who to notify (support/customers/adjacent
      teams), who is on call after the release, the incident plan.
    - Consistency of a multi-service release: the deployment order of services if
      there are dependencies between them.

## EDGE CASES THAT ARE OFTEN MISSED

- "Tests are green", but only unit is green; E2E/integration don't run in CI at
  all — critical-path coverage is effectively zero.
- A migration is reversible "on paper", but the downgrade loses data written
  after the upgrade — effectively irreversible in prod.
- The feature flag is on in staging but off by default on prod — "we tested not
  what's shipping".
- A config/secret is provisioned on dev/staging but forgotten on prod — the
  release fails at startup.
- An open Critical bug in the tracker is marked "we'll fix it later", though it's
  in the release perimeter — that's a BLOCKER, not a known issue.
- The order "code deployed first, migration after" breaks old pods during
  rollout (no expand/contract).
- A new endpoint exists but has no alert/metrics — a prod failure will only be
  noticed from customer complaints.
- There is no rollback plan because "we've never rolled back before" — at the
  first incident the team improvises under pressure.
- The release pulls in a dependency upgrade with an incompatible major — it
  breaks an adjacent service not in the explicit SCOPE.
- Multi-service release: service A is deployed, the dependent service B is not;
  the contract between them is temporarily out of sync.
- A change that "doesn't touch prod data" actually changes the message format in
  a queue/webhook — it breaks the consumer after rollout.
- Documentation/changelog "we'll update after the release" — consumers won't
  learn about a breaking change in time.

## VERDICT CRITERIA

- **GO** — all applicable items are PASS or justifiably N/A; no FAIL/BLOCKER;
  no unverified items critical to this release.
- **GO-with-conditions** — no blockers, but there are Medium/Low remarks or
  unverified non-critical items; list the conditions (what to close before/right
  after the rollout, under which ticket, with which feature flag).
- **NO-GO** — there is at least one BLOCKER or FAIL in a critical category
  (an open Critical/High bug or security finding, red critical-path tests, an
  irreversible migration with no rollback plan, no rollback plan for a risky
  release). Provide an explicit list of blockers — exactly what to close to make
  it GO.

The verdict is a single sentence at the very start of the report. Don't soften
it: if there is a blocker — it's NO-GO, even if "almost everything is ready".

## REPORT / OUTPUT FORMAT

Save the report to `docs/qa/release-readiness/<version-or-scope>.md` (slug — by
version/tag or release name; follow the existing repository structure if there
is one, otherwise create `docs/qa/release-readiness/`). Echo the key points to
chat. Structure:

1. **Verdict in one sentence** at the start: GO / GO-with-conditions / NO-GO,
   and if not GO — a brief list of blockers/conditions.
2. **Executive summary** (for management, no jargon): is the release ready, what
   exactly is blocking, what's the risk if we ship now.
3. **SCOPE** — what's in the release (version/commit range/services/migrations/
   tickets) and what's outside it.
4. **Checklist summary table**: category → status (PASS/FAIL/N/A/BLOCKER/
   NOT VERIFIED) → evidence (link/run/ticket/file:line) → comment.
5. **Blockers** — as a separate list, each with the concrete action that turns
   it into PASS, and the responsible area.
6. **Known issues** — Medium/Low shipping in the release deliberately, with
   tickets.
7. **Conditions for GO-with-conditions** — what to do before/right after the
   rollout.
8. **What was NOT verified** — items with an honest "not verified" status and
   what was missing (no access to prod CI, no environment, no data from the
   tracker), so that the absence of findings doesn't read as "all clean".

## FORMATTING RULES

- Before starting, check whether a report on this version/perimeter already
  exists in `docs/qa/release-readiness/` — if so, update the statuses (was FAIL
  → now PASS with new evidence) rather than recreating it from scratch.
- Every status is backed by a link to its source (CI run #, ticket, dedicated
  skill's report, file:line). A status with no source = "not verified".
- Do not pass off static code reading as a test run or a prod-configuration
  check.

## RUNNING IT (practical instructions)

1. First, YOURSELF (in the main thread) build the release SCOPE — this step
   cannot be delegated; a subagent does not see the dialog context and does not
   know what is being released.
2. Determine the project's stack/CI/tracker so you know where to pull statuses.
3. Gather the "cheap" statuses directly: a test run (run it yourself if you can),
   open bugs from the tracker, the presence of migrations/feature flags/configs
   in the diff, existing reports in `docs/qa/` and `docs/bugs/`.
4. For areas that require depth and aren't covered yet (security, performance,
   regression, live UI run) — either run the dedicated skill (feature-review,
   security-audit-feature, performance-audit-feature, bug-triage, bugfix-audit),
   or, if the Agent tool is available, delegate checking a zone to a subagent,
   passing it concrete paths and the relevant checklist (the subagent does not
   see this file). Parallelize across independent areas.
5. Fold all statuses into a table, surface blockers at the top, phrase the
   verdict in one sentence, save the report.
6. Honestly mark the items you could not verify yourself — do not mark PASS by
   default.

This is a readiness decision, not an implementation: code-editing tools are
unavailable by design. You gather evidence and render a verdict; the fixes and
the rollout itself are done by the developer/release engineer.

