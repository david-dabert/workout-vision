# Vision against what exists, and free-viewpoint reconstruction (19 October 2026)

David, 19 October 2026: "read my Md, understand the vision, World Reconstruction Model for Sports ... know if this is the solution to our problem ... What are the things that are still hanging?"
Made by a workflow of five agents: three readers (vision documents, free-viewpoint research, measured limitations), one planner, one adversarial checker who verified the plan against the repository and issue #190.
Where the adversarial check (section 3) contradicts the plan (section 2), the check prevails.
Nothing here is decided: the decisions are David's (section 2, E), and an item takes a ROADMAP.md rank only by his word (R7).
External figures come from search extracts; arxiv.org, gracia.ai and meshcapade.com could not be opened from the session, so every external number is marked unverified in section 3.

## 1. Free-viewpoint and reconstruction research

WHAT THE CLAIM IS
The claim comes from Gracia AI's "World Reconstruction Model", announced around 14 October 2026. Its input is 4 to 8 real cameras, not one camera turned into 8. It offers near-real-time free-viewpoint replays along any camera path. Gracia itself says that single-camera AI video "invents geometry". No paper, code, weights or licence is published, and neither is the method behind its sub-millimetre accuracy claim. It is a paid service.
https://gracia.ai/broadcasting
https://radiancefields.com/gracia-introduces-a-world-reconstruction-model-for-physical-ai-and-sports-replays

STATE OF THE ART FROM ONE VIDEO, OCTOBER 2026
- Dense4D (Rıza Alp Güler, Imperial College, arXiv 2610.22325). It maps each person pixel to a 3D position at one reference time (Human Point Maps), plus depth, for body, clothing and hair. This includes regions hidden in the reference frame. Training took about 490 hours on four GH200 GPUs, and the weights alone use 11.4 GB of GPU memory. Code is "will be released"; I found none. I found no accuracy figure and no time per frame. This supersedes BACKLOG of 18 October ("no paper found"). https://arxiv.org/abs/2610.22325
- OpenCap Monocular (Gilon, Miller, Uhlrich, Utah, arXiv 2603.24733, beta). It takes one static phone video and refines WHAM's pose by optimisation on a biomechanical skeleton. Error is 4.8° mean absolute on rotations and 3.4 cm on the pelvis, against marker motion capture and force plates, on walking, squat and sit-to-stand. It does not work for jumping. Code licence: UNSOURCED. https://arxiv.org/abs/2603.24733 https://mobl.mech.utah.edu/opencap-monocular-released/
- SAM 3D Body (Meta, November 2025). It recovers a full-body mesh from one image. Code and weights are under the SAM License, which allows commercial use with restrictions. Its error on the 3DPW benchmark is 54.8 mm per joint (MPJPE). Fast SAM 3D Body runs it in about 65 ms per frame on an RTX 5090. https://comfyui-wiki.com/en/models/sam/sam-3d-body https://arxiv.org/abs/2603.15603
- WHAM scores 57.8 mm MPJPE and 35.9 mm after Procrustes alignment on 3DPW. Its code is "for research purposes". GVHMR's licence: UNSOURCED. Both output SMPL bodies, and SMPL is free for academic use only. A commercial SMPL licence from Meshcapade starts at €1,500 a year. https://arxiv.org/pdf/2312.07531 https://arxiv.org/html/2409.06662v1 https://meshcapade.com/assets/body-models
- Generative novel views and monocular 4D Gaussians:
  - CAT4D (CVPR 2025); release status of its code and weights: UNSOURCED.
  - SV4D 2.0: weights released under the Stability Community License; an enterprise licence is needed above $1M yearly revenue.
  - World from Motion (NVIDIA and Stanford): its accuracy is image quality (PSNR 20.26), not joint error.
  - In all three, the unseen side of the body is generated, not observed.
  https://arxiv.org/abs/2411.18613 https://huggingface.co/stabilityai/sv4d https://research.nvidia.com/labs/amri/projects/world-from-motion/
- On a phone or in a browser: I found no reconstruction or mesh-recovery model measured running on a phone (UNSOURCED beyond that absence).

AGAINST THE APP'S MEASURED FAILURES
- Hidden joint: a body model fills it in with a plausible guess, not an observation. It may keep a count continuous, but the result can never be shown as a measured angle (R8).
- Pose leaps: partly fixed. WHAM, GVHMR and OpenCap carry motion priors over time, and the gain can be measured.
- Foreshortening: this is the real gain. One skeleton with fixed bone lengths stops a segment pointing at the camera from reading shorter. TRIED.md (6 October) traced the range reading about 30 % low to the pose model, worst along the camera axis. One view still cannot always tell whether a segment points towards the camera or away from it.
- Sides confused: partly fixed. A whole-body model keeps left and right consistent over time, but flips remain (rate UNSOURCED).
- Rep cut by the start or end of the video: cannot be fixed. No model recovers frames that were never filmed. Martin's start and end marker, or David's convention of 9 October, are the answers.
- Free-viewpoint replay itself has no measurement value. It shows what the model believes happened.

WHERE IT COULD SERVE
(a) Offline reference on David's stored videos: yes, this is the right use.
- Run OpenCap Monocular and SAM 3D Body on the 96 synthetic sets, where the true angles are known, and on David's 14 videos.
- Compare their range error with today's -30 %.
- The result is a second estimate, never a label (R1). Only OpenCap Monocular reports error against optical motion capture, the reference R16 names.

(b) Server feature with consent: technically possible. At 65 ms a frame, a one-minute clip at 30 fps needs about 2 minutes of GPU time. But it breaks "nothing leaves the phone" (PLAN.md) and adds GDPR consent for body video, server cost and SMPL licensing. This is David's decision.

(c) On the phone: not now. These are GPU models weighing gigabytes. What transfers to the phone is the idea: calibrate each person's bone lengths on MediaPipe's world landmarks (Martin's proposal, BACKLOG of 15 October), measured under R2.

Not verified: gracia.ai, radiancefields.com and arxiv.org could not be opened from this session (proxy or DNS refused). Every figure above comes from search-result extracts, not from the full pages.

## 2. Plan (as written by the planner)

A. DIAGNOSIS: five systems that are missing

1. There is no supply of independent truth.
   - Every gate in use is a build-set gate. 15 stored sets decide. The blind section has decided since 15 October but holds 0 sets. No exam set exists. The Countix held-out half has never been read. User contributions are paused and nothing collects them.
   - The six Beta lifts rest on 1 to 3 sets each.
   - The R16 headline is 10 of 12 sure sets exact (83 %). Its Wilson 95 % interval runs from about 55 % to 95 %, so it cannot show "sure more often each month".
   - What is missing: a standing pipe for labels. It would work like this: film as the guide says, count before the app shows its count, store the set in the deciding blind section, every month, and draw the exams from it. Tiers, exams, physiotherapy tolerances, partial reps and form checks all wait for this one pipe.

2. "Sure" is a set of separate rules with no stated target.
   - R16 defines accuracy as selective prediction: how often a "sure" count is right, and how often the app is sure.
   - Sure counts that are wrong: 273 of 673 on public sets (59 % exact, Wilson 56 to 63 %), 2 of 12 stored, 1 of 5 on video.
   - Signals that separate right from wrong already exist, but nothing combines them or holds them to a number:
     - pose doubt: flagged sets 33 % exact against 58 % for the others;
     - a refused head (a first rep the core refuses at the start of the video): the count is wrong on 14 of 17;
     - an uncounted swing at the end of the clip: 0 exact of 9;
     - the sensitivity check: it moved 80 sets to "ask", 24 of them exact and 56 wrong.
   - There is no written target, no coverage curve and no held-out check of how "sure" is decided.

3. Nothing sits between the pose model and the numbers.
   - The core reads per-frame landmarks from one view. The whole range loss comes from the pose model: synth.txt splits it into the app's definition at 0 % and the pose at -30 %.
   - Side views count worst: at 90° the synthetic sets are exact on 13 of 24, against 21 of 24 at 0°.
   - Video counts depend on chance: exact on every encoding for 1 of 14 videos.
   - TRIED.md (3 and 8 October) says tuning the counting stage has reached its return, because the landmarks are inconsistent.
   - What is missing is a body model: one skeleton with fixed proportions, joint limits and continuity over the set, plus a second real view when there is one.
   - I measured one piece today on the 96 stored synthetic sets. Script: /tmp/claude-0/-home-user-workout-vision/ed592aac-29cc-550b-a498-f327d117c535/scratchpad/bonelen.py. It is not the harness's measure and is rough.
     - Fixing each segment's length on MediaPipe's world landmarks moves the mean range error from -25 % to -19 %.
     - Readings within 10 % of the truth stay at 51 of 192 (each set read on both sides).
     - Squat at its guided view improves (-15 % to -2 %). Overhead press from the front gets worse (-29 % to -39 %).
     - Conclusion: fixing lengths alone does not fix range. It needs the 2D image landmarks or a second view.

4. No measure except the count is checked against a reference.
   - R16 names optical motion capture for angles and the physiotherapist's judgment for physiotherapy. Neither is connected to anything.
   - So range, tempo, the reference band (#111, off), execution checks (docs/validation.md does not exist), the coaching evidence (docs/evidence.md does not exist) and the physiotherapy tolerances (UNSOURCED) all stay experimental.
   - This is also why nearly everything added on 11 to 13 October was withdrawn (#177).

5. The release and governance loop leaks.
   - The file every rule says prevails, counter-core's PLAN.md, is 25 lines and three weeks behind main's.
   - About 20 merges say "Not verified: iPhone (R3)".
   - About 30 commits went straight to main on 12 and 13 October; most were withdrawn later.
   - 92 of 188 files were unreachable on 2 October.
   - #kine shipped on 15 October, while BACKLOG.md of 6 October kept physiotherapy closed until D16 is answered.
   - The product is wider than its proven core (R16: "the core is proven before the product widens"). David's iPhone check is the only gate for anything users see, and it is asked for one pull request at a time.

B. FREE-VIEWPOINT VERDICT

As described, it is not the solution. A narrower, honest form of it is one real part of the solution.

Why:
- Turning one camera into eight adds no information.
  - Gracia's system takes 4 to 8 real cameras. Gracia itself says single-camera AI video "invents geometry".
  - Where the camera did not look, a generated view cannot be "true to what actually happened", and R8 forbids measuring on it.
  - Gracia publishes no paper, code, weights or licence; it is a paid service.
- Against the failures we have measured:
  - A rep cut by the start or end of the video is the largest cause of being one short. Nothing helps: no model recovers frames that were never filmed.
  - Refused sets (pose seen on under half the samples): a model would fill the gap with a guess, so these must stay "ask".
  - Counts shown as sure but wrong (41 % of public sure sets): no direct help.
  - Real help: range read about 30 % low, side-view counting (13 of 24 at 90°), left and right swapped, and the ankle MediaPipe invents on pendulum_squat_7 (14 for 7). A 3D body model fitted over time helps here, and a second real view helps most.
- So the useful part is a world reconstruction of the person: one metric 3D skeleton over the whole set, not new pixels.
  - A free-viewpoint replay is then a way to display that skeleton. A free camera around it, including "impossible" angles (looking down on the knee's path, from under the bar), is cheap to draw from data the app already has.
  - Its value is coaching and beauty. It measures nothing.

What it could do, and when:
1. This week, a bench only, no app change (D3).
   - The synthetic lab already renders any view, and the cameras are known: synth.js P.view, 52° field of view, 2.7 m away, 1.15 m high.
   - The stored views do not share a motion: each view uses its own seed and rep count, so the same motion must be rendered again from two views.
   - Then triangulate the 2D landmarks, and measure range and count against one view and against one view with fixed lengths.
   - This answers "does a second real view fix our problem?" before anything is built.
2. Offline reference (needs David: licences and a rented GPU; this machine has none).
   - OpenCap Monocular: 4.8° against marker motion capture, on walking, squat and sit-to-stand; it does not work for jumping. It is the only candidate measured against the reference R16 names.
   - SAM 3D Body: 54.8 mm per joint on the 3DPW benchmark, about 65 ms a frame on an RTX 5090.
   - Run both on the 96 synthetic sets and David's videos. The output is a second estimate of range, never a label (R1). It does not reopen swapping the pose model (TRIED.md: only a model that wins on public video first).
   - Tools built on SMPL (WHAM, GVHMR) need a commercial SMPL licence, from €1,500 a year, for anything but academic use.
3. Product, after the counting gates (R16, R7): "two phones".
   - The person's phone films, and so does a friend's or the coach's. Each video is read on a phone, and only the landmarks are combined.
   - The two videos are synchronised by cross-correlating the two hip traces, or by a clap.
   - The cameras are calibrated from the body itself: known lens values, the relative position estimated from about 25 keypoints over hundreds of frames, and the scale from bone lengths. Takahashi et al., "Human Pose as Calibration Pattern", 2018: recalled, not opened.
   - The video never leaves the devices.
   - The two-phone OpenCap reports about 4.5° mean error against motion capture (Uhlrich et al. 2023: recalled, not re-checked). That is in the range of the reference band's 10 % gate.
   - It also solves Olivier's "readable angle" problem for his references 2 and 3.
   - Cost: twice the analysis time, about 2 minutes per minute of video on today's CPU path. Synchronisation and calibration can fail, and the app must then refuse (R8).
   - Only then a free-camera replay labelled « Vue reconstruite »: segments the cameras saw drawn solid, guessed ones faint.
4. Business stage (clubs: basketball, rugby): photoreal replays from 4 to 8 fixed cameras.
   - This is a partnership or a licence, not something to build. It needs a server, consent and GDPR terms for body video.
   - It conflicts with "nothing leaves the phone" until David changes that rule.

Not on the phone now:
- Dense4D: code not released, 11.4 GB of weights.
- Generative 4D (CAT4D, SV4D 2.0): they generate the unseen side.

C. HANGING IDEAS, ranked
Format: item | value to the vision | cost | blocker | moves a measured number?

1. Blind label pipe and the exam (4 build plus 4 exam sets per pattern) | highest: every R16 claim, tiers to proven | about one session of David's per 20 sets | David | yes: blind section, exam, tiers
2. Make "sure" selective: ask on a refused head, ask on an end swing, pose doubt as "ask", a written target, Wilson bounds and coverage | high: moves the R16 number without new films | agent, 2 to 3 days | head: confirm in #190 that #230 was David's decision; swings and pose doubt: David's R8 yes | yes: right when sure (stored, video, public)
3. Press and lateral raise sets to Beta | high | four sets each from David | David | yes: up to 9 Beta lifts instead of 6
4. A second real view (bench now, two-phone mode later) | high: range, side views, physiotherapy angles, an honest 3D replay | bench 2 to 3 days, product 2 to 3 weeks | bench: none; product: David (R7) | yes: synthetic range error and side-view count
5. Range checked against a reference (goniometer, motion capture, or OpenCap's published data if licensed) | high: unlocks the reference band, the physiotherapy verdict, the expert path | partner or data | David | yes: range against R16's reference
6. Guided first run and filming routine (ROADMAP #8) | high for beginners; prevents cut reps at the source | agent, about 3 days | none to build (French approval no longer blocks a merge since 15 October); the measure needs usage counts | refused share
7. iPhone checks owed: #188, #203 to #232, check.html?delegate=gpu, the heavy model's download, the backup file picker, haptics, the steadier skeleton | high (R3, R16) | about 45 minutes of David's | David | clears every "Not verified"
8. Narrow-range guard: a minimum rep duration from the set's own period (TRIED.md's own reopen condition) | medium | agent, 2 days, full R2 and net rule | needs David's rank | exact count: sissy_squat_7_5006 on video, public lunges
9. Opening-hold rule with a second discriminator (TRIED.md, 6 October, reopen condition) | medium | agent, 2 days | needs David's rank | exact counts (head class)
10. Physiotherapy: Olivier's refilmed references, tolerances and calibration session; an adviser's opinion on MDR and D16 | high for the physiotherapy path; a legal exposure today | Olivier and an adviser | David | agreement with Olivier's judgment
11. Set start and end marked by the person (Martin) | medium; a coach's request | agent, 2 days, plus an iPhone check | none | Countix 184 to 187 exact (already measured)
12. Result screen as one number (ROADMAP #7) | medium to high (beauty, honesty) | agent, 1-day mock-up | David's approval | result_kept share (usage counts)
13. Exports name what they measure: the joint in the CSV and per-rep table, a five-rep report on one A5 page, a results-link field in the installed app, rests carried in results links | medium (expert and coach paths) | agent, 1 to 2 days | none | no
14. The batch collector keeps its state across a reload; the InvalidStateError fixed | medium (protects item 1) | agent, 1 day | none | no, but protects item 1
15. Offline reconstruction reference (OpenCap Monocular, SAM 3D Body) | medium | a rented GPU, licences | David | a second estimate of range
16. Execution checks with human agreement (David and Luc mark each rep; kappa at least 0.6) | high: the gate for spoken cues and coaching statements | David and Luc | David | form-check agreement
17. Partial reps | medium | blind-labelled sets with partials | David | partial-count accuracy
18. Learned counter retrained on the 638 remaining RepCount-A training videos with a seed ensemble (TRIED.md's reopen condition) | medium, uncertain | agent, about a week of compute | needs David's rank | public exact count (net rule)
19. Timer for the 12 isometric holds; HYROX station timer | medium (the plank's time is unmeasured) | agent, 2 days, with synthetic hold truth | David's rank (R7) | a new measure
20. Coach mode and combined report; programme tempo and several days; fewer taps for circuits; effort and pain questions per client | medium to high for coaches | agent | David shows Luc the one-line report first | no
21. WebGPU runtime, after the iPhone GPU check | medium (speed, perhaps sampling above 15 Hz) | agent, a week plus full R2 | David's 30-minute check | analysis time, perhaps exact counts
22. Re-read the public sets with today's pose path | medium (honest baseline, R13) | hours | David decides when | moves every public baseline
23. Remove the dormant code; move internal reports out of the public repository | medium (maintenance, size) | 1 to 2 days | David (R5) | bundle size
24. Usage counts and the lawyer review (D6) | medium: ROADMAP #7 and #8 are measured through them | David | David | enables field measures
25. Sports on rendered bodies (volleyball, golf, tennis); the activity engine wired to filmed video | medium, later | agent once opened | David (R7; R16 core first) | synthetic sport scores
26. Coach's office, coach directory, horses, nutrition; the NIOSH, gym-buddy and chat demos | low now |, | David (R7) | no
27. Per-person segment-length calibration on world landmarks | low as specified: today's rough measure leaves 51 of 192 readings within 10 %, unchanged | agent | reopen only with 2D landmarks (Taylor 2000, recalled) or two views | range

D. EXECUTE NOW (each on its own branch with a CLAIM in #190 first, R4 and R15; scoreboard output pasted before and after, R2 and R3; nothing touched under public/guide-svg, which holds uncommitted work for ROADMAP #4 on claude/svg-in-list)

D1. Ask instead of counting when the core refuses a set's head rep (the rest of ROADMAP #2)
- Build: a set whose first rep the core refused (HEAD_RETURN_SHARE) goes to "ask to confirm", with #230's existing line. The count does not change.
- Expected size (TRIED.md, 18 October): about 17 of 1,343 sets across the suites, 14 of them counted wrong. lat_pulldown_11_back (10 for 11) leaves "sure" if it is shown as sure today.
- The same harness prints the end-swing case (9 half-A sets, 0 exact) for David's R8 choice. That case is not shipped.
- Measure: the per-clip count diff, which must be empty; right when sure on the stored, video and public scoreboards, before and after; the overlap with the sensitivity check.
- Gates: R2 with no count moved; synthetic 74 of 96; edges.test.ts; tour.
- French: nothing new.
- Waits on: a line in #190 confirming #230 was David's decision on the sensitivity check's line (the wait TRIED.md names).

D2. The R16 measuring tool
- Every "right when sure" line gains coverage, Wilson 95 % bounds and a row per dataset.
- A table on public half A, then half B, for each signal that already exists (body check, sensitivity, pose doubt, refused head, end swing, share of samples with a pose), alone and combined.
- The second monthly point is due 19 November.
- No new confirm rule is fitted: TRIED.md closed rules on visible features at a cross-validated AUC of 0.65 to 0.67.
- Measure: the table. Gate: no count moves.
- What it delivers: the numbers for David's pose-doubt decision (E3) and a proposed written target.

D3. Two-view truth bench (David's request of today)
- Build, in test/real-phone/synth only:
  - run.mjs stores the 2D image landmarks beside the world ones;
  - render the same seed at 0° and 90°, and at 0° and 45°, for the four lifts and both bodies;
  - triangulate with the renderer's known cameras and feed the result to countReps unchanged;
  - add a variant with the cameras estimated from the body, and the single view with fixed lengths.
- Measure: range error against the truth, the share within 10 % (the reference band's gate), and exact counts per pair of views. Compare with today's -30 % and 13 of 24 at 90°.
- Gates: no app file changes; synth.txt's existing lines unchanged; R9 on every constant.
- Decision rule, written before the run:
  - if two views put at least 80 % of sets within 10 %, and the 90° count is no worse than the 0° count, a dated BACKLOG.md entry proposes "two phones" to David;
  - otherwise TRIED.md closes it with the numbers.

D4. Guided first run and filming routine (ROADMAP #8)
- Build: on the first visit:
  - where the phone goes (the exercise's view from the guide);
  - the whole body in frame, checked on the live pose;
  - start and finish at rest;
  - a 3-2-1 count;
  - keep filming two seconds after the last rep.
- Why: a rep cut by the video is the largest cause of being one short, and neither a rule (TRIED.md, 15 October) nor a reconstruction can recover it after filming.
- Measure: smoke.mjs end to end; the tour at every size; the refused and corrected shares once usage counts are on.
- Gates: scoreboard diff empty; R8; tour.
- French: written as a coach speaks, flagged for David's approval (R10, no longer blocking a merge). iPhone check owed (R3).

D5. The blind-label path survives a reload
- Build:
  - the batch collector keeps its whole queue across a reload, not only the next set number (STATE.md, 30 September);
  - the InvalidStateError in CollectHistory and ContributeHistory is fixed (STATE.md, 10 October).
- Tests that fail first, plus a Playwright reload test on #collecte.
- Gates: tests, tour, no counting change.
- Why now: this is the only path into the deciding blind section, which holds 0 sets.

D6. Exports name what they measure
- Build:
  - CSV and per-rep table headings carry the joint and its unit, for example "Amplitude du genou (°)". Today sets-csv.js line 112 has "Amplitude (°)" only; jointName already exists.
  - check that a five-rep report fits one A5 page.
- Tests that fail first; tour.
- French headings flagged for David's approval.
- Expert path: "the honesty is the selling point to this group" (BACKLOG.md, 2 October).

E. NEEDS DAVID
1. One blind-count session on #collecte: the six Beta lifts, about 4 sets each, filmed as the guide says and counted before the app shows its count. Keep 4 more per lift unopened.
   Unlocks: the first deciding blind sets, the first exam, and R16 claims on sets nobody has seen.
2. Four sets each of bench press, overhead press and lateral raise.
   Unlocks: PLAN.md's freeze on press counting; the presses and the lateral raise to Beta.
3. Three R8 answers:
   - (a) does #230's line count as his decision for the refused-head ask?
   - (b) does pose doubt send a set to "ask"?
   - (c) does an uncounted swing at the end of the clip send a set to "ask"?
   Unlocks: D1 shipping, and the largest precision gain available without new films.
4. A written target for "sure", for example "exact on at least 9 of 10 sure sets, stored and blind".
   Unlocks: R16 becomes a gate instead of a description.
5. Free-viewpoint direction:
   - (a) if D3 passes, may "two phones" take a ROADMAP rank?
   - (b) does "phone only, no server" (9 October) also cover internal benches? I.e. may a rented GPU and research-licensed models (OpenCap Monocular, SAM 3D Body) be used offline?
   - (c) photoreal multi-camera replays stay a club-stage partnership, not a build.
6. One iPhone session of about 45 minutes, on a single checklist the agent prepares (C7).
   Unlocks: clears every "Not verified", ROADMAP #3 and the WebGPU work.
7. Governance:
   - bring counter-core's PLAN.md level with main's, or name main's PLAN.md as the one that prevails;
   - confirm the 13 to 14 October order in his own words (PLAN.md line 330);
   - rank items 8, 9, 11 and 18 of C.
8. Physiotherapy:
   - Olivier's references 2 and 3 filmed again, and his judgments;
   - an adviser's opinion on D16 and MDR, since #kine is live while BACKLOG.md said physiotherapy stays closed until D16 is answered.
9. Label questions (R1): lateral raise 9 and reverse curl 10 (cut reps), hip thrust set01 and set02, chin-up 5.
10. Usage counts: is VITE_EVENTS_URL set, and has the D6 lawyer review happened? ROADMAP #7 and #8 are measured through them.

Not verified:
- Whether #230 was David's decision on the sensitivity line.
- The stored-set Wilson interval (my own arithmetic).
- The bone-length figures: my scratch script, not the harness. Its range is the 3rd to 97th percentile of the whole trace, not range per rep; it assumes MediaPipe's left is the truth's left; the sign rule for depth is naive.
- The OpenCap two-phone 4.5°, Takahashi 2018 and Taylor 2000 are recalled, not opened in this session.
- Every external figure comes from search extracts gathered earlier; those pages could not be opened from this session.
- Whether the files read match counter-core: the local copy of counter-core is stale.

## 3. Adversarial check (prevails over section 2)

REFUTED OR UNVERIFIABLE CLAIMS, WITH CORRECTIONS

Refuted against the repository or issue #190:

1. "The blind section has decided since 15 October."
   - The code does not do this. /home/user/workout-vision/test/real-phone/accuracy/scoreboard.test.ts gates only the stored and real-video sections (`for (const t of [b, v])`).
   - The blind header still prints "measured, decides nothing until he says these counts are labels, R1", and blind sets have no baseline.
   - So David's ruling of 15 October (STATE.md) is not implemented. Sets from E1 would decide nothing today.
   - "15 stored sets decide" also leaves out the 16 real-video sets, which are gated too.

2. "counter-core's PLAN.md is 25 lines and three weeks behind."
   - It is 305 lines; main's is 330, so it is 25 lines shorter, not 25 lines long.
   - It last changed on counter-core on 30 September (5da1615). Main's last changed on 14 October (250d118).
   - The branch itself is worse than stated. The GitHub compare of main...counter-core gives behind by 646, ahead by 0, merge base 7b332a8 (11 October).
   - "The local copy of counter-core is stale" is wrong. It was fetched on 19 October at 21:01 and matches ls-remote; it is the branch that is stale.

3. "About 30 commits went straight to main on 12 and 13 October."
   - There are at least 43 first-parent commits that did not go through a pull request, from 12 October 14:41 to 13 October 22:44.
   - The clone is shallow (grafted at 2866d6f), so 43 is a lower bound.

4. "public/guide-svg holds uncommitted work."
   - The working tree is clean. The work is committed as 8cbac07 on claude/svg-in-list and pushed.
   - What binds is the open #190 CLAIM (19 October 21:08, no REPORT yet). It covers scripts/make-guide-svgs.mjs, public/guide-svg/*.svg, guide-svg-keys.json, Guide.jsx, Guide.css and __tests__/no-drawing.test.jsx.
   - This session is itself on that branch, so every new task needs a new branch (R4).

5. "Whether #230 was David's decision" (listed as not verified; also the D1 wait, C2 and E3a).
   - This is answered in #190. The CLAIM at 05:04 and REPORT at 05:30 on 19 October record David's "All the lot" approving the sensitivity line. Commit 9a05373 is titled "(David, 19 October 2026)".
   - The #190 REPORT of 00:39 named David's French line as the only wait for the refused-head ask, so that wait is met.
   - One caveat is recorded there: "All the lot" did not name one of the two lines, and the shorter was chosen; David can veto it.

6. D5 "InvalidStateError in CollectHistory and ContributeHistory" is already fixed.
   - Both files import shareSheet (CollectHistory.jsx lines 8 and 16; ContributeHistory.jsx lines 10 and 22).
   - src/components/experience/__tests__/history-share.test.jsx covers it. STATE.md's line of 10 October is stale.

7. D5 "the only path into the deciding blind section" names the wrong path.
   - Blind counts come from the app's #collecte flow (src/lib/blind.js, BlindAsk.jsx, the `blind` field in saved-set.js), exported through CollectHistory.
   - src/collect-batch-main.js and src/lib/batchCollect.js carry no blind field. The batch collector is the exam path (test/real-phone/exam/README.md).
   - The "Playwright reload test on #collecte" targets the wrong page. The reload defect is in collect-batch.html (collect-batch-main.js line 20: only the next set number survives).

8. E2 and C3: four sets each "unlock the presses and the lateral raise to Beta (up to 9 Beta lifts)."
   - The coded rule makes a lift Beta only if it is not a press (tiers.test.ts lines 41-44; liftTiers.js header). Presses can never be Beta under it.
   - Lateral raise stays Experimental while sets-29sep/lateral_raise_9 reads 8. Every one of David's sets must be exact, and his label is final.
   - New press sets lift PLAN.md's freeze on press counting work, nothing more. Beta for presses needs David to change the rule.

9. E9 "Label questions (R1)" is forbidden.
   - #190 DECISION of 15 October (R1): "a count entered in the collector is the label and final… no agent asks David to re-check a label because the app disagrees." AGENTS.md lesson 6 says the same.
   - Hip thrust set01 and set02 and the reverse curl were ruled on that day. Drop E9.

10. D4 mostly exists already.
    - Film.jsx steps 1-3 already cover phone placement per view, the whole body in frame, and "du départ au retour au repos, puis deux secondes de plus" (approved 9 October).
    - The 3-2-1 (COUNTDOWN_SEC = 3) and the live in-frame check exist in Live.jsx. Production hides live (liveBuild(), VITE_LIVE, "until Phase 6").
    - On the shipped path the phone's own camera app films through a file input, so the app cannot check framing or count down. A live-pose check needs in-app recording, which is David's call.
    - Only a first-visit sequence is new.

11. D6 "headings carry the joint, e.g. Amplitude du genou (°)."
    - repsCsv writes the sets of every exercise into one file (oldestFirst(sets)), so one heading cannot name one joint. It needs a per-row joint column.
    - The heading is on line 111, not 112.

12. D3 "the share within 10 % (the reference band's gate)" misstates the gate.
    - The band's gate is REFERENCE_MAX_RANGE_ERROR = 0.10 on the mean range error per lift at the guided view (src/lib/reference-ranges.js lines 19-27). It is not a share of sets.
    - "4.5° is in the range of the band's 10 % gate" compares a per-frame angle error with a range-error ratio.

13. "Nothing helps a rep cut by the video" and "neither a rule nor a reconstruction can recover it."
    - Since 18 October, TAIL_AT_WORK_SEC (David's convention) counts a last rep the video stops at its working end: stored 11 to 12, video 7 to 8.
    - Only frames that were never filmed are unrecoverable.

14. "The same harness prints the end-swing case (9 half-A sets, 0 exact)."
    - No end-swing detector exists in the repository.
    - The figure is a scratch analysis of 3 October on core 0b87a99, before TAIL_AT_WORK_SEC, so it is stale. That analysis also hid 2 exact synthetic sets, which the plan leaves out.
    - A broader version was closed on 9 October: the "N or N + 1?" question when the video stops inside a rep (cut-end.test.ts) fired on 1 set in 3 and was more often needless than right. Cite both before E3(c).

15. A4 "neither reference is connected to anything."
    - For physiotherapy, #210 (222313d, 16 October) built calibration against Olivier's judgment, and David accepted his judgments as ground truth (#190, 16 October). What is missing is his trials, not the connection.
    - For angles against optical motion capture, the claim is correct.

16. E10 "is VITE_EVENTS_URL set?"
    - #190 REPORT (Antigravity, 15 October 06:42) says it was added to the Actions variables with the worker's /event address. #197 merged by 07:09 that day. So usage counts are probably live.
    - This could not be confirmed here (the API returns 403).
    - If live, ROADMAP #7 and #8 can be measured now. The WP2.1 lawyer review that SPEC D6 recommends first appears skipped. Tell David rather than ask him.

17. "Twice the analysis time, about 2 minutes per minute of video."
    - One read today already takes about 111-173 s per minute of video on this CPU (TRIED, 7 October).
    - Two videos read on one device would take about 4 minutes per minute. Read on two phones, wall time is unchanged. Nothing was measured on an iPhone.

18. Public Wilson interval of 56 to 63 %.
    - The 673 count each Countix clip twice (cut and whole readings), so the sets are not independent and the interval is too narrow.
    - The stored-set interval of 55.2 to 95.3 % for 10 of 12 is right; I recomputed it.

19. "The six Beta lifts rest on 1 to 3 sets each" is true for stored sets (tiers.txt).
    - But the tier test ignores the real-video section. The lat pulldown stays Beta while sets-18oct-video/lat_pulldown_11_back reads 10 for 11.

20. C11 and C13 "blocker: none."
    - ROADMAP.md says an unranked idea takes a rank only by David's decision (R7).
    - C13/D6 is arguably covered by David's standing order of 2 October in PLAN.md ("the joint named beside its range… later changes of the same kind"). C11 is not.

21. "A body model helps the invented ankle (pendulum squat 14 for 7)."
    - TRIED, 8 October: MediaPipe invents the ankle even on the lifter's crop (97 to 190 samples). Only another 2D network (ViTPose+, DWPose) fixed it.
    - A model fitted to the same detections inherits the error. Unproven.

22. "OpenCap Monocular is the only candidate measured against the reference R16 names."
    - Likely overstated: many mesh-recovery methods report on Human3.6M, which is optical marker capture.
    - Defensible form: the only one reporting joint-angle error in degrees against markers.

Unverifiable from here (arxiv, gracia.ai and meshcapade are unreachable; the cited GitHub repositories return 403):
- Gracia's figures.
- Dense4D's arXiv number, training time and weights (BACKLOG of 18 October found no paper).
- OpenCap Monocular's 4.8° and 3.4 cm, and its failure on jumping.
- SAM 3D Body's 54.8 mm, 65 ms on an RTX 5090, and its licence.
- SMPL at €1,500 a year; the GVHMR licence.
- CAT4D, SV4D 2.0 and World from Motion.
- "12 isometric holds": TRIED's motion library counts 39 holds.
- "Solves Olivier's readable angle for references 2 and 3": nothing measured.
- "Public lunges" for the narrow-range guard: TRIED says 2 or 3 half-B sets, lift not named.
- "About 20 merges say Not verified: iPhone": #190 holds 18 such reports, and they are reports, not merge messages.

From recall only, not opened:
- WHAM's 57.8 and 35.9 mm match my memory.
- Uhlrich 2023's 4.5° matches. But two-camera OpenCap calibrates with a checkerboard and processes on a server (OpenSim), so the figure does not carry over to body-calibrated MediaPipe on two phones.
- SAM 3D Body outputs Meta's MHR rig, not SMPL, so the SMPL licence argument does not apply to it.
- Takahashi 2018 (CVPR workshops) and Taylor 2000 (CVIU) exist.

Verified, for reference:
- Stored: 15 deciding, blind 0 sets, sure 10 of 12 (2 wrong); video sure 4 of 5.
- Public: sure 400 of 673 exact; pose doubt 33 % against 58 % (today's scoreboard; TRIED's 57 % is from 6 October); 80 asked, 24 of them exact (#230).
- Refused head: 17 of 1,343 sets, 14 wrong.
- Synthetic: 13 of 24 exact at 90° against 21 of 24 at 0°; range split definition 0 %, pose -30 %.
- Video: exact on all six encodings for 1 of 14.
- Bone lengths: rerun, figures reproduce. Also: correlation with the truth falls from 0.71 to 0.65, and lateral raise at its guided view goes from 10 to 5 readings within 10 %.
- Camera: 52° vertical field of view, 2.7 m, 1.15 m.
- Synthetic sets: one seed and rep count per view; stored sets hold world landmarks only.
- Files: docs/validation.md and docs/evidence.md do not exist.
- Other records:
  - #111 is off.
  - #177 withdrew the honesty-wave items.
  - BACKLOG of 2 October: 92 of 188 files unreachable.
  - D16 is open.
  - PLAN.md line 330 holds the 13-14 October order.
  - French copy no longer blocks a merge (#190, 15 October, Claude's reading of David's words).
  - BACKLOG line 85 has the A5 report idea.
  - Contributions are off in production.

EXECUTE-NOW ITEMS THAT SURVIVE

D1 survives and is not blocked; its stated wait is met (point 5).
- Build: countReps returns no head flag today (`headCounts` is local, core.ts lines 1170-1183). One must be exposed without moving any count.
- Add "iPhone check owed (R3)".
- State the coverage cost, about 1.3 % of sets asked, beside the precision gain.
- Reusing #230's « le compte de l'appli est fragile » gives the wrong reason; the real one is that the video opens mid-rep. A cause line of its own is more honest (R8), and French no longer blocks.
- The end-swing part needs a new detector and must cite the 9 October closure.

D2 survives as a measure (no count moves), but much of it exists.
- #226 already prints the sure line, and the public scoreboard already has per-dataset Wilson intervals for exact counts.
- New: coverage, Wilson on the sure counts, per-dataset sure rows, the signal table, and Countix by distinct clip.
- The refused-head signal depends on D1's flag; the end-swing signal needs a detector.
- Any combination must be chosen on half A and read on half B once.
- Add here: make the blind section gate, per David's ruling (point 1).

D3 survives as a bench and can be built here.
- Prerequisites are in place: Chromium at /opt/pw-browsers, MediaPipe in public/mediapipe, the three.js .glb files download (HTTP 200), and the same seed gives the same motion at any view (the camera draws no random numbers).
- Image landmarks must be added to synth.js's RESULT, which stores world landmarks only; run.mjs alone is not enough.
- The decision rule needs fixing:
  - Use the band's real gate (mean range error ≤ 10 % per lift at the guided view), with the within-10 % share as a secondary.
  - Require the body-calibrated variant, with a simulated sync offset of about one sample at 15 Hz and left/right swaps independent per view, to pass. Known cameras alone are not enough.
  - Define "the 90° count no worse" (fused pair against the single guided view) and compare each pair with its single-view baseline.
  - A failure on Mixamo bodies may come from MediaPipe's landmark-to-bone offsets, not from the second view. TRIED should record it as such, not close "two phones" outright.

D6 survives in reduced form.
- Name the joint in the per-set rep table and in the report.
- Add a per-row joint column to the reps CSV.
- Check the A5 page.

D5 survives only as one fix: collect-batch.html keeps its rows across a reload.
- Write a failing test first.
- Justify it as protecting the exam path.
- Drop the InvalidStateError half, which is done.

D4 does not survive as written (point 10).
- Only a first-visit sequence repeating the existing three steps can be built now.
- Its effect stays unmeasured until the usage counts are confirmed on.
- iPhone check owed (R3).
- Do not touch Guide.jsx or Guide.css while the svg-in-list CLAIM is open.

IMPORTANT THINGS THE PLAN MISSED

1. The blind section must gate before E1 can produce sets that decide (point 1).
2. Tiers ignore the real-video section: the lat pulldown is Beta with 10 for 11.
3. test/real-phone/exam/README.md is stale. It names the Beta lifts as "Curl, lateral raise, lat pulldown, squat"; today there are six, without the lateral raise. E1 mixes the blind route (#collecte) and the exam route (batch collector, then import --exam). Say which route each set takes.
4. Sample size for any "sure" target.
   - Showing ≥ 90 % with 95 % confidence needs 35 consecutive exact sure sets, or about 127 sure sets at 95 % observed.
   - E1's 24 sets cannot test E4's example, and a month-to-month comparison on 12 stored sure sets is noise.
5. Haptics are probably a no-op on iPhone.
   - The app uses navigator.vibrate only: Result.jsx line 688, Replay.jsx line 222, Install.jsx line 33, Entry.jsx line 96, RestTimer.jsx line 40.
   - WebKit on iOS does not implement it (recall). Drop haptics from the iPhone checklist and record it as a known limit.
6. Usage counts are probably live since 15 October without the lawyer review (point 16).
7. counter-core is 646 commits behind main. Every rule file defers to a PLAN.md that allows main to move only by fast-forward to counter-core, which no pull request since then has done. E7 is more urgent than stated.
8. The shallow clone means every history-based count is a lower bound until `git fetch --unshallow`.
9. The physiotherapy exposure is wider than D16. David ordered both of these, and both belong in E8's adviser question (MDR, GDPR health data, HDS hosting):
   - #218 (8f31606) uploads a patient's video to a Vercel Blob proxy and a third-party AI, off unless VITE_GLIMPSE_URL is set.
   - #203 built a « note d'honoraires » against BACKLOG of 1 October ("Invoicing for physiotherapists: not to be built").
10. Fit3D could test D3 and C5 on real people without a partner. test/real-phone/accuracy/anatomy-8oct.md line 289 lists it: 611 multi-view gym sequences with 3D skeletons. Its licence is UNSOURCED, likely research only.
11. R16 user paths: two phones need a second device and someone to film. That is not a path for a patient at home or a beginner alone, so scope it to coaches and physiotherapists in person.
12. test/real-phone/held-01oct/batch2 holds sets waiting only for David to confirm which video goes with which count (TRIED, Data). They are cheap extra labelled sets, and asking about the pairing is not asking him to relabel.

## 4. Measured limitations (reader's report)

**Source state:** I read the working tree at /home/user/workout-vision. It is on branch claude/svg-in-list at commit ebacfe8 (19 Oct 2026). The only uncommitted changes are under public/guide-svg, which this read does not use. The local origin/counter-core ref is stale (7b332a8, 11 Oct), so I could not confirm that these files match counter-core. Nothing was written to the repository.

# 1. NUMBERS NOW

## Stored real-phone sets
Source: /home/user/workout-vision/test/real-phone/accuracy/scoreboard.txt, dated 2026-10-19.
- **Exact:** 12 of the 15 sets that decide (12 before). 0 newly off by 3 or more, 0 known off by 3 or more, 0 newly refused.
- **"Build sets only; no exam set yet."**
- **Press sets (decide nothing):**
  - bench_press_7_side: 5 for 7
  - bench_press_7_angle: refused
  - overhead_press_4: 5 for 4
  - overhead_press_4: 4 for 4
  - overhead_press_10: 9 for 10
- **Misses that decide:** all three are one short.
  - set01 machine seated back extension: 12 for 13
  - reverse curl: 9 for 10
  - lateral raise: 8 for 9
- **Right when sure (as the app ships, with the sensitivity check):**
  - 12 of 15 shown as sure: 10 exact (83%), 2 off by 1 or 2, 0 off by 3 or more.
  - 3 asked to confirm: 2 exact, 1 off by 1 or 2.
  - With the body check alone: 13 sure, 11 exact (85%).
- **In the list:** the label is in [M, M+1, M-1] on 15 of 15.

## Real video
Source: the same file. 7 October videos plus 2 videos of 18 October.
- **Exact:** 8 of 16. 1 known off by 3 or more (pendulum_squat_7: 14 for 7). 3 refused (sissy_squat_5_5011, sissy_squat_7_5008, standing_barbell_curl_8).
- **Inexact:**
  - behind_neck_chin_up: 6 for 5
  - machine_seated_back_extension: 17 for 18
  - sissy_squat_7_5006: 5 for 7
  - lat_pulldown_11_back: 10 for 11
- **Right when sure (as shipped):**
  - 5 shown as sure: 4 exact (80%), 1 off by 1 or 2.
  - 8 asked to confirm: 4 exact, 3 off by 1 or 2, 1 off by 3 or more.
  - Body check alone: 8 sure, 5 exact (63%).
- **In the list:** 10 exact, 13 of 16 in [M, M+1, M-1].
- **VIDEO mode** (measured, decides nothing): 4 of 14 exact, 3 refused.
- **Blind counts:** 0 sets ("0 sets, 0 exact of the 0 that would decide").

## Public sets
Source: /home/user/workout-vision/test/real-phone/accuracy/public-scoreboard.txt, dated 2026-10-19.
- **Headline:** "1064 build sets, 502 exact (47%). Of the 949 in the baseline that decide, 454 exact now, 454 before; 0 became off by 3 or more." The 115 press sets decide nothing.
- **Right when sure:** "of 949 sets that decide, 829 counted."
  - Body check alone: 753 shown as sure, 424 exact (56%), 311 off by 1 or 2, 18 off by 3 or more. 76 asked to confirm, 30 exact.
  - As shipped: 673 shown as sure, 400 exact (59%), 266 off by 1 or 2, 7 off by 3 or more. 156 asked to confirm: 54 exact, 86 off by 1 or 2, 16 off by 3 or more.
- **Per dataset:**
  - cfrep: 8 of 12 exact (67%, Wilson 39-86%), rep error 5.7%
  - countix: 194 of 447 (43%, 39-48%), 53 refused, rep error 22.2%
  - countix-whole: 183 of 447 (41%, 36-46%), 65 refused, rep error 23.4%
  - mmfit: 117 of 158 (74%, 67-80%), 0 refused, rep error 3.7%
- **Countix by distinct clip:** both readings exact 166 (37%), either reading exact 211 (47%).
- **Weakest rows of the table** (exact of sets; off by 3 or more):
  - countix pull_up: 18 of 60; 3 (whole clip: 20 of 60; 4)
  - countix triceps_pushdown: 29 of 73 (whole: 26)
  - countix squat: 20 of 46
  - countix lunge: 36 of 78
  - countix push_up: 37 of 77; 6 (whole: 33; 8)
  - mmfit dumbbell_row: 8 of 19; 4
  - mmfit squat: 40 of 40
- **Pose doubt:** 195 of 946 flagged. Flagged sets 33% exact against 58% for the others; 19 of the 45 sets off by 3 or more are flagged.
- **RepCount-A** (decides nothing): 26 of 79 exact (33%), and its "off by 3 or more" counts refusals.
  - bench: 4 of 18; 8 off by 3 or more
  - front raise: 4 of 14; 2
  - pull_up: 4 of 14; 4
  - push_up: 5 of 15; 4
  - squat: 9 of 18; 3

## Synthetic sets
Source: /home/user/workout-vision/test/real-phone/synth/synth.txt, last committed 12 Oct.
- 74 of 96 exact (77%), 13 off by 3 or more.
- Overhead press 14 of 24; range read about 30% low, "range error mean -29 deg (-30 %)".

## Tiers
Source: /home/user/workout-vision/test/real-phone/accuracy/tiers.txt (18 Oct), checked against src/lib/liftTiers.js.
- **Beta (6):**
  - bicep_curl: 2 sets, 2 exact
  - lat_pulldown: 2 of 2
  - squat: 1 of 1
  - hip_thrust: 3 of 3
  - romanian_deadlift: 1 of 1
  - leg_press: 1 of 1
- **Experimental:**
  - lateral_raise: 1 of 2
  - bench_press: 0 of 2, 1 refused
  - overhead_press: 1 of 3
  - machine_seated_back_extension: 1 of 2
  - reverse_curl: 0 of 1
  - Every other guide exercise is Experimental too. PLAN.md: "Beta marks the exercises with evidence and Experimental all the others."
- No lift has passed an exam. PLAN.md asks for 4 build plus 4 exam sets per pattern; the Beta lifts rest on 1 to 3 build sets each.
- STATE.md's tier line is out of date (written 30 September).

# 2. FAILURE CLASSES, ranked by sets lost

**1. Count off by 1 or 2, shown as a number.**
- **Size:**
  - Public: 352 of 949 (311+41, Right when sure line). Summing the table gives 274 off by 1, so about 78 off by 2 (my arithmetic). 266 of the 352 are shown as sure as shipped.
  - Stored: all 3 misses. Video: 4.
- **Direction is mostly one short.** choices.txt (10 Oct, before the 18 Oct tail rule): public half A has the label at M+1 on 151 sets against 16 at M-1; half B 140 against 18.
- **Named causes:**
  - **(a) Edge: a rep cut by the start or end of the video.**
    - TRIED.md, 3 Oct night: "the largest remaining classes are a last rep cut by the end of the video (16 lunge entries, 8 videos…), regular reps counted short with no observable sign (13 sets, 8 videos), pose lost through a rep…, and alternating deep and shallow knees."
    - TRIED.md, 3 Oct evening: analysts measured "+16 on half A" for a last rep the video stops on during its way back, and "+13 on half A" for a last rep cut at the bottom (lunges and squats).
    - Partly won on 18 Oct by the rule for a last rep stopped at its working end (public 431 to 454).
    - Still missed:
      - lateral_raise_9: "reaches 73 % of the way… never reaches the working threshold" (edges-2026-10-15.md).
      - lat_pulldown_11, at the head of the video: "one sample at the working end at the video's start" (TRIED.md, 18 Oct).
    - diagnosis.txt (content of 30 September) flags STARTS or ENDS INSIDE A REP on most of David's sets. TRIED.md: "Fires on 12 of David's 14 sets."
  - **(b) Inside the set: a noisy trace split wrongly.**
    - back extension 13 (stored): "The miss is the segmentation of a noisy trace, not one threshold" (edges-2026-10-15.md).
    - back extension 18 (video): "reps 15 and 16 merged (the split misses by 0.023 s)" (TRIED.md, 10 Oct).
  - **(c) A rep not on the angle at all.** reverse_curl_10: "The tenth rep is not on this elbow's angle" (edges-2026-10-15.md).
  - **(d) Narrow range.** sissy_squat_7_5006: "thresholds span 12.6°… a pose reading problem, not a count rule" (edges-2026-10-15.md). Also the alternating deep and shallow knees in the public lunges.
  - **(e) Fast reps.** "fast reps are a known limit" (TRIED.md, 3 Oct; synthetic evidence only).

**2. No number (refused or 0).**
- **Size:**
  - Public: 120 of 949 (949 minus 829 counted). The table shows 96 refused among the deciding rows. By sure.ts a count of 0 is "not counted", so the other 24 are sets read as 0 (my arithmetic).
  - Video: 3 of 16.
  - choices.txt: 92 sets in the "ask" state, 0 exact.
- **Evidence:**
  - "Refused (pose seen on under half the samples); not a counting fault" (edges-2026-10-15.md).
  - sissy_squat_7_5008 has "a 13.6 s hole in the original" (TRIED.md, Data).

**3. Off by 3 or more.**
- **Size:**
  - Public: 34 among the deciding table rows, a figure that includes sets read as 0. Sets with a count: 23 (18+5); 7 of them are shown as sure as shipped.
  - Video: 1, pendulum_squat_7 at 14 for 7, now asked to confirm.
- **Evidence:** "pendulum squat 14 for 7 (the knee rises above the threshold inside each bottom; MediaPipe invents the ankle)", the same on all six encodings (TRIED.md, 10 Oct).

**4. Pose input that is inconsistent.** This cuts across classes 1-3.
- TRIED.md, 8 Oct: "Every fix that repairs one of David's real videos breaks another set, because the input is inconsistent: invented landmarks with high visibility, left/right swaps, lost poses… The core's logic is near a local optimum for MediaPipe's landmarks."
- Occlusion bench: a weight plate in front of the body leaves the skeleton count exact on 0 of 6 sets; a bystander took the pose on 4 of 12.
- Range is read about 30% low: "it is the pose model's world landmarks" (Measures, 6 Oct).

**5. Counts that move under noise or re-encoding.**
- This loses no gate set directly, but the gate's own number is fragile. Source: stability.txt (10 Oct, core before the 18 Oct rule).
- Public: 269 of 949 sets (28.3%) move on some noise seed. Stored: 3 of 15.
- Video exact per encoding: 6, 2, 1, 5, 3, 3 of 14. "exact on every encoding 1 of 14"; "MDC95 2.4 reps."
- TRIED.md: "The committed reads, which the gate counts, are a lucky draw for today's constants."

**6. Sets that turn on how a cut rep is labelled.**
- Open label questions for David (edges-2026-10-15.md):
  - lateral raise 9 and reverse curl 10 (on the stored scoreboard)
  - hip thrust set01 and set02: right today by a 0.03 s margin, "a third such set may go either way" (TRIED.md, 18 Oct)
  - chin-up 5: the extra rep "cannot be placed"
- Datasets pull opposite ways: the 18 Oct rule took MM-Fit from 127 to 117 exact, because "MM-Fit's labels count whole reps only."

**7. Shown as sure but wrong (the R16 gap).** This overlaps classes 1 and 3.
- Public: 273 of the 673 sets shown as sure are wrong (41%). Stored: 2 of 12. Video: 1 of 5.
- The sensitivity check moved 80 public sets from sure to confirm: 24 exact, 45 off by 1 or 2, 11 off by 3 or more (my arithmetic from the two Right when sure lines).

# 3. TRIED.md: EXHAUSTED versus OPEN

## Exhausted: do not propose again unless the premise changes

- **Tuning the counting stage:**
  - "Conclusion: tuning the counting stage on these landmarks has reached its return; the next gains need David's cut-rep convention, better pose input (sampling above 15 Hz, a larger pose model, measurable only on videos), or more labelled sets." (3 Oct)
  - "of 277 inexact half-A sets, 255 are made exact by none of 13 single signal-stage variants."
- **Confirm rules on visible features:** "weak (cross-validated AUC 0.65 to 0.67)… (closed)."
- **Stability:** "31 changes to how the core decides were measured…: none makes the compression reads agree measurably more without failing a gate." (10 Oct)
- **Edges:** "no rule on the angle or its timing can win the edge misses." (rhythm-gated tail, 15 Oct)
- **Head rule:** "no share counts this pull without losing sets elsewhere." (18 Oct)
- **Withdrawn or not built:**
  - Earlier edge and end rules (1-3 October)
  - Either side does the rep
  - End a rep at any lost pose
  - Count the side that moves more (broad form)
  - Outlier-window fixes
  - Ask "N or N + 1?"
  - Five survey techniques T1-T5
  - The two sides' mean (10 Oct)
  - Thresholds from the active part of the set
  - Collapsed-torso gate
- **Other counters:**
  - State-model (HMM) counter: "Not used."
  - PSC: "Closed as a counter for the app; kept on the bench."
  - SGC: "Not a counter (fails R2)."
  - Learned counters: "Not shipped (fails the net rule alone and as a selector; unstable across seeds)."
  - RepNet and the server-sized video counters (ESCounts, SkimFocusNet, DeTRC): out under David's 9 Oct "phone only, no server" decision.
- **Pose path:**
  - ViTPose+ and DWPose: "no swap; the stronger models stay a bench reference."
  - Phone-sized RTMPose pipeline: "does not hold on public video."
  - VIDEO mode: withdrawn, "fails R2."
  - Lite model: shows more wrong numbers (R8).
  - Half sample rate: 12 to 8 stored, 42 newly off by 3 or more.
  - Backward pass, lifter lock, jump gate: each fails R2 on real video.
  - GPU on this machine: measures nothing about an iPhone.
- **Data:** "Agreement of counters as confidence… Closed."

## Open: the reopen conditions as TRIED.md states them

- **Cut-rep share:** "Open question for David: whether the half-way-back rule should stay, since half A and B both gain from a lower share." (CUT_RETURN_SHARE, 3 Oct)
- **Swings at the clip's ends:** "uncounted full swings at the clip's ends flag 9 half-A sets, 6 off by 2 or more and 0 exact… (an R8 product choice for David)."
- **18 Oct leftovers:** "Open: the lat pulldown's first pull (a 0.27 s return), and the hip thrusts set01 and set02."
  - "The way left for such a rep is to ask rather than count (R8, R16)… Not built: it waits on David's decision on the sensitivity check's line (ROADMAP.md item 1)."
- **Narrow-range sets:** "Reopen with a guard against a second hump inside a rep (a minimum rep duration from the set's period)." TRIED.md repeats this for sissy squat 5006: "a floor of 14 gives 7 on all four compression reads."
- **Video that opens on a held posture (stillStart):** "Reopen with a second discriminator (the hold followed by a return slower than the set's own, the rhythm of the set, or the pose before the hold), measured on all three gates."
- **Learned counter:** "Reopen with whole recordings to train on (the remaining 638 RepCount-A train videos…) and a seed ensemble; the formulation, data path, JS inference and bench are ready for it."
- **PSC:** "Reopen with a selector that tells, before the label, which of PSC and the core is right… or with more labelled sets of the no-counter classes."
- **Motion fusion:** "Reopen with the alternating rule fixed for side views… and with real videos from a second session as a held-out check."
- **Fixed crop with 9 jittered crops:** "testing it again needs new fixed-phone sets with blind counts, not more tuning on these."
- **HMM:** "needs blind-counted real sets to aim at."
- **Shortlist of 9 Oct, after the pose pipeline:** "counting the weight's path instead of the joint (plate occlusion), and the lifter chosen over the whole set (ByteTrack)."
- **Jump gate:** "Reopen only with a reference that does not rest on one frame (a lifter identified over the whole set, e.g. by motion)."
- **Lifter lock:** "Reopen only with a first-lifter rule that does not rest on box size."
- **Backward pass:** "only with a gate that keeps a filled pose only when it agrees with its neighbours, measured on real videos first."
- **Pose models:** "Reopen only with… a model that wins on public video first."
- **Agreement of counters:** may enter a confidence model "only if it beats a visibility/gaps/exercise baseline on held-out phone sessions."
- **End a rep at a lost pose:** "Reopen only with a rule bounded by the gap's length."
- **Calf raise:** "Reopen with a new mechanism (heel height, a foot model)."
- **Never exact on any rendered set:** "archer_push_up, cable_standing_hip_abduction, seated_knee_tuck, single_arm_dumbbell_tricep_extension (catalogue joint or rest side to examine)."
- **Waiting on David:**
  - PSC proposal: "Waits on David's iPhone (R3)."
  - Pose doubt: "the result screen's use of it waits for David."
  - Bench press counted on the wrist's height: "held for David."
  - Range-from-rest: "Parked by David."
- **Measured and held, not shipped:**
  - Duration floor between interpolated crossings: stability gain p 0.034, but it fails R2 on the clean read.
  - SGC second count: the most stable number, but "right 7 times in 79" on flagged sets.
- **Data baseline:** "The public scoreboard therefore measures the pose path of 30 September, not the app's." Re-reading moves the baseline every public number cites (R13); recorded in BACKLOG on 10 Oct.
- **Live counting:** "measured next on real live sets with blind counts (pillar 1)."

# 4. CONSTRAINTS on any fix

- **On the phone only.**
  - David, 9 Oct (TRIED.md): "the phone only, no server, until funds are raised or the product's market value is proven."
  - PLAN.md: "Nothing about the user leaves the phone."
  - Cost today: about 120 ms a sample (CPU, WASM, IMAGE mode), so about one minute of analysis per minute of video. The CPU is forced for gallery videos (TRIED.md, 7 Oct).
- **15 samples a second.**
  - PLAN.md: "Sampling stays at 15 per second unless a clip shows a rep that 15 cannot resolve." Step 1 also fixes 640 px on the long side.
  - TRIED.md: "every set but 11 of half A's 458 runs at 15 Hz, so no sample-rate-adaptive setting can act."
- **R1, labels.**
  - Labels come only from David or from human-annotated public datasets.
  - David's blind counts are labels (15 Oct), but 0 such sets exist.
  - Counts entered after the app showed its own are "never admitted to a scoreboard, an exam or a training set as ground truth."
  - PLAN.md: "Checking only the sets the app gets wrong would move the labels toward its count, which R1 forbids."
- **R2 and the net rule.**
  - Scoreboard before and after, per set. The real-phone exact count does not fall; no set becomes off by 3 or more; a known catastrophic set fails only if its error grows.
  - Net rule of 3 October: exact counts do not fall, sets off by 3 or more do not rise, and McNemar does not favour the old run, on public halves A and B.
  - Synthetic 74 of 96 not lower (ROADMAP gate). edges.test.ts pins the cut-rep convention.
  - CI runs the scoreboard on every push.
- **PLAN.md, exams.**
  - "Exam sets are run once, by the exam script; nothing else opens them."
  - "A lift passes only if every exam set is counted exactly"; after a miss "the seen exam sets become build sets, and a new exam is filmed."
  - No exam set exists.
- **PLAN.md, tuning.**
  - "Tune nothing to any clip."
  - "From now on a parameter changes only through a synthetic test that fails first. Never try parameter settings against David's clips."
  - "A fixed parameter may come from published training or biomechanics literature… never from the clips."
- **Public data.**
  - "measured on their build half and never tuned to a clip, and their held-out half is read once, after the change passes every gate."
  - Countix held-out half unread.
- **Presses.** "Bench press and overhead press sets are measured but decide nothing… until David films new press sets."
- **R8 and R16.**
  - No silent number where the app refuses. A proposal must be confirmed by the person.
  - A low-confidence count is asked, with no grade.
- **Other rules that bound a fix:**
  - "Every clip stays in every table. A clip that produces no count is scored as a failure."
  - Experience work changes nothing in src/lib/counting.
  - Replacing a stored set under test/ needs David's approval (R5).
  - R9: every threshold carries its source and status.

**Not verified:**
- That these working-tree files match counter-core: the local remote ref is stale.
- stability.txt, diagnosis.txt and choices.txt predate the 18 Oct tail rule, so their figures are older than the 19 Oct scoreboards.
- These are my own arithmetic, not printed by any file: the off-by-2 split (78), the 24 sets read as 0, the 34 off by 3 or more among deciding rows, and the 80 sets the sensitivity check moved.

## 5. Vision, users and hanging ideas (reader's report)

1. THE VISION, in David's terms

- R16, 18 October 2026 (CLAUDE.md): "the aim is the most general, adaptable, accurate and beautiful exercise tool ever made, first a reliable proof of concept, then a business." The motto is: improvement, advancement, beauty, functionality, symmetry, geometry, mathematics, sports science, physics, physics-based models, advanced logic, advanced reasoning, ethics and honesty.
- How accuracy is defined (R16): "the app is right whenever it says it is sure, says plainly when it is not, and is sure more often each month." Each measure is held against a named world-best reference: published results and commercial counters for rep counts, optical motion capture for joint angles, and "the physiotherapist's own judgment" for physiotherapy.
- R16 also says: "Each target user ... is served by a path that works for them, or the path is not offered". Design follows "one written system of proportion, spacing, type and motion". "The core is proven before the product widens". "No minor error is left standing."
- docs/VISION.md, 14 October 2026: "WorkoutVision becomes the general tool for human movement: any sport or activity, from the beginner to the expert, and a coach's office around it", added one activity at a time, each with a way to check its numbers against known truth. PLAN.md line 330 notes this order is not in David's own words and asks him to confirm it.
- The positioning sentence (VISION.md): "counts and times your movement from a phone video, on the phone, and shows a number only when it can stand behind it."
- DIRECTIVES.md Part 1, 24 September 2026: "a private set audit ... how many reps they did, whether their execution held up, and what to do next, in a way they can trust". The video never leaves the device.
- PLAN.md, 29 September 2026: "The app is for coaches and for everyone who trains, alone, with a friend or with a coach; there is no choice to make between them, and the business model waits for the investment stage."
- PLAN.md, 28 September 2026 (GROWTH): "People are using the app; users and feedback are grown while that interest lasts." BACKLOG.md, 1 October 2026: "One engine serves them all."
- Issue #190, 15 October 2026: "Nobody will be upset about the French writing... language, that is no big deal." What he does not accept is "an amateur-looking design or a button that does not work" (Claude's paraphrase in the log).
- On his authority: PLAN.md, 2 October 2026: "you don't need to ask me anything else as long as you hit the outcome as progress". Issue #190, 18 October 2026: "I am the captain of this boat" (his labels decide).

2. USERS and what each needs

- Physiotherapist (Olivier, 15 October; Christophe, shoulders; the prone T raise demo of 5 October)
  - Needs: reference videos the patient reproduces; a verdict per joint with both skeletons replayed; tolerances set with him; his judgment as ground truth (David, 16 October 2026, #190); which muscles a movement uses (BACKLOG.md, 8 October).
  - Constraints: EU MDR intended purpose, D16 and D19, HDS hosting (BACKLOG.md, 1 and 6 October; docs/SPEC-production.md §1.1).
  - Allowed wording: "follows the programme, angle reached" (BACKLOG.md, 15 October). No invoicing for physiotherapists (BACKLOG.md, 1 October).
  - Built: #kine (PR #203 to #218, #232).
- Coach (Luc, 29 September; Zine, 6 October; Martin, 15 October)
  - Luc: review a client's set, add judgement, send a branded report (DIRECTIVES.md Part 1); one combined report per client (BACKLOG.md, 29 September).
  - Zine: a programme builder whose loop ends with counted results coming back (BACKLOG.md, 6 October).
  - Martin, what he would pay for: a motor-capacity assessment battery repeated after 6 to 8 weeks, and remote police or army fitness tests. Also asked for: mark where the set starts and ends, fewer taps in circuits, and effort and pain questions switchable per client.
  - S&C coaches: many athletes on one phone, an athlete name on each set, a CSV for the team sheet (BACKLOG.md, 2 October).
  - Built: Pro (#116, #143, #146), the exercise sheet (#187).
- Beginner
  - Does not know exercise names; needs the guide, plain words and simple next steps (DIRECTIVES.md Part 1).
  - "is my rep a rep?": each rep on the replay, the range it reached, a shallower rep flagged relative to the others, never as a verdict (BACKLOG.md, 2 October).
  - A guided first run, since most people skip instructions (Martin; ROADMAP.md #8).
- Intermediate
  - Honest volume, reps, tempo and execution feedback (DIRECTIVES.md).
  - Progress over weeks for the same exercise filmed from the same spot (BACKLOG.md, 2 October).
- Expert and sport scientist
  - Per-rep table, CSV with joint names and units, a method page with dated accuracy, open definitions. "The honesty is the selling point to this group" (BACKLOG.md, 2 October).
- Women (David, 2 October, UNSOURCED)
  - Privacy as a feature; lower-body and glute lifts measured first; figures and copy that assume no male body; no weight asked (BACKLOG.md).
- Other sports (docs/VISION.md; BACKLOG.md, 14 and 15 October)
  - Volleyball: jumps, best jump height, last contact time, knees on landing; synthetic level 1 only.
  - Golf, baseball and tennis on rendered bodies.
  - Rowing stroke rate, cycling cadence, golf tempo.
  - Horses (EquiVision); HYROX stations; clubs (basketball, rugby) as first customers.
  - Workplace lifting (NIOSH), gym buddy and chat exist as demos only.
  - None is measured by a scoreboard (README.md).

3. HANGING IDEAS (not built, or built only in part)

How the mentions were counted: grep line matches across 14 documents (docs/VISION.md, DIRECTIVES.md, PLAN.md, ROADMAP.md, BACKLOG.md, STATE.md, README.md, TRIED.md, CLAUDE.md, AGENTS.md, docs/SPEC-production.md, docs/IPHONE-CHIPS.md, docs/kine-media.md, design/SYSTEM.md), plus the 85 comments of issue #190. Counts are approximate.

Labels: "David" means blocked on David (his films, approval, accounts or decision). "Agent" means an agent can do it now, under the R2 and R7 gates where they apply.

A. Counting accuracy and proof
- Exam sets: 4 build plus 4 exam per pattern, 155 sets over six sessions, exam script run once. None exists ("no exam set yet", scoreboard.txt, 19 October).
  - Where: PLAN.md (27 September, lines 14 and 130 to 218); ROADMAP.md #6 (18 October); STATE.md (30 September); test/real-phone/exam/README.md.
  - Mentions: about 28 lines in 7 documents. Status: David (films).
- New bench and overhead press sets; presses and lateral raise to Beta.
  - Where: PLAN.md (30 September, "no counting work on either until I film new press sets"); ROADMAP.md #5.
  - Mentions: 11 lines in 5 documents. Status: David (four sets each).
- Lat pulldown's first pull at the head of the video (IMG_2135_2 reads 10 of 11).
  - Head-share sweep: none ships (TRIED.md, 18 October). Left open: asking instead of counting when a video opens at the working end.
  - Where: ROADMAP.md #2. Mentions: 13 lines in 4 documents, 6 comments in #190.
  - Status: Agent for the measure on public sets; the screen line needs David (R10).
- Cut-rep convention (D15).
  - The tail was decided by David on 18 October and shipped (#222). The head case is still open.
  - Where: docs/SPEC-production.md D15 (3 October); test/real-phone/accuracy/edges-2026-10-15.md. Mentions: 8 lines in 2 documents, 2 comments.
  - Status: Agent (same work as the item above).
- "Sure more often each month": the line exists (#226, 19 October). The monthly series has one point.
  - Where: CLAUDE.md R16; ROADMAP.md #1. Mentions: 3 lines, 3 comments. Status: Agent (re-run each month).
- Re-read the public sets with today's pose path (37 of 438 Countix counts differ).
  - Where: BACKLOG.md (10 October); ROADMAP.md "watched". Mentions: 3 lines in 2 documents. Status: David ("David decides when").
- Motion count as a confirm prompt.
  - Where: BACKLOG.md (7 October); TRIED.md (7 October). Mentions: 7 lines in 2 documents.
  - Status: David (held-out real videos, iPhone cost, R10).
- DTW against the person's own first rep, as a second opinion on the count.
  - Where: BACKLOG.md (2 October). TRIED.md T4 already holds a DTW variant (3 October). Mentions: 3 lines in 2 documents.
  - Status: Agent (full counting gate; TRIED.md read first, R14).
- Counting from the side: synthetic side curls and squats are exact on only 4 of 6 each.
  - Where: BACKLOG.md (2 October). Mentions: 7 lines in 3 documents. Status: Agent (synthetic).
- Four floor exercises withdrawn (dead bug, banded dead bug, bird dog, glute bridge march) until a view counts them.
  - Where: BACKLOG.md (3 October). Mentions: 4 lines in 4 documents. Status: David (exam sets in three views).
- Alternating curl as a lift of its own, filmed from the front.
  - Where: PLAN.md (27 September). Mentions: 9 lines in 2 documents. Status: David (sets).
- Walking lunge: not offered, its exam set waits.
  - Where: PLAN.md (29 September). Mentions: 4 lines in 3 documents. Status: David.
- Lower-body and glute lifts first in the measurement order (for women).
  - Where: BACKLOG.md (2 October). Mentions: 2 lines. Status: David (exam sets).
- The learned counter's release gate: the held-out public half, read once. Not run.
  - Where: PLAN.md (30 September and 2 October). Mentions: 4 lines in 2 documents. Status: Agent.
- "Range measured from its rest" (branch range-from-rest): parked.
  - Where: STATE.md (28 September). Mentions: 4 lines in 2 documents.
  - Status: waits for real sets with 20 to 30° reps missed (data).
- A lateral raise of 10 counted 4 on the 3d preview: still unexplained.
  - Where: PLAN.md line 116; STATE.md. Mentions: 2 lines. Status: needs the video (David).
- Crop-retry re-read of the 13-rep back extension (8 to 12) kept out of the scoreboard; replacing the stored file is a delete under test/.
  - Where: TRIED.md (6 October). Mentions: 1 line. Status: David (R5).
- New tracked joints for 22 exercises (horizontal shoulder, ankle, scapula, wrist) and new counting rules for 45 (rotation, crunch, multi-step, airborne, ballistic and others).
  - Where: PLAN.md (27 September, groups B and C). Mentions: 2 lines.
  - Status: Agent (synthetic tests first; R7 for a new feature).

B. Pose input, perception, 3D
- A steadier skeleton.
  - The replay is steadied since 12 October and the physiotherapy comparison since 19 October (#232). Live filming stays unsteadied.
  - Where: ROADMAP.md #3 (18 October). Mentions: 6 lines in 3 documents, 6 comments.
  - Status: David (which view trembles, asked in #190, 19 October).
- iPhone GPU measured with check.html?delegate=gpu (about 30 minutes).
  - Where: docs/IPHONE-CHIPS.md (9 October); STATE.md. Mentions: 11 lines in 5 documents. Status: David (iPhone).
- WebGPU runtime (LiteRT.js or ONNX Runtime Web).
  - Where: BACKLOG.md (9 October); IPHONE-CHIPS.md §3. Mentions: 10 lines in 4 documents. Status: Agent (new engine, full R2).
- Native iOS PoseBench (Apple Vision 2D and 3D, MediaPipe iOS).
  - Where: BACKLOG.md (9 October); IPHONE-CHIPS.md §4. Status: David (Mac, Xcode, iPhone).
- Dense4D.
  - Where: BACKLOG.md and ROADMAP.md (18 October). Mentions: 2 lines, 2 comments. Status: external (code not released).
- MuscleMimic: a muscle estimate for physiotherapists, and an anatomical joint-range check.
  - Where: BACKLOG.md (8 October). Mentions: 1 line. Status: Agent for the joint-range check; the muscle estimate is "later".
- Per-person segment-length calibration on first use.
  - Where: BACKLOG.md (15 October, Martin). Mentions: 1 line. Status: Agent (R7).
- 3D angle against the angle seen on the picture: which one the replay shows "is settled with the accuracy work".
  - Where: PLAN.md (replay, 27 September). The chip wording "estimé en 3D" awaits approval (src/components/experience/Replay.jsx line 356).
  - Status: David (copy) and Agent (measure).
- VIDEO-mode pose for live counting.
  - Where: BACKLOG.md (3 October). VIDEO mode cut the real-video exact count from 6 to 2 (#147, 9 October; TRIED.md). Mentions: 7 lines in 3 documents.
- Free-viewpoint replay, multi-view or world reconstruction (this request, 19 October 2026).
  - Mentions: 0 in the 14 documents and in #190.
  - Nearest entries: Dense4D, which would "see a side the camera hides" (BACKLOG.md, 18 October); the Fit3D multi-view dataset (test/real-phone/accuracy/anatomy-8oct.md); the core's 3D world-landmark angles.

C. Measures beyond the count
- Partial reps ("it will be interesting and valuable to count partials too in the future").
  - Where: BACKLOG.md (9 October); ROADMAP.md #10. Mentions: 10 lines in 5 documents. Status: David (blind-labelled sets with partials).
- A timer for the 12 isometric holds (plank and others); the README says the plank's time is not measured.
  - Where: PLAN.md (27 September, group A); README.md. Mentions: 5 lines in 3 documents. Status: Agent (R7).
- HYROX station timer that the person starts and stops.
  - Where: BACKLOG.md (3 October). Mentions: 2 lines. Status: Agent (R7).
- Range reads about 29 to 30 % low and phase times short on synthetic bodies; calibrate before any reference comparison; a goniometer or motion-capture reference (R16).
  - Where: BACKLOG.md (2 and 6 October); README.md. Mentions: 11 lines in 5 documents.
  - Status: the reference data needs David or partners; the synthetic calibration is Agent.
- A reference movement beside the person's own, and a reference band on RepWave.
  - The band is built behind a flag, off (#111). Animated figures for every exercise shipped (#223), but not beside the replay. The gate is range within 10 % of truth.
  - Where: BACKLOG.md (6 October; David, the physiotherapist, Christopher). Mentions: 5 lines in 2 documents. Status: Agent once the measure passes.
- Execution checks with human agreement (David and Luc, kappa of at least 0.6, precision of at least 0.8). docs/validation.md does not exist.
  - Where: DIRECTIVES.md Phase 4 (24 September). Mentions: 3 lines. Status: David and Luc (per-rep marks).
- Coaching evidence base.
  - docs/evidence.md is absent. The "how many more reps" question after each set is not on the live result; the estimated RIR was withdrawn on 14 October (Result.jsx lines 757 to 763).
  - Weekly volume, double progression and deload exist only in dormant files (src/lib/coach.js, Dashboard.jsx, CoachReport.jsx).
  - The review of 20 outputs by David and Luc has not happened.
  - Where: DIRECTIVES.md Phase 5. Mentions: 5 lines. Status: Agent for the evidence file; David and Luc for the review.
- Load per set (D7).
  - Where: PLAN.md (29 September, "wait"); SPEC D7. Mentions: 3 lines in 2 documents. Status: David.
- Name the joint in the per-rep table and the CSV headings; not found in src/components/experience/sets-csv.js.
  - Where: BACKLOG.md (2 October). Mentions: 2 lines. Status: Agent.
- Fit a five-rep report on one A5 page.
  - Where: BACKLOG.md (2 October). Mentions: 2 lines. Status: Agent (current state not checked).
- Velocity, VBT and form scoring: frozen (DIRECTIVES.md Part 1; README.md). The 11 to 13 October versions were withdrawn by the honesty pass (#177).

D. Result, filming, UX, design
- The result screen as one number at monumental scale.
  - Where: BACKLOG.md (11 October); ROADMAP.md #7. Mentions: 3 lines in 2 documents.
  - Status: Agent for the mock-up; David for approval on his iPhone.
- A guided first run.
  - Where: BACKLOG.md (15 October, Martin); ROADMAP.md #8. Mentions: 3 lines in 2 documents.
  - Status: Agent. Since David's decision of 15 October (#190), French copy no longer blocks a merge.
- The person marks where the set starts and ends, padded by 0.5 to 1 s.
  - Measured on Countix: 184 to 187 exact (test/real-phone/accuracy/window-2026-10-15.md).
  - Where: BACKLOG.md (15 October). Mentions: 2 lines in 2 documents.
  - Status: Agent for the build; David's own marked windows for the measure.
- Filming routine: countdown, spoken cue, fixed capture window, floor guide.
  - Where: BACKLOG.md (14 October, evening). Mentions: 5 lines in 3 documents. Status: Agent (R7).
- A live spoken cue ("back not straight enough").
  - Where: BACKLOG.md (15 October). Mentions: 2 lines. Status: blocked on a measured form check (Phase 4).
- Fewer taps for circuits; effort and pain questions switchable per client.
  - Where: BACKLOG.md (15 October). Mentions: 1 line. Status: Agent.
- In-app "slow, stuck, wrong number" flag.
  - Where: BACKLOG.md (15 October). The e-mail and issue report exists (PLAN.md GROWTH 1). Status: partly built.
- Astra's design review, 11 proposals:
  - "Confirmer et enregistrer" and "Corriger";
  - a rest clock the person starts;
  - "Nouvelle série" first;
  - direct entry in the correction;
  - a manual route for a refused set;
  - search at the top;
  - both filming actions in view;
  - "Répétition 3 sur 12" controls;
  - the report preview first;
  - optional details.
  - Where: BACKLOG.md (1 October). Mentions: 9 lines in 3 documents. Status: waits for David to open it.
- Design ideation: Rams; near-monochrome with one accent only when the app is certain; Geist; a tactile feel; the glance in the gym.
  - Where: BACKLOG.md (11 October), parked by #156. Status: David.
- The watch's last pose carried into the result (section 3 change 5, second half).
  - Where: design/SYSTEM.md §4 (30 September). Mentions: 1 line. Status: Agent.
- Every screen checked against the design system and approved by David on his iPhone.
  - Where: CLAUDE.md R16.
  - iPhone checks still owed for #188 and #203 to #232: #190 reports "Not verified: iPhone (R3)" on nearly every merge. Mentions: 48 lines in 11 documents, 14 comments.
  - Status: David.
- Accessibility.
  - The filming screen's nested-interactive buttons (axe, serious); iPhone contrast, 200 % text, VoiceOver; D27 Larger Text.
  - Where: BACKLOG.md (1 and 2 October); SPEC. Mentions: 9 lines in 4 documents. Status: David (iPhone and D27).
- Haptics: Safari may ignore the Vibration API; to verify.
  - Where: BACKLOG.md (11 October). Status: David (iPhone).
- On-screen wording audit (plurals, units, accessibility): "Not yet audited".
  - Where: STATE.md (10 October). Status: Agent.
- Where the still SVG figures go: the files shipped on 19 October (#231) and are on no screen yet.
  - Where: ROADMAP.md #4. Mentions: 4 lines, 4 comments. Status: David.
- Live counting for users: stop on stillness, a live_start event, a steadier provisional count, a short live replay clip. Off in production (D12).
  - Where: BACKLOG.md (3 October); SPEC WP6. Mentions: 24 lines in 7 documents. Status: David (D12); the measurements are Agent.

E. Coach
- Coach mode: "Je suis coach", the client's name, one combined report per client.
  - Where: BACKLOG.md (29 September, Luc). Mentions: 3 lines.
  - Status: David ("Before any code: David shows the one-line report to Luc").
- Programme builder: tempo per exercise and several days in one programme.
  - Where: BACKLOG.md (6 October). Mentions: 1 line. Status: Agent.
- No field in the installed app to paste a results link; results links do not carry rests.
  - Where: STATE.md (10 October). Mentions: 2 lines. Status: Agent.
- Motor-capacity assessment battery, and police and army fitness tests. Martin offered to film his battery.
  - Where: BACKLOG.md (15 October). Status: David and Martin (videos).
- Coach directory by city and specialty; CoachFinder.jsx is a demo.
  - Where: BACKLOG.md (15 October). Mentions: 2 lines. Status: needs data and a decision from David.
- Clubs (basketball, rugby) as first customers.
  - Where: BACKLOG.md (15 October). Status: David.
- The coach's office: accounting from sourced URSSAF rates, nutrition by photo with a CIQUAL range, client records. The barcode lookup exists (README.md).
  - Where: BACKLOG.md (14 October); docs/VISION.md. Mentions: 9 lines in 5 documents. Status: David (R7).
- Coach pilot: Luc and two other coaches, three clients each, two weeks.
  - Where: DIRECTIVES.md Phase 6.4. Status: David.
- Other people's sets (Luc and his clients first), with their agreement recorded.
  - Where: PLAN.md (27 September). Mentions: 7 lines in 3 documents. Status: David.

F. Physiotherapy
- Olivier's references 2 and 3 filmed again from a readable angle; attempts measured against references 1 and 4; tolerances and a calibration session with him.
  - Where: BACKLOG.md (15 October); ROADMAP.md #9; #190 (16 and 17 October). Mentions: 11 lines in 5 documents, 16 comments.
  - Status: David and Olivier.
- Regulatory opinion: MDR intended purpose, D16, D19, HDS.
  - Where: BACKLOG.md (1 and 6 October); SPEC (3 October). Mentions: 26 lines in 2 documents, 3 comments. Status: David (adviser).
  - Fact: #kine shipped on 15 October (PR #203), while BACKLOG.md of 6 October says the physiotherapy section "stay[s] closed until D16 is answered".
- Elorian Glimpse commentary.
  - David creates the Vercel project (glimpse-proxy/README.md) and revokes a key pasted in the conversation. Consent for the patient video already sent to Elorian is still to be checked.
  - Where: #190 (17 October). Mentions: 4 comments. Status: David (his accounts).
- Rehabilitation exercises in the catalogue; reference videos filmed or validated by a professional; REHAB24-6 dataset (non-commercial). The IntelliRehabDS bench exists (#175).
  - Where: BACKLOG.md (5 October). Mentions: 15 lines in 3 documents.
  - Status: David for the references; Agent for reading datasets once their licence is checked.
- Still to check on an iPhone: the heavy model's 30 MB download and read time, and Safari's backup file picker.
  - Where: #190 (16 and 17 October), "Not verified". Status: David.

G. Sports and other activities
- Volleyball's Phase 1 is done only when David confirms the screen and its French on his iPhone.
  - Where: docs/VISION.md (14 October). Status: David.
- The activity engine is "not yet wired to a filmed video"; level 3 needs labelled filmed jumps.
  - Where: VISION.md. Mentions: 15 lines in 3 documents, 3 comments. Status: Agent for the wiring; David for the jumps.
- Volleyball, golf, baseball and tennis on rendered bodies (truth lab level 2).
  - Where: BACKLOG.md (14 October); VISION.md. Mentions: 6 lines in 4 documents. Status: Agent once David opens it (R7).
- Real reads: rowing stroke rate and drive-to-recovery, cycling cadence and knee bend, golf tempo.
  - Where: BACKLOG.md (14 October). Mentions: 4 lines in 2 documents. Status: needs labelled clips.
- Named phases of a golf swing (address, top, impact, finish) and swing tempo at 120 to 240 fps.
  - Where: BACKLOG.md (14 October, evening). Mentions: 1 line. Status: Agent (R7).
- Reading a real horse: a landmark model or tap-to-track, then an agreement study against inertial sensors or motion capture.
  - Where: BACKLOG.md (14 October). Mentions: 10 lines in 4 documents. Status: needs data and a reference.
- Replace the third-party demo footage and the painted "analysed" previews with clips our own pipeline reads ("Mesuré sur cette vidéo"), plus a credits file in public/demo.
  - Where: BACKLOG.md (14 October). Mentions: 3 lines.
  - Status: Agent for Commons candidates (data/footage/commons-categories.md: 15 of 30 clips do not show the whole subject); David for footage he owns.
- Tennis comparison "84 % with Federer".
  - Where: BACKLOG.md (2 October). Status: assessed and not opened (R8).

H. Data and labels
- Blind counts: the blind scoreboard section, deciding since 15 October, holds 0 sets.
  - Where: STATE.md; R1 amendment. Mentions: 18 lines in 9 documents. Status: David (#collecte phone).
- The fourteen blind counts in label-watch.txt and the batch collector test.
  - Where: PLAN.md and STATE.md (30 September). Mentions: 2 lines. Status: David.
- User contributions are paused and no upload sink exists (his accounts, a PLAN.md amendment, the legal items).
  - Where: STATE.md (9 October); SPEC D10 and D20. Mentions: 31 lines in 4 documents. Status: David.
- Whether sets labelled after seeing the app's count enter the scoreboard.
  - Where: BACKLOG.md (6 October). Status: David (R1, R13).
- Real-phone clips in CI from a private store (D14); e2e/core-app.spec.js has never run with a clip.
  - Where: SPEC; STATE.md. Mentions: 5 lines. Status: David.
- The batch collector forgets everything but the next set number across a reload.
  - Where: STATE.md (30 September). Status: Agent.

I. Privacy, legal, business
- Anonymous usage counts.
  - David, 15 October: "Do what is right. But we need to do something". The worker was deployed by Antigravity on 15 October.
  - Whether the repository variable is set could not be checked from here (the Actions API was refused).
  - README.md line 54 still says "pinned empty", while .github/workflows/deploy.yml line 80 reads vars.VITE_EVENTS_URL. SPEC D6 asks for a lawyer review first.
  - Mentions: 27 lines in 6 documents, 5 comments. Status: David.
- Lawyer review (WP2.1); publisher identity and mailbox (D8); contribution basis (D10); brand and licence (D17); data already held (D20); Countix landmarks in a public repository (D21); feedback table and /ingest endpoint (D24); and D11, D18, D22, D23, D25, D26.
  - Where: docs/SPEC-production.md §4 (3 October). Mentions: about 21 lines. Status: David.
- Tester cohort of 20 to 30 over three weeks, CNIL check, "numbers David can show an investor". STATE.md has no "Tester criteria" line.
  - Where: DIRECTIVES.md Phase 7. Mentions: 2 lines. Status: David.
- Pivots to test with one real user each: home-exercise adherence for physiotherapists, team logging for S&C coaches, a privacy-first logger for women.
  - Where: BACKLOG.md (2 October). Mentions: 3 lines. Status: David.
- Proposed amendment to R13: allow a committed test's dated output for public numbers.
  - Where: VISION.md (14 October), "not yet put to him". Status: David.
- Internal prompts and council reports out of the public repository. DEFENSE_ROUND.md, FINAL_SCORECARD.md, PHASE_*_SCORECARD.md, PHASE1_PROGRESS.md and INTEGRATION.md are still at the root.
  - Where: DIRECTIVES.md 7.3. Status: David (R5).

J. Governance and engineering
- counter-core's PLAN.md is stale (D0).
  - The local PLAN.md file, the copy on main, has 330 lines; origin/counter-core's has 305, last changed on 30 September (5da1615). It lacks the lines of 30 September (learned-counter gate), 1 October (labelling rules, Astra order, copy approval), 2 October (standing order) and 13-14 October (order).
  - counter-core's head is 7b332a8: 11 commits of 11 October that are on no other branch.
  - Every rule file says counter-core's PLAN.md prevails.
  - Where: SPEC D0; BACKLOG.md (3 October). Mentions: 13 lines. Status: David.
- David is asked to confirm the 13-14 October order in his own words.
  - Where: PLAN.md line 330. Status: David.
- Remove the dormant code: 92 of 188 files unreachable on 2 October; split i18n and CSS.
  - Where: BACKLOG.md (2 October); SPEC D13; DIRECTIVES.md 2.6. Mentions: 21 lines in 5 documents. Status: David.
- index.html still allows 'unsafe-eval'; whether the Chrome inference item of step 3d was done is unconfirmed.
  - Where: PLAN.md 3d; STATE.md. Status: Agent.
- InvalidStateError in CollectHistory and ContributeHistory; the wake lock before iOS 18.4.
  - Where: STATE.md (10 October). Status: Agent; the iOS check is David's.
- Verifier FAIL on bf50199 awaits his decision; PLAN.md's tier list and its bench "2 for 7" are stale.
  - Where: STATE.md; BACKLOG.md (3 October). Status: David.

4. SHIPPED, 5 to 19 October 2026 (pull requests merged to main, from the GitHub API)

5 October
- #99 Public scoreboard: MM-Fit's 14 build workouts
- #100 Astra's review: manual-entry provenance, CFRep exposure, no execution judgement
- #102 Measures explained in plain words: result, report and PDF
- #103 Machine seated back extension offered (experimental)
- #104 Back extension described in words, no drawing of another posture
- #105 Measures key designed as a glossary
- #107 Report composed as one document

6 October
- #109 David's sets of 5 and 6 October in the gate; 6 October review actions
- #110 Back extension 13 re-read with the crop retry (8 to 12)
- #111 Why range and tempo read low; reference band built behind a flag (off)
- #112 About page with David's story; reference-band copy
- #113 David's curl as the app saw it; lighter video export named with its count
- #114 Two of David's sets in the scoreboard; collection from the result screen in BACKLOG
- #115 Doctor correction, real sets under the entry example, video shrinker page
- #116 Espace pro (coach programme builder) and set collection from the result screen
- #119 Four more real sets in the demo

7 October
- #120 Backward pose pass: built, measured, left off
- #121 Occluded synthetic benchmark; alternating rule in the motion count
- #122 Lifter lock and five counting techniques: built, measured, left off
- #123 Design foundation, battery, solid Geist numeral
- #124 Result screen in the chosen direction; install on the home screen
- #125 Entry says what the app does; temple line opens À propos
- #126 Gallery-video crash fixes (at most 5 frames held, one pose worker, crash log)
- #130 Pipelined pose reads; continuity gate left off
- #131 David's 13 gym videos in the scoreboard; rhythm safety net left off

8 October
- #135 Benchmarks (RepCount-A, PSC, learned counter); PSC proposal on refused sets
- #138 Body check on counted sets; programme link fix; motion library bench
- #139 CI fix: prone Y raise in the collector; body-check French approved
- #141 David's standing barbell curl, the 14th real video

9 October
- #142 MediaPipe VIDEO mode (about 30 % faster); programme QR code; film two more seconds
- #143 The client sends the day's results back to the coach by link
- #145 Excellence hunt A: results the coach can trust, no set lost or mislabelled
- #146 Excellence hunt B and C: QR always on the sheet, drafts kept, coach links reach the installed app
- #147 Back to IMAGE mode (VIDEO mode cut the real-video exact count from 6 to 2)

10 October
- #148 The four pillars: blind counts, one tap, live measured, GPU measurable
- #149 Stability measured; sensitivity check marks knife-edge counts
- #150 Gate repeatability measured; fixed-crop read fails on public video
- #151 Video packer; frame-reader restart fix
- #152 Audit fixes: screen retry, programmes survive a withdrawn exercise, 24 MB saved, results link reachable

11 October
- #153 Audit follow-up: history share buttons, programme kept without storage, French crash screen and guide
- #154 One name, "WorkoutVision", and "l’appli" in French
- #155 Visual baselines for the name change
- #156 Decoder stall watchdog; paired statistics on the scoreboard; design ideation parked

12 and 13 October, about 30 commits pushed straight to main, outside any pull request (2866d6f to 80e4f7b)
- Universal kinematic engine; physio suite; trapezius-hike detection; shoulder template
- Manifesto; isometric hold metrics
- Asymmetry and trunk engines; inverse dynamics; acoustic cues; plumb line; Safe-to-Lift shield
- VBT and sticking point; rest alert; JSON telemetry export
- prone_y_raise offered; elbow fallback; floor-lift overcount hardening; 309-exercise benchmark with partial-rep tracking; restExtreme scoped
- Equine trot engine; coach business OS; NIOSH ergonomics; coach and buddy finder; P2P chat
- Sports lab (golf, tennis, padel, baseball, rowing, skiing, swimming); French coaching contracts; nutrition studio
- HD sports clips added, purged, then re-added as a HUD player; README rewritten

The 14 October honesty pass (#177) withdrew from the result screen most of the measures added on 11 to 13 October (src/components/experience/Result.jsx lines 757 to 763).

14 October
- #160 Restyle of the new sections
- #161 Activity engine, volleyball on synthetic jumps, docs/VISION.md
- #166 CI fixes and engine defects
- #174 Stability matrix on Chromium and WebKit
- #175 IntelliRehabDS rehab bench
- #177 Honesty pass
- #179 Count the working arm when the better-seen arm stays still
- #181 Honesty fixes; analysed sports and horse videos back as labelled previews

15 October
- #187 Exercise sheet for coaches and physiotherapists; rule amendments R1, R8, R11, R14
- #188 CC0 volleyball video, merged without the iPhone check on David's order
- #193 R15, the agent log
- #194 Commons footage by category, measured
- #195 Volleyball last in the sports rail
- #196 Golfputt clip, CC BY-SA
- #197 Usage counts ready to switch on (D6)
- #198 Agent lessons
- #199 Edge misses diagnosed; rhythm-gated cut rep closed
- #200 Martin's feedback in the backlog
- #201 User-set window measured on Countix
- #202 Lesson 6: David's counts are final labels
- #203 Physiotherapist workspace #kine
- #204 Kine tests independent of the media variable (deploy fix)

16 October
- #205 No comparison for kine exercise 3
- #206 Exercises 2 and 3 compared on segment directions; treated side
- #207 Suivi (follow-up) tab
- #208 Kine French as a French physiotherapist speaks
- #209 Native French pass across the app
- #210 Calibration against Olivier's judgment
- #211 Encrypted backup on the physiotherapist's own devices
- #212 No edited date in the programme list
- #213 Home in three groups, Manifesto last

17 October
- #214 Judge an attempt only on the moments the app sees
- #215 The patient can choose a video
- #216 Patient report PDF and overlay video
- #217 Deeper read with the heavy pose model
- #218 Elorian Glimpse AI commentary (proxy not deployed)

18 October
- #220 R16, the standard
- #221 Two gym videos on the scoreboard (lat pulldown from behind, squat)
- #222 A last rep the video stops at its working end counts
- #223 Animated figure for every guide exercise
- #224 A corrected count is read again and its reps measured
- #225 Ranked ROADMAP.md of ten items; Dense4D in BACKLOG.md
- #226 "Right when sure" line under every scoreboard head

19 October
- #227 Head-rule sweep for the lat pulldown's first pull; none ships
- #228 Programme-at-midnight test
- #229 Pack test made deterministic, with a timeout that says where each row stopped
- #230 Sensitivity check asks on every phone ("Sur cette série, le compte de l'appli est fragile : vérifiez-le.")
- #231 Still SVG figures for the 300 guide exercises (files only)
- #232 Physiotherapy comparison draws the steadied skeleton

Scoreboard of 19 October 2026 (test/real-phone/accuracy/scoreboard.txt):
- 12 of the 15 stored sets that decide are exact; no exam set exists yet.
- Of the 12 the app shows as sure, 10 are exact (83 %).

Files read: /home/user/workout-vision/docs/VISION.md, DIRECTIVES.md, PLAN.md (and `git show origin/counter-core:PLAN.md`), ROADMAP.md, BACKLOG.md, STATE.md, README.md, TRIED.md, CLAUDE.md, AGENTS.md, docs/SPEC-production.md, docs/IPHONE-CHIPS.md, docs/kine-media.md, design/SYSTEM.md, and issue #190 (85 comments). The checkout is shallow, so main's history before 2866d6f (12 October) is cut off; the 5 to 11 October merges come from the GitHub REST API.
