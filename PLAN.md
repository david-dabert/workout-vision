Fresh start. This message is PLAN.md. It overrides every earlier plan, the council document, your memory notes and any plan pasted from another model. Reread PLAN.md at the start of every session and after every compaction. If a later message conflicts with it, ask David whether to amend PLAN.md before acting.

RULES
- One branch, counter-core. Nothing merges to main. Work yourself, one step at a time; no background agents.
- No work outside these steps: no design, translation, coach or PDF changes until David says the exam has passed.
- Leave the old counter's code unchanged. Do not use the YouTube benchmark for any decision.
- David's five labelled clips are the only accuracy measure. Tune nothing to them; an unseen exam set decides.
- Every clip stays in every table. A clip that produces no count is scored as a failure; no metric excludes it.
- A fixed parameter may come from published training or biomechanics literature, cited in the code, never from the clips. Any other parameter is recorded as an unvalidated starting value.
- Sampling stays at 15 per second unless a clip shows a rep that 15 cannot resolve.
- Paste evidence for every claim; mark anything unchecked as unverified.
- At each STOP, confirm no video file is tracked, push counter-core to GitHub, and wait for David's reply.
- Stage files by path. Never run git add -A or git add .
- Never run npm run deploy or push to gh-pages.
- Never type a measured number by hand; every number in a report comes from a run whose output is pasted.
- Exception approved by David on 25 September: main carries a test notice, a filming tip and report-form changes; nothing else changes on main.

0. FREEZE. Stop every background agent. Commit all uncommitted work, on whatever branch it sits, to a branch named park-<date>; delete nothing. Then create counter-core from hotfix-ios and commit this message to it as PLAN.md at the repository root. List every branch with its last commit and one line on what it holds, including where the five-layer rebuild lives, and say which commit the live site serves. Confirm no video file appears anywhere in the repository's history; if one does, tell David and rewrite nothing. STOP.

1. DECODING. One extraction path for the app and every test. Decode sequentially (WebCodecs where available, otherwise playback with requestVideoFrameCallback), never one seek per frame. Apply the file's rotation metadata. Sample by timestamp at 15 per second of video without skipping samples, downscale to 640 px on the long side, and keep image and world landmarks with visibility, no frames. Regenerate the five landmark files through this path and save the middle frame of each clip as a PNG to prove orientation.
Pass mark on the Mac, in Playwright WebKit where it can decode the file, otherwise Chrome, stating which: every clip finishes; time to result is no longer than the clip itself; two runs of a clip give identical landmark files. Paste per clip: resolution, frame rate, rotation, duration, time to result. STOP.

2. COUNTING CORE. src/lib/counting/core.ts, a pure function. In: timestamped landmarks and one of the five launch lifts. Out: the count; per rep, start and end time, range of motion in degrees, concentric and eccentric durations; the arm used; a confidence. No DOM, no automatic detection, no quality gate.
- One joint angle per lift, from world landmarks: elbow for curl, bench press, shoulder press and lat pulldown; shoulder abduction for lateral raise.
- Track the arm whose shoulder, elbow and wrist are most visible across the set. Bridge short dropouts; never alternate arms frame by frame.
- A rep is the smoothed angle crossing a low and a high threshold in turn and returning, within a minimum duration. Thresholds come from the set's own range. Every parameter is in seconds or degrees, never frames.
- If a curl set may alternate arms, ask David how he counts it; do not guess.
Synthetic tests first: ten cycles must count 10 at 15, 30, 60 and 120 samples per second, with wobble of 10% of the range added, and with the tracked arm hidden for half a second mid-set. Then a per-clip table: expected, hotfix-ios count, new core count. STOP.

3. APP. Wire the core into the app behind the required lift selection. Low confidence shows "We counted N. Is that right?". Refuse only when the lift's joints are hidden for most of the set, and say why. The form score stays hidden. The app runs pose detection in its worker, the harness on the main thread; the app's own landmarks for the five clips must equal the committed files. Run the five clips through the production build (vite build, then vite preview), in WebKit with the iPhone profile and in Chrome. The old code loaded MediaPipe from a CDN because bundling it reportedly broke it on iOS Safari, and the dev server does not minify. Run the five clips through the app and paste what the result screen shows for each.

4. PREVIEW. On Vercel, production deploys only from a release branch and every other branch gets its own preview link. Make the Vite base path work on both Vercel and GitHub Pages. Give David the counter-core preview link and confirm it opens on a phone. If Vercel access fails, tell David the exact steps; install no certificate on his phone. STOP.
