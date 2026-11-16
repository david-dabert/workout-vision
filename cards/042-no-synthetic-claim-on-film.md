# 042. The filming screens show no figure measured on rendered bodies
Status: done (15 November 2026, branch `claude/042-no-synthetic-claim-on-film`; awaiting David on his iPhone, R3). One defect found by review left open, below.
Executor: careful
Claim: a person opening the filming screen or the exercise guide reads where to put the phone (the angle and the framing) and no accuracy figure, since the only figures behind that advice come from six rendered bodies per lift.
Reference: CLAUDE.md R8 (never display a number the app cannot measure reliably) and `src/components/experience/measures.js` (rendered bodies "bound the error in clean conditions and validate nothing"). Found by the review board's second opinion of 15 November 2026 (Black lens); removal ordered by David the same day ("adopt", item 5).
Eval: `npx vitest run src/components/experience/__tests__/filming-guide.test.jsx` and `e2e/filming-guide.spec.js`: the Film screen and the guide still show the angle and the framing, and their text contains none of « exactes », « Synthèse », « synthétique », "Synthetic", "synthetic" or a score out of 6. Fixed before any code.
Baseline: fails on main at `0ce3dc09` (card 041, #445, prints « Synthèse (0°) : 6/6 exactes … » under « Filmer ma série » and in the guide).
Scope: `filming-guide.js`, `Film.jsx`, `Guide.jsx`, their tests. The angle and framing labels and the layout stay; no counting file, no other screen.
Stop: if the angle or framing labels cannot stay without the figures, stop and ask David.
Needs from David: nothing; his iPhone check after merge (R3).

## Review (wv-reviewer, twice, 15 November 2026)

- Fixed: a catalogue variant picked in « Changer » got the framing of an unknown lift (a back squat told « tête aux hanches », 573 of 1296 catalogue ids against the screen's own step 2). The framing now follows the counting lift's joint. Test: `filming-guide.test.jsx`, "a catalogue variant of the « Changer » drawer".
- Open: the angle of 253 catalogue variants (variants of overhead_press, lateral_raise, pull_up and lat_pulldown) is « De profil » where their counting lift is filmed from the front. Fixing it on the filming screen alone made a #collecte set be saved with another view than the one the screen asked for (`Result.jsx` saves `filmView(lift)`, `phoneCollect.js` documents that view): reverted, and held by a test. It is fixed in `exercise-info.js` `filmView` or in `Film.jsx` and `Result.jsx` together, once Antigravity's claim on `Result.jsx` (card 038) is released.
