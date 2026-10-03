# Architecture

Generated from the code at commit 91aa10a, 27 September 2026.
It describes what the code does, not what earlier plans intended.
Where a planning document disagrees with the code, the disagreement is listed at the end.

## 1. What runs

WorkoutVision is a static, client-only web app (React 19, Vite 5), served from GitHub Pages under `/workout-vision/`.
A person picks a lift, chooses a video of one set, and the phone counts the reps.
Pose inference, counting, storage and the PDF report all run on the device.
The video is never uploaded.

Live path, in screen order:

```
Entry ─► Choice ─► Film ─► CoreUpload ─┬─► Watch   (analysis in progress)
  │        │                           ├─► Result  (count, per-rep detail, correction)
  │        │                           │     ├─► Report  (sheet + PDF, overlay)
  │        │                           │     └─► Replay  (video with tracked body, overlay)
  │        │                           └─► AnalysisError
  │        ├─► Guide    (exercise guide, 302 exercises)
  │        └─► History  (saved sets, opens Report)
```

Routing is a URL hash (`src/lib/useHashRouter.js`): `#film`, `#analyze`, `#exercises`, `#history`.
Every other hash falls back to Choice.

## 2. Live module graph

Measured by following static and dynamic imports from `src/main.jsx`.
55 files under `src/` are reachable; 91 are not (section 5).

### 2.1 Shell

| File | Role |
|---|---|
| `src/main.jsx` | Service worker registration and deferred reload on update; global press effect; mounts `App`. |
| `src/App.jsx` | Providers (`LanguageProvider`, `ProfileProvider`), `EntryGate`, hash routing, lazy screens with pre-warming (`lazyScreen`), schema migration on start. |
| `src/lib/LanguageContext.jsx` | French and English strings from `src/locales/{fr,en}.json`; choice kept in `localStorage.wv_lang`, default from `navigator.language`. |
| `src/lib/ProfileContext.jsx` | Profile in IndexedDB; a default profile is created silently on first visit. |
| `src/components/ErrorBoundary.jsx` | Error screen with reload. |
| `src/components/experience/ScreenFade.jsx`, `Stage.jsx`, `stage-loop.js` | Cross-fades between screens; one shared animated background canvas. |

### 2.2 Screens (`src/components/experience/`)

| Screen | Role |
|---|---|
| `Entry.jsx` + `entry-scene.js`, `entry-pose.json` | First-visit animation; skipped once `wv_seen_entry` is set, forced with `?entry`. `entry-scene.js` also exports the canvas body renderer used by other screens. |
| `Choice.jsx` + `lift-scenes.js`, `lift-poses.json` | The three lifts as animated cards. Choosing one pre-fetches the pose model into the service worker cache. |
| `Film.jsx` | Filming instructions for the lift and the file picker. |
| `../CoreUpload.jsx` | Runs the analysis and switches between Watch, Result, AnalysisError, and the Report or Replay overlay. |
| `Watch.jsx` | Progress and the live tracked skeleton while frames are processed. |
| `Result.jsx` | Count, rep details, one-tap correction; saves the set (section 4). |
| `Report.jsx` + `report-sheet.js`, `report-pdf.js`, `pdf-fonts/` | Coach report: tempo, speed, range per rep, editable name and notes; PDF built with jsPDF, loaded on demand, shared through the share sheet. |
| `Replay.jsx` + `replay-track.js` | Plays the user's video with the tracked joints and the current rep and phase. `replay-track.js` is pure and unit-tested. |
| `Guide.jsx` | Exercise guide from `src/lib/exerciseGuide.js` and `src/lib/guide-catalog.json`; images copied at build time into `public/guide/`. |
| `History.jsx` + `sets.js` | Saved sets, newest first, with delete and report. `sets.js` caches the list in memory. |

### 2.3 Analysis pipeline

```
File
 │
 ▼
frameExtractor.extractFramesStreaming          main thread
   WebCodecs VideoDecoder + web-demuxer         (requestVideoFrameCallback fallback)
   15 samples/s, long side ≤ 640 px, no frame cap   ◄── extractionConfig.js
 │  RGBA pixels, transferred
 ▼
corePoseWorker.js                              Web Worker, one per analysis
   poseAnalysis.getImageLandmarker()           MediaPipe PoseLandmarker, IMAGE mode, CPU delegate
   poseAnalysis.detectPoseImage()
 │  image landmarks + world landmarks per sample
 ▼
coreAnalysis.summarizeCount → counting/core.countReps     pure, no DOM
 │
 ▼
CountResult { count, reps[], arm, confidence, angles, smoothedAngles, thresholds, refused }
```

`src/lib/coreAnalysis.js`
- `APPROVED_LIFTS = ['bicep_curl', 'lateral_raise', 'lat_pulldown']`; any other lift is rejected.
- Each worker request carries an id and a 60 s timeout; an `AbortSignal` terminates the worker.
- The count is refused when a majority of samples have no measurable joint angle.
- The final result is emitted as a `wv:core-result` window event, which the end-to-end tests read instead of injecting landmarks.

`src/lib/counting/core.ts`, the counting core
- One joint angle per lift, from 3D world landmarks: elbow, shoulder, knee or hip (`LIFTS`, 16 definitions; only the three approved lifts reach users).
- Side: the side with the highest mean visibility over the set; never switches mid-set. `bicep_curl_alternating` counts both arms and joins them.
- Conditioning: outlier removal against a local median, bridging of short dropouts, Savitzky–Golay smoothing. All windows in seconds.
- Detection: thresholds from the set's own 10th and 90th percentiles; a rep is one full cycle from the rest end and back, lasting 0.5 to 8 s.
- Per rep: start, end, range in degrees, concentric and eccentric time, peak and mean angular speed, `clipped` when the video cuts the rep.
- Sources and status of each parameter are in the file header.

`src/lib/poseAnalysis.js` is shared with the dormant pipeline.
The live path uses only `getImageLandmarker` and `detectPoseImage`; it also pulls in `poseGeometry.ts`, `oneEuroFilter.js`, `analysisConfig.js` and `gpuBenchmark.js` as imports.

## 3. Build and delivery

| Step | What it does |
|---|---|
| `prebuild`: `scripts/copy-models.js` | Copies MediaPipe WASM from `node_modules` into `public/` and downloads `pose_landmarker_full.task` into `public/mediapipe/`, so nothing is fetched from a CDN at runtime. Also run by a Vite plugin at build start. |
| `prebuild`: `scripts/copy-guide.js` | Copies and resizes guide artwork (CC BY-SA 4.0) from `@bryllim/workout-guide` into `public/guide/`. |
| `vite build` | Target ES2022 and Safari 16; chunks `react-vendor`, `localforage`, `i18n`; injects `__APP_VERSION__`, `__GIT_HASH__`, `__BUILD_TIME__`, `__FEEDBACK_URL__` (empty: the deploy no longer passes it, and the feedback panel is not reachable from the app). Base path from `VITE_BASE`. |
| `scripts/inject-sw-precache.js` | Writes the hashed asset list into `dist/sw.js`, so the app works offline after the first visit. |

`public/sw.js`: app shell precache, network-first for navigation, cache-first for assets and MediaPipe files.
`public/boot.js`: shows a script error on screen if React never mounts.
`public/cache-bust.js`: reloads with a cache-busting query when cached HTML points to deleted assets.
`src/main.jsx` delays a service worker update until the user is on Choice or the page is hidden, never during an analysis.

`.netlify/netlify.toml` exists but points at a local path on one machine; deployment is GitHub Pages only.

## 4. Data on the device

| Store | Content |
|---|---|
| IndexedDB `workoutVision/workouts` (localforage) | One record per saved set: `exercise`, `reps` (the count the user kept), `machineResult` (what the app counted), `correctedResult` (set only when the user changed it), `corrected`, `repDetails`, `arm`, `confidence`, `date`, `duration`, `source: 'counter-core'`. Schema version 1, migrated in `checkAndMigrateSchema`. |
| IndexedDB `workoutVision/profile` | Default profile, created silently. |
| IndexedDB `medical`, `food`, `milestones`, `personalRecords`, `meta` | Declared in `storage.js`; only `meta` (schema version) is used by the live path. |
| `localStorage` | `wv_lang`, `wv_seen_entry`, `wv_seen_landing`. |

No network call leaves the device during use, apart from loading the app itself and the pose model from the same origin.

## 5. Dormant code

Present in `src/`, unreachable from `src/main.jsx`.
App.jsx describes these as "hidden, not deleted".
Most are still type-checked and many are still unit-tested, so CI exercises code that users never run.

| Group | Files |
|---|---|
| Previous analysis pipeline | `analyzeVideo.js`, `poseWorker.js`, `usePoseWorker.js`, `landmarkCache.js`, `inputQualityGate.js`, `videoSuitability.js`, `cameraViewpoint.js`, `calibration.js`, `recalibrate.js`, `KalmanLandmarkFilter.js`, `AnthropometricNormalizer.js`, `SignalExtractor3D.{js,ts}`, `temporalFeatures.js`, `analysisDiagnostics.js`, `analysisConfig.ts` |
| Previous counters | `repCounter/` (index, valley, periodCounter, scoring, types), `valleyCounter.{js,ts}`, `hysteresisCounter.ts` |
| Exercise detection | `exerciseDetector.js`, `hierarchicalDetector.js`, `exerciseOntology.js`, `modelHook.js`, `sampleCapture.js` |
| Exercise catalogue and form checks | `exercises.js`, `exerciseDefinitions.js` (4,357 lines), `exerciseDSL.js`, `formBaselines.js` |
| Metrics frozen by DIRECTIVES.md | `biomechanics.ts`, `VelocityEngine.js`, `injuryRisk.js`, `injuries.js`, `ProgressionScore.js` |
| Coaching and gamification | `coach.js`, `coachingEngine.js`, `coachPDF.js`, `coachStorage.js`, `prSystem.js`, `badges.js`, `challenges.js`, `workoutOfTheWeek.js`, `shareCard.js`, `nutrition.js` (imported by `storage.js`, not used on the live path) |
| Other libraries | `AudioFeedback.js`, `haptics.ts`, `notifications.ts`, `telemetry.ts`, `correctionLog.js`, `dataPortability.js`, `useCountUp.js`, `icons.jsx`, `utils.ts` |
| Previous screens | 34 of the 36 files in `src/components/`, all except `CoreUpload.jsx` and `ErrorBoundary.jsx`: `VideoUpload`, `ResultCard`, `Dashboard`, `TabBar`, `Profile`, `Validate`, `LiveCapture`, `CoachReport`, `WeeklyReport`, `FeedbackPanel`, and others. |
| Data | `counting/guide-families.json` (tested, not imported by the app) |

Two pairs of files exist in both JavaScript and TypeScript (`SignalExtractor3D`, `valleyCounter`, `analysisConfig`); only `analysisConfig.js` is live.

## 6. Tests and evidence

| Command or file | Scope |
|---|---|
| `npm test` (Vitest) | `src/lib/counting/__tests__/` covers the live counting core: synthetic signals, real-phone landmarks, lift definitions, range, stability, per-rep measures, guide families. `src/components/experience/__tests__/` covers replay and report logic. `src/lib/__tests__/` covers `coreAnalysis.js` and, for the rest, dormant modules. |
| `npm run typecheck` | `tsc --noEmit` on `tsconfig.json` (strict, `allowJs`, `checkJs: false`), so only TypeScript files are actually checked. |
| `npm run lint` | oxlint, React hooks rules. |
| `playwright.core.config.js` → `e2e/core-app.spec.js` | The full live pipeline on the real-phone clips, in WebKit (iPhone 13) and Chrome, read through `wv:core-result`. Run by hand. |
| `playwright.decode.config.js` → `e2e/decode-clips.spec.js` | Decodes the five real-phone clips to landmarks in `test/real-phone/landmarks/`, and checks determinism. Run by hand. |
| `playwright.config.js` → `e2e/offline.spec.js`, `history.spec.js` and the other `e2e/*.spec.js` | App-level checks; `offline.spec.js` runs in the deploy workflow. |
| `test/real-phone/rep-parity.mjs`, `replay-check.mjs`, `checks.mjs` | Scripted checks against a local preview: count parity between WebKit and Chromium, replay, blank-screen detection. Evidence folders per round (`step3`, `round3`, `round5`, `round7`, and others). |
| `test/real-phone/landmarks/` | Landmarks for five real-phone clips (bench press, curl, lat pulldown, lateral raise, overhead press). The videos themselves are not in the repository. |
| `benchmark/` | Countix replay benchmark (`replay-benchmark.mjs`) against the previous counter (`RepCounter`), landmark caches, results from 7 September. |
| `scripts/src-hash.mjs` | SHA-256 of `src/`, used to tie evidence to a code state. |
| `scripts/collect-clips.mjs` | Local server to send clips and counts from a phone to the development machine. |

## 7. Continuous integration

| Workflow | Trigger | Steps |
|---|---|---|
| `.github/workflows/ci.yml` | Push and pull request on `main` and `counter-core` | Four jobs. Quality: lint, typecheck, unit tests, `npm run scoreboard` (the stored landmarks of the labelled real-phone sets), the 96 synthetic sets against `synth.txt`, build. Browser tests: Playwright in Chromium and WebKit on the production build. Tour: WebKit with the iPhone profile at three sizes. Journey: the production app driven end to end by three rendered synthetic videos, with an accessibility audit. |
| `.github/workflows/deploy.yml` | CI succeeding on a push to `main`, or by hand | Checks out the commit CI passed; lint, unit tests, build, Playwright offline test, deploy to GitHub Pages. |

No workflow decodes a real-phone video through the app on a phone: David's iPhone check stays the gate for that (CLAUDE.md R6).

## 8. Outside the app

`feedback-worker/`: a Cloudflare Worker with a D1 database that accepts anonymous structured feedback (`POST /ingest`, 4 KB limit, landmarks and video fields refused) and serves aggregates (`GET /dashboard`).
The only caller is `FeedbackPanel.jsx`, which is dormant, so the live app sends nothing to it.

`design/experience-prototype.html` is the approved visual prototype for the live screens.

## 9. Where the documents and the code disagree

| Document | Says | Code says |
|---|---|---|
| `CLAUDE.md` R2, R6 | Counting changes go through `npm run scoreboard`; CI includes a real-phone gate. | Since 2 October `npm run scoreboard` exists and CI runs it on the stored landmarks of the real-phone clips; no workflow decodes the real-phone videos through the app. |
| `DIRECTIVES.md` 0.5 | Crash breadcrumbs on the current stage. | `wv_analysis_stage` is written only by `VideoUpload.jsx`, which is dormant. |
| `DIRECTIVES.md` 1.1 | `test/real-phone/manifest.json` with true count, view, labeller, date. | Only `test/real-phone/landmarks/manifest.json`, which records extraction data; true counts sit in test code and in file names. |
