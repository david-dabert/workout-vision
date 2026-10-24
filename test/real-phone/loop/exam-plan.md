# The loop gate on the sealed public half: the plan, written before the run

Written 24 October 2026, before any held-out set is read by this bench. The held-out half (scripts/public/split.mjs;
443 Countix sets and 17 RepCount-A sets recorded as written in their sets.json, never committed, never read by any bench
on this branch) is rebuilt in the cloud container from the same sources (Kinetics-700-2020 on the CVDF mirror;
RepCount-A as re-annotated by PoseRAC) through the app's own extraction (scripts/public/run-public.mjs --split holdout),
into a folder outside the repository. The CFRep held-out sets are exposed (public/exposed.json) and are not scored.

## What is measured, once

On every held-out set, with the code at the commit that adds this file and nothing changed after it:

- the core's count, scored inside the labelled window (countInWindow), as public-holdout.test.ts scores it;
- the app's sure set as it ships (sure.ts sureRow: counted, not flagged by the body check, the sensitivity check or a
  refused head rep);
- the loop counter (loop.js, DEFAULTS unchanged), both end rules.

## The gates, fixed now

1. **Primary**, the rule chosen beforehand on public A (loop.txt, section 4): end rule `rest`, k = 12. The core's count
   is shown as sure when the loop counts the same and is sure.
2. **Secondary**, picked after the build halves were seen, so reported as exploratory only: end rule `round`, k = 3.

## What counts as a pass

The primary gate passes when, on the held-out half, its exact rate among the sets it calls sure is above the app's sure
set's exact rate today, and it has no more sets off by 3 or more than the app's sure set has. Its coverage (sure sets
over all sets) is reported beside it, whatever it is. Nothing is tuned on these sets; after this run they are exposed
(public/exposed.json) and become build sets.

## What this run cannot say

Countix's clips are from YouTube (Kinetics), filmed by others for other purposes; they are not phone sets filmed as the
app asks. The result speaks for public video, not for David's phone; PLAN.md's exam (four filmed sets per lift) stays
the release gate.
