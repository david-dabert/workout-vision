# Real video, VIDEO mode, 9 October 2026: David's 14 gym videos, read as the app reads them now

Why: since 9 October 2026 the app reads a video with MediaPipe in VIDEO mode (`coreAnalysis.js`, `videoMode`), which
follows the body from the sample before instead of running the person detector on every sample. The real-video sets of
7 October (`../sets-07oct-video/`) are IMAGE-mode reads: the gate measured a read no user gets any more. These files are
the same 14 videos, the same copies, read the way the app reads them today. `npm run scoreboard` counts them in their own
section, "Real video, VIDEO mode", under the same R2 rules (no exact count lost, none newly off by 3 or more, none newly
refused), against their own baseline (`videoModeCounts` in `../accuracy/scoreboard-baseline.json`). The 7 October section
stays: the check page still reads in IMAGE mode on request (`?posemode=image`), and its sets keep their own gate.

Labels: David's, copied from `../sets-07oct-video/manifest.json` by the capture (R1). No label was set or changed here.

## How they were made

1. David's originals re-encoded to VP9 with the recipe of `../sets-07oct-video/README.md` (ffmpeg 7.0.2, from the
   `imageio-ffmpeg` Python package, as this machine has no system ffmpeg). The standing barbell curl keeps the PyAV
   copy the 7 October set was read from.
2. Fidelity check before any VIDEO read: every copy read again in IMAGE mode (`SETS_POSEMODE=image`) gives timestamps
   and world landmarks identical to the committed 7 October file (SHA-256 of both arrays). So the copies are the ones
   the 7 October sets were read from, and the two folders differ by the pose mode alone.
3. `npm run build`, then `SETS_OUT=test/real-phone/sets-09oct-video-mode node test/real-phone/sets-07oct-video/capture.mjs
   <copies>` with no pose mode set: the built app's check page, which reads as the app does. Each file says
   `extraction.poseMode: "video"`.

The file format is that of `../sets-07oct-video/` (its README lists every field). No video is in the repository.
