# QA Skills — adapters for Cursor & Codex

These are **generated** deployment bundles of the same QA skills, adapted to
other agentic coding tools. The canonical source is
[`plugins/qa-skills/skills/*/SKILL.md`](../plugins/qa-skills/skills); do not edit
files here by hand — re-run the generator instead:

```bash
node scripts/generate-adapters.mjs .
```

| Target | Files | Mechanism |
| --- | --- | --- |
| **Cursor** | [`cursor/rules/*.mdc`](cursor/rules) (29) | Project rules, *Agent Requested* — Cursor's agent pulls a rule in automatically when the task matches its `description` (the closest analog to a Claude Code skill). |
| **Codex** | [`codex/prompts/*.md`](codex/prompts) (29) + [`codex/AGENTS.snippet.md`](codex/AGENTS.snippet.md) | Custom prompts invoked as `/<name>`. Codex has no description-based auto-trigger, so the `AGENTS.snippet.md` gives the agent a lookup table of when to reach for each. |

## Install for Cursor

Copy the rules into the target **project** (they are project-scoped):

```bash
mkdir -p <your-project>/.cursor/rules
cp dist/cursor/rules/*.mdc <your-project>/.cursor/rules/
```

Each rule is *Agent Requested* (`alwaysApply: false` with a `description`), so
Cursor's agent decides when to load it — you don't invoke it by name. You can
also attach one manually with `@<rule-name>` in the chat. Because these are
committed to the project, the whole team gets them via `git pull`.

## Install for Codex

Codex custom prompts are user-scoped (`~/.codex/prompts/`):

```bash
mkdir -p ~/.codex/prompts
cp dist/codex/prompts/*.md ~/.codex/prompts/
```

Then invoke a workflow in Codex by name, passing the scope as the argument
(it maps to `$ARGUMENTS` inside the prompt):

```
/feature-review src/checkout           # review a feature/branch
/bug-report-write кнопка «оплатить» не реагирует на клик
/security-audit-feature MM-1234        # audit a scope by issue id
```

Since Codex won't pick these automatically, append the contents of
[`codex/AGENTS.snippet.md`](codex/AGENTS.snippet.md) to your project's
`AGENTS.md` (or `~/.codex/AGENTS.md`) so the agent knows the catalog exists and
when to use each `/command`.

## Notes on fidelity

- **Trigger text** — the skill `description` is carried over verbatim as the
  Cursor rule `description` and the Codex prompt/`AGENTS.md` menu text.
- **Arguments** — skill bodies already use `$ARGUMENTS`, which Codex substitutes
  natively; in Cursor there is no argument channel, so those bodies fall back to
  the conversation context (the skills are written to degrade gracefully).
- **Read-only skills** — skills that are analysis-only in Claude Code (they set
  `disallowed-tools: Edit/Write`) can't enforce that in Cursor/Codex, so the
  generator injects an explicit *"analysis only, don't change project code"*
  instruction at the top of those adapters.
- **What's lost** — hard tool-permission enforcement and Claude Code's
  automatic, description-based skill routing (fully preserved only in Cursor;
  approximated in Codex via the `AGENTS.md` catalog).
