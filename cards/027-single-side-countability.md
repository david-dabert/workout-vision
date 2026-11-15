# 027. Check single-side countability before summed visibility
Status: done
Executor: careful
Claim: Single-side lifts (`!eitherSide && !together`, such as `seated_cable_row` / `seated_row`) no longer refuse a set on the far/occluded side (`confidence < 0.5`) when the opposite side is countable (`>= 50%` valid samples), while preserving the one-arm-curl idle-side guard (`core.ts` lines 617-626).
Reference: Handover roadmap Phase 1.2 ("Seated cable row refused: Your left arm was hidden for most of the set"); third audit C01 (`core.ts` lines 635-643); R2, R8, R9.
Eval:
1. New synthetic test `src/lib/counting/__tests__/single-side-countability.test.ts` fails before the fix and passes after.
2. `npm run scoreboard`, `npm run scoreboard:blind`, `npm run scoreboard:public`, and `SYNTH_DIR=test/real-phone/synth/sets npx vitest run --no-cache test/real-phone/synth/analyse.test.ts` before and after (R2): exact counts do not fall, no clip becomes an error of 3+, and any moved count is inspected and recorded in `TRIED.md` with baselines updated if needed.
3. Full `npm test`, `npm run typecheck`, `npm run lint`, `npm run check:css-tokens`, `npm run audit:swarm` pass with zero em-dashes.
Baseline: Stored deciding `13/15`, real video `12/17` (`2` refused), public deciding `468/949` (`118` refused out of `1064`), synthetic `74/96`.
Scope: `cards/027-single-side-countability.md`, `src/lib/counting/core.ts`, `src/lib/counting/__tests__/single-side-countability.test.ts`, `TRIED.md` (and baselines only if counts move on R2).
Stop: Revert if the one-arm-curl still-side protection breaks (`one-limb.test.ts`, `audit-core.test.ts` FINDING-011) or if any R2 gate fails (`real-phone` exact falls or any clip becomes newly off by 3+).
Needs from David: nothing for the core fix and synthetic regression proof; David's `#collecte` seated cable row recording will verify the live clip end-to-end when filmed.
