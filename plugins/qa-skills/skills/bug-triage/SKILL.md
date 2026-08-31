---
name: bug-triage
description: Triage of the incoming bug stream — prioritization, deduplication, separate assessment of severity (technical impact) and priority (business urgency), classification and a recommended resolution for each defect. Use when asked to sort through/sort/prioritize bugs, triage the defect backlog, decide which bugs to take first, find duplicate bugs, determine severity vs priority of a specific bug, or clear the incoming defect queue before sprint planning. Works with any tracker (Jira/YouTrack/GitHub Issues/Linear) via an available MCP tool or a pasted list. This is NOT the same as `bug-report-verify` (which adversarially checks one report for reality) and not `bug-report-write` (which drafts one new report) — here it is about sorting and prioritizing the STREAM of already-filed bugs.
argument-hint: "[list of issues from the tracker / link to a board or filter / pasted list of bugs; all optional]"
disallowed-tools: Edit
---

# Bug stream triage

You are a QA engineer/test lead sorting through the incoming defect stream. Your task is
to turn a raw pile of bugs into a prioritized, deduplicated queue
with an explicit decision on each: what to take on now, what can wait, what to close
as a duplicate/won't fix, what is missing data. Work from facts (report
text, code, git history, reproduction), not intuition: a priority without
justification is noise.

Evidence discipline: every assigned severity/priority and every "duplicate"
tag must rest on specifics (symptom, component, stack trace,
file, impact), not on "by eye". If a bug raises doubts about its reality —
delegate its verification to the `bug-report-verify` skill, do not confirm it blindly.

## INPUT / SCOPE (how to determine the perimeter)

`$ARGUMENTS` (or the conversation context) comes in one of the forms — determine which
one you are facing, and build the list of bugs to sort through:

- **A. LINK TO A TRACKER / FILTER / BOARD** (link to a board, a saved
  filter, a sprint, a `type:bug status:open` label, or just "triage the open
  bugs of the project"): get the list of issues via the available tracker
  integration mechanism — an MCP tool, if connected (for example YouTrack MCP —
  `youtrack_query_issues`; Jira/GitHub/Linear MCP similarly), otherwise ask the
  user to export the list (CSV/export) or paste it. Do not invent the
  composition of the queue.
- **B. PASTED LIST** (several bugs as text/table directly in the
  message): use as is; if some bugs lack key fields —
  note this (see the completeness check below), do not fill in the gaps.
- **C. ONE BUG, THE QUESTION "severity or priority"**: analyze one ticket by the axes
  below; deduplication in this mode = searching for similar ones in the tracker, if access exists.

Record the resulting SCOPE at the start of the report: how many bugs at the input, the source,
the period/filter, which fields are available for each. If the composition of the queue
cannot be determined (no tracker access and no list given) — stop and clarify, do not
start triaging emptiness.

The perimeter is wider than the literal list: if a bug references a component that
clearly has "siblings" (the same class of operations in another module), flag this as
a candidate for a related defect/regression.

## KEY PRINCIPLE: SEVERITY ≠ PRIORITY

The main triage mistake is to conflate these two axes. They are independent and BOTH
are assigned, separately:

- **Severity (technical impact)** — how badly the system breaks if the
  bug manifests. A property of the defect itself, independent of the business.
- **Priority (business urgency)** — how urgently this needs to be fixed. Depends
  on who and how many are affected, whether there is a workaround, how close the
  release is, who is complaining.

They diverge in both directions, and it is exactly these divergences that are the most
valuable part of triage:

- High severity, low priority: a crash in a rarely used admin utility
  used by a single internal operator once a quarter.
- Low severity, high priority: a typo in the company name on the main
  screen or on a customer invoice — "cosmetic", but must be fixed today.

Never derive priority automatically from severity or vice versa. Justify
each axis separately.

## SCALES

### Severity
- **Blocker (S1)** — the system/a key flow is inoperable, there is no
  workaround; blocks testing or the release (service crash, data loss,
  inability to log in).
- **Critical (S2)** — a major function is broken, the workaround is
  expensive/non-obvious (an order does not save, payment does not go through for some
  users).
- **Major (S3)** — a function works incorrectly, but there is a workaround; a noticeable
  defect.
- **Minor (S4)** — a minor deviation, does not interfere with the main scenario
  (small UI glitch, wrong format in a non-key place).
- **Trivial (S5)** — cosmetic (alignment, typo, color).

### Priority
- **P0** — fix immediately, drop everything (prod is down, data leak,
  release blocker, money/security).
- **P1** — in the current sprint/before the release.
- **P2** — in the next sprint.
- **P3** — backlog, when hands are free.
- **P4** — "would be nice"; a won't fix candidate.

### Ordering matrix (severity × priority)
Use as a guide to ordering, not as a hard law (the release/customer context
may shift it):

```
              P0        P1        P2        P3/P4
Blocker/Crit  1 (now)   2         3         reconsider priority
Major         2         3         4         5
Minor/Triv    3         5         6         backlog / won't fix
```

Anomalies (Blocker at P3, or Trivial at P0) are not an error in themselves, but
EXPLAIN them in the report: usually it is a signal that one of the axes was assigned
incorrectly, or that there is a non-obvious business context.

## METHODOLOGY (order of processing the queue)

For EACH bug go through the steps; for the stream — first a quick pass for duplicates and
completeness across the whole queue, then a deep assessment of each.

1. **Normalization and completeness check.** For each report check for the
   minimally necessary: reproduction steps, environment (version/browser/
   OS/stand), expected vs actual result, artifacts (log/screenshot/stack).
   If key items are missing — status **need info**, list WHAT exactly
   to request. An incomplete report cannot be correctly assessed by severity — do not
   guess, flag it.
2. **Deduplication.** Group similar ones by: symptom (one error
   message/one stack trace), component/area, steps. Duplicate candidates:
   identical exception+file, one screen+one action, a regression from one
   commit. For each group pick a "master" (the most complete/earliest report),
   mark the rest **duplicate → #master** with a link. Do not merge
   aggressively: different symptoms of one subsystem ≠ duplicates (see edge cases).
3. **Quick validity/reproducibility check.** Roughly assess whether the
   bug is real: is there a stack/log, does it match the code. If the report raises doubts
   (looks like a misunderstanding, stale behavior, an agent's hallucination) —
   flag it for verification and, if scope allows, delegate to `bug-report-verify`
   (or run its logic via a subagent). A bug not reproducible from the description
   with the needed data → **need info**, without data and confirmation → a
   won't fix / can't reproduce candidate.
4. **Classification.** Assign for each:
   - **Component/area** (which module/service/screen).
   - **Type**: functional / regression / performance / security /
     UX / data / configuration.
   - **Environment** where it reproduces (dev/staging/prod, a specific
     customer/tenant if applicable).
   - **is-regression**: did it work before? If yes — apply bisect
     thinking: `git log --oneline -- <file>` / `git bisect`, to localize the introducing
     commit; this sharply raises priority (something that worked was broken) and
     speeds up the fix. Classify a security bug separately and, as a rule, with
     elevated priority.
5. **Impact assessment.** Answer for each: how many users/
   customers are affected (all / one tenant / one user / internal operator); is
   there a workaround and how expensive it is; does it block the release/testing;
   are money, data, security, reputation affected. This is the main input for
   **priority**.
6. **Assign severity and priority separately** by the scales above, each — with
   one line of justification.
7. **Resolution recommendation** for each bug — exactly one:
   - **fix now (P0/P1)** — into work immediately/in the current cycle;
   - **next sprint (P2)** — schedule;
   - **backlog (P3)** — defer;
   - **won't fix (P4)** — do not fix (with a reason: by design / stale /
     cost > benefit);
   - **need info** — return to the reporter with a specific list of questions;
   - **duplicate** — close with a link to the master.
8. **Assignment (if applicable).** Suggest an owner by component (from
   CODEOWNERS/git blame history on the affected files/team structure, if it is
   known). If there is no data about the team — suggest by area, do not invent
   specific names.

## DEDUPLICATION CHECKLIST (when two bugs are one)

Consider them duplicates if they match on at least two strong signals:
- the same exception/error message AND the same file/line in the
  stack;
- one screen/endpoint AND one action giving the same symptom;
- both are a consequence of one introducing commit (by bisect/time of appearance);
- one symptom, different steps leading to it (two paths — one bug): a duplicate,
  but keep both sets of steps in the master.

NOT duplicates (a common over-merge mistake):
- the same symptom ("does not save"), but different components/causes;
- one component, but different symptoms (crash vs wrong calculation) — these are two bugs;
- "looks similar by title", but different environments/data.

## EDGE CASES OFTEN MISSED IN TRIAGE

- Severity set by the reporter's emotion rather than by fact: "Urgent!!!" in
  the description ≠ Blocker. Assess by the system, not by the tone.
- Priority inherited from severity automatically (a typical tracker default) —
  reconsider business urgency by hand.
- A security bug disguised as a "minor UI" issue (for example, someone else's data visible
  in a tooltip) — severity/priority by the "security" class, not by the external
  appearance.
- A regression labeled as a "new bug" — the fact that this is a rollback of working
  behavior is lost (usually P0/P1 and a quick revert).
- A cross-tenant/cross-company leak (if the project is multi-tenant) — always
  higher on both axes than the same bug within a single tenant.
- "Cannot reproduce" is closed too early: it was missing environment/data, not a
  bug. Before won't fix — exhaust need info.
- A duplicate is closed, and the master is the less complete of the two: the master is always
  the most informative report, not automatically the earliest by date.
- A flaky test filed as a product bug (or vice versa) — type "infrastructure/
  test", a separate queue.
- A bug reproduces only on prod/for one customer — do not lower priority
  because "it does not repeat on dev"; this is a sign of data/configuration.
- Cosmetics on a screen seen by a paying customer/appearing on an invoice/contract —
  low severity, but high priority.
- One ticket describes several independent problems — split it, triage
  each separately; otherwise severity is blurred.
- A stale bug: the behavior has already changed in the current branch — check before
  assigning, otherwise won't fix/already fixed.

## REPORT / OUTPUT FORMAT

Save the report to `docs/qa/triage/<date-or-scope>.md` (slug — by the run date
`YYYY-MM-DD` or by the filter/sprint name). Before creating it, check the
existing repository structure and follow it; `docs/qa/triage/` is the default.
If a report for this same perimeter already exists — update the statuses, do not recreate it.

Report structure:

1. **Executive summary** — how many bugs at the input, how many unique after
   deduplication, how many P0/P1 require immediate attention, the main risks
   in one phrase. No jargon.
2. **SCOPE** — source, period/filter, number of bugs, available fields, what
   was left out of scope (e.g. "comments in the tracker were not read").
3. **Top of the queue** — what to take first (an ordered list by the matrix), one
   line why.
4. **Triage table** — for each bug: `ID | title | component | type |
   severity | priority | is-regression | impact (brief) | duplicate-of |
   recommendation | proposed owner`.
5. **Duplicate groups** — the master and its duplicates with links.
6. **Need info** — a list of bugs and SPECIFIC questions to the reporter for each.
7. **Axis anomalies** — where severity and priority diverge strongly, with
   an explanation (is it an assessment error).
8. **What was not checked** — limitations (did not reproduce live, no access to
   prod/tracker, some reports are incomplete), so the queue does not look "clean"
   where data was missing.

## FORMATTING RULES

- Keep the original ticket IDs from the tracker — do not renumber someone else's bugs.
- Every assigned axis — with a one-line justification; "Blocker, because
  it crashes on service start", not just "Blocker".
- A duplicate always with a link to the master; won't fix always with a reason.
- If a decision on a bug changes the state in the tracker (close a duplicate,
  return to need info, reassign) — this is a side effect: do NOT perform it yourself,
  but put it in the report as a recommended action; leave status/assignment changes
  in the tracker to the user/explicit confirmation.

This is analytical triage, not implementation: do not touch the code, do not
reopen or close bugs in the tracker yourself — produce a prioritized queue and decisions,
tracker actions are confirmed by the user.

