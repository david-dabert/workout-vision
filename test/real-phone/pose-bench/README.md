# Pose-model bench (4 October 2026)

David's order of 4 October: make the pose model excellent, and fish for data. This folder measures pose models on real
video with human labels, through the app's own code.

- `run.mjs`: each video through `test/real-phone/harness.html` (the app's extraction and pose modules, 15 Hz, long
  side 640), once per model. `full` is the shipped `pose_landmarker_full.task`; other models (MediaPipe's
  `pose_landmarker_heavy` and `pose_landmarker_lite`, float16, from storage.googleapis.com) are handed to the
  app's loader through the bench hook in `src/lib/poseAnalysis.js`.
- `score.test.ts`: counts the landmarks with `summarizeCount` against the dataset's labels, per model, lift and view.

## Data: CFRep (not in this repository)

CFRep (https://github.com/lc-leonardo/CFRep; Alves, Li, Xu, "RepVal", ACM/IEEE SEC 2025): 64 single-camera CrossFit
videos, 8 people, filmed from the front, diagonally and from the side, every attempt marked valid or no-rep by a
certified CrossFit judge. The repository has no licence file, only a request to cite. Under R1 it is used here as a
measurement only; its videos and landmarks stay outside this repository until David decides.

Used: the 22 squat and 21 deadlift videos (43 sets, 516 attempts), converted to VP9 at the app's analysis size.
Label: every attempt the judge marked, valid or not (the app counts movements, not judged reps).

## Results (run of 4 October 2026, Chromium, CPU)

| Model | Size | Exact | Within 1 | Mean error | Time per video |
|---|---|---|---|---|---|
| full (shipped) | 9.4 MB | 31 / 43 | 40 / 43 | 0.42 | 29.0 s |
| heavy | 30.7 MB | 30 / 43 | 39 / 43 | 0.49 | 76.5 s |
| lite | 5.8 MB | 30 / 43 | 39 / 43 | 0.49 | 22.6 s |

By lift and view, full model: squat 17 / 22 exact (side 8 / 8, front 5 / 7, diagonal 4 / 7); deadlift 14 / 21
(front 4 / 7, diagonal 5 / 7, side 5 / 7). No set refused by any model.

Against the judge's valid reps only, full counts 11 / 43 exactly: the app counts every movement, as designed.

## What the misses are (full model)

- Squat: 6 of the 9 squat attempts the app missed are attempts the judge marked as no-reps (not deep enough); the
  app does not count those shallow squats. One diagonal set lost 3 valid reps.
- Deadlift: 4 of the 7 deadlift misses are the last rep, where the video ends 0.4 to 1.6 s after the final lockout,
  before the bar is back on the floor: the end-cut rep of decision D15 (docs/SPEC-production.md).
- Two deadlift sets count one movement more than the judge's attempts.

## Conclusion

The pose model is not the bottleneck for counting: heavy and lite count no better than the shipped full model, and
heavy takes 2.6 times as long. The app keeps `pose_landmarker_full`. The levers left are the counting rules at the
edges of a set (D15) and data from the exercises still without labelled sets.

## Left/right gap, curls and presses filmed square on (synthetic truth, 4 October 2026)

The heavy model was also run on the 12 synthetic curls and presses filmed square on (test/real-phone/synth: two
rigged bodies, true gaps -23 % to +18 %), to see whether it reads depth better than the full model, the reason the
app compares sides on the lateral raise only (symmetry.ts). Each side's range over the counted reps, against the
built-in truth:

| Model | Mean absolute gap error | Largest error |
|---|---|---|
| full (shipped) | 17.2 points | 44 |
| heavy | 34.5 points | 73 |

The bar the lateral raise meets is 10 points. Heavy reads the gap worse: the camera's depth, not the model, limits
the comparison of curls and presses filmed from the front. symmetry.ts keeps them out.
