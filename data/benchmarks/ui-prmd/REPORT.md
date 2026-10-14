# UI-PRMD Physical Rehabilitation Benchmark Report

> **Reproduction Command**: `npx tsx scripts/benchmarks/count_uiprmd_sets.ts`
> Benchmark of WorkoutVision core counting engine against University of Idaho Physical Rehabilitation Movement Dataset (UI-PRMD, ODC-PDDL v1.0).

## Overview

- **Dataset**: UI-PRMD (MDPI Data 2018, DOI: [10.3390/data3020017](https://doi.org/10.3390/data3020017))
- **License**: Open Data Commons Public Domain Dedication and License (PDDL) v1.0 (Commercial Use Permitted)
- **Downloads Manifest**: `data/benchmarks/ui-prmd/downloads_manifest.json` (20 files verified via SHA-256)
- **Evaluated Sets**: 5
- **Total Sets Gzipped Footprint**: 123.1 KB

## 1. Evaluation Results by Movement

| Movement Code | Movement Name | Catalogue Exercise | True Reps | Counted Reps | Delta (Count − Truth) | Status | Samples | Duration (s) |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `m01` | Deep Squat | `squat` | 1 | 1 | +0 | EXACT | 73 | 2.40 |
| `m03` | Inline Lunge | `lunge` | 1 | 1 | +0 | EXACT | 56 | 1.83 |
| `m05` | Sit to Stand | `chair_stand_test` | 1 | 1 | +0 | EXACT | 80 | 2.63 |
| `m07` | Standing Shoulder Abduction | `lateral_raise` | 1 | 0 | -1 | OFF | 63 | 2.07 |
| `m10` | Seated Knee Extension | `leg_extension` | 1 | 0 | -1 | OFF | 62 | 2.03 |

- **Exact Match Share**: 3/5 (60.0%)

## 2. Skipped Movements

The following UI-PRMD movements were excluded from counting because the catalogue has no matching counter:

| Movement Code | Movement Name | Reason for Exclusion |
| :---: | :--- | :--- |
| `m02` | Hurdle Step | No matching catalogue exercise |
| `m04` | Side Lunge | No matching catalogue exercise |
| `m06` | Standing Active Back Extension | No matching catalogue exercise |
| `m08` | Standing Shoulder Internal/External Rotation | No matching catalogue exercise |
| `m09` | Trunk Rotation | No matching catalogue exercise |

