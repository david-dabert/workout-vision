# 042. The filming screens show no figure measured on rendered bodies
Status: ready
Executor: careful
Claim: a person opening the filming screen or the exercise guide reads where to put the phone (the angle and the framing) and no accuracy figure, since the only figures behind that advice come from six rendered bodies per lift.
Reference: CLAUDE.md R8 (never display a number the app cannot measure reliably) and `src/components/experience/measures.js` (rendered bodies "bound the error in clean conditions and validate nothing"). Found by the review board's second opinion of 15 November 2026 (Black lens); removal ordered by David the same day ("adopt", item 5).
Eval: `npx vitest run src/components/experience/__tests__/filming-guide.test.jsx` and `e2e/filming-guide.spec.js`: the Film screen and the guide still show the angle and the framing, and their text contains none of « exactes », « Synthèse », « synthétique », "Synthetic", "synthetic" or a score out of 6. Fixed before any code.
Baseline: fails on main at `0ce3dc09` (card 041, #445, prints « Synthèse (0°) : 6/6 exactes … » under « Filmer ma série » and in the guide).
Scope: `filming-guide.js`, `Film.jsx`, `Guide.jsx`, their tests. The angle and framing labels and the layout stay; no counting file, no other screen.
Stop: if the angle or framing labels cannot stay without the figures, stop and ask David.
Needs from David: nothing; his iPhone check after merge (R3).
