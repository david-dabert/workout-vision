# WorkoutVision Architecture Document

**Purpose of this document:** Explain the complete architecture to external reviewers (Kimi, Gemini, or any senior engineer) so they can audit the design, identify structural problems, and recommend what needs to change for this tool to be accurate and useful.

**What the tool does:** A browser-based PWA that analyzes workout videos using computer vision. The user uploads a video of themselves exercising, the app detects their body pose frame-by-frame, identifies the exercise, counts reps, and produces a biomechanical analysis (velocity, time under tension, range of motion, bilateral asymmetry, fatigue curve) with coaching feedback.

**Live URL:** https://david-dabert.github.io/workout-vision/

**Stack:** React 19 + Vite 5, deployed as a static SPA on GitHub Pages. No backend. All processing happens client-side in the browser.

---

## 1. THE PROCESSING PIPELINE

```
Video file (MP4/MOV/HEVC)
    |
    v
[Frame extraction] ---- VideoUpload.jsx
    | seek-based: video.currentTime = t, wait for 'seeked' event
    | produces: one frame every ~150-250ms (adaptive FPS: 4-8 fps)
    | 3-minute wall-clock hard cap
    |
    v
[Pose detection] ---- poseAnalysis.js
    | MediaPipe Tasks Vision PoseLandmarker (WASM + WebGL GPU delegate)
    | Model: pose_landmarker_full (float16, ~12MB)
    | Produces: 33 landmarks per frame (x, y, z, visibility)
    | Cached in IndexedDB for offline reuse
    |
    v
[Joint angle extraction] ---- poseAnalysis.js:extractJointAngles()
    | Computes angles at 8 joints: left/right knee, hip, elbow, shoulder
    | Plus trunk angle (shoulder-hip-knee)
    | Uses 3-point angle calculation (law of cosines)
    | Returns visibility scores per joint for bilateral selection
    |
    v
[Exercise auto-detection] ---- exerciseDetector.js
    | Runs all ~70 exercises' getValue() on each frame
    | Picks the exercise whose signal has the most oscillation (rep-like pattern)
    | Falls back to user selection if confidence is low
    |
    v
[Rep counting] ---- repCounter.js (RepCounter class)
    | Two-pass architecture:
    |   Pass 1: update() -- live hysteresis counting (best-effort, for real-time UI)
    |   Pass 2: finalize() -- full-signal peak/valley detection (authoritative)
    |
    | finalize() pipeline:
    |   1. Re-extract angles from all collected landmarks
    |   2. Apply moving-average smoothing (~0.3s window)
    |   3. Apply wider smoothing (~0.5s window)
    |   4. Find local extrema (peaks and valleys)
    |   5. Merge consecutive same-type extrema
    |   6. Filter by prominence (minimum 4 degrees)
    |   7. Add synthetic boundary extrema at video edges
    |   8. Full-cycle triplet detection: find a-b-c where a.type === c.type
    |      Each triplet gives three distinct frame indices: start, bottom, end
    |   9. Minimum ROM filter: 20% of observed range, floor at 10 degrees
    |
    | Output: repHistory array, each entry:
    |   { score, issues[], startFrame, bottomFrame, endFrame, ts }
    |
    v
[Biomechanical analysis] ---- biomechanics.js:analyzeSet()
    | Receives: landmark frames, fps, exerciseKey, repHistory
    |
    | Five metrics computed:
    |
    | VELOCITY (per rep)
    |   - Measures wrist or hip displacement during concentric phase
    |   - Concentric = start->bottom for pulling exercises (curls, rows)
    |   - Concentric = bottom->end for pushing exercises (bench, squat)
    |   - Normalized by user height (default 1.7m)
    |   - Units: meters/second
    |
    | TIME UNDER TENSION (per rep)
    |   - phaseA = (bottomFrame - startFrame) / fps
    |   - phaseB = (endFrame - bottomFrame) / fps
    |   - For pulling: concentric = phaseA, eccentric = phaseB
    |   - For pushing: concentric = phaseB, eccentric = phaseA
    |
    | RANGE OF MOTION (per rep)
    |   - top = max(getValue(startFrame), getValue(endFrame))
    |   - bottom = getValue(bottomFrame)
    |   - ROM = |top - bottom| in degrees
    |
    | ASYMMETRY
    |   - Bilateral comparison across all frames (not per-rep)
    |   - Compares left vs right for knee, hip, elbow, shoulder
    |   - Only when both sides have visibility >= 0.5
    |   - Risk thresholds: >15% elevated (Kiesel 2007), >10% moderate
    |
    | FATIGUE
    |   - Velocity dropoff from first N reps to last N reps
    |   - Median-based (resists outliers)
    |   - Warm-up detection (skips slow first rep)
    |   - Reference: >20% = meaningful fatigue (Pareja-Blanco 2017)
    |
    v
[Coaching report] ---- coach.js:generateWorkoutReport()
    | Receives: user profile, exercise results with analysis
    | Produces: grade (A+ to F), summary, highlights[], improvements[]
    | Also: volume load estimate, muscles worked, strength level
    |
    v
[Results display] ---- VideoUpload.jsx (ResultCard JSX)
    | Shows: grade badge, summary, velocity chart, TUT breakdown,
    |        ROM degrees, asymmetry risk, fatigue curve, form notes,
    |        per-rep quality bars, highlights, improvements
    |
    v
[Video replay] ---- VideoReplay.jsx
    | Plays video with pose skeleton overlay
    | Color-coded segments: green (good form), orange (warning), red (bad)
    | Syncs form feedback with video timestamp via binary search
    |
    v
[Share card] ---- shareCard.js
    | Generates 1080x1350 Instagram-format PNG or animated MP4/WebM
    | Canvas rendering with gradient backgrounds
    |
    v
[Storage] ---- storage.js (IndexedDB via localforage)
    | Persists: workouts, user profile, medical records, food log
    | All offline-first, no server communication
```

---

## 2. THE EXERCISE DATABASE

`exercises.js` (2,692 lines) defines ~70 exercises. Each exercise is a JS object:

```javascript
bicep_curl: {
  name: 'Bicep Curl',
  category: 'isolation',
  muscles: { primary: ['Biceps'], secondary: ['Brachialis', 'Forearms'] },
  joint: 'elbow',

  // getValue: extracts the tracking angle from the full angles object
  // For bilateral exercises, picks the side with better visibility
  getValue: (angles, landmarks) => bestSide(angles, 'leftElbow', 'rightElbow', ...),

  // Thresholds for live hysteresis counting (Pass 1 only)
  // For bicep curl: arm starts extended (~145°), curls down to ~80°
  upThreshold: 145,
  downThreshold: 80,

  // Form checks: evaluated at the bottom and top of each rep
  formChecks: [
    {
      name: 'Full contraction',
      check: (angles) => bestSide(angles, ...) < 50,
      good: 'Full squeeze at top',
      bad: 'Curl higher for full contraction',
      severity: 'major',
      phase: 'bottom',
      citation: 'Oliveira LF et al, 2009, J Strength Cond Res'
    },
    {
      name: 'Elbow position',
      check: (angles, landmarks) => /* elbow stays near torso */,
      good: 'Elbows pinned',
      bad: 'Elbows drifting forward -- keep pinned to sides',
      severity: 'major',
      citation: 'Marcolin G et al, 2018, PeerJ'
    },
    // ... more checks
  ]
}
```

**Key design decisions:**
- `getValue()` returns a single scalar (angle in degrees) that oscillates during reps
- `bestSide()` picks left or right based on MediaPipe visibility scores (threshold 0.5)
- Form checks run independently at the detected bottom and top frames of each rep
- Each form check has a severity ('major' = -15 points, 'minor' = -5 points)
- Score per rep = 100 - (major_fails * 15) - (minor_fails * 5)

---

## 3. THE REP COUNTER IN DETAIL

`repCounter.js` (516 lines) is the most architecturally critical file.

### Pass 1: Live counting (update method)

Simple hysteresis state machine: idle -> concentric -> contracted -> idle (= 1 rep).
Direction determined by comparing `downThreshold` vs `upThreshold`:
- If downThreshold > upThreshold: signal decreases during concentric (curls, squats)
- If downThreshold < upThreshold: signal increases during concentric (lateral raises)
Minimum 600ms between reps (debounce).

**This pass is best-effort for real-time UI feedback. It is NOT used for final results.**

### Pass 2: finalize() -- authoritative

1. Re-runs angle extraction on ALL collected landmarks with fresh smoother
2. Applies two layers of smoothing (moving average then wider window)
3. Finds extrema using `_findExtrema()`:
   - Local peaks: value > both neighbors
   - Local valleys: value < both neighbors
   - Merges consecutive same-type (keeps most extreme)
   - Filters by prominence (minimum 4 degrees between adjacent extrema)
4. Adds synthetic boundary extrema at video start/end if the signal value there differs enough from the nearest detected extremum (threshold: 50% of minROM)
5. Full-cycle triplet detection:
   ```
   for each consecutive triplet (a, b, c) in extrema:
     if a.type === c.type AND a.type !== b.type:
       if |a.value - b.value| >= minROM:
         record rep with startFrame=a, bottomFrame=b, endFrame=c
         advance by 2 (c becomes start of next triplet)
   ```
6. Position-based fallback if 0 reps detected (uses wrist-to-shoulder distance instead of joint angles)

### Why full-cycle matters

A half-cycle (peak-valley pair) gives only two frame indices. The old code set `startFrame = bottomFrame = first_extremum_index`, making them identical. This cascaded to:
- ROM = |angle(start) - angle(bottom)| = |angle(X) - angle(X)| = 0
- Concentric TUT = (bottom - start) / fps = 0
- Velocity = displacement over 0 frames = 0
- Fatigue = no valid velocities = "Need more reps"

Full-cycle (peak-valley-peak or valley-peak-valley triplet) gives three distinct indices, so all downstream metrics compute correctly.

---

## 4. THE BIOMECHANICS ENGINE IN DETAIL

`biomechanics.js` (526 lines) receives repHistory from RepCounter and computes five metrics.

### How rep boundaries map to biomechanics

For a bicep curl (pulling exercise, peak-first):
```
Signal:  145° ──╲         ╱── 142° ──╲         ╱── 140°
                 ╲       ╱            ╲       ╱
                  ╲     ╱              ╲     ╱
                   ╲   ╱                ╲   ╱
                    ╲ ╱                  ╲ ╱
                     75°                  78°
          
Frame:    0    5    10    15    20    25    30    35
          ^         ^          ^          ^          ^
          |         |          |          |          |
        start    bottom      end      bottom      end
        (peak)   (valley)   (peak)   (valley)    (peak)
          └── Rep 1 ──┘       └── Rep 2 ──┘
```

- **start** (frame 0, angle 145°): arm extended, beginning of rep
- **bottom** (frame 10, angle 75°): arm fully curled
- **end** (frame 20, angle 142°): arm extended again

For pulling exercises:
- Concentric phase = start -> bottom (curling up, angle decreasing)
- Eccentric phase = bottom -> end (lowering, angle increasing)

For pushing exercises (bench press, squat):
- Eccentric phase = start -> bottom (lowering)
- Concentric phase = bottom -> end (pushing up)

### Velocity calculation

Uses wrist displacement (upper body) or hip displacement (lower body) during concentric phase. Displacement is 3D Euclidean distance in MediaPipe normalized coordinates, scaled by user height (default 1.7m). Result in m/s.

**Known limitation:** MediaPipe coordinates are normalized to image frame, not to real-world scale. The height normalization is approximate. Depth (z-axis) is particularly unreliable from a single camera.

### Internal detectReps fallback

`biomechanics.js` has its own `detectReps()` function that runs when no external rep boundaries are provided. It uses the same full-cycle triplet approach. This is redundant with RepCounter's finalize() but serves as a safety net.

---

## 5. FILE DEPENDENCY GRAPH

```
App.jsx
  ├── poseAnalysis.js (model preload)
  ├── ProfileContext.jsx
  ├── LanguageContext.jsx
  ├── Dashboard.jsx
  ├── Onboarding.jsx
  ├── Train.jsx (lazy)
  │     └── LiveCamera.jsx
  │           ├── poseAnalysis.js (live detection)
  │           ├── repCounter.js (Pass 1 live counting)
  │           └── exercises.js
  ├── Analyze.jsx (lazy)
  │     └── VideoUpload.jsx (1,075 lines -- the main pipeline)
  │           ├── poseAnalysis.js (frame-by-frame detection)
  │           ├── repCounter.js (Pass 1 + Pass 2 finalize)
  │           ├── biomechanics.js (analyzeSet)
  │           ├── coach.js (generateWorkoutReport)
  │           ├── exercises.js (exercise database)
  │           ├── exerciseDetector.js (auto-detection)
  │           ├── shareCard.js (share/download)
  │           ├── storage.js (persist results)
  │           └── VideoReplay.jsx
  │                 └── poseAnalysis.js (drawPose overlay)
  └── ManualLog.jsx (lazy)
        └── exercises.js

Dead code (imported by nothing):
  ExerciseHistory.jsx, MachineIdentifier.jsx, MedicalRecords.jsx,
  Nutrition.jsx, Profile.jsx, Progress.jsx, WorkoutHistory.jsx,
  WorkoutPlan.jsx, RestTimer.jsx
  machineIdentifier.js, planner.js, progression.js
```

---

## 6. KNOWN ISSUES AND CONCERNS FOR REVIEWERS

### 6a. Accuracy of velocity measurement

Velocity is computed from MediaPipe landmark displacement. MediaPipe returns normalized coordinates (0-1 range relative to image dimensions). The code multiplies by user height to approximate real-world distance, but:
- The camera angle, distance, and lens distortion are not accounted for
- The z-coordinate from monocular video is unreliable
- A user further from the camera will show smaller displacements for the same real movement
- No calibration step exists

**Question for reviewers:** Is this velocity metric meaningful enough to show to users, or is it misleading? Should it be presented differently (relative units, percentile, or removed)?

### 6b. Double smoothing in RepCounter

The signal is smoothed twice in `finalize()`:
1. First by `AngleBuffer` (moving average, ~0.3s window) during angle extraction
2. Then by `_smoothSignal()` (wider moving average, ~0.5s window) on the extracted values

At low FPS (4-6 fps), this double smoothing may flatten legitimate peaks/valleys, reducing ROM readings and potentially missing reps.

**Question for reviewers:** Is this over-smoothing? Would a single pass with an appropriate window be more accurate?

### 6c. Frame rate and signal resolution

The analysis runs at 4-8 fps (adaptive based on video length). For a typical bicep curl rep taking ~2 seconds:
- At 4 fps: only 8 frames per rep (4 concentric + 4 eccentric)
- At 8 fps: 16 frames per rep

The peak/valley detection depends on having enough samples to identify local extrema. With very few frames, the true peak or valley may fall between sampled frames, underestimating ROM.

**Question for reviewers:** Is 4-8 fps sufficient for biomechanical analysis? What is the minimum FPS for reliable peak detection in joint angle signals?

### 6d. Form check evaluation timing

Form checks run at exactly two frames per rep: the detected bottom frame and one "top" frame (start or end of the rep). A form violation that occurs mid-rep (e.g., elbow drift during the concentric phase) may be missed entirely because neither the bottom nor top frame captures it.

**Question for reviewers:** Should form checks sample more frames within each rep (e.g., every frame of the concentric phase)?

### 6e. Exercise auto-detection reliability

The auto-detector runs all ~70 exercises' `getValue()` on every frame, then picks the one with the most oscillation. This can misidentify exercises when:
- The user's camera angle doesn't show the primary joint clearly
- Multiple joints oscillate (e.g., a deadlift moves both hip and knee)
- The exercise isn't in the database

There's no confidence threshold below which the detector admits "I don't know."

### 6f. Bilateral selection (bestSide) assumptions

`bestSide()` picks left or right side based on visibility. For unilateral exercises (single-arm curl), this works. For bilateral exercises where both sides should be tracked (barbell squat), it only tracks one side, potentially missing asymmetry within each rep.

### 6g. Dead code volume

9 React components (~3,200 lines) and 3 lib files are imported by nothing. They ship in the bundle but are unreachable. This inflates bundle size and maintenance surface.

### 6h. Redundant rep detection

Both `repCounter.js:finalize()` and `biomechanics.js:detectReps()` implement peak/valley rep detection. When RepCounter provides repHistory, biomechanics uses it directly. When it doesn't, biomechanics falls back to its own detection. The two implementations use different smoothing parameters and prominence thresholds, which could produce different rep counts on the same data.

### 6i. No ground truth validation

There is no test suite that runs known videos through the pipeline and compares output against manually annotated ground truth (known rep count, known ROM, known form errors). Without this, accuracy claims are unverifiable.

---

## 7. WHAT THE TOOL DOES WELL

1. **Offline-first architecture.** Model cached in IndexedDB, all storage local, no server dependency. Works on planes and in gyms with poor connectivity.

2. **iOS Safari compatibility.** Seek-based frame extraction (instead of requestVideoFrameCallback) handles HEVC videos from iPhone cameras.

3. **Scientific citations.** Every form check cites a peer-reviewed source. Fatigue, asymmetry, and velocity thresholds reference specific papers.

4. **Exercise database depth.** ~70 exercises with specific biomechanical checks is substantial for a client-side tool.

5. **Graceful degradation.** GPU delegate with CPU fallback. Position-based rep counting as fallback when angle-based detection fails.

---

## 8. QUESTIONS FOR THE REVIEW COUNCIL

1. **Is the fundamental approach sound?** Can MediaPipe pose landmarks from a single monocular smartphone video produce biomechanically meaningful velocity, ROM, and TUT measurements?

2. **What FPS is needed?** The tool analyzes at 4-8 fps. Is this adequate for the claimed metrics, or does it need 15+ fps?

3. **Should velocity be shown?** Given the coordinate normalization issues, is presenting velocity in m/s responsible, or should it be a relative metric only?

4. **What validation methodology would you recommend?** How should ground truth be established for a tool like this?

5. **What's the minimum viable analysis?** If some metrics are unreliable at this FPS/resolution, which subset of {velocity, TUT, ROM, asymmetry, fatigue, form score} can be trusted?

6. **Architecture simplification.** The codebase has ~10,000 lines of active code across 15 files, plus ~3,200 lines of dead code. What would you cut or consolidate?

7. **What is this tool competing with?** Are there reference implementations (open source or commercial) that solve the same problem and could serve as benchmarks?

---

## 9. HOW TO RUN LOCALLY

```bash
cd workout-vision-edit
npm install --include=dev
npx vite          # dev server at localhost:5173
npx vite build    # production build to dist/
```

Upload any workout video. The app will detect the exercise, count reps, and produce the full analysis. Open browser DevTools console to see debug output from RepCounter (extrema detection, signal range, rep count).
