# 032. The load of each set, kept with its count
Status: done
Executor: fast
Claim: A lifter who saves a counted set can add its load in kilograms in one tap after saving, and the history and the records by load show it.
Reference: the competitor research of 14 November 2026: weight per set is the feature every log has (Hevy, Strong) and WorkoutVision keeps reps only. `src/components/experience/progress.js` already reads a positive `weight` in kg (`storedLoad`) and computes records by load, for manual sets only.
Eval, fixed before any code:
1. An e2e test on the production build (the journey's curl set): after the count is saved, a field « Charge (kg) » takes 60; the history row shows « 60 kg »; the record by load reads 60 kg; the export's « Charge (kg) » column holds 60 for that set. It fails on main today.
2. A set saved without a load stores no `weight` (no 0), as now.
3. `npm test`, `npm run typecheck`, `npm run lint`; visual snapshots updated only through the "Update visual snapshots" workflow, and only for screens this card changes.
4. Screenshots at 390x844 of the saved card, with and without a load.
Baseline: a counted set saves no load (`progress.js`: "the counted sets save none").
Scope: the saved card of `Result.jsx` (after the count is saved, never before it), `saved-set.js` (`weight`), the history row, `result-copy.js` (French in "vous", non-breaking space before ":"), tests. No estimated maximum, no change to counting.
Stop: if the load adds a tap before the count is saved, the design is wrong: the load is optional and comes after.
Needs from David: his check on the iPhone after merge (R3).
