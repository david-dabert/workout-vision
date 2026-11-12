# 013. The production build shows nothing built on the readings that were switched off
Status: ready
Executor: careful
Claim: a person who films a set and opens its report, or the home, sees no prescription, no score and no body reading that the app has not measured (R8, gate 7).
Reference: `src/components/experience/measures.js`, `UNVALIDATED_BIOMECHANICS_SHOWN = false` (David, 11 November 2026), and the three findings of `docs/AUDIT-2026-11.md`.
Eval: a browser test on the production build (`npm run build`), at 390x844: (1) the session report of a filmed demo set contains no element of `sheet.optimization` (prescription, limiting factor, optimisation metrics, coaching points, `.bvh` button) and its PDF none of them; (2) the home has no `choice-athlete-profile` row; (3) `#equine`, `#veterinary`, `#sports` and the eight sport addresses return to the home. Each of the three fails on main today.
Baseline: from the audit of 12 November 2026, read in the code; (3) opened in the production build of `ed1aa79e`: `#equine` and `#golf` open.
Scope: the gates in `report-sheet.js`, `Choice.jsx` and `App.jsx`, behind the existing switches (`UNVALIDATED_BIOMECHANICS_SHOWN`, `showUnmeasuredRoutes()`). No engine changed, nothing deleted. The extended build (`VITE_EXTENDED_ROUTES=1`) keeps all three.
Stop: if a picture test changes for a reason other than the three, stop and record it.
Needs from David: nothing to build it; his iPhone to call it done (R3).
