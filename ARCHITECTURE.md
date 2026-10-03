# Architecture

Regenerated from the code at commit 4a0b515, 3 October 2026 (third audit, C09, C22, C33, C41, C47; the previous version described commit 91aa10a of 27 September).
It describes what the code does, not what earlier plans intended.
Where a planning document disagrees with the code, the disagreement is listed at the end.

## 1. What runs

WorkoutVision is a static, client-only web app (React 19, Vite 5), served from GitHub Pages under `/workout-vision/`.
A person picks an exercise, chooses a video of one set, and the phone counts the reps.
Pose inference, counting, storage and the PDF report all run on the device.
The video is never uploaded.

Live path, in screen order:

```
Entry ─► Choice ─┬─► Film ─► CoreUpload ─┬─► Watch   (analysis in progress)
  │              │                       ├─► Result  (count, per-rep detail, correction)
  └─► Demo       │                       │     ├─► Report  (sheet + PDF, overlay)
                 │                       │     └─► Replay  (video with tracked body, overlay)
                 │                       └─► AnalysisError, AnalysisInterrupted, AnalysisIncomplete
                 ├─► Guide    (exercise guide; "Filmer cet exercice" goes on to Film)
                 └─► History  (saved sets, progress, export, backup, contributions; opens Report)
```

Routing is a URL hash (`src/lib/useHashRouter.js`).
`App.jsx` renders Film for `#film` once an exercise is chosen, CoreUpload for `#analyze` once a video is chosen, Guide for `#exercises` and History for `#history`; every other hash, and those two without their choice, shows Choice.
Choosing an exercise warms the pose model and WASM files into the service worker's caches (`src/lib/pose-files.js`).
A person whose level is beginner (`level.js`, `wv_level`) is shown the exercise's guide page before Film until `GUIDED_SETS` (3) sets are saved; a fitness test goes straight to Film.

The same build also serves three tool pages that are not linked from the app: `collect.html` and `collect-batch.html` (the set collectors: landmarks and the person's count, shared as a file) and `check.html` (David's five labelled clips counted by `analyzeCoreVideo` and compared with `src/lib/check-baseline.json`).

## 2. Live module graph

Measured with `node scripts/unreachable.mjs` on 3 October 2026, which follows static and dynamic imports from the four HTML pages: 98 source files under `src/` are reachable and 93 are not (section 5; test files excluded).
`index.html` alone reaches 91 of the 98; the other 7 belong to the tool pages (`collect-main.js`, `collect-batch-main.js`, `check-main.js`, `lib/collector.js`, `lib/collectSet.js`, `lib/batchCollect.js`, `lib/check.js`).

### 2.1 Shell

| File | Role |
|---|---|
| `src/main.jsx` | Service worker registration and deferred reload on update; global press effect; mounts `App`. |
| `src/App.jsx` | Providers (`LanguageProvider`, `ProfileProvider`), `EntryGate`, hash routing, lazy screens warmed in pauses without a touch (`lazyScreen`, `whenQuiet.js`), schema migration on start; `PerfOverlay` only with `?perf=1` (`perfFlag.js`). |
| `src/lib/LanguageContext.jsx` | French and English strings from `src/locales/{fr,en}.json`; choice kept in `localStorage.wv_lang`. |
| `src/lib/ProfileContext.jsx` | Profile in IndexedDB; a default profile is created silently on first visit. |
| `src/components/ErrorBoundary.jsx` | Error screen with reload. |
| `src/components/PerfOverlay.jsx` | On-device instrument (frame rate, frames dropped in a swipe), shown only with `?perf=1`; sends nothing. |
| `src/components/experience/ScreenFade.jsx`, `Stage.jsx`, `stage-loop.js` | Cross-fades between screens; one shared animated background canvas. |

### 2.2 Screens (`src/components/experience/`)

| Screen | Role |
|---|---|
| `Entry.jsx` + `entry-scene.js`, `entry-pose.json` | First-visit animation; skipped once `wv_seen_entry` is set, forced with `?entry`. `entry-scene.js` also exports the canvas body renderer used by other screens. Opens `Demo.jsx` on demand: a drawn squat that the counting core counts as it plays (`demo-set.js`, `demo-figure.js`). |
| `Choice.jsx` + `lift-meta.js`, `lift-scenes.js`, `lift-poses.json` | The nine card lifts of `lift-meta.js` as animated cards, with their tier; below them "Another exercise" (Guide), the two fitness tests, "Your sets" (History) and `ExerciseList.jsx`, the searchable list of every offered exercise but the tests (179), loaded after the cards. |
| `Film.jsx` + `exercise-info.js` | Filming instructions (the view from `filmView`: the card's reference view, a fitness test's, else `guide-families.json`'s), the guide's drawings, a test's protocol, and the file picker. |
| `../CoreUpload.jsx` | Runs the analysis, holds the screen awake and aborts it if the page is hidden (`src/lib/interruption.js`), and switches between Watch, Result, the three error screens, and the Report or Replay overlay. |
| `Watch.jsx` | Progress and the live tracked skeleton while frames are processed. |
| `Result.jsx` | Count, rep details, one-tap correction, the rest clock; saves the set (section 4), asks once whether to keep contributions (`ContributeAsk.jsx`), and for the lateral raise filmed from the front compares left and right range (`src/lib/counting/symmetry.ts`). A "report this count" mail or GitHub link and a challenge share open only on the user's tap (`src/lib/reportLinks.js`). |
| `Report.jsx` + `report-sheet.js`, `report-pdf.js`, `pdf-fonts/` | Coach report: tempo, speed, range per rep, editable name and notes; PDF built with jsPDF, loaded on demand, shared through the share sheet. |
| `Replay.jsx` + `replay-track.js`, `replay-draw.js`, `video-export.js` | Plays the user's video with the tracked joints and the current rep and phase; can record that overlay as a video (MediaRecorder) for the share sheet. |
| `Guide.jsx` | Exercise guide from `src/lib/exerciseGuide.js` and `src/lib/guide-catalog.json` (308 entries); images copied at build time into `public/guide/`. |
| `History.jsx` + `sets.js`, `progress.js` | Saved sets, newest first, with delete and report; per-exercise progress (`ExerciseProgress.jsx`), spreadsheet export (`ExportSets.jsx`, `sets-csv.js`), backup and restore (`KeepSets.jsx`, `src/lib/keep-sets.js`), the waiting contributions (`ContributeHistory.jsx`) and the level (`LevelPick.jsx`). `sets.js` caches the list in memory. |

The measures beyond the count (range, phase times, tempo, speeds) are shown under an experimental label (`measures.js`, `MEASURES_SHOWN`).

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
   poseAnalysis.detectPoseImage()              image landmarks: One-Euro filter + anatomical-plausibility hold;
                                               world landmarks (what the core counts on): not filtered
 │  image landmarks + world landmarks per sample
 ▼
coreAnalysis.summarizeCount → counting/core.countReps     pure, no DOM
 │
 ▼
CountResult { count, reps[], arm, confidence, angles, smoothedAngles, lowThreshold, highThreshold, sides?, refused, test? }
  + exercise, metadata, imageLandmarks, worldLandmarks, timestamps
```

The image landmarks feed the Watch skeleton, the replay, the video export, the refusal reasons (`refusal.js`) and the contributions; only the world landmarks are counted.
The model file is checked against `src/lib/model-hash.json` before use and kept in IndexedDB (`wv-model-cache`).

`src/lib/coreAnalysis.js`
- `APPROVED_LIFTS = OFFERED` (`src/lib/offer.js`): every lift of `TIERS` (`liftTiers.js`), every countable exercise of `guide-patterns.json` and the two fitness tests (`fitness-tests.js`), except `NOT_FILMABLE` (the walking lunge and the sandbag lunge, a walking lunge) and `WITHDRAWN` (dead bug, banded dead bug, bird dog, glute bridge march: counted on both sides and filmed in profile, where the far side is hidden; third audit C21, 3 October). That is 184 keys: 182 exercises (4 Beta, the rest Experimental; the behind-the-neck press, barbell jump squat and wall ball added on 3 October, measured on no set) and 2 tests. The withdrawn four keep their guide entry and names, and the set collectors still list them. `analyzeCoreVideo` rejects any lift for which `isOffered` is false.
- Each worker request carries an id and a 60 s timeout; an `AbortSignal` terminates the worker.
- A read that is not whole (not exactly floor(duration × 15) samples, or samples out of time order) throws `PartialReadError` and shows no count.
- The count is refused when fewer than half the samples have a measurable joint angle; for a both-sides count the less visible side decides, for a `together` count either knee in sight is enough.
- A fitness test is scored over its 30 s window from the first rise, a last rise past halfway counting (`openRise`, `scoreTest`).
- The final result is emitted as a `wv:core-result` window event, which the end-to-end tests read instead of injecting landmarks.

`src/lib/counting/core.ts`, the counting core
- One joint angle per exercise, from 3D world landmarks: elbow, shoulder, knee or hip. `liftDefinition` takes the `LIFTS` entry (18 definitions, among them the two tests) or else the exercise's pattern in `guide-patterns.json` (188 patterns, generated from `guide-families.json` by `scripts/make-guide-patterns.mjs`). A change to `LIFTS`, to the patterns or to the core reaches every offered exercise.
- Side: by default the side whose joint landmarks have the highest mean visibility, never switched mid-set. `bothSides` (the alternating curl and nine guide patterns) counts both sides and joins them. `eitherSide` (push-up, pull-up, front raise) counts each side and keeps the one with more reps among the sides seen in at least half the samples. `together` (forward, reverse, Smith machine reverse and deficit reverse lunges, and `lunge`) joins both knees when their angles correlate above `TOGETHER_MIN_CORRELATION` (0.3), else counts as `eitherSide`.
- Conditioning: outlier removal against a local median, bridging of short dropouts, Savitzky–Golay smoothing. All windows in seconds.
- Detection: thresholds from the set's own 10th and 90th percentiles; a rep is one full cycle from the rest end and back, lasting 0.5 to 8 s. A last rep the video cuts on its way back counts, marked `clipped`, once 70 % back (`CUT_RETURN_SHARE`, re-chosen on public half A only, 3 October). Per exercise, only `push_up` has its own detection settings (`DETECTION`) and only `squat` its own working-end margin (`workMargin`).
- Per rep: start, end, range in degrees, concentric and eccentric time, peak and mean angular speed, `clipped` when the video cuts the rep.
- Sources and status of each parameter are in the file and beside each constant.

`src/lib/poseAnalysis.js` is shared with the dormant pipeline.
The live path uses only `getImageLandmarker` and `detectPoseImage`; it also pulls in `poseGeometry.ts`, `oneEuroFilter.js`, `analysisConfig.js` and `gpuBenchmark.js` as imports.

## 3. Build and delivery

| Step | What it does |
|---|---|
| `prebuild`: `scripts/copy-models.js` | Copies MediaPipe WASM from `node_modules` into `public/mediapipe/` and downloads `pose_landmarker_full.task` there, checked against `src/lib/model-hash.json`, so nothing is fetched from a CDN at runtime. Also run by a Vite plugin at build start. |
| `prebuild`: `scripts/copy-guide.js` | Copies and resizes guide artwork (CC BY-SA 4.0) from `@bryllim/workout-guide` into `public/guide/`. |
| `vite build` | Four pages (`index`, `collect`, `collect-batch`, `check`); target ES2022 and Safari 16; chunks `react-vendor`, `localforage`, `exercises`, `i18n`; injects `__APP_VERSION__`, `__GIT_HASH__`, `__BUILD_TIME__`, `__FEEDBACK_URL__` (empty: the deploy does not pass it, and the feedback panel is not reachable from the app). Base path from `VITE_BASE`. |
| `scripts/inject-sw-precache.js` | Writes the hashed asset list and the model and WASM fingerprints into `dist/sw.js`, so the app works offline after the first visit. |

`public/sw.js`: app shell precache, network-first for navigation, cache-first for hashed assets; the model and the WASM files (MediaPipe's and the decoder's `web-demuxer.wasm`) each in a cache named after their fingerprint; the previous version's files kept one deploy longer.
`public/boot.js`: shows a script error on screen if React never mounts.
`public/cache-bust.js`: reloads with a cache-busting query when cached HTML points to deleted assets.
`src/main.jsx` delays a service worker update until the user is on Choice or the page is hidden, never during an analysis.

`.netlify/netlify.toml` exists but points at a local path on one machine; deployment is GitHub Pages only.

## 4. Data on the device

| Store | Content |
|---|---|
| IndexedDB `workoutVision/workouts` (localforage) | One record per saved set: `exercise`, `reps` (the count the user kept), `machineResult` (what the app counted), `correctedResult` (set only when the user changed it), `corrected`, `repDetails`, `repDetailsVersion`, `sides`, `wave`, `arm`, `confidence`, `date`, `duration`, `source: 'counter-core'`. Schema version 1, migrated in `checkAndMigrateSchema`. A backup file restores into it (`restoreWorkout`). |
| IndexedDB `workoutVision/contributions` (`src/lib/contribute.js`) | Only when the person says yes (`wv_contribute`): per saved set, the lift, the app's count and the count kept (with `corrected` and `labelKind`), the side tracked, the image and world landmarks rounded to five decimals, timestamps, the video's length, frame size, decoder, rotation decision and sample count, the extraction settings, the app version, and `deviceInfo` (user agent, platform, cores, memory, touch points, screen). Kept on the phone until the person shares or erases them; turning it off erases them. The shared file drops `setId` and `savedAt`; the consent text (`contribute-copy.js` `what`) names every other field, and `contribute.test.js` pins the list. |
| IndexedDB `workoutVision/profile` | Default profile, created silently. |
| IndexedDB `medical`, `food`, `milestones`, `personalRecords`, `meta` | Declared in `storage.js`; only `meta` (schema version) is used by the live path. |
| IndexedDB `wv-model-cache` | The pose model, used only if it matches `model-hash.json`. |
| Cache Storage (`public/sw.js`) | `wv-v1`, `wv-model-<sha256>`, `wv-wasm-<hash>`, `wv-meta`. |
| `localStorage` | `wv_lang`, `wv_seen_entry`, `wv_seen_landing`, `wv_level`, `wv_level_asked`, `wv_contribute`, `wv_contribute_asked`. |

After a set is saved, the app asks the browser to keep its storage (`navigator.storage.persist`, `keep-sets.js`).
No network call leaves the device during use, apart from loading the app itself and the pose model from the same origin; reports, challenges, exports, backups and contributions leave only through a link or share sheet the user taps.

## 5. Dormant code

Present in `src/`, unreachable from any of the four HTML pages (`node scripts/unreachable.mjs` lists them).
App.jsx describes these as "hidden, not deleted".
Most are still type-checked and many are still unit-tested, so CI exercises code that users never run.

| Group | Files |
|---|---|
| Previous analysis pipeline | `analyzeVideo.js`, `poseWorker.js`, `usePoseWorker.js`, `landmarkCache.js`, `inputQualityGate.js`, `videoSuitability.js`, `cameraViewpoint.js`, `calibration.js`, `recalibrate.js`, `KalmanLandmarkFilter.js`, `AnthropometricNormalizer.js`, `SignalExtractor3D.{js,ts}`, `temporalFeatures.js`, `analysisDiagnostics.js`, `analysisConfig.ts`, `_node_shim_poseAnalysis.mjs` |
| Previous counters | `repCounter/` (index, valley, periodCounter, scoring, types), `valleyCounter.{js,ts}`, `hysteresisCounter.ts` |
| Counting research, not wired in | `counting/hmm.ts`, `counting/learned.ts` (and `learned-weights.json`) |
| Exercise detection | `exerciseDetector.js`, `hierarchicalDetector.js`, `exerciseOntology.js`, `modelHook.js`, `sampleCapture.js` |
| Exercise catalogue and form checks | `exercises.js`, `exerciseDefinitions.js` (4,357 lines), `exerciseDSL.js`, `formBaselines.js` |
| Metrics frozen by DIRECTIVES.md | `biomechanics.ts`, `VelocityEngine.js`, `injuryRisk.js`, `injuries.js`, `ProgressionScore.js` |
| Coaching and gamification | `coach.js`, `coachingEngine.js`, `coachPDF.js`, `coachStorage.js`, `prSystem.js`, `badges.js`, `challenges.js`, `workoutOfTheWeek.js`, `shareCard.js` |
| Other libraries | `AudioFeedback.js`, `haptics.ts`, `notifications.ts`, `telemetry.ts`, `correctionLog.js`, `dataPortability.js`, `useCountUp.js`, `icons.jsx`, `utils.ts` |
| Previous screens | 34 of the 37 files in `src/components/`, all except `CoreUpload.jsx`, `ErrorBoundary.jsx` and `PerfOverlay.jsx`: `VideoUpload`, `ResultCard`, `Dashboard`, `TabBar`, `Profile`, `Validate`, `LiveCapture`, `CoachReport`, `WeeklyReport`, `FeedbackPanel`, and others. |

`nutrition.js` is reachable (`storage.js` imports its BMR helpers) but nothing on the live path calls them.
Two pairs of files exist in both JavaScript and TypeScript (`SignalExtractor3D`, `valleyCounter`, `analysisConfig`); only `analysisConfig.js` is live.
`counting/guide-families.json` is live: `exercise-info.js` reads each exercise's filming view from it, and `guide-patterns.json`, which `offer.js` and `core.ts` import, is generated from it.

## 6. Tests and evidence

| Command or file | Scope |
|---|---|
| `npm test` (Vitest) | `src/lib/counting/__tests__/` covers the live counting core (synthetic signals, real-phone landmarks, lift definitions and patterns, range, edges, side rules, fitness tests, symmetry). `src/components/experience/__tests__/` covers screen logic (replay, report, sets, export, progress, level). `src/lib/__tests__/` covers `coreAnalysis.js`, `offer.js`, the service worker, the collectors and, for the rest, dormant modules. `npm test` also runs the tests under `test/real-phone/`, `scripts/__tests__/` and `feedback-worker/`; the scoreboards and the research tools among them skip unless their environment variable is set. |
| `npm run scoreboard` | The live count of the 14 labelled real-phone sets (`test/real-phone/landmarks/` and `test/real-phone/sets-29sep/`) against `scoreboard-baseline.json`; output in `test/real-phone/accuracy/scoreboard.txt`, dated on its first line. Its five bench and overhead press sets are shown and decide nothing (PLAN.md). |
| `npm run scoreboard:public` | The 894 Countix build sets (`test/real-phone/public/`) against `public-baseline.json`; output in `public-scoreboard.txt`, dated on its first line. Its 76 bench press sets are shown and decide nothing (PLAN.md). |
| `npm run synth` | The 96 synthetic sets (`test/real-phone/synth/sets/`) against `synth.txt`. |
| `test/real-phone/accuracy/variant-eval.test.ts` + `scripts/compare-variants.mjs` | Set-by-set comparison of two versions of the counter on David's sets, the public build half (in halves A and B) and the synthetic sets; gates nothing. |
| `npm run typecheck` | `tsc --noEmit` on `tsconfig.json` (strict, `allowJs`, `checkJs: false`), so only TypeScript files are actually checked. |
| `npm run lint` | oxlint. |
| `playwright.core.config.js` → `e2e/core-app.spec.js` | The full live pipeline on the real-phone clips, read through `wv:core-result`. Run by hand. |
| `playwright.decode.config.js` → `e2e/decode-clips.spec.js` | Decodes the five real-phone clips to landmarks in `test/real-phone/landmarks/`, and checks determinism. Run by hand. |
| `playwright.config.js` → the other `e2e/*.spec.js` | App-level checks on the production build; `offline.spec.js` also runs in the deploy workflow. |
| `test/real-phone/` | Evidence folders per round and per experiment, the tour (`tour-ci/`) and the synthetic journey (`synth/smoke.mjs`). The videos themselves are not in the repository. |
| `benchmark/` | Countix replay benchmark (`replay-benchmark.mjs`) against the previous counter (`RepCounter`), landmark caches, results from 7 and 8 September. Historical: see the banner of `BENCHMARK.md`. |
| `scripts/src-hash.mjs` | SHA-256 of `src/`, used to tie evidence to a code state. |
| `scripts/collect-clips.mjs` | Local server to send clips and counts from a phone to the development machine. |

## 7. Continuous integration

| Workflow | Trigger | Steps |
|---|---|---|
| `.github/workflows/ci.yml` | Push and pull request on `main` and `counter-core` | Four jobs. Quality: lint, typecheck, unit tests; then the baselines are taken from the base branch (the pull request's base; on a push, the branch's previous tip, `github.event.before`, fetched explicitly, or the previous commit for a new branch), not from the change itself; `npm run scoreboard` (the stored landmarks of the labelled real-phone sets; fails on a lost exact set, a set off by 3 or more or newly refused, or a committed baseline that does not hold the live counts); `npm run scoreboard:public` (the 894 Countix build sets, against the base branch's `public-baseline.json`, same rule); in both, bench press and overhead press sets are shown, marked and kept in the committed baseline, and are left out of the pass/fail tallies, since PLAN.md says they are "measured but decide nothing"; the 96 synthetic sets against the base branch's `synth.txt`, and `synth.txt` must be committed as the run writes it; build. Browser tests: Playwright on the production build. Tour: WebKit with the iPhone profile at three sizes, with Reduce Motion and in the light appearance. Journey: the production app driven end to end by three rendered synthetic videos, with an accessibility audit. |
| `.github/workflows/deploy.yml` | CI succeeding on a push to `main`, or by hand | A gate job skips any commit that is not `main`'s tip (a CI re-run of an older commit, superseded) and, by hand, fails on any commit whose latest CI run did not succeed; checks out the commit CI passed; lint, unit tests, build, Playwright offline test, deploy to GitHub Pages. |

No workflow decodes a real-phone video through the app on a phone: David's iPhone check stays the gate for that (CLAUDE.md R6).

## 8. Outside the app

`feedback-worker/`: a Cloudflare Worker with a D1 database that accepts anonymous structured feedback (`POST /ingest`, 4 KB limit, landmarks and video fields refused) and serves aggregates (`GET /dashboard`).
Its only caller, `FeedbackPanel.jsx` (rendered only by `VideoUpload.jsx`), is dormant, so the live app sends nothing to it.

`design/experience-prototype.html` is the approved visual prototype for the live screens.

## 9. Where the documents and the code disagree

| Document | Says | Code says |
|---|---|---|
| `CLAUDE.md` R2, R6 | Counting changes go through `npm run scoreboard`; CI includes a real-phone gate. | Since 2 October `npm run scoreboard` exists and CI runs it on the stored landmarks of the real-phone clips, with `npm run scoreboard:public` and the synthetic sets; no workflow decodes the real-phone videos through the app. |
| `DIRECTIVES.md` 0.5 | Crash breadcrumbs on the current stage. | `wv_analysis_stage` is written only by `VideoUpload.jsx`, which is dormant. |
| `DIRECTIVES.md` 1.1 | `test/real-phone/manifest.json` with true count, view, labeller, date. | Only `test/real-phone/landmarks/manifest.json`, which records extraction data; true counts sit in test code and in file names. |
| `STATE.md` line 15 | "Offered: 181 exercises (e2e/collect.spec.js)". | 182 exercises and 2 fitness tests since 3 October (`offer.js`; `src/lib/__tests__/offer.test.js` and `e2e/shared/exercises.tests.js` pin 182; the collectors list 186, `e2e/collect.spec.js`). STATE.md is David's to correct. |
