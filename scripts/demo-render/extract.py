#!/usr/bin/env python3
"""
WorkoutVision Offline Pose Landmark Extractor

Extracts 33 MediaPipe pose landmarks frame-by-frame with exact thresholds matching
the client-side WebAssembly engine:
  - min_pose_detection_confidence: 0.35
  - min_pose_presence_confidence: 0.40
  - min_tracking_confidence: 0.50

Usage:
  python extract.py --video <path_to_video.mp4> [--out <output_landmarks.json>]
"""

import argparse
import hashlib
import json
import os
import sys
import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# 12 major body joints for coverage reporting
MAJOR_JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def extract_landmarks(video_path: str, model_path: str, out_path: str, explicit_id: str | None = None):
    if not os.path.exists(video_path):
        print(f"Error: Video not found: {video_path}", file=sys.stderr)
        sys.exit(1)

    if not os.path.exists(model_path):
        print(f"Error: Model not found: {model_path}", file=sys.stderr)
        sys.exit(1)

    model_hash = sha256_file(model_path)
    stem = explicit_id or os.path.splitext(os.path.basename(video_path))[0]

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error: Unable to open video: {video_path}", file=sys.stderr)
        sys.exit(1)

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    base_options = python.BaseOptions(
        model_asset_path=model_path,
        delegate=python.BaseOptions.Delegate.CPU
    )
    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.35,
        min_pose_presence_confidence=0.40,
        min_tracking_confidence=0.50
    )
    detector = vision.PoseLandmarker.create_from_options(options)

    frames_data = []
    frames_all_major_visible = 0
    missing_ranges = []
    current_missing_start = None

    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        t_ms = int(round(frame_idx * (1000.0 / fps)))
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        res = detector.detect_for_video(mp_img, t_ms)

        lms_list = []
        all_major_vis = False

        if res.pose_landmarks and len(res.pose_landmarks) > 0:
            pose = res.pose_landmarks[0]
            # Verify 12 major joints visibility floor >= 0.50
            major_vis = [pose[j].visibility for j in MAJOR_JOINTS if j < len(pose)]
            if len(major_vis) == len(MAJOR_JOINTS) and all(v >= 0.50 for v in major_vis):
                all_major_vis = True

            for lm in pose:
                # [x, y, z, visibility, presence]
                lms_list.append([
                    round(float(lm.x), 4),
                    round(float(lm.y), 4),
                    round(float(lm.z), 4),
                    round(float(lm.visibility), 4),
                    round(float(lm.presence), 4)
                ])

        if all_major_vis:
            frames_all_major_visible += 1
            if current_missing_start is not None:
                missing_ranges.append((current_missing_start, frame_idx - 1))
                current_missing_start = None
        else:
            if current_missing_start is None:
                current_missing_start = frame_idx

        frames_data.append({
            "t_ms": t_ms,
            "landmarks": lms_list
        })
        frame_idx += 1

    if current_missing_start is not None:
        missing_ranges.append((current_missing_start, frame_idx - 1))

    cap.release()

    cov_pct = round((frames_all_major_visible / max(frame_idx, 1)) * 100.0, 1)

    output = {
        "id": stem,
        "model": os.path.basename(model_path),
        "model_sha256": model_hash,
        "min_pose_detection_confidence": 0.35,
        "min_pose_presence_confidence": 0.40,
        "min_tracking_confidence": 0.50,
        "platform": "macOS/Python",
        "mediapipe_version": mp.__version__,
        "running_mode": "VIDEO",
        "fps": round(fps, 2),
        "width": width,
        "height": height,
        "total_frames": frame_idx,
        "tracking_coverage_major_joints_pct": cov_pct,
        "missing_major_ranges": missing_ranges,
        "frames": frames_data
    }

    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    print(f"Extracted {frame_idx} frames to {out_path}")
    print(f"  Coverage (12 major joints >= 0.5): {frames_all_major_visible}/{frame_idx} ({cov_pct}%)")
    print(f"  Missing frame ranges: {missing_ranges}")


def main():
    parser = argparse.ArgumentParser(description="Extract MediaPipe pose landmarks from MP4 video.")
    parser.add_argument("--video", required=True, help="Input video MP4 path.")
    parser.add_argument("--model", default="public/mediapipe/pose_landmarker_full.task", help="Path to MediaPipe model.")
    parser.add_argument("--id", default=None, help="Explicit clip ID for metadata (default: video stem).")
    parser.add_argument("--out", default=None, help="Output JSON path (default: data/demo-v2/landmarks/<id>.json).")
    args = parser.parse_args()

    stem = args.id or os.path.splitext(os.path.basename(args.video))[0]
    out_path = args.out or f"data/demo-v2/landmarks/{stem}.json"

    extract_landmarks(args.video, args.model, out_path, explicit_id=stem)


if __name__ == "__main__":
    main()
