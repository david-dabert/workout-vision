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

# Iteration 4, 1 October 2026: front view only (David's order: build it as an experimental measure)

What changed from iteration 3: the view is decided from the body's orientation in the world landmarks
(median angle of the shoulder line and of the hip line to the image plane, at most 20° and 25°), not from
visibility, so a side view is refused even when the model reports the hidden limb visible
(src/lib/counting/symmetry.ts). No count changes; the scoreboard is unchanged at 7/14.

Evidence (front.txt, front.test.ts, run with ACCURACY=1; check.txt, check.mjs in Chromium):
- Gate: every set David filmed from the side, and his angled and turned sets, is refused (14 of 14 correct
  by his file names); the test fails if a side set is ever measured.
- Bias: on 80 Countix clips filmed from the front (lifters with no known asymmetry), left is larger in 40 of
  80, mean index -2 %. The pose model does not lean to one side on public video.
- Noise: 80 % of those indices lie between -30 % and +29 %; 36 % pass the 15 % threshold often used in the
  literature. A 15 % flag would mostly be measurement noise, so the app shows no verdict: it states both
  ranges, the gap, and that measurement alone often gives gaps up to 30 % (NOISE_SI; the 10th percentile is -30.3 %).
- David's five front sets all read left larger (-9 % to -36 %) while the public clips do not lean. His
  pattern is therefore his body or his filming set-up (phone off-centre), not the model. The test of
  iteration 3 still decides it: film one set with the phone centred, then moved half a metre to one side.

Not established: that a real asymmetry is detected. No clip on disk has a measured asymmetry. That needs
sets of people with a known difference (a physiotherapist's patients, or a lifter shortening one side's
range on purpose).
Left and right are the filmed person's own; a mirrored front-camera video swaps them.
