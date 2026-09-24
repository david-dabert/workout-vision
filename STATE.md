# STATE

Current phase: 0 (Stabilise the live app)
Last known-good commit: 4cad6df
Live commit: b31bdba (revert to 4cad6df state)
Launch lifts: dumbbell bench press, biceps curl, lateral raise, shoulder press, lat pulldown
French register: to be decided by David
Open problems: app may still crash on iPhone during analysis (to be tested in step 0.3)
Next step: Phase 0, step 0.3 — David tests on iPhone: clear site data, analyse same 60s clip 3 times, open Guide and Coach report
Tester criteria (Phase 7): not yet defined

## Real-phone baseline (2026-09-24)

Date: 2026-09-24
Branch: truth-set
Engine: Playwright Chrome channel (WebKit unavailable; installed webkit-2272, Playwright 1.63 needs webkit-2359)
Results file: benchmark/results/real-phone-2026-09-24.json
Prompt A / iPhone exit test: no evidence found in git log, branches, or STATE.md

### MEASUREMENT 1 — Counter only (landmarks extracted via app pipeline, counter run offline)

| Clip | Exercise | View | Expected | Counted | Error | Method | Frames |
|------|----------|------|----------|---------|-------|--------|--------|
| bench_press_7_angle | bench_press | angle | 7 | 6 | -1 | valley:wrist_Y_L_inv | 203 |
| bicep_curl_7_side | bicep_curl | side | 7 | 11 | +4 | valley:wristShoulderDist3D_R_inv | 341 |
| lat_pulldown_10_front | lat_pulldown | front | 10 | 11 | +1 | period-confirmed:primary | 600 |
| lateral_raise_10_front | lateral_raise | front | 10 | 11 | +1 | period-up:wrist_Y_L | 439 |
| overhead_press_10_front | overhead_press | front | 10 | 12 | +2 | period-up:wrist_Y_L | 548 |

Exact: 0/5 (0%) | Within +-1: 3/5 (60%) | MAE: 1.80

### MEASUREMENT 2A — App UI, manual exercise selection

| Clip | Exercise | Expected | App shows | Error | Form | Time(s) | Status |
|------|----------|----------|-----------|-------|------|---------|--------|
| bench_press_7_angle | bench_press | 7 | -- | -- | -- | 30.0 | INSUFF (quality gate refusal) |
| bicep_curl_7_side | bicep_curl | 7 | -- | -- | -- | 31.6 | INSUFF (quality gate refusal) |
| lat_pulldown_10_front | lat_pulldown | 10 | 11 | +1 | 12 | 29.2 | OK |
| lateral_raise_10_front | lateral_raise | 10 | -- | -- | -- | 39.1 | INSUFF (quality gate refusal) |
| overhead_press_10_front | overhead_press | 10 | -- | -- | -- | 33.1 | INSUFF (quality gate refusal) |

Completed: 1/5 (20%) | Refused by quality gate: 4/5

### MEASUREMENT 2B — App UI, Automatic detection

| Clip | True exercise | Detected as | Reps | Time(s) | Status |
|------|---------------|-------------|------|---------|--------|
| bench_press_7_angle | bench_press | Thruster | 11 | 30.4 | identification failure |
| bicep_curl_7_side | bicep_curl | Leg Press | 17 | 31.1 | identification failure |
| lat_pulldown_10_front | lat_pulldown | Chest-Supported Row | -- | 29.3 | identification failure + INSUFF |
| lateral_raise_10_front | lateral_raise | Chest-Supported Row | -- | 38.6 | identification failure + INSUFF |
| overhead_press_10_front | overhead_press | Deadlift | 16 | 32.8 | identification failure |

Correct identification: 0/5 (0%)

### Failure classification

| Clip | Failure type | Detail |
|------|--------------|--------|
| bench_press (manual) | pipeline | Quality gate refusal: "Video quality insufficient for reliable scoring" |
| bench_press (auto) | identification | Detected as Thruster instead of Bench Press |
| bicep_curl (manual) | pipeline | Quality gate refusal |
| bicep_curl (auto) | identification | Detected as Leg Press instead of Bicep Curl |
| lat_pulldown (manual) | count | Right exercise, wrong count: 11 vs 10 expected (+1) |
| lat_pulldown (auto) | identification | Detected as Chest-Supported Row instead of Lat Pulldown |
| lateral_raise (manual) | pipeline | Quality gate refusal |
| lateral_raise (auto) | identification | Detected as Chest-Supported Row instead of Lateral Raise |
| overhead_press (manual) | pipeline | Quality gate refusal |
| overhead_press (auto) | identification | Detected as Deadlift instead of Overhead Press |
| bench_press (counter-only) | count | Right exercise (forced), wrong count: 6 vs 7 expected (-1) |
| bicep_curl (counter-only) | count | Right exercise (forced), wrong count: 11 vs 7 expected (+4) |
| lat_pulldown (counter-only) | count | Right exercise (forced), wrong count: 11 vs 10 expected (+1) |
| lateral_raise (counter-only) | count | Right exercise (forced), wrong count: 11 vs 10 expected (+1) |
| overhead_press (counter-only) | count | Right exercise (forced), wrong count: 12 vs 10 expected (+2) |
