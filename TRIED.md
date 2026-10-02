PLAN.md on counter-core prevails over this file.
# Tried and closed

Read this before proposing any counting, measurement or data idea (CLAUDE.md, R11).
Each line: what was tried, the measured result, why it is closed or parked, and where the evidence lives.
An idea listed here is not proposed again unless new data or a new mechanism changes its premise; say which.
Written 2 October 2026, after two proposals in one hour repeated closed work.

## Counting rules

- **Count a last rep cut by the end of the recording** (1 October). David's sets 7 -> 8 exact; Countix build 271 -> 304. Withdrawn: movements after the set (reaching for the phone, standing up after hip thrusts) pass the same rule; one joint angle cannot tell them apart. Remedy is at capture. `test/real-phone/end-rule/README.md`, iteration 1.
- **Warn when a recording starts or ends inside a rep** (1 October). Fires on 12 of David's 14 sets, right or wrong. Not built. `test/real-phone/end-rule/README.md`, iteration 2.
- **Either side does the rep** (lunge, front raise; 30 September). Countix build 271 -> 299, but one clip became off by 3+, and a short dropout splits alternating reps (8 raises count 16). Withdrawn. `test/real-phone/either-side/README.md`.
- **A rep's range measured from its rest** (28 September). Parked by David; open reviewer cases (an 18° partial counts 7 for 6). Branches `range-from-rest`, `range-from-rest-review`; STATE.md.
- **Rest band 10 % / 3° -> 5 % / 2°** (2 October). Shipped in PR #51: tempo closer to truth on synthetic sets; one Countix push-up went 2 -> 1. `src/lib/counting/core.ts` comment.

## Other counters

- **Learned counter** (30 September; small temporal network on 12 joints, trained on Countix build). Cross-validated on 447 Countix whole clips: 229 exact (51 %) against the core's 134; off by 3+ 4 % against 11 %. David's 14 sets: 8 exact against 7 (overhead press f756: 7 for 4; presses decide nothing). Parked, not rejected: its release gate (PLAN.md, 30 September) asks for held-out phone sessions. A "lengthen" variant was worse on David's sets (2/14). `src/lib/counting/learned.ts`; `test/real-phone/accuracy/learned-*.txt`.
- **Period counter** (frequency of the smoothed angle). 54 % exact where it answers, 55 % coverage. Measured, not used. `test/real-phone/agreement/agreement.txt`.
- **Agreement of counters as confidence** (1 October). All three agree on 70 of 447 clips, 56 exact (80 %), 1 off by 3+. Closed: not a reliable automatic gate; may enter a confidence model only if it beats a visibility/gaps/exercise baseline on held-out phone sessions. `test/real-phone/agreement/CONCLUSION.md`.
- **Turning points and whole-body signal** (30 September). Neither beats the core overall on Countix. `test/real-phone/accuracy/public-signal.txt`.
- **Confidence from pose coverage** (30 September). Sets with a pose on every sample: 42 % exact against 29 % below 0.9; a weak signal alone. `test/real-phone/accuracy/public-confidence.txt`.

## Measures

- **Left/right from any view** (1 October, iteration 3). Side views read the hidden limb as visible (curl SI -87 %). Withdrawn. Shipped instead: lateral raise filmed square on only, within 10 points per set on synthetic bodies. `test/real-phone/symmetry/README.md`, `test/real-phone/synth/synth.txt`.
- **Speed change, first to last rep** (2 October). Within timing noise (synthetic median 15 %, p90 72 %). Hidden everywhere (`SPEED_CHANGE_SHOWN`). `src/components/experience/measures.js`.

## Data

- **Countix** (Kinetics clips, human counts): build half 894 scored sets (two readings of 447 clips); held-out half unread, reserved for one final run. `test/real-phone/public/`, `scripts/public/`.
- **Synthetic bodies** (Michelle, Soldier; 96 sets with exact truth). Bound what the pipeline can do; not people. `test/real-phone/synth/`.
- **Unreachable from this environment**: Zenodo, Hugging Face, Dataverse, Kaggle, the InfiniteRep bucket (network policy).
- **David's batches of 1 October**: held, not scored; labels and videos paired out of order. Five new videos fit their exercise and wait only for David's confirmation of their counts. `test/real-phone/held-01oct/`.
