#!/usr/bin/env python3
"""
scripts/benchmarks/build_uiprmd_sets.py

Reconstructs standardized MediaPipe 33-landmark sets from UI-PRMD
(University of Idaho Physical Rehabilitation Movement Dataset, ODC-PDDL v1.0).

Forward kinematics converts joint positions and Euler angle rotations (22 joints)
into 3D Cartesian space, mapped to MediaPipe indices (shoulders, elbows, wrists, hips, knees, ankles).
All other 21 MediaPipe landmarks set to visibility 0.0.

Saves gzipped records to data/benchmarks/ui-prmd/sets/
Writes manifest to data/benchmarks/ui-prmd/manifest.json
"""

import os
import sys
import math
import json
import gzip
import numpy as np
from datetime import datetime, timezone

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
RAW_DATA_DIR = os.path.expanduser("~/wv-tools/ui-prmd")
OUTPUT_DIR = os.path.join(REPO_ROOT, "data/benchmarks/ui-prmd/sets")
MANIFEST_PATH = os.path.join(REPO_ROOT, "data/benchmarks/ui-prmd/manifest.json")

# Rotation matrices for forward kinematics
def rotx(t):
    ct, st = math.cos(t), math.sin(t)
    return np.array([[1, 0, 0], [0, ct, -st], [0, st, ct]])

def roty(t):
    ct, st = math.cos(t), math.sin(t)
    return np.array([[ct, 0, st], [0, 1, 0], [-st, 0, ct]])

def rotz(t):
    ct, st = math.cos(t), math.sin(t)
    return np.array([[ct, -st, 0], [st, ct, 0], [0, 0, 1]])

def e2r(x):
    return rotz(x[2]).dot(roty(x[1])).dot(rotx(x[0]))

# 22-joint kinematic skeleton mapped to MediaPipe 33 landmarks
UI_PRMD_TO_MEDIAPIPE = {
    7: 11,   # L Shoulder
    8: 13,   # L Elbow
    9: 15,   # L Wrist
    11: 12,  # R Shoulder
    12: 14,  # R Elbow
    13: 16,  # R Wrist
    14: 23,  # L Hip
    15: 25,  # L Knee
    16: 27,  # L Ankle
    18: 24,  # R Hip
    19: 26,  # R Knee
    20: 28,  # R Ankle
}

MOVEMENT_MAP = {
    "m01": {"exercise": "squat", "name": "Deep Squat", "true_count": 1},
    "m03": {"exercise": "lunge", "name": "Inline Lunge", "true_count": 1},
    "m05": {"exercise": "chair_stand_test", "name": "Sit to Stand", "true_count": 1},
    "m07": {"exercise": "lateral_raise", "name": "Standing Shoulder Abduction", "true_count": 1},
    "m10": {"exercise": "leg_extension", "name": "Seated Knee Extension", "true_count": 1},
}

SKIPPED_MOVEMENTS = {
    "m02": {"name": "Hurdle Step", "reason": "No matching catalogue exercise"},
    "m04": {"name": "Side Lunge", "reason": "No matching catalogue exercise"},
    "m06": {"name": "Standing Active Back Extension", "reason": "No matching catalogue exercise"},
    "m08": {"name": "Standing Shoulder Internal/External Rotation", "reason": "No matching catalogue exercise"},
    "m09": {"name": "Trunk Rotation", "reason": "No matching catalogue exercise"},
}

def process_file_pair(m_code: str):
    pos_file = os.path.join(RAW_DATA_DIR, f"{m_code}_s01_e01_positions.txt")
    ang_file = os.path.join(RAW_DATA_DIR, f"{m_code}_s01_e01_angles.txt")

    if not os.path.exists(pos_file) or not os.path.exists(ang_file):
        return None

    with open(pos_file, "r") as pf:
        pos_lines = [l.strip() for l in pf if l.strip()]
    with open(ang_file, "r") as af:
        ang_lines = [l.strip() for l in af if l.strip()]

    frames = len(pos_lines)
    readpos = np.array([[float(x) for x in l.split(",")] for l in pos_lines])
    readang = np.array([[float(x) for x in l.split(",")] for l in ang_lines])

    tp = np.transpose(readpos)
    ta = np.transpose(readang)

    world_landmarks = []
    # UI-PRMD Kinect frame rate = 30 fps
    timestamps = [round(i / 30.0, 4) for i in range(frames)]

    for i in range(frames):
        joint_pos = tp[:, i].reshape((22, 3)).copy()
        joint_ang = ta[:, i].reshape((22, 3)).copy()

        # Forward Kinematics (pelvis -> spine -> arms & legs)
        rot_1 = e2r(joint_ang[0, :].dot(np.pi / 180))
        joint_pos[1, :] = np.transpose(rot_1.dot(np.transpose(joint_pos[1, :]))) + joint_pos[0, :]
        rot_2 = rot_1.dot(e2r(joint_ang[1, :].dot(np.pi / 180)))
        joint_pos[2, :] = (np.transpose(rot_2.dot(np.transpose(joint_pos[2, :])))) + joint_pos[1, :]
        rot_3 = rot_2.dot(e2r(joint_ang[2, :].dot(np.pi / 180)))
        joint_pos[3, :] = (np.transpose(rot_3.dot(np.transpose(joint_pos[3, :])))) + joint_pos[2, :]
        rot_4 = rot_3.dot(e2r(joint_ang[3, :].dot(np.pi / 180)))
        joint_pos[4, :] = (np.transpose(rot_4.dot(np.transpose(joint_pos[4, :])))) + joint_pos[3, :]
        rot_5 = rot_4.dot(e2r(joint_ang[4, :].dot(np.pi / 180)))
        joint_pos[5, :] = (np.transpose(rot_5.dot(np.transpose(joint_pos[5, :])))) + joint_pos[4, :]

        # left arm
        rot_6 = e2r(joint_ang[2, :].dot(np.pi / 180))
        joint_pos[6, :] = (np.transpose(rot_6.dot(np.transpose(joint_pos[6, :])))) + joint_pos[2, :]
        rot_7 = rot_6.dot(e2r(joint_ang[6, :].dot(np.pi / 180)))
        joint_pos[7, :] = (np.transpose(rot_7.dot(np.transpose(joint_pos[7, :])))) + joint_pos[6, :]
        rot_8 = rot_7.dot(e2r(joint_ang[7, :].dot(np.pi / 180)))
        joint_pos[8, :] = (np.transpose(rot_8.dot(np.transpose(joint_pos[8, :])))) + joint_pos[7, :]
        rot_9 = rot_8.dot(e2r(joint_ang[8, :].dot(np.pi / 180)))
        joint_pos[9, :] = (np.transpose(rot_9.dot(np.transpose(joint_pos[9, :])))) + joint_pos[8, :]

        # right arm
        rot_10 = e2r(joint_ang[2, :].dot(np.pi / 180))
        joint_pos[10, :] = (np.transpose(rot_10.dot(np.transpose(joint_pos[10, :])))) + joint_pos[2, :]
        rot_11 = rot_10.dot(e2r(joint_ang[10, :].dot(np.pi / 180)))
        joint_pos[11, :] = (np.transpose(rot_11.dot(np.transpose(joint_pos[11, :])))) + joint_pos[10, :]
        rot_12 = rot_11.dot(e2r(joint_ang[11, :].dot(np.pi / 180)))
        joint_pos[12, :] = (np.transpose(rot_12.dot(np.transpose(joint_pos[12, :])))) + joint_pos[11, :]
        rot_13 = rot_12.dot(e2r(joint_ang[12, :].dot(np.pi / 180)))
        joint_pos[13, :] = (np.transpose(rot_13.dot(np.transpose(joint_pos[13, :])))) + joint_pos[12, :]

        # left leg
        rot_14 = e2r(joint_ang[0, :].dot(np.pi / 180))
        joint_pos[14, :] = (np.transpose(rot_14.dot(np.transpose(joint_pos[14, :])))) + joint_pos[0, :]
        rot_15 = rot_14.dot(e2r(joint_ang[14, :].dot(np.pi / 180)))
        joint_pos[15, :] = (np.transpose(rot_15.dot(np.transpose(joint_pos[15, :])))) + joint_pos[14, :]
        rot_16 = rot_15.dot(e2r(joint_ang[15, :].dot(np.pi / 180)))
        joint_pos[16, :] = (np.transpose(rot_16.dot(np.transpose(joint_pos[16, :])))) + joint_pos[15, :]
        rot_17 = rot_16.dot(e2r(joint_ang[16, :].dot(np.pi / 180)))
        joint_pos[17, :] = (np.transpose(rot_17.dot(np.transpose(joint_pos[17, :])))) + joint_pos[16, :]

        # right leg
        rot_18 = e2r(joint_ang[0, :].dot(np.pi / 180))
        joint_pos[18, :] = (np.transpose(rot_18.dot(np.transpose(joint_pos[18, :])))) + joint_pos[0, :]
        rot_19 = rot_18.dot(e2r(joint_ang[18, :].dot(np.pi / 180)))
        joint_pos[19, :] = (np.transpose(rot_19.dot(np.transpose(joint_pos[19, :])))) + joint_pos[18, :]
        rot_20 = rot_19.dot(e2r(joint_ang[19, :].dot(np.pi / 180)))
        joint_pos[20, :] = (np.transpose(rot_20.dot(np.transpose(joint_pos[20, :])))) + joint_pos[19, :]
        rot_21 = rot_20.dot(e2r(joint_ang[20, :].dot(np.pi / 180)))
        joint_pos[21, :] = (np.transpose(rot_21.dot(np.transpose(joint_pos[21, :])))) + joint_pos[20, :]

        frame_lm = [{"x": 0.0, "y": 0.0, "z": 0.0, "visibility": 0.0} for _ in range(33)]
        for u_idx, mp_idx in UI_PRMD_TO_MEDIAPIPE.items():
            frame_lm[mp_idx] = {
                "x": float(joint_pos[u_idx, 0]) / 100.0, # convert cm to m
                "y": float(joint_pos[u_idx, 1]) / 100.0,
                "z": float(joint_pos[u_idx, 2]) / 100.0,
                "visibility": 1.0
            }
        world_landmarks.append(frame_lm)

    return {
        "worldLandmarks": world_landmarks,
        "timestamps": timestamps,
        "frames": frames,
        "duration": timestamps[-1] - timestamps[0]
    }

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    manifest_sets = []
    total_bytes = 0

    print("Building UI-PRMD landmark sets...")

    for m_code, m_info in sorted(MOVEMENT_MAP.items()):
        rec = process_file_pair(m_code)
        if not rec:
            print(f"Skipping {m_code}: source files missing")
            continue

        set_id = f"uiprmd_{m_code}_{m_info['exercise']}"
        record = {
            "metadata": {
                "id": set_id,
                "dataset": "UI-PRMD",
                "movementCode": m_code,
                "movementName": m_info["name"],
                "exercise": m_info["exercise"],
                "trueCount": m_info["true_count"],
                "sampleCount": rec["frames"],
                "duration": round(rec["duration"], 4)
            },
            "timestamps": rec["timestamps"],
            "worldLandmarks": rec["worldLandmarks"]
        }

        filename = f"{set_id}.json.gz"
        filepath = os.path.join(OUTPUT_DIR, filename)

        raw = json.dumps(record, separators=(",", ":")).encode("utf-8")
        compressed = gzip.compress(raw)
        with open(filepath, "wb") as f:
            f.write(compressed)

        total_bytes += len(compressed)

        manifest_sets.append({
            "id": set_id,
            "movementCode": m_code,
            "movementName": m_info["name"],
            "exercise": m_info["exercise"],
            "trueCount": m_info["true_count"],
            "samples": rec["frames"],
            "durationSec": round(rec["duration"], 3),
            "file": f"sets/{filename}",
            "fileSizeBytes": len(compressed),
            "sourceFiles": [f"{m_code}_s01_e01_positions.txt", f"{m_code}_s01_e01_angles.txt"]
        })
        print(f"  {set_id}: {rec['frames']} samples, {len(compressed)} bytes gzipped")

    manifest = {
        "dataset": "UI-PRMD",
        "description": "University of Idaho Physical Rehabilitation Movement Dataset",
        "citation": "Vakanski, A., et al. (2018). MDPI Data, 3(2), 17.",
        "license": "ODC-PDDL v1.0",
        "commercialUse": "Permitted",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "totalSets": len(manifest_sets),
        "totalSizeBytes": total_bytes,
        "mappedExercises": MOVEMENT_MAP,
        "skippedMovements": SKIPPED_MOVEMENTS,
        "skeletonMapping": UI_PRMD_TO_MEDIAPIPE,
        "sets": manifest_sets
    }

    with open(MANIFEST_PATH, "w", encoding="utf-8") as mf:
        json.dump(manifest, mf, indent=2)

    print(f"UI-PRMD manifest written to {MANIFEST_PATH}")

if __name__ == "__main__":
    main()
