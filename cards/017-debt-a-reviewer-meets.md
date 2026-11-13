# 017. The debt a reviewer meets first
Status: ready (three of four parts merged in #404, 13 November 2026; left: the tour's suspected leak, #18)
13 November 2026 (Claude), on David's order "Fix the remaining problems and issues". Em-dashes in `src`, `e2e`, `scripts`: 21 lines in 13 files before, 0 after (prose rewritten; where the dash is data, a UI check, a published title or a table placeholder, it is written `\u2014`, so output is unchanged). `eval(`: 2 before, 0 after (`e2e/shared/report.tests.js` passes `layoutFaults` to `page.evaluate`; `test/real-phone/synth/smoke.mjs` hands axe's source to Playwright; an inline script was refused by the page's Content-Security-Policy). Lint on the 304 reached files: 128 warnings before, 64 after; no-unused-vars 64 to 0 and 20 catch bindings among them; dead functions removed: 7, none called. Left under the stop rule, because their fix changes behaviour: refs read during render 29, components and constants exported from one file 14, effect dependencies 11, state set in an effect 8, impure render 1, a module variable reassigned in Choice.jsx 1. Scoreboards before and after: no output changed. Left: the tour's suspected leak (#18), heap over 40 openings of the filming screen.
Executor: fast
Claim: an agent or a reviewer opening a reachable file meets no lint warning, no banned character and no `eval`, and the tour's suspected leak is measured.
Reference: `docs/FLAWS-2026-11.md` #18, #20, #22, #23.
Eval: `npx oxlint` on the files `scripts/audit-reach.mjs` lists as reached: warnings counted before and after, target 0; `git grep $'\u2014'` in `src`, `e2e`, `scripts`: 0; no `eval(` outside node_modules; the tour's filming screen opened 40 times in Chromium with heap measured after each, before and after any fix.
Baseline: about 310 warnings repository-wide; 59 files with an em-dash; 2 `eval`.
Scope: the reachable files only; the unreachable first application is left for David's decision on deletion (#19).
Stop: a warning whose fix changes behaviour is recorded, not fixed here.
Needs from David: nothing.
