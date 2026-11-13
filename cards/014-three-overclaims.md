# 014. No screen claims more than the app measures: the last three
Status: done (awaiting David on his iPhone, R3)
Merged 13 November 2026: #395 (8193cff6) on green CI; the snapshot workflow changed no picture. Eval `e2e/three-overclaims.spec.js`, three real curls saved on the production build: fails on main before, passes after. Found: the quiz offer read `knownSets()` in render and showed only after a later redraw.
Executor: fast
Claim: a person sees no femur ratio or calorie promise after their third set, no "Mocap" on a one-camera estimate, and no bar path on a set without a bar.
Reference: `docs/FLAWS-2026-11.md` #2, #3, #4; R8; R16 (joint angles are held against optical motion capture).
Eval: a browser test on the production build: after three saved sets, no `open-retention-quiz-btn`; the report button carries no "Mocap"; on a curl's replay no « Trajectoire de la barre ». Each fails on main today.
Baseline: all three present on main at 7963ba48.
Scope: `Result.jsx`, `Replay.jsx`, `MocapViewer.jsx` copy. The quiz moves behind `showUnmeasuredRoutes()`; the badge reads what the report holds; the bar path shows only for lifts with a bar. Nothing deleted.
Stop: if a picture test changes beyond the result screen, stop and record it.
Needs from David: nothing; his iPhone to call it done (R3).
