# QA Skills for Claude Code, Codex & Cursor

A curated set of production-grade **QA skills** — requirements and test design, test automation, non-functional checks, defect management, and security & performance audits. Authored as [Claude Code](https://docs.claude.com/en/docs/claude-code/overview) skills and shipped with ready-to-use adapters for [OpenAI Codex](https://developers.openai.com/codex/cli) and [Cursor](https://docs.cursor.com/), so a whole team can install the same QA discipline into whichever agentic coding tool they use — and keep it up to date via `git pull`.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Claude Code Plugin](https://img.shields.io/badge/Claude%20Code-Plugin%20Marketplace-8A2BE2.svg)](https://docs.claude.com/en/docs/claude-code/plugins)
[![Codex](https://img.shields.io/badge/OpenAI%20Codex-Custom%20Prompts-412991.svg)](https://developers.openai.com/codex/cli)
[![Cursor](https://img.shields.io/badge/Cursor-Project%20Rules-000000.svg)](https://docs.cursor.com/context/rules)
[![Skills](https://img.shields.io/badge/Skills-29-success.svg)](#skills)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen.svg)](#)

---

## Table of Contents

- [Overview](#overview)
- [Skills](#skills)
- [Installation](#installation)
  - [Claude Code](#claude-code)
  - [Cursor](#cursor)
  - [Codex](#codex)
- [Usage](#usage)
- [Repository Structure](#repository-structure)
- [Compatibility & Assumptions](#compatibility--assumptions)
- [Versioning](#versioning)
- [Contributing](#contributing)
- [Security & Privacy](#security--privacy)
- [License](#license)

## Overview

Each skill is a self-contained, model-invoked QA workflow — you describe the task in plain language and the agent runs the matching skill; you don't have to remember command names. The skills encode a consistent QA discipline:

- **Evidence over assertion** — findings are tied to `file:line`, reproduction steps, or measurements (`EXPLAIN ANALYZE`, `py-spy`, bundle size, `k6`), not opinions.
- **Adversarial verification** — reports and fixes are challenged before they are trusted, to filter out plausible-but-wrong conclusions.
- **Explicit verdicts** — every audit ends with a clear production-readiness call, not a wall of caveats.

### One source, all tools and languages

Every skill is authored once in the canonical source tree
[`skills-src/`](skills-src) — `<name>/{meta.yml, en/SKILL.md, ru/SKILL.md}`. From
that single source, [`scripts/generate-adapters.mjs`](scripts/generate-adapters.mjs)
builds **both language editions** for **every tool**: the two Claude Code plugins
under [`plugins/`](plugins) and the Cursor/Codex adapters under [`dist/`](dist).
Trigger text and workflow stay identical across languages and tools, and you never
maintain copies by hand — you edit `skills-src/` and regenerate.

| Tool | Format | How the workflow is reached |
| --- | --- | --- |
| **Claude Code** | Plugin skills — [`plugins/qa-skills`](plugins/qa-skills) (English) / [`plugins/qa-skills-ru`](plugins/qa-skills-ru) (Russian) | Auto-invoked: the agent loads a skill on its own when your request matches its `description`. Pick the language by which plugin you install. |
| **Cursor** | Project rules — `dist/<locale>/cursor/rules/*.mdc` | Auto-attached (*Agent Requested*): Cursor's agent pulls a rule in when the task matches its `description`. Also attachable by hand with `@rule-name`. |
| **Codex** | Custom prompts — `dist/<locale>/codex/prompts/*.md` | Invoked by name as `/skill-name`. Codex has no description-based auto-trigger, so an `AGENTS.snippet.md` per locale gives the agent a catalog of when to reach for each. |

> **Localization:** skills ship in **English** (default) and **Russian**, generated
> from the same source. English is the canonical edition; Russian is a full
> translation. Replace `<locale>` with `en` or `ru` in the paths above. The skills
> are stack- and workflow-oriented and adapt to any project.

## Skills

29 skills covering the full QA engineering lifecycle — from requirements and
test design, through automation authoring and non-functional checks, to defect
management, audits, and release/CI gating. Every skill takes an explicit **scope**
(a directory / service / branch / diff / whole repo, a requirements or PRD
document, or an issue-tracker ID) and is **stack-agnostic** — it first detects the
project's stack, test framework, and issue tracker, then adapts.

### 🧭 Planning & shift-left

| Skill | Purpose |
| --- | --- |
| `requirements-review` | Review requirements / user stories / PRD for testability, completeness, and contradictions **before** code is written (INVEST, measurable NFRs, Given/When/Then). |
| `test-plan` | Generate a pragmatic test plan / strategy (IEEE 829 / ISTQB): scope, levels by the test pyramid, risk-based depth, entry/exit criteria, environments, metrics. |
| `risk-analysis` | Risk-based prioritization — where to test deep vs. smoke — via a probability × impact matrix over the change perimeter. |

### 🧩 Test design

| Skill | Purpose |
| --- | --- |
| `test-case-design` | Derive a full test-case set from requirements using formal techniques (equivalence partitioning, boundary values, decision tables, state transition, pairwise, error guessing) with requirement→case traceability. |
| `test-checklist` | Fast, practical manual-check checklist for a screen/feature/flow, plus a session-based exploratory-testing charter. |
| `test-data-generation` | Design and generate test data (valid / boundary / invalid / malicious / localized / bulk) — deterministic, prod-isolated, PII-safe synthetic data. |

### 🤖 Test automation

| Skill | Purpose |
| --- | --- |
| `e2e-test-author` | Design and write E2E/UI tests (Playwright/Cypress/Selenium — whatever the repo uses) with Page Objects, stable locators, and a green run. |
| `api-test-author` | Design and write API / contract tests against OpenAPI/Swagger/GraphQL: positive, negative, boundary, authz/IDOR, idempotency, schema validation. |
| `unit-coverage-gap` | Find coverage gaps by risk (not by percentage) and write meaningful missing unit/integration tests; reject assertion-free/tautological tests. |
| `flaky-test-triage` | Empirically confirm flakiness, classify root cause (race/order/time/deps/data), and fix the cause instead of hiding it behind retries. |
| `test-refactor` | Refactor existing tests (dedupe, de-brittle, rebalance the pyramid) while preserving *what* is verified — coverage must not drop. |

### ♿ Non-functional

| Skill | Purpose |
| --- | --- |
| `accessibility-audit` | WCAG 2.1/2.2 (A/AA) accessibility audit by POUR, with a live browser run (keyboard, focus, contrast, screen-reader tree). |
| `i18n-l10n-review` | Internationalization & localization review: hardcoded strings, translation completeness, UI overflow, RTL, pluralization, date/number/timezone formats. |
| `cross-browser-compat` | Cross-browser & responsive compatibility across a device/breakpoint matrix, with live viewport/UA emulation and honest WebKit/Gecko limitations. |

### 🐞 Defect management

| Skill | Purpose |
| --- | --- |
| `bug-report-write` | Compose a concise, information-dense bug report in a fixed, reviewable structure. |
| `bug-report-verify` | Adversarially validate a bug report against primary sources (code, spec, git history) before it is trusted. |
| `bug-triage` | Triage a defect stream: separate severity from priority, deduplicate, classify, assess impact, and recommend a disposition. |
| `root-cause-analysis` | Evidence-based RCA / blameless postmortem: immediate vs. root cause, "why it wasn't caught", and systemic prevention. |
| `defect-metrics-report` | Quality-metrics analytics with interpretation: defect density, reopen rate, aging, MTTR, arrival vs. closure, DRE / escape rate. |

### 🔍 Review & audits

| Skill | Purpose |
| --- | --- |
| `bugfix-audit` | Independent QA/tech-lead audit of a bug fix: is it actually fixed, any regression, adjacent-functionality impact, prod-ready. |
| `feature-review` | End-to-end review of a feature/branch before merge: requirements, code review, regression, and live UI testing, with a prod-ready verdict. |
| `security-audit-feature` | Focused security audit of a single feature/branch/PR against a 14-category checklist. |
| `security-audit-full` | Full-repository security audit across three independent passes (automated scanning, line-by-line review, architecture). |
| `performance-audit-feature` | Focused performance & resource audit of a single feature/change, with before/after comparison. |
| `performance-audit-full` | Full-repository performance & resource audit with instrumented profiling and load-test evidence. |

### 🚀 Release & CI

| Skill | Purpose |
| --- | --- |
| `release-readiness` | Go/no-go release checklist that aggregates all QA signals into a single GO / GO-with-conditions / NO-GO verdict. |
| `smoke-suite` | Design and write a fast, stable smoke/sanity suite over critical paths for post-deploy verification. |
| `test-summary-report` | Stakeholder-facing test summary / QA sign-off (IEEE 829): results, defects, residual risk, and a release recommendation. |
| `ci-qa-gate` | Design/review/configure CI quality gates by stage (pre-commit → pre-merge → pre-deploy), verifying gates actually block and the pipeline itself is secure. |

## Installation

Pick your tool below. The Cursor and Codex adapters live under [`dist/`](dist);
clone this repository first so you can copy them:

```bash
git clone https://github.com/smirnovalex-qa/qa-skills.git
```

### Claude Code

Requires Claude Code with plugin support. Add this repository as a plugin
marketplace, then install the plugin **in your language** — no cloning or copying
needed:

```bash
/plugin marketplace add https://github.com/smirnovalex-qa/qa-skills.git
/plugin install qa-skills@qa-skills        # English (default)
# — or —
/plugin install qa-skills-ru@qa-skills     # Russian
```

Both plugins expose the same 29 skills under the same names; they differ only in
the language of the instructions and triggers. Install the one that matches how
your team writes prompts (install just one to avoid duplicate skills).

To pin a local checkout instead of the remote (e.g. for development):

```bash
/plugin marketplace add /path/to/qa-skills
```

After installation the skills are available automatically — the agent invokes the
matching one when your request fits its trigger. If you previously kept copies
under `~/.claude/skills/`, remove them to avoid duplicates.

### Cursor

Cursor consumes the skills as **project rules** — one `.mdc` file per skill,
scoped to the repository you drop them into. Each rule is *Agent Requested*
(`alwaysApply: false` with a `description`), so Cursor's agent loads it on its own
when the task matches; you can also attach one by hand with `@rule-name` in chat.
Because they are committed to the project, the whole team gets them via `git pull`.

Copy the rules **for your language** into the **target project** (not this repo) —
use `dist/en/...` for English or `dist/ru/...` for Russian:

```bash
# macOS / Linux — from the cloned qa-skills directory
mkdir -p /path/to/your-project/.cursor/rules
cp dist/en/cursor/rules/*.mdc /path/to/your-project/.cursor/rules/
```

```powershell
# Windows PowerShell — from the cloned qa-skills directory
New-Item -ItemType Directory -Force C:\path\to\your-project\.cursor\rules | Out-Null
Copy-Item dist\en\cursor\rules\*.mdc C:\path\to\your-project\.cursor\rules\
```

Reload Cursor (or reopen the project) and the rules appear under
**Settings → Rules**. Verify with a prompt like *"design test cases for this
form"* — Cursor should attach `test-case-design` automatically.

### Codex

Codex consumes the skills as **custom prompts** — one `.md` file per skill,
invoked by name as `/skill-name`. Prompts are user-scoped, so they apply across
all your projects. Skill bodies already use `$ARGUMENTS`, which Codex substitutes
with whatever you pass after the command.

Copy the prompts **for your language** into your Codex prompts directory
(`dist/en/...` or `dist/ru/...` — install one, since both share the same
`/command` names):

```bash
# macOS / Linux
mkdir -p ~/.codex/prompts
cp dist/en/codex/prompts/*.md ~/.codex/prompts/
```

```powershell
# Windows PowerShell
New-Item -ItemType Directory -Force $HOME\.codex\prompts | Out-Null
Copy-Item dist\en\codex\prompts\*.md $HOME\.codex\prompts\
```

Then invoke a workflow by name, passing the scope as the argument:

```
/feature-review src/checkout            # review a feature/branch
/bug-report-write кнопка «оплатить» не реагирует на клик
/security-audit-feature MM-1234         # audit a scope by issue id
```

Codex won't pick a prompt automatically, so append the contents of
`dist/<locale>/codex/AGENTS.snippet.md` — a table of *"which `/command` to use
when"* — to your project's `AGENTS.md` (or `~/.codex/AGENTS.md`). That lets the
agent suggest the right workflow itself, recovering most of Claude Code's
description-based routing.

### Regenerating the outputs

The plugin skill trees and the `dist/` adapters are committed and usable as-is.
After editing a skill under [`skills-src/`](skills-src), rebuild every language
edition and tool target from the canonical source:

```bash
node scripts/generate-adapters.mjs .
```

This regenerates both Claude Code plugins (`plugins/qa-skills`,
`plugins/qa-skills-ru`) and both adapter locales (`dist/en`, `dist/ru`). See
[`dist/README.md`](dist/README.md) for argument-passing details and notes on what
each adapter preserves or approximates.

## Usage

In **Claude Code** and **Cursor** the right skill is selected automatically when
your request matches its trigger; in **Codex** you call it by name (`/skill-name`).
Either way, the phrasing that triggers each workflow is the same — for example:

- *"Are these requirements testable, or are there gaps?"* → `requirements-review`
- *"Draft a test plan for this feature."* → `test-plan`
- *"Design test cases for this form, with boundary and negative cases."* → `test-case-design`
- *"Write E2E tests for the checkout flow."* → `e2e-test-author`
- *"Cover these endpoints with API tests against the OpenAPI spec."* → `api-test-author`
- *"This test passes sometimes and fails sometimes — fix it."* → `flaky-test-triage`
- *"Check this page for accessibility issues."* → `accessibility-audit`
- *"Write a bug report for this crash."* → `bug-report-write`
- *"Is this bug actually real, or a hallucination?"* → `bug-report-verify`
- *"Triage this bug backlog and find duplicates."* → `bug-triage`
- *"Find the real root cause of this incident."* → `root-cause-analysis`
- *"Is this branch ready to merge?"* → `feature-review`
- *"Audit this PR for security holes before release."* → `security-audit-feature`
- *"Why is this service eating so much CPU at scale?"* → `performance-audit-full`
- *"Can we ship this release?"* → `release-readiness`

The [Skills](#skills) table above lists all 29 with their trigger scope. Every
skill name doubles as its explicit invocation — `/feature-review` in Codex, the
skill/command name in Claude Code, or `@feature-review` in Cursor — for when you
want to force a specific workflow instead of relying on auto-selection.

## Repository Structure

```
qa-skills/
├── skills-src/                            # ★ Canonical source — edit here
│   └── <skill>/                            #   29 skills, one directory each
│       ├── meta.yml                        #     name + disallowed-tools (locale-invariant)
│       ├── en/SKILL.md                      #     English description + argument-hint + body
│       └── ru/SKILL.md                      #     Russian description + argument-hint + body
│
├── scripts/
│   └── generate-adapters.mjs              # Builds every output below from skills-src/
│
│   # ── Everything below is GENERATED (committed, never hand-edited) ──
├── .claude-plugin/
│   └── marketplace.json                   # Marketplace manifest (lists both plugins)
├── plugins/
│   ├── qa-skills/                          # English plugin (default)
│   │   ├── .claude-plugin/plugin.json
│   │   └── skills/<skill>/SKILL.md
│   └── qa-skills-ru/                        # Russian plugin
│       ├── .claude-plugin/plugin.json
│       └── skills/<skill>/SKILL.md
├── dist/
│   ├── en/                                 # English adapters
│   │   ├── cursor/rules/*.mdc               #   Cursor project rules (Agent Requested)
│   │   └── codex/                           #   Codex custom prompts + AGENTS.md snippet
│   │       ├── prompts/*.md
│   │       └── AGENTS.snippet.md
│   └── ru/                                 # Russian adapters (same structure)
│
├── LICENSE
└── README.md
```

> The plugin skill trees and everything under `dist/` are build outputs of
> `scripts/generate-adapters.mjs`. Edit skills only in `skills-src/`, then
> regenerate — see [Contributing](#contributing).

## Compatibility & Assumptions

Most skills are **stack-agnostic**: they first detect the project's stack, test
framework, CI system, and issue tracker (from `package.json`, `pyproject.toml`,
`go.mod`, lockfiles, existing tests, CI configs, etc.) and adapt — tools are given
per-ecosystem rather than assuming one framework. Authored artifacts default to
`docs/qa/...` and generated tests follow the repository's existing test-directory
convention. Issue-tracker steps support any tracker (Jira / YouTrack / GitHub
Issues / Linear) via a connected integration, or fall back to asking you.

The four original **audit** skills (`security-audit-*`, `performance-audit-*`)
were authored against, and read best on, a modern web stack — and adapt their
checks to it:

- **Backend:** Python / FastAPI / asyncpg / PostgreSQL / Redis / RabbitMQ, containerized on Docker / Kubernetes / Helm.
- **Frontend:** React + TypeScript + Vite + a Tailwind-based design system.
- **Load testing:** `k6` scenarios under `load-testing/`.
- **Multi-tenant** context (multiple client companies on shared infrastructure) informs the security checks.

These are conventions, not hard requirements — the workflows transfer to other stacks
with light adaptation. Internal project- and host-specific identifiers have been
replaced with neutral placeholders (`the-platform`, `the-frontend`,
`youtrack.example.com`, `libs/shared_*`); adjust them to your project inside the
relevant `skills-src/<skill>/{en,ru}/SKILL.md` sources, then regenerate.

## Versioning

The plugins follow [Semantic Versioning](https://semver.org/). Versions are declared
in [`plugins/qa-skills/.claude-plugin/plugin.json`](plugins/qa-skills/.claude-plugin/plugin.json)
(English) and [`plugins/qa-skills-ru/.claude-plugin/plugin.json`](plugins/qa-skills-ru/.claude-plugin/plugin.json)
(Russian), and are kept in lockstep. Consumers receive updates by re-running
`git pull` on the marketplace, or via the Claude Code plugin update flow.

## Contributing

1. Edit skills only under [`skills-src/`](skills-src) — one directory per skill,
   with `meta.yml` plus `en/SKILL.md` and `ru/SKILL.md`. Keep the two languages in
   sync (translate the change in both). Never hand-edit `plugins/*/skills/` or
   `dist/` — they are generated.
2. Keep each `description` precise and mirror it across `en` and `ru` — it is what
   the agent uses to decide when to trigger the skill.
3. Do not commit project-, host-, or company-specific identifiers, secrets, or PII.
   Use neutral placeholders (see [Compatibility & Assumptions](#compatibility--assumptions)).
4. Regenerate all outputs with `node scripts/generate-adapters.mjs .` and commit
   the updated `plugins/` and `dist/` together with your source change.
5. Bump the `version` in both plugin manifests on any change to skill behavior.

## Security & Privacy

This repository contains **workflow instructions only** — no credentials, tokens,
internal hostnames, IP addresses, or personal data. Audit methodology that references
secrets (e.g. "look for hardcoded API keys") describes what to check for; it contains
no actual secrets. If you adapt the skills to your own project, keep private
identifiers out of committed files.

## License

Released under the [MIT License](LICENSE). © 2026 smirnovalex-qa.
