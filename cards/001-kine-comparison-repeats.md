# 001. The kiné comparison tells a patient's two sides apart
Status: ready
Executor: careful
Claim: a physiotherapist sees in one look where the patient's movement departs from the reference.
Reference: first, public data (METHOD.md, Data before David): in the public sets on disk, two sets of the same exercise by the same person are "the same movement twice", and sets of two different exercises are "different". Then, as confirmation, four videos by David of one movement: the healthy side twice, the injured side twice, same angle.
Eval: with `src/lib/reference/compare.js`, same-exercise pairs must score closer than different-exercise pairs on at least 90 % of the pairs drawn from the public sets; then, on David's videos, the same side filmed twice must score closer than healthy against injured, on every pair. The script and its output are committed under `test/real-phone/`.
Baseline: never run. David's screenshots of 11 November show one run on a real video: shoulder 73 against 73 degrees, elbow 176 against 173.
Scope: the comparison screen (`ComparisonView.jsx`, `ReferenceCompare.jsx`). Three defects seen on those screenshots are in scope: each angle is shown twice (pills and labels on the skeleton); the reference panel covers the right of the video; at 0:27 the skeleton does not sit on the body while the figures do not change. The comparison engine's maths may change only if the eval requires it.
Stop: if the same side twice scores no closer than the two sides, the comparison is not offered to a physiotherapist, and the card is `failed`.
Needs from David: nothing to start; the four videos for the confirmation.
