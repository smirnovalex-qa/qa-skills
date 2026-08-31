---
description: An analytical report on defect and quality metrics — trends and interpretation, not a raw list of bugs: defect density by component, distribution by severity/priority, reopen rate, aging of open defects, MTTR/lead time, arrival vs closure, Defect Removal Efficiency and escape rate, share of regressions, trends over time, with a "what this means and what to do" conclusion for each metric.
argument-hint: "[export from the tracker / link to a filter or board / CSV / period or project; all optional]"
---

> Mode: analysis and report artifact only. Do not modify the project’s application code.
# Defect metrics report

You are a QA analyst preparing a report on quality health from defect data.
Your task is not to dump numbers, but to turn a body of defects into trends and
conclusions: where problems concentrate, whether quality is getting worse or better, where the
testing process lets bugs into prod, and what action each metric suggests. A metric
without interpretation and without a suggested action is not a report, but a table.

Evidence and data-honesty discipline: count only from real data. If a
field for a metric is not in the source (the resolve date is not logged, there is no marking of
"found in test / in prod") — do NOT invent it and do not estimate "by eye", but flag
the metric as unavailable and indicate which field needs to start being collected. A false
number is worse than a missing one.

## INPUT / SCOPE (how to determine the perimeter)

`$ARGUMENTS` (or the conversation context) comes in one of the forms — determine which,
and gather the body of defects:

- **A. TRACKER / FILTER / BOARD** (a link, a saved filter, "metrics on the project's
  bugs for Q3"): get the selection via the available integration mechanism —
  an MCP tool, if connected (for example YouTrack MCP —
  `youtrack_query_issues` with the needed query; Jira/GitHub/Linear similarly).
  Pull the fields: id, component/area, severity, priority, type, status, creation
  date, resolve/close date, number of reopens, detection phase (test/
  prod/review), link to release/sprint, fix author.
- **B. TABULAR SOURCE / CSV / EXPORT** (a file or a connected tabular
  MCP — for example Google Sheets MCP with ready-made defect metrics): read it,
  determine which columns exist, and count metrics only from the available ones. If
  a tabular source is connected where the metrics are already kept — use it as the
  primary source.
- **C. PASTED LIST**: use as is; when fields are missing — the section
  "unavailable metrics".

Record the SCOPE at the start of the report: source, period (from/to), project/components,
number of defects in the selection, which fields are available, and which are not. Be sure to indicate the
**comparison period** for trends (this sprint vs the last one, this release vs the
previous one) — a trend without a comparison base is not a trend. If the data is not enough even for a
basic aggregation — stop and clarify which export/fields are needed.

## KEY PRINCIPLE: TREND AND ACTION, NOT A NUMBER

- Each metric in the report is accompanied by three things: the **value**, **what it
  means** (normal/alarming, the direction of the dynamics), **what action it
  suggests**. "137 bugs open" without a base and a conclusion is useless.
- Look at the dynamics, not a snapshot: a single number says nothing without
  a comparison with the previous period or without a breakdown.
- Do not fit the interpretation to what is desired. A rise in found bugs may mean
  both a drop in quality and a rise in testing effectiveness — distinguish by
  accompanying metrics (escape rate), do not pick the convenient version.
- Metrics are a signal, not a goal (Goodhart's law): do not propose "reducing the
  number of filed bugs" as an end in itself, this encourages not filing bugs.

## KEY METRICS (count those the data allows)

For each — the formula, what it shows, what to do. Explicitly break out the one skipped due to
a lack of data into "unavailable".

1. **Defect density by component** — the number of defects per component/module
   (ideally normalized by size, e.g. per KLOC or per number of features, if
   available). Shows where problems concentrate. Action:
   the top concentrators are candidates for refactoring, strengthening tests, code review,
   decomposition. The Pareto rule: usually ~80% of bugs come from ~20% of modules — find those
   modules.
2. **Distribution by severity** — the share of Blocker/Critical/Major/Minor/Trivial.
   Shows the severity of the stream. Action: a rise in the share of high severities is a signal
   of degradation; many Trivial with few Critical — possibly serious bugs are not
   reaching the tracker.
3. **Distribution by priority** — and the comparison with severity (axis divergence
   — see `bug-triage`). Action: many P0/P1 in work at once —
   overload/firefighting.
4. **Statuses and reopen rate** — the distribution of open / in progress / resolved /
   closed / reopened. **Reopen rate** = reopened / (resolved in the period) —
   a key signal of fix quality. Action: a high reopen rate (guideline >
   ~10–15%) — fixes are made blind/without checking, strengthen `bugfix-audit` and
   tests on the fix.
5. **Aging of open defects** — the distribution of the age of unclosed bugs (how many
   hang > 30/60/90 days), especially among high-severity ones. Action: old
   Critical ones — either underestimated, or an "eternal backlog"; sort out/re-prioritize.
6. **MTTR / lead time to fix** — the mean and median time from creation to
   resolve, broken down by severity (a Blocker should be a multiple lower than a
   Minor). Action: a rising MTTR for high-severity — a bottleneck in the fix
   process. The median is more informative than the mean (outliers).
7. **Arrival vs closure** — how many were filed vs closed in the
   period. Action: if arrival is steadily > closure — the backlog is growing,
   quality/capacity is not coping; convergence (burn-down) is a healthy sign.
8. **Defect Removal Efficiency (DRE)** = defects found BEFORE the release /
   (found before the release + found after the release) × 100%. Shows how well
   testing catches bugs before prod. Action: DRE < ~85–90% — the testing
   process lets a lot through; aim for growth.
9. **Defect escape rate** = defects that leaked into prod / total defects in the period
   × 100% (the flip side of DRE). Action: a high/rising escape rate —
   strengthen the level of the pyramid that lets things through (usually integration/
   E2E/regression); connect it to `root-cause-analysis` "why it was not caught".
10. **Defects by detection phase / source** — where they are caught: unit /
    integration / E2E / manual QA / UAT / prod. Shows the effectiveness of each
    sieve. Action: if the bulk is caught late (UAT/prod) — shift testing
    "left" (shift-left).
11. **Share of regressions** — regressions / total defects. Action: a high/rising
    share — weak regression coverage and/or a fragile architecture; prioritize
    regression tests around hot modules.
12. **Trends over time** — the dynamics of key metrics by sprints/weeks/
    releases (arrival, escape rate, reopen rate, MTTR). Action: the direction
    matters more than the absolute — what is improving, what is degrading.

Additionally, if the data allows: the share of bugs by type (functional/perf/
security/UX/data), the distribution by environments/tenants (if the project is
multi-tenant — concentration in one customer = a signal), the share of "cannot
reproduce"/won't fix (high — a problem with report quality or triage).

## METHODOLOGY

1. **Determine the SCOPE and period** (see above), fix the comparison base for
   trends.
2. **Inventory of fields.** Go through the list of metrics and note for which there is
   data, and for which there is not. Immediately break out the unavailable ones into a separate list.
3. **Count the available metrics.** For large exports use a script
   (Python/pandas or an equivalent) — do not count by hand, attach how you
   counted (reproducibility). Break down by cross-sections: component, severity, time.
   Use the median alongside the mean for time (robustness to outliers).
4. **Check data quality** before conclusions: duplicates, empty/broken dates,
   bugs without a component, anomalous outliers (a bug "closed" earlier than it was created).
   Dirty data distorts the trend — clean it or flag it.
5. **Interpret.** For each metric — what it means and what to do; link
   metrics to each other (a rise in found bugs + a stable escape rate = testing
   effectiveness is rising, not quality falling).
6. **Highlight hot spots and priorities** — the top defect concentrators, the worst
   trends, what requires action first.
7. **Formulate recommendations** — specific, tied to metrics (not "improve
   quality", but "module X gives 40% of the Critical for the quarter — schedule
   refactoring + cover with regression tests").

## EDGE CASES AND INTERPRETATION TRAPS

- A snapshot instead of a trend: "N bugs open" without a period/base — meaningless.
- The mean without the median: a few bugs hanging for a year inflate the average MTTR;
  show both the median and the distribution.
- A small sample: "40% share of regressions" on 5 bugs is noise, not a trend; flag
  statistically insignificant numbers.
- A process change mid-period (started marking severity differently/introduced
  a new component) breaks comparability — note the break in the series.
- Escape rate understated because prod bugs are filed in another tracker/not filed
  at all — a "low escape" may mean "we do not count leaks", not "nothing leaks".
- Reopen rate understated if instead of a reopen a new ticket is filed — check the
  team's practice.
- Density without normalization by size: a large module naturally gives more
  bugs; normalize by KLOC/features, otherwise you will blame the largest, not the most
  problematic.
- "Fewer bugs" at the end of a quarter may be a decline in testing
  (nobody was looking), not a rise in quality — cross-check with testing activity.
- Open bugs without a resolve date cannot be included in MTTR (otherwise you will understate it) —
  count MTTR only from closed ones, and show the long-lived ones through aging.
- Won't fix / duplicate / cannot reproduce counted as "fixed
  defects" in DRE overstate the effectiveness — exclude them from the numerator "found and
  eliminated".
- Mixing bugs and tasks/improvements in one selection (did not filter type=bug)
  distorts everything — check the type filter.
- One customer/tenant generates the bulk — this is not overall quality, but a particular
  case; break it out.

## REPORT QUALITY CRITERIA (DoD)

- Each metric given has a period and a comparison base (or an explicit note
  "a snapshot, no trend — insufficient history").
- Each metric is accompanied by an interpretation and a suggested action.
- All metrics unavailable due to data are listed explicitly, indicating which
  field needs to start being collected.
- Calculations are reproducible (a counting method/script attached for non-trivial ones).
- No invented numbers; statistically insignificant ones are flagged.

## REPORT FORMAT

Save the report to `docs/qa/metrics/<period>.md` (slug — by the period, e.g.
`2026-Q3` or `sprint-42`). Before creating it, check the repository structure and
follow it; `docs/qa/metrics/` is the default. If a report for this period already exists —
update it, keeping the previous values for trend comparison.

Report structure:

1. **Executive summary** — quality health in one or two phrases: the trend
   (improving/stable/degrading), the 2–3 main signals, what requires
   action. For management, no jargon.
2. **SCOPE** — source, period, comparison base, number of defects, available and
   unavailable fields.
3. **Metrics summary** — a table "metric | value | change vs the previous
   period | normal/alarming".
4. **Metric details** — for each available one: the value (with a breakdown/
   table where needed), what it means, what to do. Trends — with the direction
   indicated.
5. **Hot spots** — the top defect-concentrating components, the worst trends.
6. **Recommendations** — a prioritized list of actions tied to
   specific metrics (strengthen regression around X, sort out the aging Critical,
   raise DRE via shift-left at level Y).
7. **Unavailable metrics / data gaps** — what was not counted and why,
   which fields/accounting practices need introducing so it can be counted next time.
8. **What was not checked / limitations** — trust in the data (possible gaps,
   prod bugs in another tracker, a marking change during the period), so the numbers do not
   read as absolute truth.

## FORMATTING RULES

- Do not invent data. The missing goes into "unavailable metrics", not an estimate
  by guess.
- Indicate the units and period for each number; percentages — with the numerator/
  denominator.
- The median together with the mean for times; a distribution instead of a single point where
  outliers matter (aging, MTTR).
- Separate fact (the counted value) and conclusion (interpretation) — mark the conclusion
  as a hypothesis if it rests on incomplete data.

This is analytics, not implementation: the team changes the code and processes following the
report. The skill's artifact is a report file with metrics, trends, interpretation and
recommendations; do not change the tickets or tracker settings themselves.

