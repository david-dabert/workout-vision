# Occluded synthetic sets (7 October 2026)

Why: clean synthetic bodies proved too easy. The backward pass read 8 of 8 synthetic far-camera sets exact and 0 of 5 of
David's real videos (TRIED.md, 7 October). His videos fail for reasons a clean render never shows: a barbell plate hides
the torso from the side, rack uprights stand between camera and body, gym light is dim and the phone's picture noisy and
blurred, other people walk through. This folder adds those to the renderer and measures the current pipeline on them.

## The renderer (test/real-phone/synth/synth.js, `occlude` in a matrix entry; opt-in)

- `plate`: a 2.2 m bar with two 45 cm plates (dark discs, 5 cm thick, at +-0.7 m from its middle along the body's
  left-right axis), on the shoulders for a squat (just behind them), in the hands otherwise, moving with the body every
  frame. From the side the near plate hides the shoulders, upper torso and part of the head.
- `rack`: `{ at, offsets }` vertical uprights (7 x 7 cm, 2.4 m, dark) `at` m from the body towards the camera, shifted
  by each offset to the camera's right. Here one upright, 0.8 m, offset 0.1 m: from the front it crosses the middle of
  the body, from the side it covers the back line (the hips and shoulders' rear edge).
- `light` (scale of both lights), `noise` (Gaussian pixel noise, sigma in 0-255 levels, its own seeded generator so the
  set's timeline does not move), `blur` (that many renders averaged over one frame interval, the body posed at each).
  Here `dim` = light 0.3, noise 12, blur 4.
- `person`: `{ side, depth }` a second, still body of the same model facing the camera, `side` m to the camera's right
  and `depth` m farther away (here 0.75 and 0.5: about half in frame).
- `gym` here = plate + rack + dim + person at once (squat, side view only).
- `alternate: true` (with `lift: "bicep_curl_alternating"`): one arm per rep, the left first (for Task B, below).

With `occlude` absent nothing new runs. Checked: three far-camera sets re-rendered with the new synth.js
(michelle-squat-v90-d9-a, soldier-bicep_curl-v90-d9-a, soldier-overhead_press-v0-d9-a of `../far-camera/sets-backward/`)
are identical to the committed files in every field but `detectMs` (a timing).

With `occlude` present (even `{}`, the `clean` rows), each set also stores `occlusion`: the pose box per sample (image
landmarks with visibility >= 0.5), the frames of the pose region shrunk to 24 x 24 gray bytes (the region from
`motionRhythm.js` `roiFromBoxes` over the set, the frame first shrunk to 128 px gray as `../motion/capture.mjs` does),
and, where a second person stands in the scene, `onTarget` per sample: the pose found is nearer the lifter's projected
hips than the bystander's. A first version compared the pose's hips with the lifter's alone (within 10 % of the frame)
and misfired on clean side views (MediaPipe's hip points sit off the rig's Hips bone); the 14 sets with a person were
rendered again with the nearer-of-two rule (landmarks, boxes and motion frames identical to the first render), and the
54 others had the old field removed from their files, nothing else touched.

## The matrix (matrix-michelle.json, matrix-soldier.json; 68 sets)

Two bodies (three.js examples' Michelle and Soldier) x four lifts: squat (6 reps), overhead press (6), barbell curl (6),
alternating curl (10, five per arm); side view (90) and front view (0); 2.7 m, 360 x 640, 15 fps. Conditions per lift
and view: clean, rack, dim, person on most; plate on the side views of squat, press and curl; gym on the squat's side
view. Seeds are per body, lift and view, so each condition repeats the clean render's timeline exactly.

Rendered through the app's own pose path (getImageLandmarker, detectPoseImage: crop retry on, backward pass off), headless
Chromium with SwiftShader, two renders at a time on this machine's 4 CPUs: 68 sets in about 70 minutes (60 to 440 s a
set; `dim` costs 4 renders a frame, the alternating curls are 32 s long), then 14 sets again for the bystander record.

    SYNTH_OUT=<dir> SYNTH_MODEL=<Michelle.glb> PW_CHROMIUM=<chromium> node test/real-phone/synth/run.mjs test/real-phone/occlusion/matrix-michelle.json
    (and matrix-soldier.json with Soldier.glb), then copy the .json.gz files into sets/

`occlusion.test.ts` reads `sets/` and writes `occlusion.txt`: per set the pose coverage, the samples where the pose found
was the second person, the skeleton's count (`summarizeCount`, the app's counter), the motion count (`motionRhythm.js`
on the stored region frames, with the alternating rule for lifts the catalogue counts on both sides) and the truth.
It is a benchmark, not a gate: it fails only when a file is malformed. No count bar is held here, because these failures
were designed and the bodies are synthetic; a bar would gate the renderer, not the app on real footage. `sheet.jpg`
shows one frame of twelve of the sets.

## Results (occlusion.txt, 7 October)

    condition  sets  pose   skeleton exact / off by 3+ or refused   motion exact / off by 3+   read the bystander
    clean      16    100%   9 / 7                                    12 / 1                     -
    plate       6     66%   0 / 6                                     6 / 0                     -
    rack       16    100%   8 / 6                                    12 / 1                     -
    dim        16     79%   5 / 9                                    13 / 2                     -
    person     12     99%   5 / 6                                     9 / 0                     4 of 12 sets
    gym         2      5%   0 / 2                                     2 / 0                     2 of 2
    all 68: skeleton exact 27, off by 3+ or refused 36; motion exact 54, off by 3+ 4; either exact 60

- The plate is the worst single occluder for the skeleton: 6 of 6 sets lose their count (5 refused, 1 reads 0), against
  the clean render of the same set 6 of 6 worse; pose coverage falls to 39-99 %. The motion count reads all 6 exact.
- A bystander half in frame takes the pose on Michelle's side views (160 of 296 samples of the squat, 114 of 307 of the
  press, 167 of 291 of the curl): the model (one pose per frame) reads whichever person it finds better.
- `dim` (light 0.3, noise 12, blur 4) drops coverage on side views to 15-56 % for Michelle and 37 % for the Soldier's
  press; the skeleton refuses there.
- `gym` (all at once): 2 % and 7 % of samples with a pose; refused; the motion count, read on the whole frame when under
  30 % of samples hold a pose, is still 6 for 6 on both.
- The clean renders are not all easy for the skeleton either (9 of 16 exact): the squat from the front reads 0 or 6, the
  Soldier's curl from the side 3, Michelle's press from the side 0. Those are counter-side limits on these bodies at
  2.7 m, present before any occluder, and they also sit in the occluded rows.
- The motion count misses 4 sets by 3 or more, all alternating curls from the side (5 for 10): there the two arms do not
  sit in the two halves of the region, so the alternating rule does not apply (below).

Limits: the bodies are rigged models, not people; the occluders are geometric (a disc, a bar, a duplicate body), the noise
is white and the blur synthetic; no real camera's compression, rolling shutter or auto-exposure. The motion count is read
from the stored 24 x 24 frames, not from a decoded video (the video check below is the cross-check). These numbers say
which conditions break which count on clean geometry; they do not estimate rates on real footage.

## Video path (a few sets, through the harness)

Seven sets rendered as videos (`../synth/run-video.mjs`, 720 x 1280, 30 fps, VP9 WebM; occluders and degradations drawn
as in the stored sets, the noise before the encoder) and read by `../motion/capture.mjs` (the app's decode, WebCodecs, 15
samples per second, pose with crop retry), then `../motion/analyse.mjs`. Videos and captures held outside the repository.
See the end of this file for the table.

Results (7 October; `analyse.mjs` on the captures; label = reps rendered; skel = the app's counter on the same run):

    set                                         label  skel     pose  motion  (motion without the alternating rule)
    soldier-squat-v90-clean                     6      6        100%  6
    soldier-squat-v90-plate                     6      5         86%  6
    soldier-squat-v90-gym                       6      refused   41%  6
    michelle-overhead_press-v90-plate           6      refused   73%  6
    michelle-bicep_curl_alternating-v0-clean    10     10       100%  10      (5)
    soldier-bicep_curl_alternating-v0-dim       10     17       100%  10      (5)
    michelle-bicep_curl_alternating-v90-clean   10     refused  100%  5       (5)

Through a decoded video the pose finds more than on the stored 360 x 640 renders (squat with plate 86 % against 65 %, gym
41 % against 2 %, press with plate 73 % against 67 %): the video is rendered at 720 x 1280 and its noise is softened by the
encoder and the decode's downscale. The skeleton's verdicts agree in kind (plate and gym: wrong or refused); the motion
count reads 6 of 7 exact, the miss being the side-view alternating curl, as on the stored sets.
