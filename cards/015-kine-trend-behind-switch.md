# 015. The kiné follow-up shows no clinical trend until one is proven
Status: in review
13 November 2026 (Claude): read first, as the eval asks. `computeClinicalTrend` needs 2 sessions or more with a share within tolerance; it averages each session's shares, subtracts the first session's mean from the last's (in points), and names a trajectory from that one difference: 10 or more ACCELERATED, 3 or more PROGRESSING, -3 to 3 STABILIZED, below REGRESSING, with a cause it does not measure (« fatigue neuromusculaire », « contrôle moteur »). Thresholds unsourced, no eval. Not a plain list of measured values, so the stop condition does not hold. The badge also showed the English word (ACCELERATED) on the French screen. Eval `followup-no-trend.test.jsx`: 2 of 3 failed on main (the trend renders in French and English), 3 of 3 pass after. Switch `CLINICAL_TREND_SHOWN = false` in `measures.js`. The measured line « de … à … » and each session's rows stay.
Executor: careful
Claim: a physiotherapist reads in the follow-up only what the app has measured, with no trend from an unproven engine.
Reference: `docs/FLAWS-2026-11.md` #6; METHOD.md gate 7.
Eval: read `clinicalTrendAnalysis.ts` first and write what it states and on how many sessions; then a test that the production follow-up renders no trend line while the engine has no eval, and a lab switch that brings it back.
Baseline: `FollowUp.jsx` imports the engine with no switch.
Scope: `FollowUp.jsx`, a switch in `measures.js`. The engine is not changed or deleted.
Stop: if the trend turns out to be a plain list of measured values, record it and close the card as done.
Needs from David: nothing.
