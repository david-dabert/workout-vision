#!/usr/bin/env python3
"""
WorkoutVision Equine Keypoint Extractor and Renderer

Runs offline top-down pose estimation on horse videos using RTMPose-m trained on AP-10K:
  - Model ONNX URL: https://huggingface.co/hr16/UnJIT-DWPose/resolve/main/rtmpose-m_ap10k_256.onnx
  - Model SHA-256: 1cfd1c86e0d9e5d5f95178bcd95ee9a4e8386a624cd3c57519f27ff58cac7f28
  - MMPose Origin: rtmpose-m_simcc-ap10k_pt-aic-coco_210e-256x256-7a041aa1_20230206

Top-Down Pipeline:
  1. Keyframed bounding box per frame, padded by 1.25, squared with padding (no stretching).
  2. Affine warp to 256x256; normalization with pipeline.json mean [123.675, 116.28, 103.53] and std [58.395, 57.12, 57.375].
  3. SimCC decoding with split ratio 2; inverse affine warp back to original frame coordinates.
  4. Keeps raw logit scores as 'score_raw' (no sigmoid, never called confidence or probability).
  5. Drawing threshold 0.50 (eyes/nose in behind view naturally fall below threshold).
  6. Standard AP-10K joint names: neck, tail_root, hip, knee, paw (no withers, croup, or tuber sacrale).

Usage:
  python equine_keypoints.py --video <path.mp4> --model <path.onnx> --out-json <path.json> --out-mp4 <path.mp4>
"""

import argparse
import hashlib
import json
import math
import os
import subprocess
import sys
import tempfile
import cv2
import numpy as np
import onnxruntime as ort

MODEL_URL = "https://huggingface.co/hr16/UnJIT-DWPose/resolve/main/rtmpose-m_ap10k_256.onnx"
EXPECTED_SHA256 = "1cfd1c86e0d9e5d5f95178bcd95ee9a4e8386a624cd3c57519f27ff58cac7f28"
MMPOSE_ORIGIN = "rtmpose-m_simcc-ap10k_pt-aic-coco_210e-256x256-7a041aa1_20230206"

AP10K_KEYPOINTS = [
    "left_eye", "right_eye", "nose", "neck", "tail_root",
    "left_shoulder", "left_elbow", "left_front_paw",
    "right_shoulder", "right_elbow", "right_front_paw",
    "left_hip", "left_knee", "left_back_paw",
    "right_hip", "right_knee", "right_back_paw"
]

AP10K_BONES = [
    # Head
    (3, 2), (0, 2), (1, 2),
    # Spine
    (3, 4),
    # Left Front Leg
    (3, 5), (5, 6), (6, 7),
    # Right Front Leg
    (3, 8), (8, 9), (9, 10),
    # Left Hind Leg
    (4, 11), (11, 12), (12, 13),
    # Right Hind Leg
    (4, 14), (14, 15), (15, 16)
]

DRAWING_THRESHOLD = 0.50

# Visual Palette
COLOR_BONE = (240, 242, 245)    # Soft off-white
COLOR_JOINT = (56, 189, 248)    # Cyan
COLOR_AXIAL = (234, 179, 8)     # Amber marker for neck / tail_root


# Keyframe annotations for the two demo clips
KEYFRAMED_BBOXES = {
    "horse_ridden_trot_behind_30170927": {
        0: [350, 260, 510, 460],
        90: [340, 245, 495, 435],
        180: [330, 230, 480, 415],
        270: [325, 215, 470, 390],
        359: [320, 200, 465, 365]
    },
    "horse_ridden_trot_side_35971086": {
        0: [350, 160, 690, 420],
        45: [365, 160, 710, 420],
        90: [380, 160, 735, 420],
        135: [395, 160, 760, 420],
        179: [410, 160, 850, 420]
    }
}


def interpolate_bbox(keyframes: dict[int, list[float]], frame_idx: int) -> list[float]:
    """Linearly interpolate bounding box [x1, y1, x2, y2] between keyframes."""
    sorted_keys = sorted(keyframes.keys())
    if frame_idx <= sorted_keys[0]:
        return keyframes[sorted_keys[0]]
    if frame_idx >= sorted_keys[-1]:
        return keyframes[sorted_keys[-1]]

    for i in range(len(sorted_keys) - 1):
        k1, k2 = sorted_keys[i], sorted_keys[i + 1]
        if k1 <= frame_idx <= k2:
            alpha = (frame_idx - k1) / float(k2 - k1)
            b1, b2 = keyframes[k1], keyframes[k2]
            return [b1[j] + alpha * (b2[j] - b1[j]) for j in range(4)]
    return keyframes[sorted_keys[0]]


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def process_equine_video(video_path: str, model_path: str, out_json: str, out_mp4: str | None = None):
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video not found: {video_path}")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model not found: {model_path}")

    actual_hash = sha256_file(model_path)
    stem = os.path.splitext(os.path.basename(video_path))[0]

    session = ort.InferenceSession(model_path)

    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    keyframes = KEYFRAMED_BBOXES.get(stem)
    if not keyframes:
        # Default centered bounding box fallback
        keyframes = {
            0: [int(width * 0.25), int(height * 0.25), int(width * 0.75), int(height * 0.85)],
            total_frames - 1: [int(width * 0.25), int(height * 0.25), int(width * 0.75), int(height * 0.85)]
        }

    # Mean and Std from pipeline.json
    mean = np.array([123.675, 116.28, 103.53], dtype=np.float32)
    std = np.array([58.395, 57.12, 57.375], dtype=np.float32)

    all_frames_data = []
    keypoint_scores_collector = {name: [] for name in AP10K_KEYPOINTS}

    tmp_avi = None
    writer = None
    if out_mp4:
        tmp_avi = tempfile.mktemp(suffix=".avi")
        fourcc = cv2.VideoWriter_fourcc(*"MJPG")
        writer = cv2.VideoWriter(tmp_avi, fourcc, fps, (width, height))

    frame_idx = 0
    while True:
        ret, frame_bgr = cap.read()
        if not ret:
            break

        t_ms = int(round(frame_idx * (1000.0 / fps)))
        bbox = interpolate_bbox(keyframes, frame_idx)

        # 1. Pad bounding box by 1.25 and keep square by padding
        cx = (bbox[0] + bbox[2]) / 2.0
        cy = (bbox[1] + bbox[3]) / 2.0
        bw = bbox[2] - bbox[0]
        bh = bbox[3] - bbox[1]
        side = max(bw, bh) * 1.25

        src = np.array([
            [cx - side / 2.0, cy - side / 2.0],
            [cx + side / 2.0, cy - side / 2.0],
            [cx - side / 2.0, cy + side / 2.0]
        ], dtype=np.float32)
        dst = np.array([[0, 0], [256, 0], [0, 256]], dtype=np.float32)

        M = cv2.getAffineTransform(src, dst)
        M_inv = cv2.invertAffineTransform(M)

        crop = cv2.warpAffine(frame_bgr, M, (256, 256), flags=cv2.INTER_LINEAR)
        rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB).astype(np.float32)
        norm = (rgb - mean) / std
        tensor = norm.transpose(2, 0, 1)[None, ...]

        # 2. Run ONNX Inference
        out_x, out_y = session.run(None, {"input": tensor})

        # 3. Decode SimCC (split ratio 2) & compute raw logit scores
        frame_kpts = []
        pts_dict = {}

        for k in range(17):
            name = AP10K_KEYPOINTS[k]
            argmax_x = np.argmax(out_x[0, k, :])
            argmax_y = np.argmax(out_y[0, k, :])
            score_x = float(np.max(out_x[0, k, :]))
            score_y = float(np.max(out_y[0, k, :]))
            score_raw = min(score_x, score_y) # Raw logit score without sigmoid

            keypoint_scores_collector[name].append(score_raw)

            # Map back via inverse affine transform
            x_crop = argmax_x / 2.0
            y_crop = argmax_y / 2.0
            pt_orig = M_inv @ np.array([x_crop, y_crop, 1.0])

            px = round(float(pt_orig[0]), 2)
            py = round(float(pt_orig[1]), 2)

            frame_kpts.append({
                "name": name,
                "x": px,
                "y": py,
                "score_raw": round(score_raw, 4)
            })

            if score_raw >= DRAWING_THRESHOLD:
                pts_dict[k] = (int(round(px)), int(round(py)), score_raw)

        all_frames_data.append({
            "t_ms": t_ms,
            "keypoints": frame_kpts
        })

        # 4. Render skeleton on frame (NO text, antialiased primitives)
        if writer is not None:
            rendered = frame_bgr.copy()
            # Draw bones
            for u, v in AP10K_BONES:
                if u in pts_dict and v in pts_dict:
                    pt1 = (pts_dict[u][0], pts_dict[u][1])
                    pt2 = (pts_dict[v][0], pts_dict[v][1])
                    cv2.line(rendered, pt1, pt2, COLOR_BONE, thickness=2, lineType=cv2.LINE_AA)

            # Draw joints
            for k_idx, (px, py, score) in pts_dict.items():
                center = (px, py)
                if k_idx in (3, 4): # Neck or tail_root
                    cv2.circle(rendered, center, 4, COLOR_AXIAL, thickness=-1, lineType=cv2.LINE_AA)
                    cv2.circle(rendered, center, 6, COLOR_AXIAL, thickness=1, lineType=cv2.LINE_AA)
                else:
                    cv2.circle(rendered, center, 3, COLOR_JOINT, thickness=-1, lineType=cv2.LINE_AA)

            writer.write(rendered)

        frame_idx += 1

    cap.release()
    if writer is not None:
        writer.release()

    # 5. Compute Score Distribution per Keypoint
    score_distribution = {}
    for name, scores in keypoint_scores_collector.items():
        if scores:
            score_distribution[name] = {
                "min": round(float(np.min(scores)), 4),
                "max": round(float(np.max(scores)), 4),
                "mean": round(float(np.mean(scores)), 4),
                "median": round(float(np.median(scores)), 4),
                "pct_above_threshold": round(float(np.mean([s >= DRAWING_THRESHOLD for s in scores]) * 100.0), 1)
            }

    # 6. Save JSON
    output_json = {
        "id": stem,
        "model": os.path.basename(model_path),
        "model_url": MODEL_URL,
        "model_sha256": actual_hash,
        "mmpose_origin": MMPOSE_ORIGIN,
        "bbox_source": "linear_interpolation_keyframed_annotations",
        "keypoint_convention": "AP-10K 17 keypoints",
        "keypoint_names": AP10K_KEYPOINTS,
        "unguligrade_anatomical_note": "According to AP-10K definition: for unguligrades, 'hip' denotes the knee (stifle) and 'knee' the ankle (hock). None of these points correspond to withers or tuber sacrale.",
        "drawing_threshold": DRAWING_THRESHOLD,
        "width": width,
        "height": height,
        "fps": round(fps, 2),
        "total_frames": frame_idx,
        "score_distribution": score_distribution,
        "frames": all_frames_data
    }

    os.makedirs(os.path.dirname(os.path.abspath(out_json)), exist_ok=True)
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(output_json, f, indent=2)

    print(f"Extracted {frame_idx} frames to {out_json}")
    for name in ["neck", "tail_root", "left_eye", "nose", "left_front_paw", "left_back_paw"]:
        d = score_distribution[name]
        print(f"  {name:15s}: mean score_raw={d['mean']:.3f}, >=0.5: {d['pct_above_threshold']}%")

    # 7. Transcode MP4 with FFmpeg (< 3 MB target, BT.709)
    if out_mp4 and tmp_avi:
        os.makedirs(os.path.dirname(os.path.abspath(out_mp4)), exist_ok=True)
        ffmpeg_cmd = [
            "ffmpeg", "-y",
            "-i", tmp_avi,
            "-c:v", "libx264",
            "-crf", "22",
            "-preset", "fast",
            "-pix_fmt", "yuv420p",
            "-color_primaries", "bt709",
            "-color_trc", "bt709",
            "-colorspace", "bt709",
            "-movflags", "+faststart",
            out_mp4
        ]
        proc = subprocess.run(ffmpeg_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if os.path.exists(tmp_avi):
            os.remove(tmp_avi)

        if proc.returncode != 0:
            raise RuntimeError(f"FFmpeg failed with exit code {proc.returncode}:\n{proc.stderr}")

        size_mb = os.path.getsize(out_mp4) / (1024 * 1024)
        print(f"Rendered {out_mp4} ({size_mb:.2f} MB)")


def main():
    parser = argparse.ArgumentParser(description="Extract equine pose keypoints and render preview.")
    parser.add_argument("--video", required=True, help="Input video MP4 path.")
    parser.add_argument("--model", default="/tmp/rtmpose-m_ap10k_256.onnx", help="Path to RTMPose AP-10K ONNX model.")
    parser.add_argument("--out-json", required=True, help="Output JSON path.")
    parser.add_argument("--out-mp4", default=None, help="Optional output MP4 preview path.")
    args = parser.parse_args()

    process_equine_video(args.video, args.model, args.out_json, args.out_mp4)


if __name__ == "__main__":
    main()
