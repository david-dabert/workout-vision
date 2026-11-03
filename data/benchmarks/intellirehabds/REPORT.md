# IntelliRehabDS Physical Rehabilitation Benchmark Report

> **Reproduction Command**: `npx tsx scripts/benchmarks/count_rehab_sets.ts`
> Benchmark of WorkoutVision core counting engine against continuous multi-repetition sessions from IntelliRehabDS (CC BY 4.0).

## Overview

- **Dataset**: IntelliRehabDS (Zenodo DOI: [10.5281/zenodo.4610859](https://doi.org/10.5281/zenodo.4610859))
- **Continuous Sessions Evaluated**: 170
- **Discontinuous / Resetting Sessions Excluded**: 72 (see `data/benchmarks/intellirehabds/BLOCKED.md`)
- **Total Sets Gzipped Footprint**: 11.61 MB

## 1. Accuracy Summary by Mapped Exercise

| Mapped Exercise | Gestures | Evaluated Sets | Exact Matches | Exact Share (95% Wilson) | Refused Sets | Mean Absolute Error | Total True Reps | Total Counted Reps |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `bicep_curl` | G0, G1 | 38 | 32 | 32/38 (84.2%, 69.6-92.6%) | 0 | 0.47 | 203 | 207 |
| `front_raise` | G2, G3 | 64 | 54 | 54/64 (84.4%, 73.6-91.3%) | 0 | 0.59 | 349 | 381 |
| `lateral_raise` | G5, G4 | 68 | 53 | 53/68 (77.9%, 66.7-86.2%) | 0 | 1.00 | 368 | 338 |
| **Overall** | **All Mapped** | **170** | **139** | **139/170 (81.8%, 75.3-86.8%)** | **0** | **0.73** | **920** | **926** |

## 2. Distribution of Error (Count − Truth)

Distribution of deviations `(app_count - true_count)` across counted sets (refusals excluded):

| Exercise | Total Counted | -6 | -5 | -4 | -3 | -2 | -1 | +0 | +1 | +2 | +3 | +4 | +5 | +6 | +7 | +8 | +9 | +10 | +11 | +12 | +13 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `bicep_curl` | 38 | 0 | 1 | 0 | 0 | 0 | 2 | 32 | 1 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| `front_raise` | 64 | 0 | 0 | 0 | 0 | 0 | 3 | 54 | 1 | 2 | 0 | 0 | 2 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| `lateral_raise` | 68 | 7 | 1 | 0 | 0 | 0 | 2 | 53 | 1 | 1 | 1 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| **Total** | **170** | **7** | **2** | **0** | **0** | **0** | **7** | **139** | **3** | **3** | **2** | **0** | **2** | **1** | **3** | **0** | **0** | **0** | **0** | **0** | **1** |

## 3. Accuracy Breakdown by Patient Posture

| Posture | Sessions | Exact Matches | Exact Share | Refused | Mean Error |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `chair` | 55 | 50 | 90.9% (80.4-96.1%) | 0 | 0.27 |
| `sit` | 10 | 10 | 100.0% (72.2-100.0%) | 0 | 0.00 |
| `stand` | 84 | 66 | 78.6% (68.7-86.0%) | 0 | 0.96 |
| `stand-frame` | 4 | 2 | 50.0% (15.0-85.0%) | 0 | 1.50 |
| `wheelchair` | 17 | 11 | 64.7% (41.3-82.7%) | 0 | 1.29 |

## 4. Skipped Gestures

The following dataset gestures were excluded from evaluation because the catalogue has no counter for their joint kinematics:

| Gesture ID | Gesture Name | Reason for Exclusion |
| :---: | :--- | :--- |
| 6 | Shoulder Forward Elevation | Bilateral clasped elevation; no catalogue counter |
| 7 | Side Tap Left | Hip frontal abduction / side tap; no catalogue counter |
| 8 | Side Tap Right | Hip frontal abduction / side tap; no catalogue counter |

