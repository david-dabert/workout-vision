# Far camera: the crop pass on lost frames (6 October 2026)

Audit of 6 October, action 3. David's back extension of 5 October (filed as a hip thrust until David named it on 6 October) (`sets-05oct/machine_seated_back_extension_13`) counts 8 for 13: the pose
model finds a pose in 105 of 280 samples mid-set. The app runs MediaPipe on the whole frame (IMAGE mode, the person
detector sees the frame shrunk to 224 px), and a body that fills little of the frame drops out on scattered samples.

The change (`src/lib/poseCrop.js`, `src/lib/poseAnalysis.js` `detectPoseImage`, so the app's worker, the harness,
synth and Validate all get it): on a frame where the whole frame gives no pose, and a pose was accepted less than
1 s before, the model runs again on a square crop centred on that pose's raw image-landmark box, side 2x the box's
larger side (clamped to the frame, at least 64 px), drawn at 256 x 256; the landmarks found are mapped back to the
whole frame, world landmarks passed as found, the sample marked `source: 'crop'`. A frame the whole-frame pass reads is
unchanged (no extra call, the image smoothing not fed by crop frames).

Measured on synthetic bodies (no real video can be re-read here: only landmarks are stored). `matrix-*.json` are the
sets given to `test/real-phone/synth/run.mjs` (dist 9 m: the body about 17 % of the frame's height), each rendered with
the crop pass off (`noCrop`, bench hook `__WV_BENCH_NO_CROP__`) and on; `sets/` holds the landmarks;
`far-camera.test.ts` reads them and writes `far-camera.txt`. At 12 m and 16 m no pose was found on any frame, so a crop
pass has no seed: it does not help a body the whole-frame pass never finds.

Re-render (about 15 minutes here):

    SYNTH_OUT=<dir> SYNTH_MODEL=<Michelle.glb> PW_CHROMIUM=<chromium> node test/real-phone/synth/run.mjs test/real-phone/far-camera/matrix-michelle.json
    (and matrix-soldier.json with Soldier.glb), then copy the .json.gz files into sets/

A real video, crop pass off then on (David's Mac, desktop Chrome):

    node test/real-phone/far-camera/run-video.mjs <video> <lift> <label>

Checked here on a synthetic video through that command (Soldier squat, side view, 9 m, 7 reps, rendered 720x1280 at
30 fps by `test/real-phone/synth/run-video.mjs`, VP8 WebM because this Chromium has no H.264; decoded by WebCodecs to
360x640, as the app does):

    crop pass off: pose in 99/349 samples (28%), 0 from the crop; count refused for 7; detection 16.42 s (42.3 s per minute of video)
    crop pass on : pose in 323/349 samples (93%), 224 from the crop; count 7 for 7; detection 36.37 s (93.8 s per minute of video)

Cost: a crop is one more detect() on a lost frame only; it costs about what a whole-frame detect that finds a pose
costs (a frame with no pose is cheaper: the landmark stage does not run). Per minute of video, the extra time is
(lost frames within 1 s of a pose) x (one detect). Times above are headless Chromium with SwiftShader on this
machine's CPU, not a phone.

# The backward pass (7 October 2026)

David's idea: a video is not live, so a frame still without a pose after the forward pass (whole frame, then the crop
around the last pose) can be read on a crop around the NEXT accepted pose. `src/lib/poseCrop.js` (`BACK_PASS`,
`keepLost`, `fillBackward`) and `src/lib/poseAnalysis.js` (`detectPoseImage(..., { backfill: true })`): no second
decode. A lost frame's pixels are copied into a pooled canvas and kept for `BACK_KEEP_MS` (1 s, at most
`BACK_MAX_FRAMES` = 16, about 0.9 MB each at 360 x 640, so at most about 15 MB). When a pose is accepted (whole frame or
forward crop), the kept frames are read back nearest first, each on a crop (same geometry as the forward crop) seeded
from the pose just after it; the poses found come back on that pose's result as `result.backfill` and the caller puts
them on their own samples (the app's worker and `coreAnalysis.js`, the harness, synth). A frame that has a pose is never
read again; the forward seed and the image smoothing are not touched. Validate and the legacy `analyzeVideo.js` do not
ask for it. Bench hooks: `__WV_BENCH_NO_BACK__` (off), `__WV_BENCH_BACK_KEEP_MS__` (keep lost frames longer).

Variants per set (`matrix-backward-*.json`: `-a` backward pass off, `-b` on, `-b3` on with 3 s kept;
`matrix-heavy-*.json`: `-c` the backward pass off and MediaPipe's heavy pose model, `pose_landmarker_heavy.task`
float16, run by synth.js on the whole frame of the frames still lost, `LOST_POSE=<file>` for run.mjs). The landmarks are
in `sets-backward/`; `backward.test.ts` reads them, checks that every frame with a pose in `-a` is byte-identical in
every other variant, holds the R2 gate for `-b`, and writes `backward.txt`.

Videos, through the harness (`run-video.mjs`, now four runs: crop off; crop on, back off; back on; back on with 3 s
kept): the Soldier squat above, and eight MM-Fit sets of workout w19 (zenodo.org/records/7672767, CC BY 4.0, labels
from MM-Fit's own files as in `test/real-phone/mmfit/inventory.json`), cut to VP9 WebM by frame with ffmpeg.

Results (7 October; times are headless Chromium with SwiftShader on this machine's CPU, with other work running beside
the synthetic renders, so they compare the variants of one set, not runs):

    synthetic far camera, 8 sets   pose 96 % -> 98 % (b) / 100 % (b3) / 96 % (c); exact 6 -> 8 (b) / 8 (b3) / 6 (c) of 8; off by 3 or more 0 in all
    synthetic near, 20 sets with a lost frame   pose 97 % -> 98 % (b); exact 15 -> 15 of 20; off by 3 or more 2 -> 2; no count moved
    synthetic video, Soldier squat 9 m   93 % -> 97 % (b) / 100 % (b3); 7 for 7 in all; detection 127.5 -> 127.7 s per minute of video
    MM-Fit w19, 8 sets   100 % of samples with a pose in every variant: nothing to fill, no count moved (4 of 8 exact), no extra cost
    David's real videos (5)   barbell squat 9 (b): 9 -> 8 for 9; behind-the-neck chin-up: 6 -> 7 for 5; see TRIED.md

Every sample with a pose before the backward pass was byte-identical with it, on every set and video. The backward
pass lost an exact count on David's real barbell squat, so it is off in the app (`BACK_PASS = false`); the benches turn
it on with `__WV_BENCH_BACK__` (synth: `"back": true` in the matrix; run-video.mjs does it for its last two runs).
A person-centred crop on every frame (variant d) was not built: it changes the frames the whole frame already reads,
which the byte-identical rule forbids, and needs a second pose path per frame.
