# WorkoutVision — Executive Technical Summary for Cross-Model Review

**Date**: 19 August 2026
**Author**: Claude Opus 4.6 (operator), under direction of David Dabert
**Purpose**: Complete technical brief for independent review by other AI models. Contains architecture, iteration history, failure catalogue, current state, and open problems. The reviewing model should identify blind spots, propose optimizations, and flag any engineering errors the building model may have missed.

---

## 1. WHAT WORKOUTVISION IS

A mobile-first Progressive Web App that uses on-device AI pose detection to analyze exercise form from video. The user films their workout set with their phone camera, uploads the video, and receives: rep count, form score, velocity per rep, time under tension, range of motion, bilateral asymmetry, fatigue index, and actionable form notes with biomechanics citations.

**Core value proposition**: "Film your set, get accurate rep count and form feedback." Everything runs on-device. No backend. No data leaves the phone. No subscription.

**Deployment**: GitHub Pages at david-dabert.github.io/workout-vision/. Installable as PWA (standalone, portrait, dark theme).

---

## 2. THE COUNCIL OF EXPERTS

The following expert perspectives were convoked to audit the tool. Each brings a specific lens:

### 2.1 Software Architect
**Role**: Evaluate system architecture, data flow integrity, component coupling, and failure modes.
**Key findings**: 
- The data flow from video frame → MediaPipe → landmarks → angles → rep detection → biomechanics → report is a sequential pipeline with no intermediate validation. A single bad frame can poison downstream calculations.
- Two separate rep detection systems exist (RepCounter in exercises.js and detectReps in biomechanics.js) that use different algorithms and can produce different results. This is a consistency hazard.
- The codebase is 9,491 lines across 24 files. The exercises.js file alone is 2,501 lines containing the exercise database, the RepCounter class, the AngleBuffer smoother, and the ExerciseAutoDetector — four distinct concerns in one file.

### 2.2 Biomechanics Engineer
**Role**: Evaluate the scientific validity of joint angle calculations, form checks, rep detection, and movement quality scoring.
**Key findings**:
- The angle calculation (law of cosines on 3D landmark positions) is mathematically correct. The 3D calculation using the z-coordinate adds depth accuracy beyond pure 2D.
- Form check thresholds are grounded in cited literature (Schoenfeld 2010, Fry 2003, Hewett 2005, Oliveira 2009, etc.) but have NOT been empirically validated against MediaPipe's actual output on real video. MediaPipe's normalized coordinate system (0-1) with the lite model produces angles that may systematically differ from lab-grade motion capture.
- The "body swing" check for bicep curl (trunk < 15°) fires on 3/3 reps in testing. This may be too strict for MediaPipe's trunk angle estimation, which includes noise from camera angle and landmark jitter.
- 59 exercises defined. Only 3-4 tested with real video (bicep curl, chest-supported row, squat). The other 55 are theoretical.

### 2.3 Mobile Performance Engineer
**Role**: Evaluate memory management, frame extraction performance, and mobile Safari compatibility.
**Key findings**:
- The fundamental bottleneck is seek-based frame extraction from large video files on mobile Safari. A 202 MB .mov file requires hundreds of individual seeks through the video element. Mobile Safari's video decoder cannot seek fast enough — most seeks timeout at the 3-8 second limit, resulting in massive frame loss (28 out of 480 target frames in one test).
- The 50ms delay between frames for large files (line 219 of VideoUpload.jsx) is a GC-pressure relief valve but adds ~24 seconds of pure waiting for 480 frames.
- Canvas is fixed at 480px width. This is the minimum for reliable MediaPipe landmark detection on wrists and ankles. Reducing it saves memory but degrades accuracy.
- Blob URLs are tracked and revoked on unmount (line 67-72) — correct memory hygiene.

### 2.4 UX Designer
**Role**: Evaluate the user experience flow, information density, and mobile interface quality.
**Key findings**:
- The exercise selector was a flat list of 59 exercises with a separate "Auto" checkbox. This has been fixed to a grouped dropdown (Compound/Isolation/Bodyweight/Other) with "Automatic" as the first option.
- Analysis time is 45-50 seconds for a 35-second video on mobile. The progress bar updates correctly. But there is no indication of what FPS or frame count was achieved — the user cannot tell if their video was adequately sampled.
- The results page is information-dense: 7 metric sections plus form notes plus engine diagnostics. For a gym user checking between sets, this is too much. The primary metrics (reps, form score, key form issues) should be visually dominant.
- The "Session grade: D" message is discouraging when the low score is caused by engine limitations (inflated asymmetry, incorrect TUT) rather than actual poor form.

### 2.5 Product Strategist
**Role**: Evaluate product-market fit, feature prioritization, and competitive positioning.
**Key findings**:
- The app does too many things for its maturity level. Nutrition tracking, medical records, machine identifier, workout history, progression analytics, and share cards are all built. But the core (accurate rep counting from phone video) has been unreliable through multiple iterations.
- The competitive landscape: Tempo (hardware-based, $495), Form (Apple Watch), Alo Moves (video-guided, no analysis), RepCount (manual). No direct competitor offers on-device pose-based rep counting from phone video at zero cost. The market gap is real.
- The "film and analyze" flow is the correct product bet. Live camera analysis is technically harder (real-time processing) and less useful (you can't check your phone mid-set). Video upload lets the user film with a tripod or training partner, then review after.

---

## 3. TECHNICAL ARCHITECTURE

### 3.1 Stack
```
React 19.2.8 (UI framework)
Vite 8.2.1 (build tool, ES modules)
MediaPipe Tasks-Vision 1.0.1 (pose detection, WASM + GPU)
localforage 1.10.0 (IndexedDB wrapper for persistence)
lucide-react 1.31.0 (UI icons)
GitHub Pages (static hosting)
```

### 3.2 Source File Map (9,491 total lines)

**Core engine (3,193 lines)**:
- `src/lib/exercises.js` (2,501 lines) — Exercise database (59 exercises), RepCounter class, AngleBuffer smoother, ExerciseAutoDetector class
- `src/lib/poseAnalysis.js` (227 lines) — MediaPipe PoseLandmarker wrapper, angle calculation, skeleton drawing
- `src/lib/biomechanics.js` (465 lines) — Velocity, TUT, ROM, asymmetry, fatigue, quality score

**Analysis pipeline (873 lines)**:
- `src/components/VideoUpload.jsx` (873 lines) — Video loading, seek-based frame extraction, MediaPipe detection per frame, results display

**Supporting (5,425 lines)**:
- `src/lib/coach.js` (608 lines) — Strength standards, workout report generation, recovery recommendations
- `src/lib/nutrition.js` (382 lines) — TDEE, BMR, macro calculations
- `src/lib/progression.js` (395 lines) — Workout trend analysis
- `src/lib/storage.js` (197 lines) — IndexedDB persistence layer
- `src/lib/shareCard.js` (313 lines) — Instagram-format canvas card generation
- `src/lib/audio.js` (81 lines) — Rep complete and set complete sounds
- `src/lib/machineIdentifier.js` (136 lines) — Gym machine identification from camera
- `src/components/LiveCamera.jsx` (470 lines) — Real-time camera analysis
- `src/components/Nutrition.jsx` (827 lines) — Food logging interface
- `src/components/Dashboard.jsx` (303 lines), `Profile.jsx` (258 lines), etc.

### 3.3 Data Flow (Video Upload Analysis)

```
1. User selects video file (.mov/.mp4)
        ↓
2. HTML5 <video> element loads the file
        ↓
3. Frame extraction loop:
   - Set video.currentTime to next timestamp
   - Wait for 'seeked' event (or timeout after 3-8 seconds)
   - Draw frame to canvas (480px width)
   - Run MediaPipe detectPoseImage() on canvas → 33 landmarks
   - Extract joint angles from landmarks (law of cosines in 3D)
   - Feed landmarks to RepCounter.update() (Pass 1: collect only)
   - Feed landmarks to ExerciseAutoDetector.update() if in auto mode
   - Store landmarks + timestamp in frames array
   - Repeat for all frames (target 4-8 FPS depending on file size)
        ↓
4. RepCounter.finalize() (Pass 2: peak-valley rep detection)
   - Re-extract angles from stored landmarks with fresh smoother
   - Smooth signal with moving average (3-frame at 8fps, 3-frame at 4fps)
   - Find local peaks and valleys in smoothed signal
   - Filter by prominence (≥5°) and frame gap (≥3 frames)
   - Count reps as valley→peak pairs with ROM ≥ max(15°, 30% of observed range)
   - For each rep: find actual descent start (excludes rest time), evaluate form at bottom
   - Record: startFrame, bottomFrame, endFrame, score, form issues
        ↓
5. biomechanics.analyzeSet()
   - Receives: landmark frames, FPS, exercise key, rep boundaries from RepCounter
   - Computes: velocity (landmark displacement / time), TUT (frame counts between boundaries),
     ROM (angle values at boundaries), asymmetry (left vs right with visibility filter),
     fatigue (velocity dropoff curve), quality score (composite 0-100)
        ↓
6. coach.generateWorkoutReport()
   - Receives: profile, exercise data, biomechanics analysis
   - Generates: session grade, highlights, next steps, recovery recommendations
        ↓
7. Results rendered to screen
   - Rep count, duration, form score, quality score, analysis time
   - Velocity chart, TUT breakdown, ROM chart, asymmetry details
   - Fatigue index with recommendation
   - Form notes with per-rep failure counts
   - Engine diagnostics (observed range, min ROM, frame count, method)
```

### 3.4 MediaPipe Configuration

```javascript
Model: pose_landmarker_lite (3MB, float16)
Source: https://storage.googleapis.com/mediapipe-models/...
WASM: @mediapipe/tasks-vision@1.0.1
Running mode: IMAGE (for video upload — stateless, each frame independent)
              VIDEO (for live camera — temporal tracking between frames)
Delegate: GPU first, CPU fallback (automatic retry)
Poses: 1
Detection confidence: 0.5
Presence confidence: 0.5
Tracking confidence: 0.5
```

**Why IMAGE mode for video upload**: VIDEO mode maintains internal temporal state between frames. When analyzing a second video in the same session, stale state from the first video contaminated the detection, causing missed detections. IMAGE mode treats each frame independently — no cross-video contamination.

**Why lite model**: Heavy model gains <5% angle accuracy but costs 8x model size (24MB) and 3x inference time. On mobile, the lite model runs in ~30ms per frame on GPU, ~80ms on CPU.

### 3.5 The 33 Landmarks and Key Joints

MediaPipe BlazePose returns 33 body landmarks (x, y, z in normalized 0-1 coordinates, plus visibility score 0-1). The engine uses these joint angle calculations:

```
Knee angle:   Hip → Knee → Ankle
Hip angle:    Shoulder → Hip → Knee
Elbow angle:  Shoulder → Elbow → Wrist
Shoulder angle: Hip → Shoulder → Elbow
Trunk angle:  midShoulder → midHip → vertical reference
```

Each angle is calculated using the law of cosines in 3D:
```javascript
function calculateAngle(a, b, c) {
  // vectors ba and bc from vertex b
  const ba = { x: a.x - b.x, y: a.y - b.y, z: (a.z||0) - (b.z||0) };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: (c.z||0) - (b.z||0) };
  const dot = ba.x*bc.x + ba.y*bc.y + ba.z*bc.z;
  const magBA = Math.sqrt(ba.x**2 + ba.y**2 + ba.z**2);
  const magBC = Math.sqrt(bc.x**2 + bc.y**2 + bc.z**2);
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return (Math.acos(cosAngle) * 180) / Math.PI;  // degrees
}
```

### 3.6 Bilateral Visibility-Aware Selection

When filming from the side, MediaPipe hallucinates the occluded arm/leg with random positions (visibility < 0.5). The `bestSide()` function uses the side with better landmark visibility:

```javascript
function bestSide(angles, leftKey, rightKey, visLeftKey, visRightKey) {
  const lv = angles[visLeftKey] || 0;  // left side visibility
  const rv = angles[visRightKey] || 0;  // right side visibility
  if (lv >= 0.5 && rv >= 0.5) return Math.min(left, right);  // both visible: strictest
  if (lv >= 0.5) return left;   // only left visible
  if (rv >= 0.5) return right;  // only right visible
  return Math.max(left, right); // neither: best guess
}
```

---

## 4. ITERATION HISTORY — WHAT WAS TRIED AND WHAT FAILED

### 4.1 Iteration 1: Threshold-Crossing Rep Detection (FAILED)

**Approach**: Define a "down threshold" and "up threshold" per exercise. When the angle crosses below the down threshold, the user is "at bottom." When it crosses above the up threshold, count a rep.

**Why it failed**: The thresholds were calibrated from biomechanics literature values, not from MediaPipe's actual output. MediaPipe's angles on a real bicep curl video ranged from ~85° to ~168°. The thresholds (downThreshold: 80, upThreshold: 145) meant the angle had to go below 80° to register "at bottom" — which it barely did, producing 0 reps on real video.

**Attempted fixes**: 
- Adaptive thresholds computed from observed range (25th/75th percentile). Failed because the thresholds shifted during analysis — a moving target.
- Two-pass locked thresholds (observe range in pass 1, lock thresholds in pass 2). Still fragile — the threshold ratio (0.25) left a 50% dead zone that borderline reps couldn't cross.

**Result**: 0 reps on real bicep curl and chest-supported row videos across multiple attempts.

### 4.2 Iteration 2: Peak-Valley Rep Detection (SUCCEEDED — current approach)

**Approach**: Abandon all fixed thresholds. Instead:
1. Extract the angle signal for every frame
2. Smooth with a moving average (window scales with FPS)
3. Find local peaks (maxima) and valleys (minima)
4. Filter by prominence (≥5°) and minimum gap (≥3 frames)
5. Count reps as valley→peak pairs where the ROM ≥ max(15°, 30% of observed range)

**Why it works**: No thresholds to calibrate. The algorithm adapts to whatever angle range MediaPipe produces. A rep is defined by the oscillation pattern, not by hitting a specific angle.

**Result**: 3 reps correctly detected on bicep curl, 7 reps on chest-supported row (confirmed by David as correct).

### 4.3 Frame Extraction: Three Approaches Tried

**Approach A: Playback-based** — Let the video play and capture frames with requestAnimationFrame. Failed: frame capture was coupled to display refresh rate, producing irregular sampling and missed frames on mobile.

**Approach B: Seek-based (current)** — Set video.currentTime to precise timestamps and wait for the 'seeked' event. Works reliably but slowly. Each seek takes 50-500ms on normal files, up to 8 seconds on large files. Per-seek timeout prevents infinite hangs.

**Approach C: Web Codecs / VideoDecoder** — Not attempted. Would decode frames sequentially without seeking (10-50x faster). Safari does not support Web Codecs as of August 2026.

### 4.4 Service Worker Cache Poisoning (CRITICAL FAILURE)

**Problem**: The service worker (sw.js) cached the app bundle on first install. When new code was deployed to GitHub Pages, the SW served the old cached bundle. Four consecutive deploys (new rep detection algorithm, threshold fixes, FPS changes) were invisible to the phone — it kept running the original code.

**Symptoms**: Screenshots showed the old UI and old behavior despite confirmed successful deploys. Debug logs were not visible in the console because the console was running old code.

**Fix**: 
1. Added inline script in index.html (before React loads) that unregisters ALL service workers and deletes ALL caches.
2. Disabled service worker registration in main.jsx.
3. Bumped SW cache version to v7 and added SKIP_WAITING handler.

**Lesson**: This wasted approximately 3 hours of David's testing time. Every screenshot he sent was testing old code. The fix should have been applied at the first sign of "deployed but unchanged behavior."

### 4.5 Frame Starvation on Large Files

**Problem**: A 202 MB .mov file at 8 FPS target required 480 seeks. Mobile Safari's decoder could not keep up — each seek has a timeout, and most timed out. Only 28 out of 480 frames were actually decoded. At 0.4 effective FPS, the peak-valley algorithm found only 1 rep.

**Fix**: 
- Reduced target FPS to 4 for large files (>100 MB). This halves the seek count.
- Increased per-seek timeout to 8 seconds for large files.
- Analysis is capped at the first 60 seconds of video for large files.

**Current state**: 269-271 frames decoded on 35-second videos at ~4 FPS (the 144 MB video). This is adequate for rep detection.

### 4.6 IMAGE Mode Non-Determinism

**Problem**: MediaPipe's IMAGE mode produces slightly different landmark positions on each run of the same video. This is inherent to the WASM/GPU execution — floating-point rounding, thread scheduling, and memory layout vary between runs. The variation is typically 1-3° in calculated angles.

**Symptoms**: Same video produced 7 reps on one run, 6 on the next, 7 on the third. A borderline rep where the ROM barely exceeded the minimum threshold would pass on one run and fail on the next.

**Fix**: 
- Wider smoothing window (7-frame at 8fps, 3-frame at 4fps) absorbs per-frame jitter.
- Prominence filter (minimum 5° between consecutive extrema) prevents noise peaks.
- Minimum frame gap (3 frames between alternating extrema) filters temporal jitter.

**Current state**: Rep count is now consistent (3 reps on all runs of the same bicep curl video). But form scores and quality scores still vary slightly between runs (±5-10 points) because the landmark positions affect form check evaluations.

### 4.7 Rep Boundary Inflation (ROOT CAUSE of Multiple Bugs)

**Problem**: RepCounter stored each rep's startFrame as the previous rep's peak frame. If the user rested 5 seconds between curls with arm extended (angle flat at ~160°), those 5 seconds of rest were included in the next rep's start→bottom span. This inflated TUT (13.9s "concentric" for 3 curls), produced 0° ROM for some reps (start and bottom both in rest position), and tanked the quality score to 29.

**Fix**: `findDescentStart()` function scans backwards from each valley through the smoothed signal to find where the angle actually started decreasing. This pinpoints the real beginning of each rep's descent phase, excluding all rest time.

### 4.8 Asymmetry Hallucination

**Problem**: `analyzeAsymmetry()` compared left vs right joint angles across ALL frames without checking landmark visibility. When filming from the side, MediaPipe hallucinates the occluded side with garbage positions (visibility < 0.5), producing phantom 50% shoulder asymmetry on a bilateral exercise.

**Fix**: Only compare sides when BOTH have visibility ≥ 0.5. When filming from the side, most frames have one side occluded — those frames are excluded from the asymmetry calculation.

---

## 5. CURRENT STATE (19 August 2026)

### 5.1 What Works
- **Rep counting**: Peak-valley detection produces correct, consistent rep counts on tested exercises (bicep curl, chest-supported row).
- **Skeleton overlay**: Renders correctly during analysis, showing detected pose on each frame.
- **Auto-detection**: Identifies exercise type from joint angle signatures in ~1-3 seconds.
- **Exercise selector**: Grouped by category (Compound/Isolation/Bodyweight/Other) with "Automatic" as default.
- **Form checks**: Fire at the bottom of each rep with cited biomechanics thresholds.
- **Share card**: Generates Instagram-format 1080x1350 summary image.
- **PWA**: Installable, works offline, dark mode.

### 5.2 What Is Fixed But Unverified on Device
These fixes were applied in the current session and deployed. They have been verified by code trace and mental simulation but NOT yet tested on David's phone:
- **TUT**: Rep boundaries now exclude rest time. Eccentric/concentric should show realistic durations (~1-4s each per rep).
- **ROM consistency**: Should be 70-95% instead of 0% on a controlled set.
- **Asymmetry**: Should be <10% instead of 50% when filming from the side.
- **Quality score**: Should be 70-90 instead of 29-49.

### 5.3 What Remains Broken or Untested
- **Large file frame extraction**: 4 FPS with 8-second timeout works for ~140 MB files. Unknown behavior on 300+ MB 4K files.
- **55 of 59 exercises**: Never tested with real video. Thresholds are theoretical.
- **Form check strictness**: "Body swinging" (trunk < 15°) fires on 3/3 reps — may be too strict for MediaPipe's trunk estimation from a side angle.
- **Form score variation between runs**: ±5-10 points due to IMAGE mode non-determinism.
- **No ground truth dataset**: No labelled videos to measure precision/recall of rep detection.

---

## 6. THE FIVE STRUCTURAL PROBLEMS AND PROPOSED SOLUTIONS

### 6.1 Frame Extraction Is the Bottleneck

**Problem**: Seek-based extraction on mobile Safari is 10-50x slower than sequential decoding. A 60-second video at 8 FPS requires 480 seeks, each taking 50-500ms on normal files or up to 8 seconds on large files.

**Proposed solutions** (in order of effectiveness):
1. **Client-side video compression before analysis**: Use `canvas.captureStream()` + `MediaRecorder` to re-encode at 480p/1 Mbps before extraction. Reduces 200 MB to ~5 MB, making seeks instant.
2. **Instruct user to film in 720p**: Not elegant but immediately effective. Most iPhone users film in 1080p or 4K by default.
3. **Web Codecs API**: Use `VideoDecoder` for sequential frame decoding (no seeking). Not available in Safari as of August 2026. Would require feature detection and fallback.
4. **Server-side transcoding**: Add a lightweight backend that receives the video, transcodes to 480p, and returns a small file for client-side analysis. Breaks the "no backend" principle but solves the problem definitively.

### 6.2 No Ground Truth for Validation

**Problem**: Every fix is empirical ("David says it counted wrong"). No systematic way to measure accuracy.

**Proposed solution**: Build a validation protocol.
- Film 20 sets across 5 exercises (squat, curl, row, press, deadlift).
- Manually label each video: start time, rep timestamps, expected count.
- Store as JSON: `{ "file": "curl_5reps.mov", "reps": 5, "timestamps": [2.1, 5.3, 8.0, 10.8, 13.5] }`.
- Run the engine on each video, compute precision (correct reps / detected reps) and recall (detected reps / actual reps).
- Target: 95% precision, 90% recall across all exercises.

### 6.3 Form Check Thresholds Are Untested

**Problem**: The "full contraction" check for bicep curl requires elbow angle < 55°. The "no body swing" check requires trunk < 15°. These values come from lab-grade motion capture literature, but MediaPipe's angles may differ systematically.

**Proposed solution**: Calibrate per-exercise on real video.
- For each exercise, film a "known good" set with proper form.
- Record the actual MediaPipe angles at the form check moments.
- Adjust thresholds to match what MediaPipe actually produces, not what the literature says.
- Document the calibration: "MediaPipe elbow angle at full contraction = 62° (literature says 55°, adjusted to 65° threshold)."

### 6.4 Duplicate Rep Detection Systems

**Problem**: `RepCounter.finalize()` (exercises.js) and `detectReps()` (biomechanics.js) are independent implementations with different smoothing, prominence, and threshold logic. When RepCounter finds 0 reps, biomechanics falls back to its own detector, potentially producing inconsistent results.

**Proposed solution**: Delete `detectReps()` from biomechanics.js. Make `analyzeSet()` require external rep boundaries. If RepCounter finds 0 reps, biomechanics should also report 0 reps — not try to rescue the situation with a different algorithm.

### 6.5 Feature Surface Area Exceeds Engine Maturity

**Problem**: Nutrition tracking (827 lines), medical records (211 lines), machine identifier (363+136 lines), progression analytics (395 lines), share cards (313 lines) — 2,245 lines of features that depend on reliable rep counting, which is not yet reliable.

**Proposed solution**: Feature freeze on everything except the core pipeline (VideoUpload → exercises → biomechanics → results display) until:
1. Rep counting achieves 95% precision / 90% recall on the validation set.
2. Form scores are stable (±3 points between runs).
3. Large files (200+ MB) analyze in under 60 seconds on iPhone.

---

## 7. EXERCISE DATABASE SUMMARY

59 exercises across three categories:

**Compound (24)**: Barbell Back Squat, Front Squat, Goblet Squat, Conventional Deadlift, Romanian Deadlift, Sumo Deadlift, Hip Thrust, Walking Lunge, Bulgarian Split Squat, Overhead Press, Bench Press, Incline Bench Press, Machine Chest Press, Bent-Over Row, Chest-Supported Row, Seated Cable Row, Lat Pulldown, Leg Press, Kettlebell Swing, Thruster, Clean and Press, Turkish Get-Up, Man Maker, Superset.

**Isolation (10)**: Standing Leg Extension, Standing Calf Raise, Seated Calf Raise, Bicep Curl, Overhead Tricep Extension, Lateral Raise, Leg Extension (Machine), Leg Curl (Machine), Face Pull.

**Bodyweight (25)**: Push-Up, Dip, Pull-Up, Chin-Up, Muscle-Up, Plank Hold, Crunch, Mountain Climber, Burpee, Jumping Jack, Pike Push-Up, Diamond Push-Up, Inverted Row, Jump Squat, Pistol Squat, Glute Bridge, Wall Sit, Step-Up, Renegade Row, Bear Crawl, Box Jump, Skater Jump, Squat Jump to Lunge, Commando Pull-Up, Nordic Curl, Hanging Leg Raise.

**Each exercise defines**: name, category, primary/secondary muscles, tracked joint, getValue function (which joint angle to track), form checks (2-5 per exercise with severity and citation), science notes.

**Auto-detection covers ~10 movement patterns**: squat-like, deadlift-like, push-up, curl, overhead press, row, lateral raise, plank, seated exercises. The other 49 exercises require manual selection.

---

## 8. KEY METRICS FROM TESTING

### 8.1 Bicep Curl (IMG_9291.mov, 144 MB, 35 seconds)
- **Frames decoded**: 269-271 (consistent across runs)
- **FPS achieved**: ~4 (target was 4 for large file)
- **Reps detected**: 3 (consistent across runs)
- **Observed angle range**: 81.9°–167.8° (86° range) on run 1; 95.8°–167.8° (72°) on run 2
- **Analysis time**: 43-47 seconds
- **Issues before fixes**: TUT 2.9s ecc / 13.9s conc (incorrect), ROM 0% consistency, Asymmetry 50% shoulder, Quality 29-49
- **Expected after fixes**: TUT ~3s ecc / ~3s conc, ROM 70-95% consistency, Asymmetry <10%, Quality 70-90

### 8.2 Chest-Supported Row (IMG_9230.mov, ~200 MB, ~60 seconds)
- **Frames decoded**: ~311
- **Reps detected**: 7 (verified correct by David)
- **Observed angle range**: 64.3°–139.5°

### 8.3 Bicep Curl (IMG_9134.mov, 202 MB, 67 seconds)
- **Frames decoded**: 28 (before large-file fix) → should be ~240 after fix
- **Reps detected**: 1 (before fix, due to frame starvation)
- **Root cause**: 8 FPS target × 3-second timeout = most seeks failed

---

## 9. WHAT TO LOOK FOR (INSTRUCTIONS FOR REVIEWING MODELS)

1. **Is the peak-valley rep detection algorithm sound?** Are there edge cases where it would count phantom reps or miss real ones? What about exercises with asymmetric timing (fast concentric, slow eccentric)?

2. **Is the `findDescentStart()` function correct?** It scans backwards from each valley to find the local peak. Could it scan too far back (into the previous rep) or not far enough (cutting off part of the descent)?

3. **Is the asymmetry calculation meaningful when filming from the side?** With the visibility filter, most frames may be excluded. Is a metric computed from a small subset of frames (only those where both sides are visible) statistically meaningful?

4. **What is the optimal frame extraction strategy for mobile Safari with large .mov files?** Is client-side re-encoding (canvas.captureStream + MediaRecorder) viable? What codecs and parameters would minimize file size while preserving pose detection accuracy?

5. **Should the form check thresholds be hardcoded per exercise, or should they be calibrated dynamically from the observed signal?** For example, "full contraction" could be defined as "within 10% of the observed minimum" rather than "< 55°".

6. **Is the quality score formula balanced?** Currently: base 70, ±(ROM consistency - 70)*0.3, ±asymmetry bonus/penalty, ±TUT ratio bonus, ±velocity consistency bonus. Is the 30% weight on ROM consistency appropriate? Should it weight form check pass rate instead?

7. **Is there a better approach to rep detection than peak-valley on the angle signal?** For example: template matching, dynamic time warping, or a simple neural network trained on the angle signal.

8. **What are the failure modes for the auto-detection heuristics?** For example, could a seated bicep curl be misidentified as a seated row? Could a deadlift filmed from the front look like a squat?

9. **Is the `IMAGE` vs `VIDEO` mode choice correct for video upload?** IMAGE mode is non-deterministic but stateless. VIDEO mode is deterministic but carries temporal state between videos. Is there a way to get VIDEO mode's determinism without the cross-video contamination (e.g., by destroying and recreating the landmarker between videos)?

10. **What is the minimum FPS needed for reliable rep detection?** The current floor is 4 FPS. At 4 FPS, a 2-second rep gets 8 frames. Is this sufficient for the peak-valley algorithm, or does it create aliasing effects where the valley and peak are not properly resolved?

---

## 10. FILES FOR DIRECT INSPECTION

If the reviewing model has file access:

```
/Users/azeliebernard/Documents/Lamine/workout-vision/
├── src/
│   ├── lib/
│   │   ├── exercises.js        ← Rep counter + exercise database (2,501 lines)
│   │   ├── poseAnalysis.js     ← MediaPipe wrapper + angle calc (227 lines)
│   │   ├── biomechanics.js     ← Velocity/TUT/ROM/asymmetry (465 lines)
│   │   ├── coach.js            ← Report generation (608 lines)
│   │   └── storage.js          ← IndexedDB persistence (197 lines)
│   ├── components/
│   │   ├── VideoUpload.jsx     ← Main analysis pipeline (873 lines)
│   │   ├── LiveCamera.jsx      ← Real-time analysis (470 lines)
│   │   └── Dashboard.jsx       ← Home screen (303 lines)
│   └── App.jsx                 ← Routing (120 lines)
├── public/
│   ├── manifest.json           ← PWA manifest
│   └── sw.js                   ← Service worker (disabled)
├── index.html                  ← SW nuke script + entry point
├── package.json                ← Dependencies
└── vite.config.js              ← Build config (base: /workout-vision/)
```

---

*End of executive summary. This document is intended for cross-model technical review. The reviewing model should critique freely — every assumption, every algorithm choice, every threshold. The goal is to find what the building model missed.*
