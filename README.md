# WorkoutVision

On-device AI workout analysis. Upload a video of your exercise, get rep counts, form scores, and biomechanical feedback. Everything runs locally in the browser — no server, no uploads, no account.

**Live app:** [david-dabert.github.io/workout-vision](https://david-dabert.github.io/workout-vision/)

## What it does

- Detects 274 exercises from pose landmarks using a heuristic classifier
- Counts reps via valley detection on joint angle signals (video mode) and a 5-stage biomechanical FSM (live mode)
- Scores form using declarative checks compiled from an exercise DSL (238 exercises with real checks, 37 with placeholder stubs)
- Computes velocity, time under tension, ROM, bilateral asymmetry, and fatigue trends
- Works fully offline after first load (MediaPipe WASM + model self-hosted, cached in IndexedDB)

## Architecture

```
VideoUpload.jsx          Frame extraction (seek-based, main thread)
       |
       v
usePoseWorker.js ------> poseWorker.js (Web Worker)
       |                    MediaPipe inference
       |                    Kalman filtering
       |                    Angle extraction
       v                    (ImageBitmap transfer, zero-copy)
RepCounter.js            Valley counting + FSM rep detection
       |
       v
biomechanics.js          Velocity, TUT, ROM, asymmetry, fatigue
       |
       v
coach.js                 Performance grading, recovery, suggestions
```

Frame extraction runs on the main thread (native `<video>` seeking). Pose inference runs in a Web Worker when the browser supports module workers + OffscreenCanvas, with main-thread fallback. The pipeline is serialized (one frame at a time) at 4-8 fps adaptive.

## Tech stack

- React 19 + Vite 5
- MediaPipe Pose Landmarker 0.10.8 (WASM, on-device)
- localforage (IndexedDB persistence)
- No backend. No analytics. No tracking.

## Known limitations

- Video upload only; no live camera mode yet
- 4-8 fps ceiling due to serialized seek-based extraction
- Velocity is computed from monocular 2D pose (normalized coordinates scaled by user height); treat as relative, not absolute
- 37 exercises have placeholder form checks (scored as N/A, not fake 100%)
- Auto-detection always picks best match; no "I don't know" threshold yet
- Form checks sample at most 8 frames per rep

## Development

```bash
npm install
npm run dev        # dev server at localhost:5173
npm test           # vitest (78 unit tests)
npm run build      # production build
npm run deploy     # build + deploy to GitHub Pages
```

## License

MIT
