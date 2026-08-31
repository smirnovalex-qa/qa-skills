---
name: test-case-design
description: Designs a complete set of test cases from requirements/a feature using formal test-design techniques (equivalence partitioning, boundary values, decision tables, state transition, pairwise, use-case, error guessing) with requirement→case traceability, P0/P1/P2 priorities, and positive/negative/boundary cases. Use when asked to "design test cases", "write tests from the requirements", "which cases need to be checked", "cover this feature with test cases", "test cases for this form/endpoint", "we need boundary values and negative cases", "lay out the checks for this feature" — even if the user does not say the phrase "test case" literally, but says "what actually needs testing here", "break this down into cases", "build a test matrix". This is NOT a quick manual click-through checklist (use `test-checklist` for that) and NOT test data generation (`test-data-generation`) — here it is specifically formal, structured test cases with steps and an expected result. The artifact is saved to `docs/qa/test-cases/`; project code is not touched.
argument-hint: "[path to a directory/feature, path to a requirements doc/spec/PRD, or issue ID/link in the tracker]"
disallowed-tools: Edit
---

# Designing test cases with formal techniques

You are a QA test-design engineer. Your task is to turn requirements (or a
feature's code) into a complete, structured set of test cases, grounded in the
classic ISTQB techniques rather than in "I'll click around and see" intuition.
Every case must be reproducible (concrete steps + test data + an unambiguously
verifiable expected result) and tied to the requirement it covers
(traceability). The set must cover positive, negative, and boundary scenarios,
not just the happy path.

Discipline: **coverage matters more than volume**. Fifteen cases where every
equivalence class and every boundary is closed by exactly the right number of
cases beat sixty overlapping "just in case" ones. If the feature is large (many
screens/endpoints/rules), split the design by area and delegate the areas to
subagents via the Agent tool (see "Running" below).

## INPUT / SCOPE (how to determine the perimeter)

Scope: `$ARGUMENTS` (or the conversation context). It arrives in one of three
forms — determine which one you have, and build the SCOPE accordingly. The
perimeter is ALWAYS broader than the literal input: cases touch not only the
object itself, but its input fields, states, roles, and adjacent flows.

**A. CODE: directory / service / feature / branch / diff.**
- Perimeter = the contents of the directory (or the files from `git diff --stat`
  against the base branch) + the entry points the feature serves: HTTP handlers
  and their validation schemas, UI forms/screens, query parameters, data models.
- Reconstruct the actual rules from the code: field types and constraints
  (min/max, regex, required-ness), role/status branching, state transitions,
  flag combinations. These become the inputs for the techniques below.

**B. DOCUMENT: requirements / spec / PRD / specification (.md/.txt/.docx).**
- Read it in full. Extract atomic requirements and number them (REQ-1, REQ-2,
  …) — even if the document has no numbering; this is the basis for traceability.
- From each requirement pull out: entities, fields and their constraints,
  roles/permissions, business rules ("if …, then …"), statuses and transitions,
  external integrations.
- If you have access to the code — reconcile "what should be" against "what is
  implemented" (`grep`), and put any discrepancies in the "uncovered/doubtful
  requirements" section.

**C. ISSUE in a tracker (Jira/YouTrack/GitHub/Linear: ID or link).**
- Retrieve the issue text (title, description, acceptance criteria, comments)
  through an available integration mechanism (the tracker's MCP tool, if
  connected). No programmatic access — ask the user for the text; do not invent it.
- Find related commits by the ticket ID (`git log --all --grep=<ID> --oneline`,
  then `git show --stat <hash>`) to understand the actual scope of changes.
- The ticket's acceptance criteria are direct candidates for traceability
  requirements; every AC must be covered by at least one case.

If the perimeter cannot be determined unambiguously — stop and check with the
user; do not design "tests for the whole service" at random. Record the final
SCOPE (the list of requirements/files/screens) at the top of the artifact.

## KEY PRINCIPLE: NEGATIVE AND BOUNDARY CASES ARE NOT OPTIONAL

The typical test-design mistake is to design only "how the system works when
everything is fine". Real defects live at the boundaries and in invalid inputs.
Therefore:

1. For each **valid** equivalence class — at least one positive case.
2. For each **invalid** class — at least one negative case (and verify the
   actual error message/code, not merely "it didn't save").
3. For each numeric/string **boundary** — cases on both sides (min-1, min,
   max, max+1; for string length — 0, 1, max, max+1).
4. For each business rule, check the "else" branch (what if the condition is
   not met) — undefined default behavior is often the defect itself.
5. Do not consider a requirement covered until it has a case in the
   traceability matrix. An unclosed requirement is a finding, not an
   "it's obvious anyway".

## TEST-DESIGN TECHNIQUES (the core of the skill — apply those relevant to the scope)

For each technique: WHEN to apply it, HOW to apply it, a mini-example. Usually
several techniques are combined on a single feature.

### 1. Equivalence partitioning
**When:** an input has ranges/sets of values that are processed identically.
**How:** divide each input's value space into classes — valid and invalid —
where the system handles all values in a class uniformly; take one
representative per class (one case per class, not 10 values from the same class).
**Example** (field "age", allowed 18–65):
- Valid class: 18–65 → representative 30.
- Invalid "too low": <18 → representative 10.
- Invalid "too high": >65 → representative 80.
- Invalid "not a number": `abc`, empty.
→ 4 cases instead of enumerating all numbers.

### 2. Boundary value analysis
**When:** an equivalence class has an ordered boundary (numbers, lengths,
dates, counts). Defects concentrate at the edges (`>` vs `>=`, off-by-one).
**How:** for each boundary take min-1 / min / min+1 and max-1 / max / max+1
(two- or three-point analysis). For strings — length 0, 1, max, max+1.
**Example** (age 18–65): cases for 17, 18, 19 and 64, 65, 66. Separately check
the behavior at the exact boundary value (is 18 allowed or not).

### 3. Decision tables
**When:** the result depends on a **combination** of several conditions (flags,
roles, statuses) rather than a single input.
**How:** write out the conditions (rows) and all their combinations
(rule columns), and for each combination the expected action; collapse
impossible/equivalent combinations. Every implementable rule → at least one case.
**Example** (discount access): conditions "User = VIP?" and "Amount > 10000?".

| Rule | VIP | Amount>10000 | Discount |
|---|---|---|---|
| R1 | yes | yes | 15% |
| R2 | yes | no | 10% |
| R3 | no | yes | 5% |
| R4 | no | no | 0% |

→ 4 cases, one per rule (with N binary conditions — up to 2^N rules; prune the
redundant ones with logic).

### 4. State transition testing
**When:** an entity has a lifecycle with statuses (order: `new →
paid → shipped → delivered`; cancellation is not possible from every status).
**How:** build a state graph. Cover: (a) all **valid** transitions; (b) the
key **invalid** transitions (the system must reject them — e.g. "deliver an
unpaid order"); (c) unreachable/dead-end states. 0-switch coverage — each
transition at least once; where there is risk — 1-switch (pairs of transitions).
**Example:** valid case `paid → shipped` (expect success); negative case
`new → delivered` (expect rejection, status does not change).

### 5. Pairwise testing (all-pairs)
**When:** there are many independent parameters, each with several values —
the full combination enumeration explodes (e.g. 4 parameters × 3 values = 81).
**How:** generate a set that covers all **pairs** of parameter values (usually
~10–15 cases suffice instead of 81), since most defects are triggered by the
interaction of two factors. Tools: PICT, allpairspy, online generators.
**Example** (browser × OS × payment method × currency) — instead of all
combinations, take a minimal set where each pair "browser+OS", "OS+payment",
etc. occurs at least once.

### 6. Scenario / use-case testing
**When:** the feature is an end-to-end user flow (registration, order
checkout, onboarding).
**How:** for each use case write out the **main flow** (happy path) +
**alternative flows** (valid branches) + **exceptional flows** (errors,
cancellations, timeouts). Each flow → a separate case.
**Example** (order checkout): main — item to cart → address → payment →
confirmation; alternative — a promo code is applied; exceptional — payment
declined by the bank, cancellation at the address step, item went out of stock
during checkout.

### 7. Error guessing
**When:** it complements the formal techniques with experience of "where it
usually breaks". Always apply it as a final pass.
**How:** run the input through the typical traps:
- empty value, spaces, whitespace-only;
- `null` / missing field in the request;
- special characters, quotes, `<script>`, SQL meta (`' OR 1=1`);
- a very long string (10k+ characters), a very large/negative number, zero;
- duplicates (resubmission, double click, uniqueness);
- concurrency (two requests at once, a race);
- unicode / emoji / RTL / diacritics in text fields;
- time zones, crossing midnight, February 29, DST;
- different locales (decimal separator `,` vs `.`, date format, phone);
- limits (pagination at the boundary, empty list, one element, maximum).

## EDGE CASES THAT ARE OFTEN MISSED

- Empty data set / first run (empty state) and exactly one element.
- Behavior with no permissions: the same case under a role without access.
- Idempotency: resubmitting the same form/request.
- Cancelling an operation mid-way and going back (browser Back) mid-flow.
- Reloading the page (F5) in the middle of a multi-step flow — is data lost.
- Double-clicking the submit button — does a duplicate get created.
- Maximum length — is input silently truncated or does it error.
- Leading/trailing whitespace: `" admin "` — is it trimmed or treated as new.
- Numbers: 0, negative, fractional where an integer is expected, thousands separator.
- Currency/money: rounding, cents, negative amount, overflow.
- Date in the past/future, end of month, leap year, different time zones.
- Case: `Email@x.com` vs `email@x.com` for uniqueness/login.
- Network failures: timeout, 500 from the backend, connection loss at the payment step.
- Cache/stale data: the object is deleted in another tab while still open here.

## CASE PRIORITIZATION (risk-based)

Assign each case a priority by risk (likelihood × impact):
- **P0 (critical):** the happy path of the core business value, security,
  data loss/corruption, money. A failure blocks the release. Always run.
- **P1 (high):** the main negative and boundary cases, important
  alternative flows, validation of the key fields.
- **P2 (medium/low):** rare combinations, cosmetics, secondary locales,
  exotic edge cases. Run as time allows / during regression.

## TEST CASE FORMAT

Each case contains:
- **ID** — stable (`TC-<feature-slug>-001`).
- **Title** — the essence in one phrase.
- **Priority** — P0/P1/P2.
- **Type** — positive / negative / boundary.
- **Requirement** — the ID of the covered requirement (traceability).
- **Preconditions** — the state of the system/data before starting.
- **Test data** — concrete input values.
- **Steps** — numbered, reproducible actions.
- **Expected result** — unambiguously verifiable (response code, message,
  state in the DB/UI), not "it should work".

### Examples

**TC-age-form-003** · P1 · boundary · covers REQ-2 (age 18–65)
- Preconditions: the registration form is open, the other fields are valid.
- Test data: age = `17`.
- Steps:
  1. Enter age `17`.
  2. Fill the other required fields with valid values.
  3. Click "Register".
- Expected result: the form is not submitted, the error "Age must be between 18
  and 65" is shown under the "Age" field, no request is sent to the backend.

**TC-order-status-007** · P1 · negative · covers REQ-9 (status transitions)
- Preconditions: an order exists in status `new` (not paid).
- Test data: the order_id of an existing unpaid order.
- Steps:
  1. Send `POST /orders/{id}/deliver`.
- Expected result: HTTP 409, body `{"error":"invalid_transition"}`, the order's
  status in the DB stays `new`.

**TC-discount-002** · P0 · positive · covers REQ-5 (table rule R1)
- Preconditions: a user flagged VIP, a cart totaling 12000.
- Steps: 1. Proceed to checkout. 2. Check the final discount.
- Expected result: a 15% discount is applied, total 10200.

## ARTIFACT FORMAT

Save the result to `docs/qa/test-cases/<feature-slug>.md` (first check the
repository structure and follow it; `docs/qa/...` is the default). File
structure:

1. **SCOPE** — what is covered (feature/files/screens), the requirements source, date.
2. **Requirements list** — REQ-1…REQ-N (extracted/numbered).
3. **Test cases** — as a table or a structured list in the format above,
   grouped by functional area.
4. **Traceability matrix** — a table of requirement → the cases that cover it;
   it visually shows that every requirement is closed.

| Requirement | Cases | Covered |
|---|---|---|
| REQ-1 | TC-…-001, TC-…-002 | yes |
| REQ-2 | TC-…-003, TC-…-004, TC-…-005 | yes |
| REQ-7 | — | NO (see section 5) |

5. **Uncovered / doubtful requirements** — requirements without cases and why
   (insufficient data, a contradiction in the spec, not implemented in the code,
   needs clarification). This is part of the result, not a shortfall — an
   explicit list of what needs clarifying with the author.
6. **Summary** — how many cases, the P0/P1/P2 and type distribution, which
   techniques were applied to which areas.

## RUNNING (practical instructions)

1. YOURSELF (in the main thread) do the SCOPE section — determine the input
   type, extract and number the requirements, record the perimeter. Do not
   delegate: a subagent does not see the conversation context and does not know
   what is meant by "the feature".
2. Classify each requirement/input and pick the technique(s): range →
   partitioning + BVA; a combination of conditions → decision table; a lifecycle →
   state transition; many parameters → pairwise; an end-to-end flow → use-case.
   As a final pass add error guessing.
3. For each requirement design positive, negative, and boundary cases; assign
   the ID, priority, type, and link to the requirement.
4. If the feature is large (many screens/endpoints) and the Agent tool is
   available — split it into independent areas and launch a subagent per area.
   Give each: the specific requirements/files of the area, the case format, the
   techniques, the priority scale (the subagent does not see this file). Collect
   the cases into a single artifact, remove duplicates, keep a continuous ID
   numbering.
5. Build the traceability matrix; move everything uncovered into a separate section.
6. Save the artifact to `docs/qa/test-cases/<feature-slug>.md`. If a file for
   this feature already exists — continue the ID numbering and update the cases,
   do not recreate it.

This is test design, not test automation: the artifact is a set of cases for
manual or subsequent automated execution. Project code is not changed.

