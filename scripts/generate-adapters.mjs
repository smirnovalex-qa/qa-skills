// Generator: SKILL.md -> Cursor rules (.mdc) + Codex prompts (.md)
//
// The files under dist/ are committed and usable directly. This script only
// regenerates them from the canonical SKILL.md sources after you edit a skill.
//
//   node scripts/generate-adapters.mjs .
//
// Run from the repo root; the single argument is the repo root path.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.argv[2]; // repo root
const SKILLS = join(ROOT, 'plugins', 'qa-skills', 'skills');
const OUT = join(ROOT, 'dist');

function parse(md) {
  // frontmatter between first two --- lines
  const lines = md.split(/\r?\n/);
  if (lines[0].trim() !== '---') throw new Error('no frontmatter');
  let i = 1;
  const fm = {};
  let key = null;
  for (; i < lines.length; i++) {
    if (lines[i].trim() === '---') { i++; break; }
    const m = lines[i].match(/^([a-zA-Z-]+):\s?(.*)$/);
    if (m) { key = m[1]; fm[key] = m[2]; }
  }
  const body = lines.slice(i).join('\n').replace(/^\n+/, '');
  return { fm, body };
}

function stripQuotes(s = '') {
  s = s.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))
    return s.slice(1, -1);
  return s;
}

// short menu description: text before the first "Используй"/"Use" marker, else full
function menuDesc(desc) {
  const cut = desc.search(/\sИспользуй|\sИспользовать|\sUse\s/);
  const s = cut > 40 ? desc.slice(0, cut).trim() : desc.trim();
  return s.replace(/\s+/g, ' ');
}

const skills = readdirSync(SKILLS, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

// clean output dirs
rmSync(join(OUT, 'cursor', 'rules'), { recursive: true, force: true });
rmSync(join(OUT, 'codex', 'prompts'), { recursive: true, force: true });
mkdirSync(join(OUT, 'cursor', 'rules'), { recursive: true });
mkdirSync(join(OUT, 'codex', 'prompts'), { recursive: true });

const index = [];

for (const name of skills) {
  const src = join(SKILLS, name, 'SKILL.md');
  const { fm, body } = parse(readFileSync(src, 'utf8'));
  const description = fm.description.trim();
  const argHint = stripQuotes(fm['argument-hint'] || '');
  const readOnly = /Edit|Write/.test(fm['disallowed-tools'] || '');
  index.push({ name, description, argHint, readOnly });

  const guard = readOnly
    ? '\n> Режим: только анализ и запись отчёта-артефакта. Не изменяй прикладной код проекта.\n'
    : '';

  // ---- Cursor rule (.mdc) : Agent Requested (has description, alwaysApply:false) ----
  const mdc =
`---
description: ${description}
globs:
alwaysApply: false
---
${guard}${body}`;
  writeFileSync(join(OUT, 'cursor', 'rules', `${name}.mdc`), mdc + '\n');

  // ---- Codex prompt (.md) : invoked as /<name>, uses $ARGUMENTS ----
  const codex =
`---
description: ${menuDesc(description)}
argument-hint: ${JSON.stringify(argHint)}
---
${guard}${body}`;
  writeFileSync(join(OUT, 'codex', 'prompts', `${name}.md`), codex + '\n');
}

// ---- Codex discovery snippet (recovers auto-trigger via AGENTS.md) ----
const agents =
`<!-- qa-skills: сгенерировано, не редактировать вручную. Источник — plugins/qa-skills/skills/*/SKILL.md -->
## QA-скиллы (Codex prompts)

В \`~/.codex/prompts/\` установлен набор QA-воркфлоу. Codex не подхватывает их
автоматически — вызывай подходящий по имени как \`/<name>\`, когда задача
совпадает с его назначением ниже. Каждый принимает аргумент (скоуп/периметр).

| Команда | Когда вызывать |
| --- | --- |
${index.map((s) => `| \`/${s.name}\` | ${menuDesc(s.description)} |`).join('\n')}
`;
writeFileSync(join(OUT, 'codex', 'AGENTS.snippet.md'), agents);

console.log(`Generated ${skills.length} Cursor rules + ${skills.length} Codex prompts + AGENTS snippet.`);
