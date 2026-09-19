# Rep Counting Benchmark

Offline validation of the rep counting engine against 43 videos from the [Countix](https://arxiv.org/abs/2006.15418) dataset (9 exercise types). Ground truth rep counts are human-labeled.

## Current results (v25)

| Metric | Value |
|---|---|
| Exact match | 21/41 (51%) |
| Off-by-one (OBO) | 37/41 (90%) |
| Mean Absolute Error | 0.76 |
| Excluded (extraction failure) | 2/43 |

### Per-exercise breakdown

| Exercise | Exact | OBO | MAE |
|---|---|---|---|
| battle_rope | 3/4 | 4/4 | 0.3 |
| bench_press | 1/4 | 3/4 | 1.0 |
| bicep_curl | 3/4 | 4/4 | 0.3 |
| front_raise | 3/5 | 5/5 | 0.4 |
| lunge | 2/5 | 5/5 | 0.6 |
| pull_up | 2/5 | 5/5 | 0.6 |
| push_up | 5/5 | 5/5 | 0.0 |
| sit_up | 0/4 | 2/4 | 3.3 |
| squat | 2/5 | 4/5 | 0.8 |

## Method

### Counting pipeline

1. **Frame extraction**: Seek-based sampling from uploaded video (~10 fps effective)
2. **Pose estimation**: MediaPipe Pose Landmarker (on-device WASM)
3. **Signal extraction**: Joint angles + 3D landmark coordinates from pose landmarks
4. **Adaptive signal selection**: Tests ~58 candidate signals (primary + alternatives in both orientations), scores by `reps x tempo_consistency`. The most rhythmically consistent signal wins. Camera-angle invariant.
5. **Valley counting**: Local minima with bilateral prominence filtering, minimum spacing, and edge corrections (autocorrelation + template-based)
6. **Hysteresis guard**: FSM-based overcounting cap. When valley counting finds significantly more reps than a hysteresis state machine (which requires full cycle completion), the lower count is used. Prevents false valleys from inflating the count.

### Exercise-specific tuning

- **sit_up**: Reduced smoothing (1 vs default 3) and tighter minimum spacing (0.3s vs 0.5s) to handle fast reps near the Nyquist limit at 10 fps
- All other exercises use default parameters

## Running the benchmark

```bash
node benchmark/replay-benchmark.mjs
```

Requires a landmark cache file (pre-extracted MediaPipe landmarks). The cache is exported by the in-app validation page (`?validate=1`) after a browser benchmark run, then used for offline iteration without GPU.

Results are saved as JSON in `benchmark/results/`.

## Known limitations

### Signal quality ceiling

The pipeline operates at ~10 fps on phone-recorded videos through MediaPipe. This creates fundamental constraints:

- **Temporal resolution**: Fast exercises (>2 reps/sec) approach the Nyquist limit. A 15-rep sit-up in 7 seconds has ~4.7 frames per rep — barely resolvable.
- **Landmark noise**: MediaPipe tracking errors at 10 fps produce frame-to-frame jumps that smoothing can only partially address. Heavier smoothing kills real signal.
- **Signal absence**: Some videos have reps that produce no detectable signal in any tracked body part (wrong camera angle, partial occlusion, low contrast). No algorithm can count what isn't in the data.

### Specific failure modes

| Category | Videos affected | Root cause |
|---|---|---|
| Extraction failure | 2 | Too few frames extracted (video too short or codec issue) |
| sit_up undercount | 3 | Hip angle signal is chaotic at 10 fps; nose/trunk alternatives tested, none consistently better |
| bench_press undercount | 1 | Signal amplitude too weak for 2 of 6 reps in all candidate signals |
| squat undercount | 1 | Same — weak amplitude on a subset of reps |

### What was tested and ruled out

| Approach | Result | Why it failed |
|---|---|---|
| Hysteresis FSM as primary counter | ~11/41 exact | 10 fps signals don't cleanly cross both thresholds — systematic undercounting |
| Narrower hysteresis band (35/65) | ~9/41 exact | Traded undercounting for overcounting |
| Trunk angle as sit_up primary | +5 error on one video | Trunk catches setup/teardown motion as reps |
| Physiological velocity clamp | 16/41 exact | Too aggressive across diverse signal types (joint angles vs landmark coordinates) |
| Global parameter sweeps | Waterbed effect | Fixing one video regresses another |

## Comparison to literature

Published MediaPipe rep counters (e.g., [Pūioio et al., 2023](https://arxiv.org/abs/2308.02420)) report 98-99% accuracy using hysteresis state machines at 30 fps with controlled webcam input. The gap between those results and ours (90% OBO) is primarily explained by:

1. **3x lower frame rate** (10 fps phone video vs 30 fps webcam)
2. **Uncontrolled video conditions** (YouTube clips with varying angles, lighting, occlusion)
3. **Broader exercise coverage** (9 exercise types vs typically 1-3)

The hysteresis approach was implemented and tested (`src/lib/hysteresisCounter.ts`) but does not outperform valley counting at this signal quality. It earns its place as an overcounting guard rather than the primary counter.
