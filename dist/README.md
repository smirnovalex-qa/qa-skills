# QA Skills — adapters for Cursor & Codex (per locale)

These are **generated** deployment bundles of the QA skills, adapted to other
agentic coding tools and split by language. The canonical source is
[`skills-src/`](../skills-src) (`<name>/{meta.yml, en/SKILL.md, ru/SKILL.md}`);
do not edit anything here by hand — re-run the generator instead:

```bash
node scripts/generate-adapters.mjs .
```

## Layout

```
dist/
├── en/                         # English
│   ├── cursor/rules/*.mdc       #   Cursor project rules (Agent Requested)
│   └── codex/
│       ├── prompts/*.md         #   Codex custom prompts (/<name>)
│       └── AGENTS.snippet.md     #   Codex discovery catalog
└── ru/                         # Russian — same structure
    ├── cursor/rules/*.mdc
    └── codex/
        ├── prompts/*.md
        └── AGENTS.snippet.md
```

> **Claude Code** does not need an adapter — it installs the skills natively as a
> plugin. Pick the language at install time: `qa-skills` (English) or
> `qa-skills-ru` (Russian). See the top-level [README](../README.md#claude-code).

| Target | Files | Mechanism |
| --- | --- | --- |
| **Cursor** | `dist/<locale>/cursor/rules/*.mdc` (29) | Project rules, *Agent Requested* — Cursor's agent pulls a rule in automatically when the task matches its `description` (the closest analog to a Claude Code skill). |
| **Codex** | `dist/<locale>/codex/prompts/*.md` (29) + `AGENTS.snippet.md` | Custom prompts invoked as `/<name>`. Codex has no description-based auto-trigger, so `AGENTS.snippet.md` gives the agent a lookup table of when to reach for each. |

Replace `<locale>` with `en` or `ru` throughout.

## Install for Cursor

Copy the rules for your language into the target **project** (they are
project-scoped):

```bash
mkdir -p <your-project>/.cursor/rules
cp dist/en/cursor/rules/*.mdc <your-project>/.cursor/rules/   # or dist/ru/...
```

Each rule is *Agent Requested* (`alwaysApply: false` with a `description`), so
Cursor's agent decides when to load it — you don't invoke it by name. You can
also attach one manually with `@<rule-name>`. Because these are committed to the
project, the whole team gets them via `git pull`.

## Install for Codex

Codex custom prompts are user-scoped (`~/.codex/prompts/`):

```bash
mkdir -p ~/.codex/prompts
cp dist/en/codex/prompts/*.md ~/.codex/prompts/           # or dist/ru/...
```

Then invoke a workflow by name, passing the scope as the argument (it maps to
`$ARGUMENTS` inside the prompt):

```
/feature-review src/checkout           # review a feature/branch
/bug-report-write the “pay” button does not respond to clicks
/security-audit-feature MM-1234        # audit a scope by issue id
```

Since Codex won't pick these automatically, append the contents of
`dist/<locale>/codex/AGENTS.snippet.md` to your project's `AGENTS.md` (or
`~/.codex/AGENTS.md`) so the agent knows the catalog exists and when to use each
`/command`.

> Install one language at a time — the `en` and `ru` prompts share the same
> `/<name>` command names, so copying both into `~/.codex/prompts/` would collide.

## Notes on fidelity

- **Single source, all locales** — every artifact here (and both Claude Code
  plugins) is generated from `skills-src/`, so the trigger text and workflow stay
  identical across languages and tools; you never maintain copies by hand.
- **Trigger text** — the skill `description` is carried over verbatim as the
  Cursor rule `description` and the Codex prompt / `AGENTS.md` menu text.
- **Arguments** — skill bodies use `$ARGUMENTS`, which Codex substitutes natively;
  in Cursor there is no argument channel, so those bodies fall back to the
  conversation context (the skills are written to degrade gracefully).
- **Read-only skills** — skills that are analysis-only in Claude Code (they set
  `disallowed-tools: Edit/Write`) can't enforce that in Cursor/Codex, so the
  generator injects an explicit *"analysis only, don't change project code"*
  instruction at the top of those adapters.
- **What's lost** — hard tool-permission enforcement and Claude Code's automatic,
  description-based skill routing (fully preserved only in Cursor; approximated in
  Codex via the `AGENTS.md` catalog).
