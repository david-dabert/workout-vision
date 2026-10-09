<!-- Written by the research sweep of 8-9 October 2026 (nine agents: three sweeps, five adversarial checks, one synthesis). Its source notes ([S], [V1]-[V5], [P], [PP], [B]) were kept in the session's scratchpad, outside the repository, and are not part of this file; the figures below are as the agents reported them. Read-only research: it changed no code. -->

# Can GitHub and arXiv fix the counting? Research report for David (9 October 2026)

This was read-only research. No file in the repository changed. Your private videos stayed where they already were, in this session's scratchpad. They were not sent anywhere else.

Sources are given in square brackets:
- [A] test/real-phone/accuracy/anatomy-8oct.md, with line numbers.
- [T] TRIED.md, with line numbers.
- [V1] to [V5] are the five adversarial checks, in research-oct8/verify-1.md to verify-5.md. V1 is ESCounts, V2 SkimFocusNet, V3 RepNet, V4 DeTRC and V5 audio.
- [S] is the sweep: research-oct8/sweep-counting.md, sweep-tracking.md, sweep-pose.md and candidates.md.
- [P] is research-oct8/sibx/summary-final.txt: pose models counted on your videos.
- [PP] is pose-probe/eval/summary.txt: the 8 October pose probe.
- [B] is research-oct8/bench/bench-clean-table.txt: browser timings.

The folders research-oct8/ and pose-probe/ sit under /tmp/claude-0/-home-user-workout-vision/a8df0d7c-b49e-5648-b670-199f28c23c83/scratchpad/.

"Exact" means the count equals your label. "Off by 3+" means wrong by 3 or more.

## In short

- **GitHub has better parts, not a better counter.** Better pose networks from GitHub gained exact counts on your videos. No counter downloaded from GitHub beat the app's own counter.
- **RepNet was the one video counter we could run end to end.** On public gym data it got 15 of 79 exact. The app's counter got 29 [V3].
- **The biggest gains still on the table are not in any repository:**
  - your rule for a last rep cut by the end of the video;
  - a per-rep range floor for small movements;
  - more of your labelled videos, so that a gain can be proved at all.
- **First experiment:** test the phone-sized pose pipeline on your 14 videos and on 124 public RepCount-A videos. The pass rule is written before the run (section 4).

## 1. Is the answer to accuracy in GitHub and arXiv?

The evidence supports a narrower claim:
- GitHub supplies better parts and good test benches.
- arXiv supplies ideas. They pay off once rebuilt on pose and gated.
- Neither supplies a ready counter that beats the current one on gym video.

### What the evidence supports

**Better pose networks fix the worst landmark errors.**
- On the pendulum squat, MediaPipe puts the left ankle above 0.45 of the frame height on 139 of 559 samples. ViTPose+ B, ViTPose+ L and DWPose do so on 0 [T line 113].
- A control ran MediaPipe on the lifter's crop, and it still invented the ankle. The fix comes from the network, not the box [T line 113].

**Every good pose network gained exact counts on your videos.** These are 12 of your videos read whole, counted by the app's own core. None has been through the scoreboard yet.

| Pose input | Exact of 12 | Source |
|---|---:|---|
| MediaPipe (today) | 6 | [P] |
| ViTPose+ B | 8 | [P] |
| ViTPose+ S int8 | 8 | [P] |
| RTMPose-m with a server-sized box | 8 | [P] |
| RTMO-s | 8 | [P] |
| Phone-sized pipeline (RTMDet-nano + pose box + RTMPose-m) | 7 | [P] |

The same three sets improve with almost every network: chin-up, back extension 18 and pendulum squat [P].

**A body detector finds bodies that MediaPipe loses.** RTMDet-nano found a person on 127 of 127 prone Y-raise samples. MediaPipe returned a pose on 32 % of them [S, candidates.md].

**Paper ideas pay off when rebuilt on pose and gated.**
- PSC applies RepNet's self-similarity idea to pose signals [A line 274].
- Its proposal on refused sets shipped under R2 [T line 99]:
  - your videos went from 6 to 7 exact;
  - public half A went from 255 to 264, and half B from 235 to 247;
  - none became newly off by 3+.

**Permissive building blocks exist** [S]:
- tapnet point trackers: Apache-2.0 for code and checkpoints, per its README;
- ByteTrack and OC-SORT: MIT;
- OpenCV.js optical flow: Apache-2.0.

### What the evidence does not support

**No counter from a repository beats the core on gym video.**
- RepNet was the one video counter we could run end to end.
- On the RepCount-A build sets that the app counts, it got 15 of 79 exact. The core got 29 [V3].
- On your 14 videos, ten readout settings gave between 1 and 7 exact [V3].
- The authors' current default gave 3 of 14 exact, with 3 sets off by 3+ [V3].
- The best setting was chosen after seeing the results. Even so, it made sissy squat 5007 newly off by 3+ [V3].

**Headline numbers do not survive a close read.**
- PoseRAC reports an OBO of 0.56. OBO is the share of videos counted within one rep. For each test video, PoseRAC keeps the class whose count is closest to the truth [A line 249].
- The best verified exact rate with public code is ESCounts, at 0.245 on RepCount-A test (paper Table 1a) [V1]. That is wrong on 3 videos in 4.
- For a rough comparison only, on a different subset: the core is exact on 29 of 79 mapped RepCount-A build sets, which is 37 % [T line 75].

**The papers have not solved the missing piece either.** The hard part is knowing where the set starts and stops inside a recording.
- The best published locator, OVRCounter, reaches 0.45 overlap with the true segment. RepNet reaches 0.26 to 0.35 (OVR paper Table 4) [S].
- ESCounts locates single reps at 33.5 % mAP (Table 10) [V1].
- On RepCount-A, RepNet's "inside the set" score flagged a median 35 % of the time outside the labelled reps as repeating [V3].

**Released code often does not run.**
- SkimFocusNet's test.py imports a module that does not exist [V2].
- DeTRC lacks its mmaction package. Its configured position embedding crashes at test time [V4].
- ESCounts' weights cannot be reached from here. One open issue (#9, unverified) reports OBO 0.06 with them [V1].
- SkimFocusNet, the RepNet PyTorch port and both audio repositories have no licence file [V2, V3, V5].

**The strong video models need a server.**
- ESCounts' encoder has 87M parameters. It costs 180 G operations per 16-frame clip [V1].
- RepNet costs about 1.9 T multiply-accumulates per 30 s clip [V3].
- A server means uploading your users' gym videos. That reverses the app's on-device design, and it is your decision, not a research result.

**Breadth costs accuracy everywhere.**
- LiFT is the only published system at the app's breadth: 1,900+ exercises. It reports 85.3 % within one rep and released no code [A line 255].
- Narrow per-exercise rule counters report 97-99 % [A line 255].
- The core is that narrow design. Its counting logic matches the best documented pose counters [A line 250].

**Video-language models do not count.** On PushupBench, the best open model listed (Qwen3-VL-32B) is exact on 11.8 %. Always answering "10" is exact on 8 % [S].

### What decides accuracy on your own sets today

**On your 14 videos, the core is wrong on 5 sets** [V2; A set table]:

| Set | Core minus label | Cause |
|---|---|---|
| Chin-up | +1 | dismount |
| Chest row | -1 | last rep cut by the end |
| Back extension 18 | -1 | a person passing behind |
| Pendulum squat | +7 | invented ankle |
| Sissy squat 5006 | -3 | knee range too small |

- A better pose network fixed 3 of these 5 in the probe [P].
- The other two need a rule change and a decision from you:
  - A 15° per-rep floor takes 5006 from 4 to 7 in a scratch run [A line 21].
  - The cut last rep needs your counting convention [A lines 120-124].

**On the 20 stored sets, 4 of the 15 deciding sets are not exact** [A set table]:
- two have a last rep cut by the end: hip thrust 7 and lateral raise 9;
- one has a misread joint: back extension 13;
- one has a label question: reverse curl 10 [A line 76].

These sets store landmarks, not frames, so no pose change can be measured on them [A line 226].

**The exam is too small to prove a change.**
- Three sets gained against one lost gives a sign-test p of 0.6 [T line 113].
- One set moves the real-video rate by about 7 points [A line 222].
- More of your labelled videos, filmed from rest back to rest, are needed before any repository's gain can be proved. STATE.md lists those exam sets as waiting on you.

**The core's logic is close to the best it can do with MediaPipe's landmarks.** Every fix that repaired one real video broke another, because the input is inconsistent [T line 98]. That is why the pose input is the lever, and the counter is not.

## 2. Candidates and shortlist

### 2a. All 26 candidates, ranked by a simple score

The score runs from 0 to 10. It is Reach + Evidence + Phone + Rights. I made it as a sorting aid for this report; it is not a measurement.

**Reach (0-3).** Add up the sets in the anatomy's mode table [A lines 10-25] for the modes the candidate targets. Drop any mode a verifier showed it does not fix. Then convert:
- 0 to 5 sets: 0
- 6 to 14 sets: 1
- 15 to 24 sets: 2
- 25 or more: 3

The mode table counts a set once for each of three counters. On the shipped path, only 9 sets decide [A line 111].

**Evidence (0-3).**
- 0: none, or measured here and worse than the core.
- 1: indirect only. This means tracking, segmentation or pose benchmarks, or synthetic sets.
- 2: a published counting result on a public benchmark, or coverage measured on your videos without counts.
- 3: counts measured on your videos with a gain over the core, not yet through R2.

**Phone (0-2).**
- 0: server only.
- 1: unknown, or measured and heavy.
- 2: browser cost within about 2x of today's pose model (measured or published), or negligible compute.

**Rights (0-2).**
- 0: no licence, or no runnable code and no weights.
- 1: a restrictive licence (GPL, AGPL, non-commercial, gated or custom), or weights unreachable from here.
- 2: a permissive licence with reachable weights, or nothing to download.

The modes, with their set counts [A lines 10-25]:

| Mode | What fails | Sets |
|---:|---|---:|
| 1 | Extra movement at the start or end | 16 |
| 2 | Learned counter's rate miscalibrated | 7 |
| 3 | PSC picks the wrong period | 6 |
| 4 | Last rep cut by the end | 6 |
| 5 | Joint misread | 6 |
| 6 | Pose lost | 3 |
| 7 | PSC's rest side inverted | 3 |
| 9 | Bystander | 2 |
| 10 | Signal too small | 2 |
| 13 | Left/right swaps | 0 |

| # | Candidate | Modes kept | R | E | P | Rt | Score | Status |
|---:|---|---|---:|---:|---:|---:|---:|---|
| 1 | RTMDet-nano + pose box + RTMPose-m | 5, 6, 9 | 1 | 3 | 2 | 2 | 8 | Shortlist 1 |
| 2 | RTMO-s / RTMO-t | 5, 6, 9 | 1 | 3 | 1 | 2 | 7 | RTMO-s: reference arm in shortlist 1; RTMO-t rejected |
| 3 | Optical flow on the weight (OpenCV.js LK, Farneback) | 1, 5, 6, 7, 9 | 3 | 1 | 1 | 2 | 7 | Shortlist 2, stage 2 |
| 4 | ByteTrack / OC-SORT, lifter chosen over the whole set | 1, 6, 9 | 2 | 1 | 2 | 2 | 7 | Shortlist 3 |
| 5 | ESCounts | 1, 3, 5, 6, 13 | 3 | 2 | 0 | 1 | 6 | Shortlist 5, kill test only |
| 6 | DeTRC idea, as a head on pose | 1, 2, 3, 7 (verifier's list) | 3 | 1 | 1 | 1 | 6 | Shortlist 4 |
| 7 | Learned point trackers (tapnet, LocoTrack, CoTracker3) | 1, 5, 6, 7, 9 | 3 | 1 | 0 | 2 | 6 | Shortlist 2, stage 1 option |
| 8 | SmoothNet / DeciWatch | 2 | 1 | 1 | 2 | 2 | 6 | Rejected |
| 9 | Audio (Sight and Sound, DualCounter) | 3, 5, 6 | 2 | 1 | 1 | 1 | 5 | Rejected |
| 10 | RACnet training ideas | 1, 3 | 2 | 1 | 1 | 1 | 5 | Optional arm of shortlist 4 |
| 11 | EdgeTAM / EfficientTAM | 5, 6, 7, 9 | 1 | 1 | 1 | 2 | 5 | Parked behind shortlist 2 |
| 12 | MoveNet Thunder | 6 | 0 | 1 | 2 | 2 | 5 | Rejected |
| 13 | YOLO26n-pose | 6, 9 | 0 | 2 | 1 | 1 | 4 | Rejected |
| 14 | OVR dataset (start and end labels) | 1 | 2 | 1 | 1 | 0 | 4 | Parked |
| 15 | Equipment detectors (D-FINE, YOLO) | 5, 6, 7, 9 | 1 | 1 | 1 | 1 | 4 | Parked behind shortlist 2 |
| 16 | Segment Any Motion | 5, 6, 9 | 1 | 1 | 0 | 2 | 4 | Rejected |
| 17 | MotionBERT / MotionAGFormer lifting | 5, 13 | 1 | 1 | 1 | 1 | 4 | Parked |
| 18 | SkimFocusNet | 5, 6 (1, 3, 9 dropped) | 1 | 2 | 0 | 0 | 3 | Rejected |
| 19 | SAM 3 / 3.1 | 5, 6, 9 | 1 | 1 | 0 | 1 | 3 | Parked, offline tool only |
| 20 | PMPose / ProbPose | 5, 6, 9 | 1 | 1 | 0 | 1 | 3 | Rejected |
| 21 | D2-STX | 3, 5, 6 | 2 | 0 | 0 | 1 | 3 | Rejected |
| 22 | PersonalRAC (not verified) | 1, 3 | 2 | 0 | 1 | 0 | 3 | Rejected |
| 23 | Frame-embedding self-similarity | 3, 6, 9 | 1 | 0 | 1 | 1 | 3 | Rejected |
| 24 | Low-light pose (UDAPose, DA-LLPose, ExLPose) | 6 | 0 | 1 | 0 | 1 | 2 | Rejected |
| 25 | RepNet | 5, 6, 13 (1, 3 dropped after measurement) | 1 | 0 | 0 | 0 | 1 | Rejected |
| 26 | Video-language models | none | 0 | 0 | 0 | 1 | 1 | Rejected |

Ties are ordered by Evidence, then by Reach.

The shortlist follows the score, with three departures:
- RTMO folds into item 1, because it is the same lever.
- The learned point trackers fold into item 2, because they test the same idea.
- SmoothNet is dropped despite its score of 6. It scores on cheapness and licence, not on what it fixes. Its own README table shows it removes jitter, not a joint hidden for a whole rep [S].

### 2b. Shortlist

#### 1. Better pose input that fits the phone: RTMDet-nano + pose-following box + RTMPose-m (score 8)

**How it works**
- A generic body detector, RTMDet-nano, runs on 1 sample in 10.
- On the other samples, the box is the previous pose's box enlarged 1.25 times, in the style of rtmlib's PoseTracker.
- RTMPose-m reads the pose inside that box.
- This replaces BlazePose's face-based detector [S].

**What it fixes.** Measured on 12 of your videos, not yet through R2 [P]:
- Core exact goes from 6 to 7.
  - Gained: chin-up (mode 1), back extension 18 (mode 9) and pendulum squat (mode 5).
  - Lost: hanging leg raise (5 for 6) and lying curl (10 for 11).
  - No set became newly off by 3+.
- PSC gets 7 exact. The spec-guided counter on PSC's cycles gets 8.
- On mode 6, it finds the prone body on every sample [S]. It still refuses the standing barbell curl, where the elbow is seen on 46 % of samples [S].
- Two reference arms on the same 12 videos [P]:
  - RTMO-s gets 8 exact; it also gets sissy 5006 right.
  - ViTPose+ S int8 gets 8 exact.

**Phone or server.** It can run in the browser.
- Measured in headless Chromium with onnxruntime-web WASM on 2 threads [B]:
  - RTMPose-m takes 136 ms a sample.
  - RTMDet-nano takes 47 ms.
  - With the detector on 1 sample in 10, that is about 141 ms a sample.
  - MediaPipe takes 88 ms on the same harness, so this is 1.6 times slower.
- The model files are 4.0 MB and 54.3 MB [S].
- Not measured on an iPhone.

**Test on your 14 videos, and the gate.** See section 4. In short:
- the same videos go through every arm;
- 124 public RepCount-A videos serve as a second gate;
- the R2 rule applies: no exact count lost, none newly off by 3+.

**Effort (estimated)**
- The experiment: about 1 day, plus 1-2 hours of CPU.
- If it passes, bringing it into the app takes several days:
  - onnxruntime-web in the pose worker;
  - mapping its 17 COCO points onto the app's 33 landmarks;
  - counting on 2D angles;
  - checking the range and tempo measures again under R9.

**Main risks**
- 12 videos cannot separate the models (p = 0.6) [T line 113].
- TRIED.md says RTMPose-m "fails the scoreboard's real-video gate on David's videos (the critic)" [T line 113]. But the sibx run shows no set newly off by 3+ [P]. I could not trace why the two differ. This must be settled first.
- Every network other than MediaPipe reads the lying curl as 10 for 11 [P]. That loss is systematic, not noise.
- MediaPipe's own 2D landmarks count worse than its 3D ones: 5 against 6 exact of 12 [PP]. So the networks gain despite moving to 2D, not because of it.

**Licence:** Apache-2.0 (mmpose, rtmlib) [S].

#### 2. Count the weight, not the joint (score 7)

**How it works**
- Seed points on the moving plate, bar, dumbbell or machine carriage.
- Track them from frame to frame.
- Remove camera shake.
- Count the weight's vertical path with the existing hysteresis or with PSC.

Two kinds of tracker:
- Learned trackers (tapnet BootsTAPIR or TAPNext, Apache-2.0 for code and checkpoints) give an offline upper bound.
- Classical pyramidal Lucas-Kanade tracking (LK) is the version for the phone. OpenCV.js exports calcOpticalFlowPyrLK and calcOpticalFlowFarneback [S].

**What it would fix.** These are targets only:
- Mode 5: the pendulum carriage replaces the invented ankle, and the squat bar replaces the misread knee.
- Mode 6: on the standing curl, the bar still moves while the plates hide the elbow.
- Mode 7: up is up, so the rest side is known.
- Mode 9: the tracker stays on the lifter's own weight.
- It does not fix mode 1. Racking moves the bar too; the Metric app calls these "ghost reps" [A line 298].

**Evidence.** Indirect only:
- motionRhythm counted 6 of 6 plate-occluded synthetic sets. The skeleton counted 0 of them [T line 106].
- On your 13 real videos, the motion rhythm added no exact count [T line 72].
  - It caught 4 of 5 wrong counts, with 1 false alarm in 6.
  - It found no period on 4 of the 13.
- No paper counts reps from point tracks. Three searches found none [S].

**Phone or server**
- Stage 1 is offline. det_topdown.py imports cv2 and has run in this scratchpad, so OpenCV's LK can run here on CPU. tapnet would need torch or JAX on a machine you control. torch could not be installed here [V3].
- Stage 2 is in the browser. The size of OpenCV.js and its cost per frame on an iPhone are unverified [S].

**Test on your 14 videos, and the gate**

First, as a flag that changes no count. That is safe under R2 by construction.
- Report which of the core's 5 wrong counts it catches.
- Report how many false alarms it raises on the 6 exact sets.
- It must beat the motion rhythm: 4 of 5 caught, for 1 false alarm in 6 [T line 72].
- It must also catch something the body check misses. The body check flags 7 of 30 scorable sets, including all 6 mode-5 sets [A lines 148-150].

Then, as a counter for weighted lifts only:
- The R2 rule applies: exact not below 6 of 14, none newly off by 3+.
- It must lose nothing on the RepCount-A squat and bench classes.
- The rule that picks which tracked points are the weight must be fixed before the run.

**Effort (estimated):** stage 1 takes 2-3 days on CPU. Stage 2 takes 1-2 weeks.

**Main risks** [S]:
- There is no evidence on real video that it counts better than the skeleton.
- Plates have little texture, and motion blur breaks the tracks.
- Tracks drift over a 30-60 s set.
- The wrong object can be seeded, such as the rack or the bench.
- Dark prone videos give few points to track.

#### 3. Choose the lifter over the whole set with box tracking: ByteTrack or OC-SORT (score 7)

**How it works** [S]
- A Kalman filter predicts each person's box, and boxes are matched from frame to frame.
- ByteTrack also links low-score boxes to existing tracks, for example a lifter half hidden behind the rack.
- A recorded set is not live, so every track can be built first.
- The lifter is then the track whose signals repeat, using PSC's own score for each track.

**What it would fix**
- Mode 9, on two sets [A lines 37 and 40]:
  - back extension 18, where the core counts 17;
  - sissy 5011, where the skeleton jumps to a standing person at 10.8-12.0 s.
- Part of mode 6: a track holds through short losses.
- It meets the reopen condition that TRIED.md gives for the jump gate and the lifter lock: the lifter identified over the whole set by motion [A line 243].

**Evidence**
- None for this app.
- ByteTrack's abstract reports a gain of 1 to 10 IDF1 points (a tracking-accuracy score) across 9 trackers [S].
- On your videos, RTMO-t saw other people next to the lifter: from 0 to 3,571 person-samples per video. Some may be false detections [S].
- On the 13 videos, the simple box-overlap tracker never had to find the lifter again [S].

**Phone.** Matching boxes costs almost nothing. It needs a detector on every sample, for example RTMDet-nano at 47 ms [B].

**Test on your 14 videos, and the gate**
- Run it as an option on top of item 1's detector.
- The R2 rule applies on the 14.
- The occlusion bench has 12 "person" sets, where a bystander took the pose on 4 [T line 106]. They would have to be rendered again to have frames.

**Effort (estimated):** 1-2 days to port a few hundred lines and benchmark them.

**Main risks**
- Little to gain on these videos: one counted set.
- The lifter's own skeleton jumps more often than a bystander takes it [A line 217], so the matching must be done on boxes.
- The rule that picks the lifter by periodicity is UNSOURCED.

**Licence:** MIT for both [S].

#### 4. A rep-segment head on pose, as one arm of the pending retrain of the learned counter (DeTRC idea; score 6; verdict "test later")

**How it works**
- DeTRC detects each rep as a segment with a start, an end and a quality score.
- The count is the number of segments kept [V4].
- The released code does not run. Its weights are RGB-only and on Baidu [V4]. Only the idea transfers.

**What it would fix.** Read from the code, not measured [V4]:
- Mode 2: the count is a whole number of segments, so there is no summed rate to drift.
- Mode 7: plausible.
- Mode 1: only if the training data includes set-up and racking stretches as negatives.
- It works against mode 4: training treats a rep less than 75 % visible as background.

**Phone.** The verifier estimates a shrunk head [V4]:
- about 1.10M parameters;
- 2.2 MB in fp16;
- about 136M operations per window.

That is not measured. It would be plain JavaScript, like the existing learned counter.

**Test.** Run it as one arm of task 26, with the same export and seeds. The pass rule must hold on every seed [V4]:
- real videos: at least 6 of 14 exact, none newly off by 3+;
- stored sets: at least 11 of 15 exact;
- RepCount-A build half: at least as many exact as the library-progress model on the same seed.

Optional cheap arms in the same run:
- RACnet's two training ideas: a reference self-similarity loss and a head that predicts where each rep starts [S]. RACnet's code is CC BY-NC, so only the idea is reused.
- Filler negatives, as in TReViS [A line 282].

**Effort (estimated):** 1-2 days of engineering, then about 1 hour of CPU per seed on a runner with torch [V4].

**Main risks**
- The learned counter has never passed the net rule. It moved by up to 5 exact sets between two seeds [A line 224].
- Its whole-number phase readout did not beat its rate readout [V4].
- About 2,500 sets with rep bounds is little data for a DETR-style head [V4].

#### 5. ESCounts, as a public kill test only (score 6; verdict "test later")

**How it works** [V1]
- A video model predicts a density for each frame, and the count is the sum.
- It has a zero-shot mode.
- Licence: MIT for the code.

**What it would fix**
- It reads no landmarks, which addresses modes 5 and 6.
- On your 14 videos there is nothing left to gain [V1]:
  - PSC already proposes the exact count on 5011 and on the standing curl;
  - 5008 is a correct refusal, because the file is partial.
- Exemplar reps hardly help: they add 0.002 to 0.005 to the exact rate (paper Table 4) [V1].

**Evidence.** On RepCount-A test, the exact rate is 0.245 and OBO 0.563 (paper Table 1a) [V1].

**Phone.** None.
- The encoder has 87M parameters [V1].
- The verifier extrapolates roughly 4-16 minutes per 30 s set in a browser. The basis is the repo's ViTPose timing and an unverified cost figure [V1].
- A server means an upload, which is your decision.

**Test.** Stage A runs on public data only, on GitHub Actions CPU runners [V1].
- Check that the weights load fully.
- Reproduction gate: OBO of at least 0.44 on the 64 test-split videos.
- Then, on the 79 mapped sets: at least 29 exact and at most 20 off by 3+.
- Your videos are used only if it passes, and only on your Mac.

**Effort (estimated):** about 1 day, plus 1-3 hours of CPU [V1].

**Main risks**
- The weights may be broken (issue #9) [V1].
- The weight hosts are blocked here. Whether a GitHub runner can reach them is unverified [V1].
- Even if it passes, the server question remains.

## 3. Rejected or parked, one line each

The number in brackets after each name is its score.

**Rejected**
- **RepNet (1).** Measured here: 15 of 79 RepCount-A exact against the core's 29, and 1 to 7 of your 14 depending on the readout. It fails R2 as a counter and as a refusal filler, and neither the port nor its checkpoints has a licence [V3].
- **SkimFocusNet (3).** No licence and the release does not run. Its "skim" adds a context vector rather than trimming the set-up, and its weights are only on Baidu [V2].
- **Audio (5).** None of your 14 videos has a sound track, and the best audio number on everyday actions is OBO 0.331. The loudest gym sounds come from racking and unracking, which is mode 1 [V5].
- **D2-STX (3).** No weights, no pose extractor and no numbers we could retrieve [S].
- **Frame-embedding self-similarity (3).** No published evidence. RepNet, the learned form of this idea, failed here [V3], and it carries the Google patent flag [A line 259].
- **Segment Any Motion (4).** A multi-GPU research pipeline with no counting result [S].
- **PMPose / ProbPose (3).** GPL-3.0, ViT-sized and no fitness evidence. Its calibrated "is this joint present" score is worth remembering for R8 [S].
- **YOLO26n-pose (4).** AGPL-3.0, and weaker than RTMO on both hard videos. It sees all prone arm points on 39 % of samples against 79 %, and the curl's near arm on 47 % against 93 % [S].
- **MoveNet Thunder (5).** Its model card says it predicts hidden keypoints anyway, which is mode 5 again. It also suits only 3-6 ft distances [S].
- **Low-light pose models (2).** Server GPU code. The prone video's problem is distance and floor level, which a body detector already handles [S].
- **SmoothNet / DeciWatch (6).** They remove jitter: acceleration error drops from 2.91 to 0.14 in its table. They do not recover a joint hidden for a whole rep, and the app already filters [S].
- **PersonalRAC (3).** Content unverified, and no code found [S].
- **Video-language models (1).** Open models sit at or near the constant-answer baseline on PushupBench, and they run on a server only [S].
- **RTMO-t (part of 2).** 5 of 12 exact, and it reads back extension 18 as 12 [P].

**Parked behind a shortlisted test**
- **RTMO-s (7).** Kept as a reference arm in item 1. It takes 716 ms a frame in WASM, 8 times MediaPipe [B]. It counted 0 on 5011, where MediaPipe refuses, which would break R8 [S].
- **Learned point trackers (6).** An option for stage 1 of item 2. CoTracker3 is non-commercial [S].
- **EdgeTAM / EfficientTAM (5).** The on-device form of item 2, if item 2 pays. Its web export has no video memory, and its Safari speed is unknown [S].
- **Equipment detectors (4).** A way to seed item 2. Their evaluation sets are tiny or unknown, and their training frames come from YouTube, so their provenance is unclear [S].
- **RACnet (5).** Ideas only, as optional arms of item 4 [S].
- **MotionBERT / MotionAGFormer (4).** Only after a pose swap. Their weights come from non-commercial data, and Human3.6M has no lying or hanging poses [S].
- **OVR dataset (4).** The only large set of human start and end labels. Its videos are on YouTube (blocked here) and Ego4D (licensed), and its licence is unverified [S].
- **SAM 3 (3).** Possibly an offline tool to make plate tracks. It has 848M parameters and a gated custom licence [S].

## 4. First experiment: the phone-sized pose pipeline, on enough videos to decide

**Question.** Does the phone-sized pose pipeline (item 1) keep its gain beyond 12 videos, without losing exact counts?

**Why first**
- It is the only lever with measured gains on your videos [P].
- TRIED.md names the pose model as the next lever [T line 98].
- The models and scripts already exist: research-oct8/scripts/det_topdown.py and sibx/my_count.mjs.
- It can be gated on public video, which answers the objection that 12 videos cannot decide [T line 113].

**Setup**
- A new branch named after the task, under R4. For example: research/pose-input-phone.
- Bench only: nothing in src changes.

**Arms, frozen before reading any count**
- **A:** MediaPipe full as shipped, read again on the same frames. This is the baseline.
- **B:** RTMDet-nano on 1 sample in 10, otherwise the previous pose's box enlarged 1.25 times, then RTMPose-m (POSE_BOX=10). This is the only arm that can move on to the app.
- **C:** ViTPose+ S int8 with arm B's boxes. Reference only.
- **D:** RTMO-s, with the lifter chosen as the person nearest the previous pose, not from the server box. Reference only.

**Settings frozen and written in the run log first**
- How a network score becomes the app's visibility. The probe showed this choice alone moves ViTPose+ B from 8 to 9 exact [PP].
- The 2D angle path, with x scaled to the frame's aspect.
- The lifter rule.

**Suites**
- **Your 14 videos.** Processed where they are and never uploaded. Labels as in the manifest (R1).
- **RepCount-A build half, 124 videos.** Streamed one at a time from lmms-lab-eval/repcounta-lance with scripts/public/fetch-repcount-lance.sh, then deleted after reading, as on 7 October [T line 130]. Report the 79 sets of classes the app counts separately.
- **The two prone Y/T videos, coverage only.** They have no label and no counter [T line 90].

**Counters.** Read every arm with three counters, using the same bundle as [P]:
- the core (summarizeCount);
- PSC's proposal on refusals;
- the body check flag.

**Pass rule, written before the run.** Arm B goes on to an in-app build only if all four conditions hold. That build would sit behind a flag, for your iPhone only.
1. On your 14: core exact at least 6, and no set newly off by 3+ compared with arm A.
2. On the 79 mapped RepCount-A sets: core exact at least arm A's, and off by 3+ no higher than arm A's. On 8 October, arm A's figures were 29 exact and 20 off by 3+ [T line 75].
3. A paired McNemar test over the 93 sets is reported.
4. Time per sample is at most 2 times MediaPipe's on the same harness. The measured figures are 141 ms against 88 ms [B].

**What to report**
- A per-clip table comparing arm A with each other arm: exact, within 1, off by 3+, refused.
- Which failure modes moved.
- Where the refusals went. A 0 shown where MediaPipe refuses would break R8.

**Cost (estimated)**
- Arm B ran here at a median of about 19 ms for the detector and 55 ms for the pose per sample, in Python (sib-det-topdown.log).
- So the 124 videos take roughly 1-2 hours of CPU, plus streaming.
- Disk holds one video at a time, plus 58 MB of models.

**Outcomes**
- If B fails on RepCount-A: close the pose swap and record it in TRIED.md.
- If B passes, the next steps are:
  - the in-app build;
  - R2 through npm run scoreboard on newly captured landmarks;
  - your iPhone check (R3, R6).

**In parallel.** These are not research, and they would move the counts most:
- Settle the cut-last-rep convention [A lines 120-124].
- Run the 15° per-rep floor through R2 [A line 21].

## For you to decide or confirm

- **R1, standing barbell curl 8.** Its label was given after the app proposed 8 (manifest labelSource). TRIED.md treats counts given after seeing the app's number as weaker truth [T line 128]. Did you count it blind?
- **Cut last rep.** Your labels count a last rep whose return is not filmed: chest row 6, hip thrust 7 and lateral raise 9 [A lines 120-124]. Is that your rule?
- **Uploads.** Every strong video counter needs a server. Uploading gym videos would end "nothing is uploaded".
- **Patent.** Google's US 12,469,290 B2 covers counting through a self-similarity matrix. That touches PSC and any RepNet-like head [A line 259]. Nobody has read the claim text yet.
- **Open discrepancy.** TRIED.md records RTMPose-m failing the real-video gate. The sibx run shows no set newly off by 3+ [T line 113; P]. This must be reconciled before the first experiment.
