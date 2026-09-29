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

## Open
- Review 01, risk: five of the six both-sides patterns are filmed from the side, where the far limb is hidden; the core then counts the near side's reps only, with confidence 0. No real clip of a both-sides guide exercise exists to measure it.
