# Evidence: GROWTH step 2 (every countable exercise of the guide)

By David's decisions of 29 September: the walking lunge is not offered (the lifter walks out of a fixed frame), so 181 exercises are; only the Beta rows carry a tag, and a line under the list's title says the rest are experimental.

Step 2 changes src/lib/counting, so it keeps the full method (PLAN.md, METHOD, two gates).

## The core (commit "Step 2, core")
- outputs/01, 05, 10: src/lib/counting/__tests__/patterns.test.ts before the change (18 of 20 fail: each exercise was counted as a curl), after it, and after review 01's fixes.
- outputs/02: core.ts's sha256 before the change (5514f77b…, bf50199's core).
- outputs/03, 06: every counting test before and after.
- outputs/04, 07, 11: every committed clip counted under every lift in LIFTS (test/real-phone/step2/clip-counts.test.ts), before and after: the 80 lines are identical.
- outputs/08: the tests written for review 01 (no count without a definition; the slim pattern table), before the fix.
- outputs/09: scripts/make-guide-patterns.mjs, which writes src/lib/counting/guide-patterns.json.
- reviews/01: the reviewer's report on the core change.

## The screens (commit "Step 2, screens")
- outputs/12: src/lib/__tests__/offer.test.js (the offered exercises, 182 at first, 181 since David's decision on the walking lunge; Beta for the four with evidence, Experimental for every other).
- outputs/14, 15: e2e/shared/exercises.tests.js on this code (5 passed) and on a build of a239503 (5 failed).
- outputs/16, 17: the collector's test for the offered exercises before (9 offered) and after (182; 181 in outputs/29).
- outputs/13, 18 to 21: build, lint, typecheck, unit tests and browser tests (Chromium) on this code. WebKit runs in CI.
- screens/: Chromium at 390×664 (2x), on the production build, by harness/shots.pw.js: the list under the cards, a search, and the filming screen of the forward lunge, drawn from the guide, in French and English.
- outputs/22 to 25: the tests written for review 02 (a front-view exercise filmed from the front; both limbs named; the French muscle search; the cards kept if the list cannot load; the welcome never shows a key), before and after.
- french-copy.md: the new French copy, for David's approval.
- reviews/02: the reviewer's report on the screens.
- outputs/30, 31: the 320 px test written for review 03, before and after the names' size scales with the screen.
- reviews/03: the reviewer's report on David's changes to the list.
- screens/film-walking-lunge-*.png: shot before the walking lunge left the offer; kept, since files under test/ are not deleted without David's approval (CLAUDE.md R5).
- outputs/26 to 29: David's changes to the list (181 exercises; Beta-only tags and the line under the title; no name over two lines at 375 px), tests before and after.
- src/lib/__tests__/coreAnalysis.test.js and liftTiers.test.js pinned the offer to the nine lifts of LIFT TIERS; they now check step 2's rule (the 181, the nine among them, none without a joint), by David's decision of 29 September.

## The verifier's findings (commit "Step 2, verifier's findings")
- outputs/32, 33: src/components/experience/__tests__/refusal.test.js before (the old refusal named both legs when one was hidden: 2 failed) and after (5 passed).
- outputs/34: the result screen of exercises without a card, rendered by harness/results.mjs from harness/result-harness.jsx (a fixed set, 8 reps, 26 s): names, tiers, limbs, and the refusal sentences with one leg hidden.
- outputs/35, 36: the tests written for review 04 (a side lost as the core loses it, when any of its landmarks is hidden; one hip of a both-sides set is its side, not "your hips"), before and after.
- Unverified, since they need a real video: the analysis screen (Watch) and the replay (Replay) for an exercise without a card. Their code takes the name from exercise-info.js and the joint from liftDefinition, as the result does.

## Open
- Review 01, risk: five of the six both-sides patterns are filmed from the side, where the far limb is hidden; the core then counts the near side's reps only, with confidence 0. No real clip of a both-sides guide exercise exists to measure it.
