# The image-motion check on the core's count: the plan, written before the run

Written 24 October 2026, before any motion count of these sets is read beside its label.

## Why

The loop gate's sealed run (test/real-phone/loop/exam-result.txt) showed that two counters reading the same skeleton
agree on its misreads. A check is worth something only when its evidence does not pass through the skeleton. The image
motion count (src/lib/counting/motionRhythm.js, 7 October) reads the pixels alone: the grey frames of the set repeat
once per rep. It was measured on 18 sets; here on every Countix set whose clip is on disk.

## Sets

The Countix build sets (public/countix and public/countix-whole, build half), split into the halves A and B as
compare-variants reads them; and, as a second look that is not sealed, the Countix held-out sets exposed on 24 October.
Each clip decoded with ffmpeg at the app's 15 samples per second, 128 x 128 grey, from the Kinetics-700-2020 file the
landmarks were read from; a trimmed set (countix) is counted on its labelled window, a whole clip (countix-whole) on
the whole clip and scored by the peaks inside its window. The region is the whole frame (the public landmark files keep
no image points). motionCount with its defaults, alternating set as the app's catalogue sets it (bothSides).

## The gates, fixed now

- Today: the app's sure set (sure.ts sureRow).
- G1: today's sure set, and the motion count equal to the core's.
- G2(c): G1 and the motion count's confidence at least c, for c in 0.3, 0.5, 0.7.

## The choice, on half A only

Among G1 and G2(c), the gate with the highest exact rate whose coverage is at least a quarter of the sets.

## The verdict, on half B

The chosen gate passes when its exact rate is above today's sure set's on B with z >= 1.96 (binomial, today's rate as
the null) and its share of sets off by 3 or more is no higher than today's. Its coverage is reported beside it.

## What this cannot say

Countix clips are YouTube videos (Kinetics), not phone sets filmed as the app asks; the frames come from ffmpeg, not
the phone's decoder. A pass makes the check a candidate for David's phone and his decision (R8, R16), nothing more.
