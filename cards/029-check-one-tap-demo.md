# 029. Check page one-tap bundled demo clips & rotation normalization
Status: done
Executor: quick
Claim: Add a one-tap bundled demo clip runner (`public/demo/*.mp4`) to `check.html` so iPhone Safari can run real decoded video benchmarks (count vs label, decoder, rotationDecision, pose coverage, timing, landmark SHA-256 fingerprint) without manual iOS gallery picking, while keeping all existing gallery rows and `?inject=frozen` intact and normalizing modulo-360 rotation metadata in `frameExtractor.js`.
Reference: Handover Phase 1.1 & Phase 1.3 (`check.html`, `frameExtractor.js`); R3, R8, R10.
Eval:
1. Unit tests (`src/lib/__tests__/rotation.test.js`, `src/lib/__tests__/check-pose.test.js`) pass including modulo-360 rotation cases and demo clip URL / summary helpers.
2. `npx playwright test e2e/check-inject.spec.js` passes all existing checks plus one-tap demo clip runner test.
3. Full `npm test`, `npm run typecheck`, `npm run lint`, `npm run check:css-tokens`, `npm run audit:swarm` pass with zero em-dashes.
Scope: `cards/029-check-one-tap-demo.md`, `check.html`, `src/check-main.js`, `src/lib/check.js`, `src/lib/frameExtractor.js`, `src/lib/__tests__/rotation.test.js`, `src/lib/__tests__/check-pose.test.js`, `e2e/check-inject.spec.js`.
Needs from David: Tap "Run all 5 bundled clips" on `/workout-vision/check.html` in iPhone Safari and copy/share the JSON readout to confirm real WebKit behavior on device (R3).
