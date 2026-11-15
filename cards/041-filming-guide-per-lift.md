# 041. Per-lift filming guide grounded in synthetic multi-angle truth
Status: done
Executor: quick
Claim: Surface per-lift camera placement (`0°` front vs `90°` side), body framing (`whole body` vs `head to hips`), and verified `test/real-phone/synth/synth.txt` evidence (`lateral_raise`, `overhead_press`, `bicep_curl`, `squat`, plus honest disclosure when an exercise has no multi-angle benchmark) on `Guide.jsx` and below the filming action on `Film.jsx`.
Reference: David's 15 November 2026 queue (renumbered from 040 to 041 after 039 collision shift); `test/real-phone/synth/synth.txt`, `src/components/experience/exercise-info.js`, R8, R9, R10.
Eval:
1. Unit tests (`src/components/experience/__tests__/filming-guide.test.jsx`) verify front `0°` for `lateral_raise`/`overhead_press`, side `90°` for `bicep_curl`/`squat`, framing rules, exact `synth.txt` figures, honest non-synthetic fallback for `bench_press`, and rendering on `Guide` and `Film`.
2. Playwright E2E test (`e2e/filming-guide.spec.js` at `390x844` FR) verifies per-lift placement and `synth.txt` note in `Guide` (`#exercises`) and `Film`, zero `layoutFaults`, and keeps `Filmer ma série` visible.
3. Full lint, typecheck, `audit:swarm`, unit suite, production build, and `check:entry-budget` pass.
Scope: `cards/041-filming-guide-per-lift.md`, `src/components/experience/filming-guide.js`, `src/components/experience/Guide.jsx`, `src/components/experience/Guide.css`, `src/components/experience/Film.jsx`, `src/components/experience/Film.css`, `src/components/experience/__tests__/filming-guide.test.jsx`, `e2e/filming-guide.spec.js`.
