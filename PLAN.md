Fresh start. This message is PLAN.md. It overrides every earlier plan, the council document, your memory notes and any plan pasted from another model. Reread PLAN.md at the start of every session and after every compaction. If a later message conflicts with it, ask David whether to amend PLAN.md before acting.

RULES
- One branch, counter-core. Nothing merges to main before Step 5, except the approved exceptions. Work yourself, one step at a time; no background agents.
- The repository lives at ~/Developer/workout-vision, outside iCloud. Work only there.
- Experience is part of the product, as accuracy is. The first visit, the choice of exercise, the guide, the result screen and the coach report are built in Step 3b and judged by David on his phone. Experience work changes nothing in src/lib/counting, the decoding path or any counting parameter.
- A screen is finished only when it has been opened in the production build in the WebKit iPhone profile, every button on it has been tapped and has led where it says, and the run shows no console error and no failed request. Paste the screenshots.
- The app states nothing it does not do. No text promises form scores, form analysis, injury prediction or precision until the exam supports it.
- Nothing about the user leaves the phone. Guide images are served by the app itself, not by a third party, and the guide shows the credit its licence requires.
- Leave the old counter's code unchanged. Do not use the YouTube benchmark for any decision.
- David's five labelled clips are the only accuracy measure. Tune nothing to them; an unseen exam set decides.
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

0. FREEZE. Stop every background agent. Commit all uncommitted work, on whatever branch it sits, to a branch named park-<date>; delete nothing. Then create counter-core from hotfix-ios and commit this message to it as PLAN.md at the repository root. List every branch with its last commit and one line on what it holds, including where the five-layer rebuild lives, and say which commit the live site serves. Confirm no video file appears anywhere in the repository's history; if one does, tell David and rewrite nothing. STOP.

1. DECODING. One extraction path for the app and every test. Decode sequentially (WebCodecs where available, otherwise playback with requestVideoFrameCallback), never one seek per frame. Apply the file's rotation metadata. Sample by timestamp at 15 per second of video without skipping samples, downscale to 640 px on the long side, and keep image and world landmarks with visibility, no frames. Regenerate the five landmark files through this path and save the middle frame of each clip as a PNG to prove orientation.
Pass mark on the Mac, in Playwright WebKit where it can decode the file, otherwise Chrome, stating which: every clip finishes; time to result is no longer than the clip itself; two runs of a clip give identical landmark files. Paste per clip: resolution, frame rate, rotation, duration, time to result. STOP.

2. COUNTING CORE. src/lib/counting/core.ts, a pure function. In: timestamped landmarks and one of the five launch lifts. Out: the count; per rep, start and end time, range of motion in degrees, concentric and eccentric durations; the arm used; a confidence. No DOM, no automatic detection, no quality gate.
- One joint angle per lift, from world landmarks: elbow for curl, bench press, shoulder press and lat pulldown; shoulder abduction for lateral raise.
- Track the arm whose shoulder, elbow and wrist are most visible across the set. Bridge short dropouts; never alternate arms frame by frame.
- A rep is the smoothed angle crossing a low and a high threshold in turn and returning, within a minimum duration. Thresholds come from the set's own range. Every parameter is in seconds or degrees, never frames.
- If a curl set may alternate arms, ask David how he counts it; do not guess.
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
- In Chrome the worker and the main-thread harness disagree. Hash the pixels handed to the landmarker at every sample in both paths, report the first sample that differs and why, and make the app and the harness share one inference path.
- Route the demuxer's FFmpeg log lines to console.info with a [demuxer] prefix, as you did for XNNPACK. Console errors remain a failure.
- index.html now allows unsafe-eval. Offset it: remove https://cdn.jsdelivr.net, https://unpkg.com and https://storage.googleapis.com from script-src and connect-src if a search proves nothing loads from them. Paste the search.
STOP.

4. PREVIEW. Done outside the repository on 25 September. The counter-core preview is https://workout-vision-next.vercel.app, built from GitHub on Azélie's Vercel account under the same /workout-vision/ path as the live site, so the base path needs no change. It does not rebuild on push; after each push to counter-core, David has it rebuilt. Step 5 still requires David's approval of the preview on his phone.

5. SWITCH. Only after David approves the preview on his phone. main takes counter-core's app through a merge, never a force push; the test notice stays. Returning users keep their history. On the live site, open the link as a first-time visitor and as a returning one, and paste both. STOP.
