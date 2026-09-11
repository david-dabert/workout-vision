# WorkoutVision

On-device AI workout analysis. Upload a video of your exercise, get rep counts, form scores, and biomechanical feedback. Everything runs locally in the browser — no server, no uploads, no account.

**Live app:** [david-dabert.github.io/workout-vision](https://david-dabert.github.io/workout-vision/)

## What it does

- Detects 274 exercises from pose landmarks using a heuristic classifier with confidence scoring (low-confidence detections flagged in UI)
- Counts reps via valley detection on joint angle signals (video mode) and a 5-stage biomechanical FSM (live mode)
- Scores form using declarative checks compiled from an exercise DSL (237 exercises with real checks, 37 with placeholder stubs scored as N/A)
- Computes velocity, time under tension, ROM, bilateral asymmetry, and fatigue trends
- Progressive exercise detection during frame extraction (early feedback before analysis completes)
- Video suitability checks (occlusion, lighting, camera angle) before analysis starts
- Works fully offline after first load (MediaPipe WASM + model self-hosted, cached via service worker)

## Architecture

```
VideoUpload.jsx          Frame extraction (seek-based, main thread)
       |                    + progressive exercise detection
       |                    + video suitability checks
       v
analyzeVideo.js -------> poseWorker.js (Web Worker)
       |                    MediaPipe inference
       |                    Kalman filtering
       |                    Angle extraction
       |                    (ImageBitmap transfer, zero-copy)
       |                    Concurrent pipeline: max 4 in-flight
       v                    frames with back-pressure + in-order drain
RepCounter.js            Valley counting + FSM rep detection
       |                    Form checks evaluated every frame
       v
biomechanics.js          Velocity, TUT, ROM, asymmetry, fatigue
       |
       v
coach.js                 Performance grading, recovery, suggestions
```

Frame extraction runs on the main thread (native `<video>` seeking with `requestVideoFrameCallback` where available). Pose inference runs in a Web Worker when the browser supports module workers + OffscreenCanvas, with main-thread fallback. The pipeline uses concurrent frame dispatch (up to 4 in-flight) with semaphore-based back-pressure and ordered result collection, achieving higher throughput than sequential processing.

Memory management adapts to device capabilities: frame caps scale with `navigator.deviceMemory`, frame arrays are released after analysis, and iOS-specific limits apply.

## Tech stack

- React 19 + Vite 5
- MediaPipe Pose Landmarker 0.10.8 (WASM, on-device)
- CSS Modules for component styling
- localforage (IndexedDB persistence)
- On-device telemetry (localStorage only, no external calls)
- PWA with offline-first service worker (app shell + model precaching)
- No required backend. No tracking. Optional feedback worker (Cloudflare) for user-initiated reports only.

## Known limitations

- Video upload is the primary mode; live camera FSM exists but is not first-class yet
- Velocity is computed from monocular 2D pose (normalized coordinates scaled by user height); treat as relative, not absolute
- 37 of 274 exercises have placeholder form checks (scored as N/A, not fake 100%)
- Extreme long videos or very low-end devices will still feel browser memory limits despite adaptive capping

## Development

```bash
npm install
npm run dev        # dev server at localhost:5173
npm test           # vitest (94 unit tests)
npm run build      # production build
npm run deploy     # build + deploy to GitHub Pages
```

## Benchmark

A validation harness (`?validate=1`) runs the engine against the Countix benchmark (43 videos, 9 exercises) with ground truth rep counts. Results include accuracy, MAE, OBO accuracy, and per-video diagnostics.

## License

MIT
