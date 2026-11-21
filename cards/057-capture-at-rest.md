# 057. Filming starts and ends at rest
Status: done (lab lane, switch off in production)
Executor: fast (Antigravity)
Phase: 1 lab, 2 product (a new element on the filming screen waits for Phase 1's gate)
Claim: a set filmed in the app opens and closes still, so its first and last reps are never cut.
Reference: review panel of 16 November 2026, accuracy lens: most errors are one rep short (255 of 1,064 sets) and in 131 of 382 undercounted sets the video ends inside a rep (TRIED.md).
Eval: behind `measures.js` switch `CAPTURE_AT_REST` (off): a 3 s countdown; recording asks two still seconds before and after; auto-stop after 2 s of stillness. Unit tests on synthetic sets: the trimmed video begins and ends at rest. On real iPhone pose recordings (IMG_4186), verified rest-boundary detection with torso-invariant RMS displacement velocity.
Scope: `Film.jsx` live capture behind the switch, tests. No counting file.
Results:
- Created `src/lib/stillnessDetector.js`: computeMotionEnergy, StillnessDetector (2.0s streaming state machine), detectRestBoundaries.
- Added `CAPTURE_AT_REST = false` in `src/components/experience/measures.js`.
- Added rest-bounded visual indicator pill in `src/components/experience/Film.jsx` and styling in `Film.css` adhering strictly to design tokens.
- Unit tests in `src/lib/__tests__/stillnessDetector.test.js` (4 tests passing) and `src/components/experience/__tests__/film-capture-at-rest.test.jsx` (2 tests passing).
Stop: if stillness cannot be read before pose runs, stop and report.
Needs from David: nothing until Phase 2.
