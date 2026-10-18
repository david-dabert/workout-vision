# Real video, 18 October 2026: two gym videos read whole by the built app

Two videos David sent on 18 October 2026, read through the app's own path as `../sets-07oct-video/` was (its README
says what each file holds, and its `capture.mjs` made these, with this folder's `manifest.json`). The scoreboard counts
them in its "Real video" section under the same rules (R2), against `videoCounts` in `../accuracy/scoreboard-baseline.json`.

- `lat_pulldown_11_back`: a lat pulldown machine in a gym, filmed from behind. David's count 11 ("The lat pulldown video
  was eleven reps"). The file is `IMG_2135_2.mov`, which starts with the bar already pulled down and ends with the bar
  down: the elbow angle shows eleven pulls, the first's return and the last's pull cut by the ends of the video. Read
  here: 9 (off by 2), the nine reps between found, the first flagged partial. On David's iPhone the app showed 6, on a
  longer recording (its exported replay lasts 25.7 s); that recording is not this file. From behind, each pull reads
  25 to 34 degrees of elbow range (the world landmarks' angle; TRIED.md, "Where the range and phase-time bias comes
  from"), close to the per-rep range floor.
- `squat_6_front`: a bodyweight squat from the front, a workshop participant filmed with his agreement. David's count 6
  ("it is correctly counted"). Read here: 6 (exact).

Both originals are HEVC from an iPhone, re-encoded to VP9 for headless Chromium (no HEVC or H.264 decoder there), as
in `../sets-07oct-video/`: the phone decodes the original, so its read can differ (TRIED.md, "Counts that swing under
re-encoding"). `videoSha256` is of the file David sent.
