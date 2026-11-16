# 057. Filming starts and ends at rest
Status: ready (lab lane, switch off in production)
Executor: fast (Antigravity)
Phase: 1 lab, 2 product (a new element on the filming screen waits for Phase 1's gate)
Claim: a set filmed in the app opens and closes still, so its first and last reps are never cut.
Reference: review panel of 16 November 2026, accuracy lens: most errors are one rep short (255 of 1,064 sets) and in 131 of 382 undercounted sets the video ends inside a rep (TRIED.md).
Eval: behind `measures.js` switch `CAPTURE_AT_REST` (off): a 3 s countdown; recording asks two still seconds before and after; auto-stop after 2 s of stillness. Unit tests on synthetic sets: the trimmed video begins and ends at rest. On the sealed pool, exact share of sets opened and closed at rest against the others, reported, never used to tune.
Scope: `Film.jsx` live capture behind the switch, tests. No counting file.
Stop: if stillness cannot be read before pose runs, stop and report.
Needs from David: nothing until Phase 2.
