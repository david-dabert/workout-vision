# Integration guide — hierarchical exercise detector

## New modules

| File | Purpose |
|---|---|
| `src/lib/exerciseOntology.js` | P0/P1/P2 ontology tree, reverse lookup, gym/home filter |
| `src/lib/temporalFeatures.js` | 2-second sliding window feature extractor |
| `src/lib/hierarchicalDetector.js` | Three-level classifier with auto-lock gate |
| `src/lib/sampleCapture.js` | IndexedDB training sample storage + JSONL export |
| `src/lib/modelHook.js` | TF.js model loader (no-op when no model present) |
| `src/components/ExercisePicker.jsx` | Chip-based exercise picker + auto-lock badge |

## Seam (two calls)

```js
import { HierarchicalDetector } from './lib/exerciseDetector';

const detector = new HierarchicalDetector({
  fps: 30,
  mode: profile.gymMode || 'gym',  // 'gym' | 'home'
  onModelPredict: null,            // future: pass TF.js predictor
});

// Per frame:
const state = detector.update({
  landmarks,           // 33-point MediaPipe landmarks
  worldLandmarks,      // optional, unused for now
  timestampMs,         // monotonic timestamp
});

// state.exercise is null when the leaf is ambiguous → show chips
// state.exercise is a string when auto-locked or user-locked
// state.candidates is [{id, score}] sorted desc → feed to ExercisePicker

// When user taps a chip or corrects:
detector.lock(exerciseId);
```

## Live-path wiring (progressive detection)

The progressive detection path in `analyzeVideo.js` now uses
`HierarchicalDetector` instead of `ExerciseAutoDetector`. During streaming
extraction, the detector emits full hierarchical state (context, candidates,
confidence, locked) via `onProgressiveUpdate`. `VideoUpload.jsx` renders
`ExercisePicker` chips when the detector is not locked, and `AutoLockBadge`
when locked. User chip taps call `detector.lock(exerciseId)` via `detectorRef`.

The post-hoc detection path (final exercise resolution after all frames are
extracted) still uses `ExerciseAutoDetector` for stability.

## Backward compatibility

`ExerciseAutoDetector` is unchanged. Post-hoc detection in `analyzeVideo.js`
and all of `Validate.jsx` keep working on `ExerciseAutoDetector`.
The `HierarchicalDetector` is wired into the progressive (live) path only.

## Gym Mode

Profile now has `profile.gymMode` ('gym' or 'home'). In home mode, machine
exercises are excluded from the ontology. Toggle is in Profile settings.

## Training data pipeline

1. User works out → detector shows chips → user taps correct exercise
2. `sampleCapture.saveSample()` stores the temporal features + label in IndexedDB
3. Export via `sampleCapture.exportSamplesBlob()` → JSONL file
4. Train offline (Python/Colab) → convert to TF.js → load via `modelHook.js`
5. Minimum ~40 confirmed sets per exercise before training is meaningful

## What is NOT in this drop

- No trained model (the JSONL export + model hook are the seam; data first)
- XGBoost was dropped; TF.js only (no browser runtime for XGBoost)
- Post-hoc detection not yet migrated (stays on ExerciseAutoDetector)
- Sample count display and export UI not yet surfaced in Profile
