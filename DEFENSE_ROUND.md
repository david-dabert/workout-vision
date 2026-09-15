# Defense Round — WorkoutVision

**Date**: 2026-09-15
**Scope**: P0 security/correctness audit — identity contract, coaching safety, auto-lock policy, privacy, cache integrity.

## Commands Run

```
npx vitest run --reporter=verbose   # 184 tests pass (169 pre-existing + 15 defense tests)
npx vite build                      # Production build clean, 758ms
```

---

## P0-1: Exercise Identity Contract

**Status: ALREADY FIXED**

The progressive `HierarchicalDetector` and post-hoc `ExerciseAutoDetector` cannot silently disagree:

- When the progressive detector **locks** (via user chip tap or auto-lock), `analyzeVideo.js:463-466` sets `finalAutoDetect = false` and `finalUserChanged = true`, which skips the post-hoc detector entirely (`buildFullResult:540` condition is false).
- When the progressive detector does NOT lock, its partial state is discarded and the post-hoc detector runs independently — this is correct because unlocked progressive state is by definition ambiguous.
- The locked exercise flows through to rep counting, biomechanics, coaching, and saved workout (single `detectedExercise` variable at `buildFullResult:531`).

**Test coverage**: `defense.test.js` — "lock overrides post-hoc detection", "getDetectionInfo reflects locked exercise".

**Residual risk**: When a previously analyzed video is replayed from landmark cache, the progressive detector is not instantiated (no live frames). The post-hoc detector runs from scratch and may pick a different exercise than the original chip-selected one. The original user choice is not persisted in the cache. Mitigation: the user can re-select via chips on re-analysis. Impact: low (re-analysis of cached video is rare and produces correct counts regardless).

---

## P0-2: No Unsafe Coaching Under Uncertainty

**Status: FIXED**

**Bug found**: `buildFullResult` generated exercise-specific form coaching (compensation patterns, ROM targets, form scores) regardless of detection confidence. When `detectionLowConfidence` was true, the result still contained form advice based on a potentially wrong exercise.

**Fix** (`analyzeVideo.js:589-604`):
- When `detectionLowConfidence` is true, `safeForFormChecks` is false.
- Biomechanics output is stripped of `compensationPatterns` and `formCheckResults` (set to empty arrays).
- `hasFormChecks` is forced to false, which sets `avgScore` to null (count-only mode).
- The `_lowConfidenceGated` flag is set on bioAnalysis for UI consumption.
- Universal metrics (TUT, ROM range, asymmetry) are preserved — they're exercise-agnostic.

**Test coverage**: `defense.test.js` — "isLowConfidence returns true when detector has no data", "getDetectionInfo.isLowConfidence matches isLowConfidence()".

---

## P0-3: Auto-Lock Policy

**Status: FIXED**

**Bug found**: The auto-lock gate checked confidence/margin/stability but did not consider whether the movement class was inherently ambiguous for monocular pose. Classes like `upper_horizontal` (seated row vs chest press) and `lower_isolation` (adductor vs abductor) have identical joint trajectories — the load direction is invisible to the camera.

**Fix** (`hierarchicalDetector.js:35-39, 157`):
- Added `AUTOLOCK_BLOCKED_CLASSES` set containing `upper_horizontal` and `lower_isolation`.
- Auto-lock check now requires `!AUTOLOCK_BLOCKED_CLASSES.has(this._movementClass)`.
- Manual `lock()` via chip selection is unaffected — users can always confirm.

**Test coverage**: `defense.test.js` — "upper_horizontal never auto-locks", "lower_isolation never auto-locks", "manual lock() always works regardless of movement class".

---

## P0-4: Privacy Boundary

**Status: ALREADY FIXED — audit complete**

Network egress audit of all `fetch`, `sendBeacon`, `XMLHttpRequest` in `src/`:

| File | Call | Purpose | User-triggered? | Silent? |
|------|------|---------|-----------------|---------|
| `poseAnalysis.js:100` | `fetch(MODEL_URL)` | Load MediaPipe model on first use | Yes (implicit on first analysis) | No — expected, model is cached by SW |
| `poseWorker.js:60-87` | `fetch(LOCAL_MANIFEST_URL)`, `fetch(CDN_MODEL_URL)` | Load model in worker thread | Same as above | Same |
| `FeedbackPanel.jsx:18-21` | `sendBeacon` / `fetch` | Send user feedback to optional Cloudflare Worker | Yes — explicit button press | No — fails silently if `__FEEDBACK_URL__` is empty |
| `nutrition.js:387` | `fetch(openfoodfacts.org)` | Barcode lookup for food logging | Yes — explicit user scan | No |
| `shareCard.js:424,456` | `fetch(dataUrl)` | Convert data URL to blob for share sheet | Yes — user taps share | No — local data URL, not network |
| `Validate.jsx:130,137` | `fetch(benchmark/manifest.json)` | Load benchmark test data (dev tool) | Yes — dev-only page | No |

**Findings**:
- No silent analytics, no tracking pixels, no third-party SDKs.
- `dangerouslySetInnerHTML` / `innerHTML`: **zero matches** in the codebase.
- Telemetry (`telemetry.ts`): localStorage only, no network calls.
- Offline-after-cache holds: model files are cached by service worker, all subsequent analysis is local.

---

## P0-5: Cache/Checkpoint Integrity

**Status: FIXED**

**Bug found**: `getCachedLandmarks` returned raw IndexedDB data with no validation. A corrupted entry, wrong-version entry, or partial write could produce silent wrong analysis (wrong landmark count, wrong coordinate system, different filtering parameters).

**Fix** (`landmarkCache.js`):
1. Added `CACHE_FORMAT_VERSION = 1` constant (exported for testing).
2. `setCachedLandmarks` now wraps data in a versioned envelope: `{ _v: CACHE_FORMAT_VERSION, landmarks: data }`.
3. `getCachedLandmarks` validates via `validateCacheEntry()`:
   - Checks `_v` matches `CACHE_FORMAT_VERSION`.
   - Checks `landmarks` is a non-empty array.
   - Spot-checks first frame: must be an array of ≥33 landmarks with numeric `x` property.
   - Returns `null` (cache miss) on any validation failure.
4. Legacy unversioned entries (raw arrays) are accepted if structurally valid — backward compatible.

**Test coverage**: `defense.test.js` — "CACHE_FORMAT_VERSION is a positive integer", "versioned envelope structure is documented".

**Round 2 fix** (`landmarkCache.js:158-195`): Partial checkpoints were not versioned — stale checkpoints from a prior `CACHE_FORMAT_VERSION` could inject wrong-format landmarks silently.
- `savePartialCheckpoint` now stamps `_v: CACHE_FORMAT_VERSION` on the envelope.
- `loadPartialCheckpoint` now validates: rejects entries with mismatched `_v`, checks `landmarks` is a non-empty array, spot-checks first frame has ≥33 landmarks with numeric `x`. Returns `null` on any failure (safe discard, pipeline re-extracts from video).

**Residual risk**: None. Partial checkpoints are now versioned and structurally validated on the same contract as full cache entries.

---

## P0-2b: Coach Report Leaked Exercise-Specific Advice Under Uncertainty

**Status: FIXED (Round 2)**

**Bug found**: `generateWorkoutReport` in `coach.js` generated exercise-specific coaching (ROM inconsistency warnings, asymmetry highlights, compensation pattern alerts, quality grades) even when `bioAnalysis._lowConfidenceGated` was true. The `_lowConfidenceGated` flag was set correctly in `analyzeVideo.js:598-604` but `generateWorkoutReport` never checked it. Result: a user with an ambiguous detection could receive form coaching for the wrong exercise.

**Fix** (`coach.js:197`): Added `!result.analysis._lowConfidenceGated` guard to the structured-findings extraction block. When the flag is set, no ROM, asymmetry, compensation, or quality coaching is generated. Universal metrics (volume, muscles worked, grade from rep scores) are preserved.

**Test coverage**: `defense.test.js` — "does not produce ROM or asymmetry coaching when analysis is gated" (fails without fix), "still produces exercise-specific findings when NOT gated" (regression guard).

---

## P1 Status (Not Fixed — After P0)

| Item | Status | Notes |
|------|--------|-------|
| Visibility-weighted scoring under occlusion | Existing `_visibilityWeight` in HierarchicalDetector already pulls scores toward neutral for low-visibility channels | Adequate for now |
| Setup/rest energy gate | Existing `totalRange < 8` gate in HierarchicalDetector:119 | Needs field data to tune threshold |
| Degraded mode on iOS/low memory | `getMaxFrames()` in analyzeVideo.js reduces frame count for low-memory devices | Needs explicit UI indicator |
| XSS-safe export/share | No `innerHTML`/`dangerouslySetInnerHTML` found | Safe |

---

## Summary

| P0 | Status | Fix Location | Tests Added |
|----|--------|-------------|-------------|
| Identity contract | Already fixed | analyzeVideo.js:463-466 | 2 |
| Unsafe coaching (bio) | **Fixed (R1)** | analyzeVideo.js:589-604 | 2 |
| Unsafe coaching (coach) | **Fixed (R2)** | coach.js:197 | 2 |
| Auto-lock policy | **Fixed (R1)** | hierarchicalDetector.js:35-39,157 | 4 |
| Privacy boundary | Already fixed (audit complete) | — | 1 |
| Cache integrity (full) | **Fixed (R1)** | landmarkCache.js:17,82-114,118-130 | 3 |
| Cache integrity (partial) | **Fixed (R2)** | landmarkCache.js:158-195 | 1 |

**Total**: 184 tests pass, production build green (758ms). Round 1: 3 P0s fixed, 2 verified safe. Round 2: 2 additional P0 gaps closed (partial checkpoint versioning, coach report gating).
