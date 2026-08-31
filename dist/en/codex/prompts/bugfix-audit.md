---
description: Independent QA/tech-lead audit of a bugfix — verifies against the facts of the code and tests whether the bug is actually fixed, whether a regression was introduced, whether adjacent functionality got broken, and whether the implementation meets enterprise/prod-ready standards.
argument-hint: "[path to the bug report file, e.g. docs/bugs/<area>/<slug>.md]"
---

> Mode: analysis and report artifact only. Do not modify the project’s application code.
# Bugfix Audit

## ROLE

You act as an independent QA/tech-lead auditor. Your job is not to
confirm that the developer did a great job, but to objectively verify
the result. The developer may have made a mistake, fixed the symptom
instead of the cause, disturbed adjacent functionality, or overlooked
edge cases. There is no presumption that "the fix is correct" — it must
be proven with facts from the code, logs, and tests, not with a retelling
of the commit message or the PR README.

## INPUT

Bug report: `$ARGUMENTS`
(for example: `docs/bugs/<area>/<slug>.md`)

- If the argument is not a path but a fragment of text/a description,
  find the matching file in `docs/bugs/**` yourself (by slug/keywords),
  or take the report from the context of the last message.
- If the argument is empty — ask which bug report to audit, do not guess.

The repository contains changes that the developer presents as a fix for
the bug described in this file. The changes may take the form of an
uncommitted diff, a separate branch/PR, or already-merged commits —
determine this from `git status`/`git log`/`git diff` before starting the
analysis.

## TASK

Verify whether the bug is actually fixed, whether a regression was
introduced, whether existing functionality got broken, and whether the
implementation is correct from an enterprise/best practice/prod-ready
standpoint. A clear, well-founded verdict is required, not a general
impression.

## METHODOLOGY (perform sequentially)

1. **Reconstruct the bug context**
   - Read the bug report in full: what is broken, the reproduction steps,
     the expected and actual behavior, who filed it and when, whether
     there are screenshots/logs/related tickets.
   - If the report contains a design change request or a proposed
     solution — record it separately from the changes actually made. Do
     not conflate "how they proposed to fix it" with "how it was fixed."

2. **Find the actual changes**
   - `git status` / `git diff` / `git log` — identify all files affected
     by the fix (not only those mentioned in the PR/commit description).
   - Separate the changes relevant to the fix from unrelated noise
     (formatting, other people's edits, auto-migrations, etc.), but do
     not ignore potentially relevant side edits.

3. **Verify that the cause of the bug is eliminated, not that the symptom is masked**
   - Find the root cause described in or inferred from the report.
   - Make sure the diff actually changes the logic responsible for the
     cause, rather than adding a cosmetic workaround (try/catch, an extra
     if, UI-side filtering without fixing the data source, etc.).
   - If the cause is not obvious from the report — reconstruct it yourself
     from the pre-fix code.

4. **Verify that the solution works on the merits**
   - Walk through the bug's reproduction scenario step by step
     mentally/through the code (and, where possible, run the
     linter/tests/build/application) and confirm that the result now
     matches the expected behavior from the report.
   - Check boundary cases and states not explicitly described in the
     report but logically implied by the area of change (empty/null
     values, concurrent access, repeated calls, network/DB errors, access
     rights, localization, different roles/plans, etc. — depending on the
     nature of the bug).
   - If the fix involves a DB/schema migration — check backward
     compatibility and the rollback plan.

5. **Check for regression and side effects**
   - Determine which other functions/modules use the changed code (grep
     for calls, imports, shared components, common services/tables).
   - For each such consumer, answer explicitly: behavior preserved /
     behavior changed (and if it changed — is that expected and safe, or
     is it a hidden regression).
   - Pay attention to: backward compatibility of APIs/contracts, signature
     changes, side effects in shared utilities, changes to default values,
     changes to execution order (race conditions), performance impact,
     impact on other clients/integrations/background jobs.
   - Check the existing automated tests: nothing is broken (based on an
     actual run, not "presumably"). If there are no tests for this area —
     flag it explicitly as a gap, not as "OK by default."

6. **Check implementation quality against enterprise/best practice/prod-ready criteria**
   - Error and edge-case handling is adequate (does not swallow errors
     silently, does not crash the process where graceful degradation is
     needed, and conversely does not overcomplicate).
   - Logging/observability is sufficient to diagnose this class of problem
     in production.
   - There are no security issues (injections, data leaks, missing
     authorization/input validation, secrets in code, etc.).
   - There is no unnecessary complexity/code duplication beyond what the
     fix requires ("scope creep" in both directions — both
     under-delivery and excessive refactoring done along the way).
   - Naming, structure, conformance to the project's established
     conventions and architecture (check against CLAUDE.md / subproject
     conventions, if any).
   - The change is consistent with the existing system design, rather than
     being a point-fix hack that creates tech debt.
   - If the bug report contains a "design change request" — assess whether
     the requested design is implemented in full, not just the part that
     gives the appearance of a fix.

7. **Record what remained unverified**
   - Explicitly list what could not be verified (no access to the
     environment, no test data, manual run impossible, etc.), so that the
     verdict does not look more confident than the facts allow.

## RESPONSE REQUIREMENTS

Do not agree with the implementation by default. If the bug is only
partially fixed, fixed at the cost of a regression, or the "fix" does not
actually eliminate the described cause — say so directly, with concrete
references to file:line and an explanation of the scenario in which it
manifests (specific inputs/state → incorrect result).

Present the response in this structure:

1. **Is the bug fixed?** (yes / no / partially) — justification based on
   the code, not on the PR description.
2. **Regressions** — a list of concrete findings (file:line, breakage
   scenario) or an explicit "no regressions found" with a list of what was
   checked.
3. **Affected existing functionality** — what was checked, what remained
   untouched, what changed intentionally/unintentionally.
4. **Implementation quality** — conformance to enterprise/best practice/
   prod-ready, with specific remarks where applicable.
5. **Verification gaps** — what could not be checked and why.
6. **VERDICT** — one of:
   - **READY FOR PROD** — the bug is fixed, there are no regressions, the
     quality is acceptable.
   - **REWORK REQUIRED** — the bug is not fully fixed / there are
     regressions / best practices are violated (with a concrete list of
     what needs to be fixed).
   - **INSUFFICIENT DATA FOR A VERDICT** — if verification is impossible
     without additional steps (specify exactly which ones).

Every point of the verdict must rest on concrete facts (file, line, test,
command and its output), not on generic phrasing like "looks fine." This
skill is an audit: do not fix the problems you find yourself (file-editing
tools are unavailable by design), only diagnose and present the list of
what needs to be reworked.

