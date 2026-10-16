# Physiotherapist reference exercises

Source: four videos from Olivier, physiotherapist, sent on 15 October 2026 with his consent for the tests ("Ci-joint les vidéos pour faire les tests"; DECISION recorded on issue #190).
They are the reference his patients are to reproduce.
The videos and their pose landmarks stay out of this public repository (his consent covers the tests, not publication). The landmarks were extracted by the app's own harness (`test/real-phone/harness.js`, MediaPipe, 15 samples a second, 640 px), after re-encoding to VP9 because the test browser has no H.264 decoder.

Angles are read in the picture plane (compare.js): in MediaPipe's 3D space, depth is unreliable for a person lying down.

| Landmark file (local) | Exercise | Pose found | Joints the app reads well enough |
|---|---|---|---|
| `olivier-1-supine-clasped` | On the back, hands clasped: arms up, hands to the forehead, overhead | 100 % | Near arm (right): shoulder (range 151 degrees) and elbow. The far arm, partly hidden, is left out (seen 61 % and 68 %). |
| `olivier-2-side-lying` | On the side, forearm rotated above and below the horizontal | 100 % | The left forearm's direction in the picture (range 37 degrees). Below the horizontal the forearm crosses the face and the wrist is lost; those moments are not judged. |
| `olivier-3-prone-y-t` | Side-lying (his words: "couché latéralement sur le côté, le bras droit étendu, la tête soutenue"), the left arm lowered from vertical over 5 s, filmed from the head end | 93 % | The left arm's direction, shoulder to wrist (range 97 degrees), without the moments when it lies on the other arm. |
| `olivier-4-supine-staged-raise` | On the back, straight arms raised in stages to overhead | 100 % | Near arm (right): shoulder (range 162 degrees) and elbow. Holds read at 106, 152 and 176 degrees. |

## Two readings of the same video (16 October 2026)

Each video was read a second time by the pose model, replayed 1.2 times slower (a re-encoded copy, so different frames), and the two readings were compared moment by moment.
Reading the same file twice gives the same landmarks to within one degree; the slower copy shows how far the model's reading moves with the frames it is given.

| Video | Measure | 90th percentile gap between the two readings |
|---|---|---|
| 3 | Shoulder angle, hip-shoulder-elbow (the hip is hidden behind the body, the head covers the shoulders) | 34 degrees |
| 3 | Arm direction, shoulder to wrist, without the samples where the two wrists overlap (between 9 and 18 s the model swaps them) | 6.5 degrees |
| 2 | Elbow angle | 29 degrees |
| 2 | Forearm direction, elbow to wrist | 2.6 degrees |

Directions are measured against the body line (left shoulder to right shoulder, its median over the video), so that a phone propped a little askew reads the same.
Through the whole engine, the slower reading matches its reference on both videos (90th percentile gap after alignment: 1.1 degrees on video 2, 1.7 on video 3), also seen in a mirror when read on the side the physiotherapist sets, and three faults built from it (the range cut to 70 % from either end, the segment 25 degrees off) are asked to revise.

An attempt is read as in a mirror in three cases only: the physiotherapist set the patient's side opposite the reference's (exercises 2 and 3, done with one arm); the plain reading gives no verdict; or the mirror reading sees the measured points clearly better (mean visibility 0.1 higher: a patient filmed from the other side, whose near arm is then the other one).
It is never chosen because it fits better: on a side-on video the mirror reading is the far arm, which the reference itself leaves out, and a short raise of the near arm would pass on the far one (found in review, 16 October 2026).
Exercise 2's position below the horizontal is not judged: the reference does not show it.
Exercise 3's horizontal hold is judged only on the moments when the lowered arm is apart from the other one.

Bench: `REFERENCE_LANDMARKS=<local folder> node test/real-phone/reference/bench.mjs` prints the tables; the four landmark tests in `src/lib/reference/__tests__/compare.test.js` run when the same variable is set, and are skipped otherwise.
Each reference is compared on the measures `src/lib/kine/library.js` sets for it, with itself, with itself 1.3 times slower with 3 s of extra footage before and after, with itself seen in a mirror, with the other three videos, and with faulty versions of itself (the first moving measure cut to 70 % of its range from either end, or 25 degrees off throughout; on references 1 and 4, the elbows 30 degrees more bent).
On all four references (16 October 2026): itself, slower and mirrored match (12 of 12); the other videos are asked to revise or given no verdict, and every fault is asked to revise, on the measure that carries it (28 of 28).
No patient attempt has been measured yet: the tolerances (`src/lib/reference/compare.js`) are experimental and UNSOURCED (R9).

## Olivier's stated angles against the app's reading (video 4)

His voice in video 4: "On a successivement 90, 120, 150 et 160 degrés d'élévation."
The app's picture-plane shoulder angle (hip, shoulder, elbow) at those stages, read on the reference's own landmarks:

| Stage he states | App's reading |
|---|---|
| 90° | about 79° (9 to 10 s, a pause too short for the hold rule) |
| 120° | 106° (hold at 13.0 s) |
| 150° | 152° (hold at 18.4 s) |
| 160° | 176° (hold at 22.7 s, 4.4 s) |

His figures are the angles he aims at, not goniometer readings; the app measures the arm against the trunk line in the picture, he likely against the table.
Gaps of 2 to 16 degrees: the app's numbers are compared with the reference's, read the same way, never shown as clinical angles.
