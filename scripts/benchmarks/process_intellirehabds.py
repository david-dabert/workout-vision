#!/usr/bin/env python3
"""
IntelliRehabDS Benchmark Manifest Generator

Parses IntelliRehabDS (IRDS) skeleton files from Zenodo (DOI: 10.5281/zenodo.4610859)
and builds a standardized repetition-level benchmark manifest for WorkoutVision.

License: CC BY 4.0
"""

import os
import sys
import json
import zipfile
from pathlib import Path

GESTURE_MAP = {
    0: {"code": "EFL", "name": "Elbow Flexion Left", "body_region": "Elbow", "plane": "Sagittal"},
    1: {"code": "EFR", "name": "Elbow Flexion Right", "body_region": "Elbow", "plane": "Sagittal"},
    2: {"code": "SFL", "name": "Shoulder Flexion Left", "body_region": "Shoulder", "plane": "Sagittal"},
    3: {"code": "SFR", "name": "Shoulder Flexion Right", "body_region": "Shoulder", "plane": "Sagittal"},
    4: {"code": "SAL", "name": "Shoulder Abduction Left", "body_region": "Shoulder", "plane": "Frontal"},
    5: {"code": "SAR", "name": "Shoulder Abduction Right", "body_region": "Shoulder", "plane": "Frontal"},
    6: {"code": "SFE", "name": "Shoulder Forward Elevation", "body_region": "Shoulder", "plane": "Scapular"},
    7: {"code": "STL", "name": "Side Tap Left", "body_region": "Hip/Leg", "plane": "Frontal"},
    8: {"code": "STR", "name": "Side Tap Right", "body_region": "Hip/Leg", "plane": "Frontal"},
}

def parse_ird_filename(filename: str):
    """
    Parses SubjectID_DateID_GestureLabel_RepetitionNumber_CorrectLabel_Position.txt
    """
    stem = Path(filename).stem
    parts = stem.split("_")
    if len(parts) < 6:
        return None
    try:
        subject_id = int(parts[0])
        date_id = parts[1]
        gesture_id = int(parts[2])
        rep_num = int(parts[3])
        correct_label = int(parts[4]) # 1 = correct, 2 = incorrect
        position = parts[5].lower() # standing / sitting
        return {
            "subject_id": subject_id,
            "date_id": date_id,
            "gesture_id": gesture_id,
            "repetition_number": rep_num,
            "correct_label": correct_label,
            "is_correct": correct_label == 1,
            "position": position,
            "file": filename
        }
    except ValueError:
        return None

def analyze_raw_repetition(lines):
    """
    Analyzes timestamps and frame count from lines of a RawData / Simplified file.
    Raw format: frame_nr, body_id, timestamp_sec, ...
    """
    timestamps = []
    frame_numbers = []
    for line in lines:
        if isinstance(line, bytes):
            line = line.decode('utf-8', errors='ignore')
        line = line.strip()
        if not line or "Version" in line:
            continue
        tokens = line.split(",")
        if len(tokens) >= 3:
            try:
                fn = int(tokens[0])
                ts = float(tokens[2])
                frame_numbers.append(fn)
                timestamps.append(ts)
            except ValueError:
                continue
    
    if not timestamps:
        return None
    
    start_ts = timestamps[0]
    end_ts = timestamps[-1]
    duration_s = max(0.0, end_ts - start_ts)
    
    # Peak estimation: kinematic apex is roughly at the midpoint of the movement arc
    midpoint_idx = len(timestamps) // 2
    peak_ts = timestamps[midpoint_idx] if midpoint_idx < len(timestamps) else (start_ts + end_ts) / 2.0
    
    start_ms = 0
    duration_ms = int(duration_s * 1000)
    peak_ms = int((peak_ts - start_ts) * 1000)
    end_ms = duration_ms
    
    return {
        "frames": len(frame_numbers),
        "start_ms": start_ms,
        "peak_ms": peak_ms,
        "end_ms": end_ms,
        "duration_ms": duration_ms,
        "fps_est": round(len(frame_numbers) / max(0.1, duration_s), 2)
    }

def build_manifest(zip_path: str, output_manifest_path: str):
    print(f"Opening {zip_path}...")
    manifest_records = []
    exercise_summary = {g["code"]: {"total_reps": 0, "correct_reps": 0, "incorrect_reps": 0} for g in GESTURE_MAP.values()}
    subjects_set = set()

    with zipfile.ZipFile(zip_path, 'r') as z:
        namelist = z.namelist()
        print(f"Total entries in zip: {len(namelist)}")
        
        # Filter for RawData or Simplified text files
        target_files = [f for f in namelist if f.endswith(".txt") and ("RawData" in f or "Simplified" in f or not "/" in f)]
        if not target_files:
            target_files = [f for f in namelist if f.endswith(".txt")]
        
        print(f"Found {len(target_files)} candidate repetition files.")
        
        # Prefer RawData over Simplified if both exist to parse accurate timestamps
        raw_files = [f for f in target_files if "RawData" in f]
        chosen_files = raw_files if raw_files else target_files

        for idx, file_entry in enumerate(chosen_files):
            meta = parse_ird_filename(file_entry)
            if not meta:
                continue
            
            gesture_info = GESTURE_MAP.get(meta["gesture_id"])
            if not gesture_info:
                continue
            
            subjects_set.add(meta["subject_id"])
            code = gesture_info["code"]
            exercise_summary[code]["total_reps"] += 1
            if meta["is_correct"]:
                exercise_summary[code]["correct_reps"] += 1
            else:
                exercise_summary[code]["incorrect_reps"] += 1

            # Read first and last lines for timestamp analysis
            with z.open(file_entry) as f:
                lines = f.readlines()
            
            timing = analyze_raw_repetition(lines)
            if not timing:
                continue

            record = {
                "id": f"ird_s{meta['subject_id']:02d}_{code}_{meta['repetition_number']:02d}",
                "file": file_entry,
                "exercise_code": code,
                "exercise_name": gesture_info["name"],
                "body_region": gesture_info["body_region"],
                "subject_id": meta["subject_id"],
                "repetition_number": meta["repetition_number"],
                "is_correct": meta["is_correct"],
                "correct_label": meta["correct_label"],
                "position": meta["position"],
                "frames": timing["frames"],
                "start_ms": timing["start_ms"],
                "peak_ms": timing["peak_ms"],
                "end_ms": timing["end_ms"],
                "duration_ms": timing["duration_ms"],
                "fps_est": timing["fps_est"]
            }
            manifest_records.append(record)

    manifest = {
        "dataset": "IntelliRehabDS",
        "description": "Standardized benchmark manifest for physical rehabilitation repetition counting and form verification.",
        "version": "1.0.0",
        "license": "Creative Commons Attribution 4.0 International (CC BY 4.0)",
        "source": "Zenodo (DOI: 10.5281/zenodo.4610859)",
        "citation": "Miron, A., Sadawi, N., Ismail, W., Hussain, H., & Grosan, C. (2021). IntelliRehabDS (IRDS)—A Dataset of Physical Rehabilitation Movements. Data, 6(5), 46.",
        "subjects_count": len(subjects_set),
        "total_records": len(manifest_records),
        "exercises": [
            {
                "id": gid,
                "code": g["code"],
                "name": g["name"],
                "body_region": g["body_region"],
                "plane": g["plane"],
                "stats": exercise_summary[g["code"]]
            }
            for gid, g in GESTURE_MAP.items()
        ],
        "records": manifest_records
    }

    os.makedirs(os.path.dirname(output_manifest_path), exist_ok=True)
    with open(output_manifest_path, "w", encoding="utf-8") as out_f:
        json.dump(manifest, out_f, indent=2)
    
    print(f"Successfully generated {output_manifest_path} with {len(manifest_records)} records across {len(subjects_set)} subjects.")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: process_intellirehabds.py <path_to_SkeletonData.zip> <output_manifest.json>")
        sys.exit(1)
    build_manifest(sys.argv[1], sys.argv[2])
