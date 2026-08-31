// Build QA-skill artifacts for every locale from the canonical source tree.
//
// Source of truth (edit here, never the outputs):
//   skills-src/<name>/meta.yml        -> name, disallowed-tools (locale-invariant)
//   skills-src/<name>/<locale>/SKILL.md -> `description:` + `argument-hint:` + body
//
// Generated (committed, do not hand-edit):
//   plugins/<plugin>/skills/<name>/SKILL.md   Claude Code plugin skills, per locale
//   dist/<locale>/cursor/rules/<name>.mdc     Cursor project rules (Agent Requested)
//   dist/<locale>/codex/prompts/<name>.md     Codex custom prompts (/<name>)
//   dist/<locale>/codex/AGENTS.snippet.md     Codex discovery catalog
//
// Usage (from the repo root):
//   node scripts/generate-adapters.mjs .
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.argv[2] || '.';
const SRC = join(ROOT, 'skills-src');
const DIST = join(ROOT, 'dist');

// locale -> config
const LOCALES = {
  en: {
    plugin: 'qa-skills',
    guard: '> Mode: analysis and report artifact only. Do not modify the project’s application code.',
    triggerMarkers: [' Use when', ' Use this', ' Reach for'],
    agentsHeader: (rows) =>
`<!-- qa-skills: generated — do not edit by hand. Source: skills-src/*/en/SKILL.md -->
## QA skills (Codex prompts)

A set of QA workflows is installed under \`~/.codex/prompts/\`. Codex does not pull
them in automatically — invoke the matching one by name as \`/<name>\` when the task
fits its purpose below. Each takes an argument (the scope / perimeter).

| Command | When to use |
| --- | --- |
${rows}
`,
  },
  ru: {
    plugin: 'qa-skills-ru',
    guard: '> Режим: только анализ и запись отчёта-артефакта. Не изменяй прикладной код проекта.',
    triggerMarkers: [' Используй', ' Использовать', ' Срабатывай'],
    agentsHeader: (rows) =>
`<!-- qa-skills: сгенерировано — не редактировать вручную. Источник: skills-src/*/ru/SKILL.md -->
## QA-скиллы (Codex prompts)

В \`~/.codex/prompts/\` установлен набор QA-воркфлоу. Codex не подхватывает их
автоматически — вызывай подходящий по имени как \`/<name>\`, когда задача
совпадает с его назначением ниже. Каждый принимает аргумент (скоуп/периметр).

| Команда | Когда вызывать |
| --- | --- |
${rows}
`,
  },
};

function parseSkillMd(md) {
  const lines = md.split(/\r?\n/);
  if (lines[0].trim() !== '---') throw new Error('no frontmatter');
  let i = 1;
  const fm = {};
  for (; i < lines.length; i++) {
    if (lines[i].trim() === '---') { i++; break; }
    const m = lines[i].match(/^([a-zA-Z-]+):\s?(.*)$/);
    if (m) fm[m[1]] = m[2];
  }
  const body = lines.slice(i).join('\n').replace(/^\n+/, '');
  return { fm, body };
}

function parseMeta(txt) {
  const meta = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^([a-zA-Z-]+):\s?(.*)$/);
    if (m) meta[m[1]] = m[2].trim();
  }
  return meta;
}

function stripQuotes(s = '') {
  s = s.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))
    return s.slice(1, -1);
  return s;
}

// Short, menu-friendly description: text before the trigger clause, else 1st sentence.
function menuDesc(desc, markers) {
  let cut = -1;
  for (const mk of markers) {
    const idx = desc.indexOf(mk);
    if (idx > 40 && (cut === -1 || idx < cut)) cut = idx;
  }
  let s = cut > 40 ? desc.slice(0, cut) : desc;
  if (cut === -1) {
    const dot = s.indexOf('. ', 60);
    if (dot > 0) s = s.slice(0, dot + 1);
  }
  return s.trim().replace(/\s+/g, ' ');
}

const names = readdirSync(SRC, { withFileTypes: true })
  .filter((d) => d.isDirectory()).map((d) => d.name).sort();

let total = 0;
for (const [locale, cfg] of Object.entries(LOCALES)) {
  const pluginSkills = join(ROOT, 'plugins', cfg.plugin, 'skills');
  const rulesDir = join(DIST, locale, 'cursor', 'rules');
  const promptsDir = join(DIST, locale, 'codex', 'prompts');
  rmSync(pluginSkills, { recursive: true, force: true });
  rmSync(rulesDir, { recursive: true, force: true });
  rmSync(promptsDir, { recursive: true, force: true });
  mkdirSync(rulesDir, { recursive: true });
  mkdirSync(promptsDir, { recursive: true });

  const index = [];
  for (const name of names) {
    const localeFile = join(SRC, name, locale, 'SKILL.md');
    if (!existsSync(localeFile)) throw new Error(`missing ${locale}/SKILL.md for ${name}`);
    const meta = parseMeta(readFileSync(join(SRC, name, 'meta.yml'), 'utf8'));
    const { fm, body } = parseSkillMd(readFileSync(localeFile, 'utf8'));
    const description = fm.description.trim();
    const argHint = stripQuotes(fm['argument-hint'] || '');
    const readOnly = /Edit|Write/.test(meta['disallowed-tools'] || '');
    index.push({ name, description });

    // ---- Claude Code plugin skill ----
    const skillFm = [
      '---',
      `name: ${meta.name}`,
      `description: ${description}`,
      `argument-hint: ${fm['argument-hint']}`,
      ...(meta['disallowed-tools'] ? [`disallowed-tools: ${meta['disallowed-tools']}`] : []),
      '---',
    ].join('\n');
    mkdirSync(join(pluginSkills, name), { recursive: true });
    writeFileSync(join(pluginSkills, name, 'SKILL.md'), `${skillFm}\n\n${body}\n`);

    const guard = readOnly ? `\n${cfg.guard}\n` : '';

    // ---- Cursor rule (.mdc): Agent Requested ----
    writeFileSync(join(rulesDir, `${name}.mdc`),
`---
description: ${description}
globs:
alwaysApply: false
---
${guard}${body}
`);

    // ---- Codex prompt (.md): /<name>, uses $ARGUMENTS ----
    writeFileSync(join(promptsDir, `${name}.md`),
`---
description: ${menuDesc(description, cfg.triggerMarkers)}
argument-hint: ${JSON.stringify(argHint)}
---
${guard}${body}
`);
    total++;
  }

  // ---- Codex discovery snippet ----
  const rows = index.map((s) => `| \`/${s.name}\` | ${menuDesc(s.description, cfg.triggerMarkers)} |`).join('\n');
  writeFileSync(join(DIST, locale, 'codex', 'AGENTS.snippet.md'), cfg.agentsHeader(rows));

  console.log(`[${locale}] ${names.length} skills -> plugins/${cfg.plugin} + dist/${locale}`);
}

console.log(`Done: ${total} skill files across ${Object.keys(LOCALES).length} locales.`);
