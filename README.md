# WorkoutVision

Film one set on your phone. The phone counts the reps.
The video is analysed on the phone and never leaves it.

**Live app (test version):** [david-dabert.github.io/workout-vision](https://david-dabert.github.io/workout-vision/)

## What it does

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
- It counts no other lift yet. The three lifts on offer have not yet passed the exam PLAN.md requires; their exams are still to be filmed. No further lift is offered until it counts every one of its exam sets exactly.
- This is a test version.

## Privacy

Pose detection, counting, storage and the PDF all run in the browser on the phone.
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
