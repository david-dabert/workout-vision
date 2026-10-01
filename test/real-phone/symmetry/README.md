# Iteration 3, 1 October 2026: left/right symmetry (withdrawn before display)

Measure: per rep, each side's range (highest minus lowest smoothed joint angle over the rep's time), when
both sides are seen for at least 80 % of the rep; symmetry index SI = (R - L) / (0.5 (R + L)) x 100
(Robinson et al. 1987; formula literature, our measurement experimental). Diff: symmetry-withdrawn.diff;
results on David's 14 sets: symmetry.txt (measured by a script run against that diff).

Gates and outcome:
- Counting unchanged: passed (scoreboard 7/14, no set moved).
- Values only where both sides are truly in view (front sets): FAILED. Side-view sets gave values too
  (curl side 7 reps: SI -87 %, hip thrust side: -41 %): MediaPipe estimates the hidden limb and reports it
  visible, so a visibility floor cannot exclude it.
- Plausibility on front sets: SUSPECT. All 7 front sets read left > right (SI -7 % to -37 %) across four
  lifts and two days. A constant sign everywhere fits a camera artefact (phone off-centre, monocular depth
  error) better than the lifter's body.

Not shown to users. To decide between body and camera: the same set filmed twice from the front, phone
centred, then phone moved half a metre to one side. If SI follows the phone, it is the camera.
