# 020. The screens show range and tempo only as far as their error allows
Status: ready (decided (b) by the board of 18 November 2026 on David's standing order of that day, PLAN.md; waits for Antigravity's card 050 to release Result.jsx)
Executor: careful
Claim: a person reads no range in degrees and no phase time in seconds that the app reads 20 % to 50 % short.
Reference: card 019 (`test/real-phone/synth/measures-error.txt`): at the guided view, range 19 degrees low at the median (36 at the 90th percentile), lifting and lowering times 0.5 s short at the median, on phases of about 1 s; R8 ("never display a number the app cannot measure reliably"); R16.
Eval: decided by David's choice among three, each with its own test on the production report and result screen:
(a) hide: `MEASURES_SHOWN = false`; the first word after a set (card 010) and the rep wave lose their numbers too, as they read range and tempo;
(b) relabel without numbers: the screens say how the reps compare with each other (the same, shorter, slower), never a value in degrees or seconds; the comparison within one set does not carry the one-sided bias;
(c) keep as now, under « Mesures expérimentales », with the measured error stated beside them.
Baseline: (c) is what ships.
Scope: `measures.js`, the screens that read it. No count changes.
Stop: none; it is a choice.
Decided: (b), by the board of 18 November 2026 (evidence skeptic seat: card 019's 19° median error, R8). Claude's recommendation was (b), because a comparison of reps within one set is what the measures can support, and the absolute values are what they cannot.
