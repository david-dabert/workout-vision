# 053. The home is the approved prototype plus two rows; one question per saved set
Status: ready (after 044)
Executor: fast (Antigravity)
Phase: 1 (removal only; WP5.1 of docs/SPEC-production.md, moved to Phase 1 by the board on 16 November 2026)
Claim: a first-time person finds an exercise and films it from a home of at most two screens; a saved set asks at most one question.
Reference: the production home measures 207 buttons and 19,615 px at 390x844 (about 23 screens), with five ways to pick an exercise; the prototype (`design/experience-prototype.html`) has the card rail and one row; a saved set can stack four questions (`Result.jsx:1057-1070`). Review panel of 16 November 2026, navigation lens.
Eval: an e2e on the production build at 390x844: the home has at most 12 controls and under 2 screens of height: the rail, « Reprendre », one « Trouver un exercice » with search first (guide, catalogue and list merged), « Vos séries », one row at the foot for pro, tests, manifesto and about; a saved set shows at most one question. The tour, and every patient and client link, still pass.
Scope: `Choice.jsx`, `Result.jsx`, their CSS and tests. Only removal and merging: no new screen, no new element.
Stop: if a removed route is reached by a link in use, keep it reachable and report on #190.
Needs from David: his iPhone check after merge (R3).
