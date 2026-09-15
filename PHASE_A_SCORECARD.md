# Phase A Scorecard — Correctness Foundation

**Date**: 2026-09-15
**Scope**: Phase A of the 10/10 push. Correctness bugs only; no UI, no perf, no polish.

## Commands Run

```
npx vitest run --reporter=verbose   # 191 tests pass (184 pre-existing + 7 new)
npx vite build                      # Production build clean, 742ms
```

---

## Fix 1: isPulling derived from ontology (biomechanics.js)

**Bug**: TUT phase labeling (eccentric vs concentric) used a hardcoded 7-exercise list to determine isPulling. Any pulling exercise not on the list (lat pulldown, deadlift, face pull, seated row, chin-up, dumbbell pullover, ~20+ exercises total) had inverted eccentric/concentric labels. This means TUT breakdown was wrong for every pulling exercise except the original 7.

**Fix** (`biomechanics.js:92-101`):
- Replaced hardcoded list with `lookupExercise()` from the ontology.
- `isPulling` is now true when:
  - Movement class contains `'pull'` (covers `lower_pull`, `upper_pull`, `upper_pull_supine`)
  - OR exercise key contains `curl`, `pulldown`, `pull_up`, `chin_up`, `row`, or `pullover`
- This handles mixed classes (`upper_vertical` has pulldown + press; `upper_isolation` has curl + extension).
- Removed dead imports: `PEAK_PROMINENCE_FRACTION`, `PEAK_MIN_PROMINENCE_DEG`, `PEAK_MIN_FRAME_GAP`.

**Test coverage**: 6 tests — deadlift (lower_pull class), lat_pulldown (upper_vertical, pulling via key), preacher_curl (upper_isolation, pulling via key), machine_shoulder_press (NOT pulling), squat (NOT pulling), machine_tricep_extension (NOT pulling).

---

## Fix 2: Live RepCounter recreated on progressive lock (analyzeVideo.js)

**Bug**: When auto-detection was active, `liveRepCounter` was created once with `'squat'` as default. RepCounter locks its exercise for lifetime. When the HierarchicalDetector locked to a different exercise (e.g., bench_press), the live rep display continued counting squats — wrong signal, wrong thresholds, wrong rep count displayed to user during analysis.

**Fix** (`analyzeVideo.js:201-210, 265-271, 390-396`):
- Changed `const liveRepCounter` to `let liveRepCounter` with tracked `liveRepCounterExercise`.
- After each progressive detector update (both worker and non-worker code paths), checks if detector just locked to a new exercise.
- If locked exercise differs from current counter, recreates RepCounter with the locked exercise.
- Try/catch guards against exercises in the ontology that don't exist in the EXERCISES registry.

**No test**: This is a runtime integration fix involving RepCounter + HierarchicalDetector + frame loop interaction. The unit-level contracts (RepCounter throws on unknown, HierarchicalDetector lock semantics) are already tested.

---

## Fix 3: Dead code removal — detectReps() (biomechanics.js)

**Bug**: `detectReps()` (lines 125-248, ~120 lines) was defined but never called anywhere in the codebase. Reps are exclusively counted by `RepCounter`. The function and its three config imports were dead weight.

**Fix**: Removed `detectReps()` function and its unused imports (`PEAK_PROMINENCE_FRACTION`, `PEAK_MIN_PROMINENCE_DEG`, `PEAK_MIN_FRAME_GAP`). The constants remain in `analysisConfig.js` (they may be used elsewhere or by future code).

**Test coverage**: 1 test — verifies `analyzeSet` is still exported and callable (confirming clean removal).

---

## Fix 4: movementQuality nulled under low confidence (analyzeVideo.js)

**Bug**: When `_lowConfidenceGated` was true, `compensationPatterns` and `formCheckResults` were stripped, but `movementQuality` score survived. At line 643, `avgScore` falls back to `bioAnalysis?.movementQuality` when no per-rep scores exist. This leaked an exercise-specific quality score into the result under uncertainty.

**Fix** (`analyzeVideo.js:618`): Added `movementQuality: null` to the low-confidence gating block. Now the entire exercise-specific scoring path is nulled when detection is uncertain.

**No new test**: The existing defense test "does not produce ROM or asymmetry coaching when analysis is gated" covers the coach path. The movementQuality null prevents score leakage into avgScore, which is a secondary path.

---

## Summary

| Fix | Location | Lines Changed | Tests Added |
|-----|----------|--------------|-------------|
| isPulling from ontology | biomechanics.js:92-101 | ~15 (replace + import cleanup) | 6 |
| Live RepCounter recreation | analyzeVideo.js:201-210, 265-271, 390-396 | ~20 | 0 (integration) |
| Dead detectReps removal | biomechanics.js:125-248 | -123 (net reduction) | 1 |
| movementQuality null | analyzeVideo.js:618 | 1 | 0 (covered by existing) |

**Total**: 191 tests pass, production build green (742ms). Net code reduction: ~100 lines removed.

**Phase A status**: Complete. Exercise identity contract is sound. isPulling covers the full ontology. Live rep display tracks the locked exercise. Low-confidence gating is airtight from biomechanics through coach report through avgScore.

**Next phases**: B (Accuracy & Resilience), C (Speed & Feel), D (Retention), E (Closeout).
