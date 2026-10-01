# Counter agreement, Countix whole clips, build half

Written 1 October 2026, before any result. David's order of 1 October, with Astra's instruction relayed by him.
Nothing here is tuned after the results; a change to this file after the run is a new experiment.

Question: when the counters agree, are they right more often, and how many clips does that cover?

Data: the 447 clips of public/countix-whole/build, every one in the denominator.
These are development results: the dataset has shaped earlier choices; this is not an untouched test.

Counters, fixed:
- C, the core: summarizeCount (src/lib/coreAnalysis.js), reps counted inside the labelled window (countInWindow); refused as the app refuses. Checked equal to public-baseline.json.
- L, the learned counter: the reference model (LENGTHEN=0, the app's weights), its out-of-fold sums in test/real-phone/accuracy/learned-cv.json, rounded. Each clip's sum comes from a model that never trained on its video. Never refuses.
- P, the period counter (src/lib/repCounter/periodCounter.ts, periodCount): on the core's smoothed angle inside the labelled window, nulls filled by linear interpolation, sample rate from the timestamps, the lift's period bounds. Refuses when it returns null or when the core has no angle.

Agreement: identical integer counts, both (or all three) answering. No tolerance, no threshold.
Reported for C, L, P alone, for each pair, and for all three:
- answered (coverage over 447), exact, off by 3 or more, refused or missing;
- 95% intervals by bootstrap over source videos (group: the clip id without its last two fields, as in scripts/ml/train.py), 2000 resamples, seed 1;
- by exercise.
Error correlation for each pair, on clips both answer: both wrong, the same wrong count, and the phi coefficient of being wrong.
Every agreed count that is wrong is listed with its clip, label, count and error.

Not done here: retraining, a confidence gate, any app change.
