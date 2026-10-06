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
