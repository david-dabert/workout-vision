# 047. The saved-load browser test passes on its first run, every run
Status: ready
Executor: fast (Antigravity)
Phase: 1 (a defect of the gate itself)
Claim: `e2e/saved-load.spec.js` gives the same verdict on every run of the same commit, so a red CI run always means a real fault.
Reference: run 43755254018 (PR #444), first attempt: shard 3 of 4 failed in `e2e/saved-load.spec.js` (the layout check, after the load is saved, found the rest timer's digit « 1 » overlapping); the second attempt passed with no code change. A check that passes on a rerun without a change is a defect (R16), not a flake to rerun.
Eval: find the cause (the rest timer's digits changing while `layoutFaults` measures, a transition, a font still loading) and show it: the test made to fail on demand by the cause, then passing with the fix. Then 20 consecutive runs of the spec on the production build, all passing. The layout check is never loosened, skipped or given a retry.
Baseline: 1 failure in 2 attempts on the same commit (run 43755254018).
Scope: the spec, and the rest timer's markup or CSS only if the overlap is real on screen. No counting file.
Stop: after two attempts without a shown cause, record what was ruled out in TRIED.md and the card, and report on #190.
Needs from David: nothing.
