# 031. An arm's lift read never switches to the far arm
Status: ready
Executor: careful
Claim: A prone raise (an exercise read as an arm's lift, `lift` in its PATTERNS entry) filmed with its picked arm unseen is asked, not counted on the far arm, as before PR #431; the seated row fix of #431 is kept.
Reference: `src/lib/counting/core.ts`, the comment above the still-limb rule: "An arm's lift read (prone raises) never switches: its far arm's rest wanders past the 10-degree floor (DETECTION, prone_y_raise)". PR #431 (card 027) put its countability switch before that guard (Claude's review of 14 November 2026, issue #190).
Eval, fixed before any code:
1. A synthetic test: a lift-type definition whose summed-visibility side is seen on fewer than half the samples while the other side is seen on more: `countReps` keeps the picked side, so `summarizeCount` refuses (asks). It fails on main today (6c849bc5), since the switch returns the other side.
2. `src/lib/counting/__tests__/single-side-countability.test.ts` still passes (the seated cable row still switches).
3. R2: `npm run scoreboard`, `npm run scoreboard:blind`, `npm run scoreboard:public` and the synthetic analysis unchanged.
Baseline: on 6c849bc5 the switch runs for every single-side lift, lift reads included; #431's R2 run moved no labelled count.
Scope: one condition in `core.ts` (the switch skips lift reads), the new test, TRIED.md. Nothing else.
Stop: if any labelled count moves, record it in TRIED.md and stop.
Needs from David: nothing.
