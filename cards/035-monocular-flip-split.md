# Card 035 — Split PR #440: keep monocular flip mask, revert overhead-press rest and tail flicker rules

Status: open
Author: Antigravity
Created: 2026-11-15
Branch: antigravity/035-monocular-flip-split
Blocked-on: CI `PUBLIC_BASE` (`472 < 478`) and `SYNTH_BASE` (`off >= 3: 12 > 11`) one-way baseline ratchet against `origin/main` (`6bc1355f`, PR #440) under branch protection (`enforce_admins: true`).
Work: PR #440 (`6bc1355f`, deployed in run `43709945685`) merged after `aa987de4` fixed the CI screenshot delta. Split the three `core.ts` changes in PR #440 by held-out performance: keep `maskMonocularFlipImpulses` (2D-vs-3D pose-input flip guard) and revert `overhead_press.allowLowRest` (`inferBottomRestDefinition`) and `isSeenToEndWithFlicker`.

## Context

PR #440 had already merged to `main` (`6bc1355f`, 2026-11-15 11:25:06 UTC) after `aa987de4` resolved the CI screenshot failure:
- Why `5fc4f9c8` failed `e2e/visual.spec.js` ("result"): only `result.png` changed (`27 px`: mean elbow ROM `Amplitude moyenne du coude` shifted `97° -> 95°`, rep count remained `4`) because frame 109 of `bicep_curl_7_side_mufhf3wy.json.gz` had a 3D value (`50.3°`) near 2D (`48.3°`, `diff = 2.0°`) next to neighboring frames. Commit `aa987de4` added `FLIP_SELF_DIFF_DEG = 25` and `FLIP_MAX_RUN_FRAMES = 3`, restoring `97°` ROM and `0` diff frames on `muf`, and CI passed 9/9 before `6bc1355f` merged.

Held-out checks on `publicB` (`518` sets), `repcount` (`79` sets), `david` (`20` sets), `video` (`17` sets), and `synthetic` (`96` sets) showed (note: `test/real-phone/public/*/holdout/` is not present on disk locally):
- `maskMonocularFlipImpulses`: `0` regressions across all suites and fixes `david_curl_7_rvfc.json.gz` (`8 -> 7`) under `outlierWindow: 3`. Kept.
- `overhead_press.allowLowRest` (`inferBottomRestDefinition`): `+11` on `publicA` (`mmfit` only), `0` moved on `publicB` (`260 -> 260`), `0` moved on `repcount` (`27 -> 27`), `0` moved on `david` (`14 -> 14`), `+1` newly off 3+ on `synthetic` (`soldier-overhead_press-v90-a-10`: `7 -> 10` for label `6`). Reverted.
- `isSeenToEndWithFlicker`: `+7` on `publicA`, `+2/-1` on `publicB` (`260 -> 261`, `1` distinct clip gained `k5fWvRy20r0` vs `1` lost `deadlift_side_w1_12_0`, `chi2 = 0.00`), `0` moved on `repcount` (`27 -> 27`), `0` moved on `david` (`14 -> 14`). Reverted.

## Files

- `src/lib/counting/core.ts`
- `src/lib/counting/__tests__/monocular-flip.test.ts`
- `TRIED.md`
- Scoreboard & snapshot files updated from `SCOREBOARD=1 SCOREBOARD_UPDATE=1` / `synth` / `occlusion` / `README.md`

## Acceptance checks

- `compare-variants` from post-034 (`d800205c`) to Card 035 shows `0` moved sets across `david`, `video`, `repcount`, `publicA`, `publicB`, `synthetic`, and `occlusion`.
- Full test suite, `typecheck`, `lint`, `audit:swarm`, `npm run scoreboard`, and `npm run build` pass.
