---
description: Internationalization (i18n) and localization (l10n) review — scope from a feature/screen/directory/branch, a requirements document, or a tracker issue; checking hardcoded strings, translation completeness, UI overflow on long languages, RTL support, pluralization, date/number/currency/time formats by locale, time zones, unicode, and variable interpolation, with a live run across locales in the browser. Every finding is tied to file:line, the specific breaking locale/language, and a scenario, with an explicit verdict on multilingual readiness.
argument-hint: "[path to feature/screen/directory/branch, path to requirements document, or issue ID/link; optionally a list of target locales]"
---

> Mode: analysis and report artifact only. Do not modify the project’s application code.
# Internationalization and localization review (i18n / l10n)

You are a localization auditor. Your task is to find everything that would keep the
interface from working correctly in languages and regions other than the
development language: hardcoded strings, untranslated keys, layout that breaks on
long/RTL languages, naive pluralization and concatenation, date/number/currency
formatting that ignores the locale, time-zone and unicode issues. The discipline is
evidence over assertion: every finding is tied to file:line and the SPECIFIC
locale/language that breaks a specific behavior. Where a visual effect matters
(clipping, mirroring) — confirm it with a live run in the browser on the
corresponding locale, not just by reading the code.

The skill is project-agnostic. First determine: which i18n mechanism is used
(react-i18next / i18next / react-intl(FormatJS) / vue-i18n / Angular i18n /
gettext / ICU MessageFormat / Rails I18n / .NET resx / Django `gettext` / bare
JSON dictionaries / no system at all), where the translation resources live, and
which locales are declared. That determines what to check and how. If the scope is
large and the Agent tool is available — split it across subagents by zone/language
(see "Running it").

## INPUT / SCOPE (how to determine the perimeter)

Scope: `$ARGUMENTS`. Determine the input mode and build the SCOPE. The scope is
broader than the literal input: include the shared formatting components/utilities
(a single `formatDate`/`formatMoney`/`<Trans>` wrapper) that the code under review
uses — a defect in a shared formatting utility is multiplied across the whole app.

**A. CODE: feature / screen / directory / branch / diff / whole frontend.** Scope =
the directory contents (or `git diff --stat` against the base branch) + the
translation resource files affected by these screens + the shared formatting
utilities and i18n wrappers that the code calls. Determine the target locales (from
the i18n config / README / list of resource files) and the URLs of the screens for
the live run.

**B. DOCUMENT: requirements / spec / localization spec (.md/.txt/.docx).** Read it
in full. Extract: the list of target languages/regions, format requirements
(currency, date, units), whether RTL support is stated, time-zone rules. Match
against the code (`grep`): a requirement "we support ar-SA with RTL" while the code
has no `dir`/logical CSS properties is a finding.

**C. ISSUE in a tracker (Jira/YouTrack/GitHub/Linear: ID or link).** Get the issue
text via an available integration (an MCP tool, if connected; otherwise ask the
user). Find the related commits (`git log --all --grep=<ID> --oneline`,
`git show --stat`), and build the list of affected files and resources.

If the scope is ambiguous — check with the task author; do not check the whole
frontend at random. Record the final SCOPE (files, translation resources, target
locales) at the start of the report. If the target locales are unknown — use a
representative set: a long language (de/fi), RTL (ar/he), CJK (ja/zh), a language
with complex pluralization (ru/pl/ar), and confirm the list with the user.

## KEY PRINCIPLE: "works in English" ≠ "localizable"
Check adversarially:
1. Do not trust that a string is extracted into a dictionary — verify it is
   extracted WHOLE and meaningfully, not assembled by concatenating pieces (word
   order differs in another language).
2. Do not consider a translation complete just because a locale file exists —
   compare the set of keys across locales (a missing key = a silent fallback to the
   default language or the raw key being shown).
3. Do not judge the layout by English — German/Finnish text is 30–40% longer, RTL
   mirrors the layout. Check on a real long/RTL translation (or on a pseudo-locale).
4. Do not consider `new Date().toLocaleString()` without an explicit locale/time
   zone correct — it depends on the server/browser environment and silently gives
   different results.
5. State the status explicitly: "hardcoded" / "extracted, but assembled by
   concatenation" / "extracted, key missing in some locales" / "localized
   correctly".

## METHODOLOGY: THREE INDEPENDENT PASSES (within the SCOPE)

### PASS 1 — Tooling
- If the project has an i18n linter/extractor — run it: `i18next-parser`/
  `i18next scanner` (key reconciliation and finding missing keys), `formatjs
  extract`, `eslint-plugin-i18next` / `eslint-plugin-formatjs` /
  `eslint-plugin-react` rule against literal strings, `gettext` tools (`msgcmp`,
  `msgfmt --check`). Goal — automatically detect hardcoding and key desync.
- Compare the key sets across all locale resource files (a key diff): find keys
  present in one locale and missing in others, and vice versa (dead keys).
- `grep` across the SCOPE for suspicious hardcoding patterns (see checklist block
  1).

### PASS 2 — Manual line-by-line code review
Go through the SCOPE files line by line against the checklist below. For each
finding — file:line, category, the specific breaking locale, scenario.

### PASS 3 — LIVE run across locales (where there is a visual effect)
Actually bring up the app (the standard dev command from package.json/README or the
specified environment) and, via the Claude Browser MCP, check the key screens:
- **Switch the locale** to a long language (de/fi) — check clipping/overflow/text
  collision in buttons, tabs, badges, menus; if pseudo-localization exists — turn
  it on.
- **Switch to RTL** (ar/he) — check layout mirroring (`dir="rtl"`): alignment,
  direction of arrow icons, element order, padding/margin.
- **CJK** (ja/zh) — line wrapping, absence of spaces, line height.
- **Formats** — verify that dates/numbers/currencies on screen are rendered per the
  chosen locale, not hardcoded; change the system locale/time zone if it matters.
- Record the result with a screenshot/description. Whatever could not be run live
  (the needed locale not in the build, headless) — into the "what was not checked"
  section.

## CHECKLIST BY CATEGORY (apply the ones relevant to the SCOPE)

1. **Hardcoded user-facing strings.** Any text visible to the user must go through
   an i18n function/resource, not be a literal in the code. Look for: string
   literals in JSX/templates, `alt`/`title`/`placeholder`/`aria-label` with text,
   text in `throw new Error(...)` shown to the user, text in validators, `enum`
   values rendered as-is, strings in toasts/alerts. Exceptions (technical logs, API
   keys) — flag them but do not count them as findings.
2. **Translation completeness and integrity.** All keys are present in all target
   locales; no raw keys have "leaked" into the UI (`user.profile.title` instead of
   text); a fallback to the default language is deliberate and does not mask a
   missing key; no empty values; no duplicate keys with diverging meaning.
3. **Text length and UI overflow.** Fixed width/height on text containers,
   `text-overflow: ellipsis` where clipping loses meaning, absence of wrapping
   (`white-space: nowrap`) on translatable elements; buttons/badges/tabs sized for
   short English. Check on a long language (de/fi ~+35%).
4. **RTL (right-to-left).** `dir="rtl"` is set by locale; logical CSS properties
   are used (`margin-inline-start` instead of `margin-left`, `padding-inline`,
   `inset-inline`) instead of physical ones; directional icons ("back/forward"
   arrows, progress) are mirrored; the layout is not broken on flex/grid; the order
   of paired elements is correct.
5. **Pluralization.** Not concatenation `count + " item(s)"` and not a naive ternary
   `count === 1 ? 'item' : 'items'` — the target language's plural rules are used
   (ICU `plural`, i18next `_plural`/count, gettext `ngettext`). Account for the fact
   that Russian/Polish/Arabic have more than two forms (one/few/many/other), while
   Japanese has one. Check the zero form where it is special.
6. **Date and time formatting.** Not a hardcoded format (`DD.MM.YYYY`,
   `MM/DD/YYYY`) — `Intl.DateTimeFormat`/a locale-aware library with the locale
   passed in is used; the 12/24-hour format, the first day of the week, and
   month/day names come from the locale.
7. **Number, currency, unit formatting.** Thousands/decimal separators by locale
   (1,234.56 vs 1 234,56 vs 1.234,56), `Intl.NumberFormat`; currency is formatted
   with the correct symbol/position/code (`Intl.NumberFormat(..., {style:
   'currency', currency})`) rather than by gluing on a `$`; units of measure and
   systems (metric/imperial) by region.
8. **Time zones.** Time is stored in UTC and displayed in the user's time zone; no
   `new Date(string)` without a zone giving an offset; daylight saving time is
   accounted for; "today/yesterday" is computed in the user's time zone, not the
   server's.
9. **Sorting and collation.** Lists are sorted with locale awareness
   (`Intl.Collator`/`localeCompare(locale)`), not by character codes (otherwise
   diacritics, ё/е, case, CJK sort incorrectly).
10. **Unicode, encodings, normalization.** UTF-8 everywhere; correct handling of
    emoji and composite graphemes (length counted by code points/graphemes, not by
    UTF-16 code units — string truncation does not tear a surrogate pair/emoji);
    normalization (NFC/NFD) on comparison/search/storage; input in non-native
    layouts (diacritics, IME for CJK) does not break validation.
11. **Variable interpolation in translations.** Variables are inserted as named
    placeholders inside the translatable string (`t('greeting', {name})` →
    "Hello, {name}!"), so the translator can change word order; NOT by gluing
    fragments (`t('greeting') + name + t('suffix')`). Placeholders are present in
    all locales and not lost in translation; number/date formatting inside the
    message is also locale-aware (ICU `{n, number}`/`{d, date}`).
12. **Locale-dependent assets and signs.** Images/icons with baked-in text
    (localized versions or overlaid text needed); a flag ≠ a language (do not use a
    country flag as a language switcher); symbols, gestures, colors with cultural
    connotations; sample data (names, phones, addresses, formats) in the UI by
    region.
13. **Locale selection and persistence.** The locale is detected correctly
    (`Accept-Language`/user setting/URL), persists across sessions, switches without
    reloading data in the wrong language; SSR/meta tags (`<html lang>`, hreflang)
    are consistent with the chosen locale; the server and client do not diverge in
    locale (hydration).

## EDGE CASES THAT ARE OFTEN MISSED
- Strings inside error/validation messages and in toasts — they are often forgotten
  when extracting to the dictionary.
- Concatenating "{count} {unit}" or "Showing X of Y" from pieces — breaks word
  order and pluralization at the same time.
- Pseudo-translation is absent, so overflow is only found after the release in
  German.
- `toLocaleDateString()` without an explicit locale argument — "works" on the
  developer's machine, gives a different format in prod.
- A key was added only to the default locale, the others silently show English
  (or the raw key) — it looks like "translated".
- RTL: the logo / "back" icon is not mirrored; a dropdown opens off the edge of the
  screen; `text-align: left` is hardcoded.
- Truncating a string with `.substring(0, n)` tears an emoji/surrogate pair → a
  broken character.
- Pluralization was checked in English (2 forms) and fails in Russian
  (5 files → "5 файла"/"5 файлов").
- Currency formatted as `"$" + amount` — wrong for the euro / locales where the
  symbol comes after the amount, and for currencies with no fractional part (JPY).
- Sorting a dropdown of countries/names by ASCII — diacritics drift to the end.
- A "yesterday/today" date computed in UTC → for a user in UTC-8 it shows the wrong
  day.
- A hardcoded `lang="en"` in `<html>` while the locale is switched — breaks screen
  readers and hyphenation.
- Numeric input: the user enters `1.234,56` (European format), the parser expects
  `1234.56` → an incorrect value.
- A field length/character limit set for Latin — for CJK a single "character"
  carries more meaning, and the limit becomes too strict.

## SEVERITY SCALE
For each finding, state which locale/language breaks and exactly what.
- **Critical** — on the target locale the functionality is inoperable or data is
  corrupted (incorrect number/currency parsing → a wrong amount; raw keys instead
  of text across the whole screen; RTL completely breaks navigation).
- **High** — a noticeable UX breakage on the target locale: clipped/overlapping
  text on key elements, a wrong date/currency format on important data, incorrect
  pluralization in the main scenario, large translation gaps.
- **Medium** — a local problem: some strings are hardcoded, suboptimal sorting,
  lack of support for one of the secondary locales, minor overflow.
- **Low** — best practice with no direct breakage scenario on the current target
  locales (physical CSS properties with no RTL plans, absence of a pseudo-locale).

Verdict: ready for localization into the target languages / ready with caveats /
not ready (list the blockers and in which languages).

## REPORT FORMAT
1. **Executive summary** (no jargon): will the product work in the target
   languages/regions, what will break and in which language, what to fix first, is
   there a risk of data corruption (money/dates).
2. **SCOPE** — the files/resources/locales checked and what was left out of scope.
3. **One-line verdict** up front.
4. **Coverage matrix** — which locales were checked live, which only from the code,
   what the linter checked.
5. **List of findings**: ID, file:line, category, the specific breaking
   locale/language, scenario, severity, recommendation.
6. **What was done well** — strong i18n patterns worth replicating.
7. **Action plan**: blockers vs. deferred.
8. **What was not checked** — limitations (not all locales in the build, no real
   translations to check length, RTL was not tested live, etc.).

## RULES FOR WRITING UP FINDINGS
Before you start, check whether a report for this scope exists in `docs/qa/i18n/` —
if so, continue the ID numbering and update statuses rather than recreating it.
For each finding:
- A stable ID: `I18N-<scope-slug>-001`.
- file:line (and/or URL + element).
- Category (the checklist block number / type: hardcoding, pluralization, RTL,
  format…).
- The specific breaking locale/language and scenario: "on de-DE the button text
  "Speichern und fortfahren" is clipped in the 120px container" — not in the
  abstract.
- Severity with justification (what breaks / whether data is corrupted).
- A concrete recommendation ("extract the string into resource `common.save`",
  "replace the concatenation with an ICU plural", "use `Intl.NumberFormat` with the
  locale and currency passed in").
Save the report to `docs/qa/i18n/<scope-slug>.md` (follow the existing repository
structure; `docs/qa/...` is the default).

## RUNNING IT (practical instructions)
1. Determine the SCOPE YOURSELF in the main thread (see "Input") and the target
   locales — do not delegate; a subagent does not see the conversation context.
   Determine the project's i18n mechanism, where the resources are, and how to bring
   up the app.
2. Check whether a previous report exists in `docs/qa/i18n/`.
3. Run PASS 1 (linter/extractor, key diff across locales, grep for hardcoding).
4. Carry out PASS 2 (line-by-line review against the checklist) and PASS 3 (live run
   on a long/RTL/CJK language in the browser — mandatory for the visual categories
   3, 4). If the scope is large and the Agent tool is available — split zones/
   languages across subagents; give each one the concrete paths/resources, the
   checklist, the severity scale, and the finding format (the subagent does not see
   this file). Write confirmed findings into an interim file as you go.
5. Merge the three passes into the report, filter out false positives, save to
   `docs/qa/i18n/<scope-slug>.md`.
6. Explicitly list what was not checked.

This is testing, not implementation: fixes are made by the developer based on the
report, not by you within this skill.

