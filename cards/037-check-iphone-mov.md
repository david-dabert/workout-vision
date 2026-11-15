# 037. Phase 1 decisive test on check.html (5 MP4 + 10 iPhone MOV)
Status: done
Executor: quick
Claim: Add the 10 iPhone-encoded `.mov` demo clips (`public/demo/iphone/*.mov` from `origin/claude/iphone-read`) alongside the 5 existing `.mp4` demo clips on `check.html` (15 bundled rows total). Report explicit `count`, `samples read`, `decoder path` (+ fallback), `rotation decision`, and `pose coverage` per row and in the copied JSON report, and classify undecodable formats cleanly as `not decodable here` in Chromium without aborting the 15-clip run.
Reference: David's 15 November 2026 direction (Phase 1 decisive test); `cards/029-check-one-tap-demo.md`; R3, R8, R10.
Eval:
1. Unit tests (`src/lib/__tests__/check-pose.test.js`) verify 15 `DEMO_CLIPS`, `poseCoveragePct`, `isUndecodableError`, `formatDemoEntry`, and `demoVerdictText`.
2. `npm run build:e2e && npx playwright test e2e/check-inject.spec.js` verifies all 15 rows, MP4 readout fields, Chromium `.mov` `not decodable here` handling, and JSON clipboard export schema.
3. Full lint, typecheck, `audit:swarm`, unit suite, production build, and `check:entry-budget` pass.
Scope: `cards/037-check-iphone-mov.md`, `public/demo/iphone/*.mov`, `src/lib/check.js`, `src/check-main.js`, `src/lib/__tests__/check-pose.test.js`, `e2e/check-inject.spec.js`.
Needs from David: Open `/workout-vision/check.html` on iPhone Safari, tap `"Run all 15 bundled clips"`, and share the JSON report to compare Safari WebCodecs/RVFC decoding across `.mp4`, upright `.mov`, and rotated `.mov` (R3).
