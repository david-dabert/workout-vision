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

What changed from iteration 3 (src/lib/counting/symmetry.ts; no count changes, scoreboard 7/14):
- The view is decided from the body's orientation in the world landmarks, not from visibility: shoulder and
  hip lines within 20° and 25° of the image plane, and the person's left shoulder on +x in at least 80 % of
  frames (facing the camera; a body seen from behind is refused).
- Only exercises whose two sides move together are compared (BILATERAL); a set where one side moves less than
  20° is refused as one-sided.
- The gap shown is computed from the two ranges shown, so the three numbers agree.
- No verdict: the screen states both ranges, the gap, and that on public front clips about a third of lifters
  with no known asymmetry show a gap over 15 %.
- After a corrected count, the comparison (measured over the app's marks) is neither shown nor saved.

Evidence (front.txt from front.test.ts, ACCURACY=1; check.txt from check.mjs, Chromium):
- Gate: every set David filmed from the side or at an angle is refused; the test fails if a side set is
  measured. His lat_pulldown_10_front is refused too (hips at 40°, back to the camera): 13 of 14 sets agree
  with their file names, and the one that does not is refused, not mismeasured.
- Public front clips: 44 measured (partly filmed reps are not compared, so sets with fewer than 3 whole
  reps drop out). Left larger in 21 of 44, mean index +1 %; middle 80 % from -21 % to +24 %. 15 of 44 (34 %,
  roughly +/-15 points at 95 %) exceed 15 %. NOISE_SHARE_OVER_GAP ("about a third") describes these clips;
  the test keeps it within 8 points of them.
- David's five front sets all read left larger (front.txt). The public clips do not lean, but they mix
  cameras and possibly mirrored videos, which could cancel a lean, so this does not show that the model is
  free of a lean on his phone. The test of iteration 3 still decides body against filming: one set with the
  phone centred, then moved half a metre to one side.

Not established: that a real asymmetry is detected. No clip on disk has a measured asymmetry. That needs
sets of people with a known difference (a physiotherapist's patients, or a lifter shortening one side on
purpose). A mirrored front-camera video swaps left and right; the app cannot tell.

Display (RepStrips.jsx, under the question, intermediate and expert levels): per rep, concentric time up
and eccentric time down from a midline, and for front sets the gap between sides, up for the right and down
for the left. Fixed scales (1.5 s, 40 %), no axis numbers, every gap bar of one weight (no rep singled out).
A tapped rep's values appear in a caption under the strips. The beginner has no strips; the set's line and
note stay under the marks for them.

# Iteration 5, 2 October 2026: synthetic truth narrows the measure to lateral raises filmed square on

Synthetic sets with an exact built-in asymmetry (test/real-phone/synth/, synth.txt: two rigged bodies, four
exercises, four camera angles, 96 sets through the app's pose detection) showed:
- Lateral raise, square on: the app's gap lay within 9 points of the true gap (6 sets, true gaps -12 % to +21 %).
- Curls, presses and squats, even square on: off by 20 to 40 points. They move the limbs toward the camera,
  whose depth a single camera reads poorly.
- The old gate (20° shoulders, 25° hips) measured sets filmed at 30° and 60°: one body turned 30° read 10° at
  the shoulders. Errors there were 25 to 40 points.

So: only lateral raises are compared (SIDES_LIFTS), and the gate is 8° at both shoulders and hips (square-on
sets read at most 5°, David's front sets 4-5°, the 30° set 17-20° at the hips). The note states the measured
error instead of the public-clip share, which no longer applies (Countix holds no lateral raise). Still not
validated on people with a measured asymmetry.
