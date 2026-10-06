# Batch of 1 October 2026 (sets 16 to 20): held, not scored (CLAUDE.md R1, R12)

The files are whole (samples match each video's length at 15 per second) and carry David's counts. But the
movement in four of them does not match their label (95th minus 5th percentile of each joint angle, 3D):

| File | Label | Knee | Hip | Elbow | Shoulder | Reading |
|---|---|---:|---:|---:|---:|---|
| set16 | squat 9 | 12 | 19 | 87 | 135 | an arm movement (a raise or a press), not a squat |
| set17 | bench press 9 | 28 | 22 | 119 | 29 | the same video as sets-29sep/bicep_curl_5 (landmarks 0.18 % of the frame apart, median) |
| set18 | bodyweight squat 9 | 125 | 115 | 98 | 121 | a squat: consistent |
| set19 | lateral raise 7 | 47 | 71 | 46 | 18 | a lower-body movement, not a raise |
| set20 | lat pulldown 8 | 64 | 49 | 24 | 31 | a leg movement, not a pulldown |

Likely cause: the batch collector orders videos by file date; iPhone Safari dates a file when Photos hands it
over, and with a large pick the thumbnails that let a pairing be checked did not load. Counted on these
labels the core scored 0 of 5 exact; that measures the pairing, not the counter.
Nothing is relabelled here. David decides each pairing; set18 alone is consistent with its label.

6 October: David collected three of these videos again, each under its exercise and count (sets-06oct/, matched by landmarks, mean difference 0.003 of the frame):
- set19 (held as lateral_raise 7) is a hip thrust, 6 reps: sets-06oct/set01_hip_thrust_6_side_4091c266.
- batch2/set11 (hip_thrust 7) confirmed: sets-06oct/set02_hip_thrust_7_side_b717b687.
- batch2/set10 (hip_thrust 7) is the video of sets-29sep/hip_thrust_6_side_cf8c21d7, labelled 6 on 29 September and 7 on 1 and 6 October. David confirmed 6 on 6 October: the 29 September label stands, and the video stays scored once, as sets-29sep/hip_thrust_6.
