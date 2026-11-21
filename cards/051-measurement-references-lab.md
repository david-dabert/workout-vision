# 051. Two references for measurement, in the lab
Status: done
Executor: fast (Antigravity, lab lane: no screen)
Phase: 1 (lab work; PLAN.md, THE FREEZE)
Claim: rep duration and the 2D joint angle each get an error measured against a truth, before any number returns to a screen.
Reference: review panel of 16 November 2026, biomechanics lens. RepCount-A's build half holds human rep boundaries used only for diagnosis (`match-reps.ts`); the synthetic renderer stores only world landmarks (`synth.js`), so no 2D angle was ever checked against truth (TRIED.md). RepCount-A's held-out half stays sealed (PLAN.md, THE DATA).
Eval: (1) rep duration against RepCount-A build boundaries: median and 90th percentile error printed, thresholds written here before the run (proposed 0.15 s and 0.3 s, UNSOURCED). (2) image landmarks stored by the renderer; 2D angle against the synthetic truth at the guided view, per lift (proposed 5 and 10 degrees, UNSOURCED). Results, pass or fail, into TRIED.md.
Scope: benches under `test/real-phone/`, the renderer's output field. No counting file, no screen, no sealed set.
Stop: when both are measured, pass or fail.
Needs from David: nothing.

## Results (21 November 2026, Antigravity)
1. Rep duration against RepCount-A build boundaries (`test/real-phone/accuracy/rep-duration-error.test.ts`, 79 mapped build sets, 601 matched reps):
   - Proposed thresholds: median <= 0.15 s, p90 <= 0.3 s (UNSOURCED).
   - Measured: median 0.500 s, 90th percentile 1.126 s, signed median -0.466 s (FAIL against proposed thresholds).
   - Per lift: bench_press med 0.901 s / p90 1.935 s; front_raise med 0.667 s / p90 1.209 s; pull_up med 0.401 s / p90 1.043 s; push_up med 0.510 s / p90 0.967 s; squat med 0.447 s / p90 0.901 s.
2. 2D angle against synthetic truth at guided view (`test/real-phone/synth/angle-2d-error.test.ts`, 24 sets, 7745 frames):
   - Proposed thresholds: median <= 5°, p90 <= 10° (UNSOURCED).
   - Measured: median 11.3°, 90th percentile 55.0°, signed median 1.8° (FAIL against proposed thresholds).
   - Per lift: lateral_raise (view 0°) med 4.8° / p90 14.0°; overhead_press (view 0°) med 10.9° / p90 30.4°; bicep_curl (view 90°) med 20.5° / p90 146.4°; squat (view 90°) med 23.7° / p90 74.9°.
3. Renderer output field updated: `test/real-phone/synth/synth.js` now stores `imageLandmarks: imageFrames` in `window.RESULT`.
