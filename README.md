# WorkoutVision

Film one set on your phone. The phone counts the reps.
The video is analysed on the phone and never leaves it.

**Live app (test version):** [david-dabert.github.io/workout-vision](https://david-dabert.github.io/workout-vision/)

## What it does

- Counts the reps of 181 exercises. You choose the exercise; the app does not guess it. Four are Beta: lateral raise, biceps curl, lat pulldown and squat. All the others are Experimental, and say so on the result (src/lib/liftTiers.js, src/lib/offer.js); they are counted by their movement pattern (src/lib/counting/guide-patterns.json).
- Shows how to film each lift before you choose the video.
- Shows the count and asks you to confirm it or enter the true number. When most of the set cannot be seen, it says so and counts nothing.
- Replays the set with the tracked body drawn over the video, the counting joint lit, and each rep marked on a timeline.
- Builds a coach report, on screen and as a PDF shared from the phone:
  - lift, date, client, coach, count and notes;
  - per rep: range of motion in degrees, concentric and eccentric time, tempo, peak and mean angular speed in degrees per second, and a mark for short reps;
  - per set: time under tension, change in concentric speed from the first two reps to the last two, average tempo, and a comparison with the previous saved set of the same lift.
- Makes, on a tap, a video of the set with its overlay, handed to the phone's share sheet; nothing is sent unless the user shares it.
- Lets the user report a wrong count by e-mail or GitHub issue, and challenge a friend through the share sheet, each on a tap.
- Keeps saved sets in a history on the phone, with progress per exercise and personal bests, and exports them as two spreadsheet files for a coach.
- Adapts the result screen to the user's level: beginner, intermediate or expert.
- Works in French and English.

## What it does not do

- It does not score form, predict injury or estimate strength.
- It does not measure bar speed in metres per second; speeds are joint angles per second.
- No exercise has passed the exam PLAN.md requires; the exam sets are still to be filmed (test/real-phone/exam/README.md).
- Accuracy on David's own labelled sets, all of them build sets, never exam sets: of 14 sets, 7 counted exactly, 6 off by 1 or 2, and 1 refused, where no count is shown (the core alone counts 3 for 7 on it: test/real-phone/accuracy/diagnosis.txt) (npm run scoreboard, 30 September 2026: [test/real-phone/accuracy/scoreboard.txt](https://github.com/david-dabert/workout-vision/blob/84e020a000e78074a028447e471530938eaa2707/test/real-phone/accuracy/scoreboard.txt)). David will count again, blind, every labelled set whose video starts or ends inside a rep (test/real-phone/accuracy/label-watch.txt).
- Accuracy on other people is measured on the MM-Fit dataset, admitted as build data and never as an exam, through the test harness in desktop Chrome rather than through the app on a phone. Of the four Beta lifts it covers the lateral raise and the squat: it holds no lat pulldown, and its curls are counted as alternating curls. Results of the run of 27 September 2026: [test/real-phone/mmfit/table.md](https://github.com/david-dabert/workout-vision/blob/dfe4d43f9fdcf27c37ad92e1992db8fed64bcdf9/test/real-phone/mmfit/table.md).
- This is a test version.

## Privacy

Pose detection, counting, storage and the PDF all run in the browser on the phone.
No video, frame or landmark is sent anywhere; only what the user shares by a tap leaves the phone, through the phone's own share sheet or mail app.
Saved sets stay in the phone's browser storage.

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

MIT
