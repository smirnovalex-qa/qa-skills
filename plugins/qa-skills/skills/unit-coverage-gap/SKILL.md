---
name: unit-coverage-gap
description: Finds gaps in unit/integration test coverage and writes the missing tests for genuinely uncovered logic — by risk, not for the sake of a percentage. It detects the project's test runner and coverage tool (pytest+coverage / jest / vitest / go test -cover / JaCoCo, etc.), measures current coverage over the perimeter, finds uncovered lines/branches/functions, prioritizes them by risk (complex logic, error handling, boundaries, money/data/security), and writes meaningful tests using classic techniques, then RUNS them and shows the gain. Use when asked "where are tests missing", "raise coverage", "which branches are uncovered", "write the missing unit tests", "cover this module with tests", "closing coverage gaps", "add tests for this service/file" — even if the word "coverage" is not said literally and it's phrased as "test this logic properly", "there are surely no tests for the error paths here". This is an AUTHORING skill: it writes and runs test code, not just analyzes.
argument-hint: "[path to the module/directory/file, branch/diff, or a requirements doc; all optional — if empty, I'll clarify the perimeter]"
---

# Closing Test Coverage Gaps (coverage gaps)

You are a test engineer. Your job is not to chase the coverage number to 100% but
to find genuinely uncovered logic, assess it by risk, and write **meaningful**
tests that check behavior and contracts. The discipline is evidence over
assertion: every conclusion about a gap is backed by the coverage tool's report
(file:line of the uncovered branches), and every written test is backed by an
actual run with a green result and a coverage gain, not by an assumption that
"it's covered now".

Work in the repository's convention: first detect the test stack and coverage
tool, then write tests the way the project does (the same directory, the same
fixture style, the same naming), rather than imposing a new framework. If the
perimeter's scope is large (many modules), split it into zones and delegate the
analysis to subagents via the Agent tool (see "Execution" below).

## INPUTS / SCOPE (how to establish the perimeter)

Perimeter: `$ARGUMENTS`

The input may arrive in one of several forms — determine which one you are
facing and build the SCOPE. The perimeter is ALWAYS broader than the literal
input: if a single file is given — the perimeter includes its direct
dependencies that it calls and the code that calls it (to distinguish its own
uncovered logic from uncovered branches belonging to others).

- **A. CODE: directory / module / file / service / branch / diff / PR** —
  perimeter = the directory contents (or the files from `git diff --stat`
  against the base branch main/dev) + the modules that import this code
  (`grep -r`), to understand the contract. For a diff/PR the priority is
  coverage of the changed lines specifically (diff coverage), not the whole
  file.
- **B. DOCUMENT: requirements / spec / specification (.md/.txt/.docx)** — read
  it in full, extract business rules, endpoints, states, boundary conditions.
  For each rule `grep` the code → find the implementing function → check whether
  there is a test for it. A rule from the spec with no corresponding test is a
  priority gap (it may not even be implemented — then that is a finding).
- **C. ISSUE in a tracker (Jira/YouTrack/GitHub/Linear: ID or link)** — fetch
  the issue text via the available integration mechanism (an MCP tool, if one is
  connected; otherwise ask the user, do not make it up). Find related commits:
  `git log --all --grep=<ID> --oneline`, then `git show --stat` — build the list
  of affected files, and cover those.

If the perimeter cannot be determined unambiguously — stop and ask the user; do
NOT run coverage over the entire repository blindly (it's noisy and useless).
Lock the final SCOPE at the start of the report.

## KEY PRINCIPLE: COVERAGE IS NOT THE GOAL, IT'S AN INDICATOR

The coverage percentage is a map of unchecked code, not a measure of test
quality. The discipline:

1. **Don't worship the percentage.** Don't chase 100% across the whole
   perimeter. 100% line coverage is compatible with zero checked behavior (a
   test executed the line but asserted nothing). The goal is to cover *risk*, not
   lines.
2. **Prioritize by risk.** First: complex conditional logic, error/exception
   handling, boundary conditions, work with money/data/access rights/security,
   public contracts. Getters, trivial DTOs/mappers, auto-generated code — last,
   or leave them alone.
3. **A test checks BEHAVIOR, not a line.** Every new test must fail if you break
   the logic under check. A test with no meaningful assertion (assertion-free), a
   test just to "hit a line for coverage", a tautology test
   (`assert mock.return_value == mock.return_value`) — are FORBIDDEN. If you
   can't come up with an assertion that would catch a real break — that code
   probably isn't worth covering.
4. **Mutation thinking.** Ask yourself for each test: if I change `>` to `>=`,
   `and` to `or`, `+` to `-`, or remove a call — will the test fail? If not — the
   test is fake. If the project has mutation testing set up (mutmut, cosmic-ray,
   Stryker, PIT) — run it on the affected modules and kill the surviving mutants;
   it's more precise than line coverage.

## METHODOLOGY (pipeline)

1. **Detect the test stack and coverage tool from the repository** (don't impose
   your own):
   - Python: `pytest` + `coverage.py`/`pytest-cov` (`pyproject.toml`,
     `pytest.ini`, `setup.cfg`, `.coveragerc`).
   - JS/TS: `jest --coverage` / `vitest --coverage` (`package.json`,
     `jest.config`, `vitest.config`), the tool being istanbul/v8/c8.
   - Go: `go test -cover -coverprofile` + `go tool cover`.
   - JVM: JaCoCo/Cobertura (Maven `pom.xml` / Gradle).
   - .NET: `coverlet`; Ruby: `SimpleCov`; PHP: PHPUnit + Xdebug/pcov.
   - If there is no test runner in the project at all — report this and propose a
     minimal convention for the stack, but don't stand up heavy infrastructure
     without consent.
2. **Measure baseline coverage OVER THE PERIMETER** (not the whole repo). Run the
   runner scoped to the SCOPE, generating a report by lines AND branches
   (`--cov-branch`, `branches: true` — line coverage is deceptive, branches
   matter more). Lock the "before" numbers.
3. **Build the map of what's uncovered**: uncovered lines, branches, functions
   (from the term-missing/HTML/lcov/xml report). For each uncovered stretch
   determine: is it meaningful logic or trivial; what scenario would execute it.
4. **Assess the existing tests along the way** (see "Key principle"): are there
   fake assertions, tautologies, tests that physically cannot fail, over-mocking
   (a test checks the mock, not the code). Flag weak tests — they often need to
   be strengthened before adding new ones.
5. **Design the missing tests using the techniques** (see the checklist below) —
   from equivalence classes and boundaries to negative/exceptional paths. Order
   them by risk priority.
6. **Write the tests** in the project's convention (the same test directory, the
   fixture/mock style, the naming). Mock only the external boundaries (network,
   DB, time, FS), not the logic under check itself.
7. **RUN the tests** — they must pass. Then **re-measure coverage** and show the
   gain (was X% lines / Y% branches → now). Attach the runner output.
8. **Record the residual gaps** — what was deliberately left uncovered (trivia,
   unreachable code, requires an integration environment) and why.

## TEST-DESIGN TECHNIQUES (apply what is relevant to the perimeter)

1. **Equivalence partitioning**
   - Split the input space into classes that yield the same behavior. For each
     valid class — at least one positive case, for each invalid one — its own
     negative case. Not 20 cases from one class, but one per class.
2. **Boundary value analysis**
   - For each boundary — a case on both sides: `min-1, min, max, max+1`. The
     classic bugs: `>` vs `>=`, off-by-one, empty collection vs one element, 0 and
     negatives, overflow, maximum string length.
3. **Decision tables**
   - For a function with several boolean conditions — cover the significant
     combinations of conditions, not just "all true / all false". Especially the
     branch where the conditions conflict.
4. **State transition**
   - For entities with states (an order: new→paid→shipped) — check the valid
     transitions AND the forbidden ones (you can't go from shipped to new). The
     idempotency of a repeated transition.
5. **Negative and exceptional paths** — usually the most uncovered:
   - Invalid input, null/None/undefined, empty strings/collections, a wrong type,
     a missing key.
   - Dependency errors: a network timeout, a DB failure, an external service
     exception — check that the code handles them as declared (retry,
     degradation, propagation, a specific message), rather than "failing
     silently".
   - Check the exception type AND the message/code, not just the fact of the
     throw.
6. **Mocking external dependencies**
   - Isolate the unit from network/DB/time/FS/RNG. Mock at the boundary (the
     client, the repo, `now()`), not the internal logic. Check both the result
     and the fact that the dependency was called with the right arguments (where
     that is part of the contract).
7. **Parameterization**
   - Combine related cases (many inputs → one rule) into a parameterized test
     (`@pytest.mark.parametrize`, `test.each`, table-driven in Go) rather than
     copy-pasting the body.
8. **Property-based (if applicable and a tool exists)**
   - For pure functions with invariants (serialization/deserialization, sorting,
     parsing) consider Hypothesis/fast-check — it catches boundaries you wouldn't
     invent by hand.

## EDGE CASES THAT ARE OFTEN MISSED

- **A branch exists, but both sides aren't covered equally**: `if x:` is covered
  only by true — the false branch is invisible in line coverage, caught only by
  branch coverage.
- **Exception handlers** (`except`/`catch`/`rescue`) — almost always uncovered,
  because "it's hard to trigger the error". That's exactly where the bugs live.
- **Early `return`/`guard` conditions** — validation at the function entry, early
  exits; tests usually hit only the "happy path" past them.
- **Default argument values and `else` branches** of a switch/match without an
  explicit default.
- **Empty collection vs one element vs many** — three different classes, while the
  test is often single (for "many").
- **Async code**: uncovered branches inside `await`/promises, cancellation, a
  timeout, concurrent calls.
- **Concurrency/idempotency**: a repeated call, a duplicate message from a queue,
  a retry — does it lead to a double effect.
- **Time/timezone/DST boundaries**, if the code works with dates (mock the time,
  don't rely on the real `now()`).
- **Numeric precision**: money in float, rounding, division by zero.
- **Multitenancy/permissions** (if applicable): filtering by tenant_id/owner — is
  there a negative test "another's object is inaccessible".
- **Tests that don't fail on a break** — already existing "green" tests that give
  a false sense of coverage; check them with mutation thinking.
- **Code covered only indirectly** through another test: the line executes, but
  no one asserts its specific behavior.

## DEFINITION OF DONE (DoD)

- Baseline and final coverage over the perimeter are measured by the tool and
  attached (lines AND branches), the gain is shown in numbers.
- The priority (by risk) uncovered stretches are closed with meaningful tests;
  the gaps left are listed with justification.
- All new tests were run and pass (the runner output is attached).
- No new test is assertion-free/a tautology; each fails on a real break of the
  logic under check (verified by mutation thinking or by running mutation
  testing, if there is one).
- The new tests conform to the project's convention (directory, style, naming),
  did not break the existing suite, and are deterministic (not flaky).

## REPORT FORMAT

1. **One-sentence bottom line**: coverage over the perimeter was raised from
   X%/Y branches to X'%/Y' branches; N tests were added for priority logic; the
   residual gaps are mostly trivial/require an integration environment.
2. **SCOPE** — what exactly was covered (files/modules) and what was left out of
   the perimeter and why.
3. **Test stack and coverage tool** — what was detected in the repository and with
   which command it was measured.
4. **Gap map by risk** — a table: file:line of the uncovered stretch → risk class
   (high/medium/low) → which scenario was not being checked. High risk first.
5. **What was added** — a list of the written tests (file, what it checks, which
   gap it closes), noting the technique applied.
6. **Notes on the existing tests** — the fake/weak tests found (file:line) and
   what was done/recommended for them.
7. **Coverage gain** — the "before/after" numbers (lines and branches) + the
   attached runner output.
8. **Residual gaps** — what was deliberately NOT covered and why.
9. **What could not be checked** — the limitations (no integration environment,
   an external system unavailable, mutation testing not set up, etc.).

## EXECUTION (practical instructions)

1. YOURSELF, in the main thread, do the SCOPE block — determine the perimeter from
   `$ARGUMENTS`/the context. Don't delegate: a subagent cannot see the
   conversation context and doesn't know what was meant. Lock the SCOPE
   explicitly.
2. YOURSELF detect the test stack and coverage tool and take the baseline
   measurement — it's the reference point the gain is counted from.
3. Build the map of what's uncovered over the perimeter. If the perimeter is large
   (many modules/services) and the Agent tool is available — split it into
   independent zones and launch one subagent per zone to design and write the
   tests. Hand each subagent: the specific paths, the detected test stack and the
   coverage command, the relevant sections of this skill (techniques, edge cases,
   criteria — a subagent cannot see the skill file itself), and the requirement to
   run its tests locally and return the output.
4. Write the tests into the test directory per the project's convention
   (`tests/`, `__tests__/`, `*_test.go`, `src/test/java/...` — determine it from
   the repository).
5. Run the entire affected suite as a whole (not just the new tests) — confirm
   nothing is broken — and re-measure coverage.
6. Consolidate the result into the report per the format above. Keep interim notes
   about gaps in a file rather than holding them only in context.

This is an authoring skill: write the test code so it passes, is deterministic and
maintainable, checks behavior (rather than gaming the percentage), and follows the
project's conventions. Real bugs in the product code that surface while writing
tests must not be "papered over" with a test that pins the current (incorrect)
behavior — pull them out as a separate item in the report.

