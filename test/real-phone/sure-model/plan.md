# Card 056: the plan, written before any fit (19 November 2026, Claude)

This file is committed before `fit.mjs` is run on any row; its commit is the pre-registration.

## The question
Can one check, combining signals that were each measured alone, say "sure" more rightly than the gate that ships today, without hiding many more sets?

## Data
- Rows: `rows.json`, written by `features.test.ts`, one per labelled build set the app counts (a count above 0, not refused), lifts that decide only (press sets left out, PLAN.md).
- Fit: public build half A only (`suite = publicA`).
- Never used to fit or to choose anything: public half B, RepCount-A build, David's sets. They are judged once, after the threshold is fixed.
- The card's exam: RepCount-A's held-out half, then the sealed pool, each read once, with the model and threshold frozen in this commit's successor named in `result.md`.

## Model, fixed now
- Logistic regression, target `err == 0`, L2 penalty 1 on standardized weights (intercept not penalized), Newton's method until the step is under 1e-8.
- Features, each fixed now:
  1. `shipped` (0/1);
  2. `tail` (0/1);
  3. `whole` (0/1);
  4. `spread` (number; 0 when absent);
  5. `recountRefused` (0/1);
  6. `agree` (number; 0 when absent);
  7. `agreeMissing` (0/1);
  8. `loopSame && loopSure` (0/1);
  9. `loopSame` (0/1);
  10. `log(1 + loopRatio)` (0 when absent);
  11. `pscSame` (0/1);
  12. `pscConfirm` (0/1);
  13. `|learnedGap|` (0 when absent);
  14. `learnedMissing` (0/1);
  15. `log(count)`.
- Cross-validation on half A by video (`video` field), 5 folds, folds assigned by a hash of the video id.

## The threshold, fixed now
On half A's out-of-fold probabilities:
- among thresholds whose sure share of counted sets is at least today's sure share on half A minus 10 points, take the one with the highest exact share among the sets it calls sure, and no set off by 3 or more among them;
- if no threshold keeps every set off by 3 or more out, take the highest exact share under the share condition alone, and say so.
The final model is refitted on all of half A, with that threshold.

## Pass, the card's words
On a judged suite: exact share among the sets called sure at least 5 points above today's gate's on the same suite, a sure share at most 10 points below today's, and no set off by 3 or more called sure.
The card's verdict is read on RepCount-A's held-out half, then the sealed pool. Half B, RepCount-A build and David's sets are reported beside it; they decide nothing.

## Stop
If it fails on the held-out half: TRIED.md records it and the card closes. No feature, penalty or threshold is changed after a judged suite is read.
