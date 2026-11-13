# 017. The debt a reviewer meets first
Status: ready
Executor: fast
Claim: an agent or a reviewer opening a reachable file meets no lint warning, no banned character and no `eval`, and the tour's suspected leak is measured.
Reference: `docs/FLAWS-2026-11.md` #18, #20, #22, #23.
Eval: `npx oxlint` on the files `scripts/audit-reach.mjs` lists as reached: warnings counted before and after, target 0; `git grep $'\u2014'` in `src`, `e2e`, `scripts`: 0; no `eval(` outside node_modules; the tour's filming screen opened 40 times in Chromium with heap measured after each, before and after any fix.
Baseline: about 310 warnings repository-wide; 59 files with an em-dash; 2 `eval`.
Scope: the reachable files only; the unreachable first application is left for David's decision on deletion (#19).
Stop: a warning whose fix changes behaviour is recorded, not fixed here.
Needs from David: nothing.
