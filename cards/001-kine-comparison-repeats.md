# 001. The kiné comparison tells a patient's two sides apart
Status: blocked (on David's four videos)
Claim: a physiotherapist sees in one look where the patient's movement departs from the reference.
Reference: four videos by David of one movement: the healthy side twice, the injured side twice, same angle.
Eval: with `src/lib/reference/compare.js`, the same side filmed twice must score closer than healthy against injured, on every pair. The script and its output are committed under `test/real-phone/`.
Baseline: never run. David's screenshots of 11 November show one run on a real video: shoulder 73 against 73 degrees, elbow 176 against 173.
Scope: the comparison screen (`ComparisonView.jsx`, `ReferenceCompare.jsx`). Three defects seen on those screenshots are in scope: each angle is shown twice (pills and labels on the skeleton); the reference panel covers the right of the video; at 0:27 the skeleton does not sit on the body while the figures do not change. The comparison engine's maths may change only if the eval requires it.
Stop: if the same side twice scores no closer than the two sides, the comparison is not offered to a physiotherapist, and the card is `failed`.
Needs from David: the four videos.
