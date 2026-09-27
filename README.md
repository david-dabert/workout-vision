# WorkoutVision

WorkoutVision is built to count the reps of one set filmed on your phone, on the phone itself.
The video is analysed on the phone and never leaves it.

**Live app (test version):** [david-dabert.github.io/workout-vision](https://david-dabert.github.io/workout-vision/)

**Counting is paused** while each exercise is tested on new videos. The guide, the saved sets and their reports remain available.

## What it does when counting runs

- Counts the reps of three lifts: biceps curl, lateral raise and lat pulldown. You choose the lift; the app does not guess it.
- Shows how to film each lift before you choose the video.
- Shows the count and asks you to confirm it or enter the true number. When most of the set cannot be seen, it says so and counts nothing.
- Replays the set with the tracked body drawn over the video, the counting joint lit, and each rep marked on a timeline.
- Builds a coach report, on screen and as a PDF shared from the phone:
  - lift, date, client, coach, count and notes;
  - per rep: range of motion in degrees, concentric and eccentric time, tempo, peak and mean angular speed in degrees per second, and a mark for short reps;
  - per set: time under tension, change in concentric speed from the first two reps to the last two, average tempo, and a comparison with the previous saved set of the same lift.
- Keeps saved sets in a history on the phone.
- Works in French and English.

## What it does not do

- It does not score form, predict injury or estimate strength.
- It does not measure bar speed in metres per second; speeds are joint angles per second.
- It is built for no other lift yet. The three lifts on offer have not yet passed the exam PLAN.md requires; their exams are still to be filmed. No further lift is offered until it counts every one of its exam sets exactly.
- Accuracy on other people is measured on the MM-Fit dataset, admitted as build data and never as an exam, through the test harness in desktop Chrome rather than through the app on a phone. Of the three lifts on offer it covers only the lateral raise: it holds no lat pulldown, and its curls are counted as alternating curls, which the app does not offer. Results of the run of 27 September 2026: [test/real-phone/mmfit/table.md](https://github.com/david-dabert/workout-vision/blob/dfe4d43f9fdcf27c37ad92e1992db8fed64bcdf9/test/real-phone/mmfit/table.md).
- This is a test version.

## Privacy

When counting runs, pose detection, counting, storage and the PDF all run in the browser on the phone.
No video, frame or landmark is sent anywhere.
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
