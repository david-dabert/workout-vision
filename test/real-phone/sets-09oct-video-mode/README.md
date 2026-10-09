# Real video, VIDEO mode, 9 October 2026: David's 14 gym videos read with MediaPipe in VIDEO mode

Why: on the morning of 9 October 2026 the app switched to reading a video with MediaPipe in VIDEO mode (it follows the
body from the sample before instead of running the person detector on every sample, about 30 % faster). It had been
measured on other copies of these videos (PyAV VP9: 5 exact in each mode). These files are the copies the real-video
gate reads (`../sets-07oct-video/`), read in VIDEO mode. On them VIDEO mode counts 2 of 14 exact against 6 in IMAGE
mode (R2: the exact count may not fall), and the proposal on the two refused sets that show one moves off the label
(standing barbell curl 8 -> 6, sissy squat 5 5011 5 -> 4). The app went back to IMAGE mode the same evening.

`npm run scoreboard` shows these sets in their own section, "Real video, VIDEO mode", against their own baseline
(`videoModeCounts` in `../accuracy/scoreboard-baseline.json`). The section decides nothing while the app reads in IMAGE
mode: it keeps the evidence, and measures VIDEO mode again whenever it is proposed.

Labels: David's, copied from `../sets-07oct-video/manifest.json` by the capture (R1). No label was set or changed here.

## How they were made

1. David's originals re-encoded to VP9 with the recipe of `../sets-07oct-video/README.md` (ffmpeg 7.0.2, from the
   `imageio-ffmpeg` Python package, as this machine has no system ffmpeg). The standing barbell curl keeps the PyAV
   copy the 7 October set was read from.
2. Fidelity check before any VIDEO read: every copy read again in IMAGE mode (`SETS_POSEMODE=image` that day; the default since the app went back to
   IMAGE mode) gives timestamps
   and world landmarks identical to the committed 7 October file (SHA-256 of both arrays). So the copies are the ones
   the 7 October sets were read from, and the two folders differ by the pose mode alone.
3. `npm run build` (the app of the morning of 9 October, VIDEO mode by default), then `SETS_OUT=test/real-phone/sets-09oct-video-mode
   node test/real-phone/sets-07oct-video/capture.mjs <copies>`. Each file says `extraction.poseMode: "video"`. Since
   the app went back to IMAGE mode, the same read is `SETS_POSEMODE=video` (the check page's `?posemode=video`).
   A second VIDEO read of three sets gave identical landmarks (SHA-256): the mode is deterministic here.

The file format is that of `../sets-07oct-video/` (its README lists every field). No video is in the repository.
