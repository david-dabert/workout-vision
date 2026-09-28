Fresh start. This message is PLAN.md. It overrides every earlier plan, the council document, your memory notes and any plan pasted from another model. Reread PLAN.md at the start of every session and after every compaction. If a later message conflicts with it, ask David whether to amend PLAN.md before acting.

RULES
- One branch, counter-core. Nothing merges to main before Step 5, except the approved exceptions. After Step 5, main moves only by fast-forward to a counter-core commit whose preview David has approved on his phone. Work yourself, one step at a time. No background agents; the two sub-agents under METHOD are the only exception.
- The repository lives at ~/Developer/workout-vision, outside iCloud. Work only there.
- Experience is part of the product, as accuracy is. The first visit, the choice of exercise, the guide, the result screen and the coach report are built in Step 3b and judged by David on his phone. Experience work changes nothing in src/lib/counting, the decoding path or any counting parameter.
- A screen is finished only when it has been opened in the production build in the WebKit iPhone profile, every button on it has been tapped and has led where it says, and the run shows no console error and no failed request. Paste the screenshots.
- The approved prototype, design/experience-prototype.html, is the standard for every experience screen. A difference in layout, type, spacing, colour, motion or wording is a defect, unless David approved it or a rule forbids what the prototype shows.
- An experience screen is finished only when the tour has also shot it at 390×664, 390×745 and 375×548, and at 390×664 with Reduce Motion and the light system appearance, under which the app keeps its own dark appearance. In none of these shots does text overlap other text or a control, or run out of its box, and no title or button leaves a single word on its own line. At 390×664 and 390×745 the main action of the screen is visible without scrolling.
- The tour shoots each change of screen 150 ms after the tap that causes it. That shot shows the old screen, the new one or both on the dark stage, never a blank, white or unstyled page.
- The app states nothing it does not do. No text promises form scores, form analysis, injury prediction or precision until the exam supports it.
- Nothing about the user leaves the phone. Guide images are served by the app itself, not by a third party, and the guide shows the credit its licence requires.
- Leave the old counter's code unchanged. Do not use the YouTube benchmark for any decision.
- A lift is offered only once it counts right on sets it has never seen. Each lift takes four sets to build with and four exam sets, filmed as the app shows for it and labelled with the count a coach would give; the lifts on offer take four exam sets each. A lift passes only if every exam set is counted exactly. After a miss it stays hidden, the fix goes through a synthetic test that fails first, the seen exam sets become build sets, and a new exam is filmed. Exam sets are run once, by the exam script; nothing else opens them. A family of lifts may be examined together, its exam spread over its variants. David's five clips are build sets. Tune nothing to any clip.
- Every clip stays in every table. A clip that produces no count is scored as a failure; no metric excludes it.
- A fixed parameter may come from published training or biomechanics literature, cited in the code, never from the clips. Any other parameter is recorded as an unvalidated starting value.
- Sampling stays at 15 per second unless a clip shows a rep that 15 cannot resolve.
- Paste evidence for every claim; mark anything unchecked as unverified.
- At each STOP, confirm no video file is tracked, push counter-core to GitHub, and wait for David's reply.
- If git reports a lock or a damaged index, stop and tell David. Never run read-tree, checkout-index, reset --hard or any command that overwrites working files.
- From now on a parameter changes only through a synthetic test that fails first. Never try parameter settings against David's clips.
- Stage files by path. Never run git add -A or git add .
- Never run npm run deploy or push to gh-pages.
- Never type a measured number by hand; every number in a report comes from a run whose output is pasted.
- Exceptions approved by David for main: the test notice, filming tip and report-form changes (25 September), and Step 3a. Nothing else changes on main before Step 5.
- A check or a test is never loosened to pass. A fault it finds is fixed, or listed as open in the STOP report.
- An instruction that cannot be followed stops the work. Report it; never work around it.

MM-FIT SUPPLEMENTARY BUILD DATA (27 September)
- MM-Fit is admitted only as supplementary build data, never exam data. A set is admitted only when both wrists and both ankles are visible together in at least 90% of all samples; the rest are excluded from build use but remain in every results table. Visibility uses the existing harness convention: each of landmarks 15, 16, 27 and 28 has visibility >= 0.5 and image x,y within [0,1]. Missing poses remain in the denominator.
- Credit: David Strömbäck, Sangxia Huang and Valentin Radu, MM-Fit Dataset, [Zenodo record](https://zenodo.org/records/7672767), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Paper: MM-Fit: Multimodal Deep Learning for Automatic Exercise Logging Across Sensing Devices, IMWUT (2020).
- Modification: labelled frame intervals are extracted, their timelines reset, and the source MPEG-4 Part 2 video is converted to H.264 with libx264 CRF 18 (lossy). Original files and labels are preserved. Dimensions, frame rate, pixel format and aspect ratio are preserved; no crop, rotation or overlay is added. Conversion commands and source/output metadata accompany the run.

METHOD
- Two foreground sub-agents are part of every step. Their briefs are .claude/agents/wv-reviewer.md and .claude/agents/wv-verifier.md. Only David changes them.
- wv-reviewer reads each change before it is committed. Give it only the goal of the change, in one sentence.
- wv-verifier checks a step after its push and before its STOP. Give it only the step name, the commit range and the evidence folders.
- Add no assessment of your own to either. Neither edits, creates or deletes a file, stages, commits or pushes.
- Start each with the Agent tool under its name. If the name is not offered, start a general-purpose agent whose prompt is the brief's text after the front matter, unchanged, followed by the goal or the step. Never run either in the background.
- Each reviewer finding is fixed with a test that fails first, or listed as open in the STOP report. None is dropped.
- A STOP report carries the verifier's table and verdict unchanged. On FAIL, fix, push and run it again. After a second FAIL, stop and report the unmet rows.
- A row that can only be met by breaking another rule is not fixed. Report it to David as a conflict.
- The tour writes the output of node scripts/src-hash.mjs into its results.json as srcHash, so the verifier can tell whether the evidence comes from the code under review.

0. FREEZE. Stop every background agent. Commit all uncommitted work, on whatever branch it sits, to a branch named park-<date>; delete nothing. Then create counter-core from hotfix-ios and commit this message to it as PLAN.md at the repository root. List every branch with its last commit and one line on what it holds, including where the five-layer rebuild lives, and say which commit the live site serves. Confirm no video file appears anywhere in the repository's history; if one does, tell David and rewrite nothing. STOP.

1. DECODING. One extraction path for the app and every test. Decode sequentially (WebCodecs where available, otherwise playback with requestVideoFrameCallback), never one seek per frame. Apply the file's rotation metadata. Sample by timestamp at 15 per second of video without skipping samples, downscale to 640 px on the long side, and keep image and world landmarks with visibility, no frames. Regenerate the five landmark files through this path and save the middle frame of each clip as a PNG to prove orientation.
Pass mark on the Mac, in Playwright WebKit where it can decode the file, otherwise Chrome, stating which: every clip finishes; time to result is no longer than the clip itself; two runs of a clip give identical landmark files. Paste per clip: resolution, frame rate, rotation, duration, time to result. STOP.

2. COUNTING CORE. src/lib/counting/core.ts, a pure function. In: timestamped landmarks and one of the five launch lifts. Out: the count; per rep, start and end time, range of motion in degrees, concentric and eccentric durations; the arm used; a confidence. No DOM, no automatic detection, no quality gate.
- One joint angle per lift, from world landmarks: elbow for curl, bench press, shoulder press and lat pulldown; shoulder abduction for lateral raise.
- Track the arm whose shoulder, elbow and wrist are most visible across the set. Bridge short dropouts; never alternate arms frame by frame.
- A rep is the smoothed angle crossing a low and a high threshold in turn and returning, within a minimum duration. Thresholds come from the set's own range. Every parameter is in seconds or degrees, never frames.
- Alternating curls: David counts them as a coach does, one rep per arm; a set that alternates counts the total of both arms, not per side (27 September). From the side the far arm is hidden, so the alternating curl is a lift of its own, filmed from the front with both arms in view.
Synthetic tests first: ten cycles must count 10 at 15, 30, 60 and 120 samples per second, with wobble of 10% of the range added, and with the tracked arm hidden for half a second mid-set. Then a per-clip table: expected, hotfix-ios count, new core count. STOP.

3. APP. Only curl, lateral raise and lat pulldown are approved. The lift selector offers those three only; all other lifts and Automatic are hidden. Bench press and overhead press are parked until they pass on additional footage; no more press changes now. Wire the core into the app behind the required lift selection. Low confidence shows "We counted N. Is that right?". Refuse only when the lift's joints are hidden for most of the set, and say why. The form score stays hidden. The app runs pose detection in its worker, the harness on the main thread; the app's own landmarks for the five clips must equal the committed files. Run the three approved clips through the production build (vite build, then vite preview), in WebKit with the iPhone profile and in Chrome. The old code loaded MediaPipe from a CDN because bundling it reportedly broke it on iOS Safari, and the dev server does not minify. Run the three approved clips through the app and paste what the result screen shows for each. Show that bench and overhead press are not offered. STOP. Passed in WebKit on 25 September; Chrome carried into Step 3c.

3a. LIVE GUIDE, on main. Work in a separate worktree (git worktree add ../workout-vision-main main). Never switch branches in the counter-core folder.
- src/lib/useHashRouter.js: add "exercises" to VALID_PAGES. The router sends every page missing from that list to the dashboard, which is why the guide and the coach report have never opened on the live site.
- src/lib/exerciseGuide.js: getFrameUrl asks for frame-N.svg, but @bryllim/workout-guide 1.0.0 ships frame-N.png, and the SVG addresses return 404. Change the extension, then check every frame address the guide can request with a script, and paste the count of 200 and non-200 responses.
- index.html: the security policy accepts images only from the app itself (img-src 'self' blob: data:), so the frames would still be blocked. Add https://cdn.jsdelivr.net to img-src and change nothing else in the policy.
- Hide the Coach Report buttons on the dashboard, the Live tab and the "Live Camera Mode" button. All of them lead back to the dashboard. They return in Step 3b once they work.
- Add to the guide, in French and English: "Illustrations: Everkinetic, via bryllim/workout-guide, CC BY-SA 4.0", linked to the source and to the licence.
Production build in the WebKit iPhone profile: open the dashboard, tap Exercise Guide, open three exercises, and paste the screenshots and the console output. Stage by path, commit, push main, wait for the Pages deploy, then open the live guide in the iPhone profile and paste a screenshot showing frames. STOP.

BUILD FIXES, on counter-core.
- npm ci fails with "Missing: esbuild@0.28.2 from lock file". Bring package-lock.json in line with package.json, add include=dev to the repository's .npmrc, and make the workflows on counter-core use npm ci.
- Delete .github/workflows/pr-preview.yml; it publishes to gh-pages, which the rules forbid.
- Remove the deploy script from package.json.
- Run lint, typecheck, tests and the build on every push to counter-core.
- Point scripts/copy-models.js at float16/1 instead of float16/latest, and fail the build when the file's SHA-256 differs from a value recorded in the script.
- Paste the first passing CI run on counter-core, then begin 3b without waiting.

3b. EXPERIENCE. Starts only when David has approved the prototype and it sits in the repository as design/experience-prototype.html. Build the app to match it, screen by screen. Build the entry screen first; push it to counter-core and tell David, so he can open it on his phone before the other screens exist. Push again after each finished screen. Until 3c passes, the result screen and the coach report show no per-rep durations or ranges: the bars become one equal mark per counted rep.
- The link. A first-time visitor sees the entry once, then the screen the link names. No questions before the first analysis: name, level, age, sex, weight, height and goal move to Profile and are asked only when a feature needs them.
- Entry. As in the prototype, with the words David approves. It can be skipped, never plays twice, and stays still under prefers-reduced-motion.
- Choice. The counted lifts, shown as moving figures, with French and English names and the names people use for them. Nothing else is offered for analysis. "Another exercise" opens the guide.
- Guide. All 302 exercises, each with its three frames served by the app, loaded lazily, not precached. French and English names for all 302, plus common aliases. Search matches names, aliases, body areas and equipment. A body map filters by area. Each exercise says whether the app can count it. The credit stays.
- Filming. One drawn instruction per lift, showing the camera position of the clip that passed for that lift.
- Analysis. While the video is analysed, the landmarks already computed are drawn as a moving figure. Progress follows video time. The screen says "Analysed on your phone. Nothing is sent." / "Analysé sur votre téléphone. Rien n'est envoyé."
- Result. The count revealed rep by rep. "We counted N. Is that right?" with Yes, No and a way to enter the true number. A refusal gives one reason and one fix, drawn, not a list of tips.
- Coach report. Opens from the result. It contains the lift, the date, the client's name, the coach's name, the count and the coach's notes, plus per-rep details once 3c passes. No form score, no estimated maximum, no training load. On iPhone Safari the PDF opens the share sheet. Attach a PDF generated from one of the three approved clips to the STOP report.
- Touch. Every tap shows a pressed state within 100 ms. Targets are at least 44 points. A haptic tick on Enter, on choosing a lift and on confirming the count: navigator.vibrate where it exists; on iPhone, the switch-input method (Safari 17.4 and later, one tick per real tap only).
- Everything outside this path is hidden, not deleted: for example challenges, badges, confetti, injury risk, weekly report, rest timer, manual log, live camera, validate. List what you hid.
- Tour test. One Playwright test on the production build in the WebKit iPhone profile: first visit through the link, entry, choice, filming with one of the three approved clips, analysis, result, confirmation, coach PDF, then ten random guide exercises. It fails on any console error, failed request, missing image or wrong destination. Paste every screenshot.
- Fonts are served by the app, not by Google.
- Guide frames are served by the app as WebP at the size shown, loaded lazily, not precached; remove https://cdn.jsdelivr.net from img-src once they are.
- The 14 exercises hidden in dd19de2 are mapped to a frame set or removed from the list.
- The pose model downloads when the visitor chooses a lift, not on arrival, and is kept in its own cache named after its SHA-256; only superseded caches are deleted.
STOP.

3c. STABILITY, on counter-core.
- Rep details. The core starts a rep where the smoothed angle crosses a threshold, so a rest that hovers near the threshold makes the start unstable; that is why Chrome moves curl reps 3 and 4. Write a synthetic test first: ten reps separated by 2 s rests during which the angle sits within 2° of the low threshold with 1° of random noise. Across ten noise seeds, each rep's start may move by at most 0.2 s and its range by at most 5°. Show that it fails on the current core; if it passes, stop and report. Then change how core.ts places rep boundaries until it passes, with every other test green. Nothing is tried against the clips.
- Then run the three approved clips in WebKit and Chrome. Counts must not change, and for every rep, start, end and range must agree between the two browsers within 0.2 s and 5°. Paste the table.
- 27 September, first run of the clips: every count, start and end agreed within the limits, and one curl rep's range differed by 5.6° between WebKit and Chrome. Each end of a rep's range is now the mean of its most extreme third of a second, not a single sample; on a clean curve a range reads 1° to 2° lower than before. src/lib/counting/__tests__/range.test.ts measures the same set twice with 2° of noise and requires every range to agree within 5°: the pulldown case failed on the old core (5.8°) and passes (3.8°). The clips are then run again.
- These two are 3c. When both pass, PLAN.md records it on the line below, and per-rep details may appear in the app and in the PDF.
- 3c passed on 27 September: the synthetic tests (src/lib/counting/__tests__/stability.test.ts and range.test.ts), and the three approved clips in WebKit and in Google Chrome (test/real-phone/round5/parity.json).

3d. CHROME AND CLEANUP, on counter-core, split from 3c on 27 September.
- In Chrome the worker and the main-thread harness disagree. Hash the pixels handed to the landmarker at every sample in both paths, report the first sample that differs and why, and make the app and the harness share one inference path.
- Route the demuxer's FFmpeg log lines to console.info with a [demuxer] prefix, as you did for XNNPACK. Console errors remain a failure.
- index.html now allows unsafe-eval. Offset it: remove https://cdn.jsdelivr.net, https://unpkg.com and https://storage.googleapis.com from script-src and connect-src if a search proves nothing loads from them. Paste the search.
STOP.
- 3d approved on 28 September on the preview built from b2e5e0e: on David's iPhone the lateral raise and the curl counted correctly (lat pulldown not retested). The earlier count of 4 for a lateral raise of 10 on the 3d preview remains unexplained and stays open. main fast-forwarded to b2e5e0e and pushed (git ls-remote: refs/heads/main b2e5e0ed3349).

4. PREVIEW. Done outside the repository on 25 September. The counter-core preview is https://workout-vision-next.vercel.app, built from GitHub on Azélie's Vercel account under the same /workout-vision/ path as the live site, so the base path needs no change. It does not rebuild on push; after each push to counter-core, David has it rebuilt. Step 5 still requires David's approval of the preview on his phone.

5. SWITCH. Only after David approves the preview on his phone. main takes counter-core's app through a merge, never a force push; the test notice stays. Returning users keep their history. On the live site, open the link as a first-time visitor and as a returning one, and paste both. STOP.
David approved the preview on his phone on 26 September and ordered the switch before 3c, which follows on counter-core. The test notice is the "Version de test" mark of the approved prototype.
Rounds 6 and 7 approved on 27 September on the preview built from 083ac2d. main fast-forwarded to 083ac2d and pushed.

Second round of craft, on counter-core, after David's question of 26 September about the functions the new app left out. The coach report keeps its share button in reach at every height, and its PDF is the sheet on screen: A5, set in the app's own embedded type, built at the tap, with the same words. The saved sets come back as a history screen, reached from the choice of lift, which greets a return as the prototype does; each set opens its report and can be deleted with two taps. The Film screen fits a 548 px Safari screen. After an update the service worker stores the new version's files, never the browser's cached copy of the old ones (test/real-phone/wave2/sw-update). The history screen, its row on the choice, the report's share bar and the tighter Film screen on short phones are not in the prototype: main takes them only once David has approved them on his phone. The tour now also opens the history, the set's report, the app again as a return, and deletes the set.

Frame and layout checks, on counter-core, after the verification of the second round on 26 September. The verifier passed that round's four tours, yet one shot was blank: with Reduce Motion, the history opened on a return before its code had loaded showed the bare stage. A tap now changes the screen only once the next screen's code is in; e2e/history.spec.js holds the history's code back 1.5 s and counts the frames that show the loading placeholder, with and without Reduce Motion. The tour now checks every shot itself (test/real-phone/checks.mjs): no blank or white frame and, on a settled screen, no title or button leaving a single word on its last line, no text over other text or a control, no text out of its box, no screen scrolling sideways. A fault fails the run. The check found one more: at 375 px, a corrected set's line of time, length and arm left its last word alone; the line now breaks only between its parts, and at 390 px it is set as before. The prototype's two three-word titles, on the choice and the guide, cannot meet that rule on two lines; the tour lists them apart for David and does not fail on them.

Three corrections to the frame and layout checks, on counter-core, after the third round's verification. A screen whose code failed to load had come to leave the tap doing nothing; it leads again to the error screen and its Reload (e2e/history.spec.js aborts the history's code). The guide's exercise names had been exempted from the one-word rule; the exemption is removed, and each name is balanced over its lines, which leaves no word alone at 390 px and two three-word names at 375 px. Three words on two lines always leave one alone, whatever the break: the check lists such cases apart for David instead of failing, and this replaces the tour's list of the prototype's two titles.

Lifts for the public, from 27 September. Every exercise in the guide is offered, not a handful. The guide's 302 exercises fall into 182 countable entries grouped by 20 patterns of joint, rest, first and view (guide-families.json), plus 120 entries with no joint. Each pattern takes four build sets and four exam sets, spread over its most different variants; a variant is offered once its pattern's exam passes. A pattern holding a bothSides entry takes at least one exam set of it, since both sides are counted differently. The core defines each lift by its joint, the end it rests at and the phase that comes first (LIFTS in src/lib/counting/core.ts), with synthetic tests (src/lib/counting/__tests__/lifts.test.ts and guide-families.test.ts). Curl, lateral raise and lat pulldown stay on offer while their patterns' exams are filmed.

The 20 countable patterns, in the order the public trains, with exercise count, exam variants that must be covered, and bothSides entries:

Chest and pressing (45 exercises, 3 patterns):
  1. elbow/high/eccentric/side (30): bench press, push-ups, dips, skull crushers. Exam covers: bench_press, push_up, dip, skull_crusher. One build clip on disk (bench_press_7_angle); three more build sets still to film to choose the position. 3 build + 4 exam = 7 sets.
  2. elbow/low/concentric/side (8): machine chest press, tricep pushdown, overhead extension, kickback. Exam covers: machine_chest_press, tricep_pushdown, overhead_tricep_extension, tricep_kickback. 4 build + 4 exam = 8 sets.
  3. elbow/high/eccentric/front (7): overhead press, shoulder press variants, archer push-up. Exam covers: overhead_press, push_press, machine_shoulder_press, archer_push_up (bothSides; at least one exam set). One build clip on disk (overhead_press_10_front) that settled the rest position; three more build sets still to film. push_press and machine_shoulder_press flagged as likeliest to differ from overhead_press. 3 build + 4 exam = 7 sets.

Shoulders (7 exercises, 2 patterns):
  4. shoulder/low/concentric/front (4): lateral raise, cable lateral raise, upright row, machine lateral raise. Exam covers all four. One build clip on disk (lateral_raise_10_front). 3 build + 4 exam = 7 sets.
  5. shoulder/low/concentric/side (3): front raise, cable front raise, plate front raise. Exam covers: front_raise, cable_front_raise, plate_front_raise, plus one repeat. 4 build + 4 exam = 8 sets.

Legs — quadriceps dominant (36 exercises, 3 patterns):
  6. knee/high/eccentric/side (29): squat, leg press, lunges, split squats. Exam covers: squat, bulgarian_split_squat, forward_lunge, walking_lunge (bothSides; at least one exam set). 4 build + 4 exam = 8 sets.
  7. knee/high/eccentric/front (5): lateral lunge, curtsy lunge, cossack squat. Exam covers: dumbbell_lateral_lunge, cossack_squat, curtsy_lunge, lateral_lunge. 4 build + 4 exam = 8 sets.
  8. knee/low/concentric/side (2): leg extension, step-up. Exam covers both, two sets each. 4 build + 4 exam = 8 sets.

Legs — hamstring dominant (6 exercises, 2 patterns):
  9. knee/high/concentric/side (5): leg curl, seated leg curl, lying leg curl, towel and stability-ball curl. Exam covers: leg_curl, seated_leg_curl, lying_leg_curl, towel_hamstring_curl. 4 build + 4 exam = 8 sets.
  10. knee/low/eccentric/side (1): nordic hamstring curl. Exam covers nordic_hamstring_curl, four sets. 4 build + 4 exam = 8 sets.

Back and rows (43 exercises, 3 patterns):
  11. elbow/high/concentric/side (25): rows and curls. Exam covers: bicep_curl, barbell_row, preacher_curl, one_arm_dumbbell_row. One build clip on disk (bicep_curl_7_side). 3 build + 4 exam = 7 sets.
  12. elbow/high/concentric/front (16): lat pulldown, pull-ups, face pulls. Exam covers: lat_pulldown, pull_up, chin_up, face_pull. One build clip on disk (lat_pulldown_10_front). 3 build + 4 exam = 7 sets.
  13. shoulder/high/concentric/side (1): straight-arm pulldown. Exam covers straight_arm_pulldown, four sets. 4 build + 4 exam = 8 sets.

Posterior chain (30 exercises, 2 patterns):
  14. hip/low/concentric/side (22): deadlift, hip thrust, glute bridge, back extension, donkey kick. Exam covers: deadlift, hip_thrust, glute_bridge, bird_dog (bothSides; at least one exam set). 4 build + 4 exam = 8 sets.
  15. hip/high/eccentric/side (8): Romanian deadlift, good morning, cable pull-through. Exam covers: romanian_deadlift, good_morning, single_leg_romanian_deadlift, cable_pull_through. 4 build + 4 exam = 8 sets.

Core (11 exercises, 3 patterns):
  16. hip/high/concentric/side (8): hanging leg raise, knee raise, v-up, decline sit-up, lying leg raise. Exam covers: hanging_leg_raise, v_up, decline_sit_up, glute_bridge_march (bothSides; at least one exam set). 4 build + 4 exam = 8 sets.
  17. hip/low/eccentric/side (2): dead bug, banded dead bug. Both are bothSides; every exam set tests it. Exam covers: dead_bug, banded_dead_bug, two sets each. 4 build + 4 exam = 8 sets.
  18. shoulder/low/eccentric/side (1): ab wheel. Exam covers ab_wheel, four sets. 4 build + 4 exam = 8 sets.

Hip isolation (5 exercises, 2 patterns):
  19. hip/high/concentric/front (4): standing hip abduction, side-lying leg raise. Exam covers: cable_standing_hip_abduction, side_lying_hip_abduction, side_lying_leg_raise, banded_standing_hip_abduction. 4 build + 4 exam = 8 sets.
  20. hip/low/concentric/front (1): cable standing hip adduction. Exam covers cable_standing_hip_adduction, four sets. 4 build + 4 exam = 8 sets.

Total: 20 patterns, 182 exercises, 155 sets to film (5 patterns have one clip on disk, saving one build set each; 15 patterns need the full 8).

The 120 null-joint entries, in four groups that sum to 120 with no entry in more than one:

A. Isometric holds to be timed (12): plank, side_plank, wall_sit, farmer_carry, cable_pallof_hold, superman_hold, dead_hang, active_hang, hollow_body_hold, bear_plank, l_sit_hold, copenhagen_plank. These need a timer, not a rep counter. They stay in the guide and gain a timer once it is built.

B. Movements needing a new tracked joint or angle not among the four (22): horizontal shoulder plane (pec_deck, cable_fly, rear_delt_fly, reverse_pec_deck, dumbbell_fly, incline_cable_fly, bent_over_rear_delt_raise, cable_rear_delt_fly, prone_t_raise, band_pull_apart — 10); ankle (standing_calf_raise, seated_calf_raise, donkey_calf_raise, leg_press_calf_raise, calf_raise, single_leg_calf_raise — 6); scapula (shrug, dumbbell_shrug, scapular_push_up, scapular_pull_up — 4); wrist (wrist_curl, wrist_extension — 2). These stay in the guide without a count until their tracked joint is added.

C. Movements on a tracked joint that need a different counting rule (45): seated transverse hip (hip_abduction_machine, hip_adduction_machine, banded_seated_hip_abduction — 3); trunk rotation (russian_twist, cable_woodchop, weighted_russian_twist, clamshell, hip_airplane, banded_clamshell, banded_woodchop — 7); abdominal spinal flexion (cable_crunch, crunch, reverse_crunch, weighted_crunch, heel_tap — 5); multi-step per rep (wall_walk, lying_hamstring_walkout, banded_lateral_walk, banded_monster_walk, crab_walk, inchworm — 6); glute kickback across 180° (cable_kickback, machine_glute_kickback, banded_kickback — 3); flexed-hip abduction (fire_hydrant, banded_fire_hydrant — 2); trunk lateral flexion (dumbbell_side_bend, side_plank_hip_dip — 2); anti-rotation (pallof_press, half_kneeling_pallof_press, banded_pallof_press — 3); airborne (jump_squat, explosive_push_up — 2); eccentric-only (negative_pull_up — 1); ballistic (kettlebell_swing — 1); and ten single-reason entries (bicycle_crunch, typewriter_push_up, hindu_push_up, prone_y_raise, superman, reverse_snow_angel, hollow_rock, flutter_kick, plank_shoulder_tap, dragon_flag). These stay in the guide without a count until their counting rule is built.

D. No rep to count (41): stretches and mobility drills (toe_touch, cat_cow_stretch, worlds_greatest_stretch, leg_swings_stretch, torso_twist_stretch, doorway_chest_stretch, childs_pose, kneeling_hip_flexor_stretch, hamstring_stretch, standing_quad_stretch, seated_forward_fold_stretch, cross_body_shoulder_stretch, wall_calf_stretch, butterfly_stretch — 14); cardio and locomotion (running, walking, cycling, rowing, stair_climber, mountain_climber, elliptical, swimming, jump_rope, assault_bike, skierg, hiking, treadmill_incline_walk, battle_ropes, plank_jack, bear_crawl, burpee, half_burpee, squat_thrust, high_knees, jumping_jack, skater_hop, lateral_shuffle, fast_feet, sprawl, seal_jack — 26); arm_circles (1). These stay in the guide permanently without a count.

Filming order by body region, 155 sets across six sessions:

Session 1 — chest and shoulders (22 sets):
  Pattern 1 elbow/high/eccentric/side: 3 build + 4 exam = 7.
  Pattern 2 elbow/low/concentric/side: 4 build + 4 exam = 8.
  Pattern 3 elbow/high/eccentric/front: 3 build + 4 exam = 7.

Session 2 — shoulders and front raises (15 sets):
  Pattern 4 shoulder/low/concentric/front: 3 build + 4 exam = 7.
  Pattern 5 shoulder/low/concentric/side: 4 build + 4 exam = 8.

Session 3 — back (22 sets):
  Pattern 11 elbow/high/concentric/side: 3 build + 4 exam = 7.
  Pattern 12 elbow/high/concentric/front: 3 build + 4 exam = 7.
  Pattern 13 shoulder/high/concentric/side: 4 build + 4 exam = 8.

Session 4 — legs (32 sets):
  Pattern 6 knee/high/eccentric/side: 4 build + 4 exam = 8.
  Pattern 7 knee/high/eccentric/front: 4 build + 4 exam = 8.
  Pattern 8 knee/low/concentric/side: 4 build + 4 exam = 8.
  Pattern 9 knee/high/concentric/side: 4 build + 4 exam = 8.

Session 5 — posterior chain and hamstring (24 sets):
  Pattern 10 knee/low/eccentric/side: 4 build + 4 exam = 8.
  Pattern 14 hip/low/concentric/side: 4 build + 4 exam = 8.
  Pattern 15 hip/high/eccentric/side: 4 build + 4 exam = 8.

Session 6 — core and hip isolation (40 sets):
  Pattern 16 hip/high/concentric/side: 4 build + 4 exam = 8.
  Pattern 17 hip/low/eccentric/side: 4 build + 4 exam = 8.
  Pattern 18 shoulder/low/eccentric/side: 4 build + 4 exam = 8.
  Pattern 19 hip/high/concentric/front: 4 build + 4 exam = 8.
  Pattern 20 hip/low/concentric/front: 4 build + 4 exam = 8.

Grand total: 22 + 15 + 22 + 32 + 24 + 40 = 155 sets.

- Every set: phone upright and still, whole body in frame, sent through the clip collector (scripts/collect-clips.mjs) with the lift, the count a coach would give, the view and who was filmed. The collector fixes each set's role on arrival and keeps exam sets in test/real-phone/exam/.
- An exam for the public needs other people: other bodies, levels, gyms and camera placements. Their sets join every exam as they come, Luc and his clients first. A set of someone else is used only with their agreement, recorded by the collector; it stays on David's Mac.
- The alternating curl (bicep_curl_alternating) joins when its sets pass; it is a bothSides elbow lift filmed from the front with both arms in view, as decided on 27 September, and is not part of a pattern.

Rep details on the result and in the report, on counter-core, once 3c passed. The result's marks stand as tall as each rep's range, as in the prototype; under them a line gives the set's average range and duration, or, for the mark touched, that rep's time, range, lifting time and lowering time. The whole row of marks is one target, so no target is under 44 points. The coach's report and its PDF add the prototype's table of reps, then two measures that are not in the prototype: the time under tension, and how the lifting speed changed from the first two reps to the last two (velocity loss within a set: Sánchez-Medina and González-Badillo, Med Sci Sports Exerc 2011). The core marks a rep that the recording started or stopped inside, without changing any count (lifts.test.ts); such a rep keeps its number and range, and its times read "…". Sets saved before this round show no rep details. The table, the measures and the line under the marks are for David to approve on his phone.
Extended coach report approved on 27 September on the preview built from c927383. The table gains two columns: per-rep tempo in coach notation (lowering-bottom-lifting-top) and peak and mean angular speed in °/s. Short reps (range under 85% of the set's median) are marked ▾. The summary adds the set's average tempo, how the rep duration changed from the first two to the last two, and a comparison with the previous saved set of the same lift. The result screen's detail line stays as approved in round 6. The first phase comes from LIFTS in core.ts, not from guide-families.json.
Tempo fix approved on 27 September on the preview built from 91aa10a. Moving phases (lowering, lifting) to one decimal so they never read 0; pauses (bottom, top) in whole seconds.

The replay, on counter-core, after David's request of 27 September for the overlay video the first app showed. The result's top bar gains Revoir: the set plays again with the skeleton the pose model tracked on it, drawn from the landmarks the count used, and the joint whose angle counts the reps lit in the lamp's colour. A counter in the corner gives the rep on screen and its phase, concentric or eccentric; a line under the video marks the reps, and a touch goes to one; the video plays at full or half speed. Between two samples, a fifteenth of a second apart, each point moves in a straight line; no line is drawn across a gap in the samples, nor a point that either sample missed (src/components/experience/__tests__/replay.test.js). The angle's value is not written on the picture: the core measures it in 3D, and at the top of a curl filmed from the side the 3D angle and the angle seen on the picture differ by tens of degrees; which of the two the app shows is settled with the accuracy work. A refused set replays with no reps, so the skeleton shows where the tracking lost the body. The video is read on the phone, as for the count; the app neither keeps nor sends it, so a saved set has no replay. The result, the report and its PDF now name the phases concentric and eccentric instead of up and down, since a pulldown's concentric phase brings the bar down. test/real-phone/replay-check.mjs opens the replay of the three approved clips in WebKit and checks that the video has the shape of the frames counted, that the joint is lit in each rep exactly where the tracking saw it, and that the counter follows the reps; its frames stay on the Mac (test/real-phone/round7/frames/, ignored by git). The replay is not in the prototype: main takes it only once David has approved it on his phone.

LIFT TIERS, from 28 September, by David's decision. Beta and Experimental are exceptions to rule 14 and to "MM-Fit as build data only": a lift may be offered before its exam, labelled, and every count is for the user to confirm or correct. Each result offers "Report a wrong count", which opens a new GitHub issue prefilled with the lift, the app's count and the user's count, and nothing else. No counting parameter changes with a tier.
- Beta (label "Beta" / « Bêta »):
  - squat: MM-Fit, all 64 sets through the counter at dfe4d43, 60 counted exactly and 63 within one (test/real-phone/mmfit/results.json). No clip of David's.
  - biceps curl, lateral raise, lat pulldown: the three lifts already offered; each keeps its place and shows Beta until its exam passes. Their build clips count 7, 10 and 10 (test/real-phone/step3d/build-compare.json).
- Experimental (label "Experimental: we are still learning this exercise" / « Expérimental : nous apprenons encore cet exercice »), offered from their existing LIFTS entries in core.ts; each is listed with the evidence it has:
  - bench press: David's build clip bench_press_7_angle counts 2 for 7 on the current core (run on 28 September).
  - hip thrust, Romanian deadlift, leg press: no clip, no dataset.
  - overhead press (added 28 September, by David's decision): David's build clip overhead_press_10_front counts 9 for 10 on the current core, which fails the Beta condition that no build clip of the lift fails; MM-Fit 49 of 60 sets exact, 60 of 60 within one (test/real-phone/mmfit/results.json). Filmed from the front; its figure comes from that clip (scripts/make-clip-pose.mjs).
- The figures of the five new lifts on the choice card and the filming screen are drawings (scripts/make-lift-poses.mjs), not recorded poses; nothing is measured from them.
