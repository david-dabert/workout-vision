# 015. The kiné follow-up shows no clinical trend until one is proven
Status: ready
Executor: careful
Claim: a physiotherapist reads in the follow-up only what the app has measured, with no trend from an unproven engine.
Reference: `docs/FLAWS-2026-11.md` #6; METHOD.md gate 7.
Eval: read `clinicalTrendAnalysis.ts` first and write what it states and on how many sessions; then a test that the production follow-up renders no trend line while the engine has no eval, and a lab switch that brings it back.
Baseline: `FollowUp.jsx` imports the engine with no switch.
Scope: `FollowUp.jsx`, a switch in `measures.js`. The engine is not changed or deleted.
Stop: if the trend turns out to be a plain list of measured values, record it and close the card as done.
Needs from David: nothing.
