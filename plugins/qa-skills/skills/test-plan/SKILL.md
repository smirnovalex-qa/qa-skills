---
name: test-plan
description: Generates a pragmatic test plan / test strategy for a feature, release, or project — inspired by IEEE 829 and ISTQB, but without the bureaucracy: scope and out-of-scope, test levels and types, risk-based prioritization of areas, test environments and data, entry/exit criteria, metrics, roles, phases, and the risks of the testing itself. Use when asked to «write a test plan», «we need a test strategy», «how will we test this feature / this release», «a release test plan», «define the scope and priorities of testing», «what to cover at which level», «plan the QA for this feature». Trigger also when the words «test plan» are not spoken literally, but the user asks to plan/organize testing, distribute the verification effort, decide what to test deeply and what to smoke. The skill is project-agnostic: it first detects the project's stack, test frameworks, and tracker, then adapts the plan to what is already in use; for a feature it reconstructs the scope itself from the requirements/code. This is NOT the writing of the test cases or automated tests themselves, and NOT a review of a finished feature — it is a TOP-level plan: what to verify, at which level, in what order, and against which criteria.
argument-hint: "[feature/branch/diff/directory, or path to requirements/PRD, or an issue in the tracker Jira/YouTrack/GitHub/Linear, or «release X / the whole project»] — all fields optional"
disallowed-tools: Edit
---

# Test plan / test strategy (scope, levels, risks, criteria)

You are a QA lead who designs HOW a feature/release/project will be tested,
before writing the concrete cases. A good test plan answers the questions "what
is in scope and what is explicitly NOT in scope", "at which level is this caught
most cheaply", "where to concentrate effort when time is short", and "by which
criteria do we consider testing complete". It is a top-level plan, not a list of
cases.

Working discipline:
- **Pragmatism over form.** Lean on the IEEE 829 structure and ISTQB
  terminology, but do not spawn sections for the sake of a checkbox — every item
  in the plan must influence decisions (what to test, with what, when, who). An
  empty section is better dropped than padded with filler.
- **Risk-based by default.** Resources are finite. The plan must explicitly rank
  areas by risk and assign testing depth in proportion to risk, rather than
  "test everything equally".
- **Grounded in the real scope.** If the plan is for a concrete feature, do not
  make up abstractions — reconstruct the actual scope from the requirements
  and/or code (git diff, affected modules) and plan against it.
- **Fit the project's tools.** First detect the stack and which test frameworks
  already exist, and plan in those terms, rather than imposing new ones.

Designing the areas can be parallelized across subagents (see "Launch");
determining the SCOPE is done by you in the main thread.

## INPUT / SCOPE (how to determine the planning perimeter)

Object of planning: `$ARGUMENTS` (and/or chat context). Determine the input type
and build the perimeter.

**A. CODE: feature / directory / branch / diff / PR / whole project**
- Feature perimeter = the contents of the directory or the files from
  `git diff --stat` relative to the base branch (main/dev) + the modules that
  import them (`grep -r`) + the registration points (routes/DI) + the consumers
  (frontend, adjacent services). Reconstruct from the code WHAT is actually
  affected — do not rely on the verbal description of the feature alone.
- Release perimeter = the set of features/tickets in the release; assemble their
  combined scope, with special attention to the zones where they intersect
  (regression at the seams).
- "Whole project" perimeter = a map by services/modules/screens; structure the
  plan around that map, do not dump it into a single list.

**B. A DOCUMENT: requirements / spec / PRD** (`.md/.txt/.docx`)
- Read it in full, extract the entities (endpoints, screens, roles, rules,
  non-functional requirements). This becomes the basis for tracing "requirement
  → test area → level".
- If code also exists — reconcile the document's scope against the actual
  implementation (grep), so that the plan covers the real thing, not just what
  is declared.

**C. An ISSUE in a tracker** (Jira/YouTrack/GitHub/Linear — ID/link)
- Get the issue text and acceptance criteria via the available integration
  mechanism (the tracker's MCP tool, if connected; `gh issue view <N>`). No
  access — ask the user for the text, do not invent it.
- Find the related commits/branch by the ticket ID
  (`git log --all --grep=<ID> --oneline`, then `git show --stat`) and build the
  list of affected files to reconstruct the scope.

**Detecting the project's tools (for all modes):** before planning the levels,
detect the stack and the test frameworks already in use —
`package.json`/`pyproject.toml`/`go.mod`/`pom.xml`/`Gemfile`/CI config, the test
directories (`tests/`, `__tests__/`, `e2e/`, `cypress/`, `spec/`). Plan in the
terms of what exists (e.g. if E2E is already on Playwright — do not propose
Cypress without a reason).

The planning perimeter ALWAYS also includes what the feature might BREAK
(adjacent modules) — the regression scope is part of the plan. If the perimeter
cannot be determined — stop and clarify, do not plan a blind "test the whole
project". Record the SCOPE and an explicit OUT-OF-SCOPE at the start of the plan.

## KEY PRINCIPLE: A PLAN IS DECISIONS, NOT AN INVENTORY

A weak test plan lists "we will do functional, integration, regression testing"
— and that changes nothing. A strong plan makes verifiable decisions:
1. Each area gets a **risk level** and the resulting **depth** (exhaustive /
   normal / smoke / deliberately skipped).
2. Each type of check is tied to the **pyramid level** where it is cheapest
   (rule validation — with unit tests, API contract — with integration tests, a
   critical business path — with E2E), rather than "everything through
   expensive E2E".
3. **OUT-OF-SCOPE** is named explicitly — what we deliberately do not test and
   why (the residual risk is accepted). Silence about this is a source of a
   false sense of coverage.
4. **Exit criteria** are set as numbers, so that "we've tested it" is not a
   matter of opinion.

## METHODOLOGY (order of building the plan)

1. **Determine the SCOPE and tools** (section above). Record the scope and
   out-of-scope.
2. **Break the perimeter into test areas** — functional blocks/modules/user
   scenarios. Give each area a name.
3. **Assess the risk of each area** (defect probability × impact) and assign a
   depth. If a full-blown risk analysis is needed — see the related skill
   `risk-analysis`; here a simplified matrix is enough (block 3).
4. **Design the levels** — distribute the checks across the test pyramid (block
   1).
5. **Choose the testing types** applicable to the perimeter (block 2),
   discarding the inapplicable ones with an explicit note why.
6. **Determine the environments, data, entry/exit criteria, metrics, roles,
   phases, testing risks, and dependencies** (blocks 4–8).
7. **Assemble the plan** into an artifact in the format below + a requirement→
   area traceability.

## CHECKLIST BY PLAN SECTION (fill in the ones relevant to the perimeter)

**1. Test levels (the test pyramid)**
- Distribute the checks across levels: **unit** (isolated logic, branching,
  boundary values), **integration** (module+DB/queue/cache, contracts between
  layers), **API/contract** (endpoints, request/response schemas, error codes),
  **E2E** (end-to-end user scenarios via UI/public API),
  **manual/exploratory** (things that are expensive/pointless to automate:
  layout, usability, exploratory testing).
- Justify the balance: the bulk on the cheap lower levels, E2E only for critical
  end-to-end paths. If the project is already skewed toward E2E — note that as a
  risk of the plan.
- Specify for each level the framework used in the project (detected at the
  SCOPE step), not abstractly.

**2. Testing types (which are applicable)**
- **Functional** — verification of business rules and acceptance criteria.
- **Regression** — what of the already-working functionality might break;
  determine the regression set for the adjacent modules (by the dependencies
  from SCOPE).
- **Non-functional** — include only the applicable ones; for each, state whether
  there is a measurable requirement (otherwise there is nothing to test, see
  `requirements-review`):
  - performance/load (if there is an SLA/target numbers) — tool per the project
    (k6/JMeter/Locust/Gatling);
  - security (if the feature touches auth/data/integrations) — refer to
    `security-audit-feature`, do not duplicate;
  - accessibility (a11y/WCAG) — if there is UI and a requirement on the level;
  - compatibility (browsers/OS/devices/resolutions) — if there is a support
    matrix;
  - localization/internationalization — if there are several languages/locales;
  - data compatibility / API backward compatibility — on migrations/contract
    changes.
- Explicitly list the types that are NOT applicable to this perimeter, so that
  it is visible that the decision was deliberate.

**3. Risk-based prioritization of areas**
- For each area: defect probability (complexity, novelty, change frequency/
  churn, current test coverage) × impact (business criticality, number of users,
  reversibility, money/data/security).
- Assign a risk level and testing depth:
  **exhaustive** (all equivalence classes, boundaries, negative paths, decision
  tables) / **normal** (happy path + key negative) / **smoke** (basic
  operability) / **deliberately skipped** (with justification and residual risk
  recorded).
- For a deep risk analysis, hand off to the `risk-analysis` skill; here give the
  final "area → risk → depth" table.

**4. Test environments and data**
- On which environment each level runs (local/CI/staging), which services must
  be up, what is mocked/stubbed (external payment providers, SMS, third-party
  APIs).
- Test data: where it comes from (fixtures/factories/seed scripts/anonymized
  dump), whether special accounts/roles/tenants are needed, how it is cleaned up
  between runs. If the data contains PII — anonymized only.
- Feature flags: in which position it is tested (on/off/both).

**5. Entry / Exit criteria (Definition of Done for testing)**
- **Entry** (when it CAN START): the code is merged into the test branch, the
  build is green, the environment is up, the test data is ready, the
  requirements are frozen.
- **Exit** (when testing is COMPLETE): set as numbers — for example "all P1/P2
  cases passed", "0 open Critical/High bugs", "requirements coverage 100% for
  critical areas", "automated-test failures = 0 (flaky investigated)". Without
  numbers, an exit criterion is useless.

**6. Metrics**
- Requirements coverage (how many requirements have at least one case), and
  where possible — code coverage for the unit tests.
- Defect density by area (bugs found / area size) — where defects concentrate,
  add depth there.
- Progress: cases done/remaining, pass rate, number of open defects by severity,
  automated-test flaky rate.

**7. Roles, responsibility, phases, schedule**
- Who writes/runs which levels (developers — unit/integration; QA —
  E2E/manual/exploratory), who makes the release decision by the exit criteria.
- Phases and their order: smoke → functional by area (in decreasing order of
  risk) → adjacent-module regression → non-functional → acceptance. Tie it to
  the release milestones, if they are set.

**8. Risks of the testing itself and dependencies**
- Risks of the testing process and their mitigation: unstable environment,
  unavailability of external services (stubs needed), flaky tests, shortage of
  test data/accounts, tight deadlines (then — what gets cut first per
  risk-based), domain knowledge.
- Blocker dependencies: access (VPN/accounts/secrets of test integrations),
  readiness of adjacent teams/services, test licenses, stubs of external systems
  being up. Each dependency — with an owner and a deadline.

## PLANNING EDGE CASES OFTEN MISSED

- Regression of adjacent modules: the plan covers the feature itself but forgets
  what it indirectly changes (a shared component, a shared table, a shared
  middleware).
- Feature seams in a release: each feature works on its own, but their
  interaction is not planned for verification.
- Data migrations and backward compatibility: the plan tests the new behavior
  but does not check the already-existing records/old clients after the
  migration.
- Rollback: no scenario planned for rolling back the release and its consequences
  for the data.
- Test data for negative paths: it is harder to prepare, so the negative branches
  "fall out" of the plan.
- Non-functional without a measurable requirement: the plan promises to "check
  performance", but there is no target number — there is nothing to test against
  (raise a question in the requirements).
- The environment differs from prod (data/scale/flag config) — some defects do
  not reproduce; note it as a limitation.
- Mocked external services hide real contract divergences — plan at least
  contract/periodic real runs.
- Concurrency and multi-tenancy: planned as "functionality", though they require
  separate scenarios (races, data isolation between tenants).
- Locales, time zones, date/number formats fall out if the test environment is in
  a single locale.
- Flaky tests accepted as "they fail sometimes": without a plan to investigate
  them, the exit criterion on automated tests is unreachable.
- Accessibility and keyboard navigation: deferred "for later" and do not make it
  into the plan at all.

## PLAN QUALITY CRITERIA (Definition of Done for the test plan itself)

The plan is considered ready if:
- the SCOPE and OUT-OF-SCOPE are stated explicitly;
- each area has a risk level and an assigned depth;
- each type of check is tied to a pyramid level and to a project tool;
- the exit criteria are set as numbers;
- the environments, data, and blocker dependencies with owners are listed;
- there is a requirement → area → level traceability (at least as a table);
- the residual risk of what was decided not to test is named explicitly.

## PLAN FORMAT / ARTIFACT

Save it to `docs/qa/test-plans/<scope-slug>.md` (slug — by the feature/release/
issue-ID name). First check the repository convention; `docs/qa/...` is the
default. If a plan for this perimeter already exists — update it rather than
creating a second one.

Structure:
1. **Executive summary** — what we test, what the scope is, where the main risks
   are, how much effort and in what order, the key blocker dependencies.
2. **SCOPE and OUT-OF-SCOPE** — what is in scope, what is deliberately out and
   why (residual risk).
3. **Test areas and risk-based prioritization** — a table
   `area | risk | depth (exhaustive/normal/smoke/skip) | justification`.
4. **Test levels** — the distribution across the pyramid + the project framework
   at each level.
5. **Testing types** — the applicable ones (with details) and the inapplicable
   ones (with a note why).
6. **Environments and test data** — where, what is up/mocked, where the data
   comes from.
7. **Entry / Exit criteria** — with numbers.
8. **Metrics** — what and how we measure.
9. **Roles, phases, schedule** — who does what and in what order.
10. **Testing risks and dependencies** — with mitigation and owners.
11. **Requirement → area → level traceability** (a table), if there are
    requirements.
12. **What the plan does NOT cover / limitations** — an honest list of what was
    left out (no prod-like environment, no measurable NFRs, no access to external
    systems, etc.).

## FORMATTING RULES

- Refer to real project paths/modules (`file`/directory) and to concrete
  requirements/tickets, not to abstractions.
- Back up depth and risk level with a reason (complexity/novelty/churn/impact),
  do not assign them arbitrarily.
- Do not duplicate the methods of neighboring skills: the detailed risk analysis
  belongs in `risk-analysis`, the review of the requirements themselves in
  `requirements-review`, security in `security-audit-feature`; refer to them from
  the plan.

## LAUNCH (practical instructions)

1. **Yourself, in the main thread**, carry out the "Input" section: determine
   the input type, reconstruct the actual scope (for a feature — from git
   diff/code/requirements), detect the project's stack and test frameworks. Do
   not delegate — a subagent does not know the context of "which feature/release
   we are planning". Record the SCOPE and OUT-OF-SCOPE.
2. Check whether a plan for this perimeter already exists in
   `docs/qa/test-plans/` — update the existing one.
3. Break the perimeter into areas. If the perimeter is large (a release of many
   features / the whole project) and the Agent tool is available — split the
   areas among subagents: each works through its own group (levels, types, risk,
   data for it). Pass the subagent the concrete paths/requirements of its area,
   the relevant checklist blocks, the depth scale, and the format — it does not
   see this file or the overall context. Accumulate interim work into a file.
4. Yourself, assemble a single plan from the areas: reconcile the risk levels
   across areas (so the scale is shared), add the seams/regression between
   features (a single-area subagent will not see them), determine the global
   environments/data/criteria/roles/phases.
5. Save the plan in the format above and explicitly list what was left out.

This is the planning of testing, not its execution and not the writing of cases:
the concrete test cases and automated tests are created separately from this
plan. The plan should be such that the whole team can work from it, not just its
author.

