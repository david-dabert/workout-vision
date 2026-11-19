# Phone pose files

Every person David's iPhone saw in each frame, saved with `?poses=1` and « Enregistrer les poses ».
Times in seconds; image points [x, y, visibility], world points [x, y, z].

- `files/IMG_4186-seated_row-label10.json.gz`: seated row on cable, 19 November 2026, iPhone Safari (iOS 18.7).
  Label 10, David's count (R1). The first pose of each frame counts 9: the bystander is ranked first from about 12.2 to 14.5 s, while David is the second pose in every one of those frames.
  The person nearest the previous frame's torso counts 10 (scratch run, 19 November 2026). Tuning data (docs/OPERATING-LOOP.md, F12).

## Next files: David's labelled videos, read again with `?lifter=1&poses=1`

The default count can read the lifter only once these are held to R2 (asking every pose moves the first pose itself; TRIED.md, 19 November 2026).
Each file goes to `files/` with its line in `sets.json` (its label is the one already stored for the video, R1).
- `sets-07oct-video/barbell_squat_9_a.json.gz`
- `sets-07oct-video/barbell_squat_9_b.json.gz`
- `sets-07oct-video/behind_neck_chin_up_5.json.gz`
- `sets-07oct-video/hanging_leg_raise_6.json.gz`
- `sets-07oct-video/lying_biceps_curl_11.json.gz`
- `sets-07oct-video/machine_chest_supported_row_6.json.gz`
- `sets-07oct-video/machine_seated_back_extension_18.json.gz`
- `sets-07oct-video/pendulum_squat_7.json.gz`
- `sets-07oct-video/seated_dumbbell_curl_10.json.gz`
- `sets-07oct-video/sissy_squat_5_5011.json.gz`
- `sets-07oct-video/sissy_squat_7_5006.json.gz`
- `sets-07oct-video/sissy_squat_7_5008.json.gz`
- `sets-07oct-video/sissy_squat_9_5007.json.gz`
- `sets-07oct-video/standing_barbell_curl_8.json.gz`
- `sets-14nov-video/dumbbell_bench_press_9_angle.json.gz`
- `sets-18oct-video/lat_pulldown_11_back.json.gz`
- `sets-18oct-video/squat_6_front.json.gz`
