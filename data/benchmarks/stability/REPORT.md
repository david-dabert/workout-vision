# WorkoutVision Stability Matrix Benchmark Report

> **Reproduction Command**: `python3 scripts/benchmarks/report_matrix.py`
> Generated automatically from `data/benchmarks/stability/results.json`.

## Overview

This benchmark measures the counting stability of WorkoutVision across video transformations (compression, scaling, framerate, cropping, brightness, flipping, rotation, encoding) on Chromium and WebKit.

- **Total test runs recorded**: 190
- **Browsers evaluated**: chromium, webkit
- **Clips tested**: 5 (`dip-13, ez-curl-10, bodyweight-squat-9, lat-pulldown-6, bicep-curl-5`)
- **Variants per clip**: 16

## 1. Exact Match Share (Count == True Count)

| Clip | Exercise | True Count | Chromium Exact Match | WebKit Exact Match | Overall Exact Match |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `dip-13` | dip | 13 | 3/16 (18.8%) | 3/16 (18.8%) | 6/32 (18.8%) |
| `ez-curl-10` | ez | 10 | 10/16 (62.5%) | 9/16 (56.2%) | 19/32 (59.4%) |
| `bodyweight-squat-9` | bodyweight | 9 | 13/16 (81.2%) | 16/16 (100.0%) | 29/32 (90.6%) |
| `lat-pulldown-6` | lat | 6 | 7/16 (43.8%) | 8/16 (50.0%) | 15/32 (46.9%) |
| `bicep-curl-5` | bicep | 5 | 10/16 (62.5%) | 8/16 (50.0%) | 18/32 (56.2%) |

## 2. Per-Clip Variant Stability Tables

### Clip: `dip-13` (True Count: 13)

| Variant | Chromium Count | Chromium Diff | WebKit Count | WebKit Diff | Chromium Samples | WebKit Samples |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `original` | 12 | -1 | 10 | -3 | 317 | 317 |
| `crf18` | 11 | -2 | 12 | -1 | 317 | 317 |
| `crf28` | 11 | -2 | 11 | -2 | 317 | 317 |
| `crf35` | 14 | +1 | 12 | -1 | 317 | 317 |
| `scale_720` | 10 | -3 | 8 | -5 | 317 | 317 |
| `scale_480` | 12 | -1 | 12 | -1 | 317 | 317 |
| `scale_360` | 12 | -1 | 13 | +0 | 317 | 317 |
| `fps_half` | 13 | +0 | 10 | -3 | 318 | 318 |
| `fps_24` | 13 | +0 | 13 | +0 | 317 | 317 |
| `fps_15` | 13 | +0 | 10 | -3 | 318 | 318 |
| `crop_10` | 12 | -1 | 12 | -1 | 317 | 317 |
| `brightness_m20` | 11 | -2 | 11 | -2 | 317 | 317 |
| `brightness_p20` | 11 | -2 | 12 | -1 | 317 | 317 |
| `hflip` | 12 | -1 | 12 | -1 | 317 | 317 |
| `rotate_90` | 12 | -1 | 10 | -3 | 317 | 317 |
| `hevc` | REFUSED | - | 13 | +0 | - | 317 |

### Clip: `ez-curl-10` (True Count: 10)

| Variant | Chromium Count | Chromium Diff | WebKit Count | WebKit Diff | Chromium Samples | WebKit Samples |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `original` | 10 | +0 | 9 | -1 | 478 | 478 |
| `crf18` | 10 | +0 | 10 | +0 | 478 | 478 |
| `crf28` | 10 | +0 | 10 | +0 | 478 | 478 |
| `crf35` | 9 | -1 | 9 | -1 | 478 | 478 |
| `scale_720` | 8 | -2 | 10 | +0 | 478 | 478 |
| `scale_480` | 10 | +0 | 10 | +0 | 478 | 478 |
| `scale_360` | 10 | +0 | 10 | +0 | 478 | 478 |
| `fps_half` | 10 | +0 | 10 | +0 | 478 | 478 |
| `fps_24` | 9 | -1 | 9 | -1 | 478 | 478 |
| `fps_15` | 10 | +0 | 10 | +0 | 478 | 478 |
| `crop_10` | 9 | -1 | 9 | -1 | 478 | 478 |
| `brightness_m20` | 10 | +0 | 11 | +1 | 478 | 478 |
| `brightness_p20` | 10 | +0 | 10 | +0 | 478 | 478 |
| `hflip` | 9 | -1 | 9 | -1 | 478 | 478 |
| `rotate_90` | 10 | +0 | 9 | -1 | 478 | 478 |
| `hevc` | REFUSED | - | 10 | +0 | - | 478 |

### Clip: `bodyweight-squat-9` (True Count: 9)

| Variant | Chromium Count | Chromium Diff | WebKit Count | WebKit Diff | Chromium Samples | WebKit Samples |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `original` | 9 | +0 | 9 | +0 | 415 | 415 |
| `crf18` | 9 | +0 | 9 | +0 | 414 | 414 |
| `crf28` | 9 | +0 | 9 | +0 | 414 | 414 |
| `crf35` | 9 | +0 | 9 | +0 | 414 | 414 |
| `scale_720` | 9 | +0 | 9 | +0 | 415 | 415 |
| `scale_480` | 9 | +0 | 9 | +0 | 414 | 414 |
| `scale_360` | 9 | +0 | 9 | +0 | 414 | 414 |
| `fps_half` | 9 | +0 | 9 | +0 | 415 | 415 |
| `fps_24` | 9 | +0 | 9 | +0 | 415 | 415 |
| `fps_15` | 9 | +0 | 9 | +0 | 415 | 415 |
| `crop_10` | 8 | -1 | 9 | +0 | 414 | 414 |
| `brightness_m20` | 10 | +1 | 9 | +0 | 415 | 415 |
| `brightness_p20` | 9 | +0 | 9 | +0 | 414 | 414 |
| `hflip` | 9 | +0 | 9 | +0 | 414 | 414 |
| `rotate_90` | 9 | +0 | 9 | +0 | 415 | 415 |
| `hevc` | REFUSED | - | 9 | +0 | - | 415 |

### Clip: `lat-pulldown-6` (True Count: 6)

| Variant | Chromium Count | Chromium Diff | WebKit Count | WebKit Diff | Chromium Samples | WebKit Samples |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `original` | 7 | +1 | 6 | +0 | 275 | 275 |
| `crf18` | 7 | +1 | 8 | +2 | 275 | 275 |
| `crf28` | 6 | +0 | 6 | +0 | 275 | 275 |
| `crf35` | 4 | -2 | 5 | -1 | 275 | 275 |
| `scale_720` | 7 | +1 | 6 | +0 | 275 | 275 |
| `scale_480` | 7 | +1 | 8 | +2 | 275 | 275 |
| `scale_360` | 7 | +1 | 6 | +0 | 275 | 275 |
| `fps_half` | 6 | +0 | 7 | +1 | 276 | 276 |
| `fps_24` | 6 | +0 | 6 | +0 | 275 | 275 |
| `fps_15` | 6 | +0 | 7 | +1 | 276 | 276 |
| `crop_10` | 6 | +0 | 6 | +0 | 275 | 275 |
| `brightness_m20` | 7 | +1 | 7 | +1 | 275 | 275 |
| `brightness_p20` | 6 | +0 | 7 | +1 | 275 | 275 |
| `hflip` | 6 | +0 | 6 | +0 | 275 | 275 |
| `rotate_90` | 7 | +1 | 6 | +0 | 275 | 275 |
| `hevc` | REFUSED | - | 7 | +1 | - | 275 |

### Clip: `bicep-curl-5` (True Count: 5)

| Variant | Chromium Count | Chromium Diff | WebKit Count | WebKit Diff | Chromium Samples | WebKit Samples |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `original` | 5 | +0 | 4 | -1 | 117 | 117 |
| `crf18` | 5 | +0 | 5 | +0 | 117 | 117 |
| `crf28` | 5 | +0 | 4 | -1 | 117 | 117 |
| `crf35` | 5 | +0 | 5 | +0 | 117 | 117 |
| `scale_720` | 5 | +0 | 4 | -1 | 117 | 117 |
| `scale_480` | 5 | +0 | 5 | +0 | 117 | 117 |
| `scale_360` | 4 | -1 | 5 | +0 | 117 | 117 |
| `fps_half` | 4 | -1 | 4 | -1 | 58 | 58 |
| `fps_24` | 4 | -1 | 5 | +0 | 179 | 179 |
| `fps_15` | 4 | -1 | 4 | -1 | 178 | 178 |
| `crop_10` | 5 | +0 | 4 | -1 | 117 | 117 |
| `brightness_m20` | 4 | -1 | 5 | +0 | 117 | 117 |
| `brightness_p20` | 5 | +0 | 5 | +0 | 117 | 117 |
| `hflip` | 5 | +0 | 5 | +0 | 117 | 117 |
| `rotate_90` | 5 | +0 | 4 | -1 | 117 | 117 |
| `hevc` | REFUSED | - | 4 | -1 | - | 117 |

## 3. Count Perturbations by Variant Type

Analysis of which video transformations introduce rep counting deviations relative to `original`:

| Variant | Tested Runs | Matches Original | Count Shifted | Max Delta | Mean Absolute Delta |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `brightness_m20` | 10 | 3 (30.0%) | 7 (70.0%) | 2 | 0.80 |
| `brightness_p20` | 10 | 4 (40.0%) | 6 (60.0%) | 2 | 0.70 |
| `crf18` | 10 | 5 (50.0%) | 5 (50.0%) | 2 | 0.70 |
| `crf28` | 10 | 6 (60.0%) | 4 (40.0%) | 1 | 0.40 |
| `crf35` | 10 | 4 (40.0%) | 6 (60.0%) | 3 | 1.00 |
| `crop_10` | 10 | 6 (60.0%) | 4 (40.0%) | 2 | 0.50 |
| `fps_15` | 10 | 5 (50.0%) | 5 (50.0%) | 1 | 0.50 |
| `fps_24` | 10 | 4 (40.0%) | 6 (60.0%) | 3 | 0.80 |
| `fps_half` | 10 | 5 (50.0%) | 5 (50.0%) | 1 | 0.50 |
| `hevc` | 5 | 2 (40.0%) | 3 (60.0%) | 3 | 1.00 |
| `hflip` | 10 | 6 (60.0%) | 4 (40.0%) | 2 | 0.50 |
| `original` | 10 | 10 (100.0%) | 0 (0.0%) | 0 | 0.00 |
| `rotate_90` | 10 | 10 (100.0%) | 0 (0.0%) | 0 | 0.00 |
| `scale_360` | 10 | 6 (60.0%) | 4 (40.0%) | 3 | 0.60 |
| `scale_480` | 10 | 6 (60.0%) | 4 (40.0%) | 2 | 0.60 |
| `scale_720` | 10 | 6 (60.0%) | 4 (40.0%) | 2 | 0.70 |

## 4. Run-to-Run Repeatability (Deterministic Check)

- **Evaluated pairs (Run 1 vs Run 2)**: 30
- **Identical count outputs**: 30 (100.0%)
- **Divergent count outputs**: 0 (0.0%)

## 5. Refusals

| Browser | Clip | Variant | Reason / Error | Samples | Pose Coverage |
| :--- | :--- | :--- | :--- | :---: | :---: |
| chromium | `dip-13` | `hevc` | page.evaluate: Error: Video extraction failed. No decoder could process this file.
  - WebCodecs: Codec not supported by WebCodecs: hev1.1.6.L90.90
  - RVFC: Failed to load video
    at extractFramesStreaming (http://localhost:5173/workout-vision/src/lib/frameExtractor.js:905:19)
    at async processFile (http://localhost:5173/workout-vision/test/real-phone/harness.js:76:24)
    at async eval (eval at evaluate (:311:30), <anonymous>:9:19)
    at async <anonymous>:337:30 | N/A | N/A |
| chromium | `ez-curl-10` | `hevc` | page.evaluate: Error: Video extraction failed. No decoder could process this file.
  - WebCodecs: Codec not supported by WebCodecs: hev1.1.6.L90.90
  - RVFC: Failed to load video
    at extractFramesStreaming (http://localhost:5173/workout-vision/src/lib/frameExtractor.js:905:19)
    at async processFile (http://localhost:5173/workout-vision/test/real-phone/harness.js:76:24)
    at async eval (eval at evaluate (:311:30), <anonymous>:9:19)
    at async <anonymous>:337:30 | N/A | N/A |
| chromium | `bodyweight-squat-9` | `hevc` | page.evaluate: Error: Video extraction failed. No decoder could process this file.
  - WebCodecs: Codec not supported by WebCodecs: hev1.1.6.L90.90
  - RVFC: Failed to load video
    at extractFramesStreaming (http://localhost:5173/workout-vision/src/lib/frameExtractor.js:905:19)
    at async processFile (http://localhost:5173/workout-vision/test/real-phone/harness.js:76:24)
    at async eval (eval at evaluate (:311:30), <anonymous>:9:19)
    at async <anonymous>:337:30 | N/A | N/A |
| chromium | `lat-pulldown-6` | `hevc` | page.evaluate: Error: Video extraction failed. No decoder could process this file.
  - WebCodecs: Codec not supported by WebCodecs: hev1.1.6.L90.90
  - RVFC: Failed to load video
    at extractFramesStreaming (http://localhost:5173/workout-vision/src/lib/frameExtractor.js:905:19)
    at async processFile (http://localhost:5173/workout-vision/test/real-phone/harness.js:76:24)
    at async eval (eval at evaluate (:311:30), <anonymous>:9:19)
    at async <anonymous>:337:30 | N/A | N/A |
| chromium | `bicep-curl-5` | `hevc` | page.evaluate: Error: Video extraction failed. No decoder could process this file.
  - WebCodecs: Codec not supported by WebCodecs: hev1.1.6.L90.90
  - RVFC: Failed to load video
    at extractFramesStreaming (http://localhost:5173/workout-vision/src/lib/frameExtractor.js:905:19)
    at async processFile (http://localhost:5173/workout-vision/test/real-phone/harness.js:76:24)
    at async eval (eval at evaluate (:311:30), <anonymous>:9:19)
    at async <anonymous>:337:30 | N/A | N/A |

