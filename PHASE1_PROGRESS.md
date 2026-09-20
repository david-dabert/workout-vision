# Phase 1 — Implementation Progress

**Date**: 2026-09-20
**Status**: All 5 steps complete + verification & gaps session done

## Benchmark Baseline (honest)

| Metric | Value | Definition |
|--------|-------|------------|
| **Exact match** | **21/41 (51%)** | predicted === ground truth |
| OBO (±1) | 37/41 (90%) | |error| ≤ 1 |
| MAE | 0.76 | mean absolute error |
| Avg accuracy | 89% | mean of per-video `max(0, 1 - |error|/expected)` |
| Excluded | 2 | extraction failures (< 3 frames/rep) |

Exact match has been 21/41 since the project handoff cache. Phase 1 changes are all post-rep-counting and do not affect these numbers.

The previous PHASE1_PROGRESS.md reported "89% accuracy" without defining the metric or stating exact match. This has been corrected.

## Changes

### Step 1: Normalize ProgressionScore to 0-100
- **File**: `src/lib/ProgressionScore.js`
- Internal computation unchanged (form max 250, consistency 200, tempo 150, volume 100, improvement 50)
- All exported values (score + every component) normalized to [0, 100]
- Grade thresholds rescaled to 0-100: F(0-19) D(20-34) C(35-49) B(50-64) B+(65-74) A(75-84) A+(85-92) S(93-100)
- `previousBest.score` correctly converted from 0-100 back to internal scale for improvement comparison
- Pre-normalization history guard: scores > 100 detected as old 0-1000 scale, converted via `/10`
- NaN form scores filtered out (`Number.isFinite` guard)
- **Tests**: `src/lib/__tests__/progressionScale.test.js` — 15 tests covering standard sets, perfect form, single rep, zero consistency, extreme tempos, NaN/null/negative inputs, zero weight, improvement bonus
- **Acceptance**: The strings '173/100' and '120/100' can never be rendered

### Step 2: F-with-passing-highlights bug
- **Root cause (confirmed)**: Coach report `highlights` used `movementQuality` (biomechanics: TUT, ROM, asymmetry) to emit `coach_quality_strong`, while hero grade used `formScore` (per-rep form check average). These are different signals — high ROM + symmetry doesn't mean good form checks.
- **Fix 1** (`src/lib/coach.js`): `coach_quality_strong` highlight now gated on `repFormAvg >= 70` — won't emit positive quality highlight when form checks fail
- **Fix 2** (`src/lib/coach.js`): Coach scoring prefers `repHistory` scores over `movementQuality` when both exist, aligning coach grade with hero grade
- **Potential second cause (unconfirmed)**: Per-rep quality functions (`qualityBelow`, `qualityAbove`, `qualityRange` in exercises.js) may score near zero on real footage while binary checks pass at different rates, creating a disconnect between the displayed issue count ("3/8 reps") and the overall score. Requires real-clip verification to confirm. See Step 2 Verdict below.

### Step 3: Hero grade canonicalization
- **Files**: `src/lib/utils.ts`, `src/lib/coach.js`
- `gradeFromScore`: ≥90 A+, ≥80 A, ≥70 B, ≥60 C, ≥50 D, else F
- `gradeClass`: ≥80 grade-a, ≥70 grade-b, ≥60 grade-c, else grade-d
- Coach `_scoreToGrade`: same thresholds as `gradeFromScore`
- Removed B+ and C+ grades (simpler, less confusing)
- **Tests**: Updated `utils.test.js` and `coach.test.js` to match new thresholds

### Step 4: Input quality gate
- **New file**: `src/lib/inputQualityGate.js`
- Four gates:
  1. Frame continuity (< 50% clean → fail)
  2. Detection confidence (hard gate on low confidence)
  3. Plausibility bounds for 20 exercises (rep range, duration, avg rep tempo)
  4. **Signal amplitude** — per-exercise minimum observed joint angle range (e.g., bicep curl requires ≥40° of elbow range). A curl with <40° of signal amplitude fails the gate.
- Wired into `src/lib/analyzeVideo.js` after detection + rep counting, before form scoring
- `safeForFormChecks` now also requires `qualityGate.pass`
- `insufficientFootage` and `qualityGateReasons` exposed in result object
- **ResultCard renders exclusively** when `insufficientFootage` is true: exercise name + "--" grade + warning + filming guide. No rep table, no coaching, no asymmetry, no score. This is NOT additive — it replaces the entire card body.
- Translation keys added for EN + FR (insufficient_footage + 5 filming tip keys)

### Step 5: Detection misfire mitigation
- **Enriched logCorrection payload**: rep and exercise corrections now include `detectionConfidence`, `insufficientFootage`, `qualityGateReasons`, `formScore`
- **Confidence halving**: When quality gate fails, `detectionConfidence *= 0.5` and `detectionLowConfidence = true` — downstream form scoring and coach highlights respect this
- **Top-3 candidates**: `candidateScores` collected during auto-detection, sorted by score, top 3 exposed as `detectionCandidates` in result

## Verification & Gaps (2026-09-20)

### Item 1: Benchmark honesty
The "89% accuracy" metric was a per-video weighted average (`max(0, 1-|error|/expected)`), not exact match. **Exact match is 21/41 (51%)**. The benchmark script now prints both metrics with the accuracy formula defined inline.

### Item 2: Real-clip verification
**Cannot run.** `analyzeVideo` requires browser environment with MediaPipe WASM, GPU, video file, and canvas APIs. The benchmark replay only tests rep counting (no form scoring, no quality gates). The production-failing clips (IMG_0865 bicep curl, incline press) are not in the landmark cache. No simulation attempted.

### Item 3: Gate catches impossible signals
Added signal amplitude plausibility (Gate 4) to `inputQualityGate.js`. Per-exercise minimum amplitude table derived from `downThreshold`/`upThreshold` in exercise definitions (e.g., bicep curl: 40° minimum, squat: 20° minimum). `observedRange` from `RepCounter.diagnostics` is passed into the gate from `analyzeVideo.js`.

On gate failure, ResultCard now renders an **exclusive** degraded state: exercise name, "--" grade badge, warning banner, and a filming guide with 4 actionable tips. No grade, no score, no rep table, no coaching insights, no asymmetry data.

### Item 4: Small cleanups
- **Header comment**: Grade ranges in `ProgressionScore.js` header now match the actual `GRADES` array
- **Pre-normalization guard**: `previousBest.score > 100` detected as old 0-1000 era value, converted via `/10` before internal comparison. Prevents corruption of improvement bonus from stored history.

### Item 5: Step 2 verdict
**Cannot deliver definitively.** The movementQuality/formScore mismatch (confirmed and fixed) is one real cause. A second potential cause — per-rep quality functions scoring near zero while binary checks pass at different rates — cannot be confirmed or denied without running the incline press clip through `analyzeVideo` and inspecting `repHistory[].feedback[].quality` values.

The scoring functions to investigate if this second cause is real:
- `qualityBelow(angle, threshold, margin=15)` — `exercises.js:42-44`
- `qualityAbove(angle, threshold, margin=15)` — `exercises.js:48-50`
- `qualityRange(angle, low, high, margin=10)` — `exercises.js:61-65`

These should be examined with real per-rep data from the incline press clip.

### UI fixes
- Removed numbered indicators ("1", "2", "3") from onboarding experience chips, replaced with visual icons (circle, concentric circles, star)

## Files changed

| File | Change |
|------|--------|
| `src/lib/ProgressionScore.js` | Normalized to 0-100, fixed header, added pre-norm guard |
| `src/lib/__tests__/progressionScale.test.js` | New: 15 normalization tests |
| `src/lib/utils.ts` | Canonical grade thresholds |
| `src/lib/__tests__/utils.test.js` | Updated for new thresholds |
| `src/lib/coach.js` | Aligned scoring, gated highlights, canonical grades |
| `src/lib/__tests__/coach.test.js` | Updated for new thresholds |
| `src/lib/inputQualityGate.js` | New: 4-gate quality module (frame, confidence, plausibility, amplitude) |
| `src/lib/analyzeVideo.js` | Wired quality gate with observedRange, confidence halving, candidates |
| `src/components/ResultCard.jsx` | Exclusive insufficient footage state, enriched corrections |
| `src/components/ResultCard.module.css` | Insufficient footage + filming guide styles |
| `src/components/FeedbackPanel.jsx` | Enriched exercise correction payload |
| `src/components/Onboarding.jsx` | Replaced number indicators with SVG icons |
| `src/locales/en.json` | insufficient_footage + filming tip keys |
| `src/locales/fr.json` | insufficient_footage + filming tip keys |
| `benchmark/replay-benchmark.mjs` | Honest metric reporting (exact match first, accuracy defined) |

---

## Phase 2 — Verification Harness (2026-09-20)

### Step 1: Full-pipeline landmark dump

**New file**: `benchmark/dump-landmarks.html`

Standalone browser page that extracts per-frame landmarks from any video:
- Loads MediaPipe PoseLandmarker (full, float16) from CDN
- Configurable target FPS (default 15)
- Captures per-frame: 33 landmarks (x, y, z, visibility) + worldLandmarks + timestamp
- Video metadata: duration, native dimensions, canvas dimensions, extraction date
- Downloads JSON artifact ready for Node replay

Artifact format:
```json
{
  "version": 1,
  "video": "filename.mp4",
  "metadata": { "duration", "fps", "nativeWidth", "nativeHeight", ... },
  "frames": [{ "index", "timestamp", "landmarks": [{x,y,z,visibility}...33], "worldLandmarks" }]
}
```

One-time browser cost; artifact is reusable forever.

### Step 2: Full post-landmark pipeline in Node

**New file**: `benchmark/replay-full-pipeline.mjs`

Runs the exact same pipeline as `analyzeVideo.js buildFullResult()` after inference:

1. **Calibration** — `computeCalibration` + `applyCalibration`
2. **Confidence** — per-frame visibility averaging
3. **Exercise auto-detection** — `ExerciseAutoDetector` with candidate scoring
4. **Rep counting** — `RepCounter` with full diagnostics
5. **Quality gate** — `runInputQualityGate` (all 4 gates: frame continuity, detection confidence, plausibility, signal amplitude)
6. **Biomechanics** — `analyzeSet` (ROM, TUT, asymmetry, form checks, compensation patterns)
7. **Coaching engine** — `analyzeCoaching` (SPARC smoothness, DTW consistency, fatigue, depth/valgus/lockout/lean/bar-path detections)
8. **Coach report** — `generateWorkoutReport` (grade, highlights, improvements)
9. **Progression score** — `ProgressionScore.computeSet` (form/consistency/tempo/volume/improvement)

Imports the **same modules** as `analyzeVideo.js` — no reimplementation. Browser API seams handled by the existing poseAnalysis shim + loader hooks (import.meta.env patching, .ts resolution, directory index resolution).

**Accepts both formats**: new landmark artifacts (from dump-landmarks.html) and legacy landmark cache (from browser benchmark via `--cache` flag).

**Output per video**:
- Detection results + candidates
- Quality gate pass/fail + reasons
- Rep count + method + observed range
- Per-rep form scores with per-check quality values
- Biomechanics (ROM, TUT, asymmetry, movement quality, form check results, compensation patterns)
- Coaching engine (SPARC, DTW, fatigue, per-rep depth/lockout/lean/valgus/bar-path)
- Coach report (grade, highlights, improvements)
- Progression score + grade + component breakdown
- Result card summary (one-line)
- Full result saved as JSON to `benchmark/artifacts/`

Usage:
```bash
# New artifact
node benchmark/replay-full-pipeline.mjs benchmark/artifacts/landmarks-video.json

# Legacy cache (all videos)
node benchmark/replay-full-pipeline.mjs --cache

# Legacy cache (filter by name)
node benchmark/replay-full-pipeline.mjs --cache bicep_curl

# Force auto-detection
node benchmark/replay-full-pipeline.mjs --cache push_up --exercise __auto__
```

### Step 3 & 4: Awaiting landmark dumps

The user will provide landmark dumps for the two production-failing clips:
- IMG_0865 bicep curl (9 reps, 39° ROM)
- Incline press (18 reps, grade F with passing highlights)

When provided, run through the harness and report raw numbers — no interpretation without data.

### Infrastructure

- **`benchmark/artifacts/`** — new directory for pipeline result JSONs
- **`.gitignore`** — `benchmark/artifacts/*.json` ignored (large), `.gitkeep` tracked
- **Loader hooks** — both `replay-benchmark.mjs` and `replay-full-pipeline.mjs` now resolve directory imports (`./repCounter` → `./repCounter/index.ts`)

### Verification

- 220/220 tests passing
- Rep-counting benchmark: 21/41 exact (51%), 37/41 OBO (90%), MAE 0.76 — unchanged
- Full pipeline tested on legacy cache: bicep_curl (4 videos), squat, push_up — all produce complete result card data

### Files changed (Phase 2)

| File | Change |
|------|--------|
| `benchmark/dump-landmarks.html` | New: browser-side landmark extraction page |
| `benchmark/replay-full-pipeline.mjs` | New: full post-landmark pipeline replay in Node |
| `benchmark/replay-benchmark.mjs` | Fixed directory import resolution in loader hooks |
| `benchmark/artifacts/.gitkeep` | New: artifacts directory |
| `.gitignore` | Added benchmark/artifacts/*.json |

## Phase 3 — Fix Three Confirmed Enemies (2026-09-20)

Three bugs confirmed from IMG_0865 production footage (bicep curl, 9 reps, 32° avg ROM).

### Enemy 1: Gate 4 uses global range instead of per-rep amplitude

**Root cause**: `observedRange` in RepCounter diagnostics tracks the global min/max of the primary signal across ALL frames. For a real bicep curl (45°→160°), global range = 115° — trivially passes the 40° gate threshold even when overcounted reps have tiny per-rep amplitude (20° from noise).

**Fix**:
- Added `medianRepAmplitude` to `RepCounter.diagnostics` (`src/lib/repCounter/index.ts`): computes median ROM from `_repHistory` entries, which reflects actual per-rep signal amplitude
- Updated `checkAmplitude()` in `inputQualityGate.js` to prefer `medianRepAmplitude` over global `observedRange` when available
- Wired `medianRepAmplitude` through `analyzeVideo.js` into the gate call

### Enemy 2: Stale recalibration

**Root cause**: `recalibrateAnalysis()` re-segments signal and re-runs form evaluation, biomechanics, coach report, and ProgressionScore — but NOT the coaching engine (`analyzeCoaching`). ResultCard's coaching panel reads directly from `result.coaching`, which stays stale from the original (wrong) analysis. After correcting 12→9 reps, coaching shows 12-slot fluidity chart and references "Rep 12".

**Fix**:
- Added `analyzeCoaching()` call to `recalibrate.js` after biomechanics, returning `coaching` in the result
- Updated `ResultCard.jsx`: introduced `const coaching = recalData?.coaching ?? result.coaching` and replaced all `result.coaching` references in the coaching panel with the new `coaching` variable

### Enemy 3: Label collision — "Régularité" displayed twice

**Root cause**: Both DTW rep consistency (coaching engine metric) and ProgressionScore consistency component used `consistency_label` ("Régularité" in French). Same label, two different computations, two different values on the same card (e.g., 53/100 vs 0/100).

**Fix**:
- Added `steadiness_label` key: "Steadiness" (EN) / "Stabilité" (FR) in locale files
- ProgressionScore component bar now uses `steadiness_label` instead of `consistency_label`
- Coaching panel's DTW consistency keeps `consistency_label` ("Consistency" / "Régularité")

### Verification

- 220/220 tests passing
- Rep-counting benchmark: 21/41 exact (51%), 37/41 OBO (90%), MAE 0.76 — unchanged

### Files changed (Phase 3)

| File | Change |
|------|--------|
| `src/lib/repCounter/index.ts` | Added `medianRepAmplitude` to diagnostics getter |
| `src/lib/inputQualityGate.js` | `checkAmplitude` prefers medianRepAmplitude; `runInputQualityGate` accepts it |
| `src/lib/analyzeVideo.js` | Passes `medianRepAmplitude` to quality gate |
| `src/lib/recalibrate.js` | Added `analyzeCoaching()` import + call; returns `coaching` in result |
| `src/components/ResultCard.jsx` | Uses recalibrated coaching; ProgressionScore uses `steadiness_label` |
| `src/locales/en.json` | Added `steadiness_label`: "Steadiness" |
| `src/locales/fr.json` | Added `steadiness_label`: "Stabilité" |

### Periodicity-First Rep Counting (2026-09-20)

**New file**: `src/lib/repCounter/periodCounter.ts`

Implements autocorrelation-based periodicity estimation as a primary counting principle, complementing valley counting. Instead of "count every local minimum," asks "how many cycles of a periodic process fit in this signal?"

**Algorithm**:
1. Compute normalized autocorrelation of demeaned signal
2. Find first strong peak in physiological period band (per-exercise bounds from `analysisConfig.ts`)
3. Estimate reps as `round(signalLength / dominantPeriod)`
4. Phase-align rep boundaries by snapping to nearest local minimum within ±T/3

**Integration** (`src/lib/repCounter/index.ts`):
- Runs after valley counting + hysteresis capping as A/B comparison
- Period count overrides valley only when ALL three conditions are met:
  1. ACF peak >= 0.5 (strongly periodic signal)
  2. Valley count >= 1.5× period count (significant overcounting)
  3. Period count >= hysteresis count (ACF found fundamental, not harmonic)
- The hysteresis guard prevents ACF harmonic confusion (finding 2T/3T instead of T)

**Diagnostics**: `period.periodSeconds`, `period.autocorrPeak`, `period.periodReps`, `period.valleyReps` exposed in RepCounter diagnostics.

**Reference**: "RGB camera-based live repetition counter using autocorrelation" (Nature Scientific Reports, 2025).

**Verification**:
- 220/220 tests passing
- Benchmark: 21/41 exact (51%), 37/41 OBO (90%), MAE 0.76 — unchanged
- Period counter does not activate on clean YouTube benchmark data (correct: valley counting is accurate there)
- Designed to activate on noise-driven overcounting (e.g., 15 false reps on 9 real incline curls where MediaPipe noise creates sub-rep valleys)

### Files changed (Periodicity)

| File | Change |
|------|--------|
| `src/lib/repCounter/periodCounter.ts` | New: `estimateDominantPeriod`, `countByPeriod`, `periodCount` |
| `src/lib/repCounter/index.ts` | Period A/B in finalize(), period diagnostics, build version v26-period-primary |

## Pending

- **ExerciseSelector UI rework** — user called it "put together by a toddler." Not started per instruction. Needs full visual redesign for mobile.
- **Real-clip verification** — user to provide landmark dumps from IMG_0865 bicep curl and incline press via `dump-landmarks.html`, then run through `replay-full-pipeline.mjs` for Steps 3 & 4. This is now critical to validate that the period counter fires on the overcounting case.
- **Recalibrate form evaluation parity** — `recalibrate.js:evaluateFormForCycle` is a simplified version of `scoring.ts:buildFormHistoryFromCycles`, lacking phase-aware sampling, trunk swing detection, viewpoint filtering, anthropometric normalization, and severity weighting. Ideally should call the same function.
- **PoseRAC evaluation** — once signal-level counting is saturated, evaluate PoseRAC (small Transformer on pose landmarks, <5MB, ONNX-exportable) as next accuracy upgrade.
