# WorkoutVision Universal Benchmark Matrix

> Updated: 2026-11-03
> Comprehensive evaluation of WorkoutVision on-device computer vision counting core across 1593 sets from 6 distinct datasets.

## 1. Consolidated Executive Table

| Benchmark Cohort | Total Sets | Exact Matches | Exact Share (%) | 95% Wilson Interval | Off 1–2 | Off 3+ (Catastrophic) | Refused | Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| Real Phone Baseline (Stored) | 15 | 13 | 86.7% | 62.1-96.3% | 2 | 0 | 0 | PASS (R2 Gate) |
| Real Phone Whole Video (7 Oct) | 16 | 13 | 81.3% | 57.0-93.4% | 1 | 0 | 2 | PASS (R2 Gate) |
| Real Phone Video Mode (Whole) | 14 | 6 | 42.9% | 21.4-67.4% | 5 | 0 | 3 | MEASURED |
| IntelliRehabDS Physical Therapy | 170 | 139 | 81.8% | 75.3-86.8% | 13 | 18 | 0 | CLINICAL BENCH |
| MM-Fit Strength Dataset | 158 | 117 | 74.1% | 66.7-80.3% | 41 | 0 | 0 | BENCHMARK |
| Countix In-The-Wild (Cut Window) | 447 | 204 | 45.6% | 41.1-50.3% | 190 | 0 | 53 | BENCHMARK |
| Countix In-The-Wild (Whole Video) | 447 | 188 | 42.1% | 37.6-46.7% | 194 | 0 | 65 | BENCHMARK |
| RepCount-A (Build Half) | 124 | 27 | 21.8% | 15.4-29.8% | 52 | 45 | 0 | BENCHMARK |
| CFRep Crossfit Bench | 12 | 8 | 66.7% | 39.1-86.2% | 4 | 0 | 0 | BENCHMARK |
| Browser Stability Matrix (16 Var.) | 190 | 105 | 55.3% | 48.2-62.2% | 73 | 7 | 5 | 16 TRANSFORMS |
| **TOTAL CORPUS** | **1593** | **820** | **51.5%** | **49.0-53.9%** | **575** | **70** | **128** | **VERIFIED** |

## 2. Clinical Rehabilitation Breakdown (IntelliRehabDS, 170 Sets)

| Patient Posture | Sessions | Exact Matches | Exact Share (%) | 95% Wilson Interval | Off 1–2 | Off 3+ |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `chair` | 55 | 50 | 90.9% | 80.4-96.1% | 3 | 2 |
| `stand` | 84 | 66 | 78.6% | 68.7-86.0% | 6 | 12 |
| `wheelchair` | 17 | 11 | 64.7% | 41.3-82.7% | 3 | 3 |
| `stand-frame` | 4 | 2 | 50.0% | 15.0-85.0% | 1 | 1 |
| `sit` | 10 | 10 | 100.0% | 72.2-100.0% | 0 | 0 |

## 3. Cross-Browser Invariance (Stability Matrix, 190 Runs across 16 Transformations)

| Browser Engine | Total Runs | Exact Matches | Invariance Share (%) |
| :--- | :---: | :---: | :---: |
| `chromium` | 95 | 53 | 55.8% |
| `webkit` | 95 | 52 | 54.7% |

