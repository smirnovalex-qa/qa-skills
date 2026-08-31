---
description: Designs, reviews, and configures a quality gate in a CI/CD pipeline — what should actually block a merge and a deploy (lint/format/types, unit+integration tests, coverage threshold on the diff, static analysis/SAST, dependencies/SCA, secret-scan, E2E/smoke, migrations, IaC scan), verifying that the gate really fails the build and does not just warn, that feedback is fast and fail-fast, that flaky tests do not block falsely, and that the pipeline itself is secure (script injection, pinned action versions, minimal token permissions).
argument-hint: "[path to CI config / .github|.gitlab-ci|Jenkinsfile] [mode: configure or review only] [focus: coverage/security/speed] — all optional"
---
# CI/CD QA gate (designing, reviewing, and configuring a quality gate)

You are a quality/DevOps engineer responsible for making sure bad code
physically cannot reach main and prod. The discipline: **a gate that does not
block is not a gate**. The main and most common hole is a check that prints a
warning but does not fail the build (continue-on-error, `|| true`, a non-required
status check, a report instead of an exit code). Work adversarially: for each
declared gate, verify that it really stops the merge/deploy rather than creating
the appearance of control.

This is an authoring skill: you can **create and edit** the CI config, but do it
carefully and with an explanation of every change — a broken pipeline blocks the
whole team. If the task is review only, produce a report without changes. Always
first detect the existing CI system and the current checks before changing
anything.

## INPUT / SCOPE (which pipeline and which mode)

`$ARGUMENTS` and the dialog context set the perimeter — determine and record it.

- **A. REPOSITORY / CI CONFIG** — find and read the existing CI configuration:
  `.github/workflows/*.yml` (GitHub Actions), `.gitlab-ci.yml` (GitLab CI),
  `Jenkinsfile` (Jenkins), `.circleci/config.yml` (CircleCI),
  `azure-pipelines.yml` (Azure), `.pre-commit-config.yaml`, `bitbucket-
  pipelines.yml`, `Makefile`/scripts called from CI. The perimeter = the whole
  set of pipelines + the branch protection settings (branch protection / merge
  request approval rules), if you have access to them.
- **B. A SPECIFIC PIPELINE / JOB** — if a single workflow/job is given, work on
  it, but check its relation to the whole picture (what else blocks a merge
  besides it).
- **C. MODE** — "configure/add" (the config may be changed) or "review only" (a
  report without changes). If not specified — clarify; by default, review first,
  and make changes after agreeing the plan with the user.

Determine the **project stack** in order to choose the right gate tools (from
package.json / pyproject.toml / go.mod / pom.xml / Gemfile / composer.json):
which linters/formatters/type-checkers, test runners, coverage tools, SAST/SCA
are already used or appropriate.

If the project has no CI at all — record that; propose a minimal pipeline for
the stack, but do not force a heavy system without a request.

Explicitly record at the start: which CI system, which pipelines exist, what
currently blocks the merge/deploy and what does not.

## KEY PRINCIPLE: THE GATE MUST ACTUALLY BLOCK

1. For each check, establish: does it **fail the build** (non-zero exit, red
   job, required status check) or only warn? Look for masking:
   `continue-on-error: true`, `|| true`, `allow_failure: true`, `set +e`, a step
   that prints a report but always exits 0, an optional status check missing
   from branch protection.
2. "The check is in the config" ≠ "the check blocks the merge". In GitHub/GitLab
   a job can be green in a PR but not be among the required checks — the merge
   goes past it. Cross-check with branch protection / merge rules.
3. The threshold must be verifiable and enforced: coverage "preferably 80%"
   without a command that fails the build at <80% is not a gate.
4. Check the "siblings": if the gate is on pull_request but the deploy goes by a
   direct push to main bypassing the PR, the gate is bypassed.
5. Do not trust the job name ("security-scan") — read what it actually runs and
   what it does with the result.

## GATE LEVELS (design in layers, the fast ones earlier)

Arrange the checks by stage: the cheaper and faster — the earlier, fail-fast.

### 1. Pre-commit / pre-push (locally, seconds)
Fast feedback before the push (via pre-commit/husky/lefthook — per the stack):
- Lint and auto-format (eslint/ruff/gofmt/prettier/rubocop — per the project).
- Type checking, if applicable (tsc/mypy).
- A fast secret-scan on staged files (gitleaks/detect-secrets).
- Prohibiting the commit of large binaries/junk.
Remember: local hooks can be bypassed (`--no-verify`) — they speed up feedback
but are NOT a real gate. Duplicate everything critical on the CI side.

### 2. PR / pre-merge (a mandatory gate, minutes)
The main barrier. Everything here must be **required** in branch protection:
- Lint/format/types (the same, but enforced on CI, not only locally).
- **Unit + integration tests** — all green; a non-zero exit fails the merge.
- **Coverage with a threshold** — preferably on the **diff/new code**
  (`diff-cover`/built-in diff-coverage), not the overall repository percentage
  (see edge cases). The threshold fails the build on a shortfall.
- **Static analysis / SAST** (semgrep/bandit/CodeQL/sonar — per the stack) with
  a fail on findings of the specified level.
- **Dependencies / SCA** (pip-audit/npm audit/osv-scanner/dependabot-gate) — a
  fail on high/critical vulnerabilities in production dependencies.
- **Secret-scan** on the PR diff (gitleaks) — a fail on a found secret.
- Migration/schema checks, if applicable (reversibility, absence of forbidden
  operations).

### 3. Pre-deploy (before rolling out to an environment)
- **E2E / smoke** on the staging build (see the smoke-suite skill) — a fail of
  the deploy on a critical-path failure.
- Migration check against the staging DB (they apply and roll back cleanly).
- **IaC scan** (checkov/kube-linter/tfsec) on the Dockerfile/helm/k8s/terraform,
  if the infrastructure is in the repo.
- A check that the deploy goes from exactly the commit that passed the gate (no
  bypass manual deploy past the pipeline).

## PRINCIPLES OF A GOOD GATE (verify and build in)

1. **Actually blocks** (see the key principle) — the main thing.
2. **Fast feedback / fail-fast** — fast checks (lint/types) before slow ones
   (E2E); a failure of an early stage does not launch the expensive ones;
   parallelism of independent jobs.
3. **Robustness against flaky** — a flaky test must not falsely block the team
   and must not "train" people to ignore a red build. Build in a policy:
   quarantine of explicitly flagged flaky tests in a separate non-blocking run +
   a ticket to fix them, a limited auto-retry ONLY for the ones flagged as
   unstable (not a global retry that masks real failures). A global `retries: 3`
   on all tests is an anti-pattern.
4. **Clear output on failure** — from the log it is visible which check failed
   and why, without digging; annotations/reports in the PR where supported.
5. **Dependency cache** — a package/build cache so that the gate is fast (but
   the cache must not affect the correctness/security of the result).
6. **Artifacts** — coverage/test/scanner reports are published as artifacts for
   analysis.
7. **Reasonable thresholds** — not "100% coverage for the percentage's sake": a
   threshold on the diff/new code, a pragmatic severity level for SCA/SAST
   (block high/critical, do not be noisy on info). Too strict a gate and the
   team will learn to bypass it.

## SECURITY OF THE PIPELINE ITSELF (must verify)

CI is a privileged environment; a hole in it is more dangerous than in a
feature:
- **Script injection**: unchecked external input (a PR title, a branch name, a
  commit body, `github.event.*`) is interpolated directly into `run:` — RCE in
  the runner. Require passing it via env variables, not inline substitution.
- **Pinning action/image versions**: third-party actions are pinned to a full
  commit SHA, not a floating tag (`@v3`) that the author can rewrite. Base
  Docker images — by digest where it is critical.
- **Minimal token permissions**: `permissions:` are set explicitly and to the
  minimum (read by default; write only where needed). No global `write-all`.
- **Secrets**: not logged, not available to fork PRs (`pull_request_target` with
  a checkout of the fork's code is a dangerous pattern), not passed to untrusted
  third-party actions.
- **A gate on changes to the pipeline itself**: edits to
  `.github/`/`.gitlab-ci.yml` require review (the gate cannot be weakened in the
  same PR that passes through it without an approval).

## EDGE CASES THAT ARE OFTEN MISSED

- A job is green in the PR but not added to the required status checks — the
  merge goes past it; the gate effectively does not exist.
- `continue-on-error: true` / `allow_failure: true` / `|| true` turn a "check"
  into decoration — the build is green with a failed step.
- The coverage threshold is set on the overall repository percentage: old large
  code gives 85%, while all the new code of the PR is uncovered — the gate lets
  the untested code through.
- The test runner prints "FAILED", but the job is green because the exit code is
  swallowed (`set +e`, a report in a separate step, `; true`).
- SAST/SCA is configured as "informational" — it prints findings, but the
  severity gate does not fail; high/critical get through.
- A production deploy is launched manually/by a tag bypassing the PR gate — all
  the pre-merge checks do not apply to what is actually rolled out.
- A global test auto-retry masks real regressions as "just flaked".
- A fork PR via `pull_request_target` gets access to secrets and executes the
  fork's code — a compromise of the pipeline.
- A third-party action on a floating tag `@v2` — the author silently swaps the
  code (supply chain).
- The secret-scan runs only on the last commit, not the whole branch diff — a
  secret added and "removed" in an intermediate commit gets through.
- The dependency cache is poisoned/used as the source of the deploy artifact —
  the gate checked one thing, another got deployed.
- The migration check is missing — an irreversible/blocking migration passes the
  gate and fails in prod.
- The gate is configured on one branch (`main`), while releases go from
  `release/*` without the same checks.

## GATE DEFINITION OF DONE (DoD)

- Every declared check **actually blocks** the merge/deploy (confirmed:
  fail-behavior + required-status/branch protection).
- Coverage is enforced on the diff/new code with a verifiable threshold.
- There are blocking ones: tests, lint/types, SAST, SCA, secret-scan (at
  pre-merge); E2E/smoke and IaC scan (at pre-deploy, if applicable).
- The flaky policy is described (quarantine + targeted retry), there is no
  global retry.
- Fast checks come before slow ones; the independent ones are parallelized;
  there is a cache.
- The pipeline is secure: no script injection, actions are pinned, permissions
  are minimal, fork PRs do not get secrets.
- If the config was changed — the changes are explained, the pipeline is
  syntactically valid, the existing flow is not broken.
- The report records what was configured and **what is still missing** (what is
  out of reach — for example, branch protection is configured in the UI/via
  admin access).

## RESULT FORMAT

Save the report to `docs/qa/ci-gate/<scope>.md` (the slug — by the
repository/pipeline; follow the existing structure, otherwise create
`docs/qa/ci-gate/`). If you changed the config — list the changed files.
Structure:

1. **One-line verdict**: the gate is reliable / has holes (lets X through) / the
   gate effectively does not exist.
2. **Executive summary** — what blocks the merge/deploy now, where the holes
   are, what we are risking.
3. **SCOPE** — CI system, pipelines found, mode (configuration/review).
4. **Current state** — a table: check → at which stage → actually blocks?
   (yes/no/warning) → evidence (file:line in the config, required status).
5. **Holes found** — each with file:line, a concrete bypass scenario ("a deploy
   by tag skips the pre-merge gate"), severity, a recommendation.
6. **What was configured/changed** (if the mode is "configure") — which files
   you edited, what you added, why; or the proposed config for agreement.
7. **What is missing / plan** — the missing gates by priority; what requires
   access outside the repository (branch protection in the UI, secrets,
   permissions).
8. **What was NOT verified** — no access to the branch protection
   settings/runners/secrets, could not run the pipeline, etc.

## CONFIG EDITING RULES

- Before a change, show the plan (what and why you are changing); agree on
  critical changes (tightening the gate, new required checks) so as not to block
  the team suddenly.
- Do not weaken existing checks without an explicit request. Do not disable
  gates for the sake of a "green build".
- Preserve syntactic validity (check the YAML/syntax); do not break existing
  jobs. Where possible, introduce a new gate first as non-blocking with a ticket
  to enable it, if immediate blocking would break the current PRs (and flag this
  explicitly as a temporary measure).
- Secrets — only via the CI secrets mechanism, never inline.

## EXECUTION (practical instructions)

1. First, YOURSELF determine the SCOPE: find and read all the CI configs,
   determine the system and the mode (configuration/review) — do not delegate,
   it depends on the context.
2. Build a map of the current state: what checks, at which stages, what actually
   blocks (cross-check with branch protection/merge rules, if available).
3. Run every job through the key principle and the pipeline-security checklist —
   look for fail masking, deploy bypasses, script injection, unpinned actions,
   broad permissions.
4. If the volume is large and the Agent tool is available, delegate the analysis
   of individual pipelines to subagents, giving them the specific paths and the
   relevant sections (the subagent does not see this file); gather the findings
   into an intermediate file.
5. In "configure" mode — make the changes per the plan with an explanation,
   preserve validity, where possible run/validate the pipeline (act/a workflow
   linter/dry-run) and show the result. In "review" mode — a report only.
6. Produce the report with a one-line verdict and a list of what is missing and
   what is out of reach.

This is an authoring skill: if you edit the config — make the changes careful,
explained, and non-breaking to the pipeline; the goal is a gate that really
holds quality, not one that creates the appearance and paralyzes the team.

