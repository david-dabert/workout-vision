# 045. A catalogue variant is told the angle of the lift it counts as, and saved with that view
Status: ready
Executor: careful (Antigravity; Claude reviews before merge)
Phase: 1 (a defect; allowed by PLAN.md, THE FREEZE)
Claim: a person who picks a variant in « Changer » (for example « Développé militaire debout barre », `standing_barbell_overhead_press`) is told to film from the angle of the lift it counts as (« De face » for an overhead press), and a #collecte set filmed that way is saved with that same view.
Reference: card 042's open defect (`cards/042-no-synthetic-claim-on-film.md`, second review): 253 catalogue variants of overhead_press, lateral_raise, pull_up and lat_pulldown read « De profil » because `filmView` answers 'side' for any key it does not know. Fixing the screen alone made `Result.jsx` save another view than the screen asked for (`view: filmView(lift)`, `phoneCollect.js`).
Eval: in `src/components/experience/__tests__/filming-guide.test.jsx`, for every catalogue id (`getExercise`), the view Film shows (`filmingGuideFor(id, fr, counting_key).view`) equals the view `Result.jsx` saves for that id; `filmingGuideFor('standing_barbell_overhead_press', true, 'overhead_press').angleLabel` is « De face (0°) »; keys the guide or a card knows keep their own view. The test "the view a #collecte set is saved with is the view Film asks for" stays green. Fails on main today for the 253 ids.
Baseline: 253 of 1296 catalogue ids told « De profil » where their counting lift is filmed from the front (wv-reviewer's sweep, 15 November 2026).
Scope: `filming-guide.js`, `Film.jsx`, `Result.jsx`, one shared function for the view of an exercise, their tests. Not `exercise-info.js`'s other callers unless their tests stay green. No counting file.
Stop: if Film and Result cannot read one source for the view, stop and report on #190.
Needs from David: nothing; his iPhone check after merge (R3).
