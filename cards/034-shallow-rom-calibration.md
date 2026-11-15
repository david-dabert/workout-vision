# Card 034: Calibrate shallow-ROM floors per lift (squat, lateral raise, push-up)

Status: done
Lane: fast
Owner: Antigravity
Created: 2026-11-15

## Goal
Improve rep detection on shallow-range squats, lateral raises, and push-ups without triggering the global `MIN_ROM_DEGREES` regressions seen on bicep curls (`soldier-bicep_curl-v60-a-10`) and overhead presses (`michelle-overhead_press-v90-*` range error `> 30` deg).

## Changes
- `src/lib/counting/core.ts`:
  - `LIFTS.squat`: add `minRangeDeg: 15, minRepRomDeg: 15` (`Source: UNSOURCED`, `Status: experimental`).
  - `LIFTS.lateral_raise`: add `minRepRomDeg: 15` (`Source: UNSOURCED`, `Status: experimental`).
  - `DETECTION.push_up`: add `minRangeDeg: 15` to match its existing `minRepRomDeg: 15` (`Source: UNSOURCED`, `Status: experimental`); `batchCollect.js` `mismatchFloor` reads `liftDefinition(lift)?.minRangeDeg`, keeping collector warnings aligned.
- `src/lib/__tests__/batchCollect.test.js`: update `mismatchFloor` expectations for `squat` (`15`) and `bicep_curl` (`MISMATCH_RANGE_DEG`).
- `src/lib/counting/__tests__/lift.test.ts`: assert `15`-degree shallow-ROM configuration for `squat`, `lateral_raise`, and `push_up`.
- Updated `test/real-phone/synth/synth.txt`, `test/real-phone/synth/measures-error.test.ts` (`91` measured sets), `test/real-phone/synth/measures-error.txt`, `test/real-phone/accuracy/public-scoreboard.txt`, `test/real-phone/accuracy/public-baseline.json`, `README.md`, and `TRIED.md`.

## Verification
- `npm run synth`: `96` sets, `76 exact (79 %)`, `12 off >= 3`, `range error mean -30 deg` (up from `74` exact, `13 off >= 3`; measured sets `90 -> 91`).
- `npm run scoreboard`: `13/15` deciding exact, `0` moved, `0` newly catastrophic.
- `SCOREBOARD_UPDATE=1 npm run scoreboard:public` & `PUBLIC_BASE=test/real-phone/accuracy/public-baseline.json npm run scoreboard:public`: `472` deciding exact (up from `468`, `+4` gained / `0` lost, `0` became off by 3+).
- `scripts/compare-variants.mjs`: `david` `14->14` (`0` lost), `video` `12->12` (`0` lost), `publicA` `259->261` (`+2/-0`), `publicB` `258->260` (`+2/-0`), `synthetic` `74->76` (`+2/-0`), `occlusion` `27->30` (`+3/-0`), `VERDICT: ships under the net rule`.
