# 052. One analysis configuration, checked by the type checker
Status: ready
Executor: careful (Antigravity; Claude reviews before merge)
Phase: 1 (a defect)
Claim: the analysis runs the values the type checker checks.
Reference: `src/lib/analysisConfig.js:130` `GHOST_DECAY_START = 2` against `analysisConfig.ts:126` `= 5`; Vite bundles the `.js`, `tsc` checks the `.ts`. Review panel of 16 November 2026, architecture lens.
Eval: one file remains, holding the values the app runs today (2 here), imported everywhere; `npm run typecheck` checks it; scoreboard, public scoreboard and synth unchanged (R2), pasted before and after.
Scope: the two files and their importers. No value changes.
Stop: if any scoreboard moves, stop and report on #190.
Needs from David: nothing.
