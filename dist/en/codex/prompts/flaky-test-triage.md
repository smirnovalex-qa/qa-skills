---
description: Diagnoses and eliminates flaky tests — the ones that fail sometimes and pass others with no code change. Detects the project's test runner, empirically confirms the instability by running many times (repeat, order randomization, parallelism), classifies the root cause of each (race condition/async, shared state/order dependence, time/timezones, external dependencies, nondeterministic data, resources/timing, environment dependence) and fixes BY THE CAUSE rather than hiding it behind retry/skip, then reruns N times and proves stability.
argument-hint: "[test/file name, path to a failed CI log, or a test suite; all optional — if empty, I'll ask which tests are unstable]"
---
# Flaky test triage and remediation

You are a test infrastructure engineer. A flaky test is worse than a failing
one: it undermines trust in the entire suite, masks real regressions, and
trains the team to re-run CI blindly. Your job is not to "make it green at any
cost" (retry/skip hide the problem but do not solve it), but to find and
eliminate the root cause of nondeterminism, proving it with evidence: before
the fix the test flickers, after it the test is stable across N runs.

The discipline is evidence over assertion: instability is confirmed
empirically (many runs that reproduce the failure), the root cause by a
concrete mechanism in the code (file:line), and the fix by a repeat run with
zero failures. "Looks like a race" without a reproduction is not a diagnosis.

Work in the project's conventions: first detect the test runner and its
repeat/randomization facilities, and fix in the style of the existing tests.
If there are many flaky tests, split them into zones and delegate to subagents
via the Agent tool.

## INPUT / SCOPE (how to determine the perimeter)

Perimeter: `$ARGUMENTS`

The input may arrive in one of several forms:

- **A. A SPECIFIC TEST / FILE / SUITE** (test name, file path, directory,
  branch/diff) — the perimeter = the test itself plus everything it depends on
  by state: shared fixtures/setup-teardown, shared resources (module/global
  variables, singletons, DB, temp files), other tests in the same file/class
  (they may have left state behind). The flaky perimeter is ALWAYS wider than a
  single test: the cause is often in a neighbor.
- **B. A CI LOG from a failed run** (path to a log file / pasted text) —
  extract from it: the name(s) of the failed tests, the error type (assertion,
  timeout, connection refused, KeyError, etc.), the seed/run order (if the
  runner prints it), the environment (image, runtime version, parallelism).
  By the test name, locate it in the code and build the perimeter as in item A.
  Correlate: does the same error reproduce locally or only in CI (see edge
  cases about dev vs CI).
- **C. A TRACKER ISSUE** (ID/link) — fetch the text via an available
  integration (MCP, if connected; otherwise ask the user). Find the mentioned
  tests and related commits (`git log --all --grep=<ID>`).

If it is unclear which tests are unstable, stop and clarify (ask for a test
name or a CI log); do not re-run the whole suite hoping to catch something
(though a mass run with randomization IS a valid way to SURFACE flaky tests if
that is exactly what the user asks for). Record the SCOPE at the start of the
report.

## KEY PRINCIPLE: FIX THE CAUSE, DON'T HIDE THE SYMPTOM

1. **Reproduce first, fix second.** Until the failure is reproduced you have
   neither a diagnosis nor a way to verify a fix. A single green run proves
   nothing.
2. **retry and skip are not solutions.** `@pytest.mark.flaky`,
   `jest.retryTimes`, `--reruns`, `@Retry`, `test.skip` hide the problem: the
   test is still nondeterministic, real regressions are still masked. Retry is
   acceptable ONLY as an explicitly flagged temporary measure for something
   that cannot be fixed right now (see quarantine below), with a filed ticket,
   never as a fix.
3. **Do not "tune" the test to the current run.** Bumping a sleep, weakening an
   assert into meaninglessness, raising a timeout "so it passes" — this is
   masking. A sleep is replaced by an explicit wait for a condition, not made
   longer.
4. **One test — one cause (usually).** Do not lump them together: each flaky
   test may have its own root cause. Diagnose them individually.
5. **Prove stability after the fix.** Re-run the fix N times (dozens), with
   order randomization and in parallel — at least as many times as it took to
   reproduce, ideally more.

## METHODOLOGY (the pipeline)

1. **Detect the test runner and its repeat/randomization facilities:**
   - Python `pytest`: `pytest --count=N` (pytest-repeat), `-p no:randomly`/
     `pytest-randomly` (order randomization + seed pinning), `-x` (stop on
     first failure), `-n auto` (pytest-xdist, parallel), `-p flaky`/
     `pytest-rerunfailures` (for DIAGNOSIS, not for the fix).
   - JS `jest`/`vitest`: run in a loop, `--runInBand` vs parallel,
     `--shuffle` (vitest), `testSequencer` (jest); pinning the RNG seed.
   - Go: `go test -count=N -race -shuffle=on`.
   - JVM/JUnit: repeat via `@RepeatedTest`, surefire `rerunFailingTests`
     (diagnosis), `-Dsurefire.runOrder=random`.
   - Determine how the runner prints the seed/order — you need it to reproduce
     a specific failure.
2. **Reproduce the instability empirically.** Run the suspect test/suite many
   times (e.g. 20–50, more for fast tests), combining: (a) repeat within a
   single process, (b) order randomization with different seeds, (c) a parallel
   run (`-n`, `--runInBand` off). Record the failure frequency (e.g. "7/50")
   and the exact mode in which it fails — this is your baseline.
3. **Gather the failure evidence.** For each failure: the error type and text,
   stack trace, seed/order, whether the behavior differs in isolation (`test
   alone`) from "within the suite". The key differentiating question is whether
   the test fails **in isolation** — if yes, the cause is inside the test
   itself (time, RNG, race); if only **within the suite/in a certain order**,
   the cause is in shared state/order dependence.
4. **Classify the root cause** (see the catalog below). Confirm it with a
   mechanism in the code (file:line), not a guess. If needed, add temporary
   diagnostics (log the seed, log the order, log the state of the shared
   resource).
5. **Fix by the root cause** (see the catalog — each class has its own recipe).
   Change the test (or, if the bug is real, the product code — but that is now
   a finding, not flakiness), preserving WHAT it checks.
6. **Verify the fix.** Re-run N times in the same mode that reproduced the
   failure (same parallelism, order randomization, seed range). Criterion: zero
   failures over a run comparable to or larger than before. Attach the output.
7. **Record what remains.** Whatever cannot be stabilized now → into quarantine
   with a ticket (see below), not silently into a retry.

## CATALOG OF ROOT CAUSES AND FIX RECIPES

1. **Race condition / async (no wait)**
   - Symptom: fails under parallelism or "sometimes", an error like "element
     not found / value not updated yet". The test proceeds before the async
     operation has completed.
   - Fix: replace a fixed `sleep`/arbitrary timeout with an **explicit wait for
     a condition** (poll until a predicate, `waitFor`/`await expect(...)`,
     Playwright/Selenium explicit waits, `await` on a specific promise/future).
     Wait for the exact state you need, not "let's wait a second".
2. **Order dependence / shared state**
   - Symptom: fails only in a certain order / only "within the suite", passes
     in isolation. Tests share global/module variables, a singleton, a cache, a
     DB, files, environment variables, mocked modules.
   - Fix: **isolate the state** — setup/teardown or fixtures with
     cleanup/rollback (a transaction with rollback, a fresh DB/schema per test,
     `beforeEach` reset, a separate temp directory, restoring env/mocks in
     teardown). Make the tests order-independent (verify with randomization).
     Do not rely on a side effect of a neighboring test.
3. **Time / timezones / clocks**
   - Symptom: fails at midnight, at month-end, in another TZ, "N days later",
     at a DST boundary; a hardcoded expectation of `now()`; sleep timeouts
     under load.
   - Fix: **mock time** (freezegun/`time.monotonic` injection,
     `jest.useFakeTimers`, `@Clock`/`Clock` injection, `sinon.useFakeTimers`).
     Do not compare against real `now()`, pin the timezone in the test, remove
     races on sleep timeouts in favor of an explicit wait.
4. **External dependencies (network, real APIs, DB without isolation, queue)**
   - Symptom: `connection refused`, timeout, depends on the availability of an
     external service, on data in a shared DB, on message order in a queue.
   - Fix: **mock/stub the external boundary** (HTTP mocks: responses/nock/
     WireMock/MSW; test containers or in-memory for the DB; DB isolation via a
     transaction). A unit test must not hit the real network. If it is an
     integration test by design, provide a deterministic environment (a fixed
     data seed, schema isolation), not "whatever luck brings".
5. **Nondeterministic data**
   - Symptom: `random` without a seed; dependence on iteration order of a
     set/dict/hash; a UUID/timestamp in an assert; locale-dependent
     sorting/formatting; parallel ID generation.
   - Fix: **pin the RNG seed**; do not rely on the order of unordered
     collections (sort before comparing or compare as sets); do not assert
     generated UUIDs/times literally (check the format/presence); pin the
     locale.
6. **Resource limits / timing**
   - Symptom: fails under load / on a weak CI runner, a too-tight timeout, a
     port/file already in use, a leak of connections/descriptors between tests.
   - Fix: remove hard timing asserts ("completed in <100ms") from functional
     tests; release resources properly in teardown; use a random free
     port/unique resource name per test.
7. **Environment dependence (locale, TZ, screen resolution, dev vs CI)**
   - Symptom: green locally, red in CI (or vice versa). Different runtime
     versions, TZ, locale, headless vs headed, core count (parallelism),
     environment variables.
   - Fix: make the test environment-independent (set the locale/TZ explicitly,
     make parallelism deterministic, do not depend on paths/resolution);
     reproduce the CI conditions locally (same image/variables) to catch the
     difference.

## EDGE CASES THAT ARE OFTEN MISSED

- **The cause is in a neighboring test, not the failed one.** Test B fails, but
  test A corrupted the state. Hunt the culprit with order randomization and by
  running B in isolation.
- **A shared mock/patch is not rolled back** — a `patch`/`mock` from one test
  "leaks" into the next (especially when patching a global module without
  teardown).
- **Cache/memoization** (lru_cache, module-level singleton, ORM identity map) —
  carries state between tests; a reset is needed.
- **Auto-increment IDs/DB sequences** — the test asserts `id == 1`, but the run
  order changes the counter.
- **Dict/set order** — in some runtimes/versions it is not guaranteed or
  depends on insertion; an assert on order flickers.
- **Clock boundaries**: a test that is green during the day fails if the run
  crossed midnight/a day/month boundary between `now()` in setup and in the
  check.
- **Floating-point precision** — comparing floats via `==` instead of a
  tolerance.
- **An async test that "passes" without awaiting the promise** — a forgotten
  `await`/`return` of the promise makes the test green regardless of the result
  (a false green, also a kind of flakiness).
- **Parallelism in CI ≠ locally** — locally `--runInBand`/1 worker, in CI many;
  races are visible only in CI.
- **The real network "is usually available"** — the test hits the internet and
  fails when it is down; that is flaky, not "the infra blinked".
- **A timeout tuned "just barely"** — passes on a fast machine, fails on a slow
  runner.
- **A port/file/connection leak** between tests → "address already in use".
- **A false-positive fix**: 10 green runs when the original frequency is 1/50
  proves nothing — compute the required N from the original failure frequency.

## DEFINITION OF DONE (DoD)

- The instability of each test case is reproduced empirically, the failure
  frequency and mode recorded ("was X/N").
- The root cause of each is identified and confirmed by a mechanism in the code
  (file:line), not a guess.
- The fix eliminates the cause (not retry/skip/a longer sleep) and preserves
  WHAT the test checks.
- After the fix — zero failures over a run comparable to/larger than before and
  in the same mode (order/parallel/seed), output attached.
- Whatever is not fixed now is placed in quarantine with a ticket and an
  explicit flag, not hidden.

## QUARANTINE POLICY (for what cannot be fixed quickly)

If the root cause requires a major rework (an architectural race, heavy
infrastructure isolation) and cannot be fixed within the task:

- Put the test in explicit quarantine **with a flag and a link to a ticket** (a
  quarantine marker/tag, a separate run/label in CI), not into a silent
  `skip`/`retry`.
- The quarantined test must NOT break the main CI, but must stay visible (a
  separate report) so it is not forgotten.
- File a ticket: the reproduction, the hypothesis about the cause, what
  prevents fixing it.
- Quarantine is temporary by definition. Bound its lifetime/owner. Retry
  without quarantine and a ticket is forbidden.

## REPORT FORMAT

1. **One-line summary**: N unstable tests diagnosed, M stabilized (cause
   eliminated), K in quarantine with tickets.
2. **SCOPE** — which tests were examined and how the perimeter was determined.
3. **Test runner and reproduction mode** — the command(s) used to catch the
   instability (repeat/randomization/parallel), the original failure frequency.
4. **For each flaky test**: name (file:line), root cause (a class from the
   catalog) + evidence (how you reproduced it, what in the code is at fault),
   what was fixed, the verification result ("was 7/50 → became 0/100").
5. **Quarantine** — what is not fixed, why, links to the filed tickets.
6. **Side findings** — if a real product bug was hiding behind the flakiness (a
   race in the code itself, not in the test), call it out separately, do not
   "paper over" it.
7. **What could not be verified** — did not reproduce locally (only in CI), no
   access to the CI environment, not enough runs, etc.

## EXECUTION (practical instructions)

1. YOURSELF, in the main thread, perform the SCOPE block — determine which
   tests are unstable, from `$ARGUMENTS`/the CI log/context. Do not delegate: a
   subagent does not see the dialog context. Record the SCOPE.
2. YOURSELF detect the test runner and its repeat/randomization/parallel
   facilities.
3. Reproduce the instability (many runs in different modes) — this is your
   baseline; without it you can neither diagnose nor verify.
4. If there are many flaky tests and the Agent tool is available, split them
   into independent zones (by file/module) and launch a subagent per zone. Give
   each: the specific tests/paths, the detected runner and the reproduction
   commands, the relevant sections of this skill (the cause catalog, edge
   cases, DoD — the subagent does not see the file itself) and the requirement
   to attach the "before/after" run output.
5. Fix by the root cause in the project's conventions. After each fix, verify
   with a re-run.
6. Run the affected suite in full — make sure the fixes (especially state
   isolation/teardown) did not break other tests.
7. Consolidate into a report per the format above. Store failure evidence and
   interim notes in a file, not only in context.

This is an authoring skill: make test edits so as to eliminate the cause of
nondeterminism, preserve the checked behavior, and leave the test
deterministic. Retry/skip is not a fix but a last resort, explicitly flagged
and with a ticket.

