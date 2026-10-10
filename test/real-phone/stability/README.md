# noise.mjs: a re-encoding noise proxy for stored landmarks

`perturbSet(set, opts)` returns a copy of a set's world landmarks as another encoding of the same video might be read
by the app (MediaPipe pose, IMAGE mode). No video is needed. It was fitted on David's 14 gym videos, comparing the
committed reads with the ctl, image9 and image reads (stability report of 10 October, steps 1 to 3; its numbers come from validate-*.txt and robust-*.txt here). Status: experimental.

```js
import { perturbSet } from './noise.mjs';           // needs noise-table.json in the same folder
const p = perturbSet({ worldLandmarks, timestamps }, { seed: 3 });   // defaults: intensity 0.5
summarizeCount(p.worldLandmarks, p.timestamps, lift);
// p.dropped / p.gained: poses lost / found; p.imageLandmarks: the source's, null where a pose was lost or found
```

It changes world landmarks (x, y, z, visibility) and which samples have a pose. Timestamps and image landmarks are
left as they are. The same `seed` gives the same output. It costs about 60 ms for a 370-sample set in Node.

## What it does, per sample

1. **Local jitter.** For every joint and channel (x, y, z in mm, visibility in logit units), it measures how unsteady
   the set itself is around that sample: the RMS of second differences over ±`W` samples, divided by √1.5.
2. **Position noise** (mode `empirical`). The size of the change is drawn from the measured distribution of
   |difference between two reads|, given that local jitter (`noise-table.json`: `posAligned`, 9 bins from 1.4 to
   325 mm, 29 quantile levels). The draw is a Gaussian, AR(1) in time (`phi`) and chained along the skeleton (a joint
   takes `rho` of its parent's draw), so limbs keep their measured joint-to-joint correlation. The Gaussian gives the
   sign and the quantile level.
3. **Visibility.** Each value is pulled toward its 5-sample running median by `pullVis`, then gets its own measured
   draw (`noise-table.json`: `vis`), plus one level shift per set and side (sd `visShift`).
4. **Poses found.** A sample with no pose gets one with the probability in `GAIN_TABLE`, which depends on the length
   of its missing run. The pose is placed on the straight line between the nearest poses, plus `gainK` × the
   neighbours' jitter × a heavy-tailed draw. Its visibility is the interpolated value plus `gainVisSd` × a draw.
5. **Poses lost.** A pose is dropped with the probability in `DROP_TABLE`, which depends on the distance to the
   nearest missing sample and on the skeleton's own jitter. A drop continues to the next sample with probability
   `dropExt`.

## Parameters (`DEFAULTS`)

| name | default | meaning | source |
|---|---|---|---|
| `mode` | `'empirical'` | `'empirical'` draws positions and visibility from the measured quantile tables. `'parametric'` uses `k` × jitter × Student t (`nu`) instead. | table.mjs, calib.txt |
| `intensity` | `0.5` | Scales the position and visibility noise, `visShift`, `drop` and `gain` together. **1** reproduces the measured landmark statistics (valsig-final-i1.txt). **0.5** reproduces the spread of counts between real reads (validate-i0.5-K10.txt and validate-i0.5-K30.txt). | step 3 |
| `rhoLoose` | `0.3` | Tightens the chain: ρ' = 1 − (1 − ρ) × 0.3. At 0.3, the joint-angle differences match the real ones (robust sd and p90). At 1 (the measured ρ), joint-angle differences are 1.2 to 1.6 times too large in robust sd and 1.3 to 2 times in p90 (valsig-final-i1-rho1.txt). | xcorr.txt, valsig |
| `rho` | MEASURED_RHO | ρ per link of the chain: torso 0.4, head 0.9, face 0.95, shoulder-elbow 0.75, elbow-wrist 0.85, hand 0.95, hip-knee 0.4, knee-ankle 0.7, foot 0.95. Each can be overridden. | xcorr.txt |
| `phi` | `0.05` | Lag-1 autocorrelation of the draws. The measured residual is white: lags 1 to 5 fall within ±0.1. | resid.txt, acmag.txt |
| `W` | `2` | Half-window of the local jitter, in samples (5 samples, 0.33 s at 15 Hz). The tables were built with W = 2. | |
| `pullVis` | `0.43` | Pull of visibility (logit) toward its running median. It is the measured slope of (first − second read) on (first − median5). | pullfit.txt |
| `visShift` | `0.1` | sd (logit) of one visibility offset per set and side. Measured per video and side: −0.28 to +0.30. The spread beyond white noise is about 0.06 to 0.14. | visbias.txt |
| `gain` | `1` | Multiplier on `GAIN_TABLE`: a lone missing sample is found 72 % of the time (296/413), runs of 2 to 4 51 % (238/471), runs of 5 or more 39 % (83/212), runs at the set's ends 41 % (13/32). | gains.txt |
| `gainK` | `1.6` | A found pose sits 1.6 × the neighbours' jitter from the interpolation line (robust sd; p90 4.6 ×, p99 24 ×). | gainpose.txt |
| `gainVisSd` | `2.0` | sd (logit) of a found pose's visibility around the interpolated value. | gainpose.txt |
| `drop` | `1` | Multiplier on `DROP_TABLE`: 19.6 % next to a missing sample; elsewhere 0.1 % to 14 %, depending on distance and jitter. | drops2.txt |
| `dropExt` | `0.22` | A drop continues with probability 0.22, for a mean run of 1.28 samples. | drops2.txt |
| `rotate` | `false` | Also turns the whole skeleton per frame by an angle drawn for the frame's mean jitter (median 1 to 15°, flips above 90° on the most unsteady frames). Three-point joint angles ignore it. When on, positions get about twice the measured core spread, because rotation and the joints' own noise are drawn independently. | table.mjs `rot` |
| `rawTable` | `false` | Draws positions from the raw differences, rotation included, instead of the rotation-aligned ones. | |
| `pull`, `k`, `nu`, `kVis`, `nuVis`, `zCap`, `jitterFloorMm`, `jitterCapMm` | 0, 0.6, 5, 0.77, 2, 30, 1, 400 | Parametric mode only (`pull` works in both modes). `pull` > 0 pulls positions toward their running median. The measured slope is 0.46, but it made counts drift (grid4.txt), so it is off. | |

## Files

- `noise.mjs` and `noise-table.json`: the module and its measured tables (this folder).
- `stability.test.ts`: the measure. `STABILITY=1 npx vitest run --no-cache test/real-phone/stability/stability.test.ts`
  perturbs David's stored sets and the public build sets with seeds 1 to 5 and writes `stability.txt`: per suite the
  exact count on the clean read and on each seed, and the sets whose count moves. With `STABILITY_READS=<folder>`
  (one subfolder per encoding, each holding `<video>.json.gz` reads of David's 14 videos by the app), it also writes
  the table of the real re-encodings. It decides nothing.
- The fitting scripts (resid, calib, scaling, xcorr, pullfit, drops, gains, gainpose, visbias, validate, valsig,
  robust) and their outputs stayed in the study's scratch folder of 10 October 2026; this README keeps their numbers.

## Known limits

- It is fitted on one person's 14 gym videos. How noise scales with jitter on other cameras, or on the live
  collector, is not measured.
- It never produced a refusal on the 14 videos (0 of 330 proxy reads), while real reads refused 1 of 55 (the leg
  raise, ctl copy, which lost 13 points of seen share). It under-predicts pose loss on the hardest video: leg raise,
  real drop rate 27 % against the proxy's 12 %. On public sets it turns more refused sets into counted ones than the
  reverse.
- The magnitude of the difference clusters in time about half as much as in real reads: |residual| lag-1
  autocorrelation 0.08 against 0.17 to 0.20.
- At intensity 1, the joint-angle p99 is 20 to 35 % below real.
- Frame-time changes (the p0 and p33 copies) are not modelled: timestamps are kept.
