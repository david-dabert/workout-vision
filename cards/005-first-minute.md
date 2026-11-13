# 005. The first minute leads with what is proven
Status: done (already true when taken; the eval now holds it)
13 November 2026 (Claude): the eval `e2e/first-minute.spec.js` passed on main when written, on the production build at 390x844. On a first visit, the first screen of the carousel shows Biceps curl and the edge of Lat pulldown, both Beta. The rail lists the six Beta exercises before the three Experimental ones (`betaFirst`, since 3 October). Bench press says « Experimental: we are still learning this exercise » on its card and on the filming screen, above « Record my set ». The baseline "183 exercises offered together" was stale: the carousel holds 9, and the 183 sit behind the catalogue search. Check that the eval can fail: with the rail's order reversed, the first test fails on « Overhead press on the first screen ». Screenshots: `docs/shots/card-005/`. Seen, not fixed: the Experimental notice on the filming screen is small grey text under the title.
Executor: fast
Claim: a newcomer films a first set of an exercise the app counts well, and sees a count they believe.
Reference: the tiers of `src/lib/liftTiers.js`: seven exercises are Beta, the rest Experimental, none has passed an exam (STATE.md).
Eval: a browser test: on a first visit the first screen of the carousel holds only Beta exercises, and an Experimental exercise says so before filming. Screenshots at 390x844 in the report.
Baseline: 183 exercises offered together.
Scope: the choice screen's order and labels. No exercise is removed.
Stop: none; it is an ordering.
Needs from David: nothing.
