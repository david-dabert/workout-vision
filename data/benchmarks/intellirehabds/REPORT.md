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
| `bicep_curl` | G0, G1 | 38 | 8 | 8/38 (21.1%, 11.1-36.3%) | 0 | 4.55 | 203 | 44 |
| `front_raise` | G2, G3 | 64 | 54 | 54/64 (84.4%, 73.6-91.3%) | 0 | 0.59 | 349 | 381 |
| `lateral_raise` | G5, G4 | 68 | 16 | 16/68 (23.5%, 15.0-34.9%) | 0 | 4.40 | 368 | 85 |
| **Overall** | **All Mapped** | **170** | **78** | **78/170 (45.9%, 38.6-53.4%)** | **0** | **3.00** | **920** | **510** |

## 2. Distribution of Error (Count − Truth)

Distribution of deviations `(app_count - true_count)` across counted sets (refusals excluded):

| Exercise | Total Counted | -7 | -6 | -5 | -4 | -3 | -2 | -1 | +0 | +1 | +2 | +3 | +4 | +5 | +6 | +7 | +8 | +9 | +10 | +11 | +12 | +13 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `bicep_curl` | 38 | 2 | 21 | 4 | 0 | 2 | 0 | 0 | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 |
| `front_raise` | 64 | 0 | 0 | 0 | 0 | 0 | 0 | 3 | 54 | 1 | 2 | 0 | 0 | 2 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| `lateral_raise` | 68 | 2 | 43 | 3 | 0 | 1 | 0 | 1 | 16 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **Total** | **170** | **4** | **64** | **7** | **0** | **3** | **0** | **4** | **78** | **1** | **3** | **0** | **0** | **2** | **1** | **2** | **0** | **0** | **0** | **0** | **0** | **1** |

## 3. Accuracy Breakdown by Patient Posture

| Posture | Sessions | Exact Matches | Exact Share | Refused | Mean Error |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `chair` | 55 | 25 | 45.5% (33.0-58.5%) | 0 | 3.16 |
| `sit` | 10 | 7 | 70.0% (39.7-89.2%) | 0 | 1.90 |
| `stand` | 84 | 37 | 44.0% (33.9-54.7%) | 0 | 3.11 |
| `stand-frame` | 4 | 1 | 25.0% (4.6-69.9%) | 0 | 4.00 |
| `wheelchair` | 17 | 8 | 47.1% (26.2-69.0%) | 0 | 2.35 |

## 4. Skipped Gestures

The following dataset gestures were excluded from evaluation because the catalogue has no counter for their joint kinematics:

| Gesture ID | Gesture Name | Reason for Exclusion |
| :---: | :--- | :--- |
| 6 | Shoulder Forward Elevation | Bilateral clasped elevation; no catalogue counter |
| 7 | Side Tap Left | Hip frontal abduction / side tap; no catalogue counter |
| 8 | Side Tap Right | Hip frontal abduction / side tap; no catalogue counter |

