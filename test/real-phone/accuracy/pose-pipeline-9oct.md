# Run log: a phone-sized pose pipeline against MediaPipe (9 October 2026)

Written and committed before any count of this run was read.
The plan is section 4 of `research-9oct.md`; this file freezes its settings and its pass rule, and records every change to that plan.
Bench only: nothing under `src/` changes.
David asked for the run on 9 October ("Start the test"); phone only, no server (his decision, same day).

## Question

Does arm B (RTMDet-nano, a pose-following box, RTMPose-m) keep the core's gain over MediaPipe beyond David's 12 videos, without a loss the scoreboard would refuse?

## Reconciliation, settled before the run

`TRIED.md` (pose probe, 8 October) says RTMPose-m fails the real-video gate; the sweep of 9 October says no set is newly off by 3 or more.
Both read the same numbers; they apply different rules.
`npm run scoreboard` (scoreboard.test.ts, lines 37 to 43) fails a set already off by 3 or more when its error grows ("known catastrophic, gated on growth").
The sweep's summary checked only sets newly off by 3 or more.
RTMPose-m reads sissy_squat_7_5006 as 1 where MediaPipe reads 4, for a label of 7: the error grows from 3 to 6, and the scoreboard fails it.
The critic was right under the repository's rule.
This run uses the scoreboard's rule (below), not the weaker one written in `research-9oct.md`.

Already known before this run, from the sweep's reading of 9 October (`research-oct8/sibx`, scratchpad, the same arm B settings):
- on David's videos, arm B read sissy_squat_7_5006 as 1 (MediaPipe 4, label 7): the error grows from 3 to 6, so arm B is expected to fail condition 1 on David's videos;
- it read sissy_squat_7_5008 as 0, but that set is refused for every arm (the app's read refusal, below), as the scoreboard refuses it today;
- every source read 5006 anywhere from 1 to 8 (pose probe critic: noise), but the gate is the gate.
The David part of this run is therefore not blind. The RepCount-A part is.
(Corrected before any count of this run was read: the first version of this file, 8c58e60, also counted 5008 against arm B, overlooking the read refusal.)

## Arms

- **A.** MediaPipe full as shipped. The landmarks the built app stored for each set (David's videos: `sets-07oct-video/`; RepCount-A: `public/repcount/build/`), not re-read. World landmarks for the core, image landmarks for PSC and the body check, as the app.
- **B.** RTMDet-nano person detector (320 input, score at least 0.3) on 1 sample in 10 (POSE_BOX=10); on the other samples the box is the previous pose's keypoint box enlarged 1.25 times about its centre. On a detector sample the lifter is the detected box with the highest overlap (IoU at least 0.1) with the previous lifter box; with none, the previous box is held for up to 15 samples, then the largest detected box. First sample: the largest box. RTMPose-m (256 x 192, SimCC) reads 17 points in that box. Script: `research-oct8/scripts/det_topdown.py`, unchanged in its pipeline.
- **C.** Dropped from this run. ViTPose+ S int8 was a reference only; its exported file was deleted with the probe's folder on 9 October to free disk, and rebuilding it decides nothing. The probe's reading of it on David's 12 videos (core 8/11/0/1, other boxes) stays in `TRIED.md` as context.
- **D.** RTMO-s, one stage, 640 input, every person in the frame. Lifter rule, new for this run, as the plan asks (on 8 October D borrowed a server-sized detector's box): first sample, the person with the largest box among scores of at least 0.3; afterwards, the person whose keypoints lie nearest the previous lifter's (mean distance over the points both score at least 0.3, divided by the previous pose's box height), accepted under 0.5; with none, no pose on that sample, and after 15 such samples the largest box again. Reference only: it cannot move to the app in this run.

Model files, from Hugging Face mirrors (the official download.openmmlab.com is not reachable from here):
- `rtmpose-m.onnx`, bukuroo/RTMPose-ONNX, 54,330,877 bytes, the same size as the probe's file of 8 October; checkpoint (AIC+COCO or body7) and licence not verified.
- `rtmdet-n-person.onnx`, bukuroo/RTMDet-ONNX, 4,033,639 bytes, the same size as the probe's.
- `rtmo-s.model.onnx`, Xenova/RTMO-s, 39,636,400 bytes, the file of 9 October.
Before reading any RepCount-A count, arm B is re-run on one of David's videos and compared with the sweep's output of 9 October, to show the re-downloaded files give the same points.

## Settings, frozen

- **Frames.** Each arm reads, for each of arm A's sample times, the decoded frame of the original video nearest that time (RepCount-A: the stored sample times; David's videos: the probe's frame times per sample, as on 8 and 9 October, and for the standing barbell curl, which the probe never read, the stored sample times on the original file).
- **Score to visibility.** A network's score is the landmark's visibility as is (no rescaling); the core's own 0.5 gate applies.
- **17 to 33 points.** Each COCO point fills its MediaPipe slot (`pose-probe/eval/common.py`, COCO_FOR_MP); the 12 MediaPipe slots with no COCO point (hands, feet, mouth) take a neighbour's position with visibility 0.
- **Angles.** Two-dimensional, in the image plane: x and y in units of the frame's height (x scaled to the frame's aspect), z = 0. Arm A keeps MediaPipe's world landmarks, as the app.
- **Image landmarks** for PSC and the body check: the same points, x divided by the frame's width and y by its height, as the app stores them.
- **No pose** on a sample: no landmarks (null), as the app stores a sample with no person.
- **The app's read refusal** (a video the app's decoder read only in part, `read.partial`: sissy_squat_7_5008) is a refusal for every arm, as `npm run scoreboard` refuses it: a pose network changes what is seen in a frame, not which frames the decoder delivers. The arm's count on it is shown for information only.
- **Frames, RepCount-A.** The stored sample times sit within a quarter of a frame of the nominal frame grid (0.235 at most over the 57,770 samples; checked after the first version of this file, which said 0.1 from four sets); each arm takes the nearest decoded frame, so the setting is unchanged.
- **Counters,** all from the repository at the commit of this file: `summarizeCount` (the core), then `withProposal` (PSC on a refusal), then `withBodyCheck` (the flag and its second count), each on `{ ...summarizeCount(wl, ts, lift), worldLandmarks, timestamps, imageXY }`, as `body-check.test.ts`.

## Suites

- **David's 14 videos** (`sets-07oct-video/manifest.json`, labels his, R1). Read where they are; nothing derived from them leaves the scratchpad except counts. The standing barbell curl's label was given after the app proposed 8 (David, 9 October: he then watched the video and counted 8); it is reported, and decides nothing on its own.
- **RepCount-A build half, 124 sets.** Streamed one video at a time from lmms-lab-eval/repcounta-lance by video id, read by B and D, deleted. Labels as published. The 79 sets whose class maps to a counter are reported apart; the 45 others count only through PSC.
- **The prone Y/T videos** (David's, 8 October): coverage only (share of samples with both shoulders and both wrists scored at least 0.5). No label, no counter.

## Pass rule, frozen

Arm B goes on to an in-app build behind a flag, for David's iPhone only, if all four hold:
1. **David's 14, the scoreboard's rule against arm A:** core exact not lower than A's; no set newly off by 3 or more; no set already off by 3 or more with a larger error; no set newly refused.
2. **The 79 mapped RepCount-A sets:** core exact not lower than A's; sets off by 3 or more not more than A's.
3. **McNemar,** paired, exact or not, over the 93 sets (14 + 79): reported with its two discordant counts and its exact two-sided p. Reported, not a condition.
4. **Time per sample** at most twice MediaPipe's on the same harness: 141 ms against 88 ms in headless Chromium, single thread (`research-9oct.md`, [B]); not measured again in this run.

A failure of condition 1 on the two sissy squats alone, with condition 2 met, is reported to David as such: the gate is his to keep or change, not this run's.

## Results

Not yet read.
