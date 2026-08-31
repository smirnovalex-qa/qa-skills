---
name: feature-review
description: Full review of a new feature or branch before merge/release — verification against requirements (YouTrack/a requirements file, if any; otherwise the agent reconstructs the scope of changes from the git diff itself), code review, hunting for inconsistencies in use cases, checking adjacent modules for regression, and live UI testing in the browser, with a final prod-ready verdict. Use whenever asked to check a feature/branch/PR for readiness to merge or release, review/test new functionality, walk through use cases live, check adjacent screens for regression, or do QA/acceptance before prod — even if there is no explicit reference to requirements/an issue in the request.
argument-hint: "[link to a YouTrack issue] [path to requirements.md] [branch/range] — all fields optional, the agent finds what is missing itself"
disallowed-tools: Edit, Write
---

# Review and testing of a new feature (code review + logic + use cases + regression)

## INPUTS

Parse `$ARGUMENTS` and the dialog context to extract what is given;
everything not given explicitly, determine yourself from the code and
requirements — do not wait for the user to list it out for you:

- **Requirements (YouTrack issue)** — a link of the form
  `https://youtrack.example.com/issue/...`, if present in the arguments or
  in the dialog.
- **Requirements (file in the repository)** — a path of the form
  `docs/qa/requirements/**/requirements.md`, if present.
- **Branch / commit range to review** — if not specified, take the current
  branch relative to `main`/`dev`.
- **Affected functionality / module(s)** — an optional hint; do not limit
  yourself to it, find all actually affected modules yourself (step 2).
- **Adjacent integrations that must not break** — an optional hint;
  supplement it with your own dependency analysis.
- **URL/command to run the UI locally** — if not specified, determine it
  yourself from the README/package.json/docker-compose of the relevant
  service.

If none of the inputs are given at all (no issue link, no requirements
file, no branch) — before starting a full review, briefly ask the user for
at least one source of requirements; without a source of requirements,
step 3 (matching "requirement → implementation") is impossible.

## TASK

There were changes in the repository — the developer attempted to
implement one or more new features. The list of affected
functionality/modules/services/adjacent integrations in the inputs may be
incomplete or absent entirely — do not rely on it alone; independently
find ALL actually affected modules, services, and functions based on the
actual changes in the code (see step 2) and supplement/correct what is
specified in the hint.

1. **Study the requirements**: open and read the issue at the link and (if
   specified) the requirements.md file. Record the list of functional and
   non-functional requirements, acceptance criteria, and explicit
   constraints/edge cases mentioned in the task.

2. **Independently find all affected modules/services/functions** — do not
   wait for the user to list them:
   - Look at the git log/diff for the specified branch relative to the base
     branch (main/dev) and compile a complete list of changed files.
   - For each changed file, determine which service/module/package it
     belongs to (in a monorepo — the specific service in services/*, the
     specific frontend/package, etc.).
   - Go "one level deeper": which functions/classes/endpoints/event
     handlers are actually changed or added (not just file names) — build a
     list of specific entry points (API endpoints, webhook handlers, queue
     consumers, cron jobs, UI components/pages).
   - Find the calling and consuming code: who calls the changed
     functions/endpoints and who depends on the changed data contracts
     (grep for usage, search for imports/references) — these are the
     candidates for regression, even if they were not explicitly mentioned
     in the requirements.
   - Record the resulting list of affected modules/services/functions — it
     is used in all subsequent steps instead of/in addition to the hint
     from "INPUTS".

3. **Match requirements against the implementation**:
   - Is each requirement from the issue/requirements.md implemented fully,
     partially, or not at all? State specifically which points are missing.
   - Are there discrepancies between the documentation/requirements and the
     actual behavior of the code?
   - Are there hidden developer assumptions that were not explicitly stated
     in the requirements?

4. **Perform a code review of the changes** (over the full list of
   modules/files from step 2, not just those mentioned in the hint):
   - Correctness of the logic (boundary conditions, error handling, race
     conditions, idempotency, retries, transactionality where applicable).
   - Input validation and protection against incorrect/malicious data
     (including typical OWASP vulnerabilities: injections, XSS, insecure
     deserialization, etc., where applicable).
   - Logging and observability: are the logs sufficient for diagnosis in
     production, is there any leakage of sensitive data into the logs.
   - Configuration/secrets: are values that should be configurable (URLs,
     tokens, keys, feature flags) hardcoded.
   - Compatibility with the style and architecture of the existing code in
     the module/service.
   - Presence and adequacy of tests (unit/integration) for the new logic;
     what is missing.
   - DB migrations (if any) — reversibility, safety for production, absence
     of locks on large tables.

5. **Check the use cases for illogical points and inconsistencies**:
   - Walk through all usage scenarios (happy path + alternative branches)
     and check for contradictions between steps.
   - Check boundary/edge cases: empty values, duplicates, concurrent
     requests, repeated processing of the same event, no network/external
     service unavailable, incorrect data formats, stale/expired data.
   - Check multi-account/multi-tenancy (if applicable to the module) — is
     there any data leakage between accounts/users/projects.
   - Check the idempotency of webhook/event handlers (if applicable) — is a
     duplicate entity created when the event is received again.

6. **Check for regression** (over the full list of
   modules/services/integrations from step 2, including those not
   explicitly mentioned in the inputs but which depend on the changed
   code):
   - Whether existing functionality of the affected modules and adjacent
     integrations is broken.
   - Check backward compatibility of APIs/data contracts, if they changed.
   - If there are automated tests — run them and record the result; if
     there are no tests — flag this explicitly as a risk.

7. **Check the UI**, if the changes affect the frontend/interface (pages,
   components, forms, widgets, bots with a UI-like scenario — for example,
   Telegram bot dialogs):
   - Bring up the application locally (use the URL/command from the inputs;
     if not specified — determine the launch command yourself from the
     README/package.json/docker-compose of the relevant service) and open
     the affected screens in the browser (or walk through the bot scenario
     live).
   - Do not limit yourself to a static reading of the component code —
     actually go through the feature by hand: fill in forms, click buttons,
     send messages to the bot, etc.
   - Check the golden path (the main scenario from the requirements) and at
     least 2-3 boundary scenarios (empty/invalid data, repeated input,
     canceling an action, loss of connection).
   - Check that no visual/behavioral regressions appeared in adjacent
     screens/flow steps that were not changed directly but could have been
     affected (shared components, layout, form state, routing).
   - Check loading/error/empty states, if applicable.
   - If the UI could not be brought up (no environment, no access, a
     headless environment) — explicitly note this in the report as a
     verification limitation; do not pass off a static reading of the code
     as a confirmed UI check.

8. **Assess production readiness** (enterprise / best practice / prod-ready):
   - Error handling and graceful degradation on failure of external
     services.
   - Performance: any N+1 queries, unnecessary synchronous calls on the hot
     path.
   - Security: authentication/authorization on new endpoints, access
     restriction.
   - Monitoring/alerting: is it possible to track a failure of this feature
     in production.
   - Documentation: is the documentation/README/requirements updated to
     match the actual implementation.

## RESULT (response format)

1. Brief summary: is the feature ready for release (yes / yes with remarks
   / no).
2. List of actually affected modules/services/functions/entry points,
   found independently in step 2 (including those not specified in the
   hint).
3. A "requirement → implementation status → comment" traceability table.
4. List of problems found, broken down by category: Critical / Important /
   Minor — for each problem: file:line, description, a concrete
   reproduction scenario, a recommendation for fixing it.
5. List of use-case inconsistencies found (if any).
6. UI verification result: what exactly was verified live (steps,
   screenshots/description), which visual/behavioral problems were found,
   whether there was a verification limitation (if the UI was not brought
   up — state this explicitly).
7. Regression verification result (what was checked, what is broken, what
   is not covered by tests).
8. Final "prod-ready" checklist with done/not done marks.

This is a review, not an implementation: file-editing tools are
unavailable by design — only diagnosis and recommendations; the developer
makes the changes.

