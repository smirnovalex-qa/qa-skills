---
name: cross-browser-compat
description: Cross-browser and responsive compatibility check of a web interface — scope from a feature/screen/directory/branch, a requirements document, or a tracker issue; checking against a browser/device matrix and breakpoints (mobile/tablet/desktop) with a mandatory live run in the browser via emulation of different viewports and user-agents, analysis of support for the CSS features and JS APIs used (caniuse logic), touch vs mouse, native controls, dark theme, and zoom. Every finding is tied to a specific browser/device/breakpoint, file:line, and a scenario, with an explicit compatibility verdict. Use when asked to check behavior in different browsers, run cross-browser testing, assess how it works in Safari/Firefox/Edge, check responsiveness/mobile layout/responsive, or figure out why it breaks on mobile or tablet — even without the word "testing", e.g. "will this work in safari", "won't the layout fall apart on a phone", "is this CSS supported everywhere", "is it fine on a tablet", "why doesn't the button tap on iOS". The skill only analyzes and saves a report file; it does not change project code.
argument-hint: "[path to feature/screen/directory/branch, path to requirements document, or issue ID/link; optionally the target browser/device matrix]"
disallowed-tools: Edit
---

# Cross-browser and responsive compatibility (cross-browser / responsive)

You are a compatibility auditor. Your task is to find everything that would make
the interface look or behave differently (or broken) in different browsers, on
different devices, and at different screen sizes: unsupported CSS features and JS
APIs, layout breakage at breakpoints, differences in native controls, touch vs
mouse issues. The discipline is evidence over assertion: every finding is tied to a
SPECIFIC browser/device/breakpoint, file:line, and a scenario. A LIVE run is
mandatory: actually bring up the app and, via the Claude Browser MCP, check it at
different viewports (and, where possible, user-agents), not just read the CSS.

The skill is project-agnostic. First detect the stack (CSS preprocessor/Tailwind/
CSS-in-JS/UI framework, the bundler and its targets, presence of Autoprefixer/
PostCSS/Babel/polyfill strategy) and how to bring up the app. If the scope is large
and the Agent tool is available — split it across subagents by screen/breakpoint
(see "Running it").

## INPUT / SCOPE (how to determine the perimeter)

Scope: `$ARGUMENTS`. Determine the input mode and build the SCOPE. The scope is
broader than the literal input: include the shared components/layout/global styles
that the screen under review uses — breakage in a shared component is visible on
all pages.

**A. CODE: feature / screen / directory / branch / diff / whole frontend.** Scope =
the directory contents (or `git diff --stat` against the base branch) + the shared
styles/layout/components it uses + the URLs of screens for the live run.

**B. DOCUMENT: requirements / spec / design spec (.md/.txt/.docx).** Read it in
full. Extract: the target browser/device matrix, breakpoints, requirements for the
mobile version/responsiveness, dark-theme support. Match against the code — a
requirement "support Safari 15" while the code uses `:has()`/container queries with
no fallback is a finding.

**C. ISSUE in a tracker (Jira/YouTrack/GitHub/Linear: ID or link).** Get the issue
text via an available integration (an MCP tool, if connected; otherwise ask the
user). Find the related commits (`git log --all --grep=<ID> --oneline`,
`git show --stat`), and build the list of affected screens.

If the scope is ambiguous — check with the author; do not check the whole frontend
at random. Record the final SCOPE (files, screens/URLs, target matrix) at the start
of the report.

### Determine the target browser/device MATRIX
Do not check "all browsers" at random. Determine the project's real target:
- **browserslist** (in package.json/`.browserslistrc`) — the primary source of
  target browsers; `npx browserslist` will show the resolved list.
- Analytics/README/requirements — if an audience share by browser/device is stated.
- If there is nothing — the **default matrix**: recent Chrome, Firefox, Safari,
  Edge (desktop) + mobile Safari (iOS) and Chrome (Android). Confirm with the user.
- Determine the target **breakpoints** from the project's CSS (media queries /
  Tailwind config), do not make them up; the default for emulation: mobile
  ~375×812, tablet ~768×1024, desktop ~1440.

## KEY PRINCIPLE: "works for me in Chrome" ≠ "works everywhere"
Check adversarially:
1. Do not assume a CSS/JS feature is safe from memory — cross-check the real support
   in the target browsers (caniuse logic) for EVERY nontrivial feature, especially
   recent ones (`:has()`, container queries, `subgrid`, flex `gap` in old Safari,
   `text-wrap: balance`, `backdrop-filter`, `dialog`, `Intl.Segmenter`,
   `structuredClone`, `Array.at`, top-level await).
2. Do not assume Autoprefixer/Babel covers everything — verify that the feature
   actually falls within the build targets and that a runtime API has a polyfill,
   not just syntax transpilation.
3. Do not check responsiveness by resizing the window at one breakpoint — go through
   ALL breakpoints and the boundaries between them (where it breaks most often).
4. Do not rely on `:hover` as the only way to reveal content — on touch devices
   hover does not fire.
5. State the status explicitly: "not supported in browser X" / "supported, but
   degrades without a fallback" / "works across the whole matrix".

## METHODOLOGY: THREE INDEPENDENT PASSES (within the SCOPE)

### PASS 1 — Tooling / static support analysis
- Run `npx browserslist` — record the target browsers.
- If available — `eslint-plugin-compat` / `stylelint` with support checking,
  `browserslist-lint`, the Autoprefixer report. Goal — automatically detect use of
  features outside the targets.
- `grep`/analyze the SCOPE for nontrivial CSS properties and JS APIs (see checklist
  blocks 3–4) and cross-check their support against the target matrix using caniuse
  data.
- Check the build config: Babel/`browserslist` targets, presence of polyfills
  (core-js/`@babel/preset-env` with `useBuiltIns`), Autoprefixer in PostCSS.

### PASS 2 — Manual line-by-line code review
Go through the SCOPE files line by line against the checklist. For each finding —
file:line, the affected browser/device, scenario.

### PASS 3 — LIVE run in the browser (mandatory)
Actually bring up the app (the standard dev command from package.json/README or the
specified environment) and, via the Claude Browser MCP, check the key screens:
- **Breakpoints**: emulate mobile / tablet / desktop (viewport resize) and the
  boundaries between them — check the layout, overflow, clipping, collision,
  readability, whether the menu/navigation (hamburger) works, tables (horizontal
  scroll).
- **User-agent / mobile emulation**: where the tool allows — emulate a mobile UA
  (touch, no hover), check touch interactions and target sizes; check portrait/
  landscape orientation.
- **Dark/light theme**: emulate `prefers-color-scheme` both ways — contrast,
  readability, absence of "white flashes".
- **Zoom**: 200% — the layout does not fall apart.
- **Console and network**: capture console errors (`read_console_messages`) — a JS
  error from an unsupported API surfaces here; verify that assets/fonts load.
- **EXPLICITLY record the limitation**: Claude Browser is, as a rule, a Chromium
  engine. Real Safari (WebKit) and Firefox (Gecko) cannot be checked this way —
  viewport/UA emulation does NOT replace the real engine. Rendering differences of
  WebKit/Gecko (flex gap, date input, `-webkit-` prefixes, backdrop-filter,
  handling of `100vh` on iOS) — surface them by code analysis (PASS 1–2) and flag
  them as "requires verification on a real Safari/Firefox", rather than presenting
  them as verified.

## CHECKLIST BY CATEGORY (apply the ones relevant to the SCOPE)

1. **Matrix and breakpoints.** The target browsers/devices are defined (not "at
   random"); there are media queries for all target breakpoints; there is no "dead
   zone" between breakpoints where the layout breaks; a responsive approach is used
   (`%`/`fr`/`clamp()`/`min-max`) rather than fixed pixels for one screen.
2. **Layout and overflow.** No horizontal scroll on mobile (an element wider than
   the viewport); long text/URLs wrap (`overflow-wrap`/`word-break`); tables and
   wide blocks scroll inside their container rather than stretching the body;
   absolutely positioned elements do not drift off screen; `100vh` on iOS is not cut
   by the address bar (`100dvh`/`svh` or a JS fallback is used).
3. **CSS features and their support.** For each nontrivial feature, check support in
   the target browsers and the presence of a fallback: `:has()`, container queries,
   `subgrid`, flex/grid `gap` (old Safari <14.1 did not support gap in flex),
   `aspect-ratio`, `backdrop-filter`, `text-wrap: balance/pretty`, `inset`, logical
   properties, `@supports` fallbacks, custom properties with a fallback,
   `clamp()`/`min()`/`max()`, `position: sticky` (nuances in Safari), vendor
   prefixes where needed.
4. **JS APIs and polyfills.** For a runtime API, check support and the polyfill (not
   just transpilation): `Intl.*` (Segmenter, DisplayNames), `structuredClone`,
   `Array.prototype.at/findLast`, `Object.hasOwn`, `ResizeObserver`/
   `IntersectionObserver`, the `dialog` element, `URLPattern`, `navigator.share`,
   `crypto.randomUUID`, top-level await, optional chaining in old engines,
   `fetch`/`AbortController`. Whether there is graceful degradation if the API is
   absent.
5. **Touch vs mouse.** Content/actions available only on `:hover` (tooltip, submenu,
   buttons in a row on hover) have a touch alternative; touch target sizes are
   sufficient (≥44×44px recommended, minimum ~24px) and not crammed together; no
   dependence on `mouseover`/`mouseout` without a `touch`/`pointer` equivalent;
   `pointer-events`/`touch-action` are correct for scrolling/gestures; a
   click-delay/double-tap zoom does not interfere (`touch-action: manipulation`).
6. **Viewport and orientation.** There is a correct `<meta name="viewport">`
   (without `maximum-scale=1`/`user-scalable=no` that blocks zoom — that is also an
   a11y issue); the layout survives a portrait↔landscape switch; the safe area
   (notch) on mobile is accounted for (`env(safe-area-inset-*)`).
7. **Forms and native controls.** Rendering and behavior differences between
   browsers: `<input type="date/time/color/range/number">` (in Safari/Firefox they
   look and work differently than in Chrome), `<select>` (native rendering differs),
   custom checkboxes/radios, `placeholder`, autofill, the virtual keyboard on mobile
   (keyboard type from `inputmode`/`type`), `accept`/`capture` on a file input on
   iOS.
8. **Media and formats.** Image formats with a fallback (`<picture>`/`srcset`:
   WebP/AVIF not everywhere; `<source>` order), video/audio codecs by browser
   (`<source type>` + fallback), fonts (`font-display`, woff2 formats, a fallback
   stack), icon fonts vs SVG.
9. **Performance on low-end mobiles.** Heavy animations/shadows/filters
   (`box-shadow`, `filter`, `backdrop-filter`) on a weak GPU; bundle/image size on a
   mobile connection; absence of layout thrashing; lazy loading of heavy content.
10. **Dark/light theme.** `prefers-color-scheme` is supported; no hardcoded colors
    that break the theme; no "flash" of the wrong theme on load; contrast is
    preserved in both themes.
11. **Zoom and text scaling.** 200% zoom and an enlarged system font size do not
    break the layout (`rem`/`em` units, not hard `px` for text); nothing is clipped.

## EDGE CASES THAT ARE OFTEN MISSED
- `gap` in a flex container — does not work in Safari < 14.1, the elements stick
  together.
- `100vh` on iOS Safari includes the address bar → the bottom part of the content is
  clipped; you need `100dvh`/`-webkit-fill-available`/JS.
- `:hover` menus/tooltips are completely inaccessible on touch — the functionality
  is lost on mobile.
- `<input type="date">` is rendered custom for Chrome, while in Safari/Firefox it
  looks different or shows the native picker — "the design drifted".
- `position: sticky` inside a container with `overflow` behaves differently in
  Safari.
- Autoprefixer does not add a prefix because the feature is outside the browserslist
  targets — while the real audience is broader than the targets.
- WebP/AVIF without a `<picture>` fallback → an empty square on old Safari.
- `backdrop-filter` without the `-webkit-` prefix does not work in Safari; without a
  fallback the background is unreadable.
- A "dead zone" between breakpoints (e.g. 768–900px) — laid out for 375 and 1440, in
  between things collide.
- Horizontal scroll of the whole body because of one element with `width: 100vw` +
  padding (the scrollbar not accounted for) or `min-width` on a grid item.
- `user-scalable=no` in the viewport — breaks zoom (accessibility) and sometimes the
  layout itself.
- The virtual keyboard on mobile covers the input field/submit button (no scroll to
  the active field).
- Dark theme: an icon/logo PNG on a transparent background becomes invisible.
- A JS error from an unsupported API (`structuredClone`, `Array.at`) takes down the
  whole screen only in an old browser — it does not reproduce in recent Chrome.
- `date`/`number` input: the input format and parsing depend on the OS and browser
  locale.

## SEVERITY SCALE
For each finding, state the specific browser/device/breakpoint.
- **Critical** — functionality is unavailable on a target browser/device (a JS error
  takes down the screen in Safari; the submit button is unreachable on mobile;
  content is fully clipped).
- **High** — a serious UX breakage on a target configuration: broken layout/
  collision on a key screen, horizontal scroll, a main scenario unreachable by
  touch, a critical feature with no fallback in a target browser.
- **Medium** — a noticeable but non-blocking problem: a cosmetic rendering
  difference, a suboptimal control on a secondary path, a problem at a boundary
  breakpoint.
- **Low** — best practice / a minor difference with no breakage scenario in the
  target matrix (no fallback for a browser outside the targets).

Verdict: compatible with the whole target matrix / compatible with caveats / not
compatible (list the blockers and on which browsers/devices).

## REPORT FORMAT
1. **Executive summary** (no jargon): does the interface work on the target browsers
   and devices, where it breaks, what to fix first.
2. **SCOPE and matrix** — the files/screens checked, the target browser/device/
   breakpoint matrix, what was left out of scope.
3. **One-line verdict** up front.
4. **Coverage matrix** — what was checked by a live run (which viewports/UAs/
   themes), what only by static analysis, and EXPLICITLY: what was NOT checked on a
   real engine (Safari/WebKit, Firefox/Gecko, real devices) — this is a limitation
   of emulation, not an omission.
5. **List of findings**: ID, file:line (and/or URL+element), browser/device/
   breakpoint, scenario, severity, recommendation; where appropriate — a short
   description/screenshot from the live run.
6. **What was done well** — strong responsive/fallback patterns worth replicating.
7. **Action plan**: blockers vs. deferred; separately — what requires manual
   verification on a real Safari/Firefox/device (BrowserStack/a real device), since
   emulation does not cover it.
8. **What was not checked** — limitations (no real WebKit/Gecko, no real devices,
   not all breakpoints, headless).

## RULES FOR WRITING UP FINDINGS
Before you start, check whether a report for this scope exists in
`docs/qa/cross-browser/` — if so, continue the ID numbering and update statuses
rather than recreating it.
For each finding:
- A stable ID: `XBROWSER-<scope-slug>-001`.
- file:line (and/or URL + element/selector).
- The specific browser/device/breakpoint and scenario: "on iOS Safari the bottom
  bar is clipped because of `height: 100vh` (line 42)" — not in the abstract.
- Severity with justification (where and what breaks).
- A concrete recommendation ("replace `100vh` with `100dvh` and a fallback", "add a
  `<picture>` with a JPEG fallback for WebP", "add a touch alternative to the hover
  menu", "add a `-webkit-` prefix to backdrop-filter").
Save the report to `docs/qa/cross-browser/<scope-slug>.md` (follow the existing
repository structure; `docs/qa/...` is the default).

## RUNNING IT (practical instructions)
1. Determine the SCOPE and target matrix YOURSELF in the main thread (see "Input") —
   do not delegate; a subagent does not see the conversation context. Determine the
   stack, the build targets, how to bring up the app, the URLs of the screens.
2. Check whether a previous report exists in `docs/qa/cross-browser/`.
3. Run PASS 1 (`npx browserslist`, compat linters, grep for nontrivial features +
   cross-check with caniuse logic, check the build's polyfill strategy).
4. Carry out PASS 2 (line-by-line review against the checklist) and PASS 3 (live
   run: emulation of breakpoints, mobile UA, dark theme, zoom, capturing console
   errors). Explicitly separate what was verified by emulation from what requires a
   real Safari/Firefox/device. If there are many screens and the Agent tool is
   available — split it across subagents by screen/breakpoint; give each one the
   concrete URLs/paths, the target matrix, the checklist, the severity scale, and
   the finding format (the subagent does not see this file). Write confirmed
   findings into an interim file.
5. Merge the three passes into the report, save to
   `docs/qa/cross-browser/<scope-slug>.md`.
6. Explicitly list what was not checked (especially real engines/devices).

This is testing, not implementation: fixes are made by the developer based on the
report, not by you within this skill.

