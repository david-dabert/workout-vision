# Physiotherapist reference exercises

Source: four videos from Olivier, physiotherapist, sent on 15 October 2026 with his consent for the tests ("Ci-joint les vidéos pour faire les tests"; DECISION recorded on issue #190).
They are the reference his patients are to reproduce.
The videos and their pose landmarks stay out of this public repository (his consent covers the tests, not publication). The landmarks were extracted by the app's own harness (`test/real-phone/harness.js`, MediaPipe, 15 samples a second, 640 px), after re-encoding to VP9 because the test browser has no H.264 decoder.

| Landmark file (local) | Exercise | Pose found | Joints the app reads well enough |
|---|---|---|---|
Angles are read in the picture plane (compare.js): in MediaPipe's 3D space, depth is unreliable for a person lying down.

| Landmark file (local) | Exercise | Pose found | Joints the app reads well enough |
|---|---|---|---|
| `olivier-1-supine-clasped` | On the back, hands clasped: arms up, hands to the forehead, overhead | 100 % | Near arm (right): shoulder (range 151 degrees) and elbow. The far arm, partly hidden, is left out (seen 61 % and 68 %). |
| `olivier-2-side-lying` | On the side, forearm lifting | 100 % | Left elbow only; the forearm's rotation, which is the exercise, is not an angle the app reads. |
| `olivier-3-prone-y-t` | Side-lying (his words: "couché latéralement sur le côté, le bras droit étendu, la tête soutenue"), the left arm lowered from vertical over 5 s, filmed from the head end | 93 % | Left shoulder (range 83 degrees) and elbow; the pose is lost on 7 % of samples. |
| `olivier-4-supine-staged-raise` | On the back, straight arms raised in stages to overhead | 100 % | Near arm (right): shoulder (range 162 degrees) and elbow. Holds read at 106, 152 and 176 degrees. |

Reference 2 is to be filmed again from an angle where the forearm sweeps across the picture; reference 3 would read better from the side, at table height.
The engine still builds a reference from them, on joints that do not follow the movement: a reference needs a person to check its replay before patients use it.

Bench: `REFERENCE_LANDMARKS=<local folder> node test/real-phone/reference/bench.mjs` prints the tables; the four landmark tests in `src/lib/reference/__tests__/compare.test.js` run when the same variable is set, and are skipped otherwise.
Each reference is compared with itself, with itself 1.3 times slower with 3 s of extra footage before and after, with the other three videos, and with two faulty versions of itself (the first moving joint stopped at 70 % of its range; the elbows 30 degrees more bent).
On references 1 and 4: itself and slower match; the other videos and both faults are asked to revise, each fault on the joint that carries it.
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
