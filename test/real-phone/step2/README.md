# Evidence: GROWTH step 2 (every countable exercise of the guide)

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
- outputs/12: src/lib/__tests__/offer.test.js (the 182 offered exercises; Beta for the four with evidence, Experimental for every other).
- outputs/14, 15: e2e/shared/exercises.tests.js on this code (5 passed) and on a build of a239503 (5 failed).
- outputs/16, 17: the collector's test for the 182 exercises before (9 offered) and after.
- outputs/13, 18 to 21: build, lint, typecheck, unit tests and browser tests (Chromium) on this code. WebKit runs in CI.
- screens/: Chromium at 390×664 (2x), on the production build, by harness/shots.pw.js: the list under the cards, a search, and the filming screen of the walking lunge, drawn from the guide, in French and English.
- outputs/22 to 25: the tests written for review 02 (a front-view exercise filmed from the front; both limbs named; the French muscle search; the cards kept if the list cannot load; the welcome never shows a key), before and after.
- french-copy.md: the new French copy, for David's approval.
- reviews/02: the reviewer's report on the screens.
- src/lib/__tests__/coreAnalysis.test.js and liftTiers.test.js pinned the offer to the nine lifts of LIFT TIERS; they now check step 2's rule (the 182, the nine among them, none without a joint), by David's decision of 29 September.

## Open
- The list's rows reuse the guide's; with the "Expérimental" tag beside them, long French names take three lines at 390 px. David judges the balance on the preview.
- Review 01, risk: five of the six both-sides patterns are filmed from the side, where the far limb is hidden; the core then counts the near side's reps only, with confidence 0. No real clip of a both-sides guide exercise exists to measure it.
