# WorkoutVision

Film one set on your phone. The phone counts the reps.
The video is analysed on the phone; the app sends it nowhere.

**Live app (test version):** [david-dabert.github.io/workout-vision](https://david-dabert.github.io/workout-vision/)

## What it does

- Counts the reps of 181 exercises, and scores two fitness tests over 30 seconds: the chair stand and the arm curl (src/lib/fitness-tests.js). You choose the exercise; the app does not guess it. Six are Beta: biceps curl, lat pulldown, squat, hip thrust, Romanian deadlift and leg press. A lift is Beta only if it is not a press and every one of David's labelled sets of it counts exactly (npm run scoreboard, 3 October 2026: biceps curl 5/5 and 7/7, lat pulldown 10/10, squat 7/7, hip thrust 6/6, Romanian deadlift 8/8, leg press 13/13); a test fails when the tiers disagree with the sets (test/real-phone/accuracy/tiers.test.ts, tiers.txt). The lateral raise is Experimental since 3 October: one of its two sets counts 8 for 9. All the others are Experimental, and say so on the result (src/lib/liftTiers.js, src/lib/offer.js). The Beta lifts come first, on the cards and in the list; they are counted by their movement pattern (src/lib/counting/guide-patterns.json). Four floor exercises counted on both sides (dead bug, banded dead bug, bird dog, glute bridge march) are withdrawn since 3 October: filmed in profile, the far side is hidden (src/lib/offer.js, BACKLOG.md). Two were added the same day, Experimental and measured on no set: the behind-the-neck press and the wall ball; the barbell jump squat is in the guide but not counted yet (a lifter who stands between jumps can read each landing as a rep).
- Shows how to film each lift before you choose the video.
- Shows the count and asks you to confirm it or enter the true number. When most of the set cannot be seen, it says so and counts nothing.
- Replays the set with the tracked body drawn over the video, the counting joint lit, and each rep marked on a timeline.
- Builds a coach report, on screen and as a PDF shared from the phone:
  - lift, date, client, coach, count and notes;
  - per rep, under an experimental label since none is validated on real phone video (src/components/experience/measures.js): range of motion in degrees, concentric and eccentric time, tempo, peak and mean angular speed in degrees per second, and a mark for short reps;
  - per set: time under tension, average tempo, the angle over the whole set with each rep marked, and a comparison with the previous saved set of the same lift. The change in speed between the first and last reps is not stated: on synthetic sets it could not be told from noise.
- Makes, on a tap, a video of the set with its overlay, handed to the phone's share sheet; nothing is sent unless the user shares it.
- Lets the user report a wrong count by e-mail or GitHub issue, and challenge a friend through the share sheet, each on a tap.
- Asks once whether the user wants to help improve the count; with a yes, each saved set's pose and counts are kept on the phone and sent only when the user taps Send (see Privacy).
- Keeps saved sets in a history on the phone, with progress per exercise and personal bests, and exports them as two spreadsheet files for a coach.
- Adapts the result screen to the user's level: beginner, intermediate or expert.
- Works in French and English.

## What it does not do

- It does not score form, predict injury or estimate strength.
- It does not measure bar speed in metres per second; speeds are joint angles per second.
- No exercise has passed the exam PLAN.md requires; the exam sets are still to be filmed (test/real-phone/exam/README.md).
- Accuracy on David's own labelled sets, all of them build sets, never exam sets: of 14 sets, 9 counted exactly, 4 off by 1 or 2, and 1 refused, where no count is shown (npm run scoreboard, 3 October 2026: test/real-phone/accuracy/scoreboard.txt). On the public build half (894 Countix sets scored by the same counter, never the held-out half): 355 exact, 40 % (npm run scoreboard:public, 3 October 2026: test/real-phone/accuracy/public-scoreboard.txt). Bench press and overhead press sets are measured and shown but decide nothing (PLAN.md), so the gates count 8 exact of David's 9 other sets and 332 exact of the 818 other public sets (same runs). One counting setting, the share of the way back a last rep cut by the video must reach (CUT_RETURN_SHARE), was first chosen partly while watching one of David's sets; it was re-chosen on the public build half A only on 3 October (TRIED.md), and David's count stayed 8 of 14 (9 since the same day's first-return rule, TRIED.md). David will count again, blind, every labelled set whose video starts or ends inside a rep (test/real-phone/accuracy/label-watch.txt).
- Accuracy on other people is measured on the MM-Fit dataset, admitted as build data and never as an exam, through the test harness in desktop Chrome rather than through the app on a phone. Of the Beta lifts it covers the squat: it holds no lat pulldown, hip thrust or Romanian deadlift, and its curls are counted as alternating curls. It also covers the lateral raise, Experimental since 3 October. Results of the run of 27 September 2026: [test/real-phone/mmfit/table.md](https://github.com/david-dabert/workout-vision/blob/dfe4d43f9fdcf27c37ad92e1992db8fed64bcdf9/test/real-phone/mmfit/table.md).
- This is a test version.

## Privacy

Pose detection, counting, storage and the PDF all run in the browser on the phone.
The app never uploads the video, its frames or the landmarks to any server. Only what the user shares by a tap leaves the phone, through the phone's own share sheet, mail app or a downloaded file: that includes, if the user makes and shares it, the video of the set with its overlay (above).
Saved sets stay in the phone's browser storage.

"Help improve the count" is opt-in. The app asks once, on the saved card, and the answer can be changed in the history at any time; stopping erases the sets waiting to be sent (src/lib/contribute.js).
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
npm run dev        # dev server
npm test           # unit tests (Vitest)
npm run lint       # oxlint
npm run typecheck  # tsc --noEmit
npm run build      # production build
```

Rules, steps and current state: [PLAN.md](PLAN.md).

## License

MIT: see [LICENSE](LICENSE). The bundled fonts and the MediaPipe pose model keep their own licences.
