# 016. The accuracy figure is measured on the gate that ships
Status: done (#396, #398)
First part, 13 November 2026 (Claude): `sure.ts` decides sure as the result screen does; parity eval `sure-parity.test.ts` 8 public differences before, 0 after, 0 on David's 15 sets throughout; right when sure 408 of 678 (60.2 %), 7 off by 3 or more. Second part, 13 November 2026 (Claude, #398): `screen-numbers.test.jsx` renders the production report in French and English and fails on any number beside a unit `measures.js` does not switch on (only ° and s under MEASURES_SHOWN, inside the experimental label). It passed on main when written: no screen it reads shows an unmeasured number today; it guards the future, it fixed nothing.
Executor: careful
Claim: David reads one number, "right when sure", computed on the screen users actually get, and it is the number R16 means.
Reference: R16; `docs/FLAWS-2026-11.md` #1, #13, #14, #16; the confidence gate in `Result.jsx` and `coreAnalysis.js` as they ship.
Eval: `sure.ts` reproduces the shipping gate decision by decision on the public and David's sets (a test compares its verdict with the result screen's on the same input); then the figure is recomputed and written in STATE.md with its date. Second part: the guard test checks the numbers a screen renders against the switches of `measures.js`, not a word list.
Baseline: STATE.md, 11 November: `sure.ts` models the gate of before #342; right when sure 60.3 % on that model.
Scope: `test/real-phone/accuracy/sure.ts`, its test, `no-unmeasured-metrics.test.jsx`, STATE.md. No change to the gate itself: that is a counting change, run through R2 in its own card.
Stop: if the shipping gate cannot be reproduced outside the screen, record why and stop.
Needs from David: nothing.
