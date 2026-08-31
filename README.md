# QA Skills for Claude Code

A curated set of production-grade **QA skills** for [Claude Code](https://docs.claude.com/en/docs/claude-code/overview) — bug reporting, bug-fix and feature review, and security & performance audits. Packaged as a Claude Code **plugin marketplace** so a team can install the whole toolkit with a single command and keep it up to date via `git pull`.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Claude Code Plugin](https://img.shields.io/badge/Claude%20Code-Plugin%20Marketplace-8A2BE2.svg)](https://docs.claude.com/en/docs/claude-code/plugins)
[![Skills](https://img.shields.io/badge/Skills-29-success.svg)](#skills)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen.svg)](#)

---

## Table of Contents

- [Overview](#overview)
- [Skills](#skills)
- [Installation](#installation)
- [Usage](#usage)
- [Repository Structure](#repository-structure)
- [Compatibility & Assumptions](#compatibility--assumptions)
- [Versioning](#versioning)
- [Contributing](#contributing)
- [Security & Privacy](#security--privacy)
- [License](#license)

## Overview

Each skill is a self-contained, model-invoked workflow that Claude Code loads on demand when the task matches — you don't have to remember command names. The skills encode a consistent QA discipline:

- **Evidence over assertion** — findings are tied to `file:line`, reproduction steps, or measurements (`EXPLAIN ANALYZE`, `py-spy`, bundle size, `k6`), not opinions.
- **Adversarial verification** — reports and fixes are challenged before they are trusted, to filter out plausible-but-wrong conclusions.
- **Explicit verdicts** — every audit ends with a clear production-readiness call, not a wall of caveats.

> **Language note:** skill instructions are authored in **Russian**. The skills themselves are stack- and workflow-oriented and can be adapted to any project.

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

Requires Claude Code with plugin support.

Add this repository as a plugin marketplace, then install the plugin:

```bash
/plugin marketplace add https://github.com/smirnovalex-qa/qa-skills.git
/plugin install qa-skills@qa-skills
```

To pin a local checkout instead of the remote (e.g. for development):

```bash
/plugin marketplace add /path/to/qa-skills
```

After installation the skills are available automatically. If you previously kept
copies under `~/.claude/skills/`, remove them to avoid duplicates.

## Usage

Skills are invoked automatically by Claude Code when your request matches a skill's
trigger — for example:

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

The [Skills](#skills) table above lists all 29 with their trigger scope.

You can also invoke a skill explicitly by name if your Claude Code build exposes it
as a command.

## Repository Structure

```
qa-skills/
├── .claude-plugin/
│   └── marketplace.json          # Marketplace manifest (lists the plugin)
├── plugins/
│   └── qa-skills/
│       ├── .claude-plugin/
│       │   └── plugin.json        # Plugin manifest (name, version, author)
│       └── skills/                      # 29 skills, one directory each
│           ├── requirements-review/SKILL.md
│           ├── test-plan/SKILL.md
│           ├── risk-analysis/SKILL.md
│           ├── test-case-design/SKILL.md
│           ├── test-checklist/SKILL.md
│           ├── test-data-generation/SKILL.md
│           ├── e2e-test-author/SKILL.md
│           ├── api-test-author/SKILL.md
│           ├── unit-coverage-gap/SKILL.md
│           ├── flaky-test-triage/SKILL.md
│           ├── test-refactor/SKILL.md
│           ├── accessibility-audit/SKILL.md
│           ├── i18n-l10n-review/SKILL.md
│           ├── cross-browser-compat/SKILL.md
│           ├── bug-report-write/SKILL.md
│           ├── bug-report-verify/SKILL.md
│           ├── bug-triage/SKILL.md
│           ├── root-cause-analysis/SKILL.md
│           ├── defect-metrics-report/SKILL.md
│           ├── bugfix-audit/SKILL.md
│           ├── feature-review/SKILL.md
│           ├── security-audit-feature/SKILL.md
│           ├── security-audit-full/SKILL.md
│           ├── performance-audit-feature/SKILL.md
│           ├── performance-audit-full/SKILL.md
│           ├── release-readiness/SKILL.md
│           ├── smoke-suite/SKILL.md
│           ├── test-summary-report/SKILL.md
│           └── ci-qa-gate/SKILL.md
├── LICENSE
└── README.md
```

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
relevant `SKILL.md` files.

## Versioning

The plugin follows [Semantic Versioning](https://semver.org/). The current version is
declared in [`plugins/qa-skills/.claude-plugin/plugin.json`](plugins/qa-skills/.claude-plugin/plugin.json).
Consumers receive updates by re-running `git pull` on the marketplace, or via the
Claude Code plugin update flow.

## Contributing

1. One skill per directory, each with a single `SKILL.md`.
2. Keep the `description` in each skill's front matter precise — it is what Claude uses
   to decide when to trigger the skill.
3. Do not commit project-, host-, or company-specific identifiers, secrets, or PII.
   Use neutral placeholders (see [Compatibility & Assumptions](#compatibility--assumptions)).
4. Bump the plugin `version` on any change to skill behavior.

## Security & Privacy

This repository contains **workflow instructions only** — no credentials, tokens,
internal hostnames, IP addresses, or personal data. Audit methodology that references
secrets (e.g. "look for hardcoded API keys") describes what to check for; it contains
no actual secrets. If you adapt the skills to your own project, keep private
identifiers out of committed files.

## License

Released under the [MIT License](LICENSE). © 2026 smirnovalex-qa.
