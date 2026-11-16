# 051. Two references for measurement, in the lab
Status: ready
Executor: fast (Antigravity, lab lane: no screen)
Phase: 1 (lab work; PLAN.md, THE FREEZE)
Claim: rep duration and the 2D joint angle each get an error measured against a truth, before any number returns to a screen.
Reference: review panel of 16 November 2026, biomechanics lens. RepCount-A's build half holds human rep boundaries used only for diagnosis (`match-reps.ts`); the synthetic renderer stores only world landmarks (`synth.js`), so no 2D angle was ever checked against truth (TRIED.md). RepCount-A's held-out half stays sealed (PLAN.md, THE DATA).
Eval: (1) rep duration against RepCount-A build boundaries: median and 90th percentile error printed, thresholds written here before the run (proposed 0.15 s and 0.3 s, UNSOURCED). (2) image landmarks stored by the renderer; 2D angle against the synthetic truth at the guided view, per lift (proposed 5 and 10 degrees, UNSOURCED). Results, pass or fail, into TRIED.md.
Scope: benches under `test/real-phone/`, the renderer's output field. No counting file, no screen, no sealed set.
Stop: when both are measured, pass or fail.
Needs from David: nothing.
