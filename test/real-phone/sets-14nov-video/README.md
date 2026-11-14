# Real video, 14 November 2026: a dumbbell bench press the app counts 16 for 9

One video David sent on 14 November 2026 ("the app counted 16 on a 9 reps bench press"), read through the app's own path by `../sets-07oct-video/capture.mjs` with this folder's `manifest.json` (`SETS_MANIFEST`). The scoreboard counts it in its "Real video" section (R2), against `videoCounts` in `../accuracy/scoreboard-baseline.json`.

- `dumbbell_bench_press_9_angle`: a dumbbell bench press on a flat bench in a gym, filmed from near the lifter's feet and to the side. David's count 9 (R1). Read here: 16, as on David's iPhone; 999 samples, pose on 88 %. Recorded as a known catastrophic set, gated on growth.
- Why, from the stored landmarks: the counted right elbow's angle jumps by 50 to 70 degrees within a third of a second (151, 95, 165 degrees at 18.7, 19.0, 19.3 s): the pose loses the arm from this view, and the counter finds 16 reps of 34 to 66 degrees at irregular times. The counter of 4, 14 and 24 October reads these landmarks as 14, that of 29 October and later as 16: no version counts 9. A share of consecutive steps over 30 degrees does not separate this set from David's others (0.002).

The original is H.264 from an iPhone (variable frame rate, 28.3 fps on average), re-encoded to VP9 with its own frame timestamps for headless Chromium. `videoSha256` is of the file David sent. No video is in the repository.
