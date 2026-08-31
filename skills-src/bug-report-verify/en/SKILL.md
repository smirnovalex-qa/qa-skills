---
description: Adversarially checks the validity of a bug report — not the formatting, but the problem itself against primary sources (code, spec, git history), trying to disprove the report before confirming it. Use when asked to check/validate/confirm a bug report, to doubt a bug report, or before starting work on a filed bug to make sure it is real and not an agent's hallucination.
argument-hint: "[path to the bug report file | pasted report text]"
---
# Bug report validity verification

Your task is NOT to check formatting, but to adversarially verify the
problem itself. Assume that the report may be an agent's hallucination
or a false conclusion drawn from incomplete context. Your goal is to try
to DISPROVE the report, and only if you cannot disprove it — confirm it.

## Input

`$ARGUMENTS` — path to the bug report file or the report text itself.

- If the argument looks like a path (`docs/bugs/**`, `*.md`, `*.txt`) — read the file.
- If it is the report text pasted directly into the message — use it as is.
- If the argument is empty — take the bug report from the user's last message
  in the conversation; if it is not there either, ask which report to check (do not invent one).

## How to proceed

1. **Extract the claims.** Break the report down into atomic factual claims:
   - what exactly reproduces (steps, input data, environment);
   - what behavior is observed (actual);
   - what behavior is expected (expected) and WHAT that expectation is based on
     (spec, documentation, code, the report author's common sense?);
   - what cause/localization is asserted (if any).

2. **Check each claim independently, against primary sources:**
   - find the actual implementation of the described behavior in the code — read the
     code, not the retelling in the report; the mentioned files/functions/endpoints/configs
     must exist and do what is claimed;
   - verify that the "expected behavior" is actually expected: is there a
     requirement/spec/contract, or did the report author make it up;
   - check whether the behavior is intentional (a feature, a known
     limitation, a deliberate trade-off — look for comments, ADRs, git log/blame,
     existing tickets and docs);
   - check whether the report is stale: maybe the problem has already been fixed in
     the current branch.

3. **Reproduce the problem.** If possible in the current environment — execute
   the reproduction steps (run the code, test, request, script) and record the
   actual result. If it cannot be reproduced directly — write a
   minimal test/script that isolates the claimed behavior, and run it.
   If reproduction is impossible in principle (requires prod, an external service,
   specific data) — say so explicitly and assess the problem from the code only,
   marking the conclusion as indirect.

4. **Check the conclusions, not just the facts.** Even if the observed behavior
   is real, the asserted cause may be wrong. Separately assess:
   observation (symptom) vs interpretation (diagnosis) — they are confirmed
   independently.

## Verdict

Give one of the verdicts with justification:

- **CONFIRMED** — the problem was reproduced / unambiguously proven by the code.
  Attach evidence: reproduction output, code references (file:line).
- **PARTIALLY CONFIRMED** — the symptom is real, but the cause/scope/expected
  behavior in the report are described incorrectly. State exactly what to correct.
- **NOT CONFIRMED** — the problem does not reproduce or the report is based on
  a false premise. Explain where the false conclusion came from (what context
  the report author overlooked).
- **INSUFFICIENT DATA** — list the specific questions/data without which
  verification is impossible (environment, version, input data, access).

## Requirements for the response

- Every conclusion — only with a reference to evidence: code (file:line),
  command output, test result. Claims without evidence are forbidden.
- If your confidence is not 100% — explicitly state the degree of confidence and what
  remains unverified.
- Do NOT fix the bug and do not change the code (except temporary tests/scripts for
  reproduction — delete them after checking). File editing tools are
  intentionally unavailable to this skill — this is a read-only audit.
- If the report is partially incorrect — formulate the clarifications/edits to the report
  that would make it correct.
