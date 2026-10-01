# Iteration 1, 1 October 2026: counting a last rep cut by the recording (withdrawn)

Hypothesis H1: for lifts that leave rest by lifting (curl, lateral raise, leg curl, triceps pushdown,
hip thrust, deadlift...), a final excursion that reached the working end, lasted 0.5 to 1.5 median reps
and began within 1.5 median periods of the last rep is a rep whose return was not filmed. Diff: h1-withdrawn.diff.

Measured: David's 14 sets 7 -> 8 exact (curl 4 -> 5); Countix build half 271 -> 304 exact, 0 new off by 3+.

Withdrawn after review (review-1.txt):
- David's hip thrust (label 6) counts 7 if the recording stops anywhere from 12.5 to 13.7 s: his
  post-set hip lift passes the rule; it is refused only because he stopped later.
- After-set movements count as a rep: reaching for the phone after curls, crossing the arms, hands to the
  thighs after pulldowns, standing up after hip thrusts, leg extensions or deadlifts (+1 each, at 15 and 30 sps).
- Countix clips are cut from the middle of sets, so their ends are almost never a lifter finishing: that
  gate measures the gain of the rule, never its cost. 6 Countix rows got worse (4 pull-up, 2 pushdown).
- The 0.5 / 1.5 / 1.5 limits sit inside a dense cluster of accepted and rejected clips.
- A cut rep could come back marked whole, with a false eccentric time.

Physical conclusion: at the end of a recording, one joint angle cannot tell a rep cut on its way back from
a movement after the set (the same flexion). The information is not in the signal. The remedy is at
capture (a recording that ends at rest: Film step 3 already asks for it), not in the counter.

## Iteration 2, same day: flag a recording that starts or ends inside a rep (rejected before code)

From diagnosis.txt on David's 14 sets: an edge condition (start or end away from rest) is present on all 7
misses and on 5 of the 7 exact sets (hip thrust, overhead press 4, Romanian deadlift, curl 7, lat pulldown).
A warning on it would fire on 12 of 14 sets; it does not tell a wrong count from a right one. The narrower
"ends inside a rep that reached its working end" holds on 5 misses and 2 exact sets. Not built.
Correction: edges are common to almost every recording; they do not explain which sets the counter misses.
With 7 misses, no further rule can be told apart from fitting these sets; the next step needs more labelled sets.
