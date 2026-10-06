# WorkoutVision

Film one set on your phone. The phone counts the reps.
The video is analysed on the phone; the app sends it nowhere.

**Live app (test version):** [david-dabert.github.io/workout-vision](https://david-dabert.github.io/workout-vision/)

## What it does

- Counts the reps of 182 exercises, and scores two fitness tests over 30 seconds: the chair stand and the arm curl (src/lib/fitness-tests.js). You choose the exercise; the app does not guess it. Five are Beta: biceps curl, lat pulldown, squat, Romanian deadlift and leg press. A lift is Beta only if it is not a press and every one of David's labelled sets of it counts exactly (npm run scoreboard, 6 October 2026: biceps curl 5/5 and 7/7, lat pulldown 10/10, squat 7/7, Romanian deadlift 8/8, leg press 13/13); a test fails when the tiers disagree with the sets (test/real-phone/accuracy/tiers.test.ts, tiers.txt). The lateral raise is Experimental since 3 October: one of its two sets counts 8 for 9. The hip thrust is Experimental since 6 October: of its three sets, two count exactly (6 for 6, twice) and one counts 6 for 7. The machine seated back extension is Experimental since 6 October: one of its two sets counts 8 for 13 (7 before the hold rule of 6 October), the pose lost in the middle of the set. All the others are Experimental, and say so on the result (src/lib/liftTiers.js, src/lib/offer.js). The Beta lifts come first, on the cards and in the list; they are counted by their movement pattern (src/lib/counting/guide-patterns.json). Four floor exercises counted on both sides (dead bug, banded dead bug, bird dog, glute bridge march) are withdrawn since 3 October: filmed in profile, the far side is hidden (src/lib/offer.js, BACKLOG.md). Two were added the same day, Experimental and measured on no set: the behind-the-neck press and the wall ball; the barbell jump squat is in the guide but not counted yet (a lifter who stands between jumps can read each landing as a rep). The machine seated back extension was added on 5 October, Experimental and measured on no set.
- Shows how to film each lift before you choose the video.
- Counts live, as an option beside the video (Film screen, "Live"; src/components/experience/Live.jsx): the phone's camera opens in the app, a 3-second countdown starts the set, and the count grows on screen as each rep ends, with a short vibration where the phone has one and the number spoken by the phone's own voice (can be turned off). The count shown during the set is provisional; when the set ends, the whole set is counted by the same function, on the same 15 samples a second, as a filmed video, and the result says so if the two differ. No number is shown before the first rep or while you are out of the frame. Not yet checked on an iPhone (3 October 2026); the video stays the default until it is.
- Shows the count and asks you to confirm it or enter the true number. When most of the set cannot be seen, it says so and counts nothing.
- Replays the set with the tracked body drawn over the video, the counting joint lit, and each rep marked on a timeline.
- Builds a coach report, on screen and as a PDF shared from the phone:
  - lift, date, client, coach, count and notes;
  - per rep, under an experimental label since none is validated on real phone video (src/components/experience/measures.js): range of motion in degrees, concentric and eccentric time, tempo, peak and mean angular speed in degrees per second, and a mark for short reps;
  - per set: time under tension, average tempo, the angle over the whole set with each rep marked, and a comparison with the previous saved set of the same lift. The change in speed between the first and last reps is not stated: on synthetic sets it could not be told from noise.
- Makes, on a tap, a video of the set with its overlay, handed to the phone's share sheet; nothing is sent unless the user shares it.
- Lets the user report a wrong count by e-mail or GitHub issue, and challenge a friend through the share sheet, each on a tap.
- Asks, after the first saved set, whether the user wants to help improve the count (once more at most, from the fifth set, if the answer was "not now"); with a yes, each saved set's pose and counts are kept on the phone and sent only when the user taps Send (see Privacy).
- Keeps saved sets in a history on the phone, with progress per exercise and personal bests, and exports them as two spreadsheet files for a coach.
- Adapts the result screen to the user's level: beginner, intermediate or expert.
- Works in French and English.

## What it does not do

- It does not score form, predict injury or estimate strength.
- It does not measure bar speed in metres per second; speeds are joint angles per second.
- No exercise has passed the exam PLAN.md requires; the exam sets are still to be filmed (test/real-phone/exam/README.md).
- Accuracy on David's own labelled sets, all of them build sets, never exam sets: of 18 sets, 11 counted exactly, 5 off by 1 or 2, 1 off by 5 (a hip thrust in which the pose is lost mid-set), and 1 refused, where no count is shown (npm run scoreboard, 6 October 2026: test/real-phone/accuracy/scoreboard.txt). On the public build half (1064 sets scored by the same counter, never the held-out half: 894 Countix, which are 447 clips each read twice, cut to the labelled window and whole; 12 CFRep, CrossFit squats and deadlifts whose every attempt a certified judge marked; 158 MM-Fit, curls, rows, lateral raises, presses and squats filmed front on, from its 14 build workouts): 490 exact, 46 % (npm run scoreboard:public, 6 October 2026: test/real-phone/accuracy/public-scoreboard.txt). Since the two readings of a clip are not independent, the same output also prints, per distinct clip: "Countix by distinct clip: 447 labelled clips from 435 YouTube videos, each read twice (cut and whole): both readings 157 exact (35%, 95% Wilson 31-40%); either reading 198 exact (44%, 95% Wilson 40-49%)." Bench press and overhead press sets are measured and shown but decide nothing (PLAN.md), so the gates count 10 exact of David's 13 other sets and 431 exact of the 949 other public sets (npm run scoreboard:public, 6 October 2026). One counting setting, the share of the way back a last rep cut by the video must reach (CUT_RETURN_SHARE), was first chosen partly while watching one of David's sets; it was re-chosen on the public build half A only on 3 October (TRIED.md), and David's count stayed 8 of 14 (9 since the same day's first-return rule, TRIED.md). David will count again, blind, every labelled set whose video starts or ends inside a rep (test/real-phone/accuracy/label-watch.txt).
- Accuracy on other people is measured on the MM-Fit dataset, admitted as build data and never as an exam, through the test harness in desktop Chrome rather than through the app on a phone. Of the Beta lifts it covers the squat: it holds no lat pulldown, hip thrust or Romanian deadlift, and its curls are counted as alternating curls. It also covers the lateral raise, Experimental since 3 October. Results of the run of 27 September 2026: [test/real-phone/mmfit/table.md](https://github.com/david-dabert/workout-vision/blob/dfe4d43f9fdcf27c37ad92e1992db8fed64bcdf9/test/real-phone/mmfit/table.md).
- This is a test version.

## Privacy

Pose detection, counting, storage and the PDF all run in the browser on the phone.
The app never uploads the video, its frames or the landmarks to any server. Only what the user shares by a tap leaves the phone, through the phone's own share sheet, mail app or a downloaded file: that includes, if the user makes and shares it, the video of the set with its overlay (above).
Saved sets stay in the phone's browser storage.

Live counting: the camera's picture is read in the browser, 15 times a second, by the same pose model, and dropped as soon as it is read; only the joint positions are kept, on the phone, as for a video. The camera's picture is never recorded and never sent; the joint positions leave the phone only as for a video, when the user shares a set or sends a contribution by a tap (below), and the usage counts carry no movement data. The camera closes when the set ends, when you leave the screen, when the phone locks or when live counting stops on a problem, and the microphone is never opened. The numbers are spoken only by a voice that runs on the phone (some browsers offer voices made on a server; those are never used, so no number leaves the phone that way). Two choices are kept in the browser, with no identifier: the last way of filming chosen (video or live) and whether the count is spoken. A live set is counted in the usage counts as a video filmed and an analysis, with the same events (below).

Usage counts: the app counts anonymously how often its screens and analyses are used (no identity, no video, no movement data), to improve it. This is the one thing the app sends without a tap, and only from a build that names the counting server (VITE_EVENTS_URL; none is set as of 3 October 2026, so the live app sends nothing). Each count is an event's name from a fixed list (the app opened, a lift chosen, a video chosen, an analysis started, and how it ended, a count kept or corrected, a report opened, a share, the end of a visit), with where relevant the lift and its tier, the visit's length in one of four buckets (under 1, 1 to 5, 5 to 15, over 15 minutes), the app version and the language (src/lib/events.js, feedback-worker/usage-schema.js). Nothing identifies the phone or the person: no cookie, no id, nothing stored to tell one visit from another. The server, ours (feedback-worker/), keeps only a total per day for each combination; it stores no IP address, and its rate limit uses a salted hash of the IP that it deletes within three minutes, by a job that runs every minute (feedback-worker/README.md). The app sends nothing when the browser sends Global Privacy Control or Do Not Track, and a line on the choice of lift, under "Your sets", says what is counted and turns it off on the phone.

"Help improve the count" is opt-in. The app asks on the saved card of the first set: one sentence says what is kept and why, "What exactly?" opens the full list below, and the answers are "Yes, help" or "Not now". "Not now" stores nothing and is asked once more at most, from the fifth saved set; after a yes or a no it is never asked again. The answer can be changed in the history at any time; stopping erases the sets waiting to be sent (src/lib/contribute.js, src/components/experience/ContributeAsk.jsx). The phone keeps how many times the question was shown and the number of sets saved the first time (`wv_contribute_asked`, for example "1@1"): a count, not an identifier, and it never leaves the phone.
With a yes, each saved set is kept on the phone as a contribution: the exercise, the app's count, the user's count and whether it was corrected; the joint positions (3D and in the image) and the time of every analysed frame, and the side tracked; the video's length, image size, rotation, how it was decoded, the number of frames and the analysis settings; the phone and browser as the browser states them (user agent, platform, processor cores, memory, touch points, screen size and pixel density); and the app version.
The file holds no video, no name and no date of the set.
Nothing leaves the phone until the user taps Send in the history: the file goes to the phone's share sheet, or is downloaded, for the user to send to David at pr.dabertdavid@gmail.com (src/components/experience/ContributeHistory.jsx).

## How it works

The video is decoded on the phone at 15 samples per second, and MediaPipe Pose runs in a Web Worker on each sample.
One joint angle per lift is taken from the 3D landmarks, smoothed, and counted as full cycles away from the rest position and back.
See [ARCHITECTURE.md](ARCHITECTURE.md) for the modules and data flow.

## Development

```bash
npm ci
npm run dev        # dev server, this computer only
npm run dev:lan    # dev server on the local network, for a phone on the same Wi-Fi (test/, benchmark/ and videos not served)
npm test           # unit tests (Vitest)
npm run lint       # oxlint
npm run typecheck  # tsc --noEmit
npm run build      # production build
```

Rules, steps and current state: [PLAN.md](PLAN.md).

## License

MIT: see [LICENSE](LICENSE). The bundled fonts and the MediaPipe pose model keep their own licences.
