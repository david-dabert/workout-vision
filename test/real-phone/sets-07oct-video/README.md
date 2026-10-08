# Real video, 7 October 2026: David's 13 gym videos, read whole by the built app

Why: the stored real-phone sets are landmarks the collector saved on David's phone; nothing in the gates read a real
gym video through the app from the file to the count. These 13 sets do: each is the app's own extraction of one of
the videos David sent on 7 October, with his label (R1). `npm run scoreboard` counts them in its own section,
"Real video, 7 October", under the same R2 rules as the other sets (no exact count lost, none newly off by 3 or more,
none newly refused), against their own baseline (`videoCounts` in `../accuracy/scoreboard-baseline.json`).

## What each file holds (`<name>.json.gz`)

- `lift` (the catalogue key the set is counted as), `count` (David's label, copied from his labels.txt, never from
  the app), `labelSource`, `view` (as stated by David or seen in the video; null where neither says), `what`,
  `original` (the file he sent) and `videoSha256` (of that original, shrunk on his phone: H.264, variable frame timing).
- `timestamps`, `worldLandmarks` (exactly as the app holds them; the counter reads these), `imageLandmarks` (rounded to
  1e-4 of the frame, 0.06 px at 640 px, to keep the folder small), `metadata` (the extractor's: decoder, size, duration,
  repeats), `frame`, `extraction`, `version` (1.4.0), `analysisSeconds` (headless Chromium on a 4-CPU machine, two
  captures at a time: not a phone timing).
- `read`: `{ partial: false }`, or, for a read the app itself refuses (`PartialReadError`), `partial: true`, the app's
  message and `timestampsNominal: true`: the landmarks are the pose worker's answers on sample times index / 15 s.
  The scoreboard counts such a set as refused, as the app shows no count for it.
- `motion`: what the motion rhythm count (`src/lib/counting/motionRhythm.js`) reads: the pose region of the set
  (`roi`, from `roiFromBoxes` over the per-sample pose `boxes`) and, per sample, that region of the sample's picture
  shrunk to 24 x 24 gray bytes (base64), as the occlusion sets store them. The picture is the canvas the pose model
  reads (640 px long side), drawn to 128 px gray first, as `../motion/capture.mjs` does.

13 files, 11.6 MB in all. No video is in the repository.

Added 8 October 2026: `standing_barbell_curl_8` (`barbell_curl`, David's count 8: the app refused the set on his
iPhone, proposed 8, and he confirmed "it was indeed 8 reps"). Side view against bright windows; at the top of each rep
the plates hide the near elbow and wrist (the counted elbow seen on 35 % of samples, under the 50 % the count needs),
so the app refuses it: the scoreboard holds it as refused, the case a reading of the bar itself would have to fix.
Captured the same way (`capture.mjs`, the original re-encoded to VP9 with its frame times by PyAV, as this machine has
no ffmpeg); `labelSource` in the manifest says where its label comes from. 14 files.

## How they were made (`capture.mjs`)

1. Each original re-encoded to VP9 in MP4 with its own frame timestamps (this Chromium has no H.264 decoder):
   `ffmpeg -i <original> -an -c:v libvpx-vp9 -crf 18 -b:v 0 -deadline good -cpu-used 4 -row-mt 1 -fps_mode passthrough
   -enc_time_base 1:600 -video_track_timescale 600 <name>.mp4`. The packet timestamps of every re-encode equal the
   original's (`ffmpeg -c copy -f framemd5`, sorted pts, identical on all 13).
2. `npm run build`, then `node test/real-phone/sets-07oct-video/capture.mjs <folder of re-encodes>` with
   `PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` and `SETS_ORIGINALS=<folder of originals>`: the
   built app served by `vite preview`, its check page (`check.html`, which calls `analyzeCoreVideo`, the function of
   the upload screen), the video picked through the page's file input; the result is the page's `wv:core-result`
   event. An init script only observes: it copies each sample's canvas read to a small gray picture and records the
   pose worker's answers (used only when the app refuses the read). Built from bac414b (1.4.0).

## Lifts (catalogue keys)

No catalogue entry was added: every lift maps to an existing key whose counting rule (joint, rest side, first
phase) is the movement's.

| set | David's lift | key | rule |
|---|---|---|---|
| barbell_squat_9_a, _b | barbell squat | `squat` | knee, rest high |
| behind_neck_chin_up_5 | behind-the-neck chin-up | `chin_up` | elbow, either side |
| hanging_leg_raise_6 | hanging leg raise | `hanging_leg_raise` | hip |
| machine_chest_supported_row_6 | machine chest-supported row | `chest_supported_row` | elbow |
| lying_biceps_curl_11 | lying cable curl | `cable_curl` | elbow, rest high, concentric first: the same rule as `lying_barbell_curl` |
| seated_dumbbell_curl_10 | seated incline dumbbell curl | `incline_dumbbell_curl` | elbow |
| pendulum_squat_7 | pendulum squat machine | `hack_squat` | knee, rest high, eccentric first: the machine squat rule |
| machine_seated_back_extension_18 | machine seated back extension | `machine_seated_back_extension` | hip, rest low |
| sissy_squat_* (4) | sissy squat (one kneeling) | `sissy_squat` | knee |

## Counts on 7 October (the app's counter, bac414b; `../accuracy/scoreboard.txt`)

| set | label | app | pose |
|---|---|---|---|
| barbell_squat_9_a | 9 | 9 | 97 % |
| barbell_squat_9_b | 9 | 9 | 96 % |
| behind_neck_chin_up_5 | 5 | 6 | 87 % |
| hanging_leg_raise_6 | 6 | 6 | 72 % |
| lying_biceps_curl_11 | 11 | 11 | 97 % |
| machine_chest_supported_row_6 | 6 | 5 | 100 % |
| machine_seated_back_extension_18 | 18 | 17 | 98 % |
| pendulum_squat_7 | 7 | **14** | 98 % |
| seated_dumbbell_curl_10 | 10 | 10 | 97 % |
| sissy_squat_5_5011 | 5 | refused | 98 % |
| sissy_squat_7_5006 | 7 | **4** | 100 % |
| sissy_squat_7_5008 | 7 | refused (read: 623 of 685 samples; the original has no frame from 20.0 to 33.6 s) | 100 % |
| sissy_squat_9_5007 | 9 | 9 | 100 % |

6 exact of 13, 2 off by 3 or more (kept in the gate as known: they fail only if their error grows), 2 refused.
These are VP9 re-encodes read by desktop Chromium, not David's iPhone: his phone counted barbell squat a 9 and the
seated back extension 17, as here.
