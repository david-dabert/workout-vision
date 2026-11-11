# 008. The home page offers only what exists
Status: ready
Executor: fast
Claim: a newcomer scrolling the home page meets nothing the app cannot do today.
Reference: the walk of 11 November 2026: under "En préparation et nouvelles disciplines" the production home lists "EquiVision : biomécanique équine" and "Atelier multisport" (`Choice.jsx`), which measure nothing.
Eval: a test that renders the home with the extended-routes flag off and finds neither `choice-equine` nor the multisport row, and finds both with the flag on.
Baseline: both shown in production.
Scope: `Choice.jsx` and where it is given `onEquine` and `onSports`. Nothing deleted: the rows move behind `showUnmeasuredRoutes()` (METHOD.md, lab lane). The manifesto row stays.
Stop: none.
Needs from David: nothing. He may turn the flag on for a demonstration build.
