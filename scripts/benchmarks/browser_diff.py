#!/usr/bin/env python3
"""
scripts/benchmarks/browser_diff.py

Compares per-frame world landmarks and timestamps extracted from test/real-phone/harness.html
between Chromium and WebKit for the 5 demo clips:
  dip-13, ez-curl-10, bodyweight-squat-9, lat-pulldown-6, bicep-curl-5

Input files (expected in ~/wv-tools/browser-diff/):
  <clip>-chromium.json
  <clip>-webkit.json

Computes per clip:
  - Frame count per browser
  - Whether timestamps are identical
  - Number of frames where any landmark differs by more than 1e-6
  - First such frame index
  - Median and maximum landmark distance in metres (per landmark, averaged over landmarks 11 to 28)
"""

import json
import math
import os
import statistics
import sys
from pathlib import Path

CLIPS = [
    "dip-13",
    "ez-curl-10",
    "bodyweight-squat-9",
    "lat-pulldown-6",
    "bicep-curl-5",
]

DEFAULT_DATA_DIR = Path.home() / "wv-tools" / "browser-diff"

# MediaPipe landmarks 11 to 28 inclusive
LANDMARK_START = 11
LANDMARK_END = 28  # inclusive, so range(11, 29)


def load_clip_data(data_dir: Path, clip: str, browser: str):
    path = data_dir / f"{clip}-{browser}.json"
    if not path.exists():
        raise FileNotFoundError(f"Missing dump file: {path}")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def euclidean_distance(p1, p2):
    dx = p1["x"] - p2["x"]
    dy = p1["y"] - p2["y"]
    dz = p1["z"] - p2["z"]
    return math.sqrt(dx * dx + dy * dy + dz * dz)


def analyze_clip(data_dir: Path, clip: str):
    cr = load_clip_data(data_dir, clip, "chromium")
    wk = load_clip_data(data_dir, clip, "webkit")

    cr_ts = cr.get("timestamps", [])
    wk_ts = wk.get("timestamps", [])
    cr_lm = cr.get("worldLandmarks", [])
    wk_lm = wk.get("worldLandmarks", [])

    cr_frames = len(cr_ts)
    wk_frames = len(wk_ts)

    # Check timestamps identity
    if cr_frames != wk_frames:
        ts_identical = False
    else:
        ts_identical = all(abs(t1 - t2) < 1e-6 for t1, t2 in zip(cr_ts, wk_ts))

    num_frames = min(cr_frames, wk_frames)

    diff_frames_count = 0
    first_diff_frame = None
    frame_distances = []  # per-frame average distance over landmarks 11..28

    TOLERANCE = 1e-6

    for i in range(num_frames):
        lms_cr = cr_lm[i] if i < len(cr_lm) else None
        lms_wk = wk_lm[i] if i < len(wk_lm) else None

        # Check if one is None and the other is not
        if (lms_cr is None) != (lms_wk is None):
            diff_frames_count += 1
            if first_diff_frame is None:
                first_diff_frame = i
            continue

        if lms_cr is None and lms_wk is None:
            # Both had no detection
            continue

        # Check if any landmark differs by more than 1e-6
        # Compare all landmarks present in both
        frame_differs = False
        num_lms = min(len(lms_cr), len(lms_wk))
        for j in range(num_lms):
            p1 = lms_cr[j]
            p2 = lms_wk[j]
            if (
                abs(p1["x"] - p2["x"]) > TOLERANCE
                or abs(p1["y"] - p2["y"]) > TOLERANCE
                or abs(p1["z"] - p2["z"]) > TOLERANCE
            ):
                frame_differs = True
                break

        if frame_differs:
            diff_frames_count += 1
            if first_diff_frame is None:
                first_diff_frame = i

        # Calculate distance for landmarks 11 to 28
        lm_dists = []
        for j in range(LANDMARK_START, LANDMARK_END + 1):
            if j < len(lms_cr) and j < len(lms_wk):
                d = euclidean_distance(lms_cr[j], lms_wk[j])
                lm_dists.append(d)

        if lm_dists:
            frame_avg_dist = sum(lm_dists) / len(lm_dists)
            frame_distances.append(frame_avg_dist)

    # Any extra frames in one browser count as diff frames
    extra_frames = abs(cr_frames - wk_frames)
    diff_frames_count += extra_frames
    if extra_frames > 0 and first_diff_frame is None:
        first_diff_frame = num_frames

    if frame_distances:
        median_dist = statistics.median(frame_distances)
        max_dist = max(frame_distances)
    else:
        median_dist = 0.0
        max_dist = 0.0

    return {
        "clip": clip,
        "cr_frames": cr_frames,
        "wk_frames": wk_frames,
        "ts_identical": "Yes" if ts_identical else "No",
        "diff_frames_count": diff_frames_count,
        "first_diff_frame": first_diff_frame if first_diff_frame is not None else "-",
        "median_dist_m": median_dist,
        "max_dist_m": max_dist,
    }


def main():
    data_dir = DEFAULT_DATA_DIR
    if len(sys.argv) > 1:
        data_dir = Path(sys.argv[1])

    results = []
    for clip in CLIPS:
        res = analyze_clip(data_dir, clip)
        results.append(res)

    # Print markdown table
    headers = [
        "Clip",
        "Chromium Frames",
        "WebKit Frames",
        "Timestamps Identical",
        "Frames Diff > 1e-6",
        "First Diff Frame",
        "Median Dist (m)",
        "Max Dist (m)",
    ]

    col_fmt = "| {:<20} | {:>15} | {:>13} | {:^20} | {:>18} | {:>16} | {:>15} | {:>12} |"
    sep_fmt = "|:" + "-" * 21 + "|" + "-" * 16 + ":|" + "-" * 14 + ":|:" + "-" * 20 + ":|" + "-" * 19 + ":|" + "-" * 17 + ":|" + "-" * 16 + ":|" + "-" * 13 + ":|"

    print(col_fmt.format(*headers))
    print(sep_fmt)
    for r in results:
        print(
            col_fmt.format(
                r["clip"],
                r["cr_frames"],
                r["wk_frames"],
                r["ts_identical"],
                r["diff_frames_count"],
                r["first_diff_frame"],
                f"{r['median_dist_m']:.6f}",
                f"{r['max_dist_m']:.6f}",
            )
        )


if __name__ == "__main__":
    main()
