# 025. A bench press the app cannot read is asked, not counted
Status: ready
Executor: careful
Claim: David, filming a bench press from an angle the pose cannot follow, is asked to confirm a count instead of being told a wrong one.
Reference: David's set of 14 November 2026 (`test/real-phone/sets-14nov-video/dumbbell_bench_press_9_angle`, label 9, read 16) and his stored bench press of 1 October (`landmarks/bench_press_7_angle_mufhcy60`, refused); R8 ("when confidence is low, the app asks the user to confirm"); R16.
Eval: fixed 14 November 2026 before any code. Pass, all at once: on the 14 November set, the app does not show its count as sure (`sure.ts`, as the app ships); on every set of David's that decides (15) and his real videos (17), no set shown as sure today becomes asked, and no count changes (R2: `npm run scoreboard` before and after, per-clip diff); on the public sets, the sure set's exact rate does not fall and its sets off by 3 or more do not grow (`npm run scoreboard:public`).
Baseline: the 14 November set read 16 and shown as sure (to be confirmed with `sure.ts` on the stored landmarks before any code).
Scope: the sure check (`sure.ts` and the gate it reads), its test, TRIED.md. The counter's count is not changed. Candidate signals, measured before choosing: the regularity of the counted reps' timing against the set's own period (PSC or the motion rhythm), the share of the counted joint's samples the pose model sees with low visibility, the angle's spread inside a rep against its range.
Stop: if no candidate passes on these sets, record each in TRIED.md and set the card to failed; a bench press from an angle then stays a lift the filming guide steers to a side view.
Needs from David: nothing. More bench sets filmed from an angle, with his count, would make the eval stronger.
