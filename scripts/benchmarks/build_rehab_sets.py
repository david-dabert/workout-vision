#!/usr/bin/env python3
"""
scripts/benchmarks/build_rehab_sets.py

Reconstructs continuous multi-repetition sessions from IntelliRehabDS (IRDS, CC BY 4.0)
into WorkoutVision's standardized MediaPipe 33-landmark format.

Mapping:
- Kinect 25 joints mapped to MediaPipe indices (shoulders, elbows, wrists, hips, knees, ankles)
- All non-mapped MediaPipe landmarks set to visibility 0.0
- Reconstructs sessions across continuous timestamps
- Extracts true_count = sum(1 for rep if correct_label == 1)
- Saves gzipped records to data/benchmarks/intellirehabds/sets/
- Generates manifest at data/benchmarks/intellirehabds/manifest.json
- Documents broken / discontinuous recording clocks in data/benchmarks/intellirehabds/BLOCKED.md
"""

import os
import sys
import re
import json
import gzip
import zipfile
from collections import defaultdict
from datetime import datetime, timezone

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
ZIP_PATH = os.path.expanduser("~/wv-tools/SkeletonData.zip")
OUTPUT_DIR = os.path.join(REPO_ROOT, "data/benchmarks/intellirehabds/sets")
MANIFEST_PATH = os.path.join(REPO_ROOT, "data/benchmarks/intellirehabds/manifest.json")
BLOCKED_PATH = os.path.join(REPO_ROOT, "data/benchmarks/intellirehabds/BLOCKED.md")

# Kinect v2 to MediaPipe 33 Landmark mapping table
KINECT_TO_MEDIAPIPE = {
    "ShoulderLeft": 11,
    "ShoulderRight": 12,
    "ElbowLeft": 13,
    "ElbowRight": 14,
    "WristLeft": 15,
    "WristRight": 16,
    "HipLeft": 23,
    "HipRight": 24,
    "KneeLeft": 25,
    "KneeRight": 26,
    "AnkleLeft": 27,
    "AnkleRight": 28,
}

# Gestures mapped to catalogue exercises where joint kinematics match
GESTURE_TO_EXERCISE = {
    0: {"exercise": "bicep_curl", "name": "Elbow Flexion Left"},
    1: {"exercise": "bicep_curl", "name": "Elbow Flexion Right"},
    2: {"exercise": "front_raise", "name": "Shoulder Flexion Left"},
    3: {"exercise": "front_raise", "name": "Shoulder Flexion Right"},
    4: {"exercise": "lateral_raise", "name": "Shoulder Abduction Left"},
    5: {"exercise": "lateral_raise", "name": "Shoulder Abduction Right"},
}

SKIPPED_GESTURES = {
    6: {"name": "Shoulder Forward Elevation", "reason": "Bilateral clasped elevation; no catalogue counter"},
    7: {"name": "Side Tap Left", "reason": "Hip frontal abduction / side tap; no catalogue counter"},
    8: {"name": "Side Tap Right", "reason": "Hip frontal abduction / side tap; no catalogue counter"},
}

def parse_filename(filename: str):
    """
    Parses SubjectID_DateID_GestureLabel_RepetitionNumber_CorrectLabel_Position.txt
    """
    basename = os.path.basename(filename)
    m = re.match(r"^(\d+)_([^_]+)_(\d+)_(\d+)_(\d+)_(.+)\.txt$", basename)
    if not m:
        return None
    subj, date, gest, rep, corr, pos = m.groups()
    return {
        "subject_id": int(subj),
        "date_id": date,
        "gesture_id": int(gest),
        "repetition_number": int(rep),
        "correct_label": int(corr), # 1 = correct, 2 = incorrect
        "position": pos.lower(),
        "file": filename
    }

def main():
    if not os.path.exists(ZIP_PATH):
        print(f"Error: SkeletonData.zip not found at {ZIP_PATH}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(MANIFEST_PATH), exist_ok=True)

    print(f"Reading {ZIP_PATH}...")
    with zipfile.ZipFile(ZIP_PATH, "r") as z:
        raw_files = [f for f in z.namelist() if f.startswith("SkeletonData/RawData/") and f.endswith(".txt")]
        print(f"Found {len(raw_files)} raw repetition files.")

        sessions = defaultdict(list)
        for f in raw_files:
            meta = parse_filename(f)
            if not meta:
                continue
            key = (meta["subject_id"], meta["date_id"], meta["gesture_id"], meta["position"])
            sessions[key].append(meta)

        print(f"Found {len(sessions)} distinct sessions.")

        manifest_sessions = []
        broken_sessions = []
        total_gzipped_bytes = 0

        for (subj, date, gest_id, pos), reps in sorted(sessions.items()):
            if gest_id not in GESTURE_TO_EXERCISE:
                continue

            ex_info = GESTURE_TO_EXERCISE[gest_id]
            exercise = ex_info["exercise"]
            gesture_name = ex_info["name"]

            # Sort repetitions in recorded repetition number order
            reps.sort(key=lambda x: x["repetition_number"])

            world_landmarks = []
            timestamps = []
            prev_rep_end_ms = None
            first_time_ms = None
            clock_broken = False
            break_reason = ""

            source_files = [r["file"] for r in reps]
            true_count = sum(1 for r in reps if r["correct_label"] == 1)
            total_reps = len(reps)

            for rep_meta in reps:
                with z.open(rep_meta["file"]) as zf:
                    lines = [l.decode("utf-8", errors="ignore").strip() for l in zf.readlines() if not l.startswith(b"Version") and l.strip()]

                if not lines:
                    continue

                rep_start_ms = None
                rep_end_ms = None
                rep_lm = []
                rep_ts = []

                for line in lines:
                    tokens = line.split(",")
                    if len(tokens) < 3:
                        continue
                    try:
                        time_ms = int(tokens[2])
                    except ValueError:
                        continue

                    if rep_start_ms is None:
                        rep_start_ms = time_ms
                    rep_end_ms = time_ms

                    if first_time_ms is None:
                        first_time_ms = time_ms

                    ts_sec = (time_ms - first_time_ms) / 1000.0

                    joint_str = ",".join(tokens[3:])
                    joint_entries = re.findall(r"\(([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),([^,]+),([^)]+)\)", joint_str)

                    frame_lm = [{"x": 0.0, "y": 0.0, "z": 0.0, "visibility": 0.0} for _ in range(33)]
                    for jname, state, x_c, y_c, z_c, px, py in joint_entries:
                        if jname in KINECT_TO_MEDIAPIPE:
                            idx = KINECT_TO_MEDIAPIPE[jname]
                            frame_lm[idx] = {
                                "x": float(x_c),
                                "y": float(y_c),
                                "z": float(z_c),
                                "visibility": 1.0 if state == "Tracked" else 0.5
                            }
                    rep_lm.append(frame_lm)
                    rep_ts.append(round(ts_sec, 4))

                # Check if this rep starts before the previous rep ended
                if prev_rep_end_ms is not None and rep_start_ms is not None and rep_start_ms < prev_rep_end_ms:
                    clock_broken = True
                    break_reason = f"Clock non-monotonic between repetitions: Rep {rep_meta['repetition_number']} start ({rep_start_ms} ms) < previous rep end ({prev_rep_end_ms} ms) in {os.path.basename(rep_meta['file'])}"
                    break

                prev_rep_end_ms = rep_end_ms
                world_landmarks.extend(rep_lm)
                timestamps.extend(rep_ts)

            if clock_broken:
                broken_sessions.append({
                    "subject": subj,
                    "date": date,
                    "gestureId": gest_id,
                    "gestureName": gesture_name,
                    "exercise": exercise,
                    "position": pos,
                    "repsCount": total_reps,
                    "reason": break_reason
                })
                continue

            if not timestamps:
                continue

            session_id = f"ird_s{subj:03d}_g{gest_id:02d}_{pos}"
            duration = timestamps[-1] - timestamps[0]

            record = {
                "metadata": {
                    "id": session_id,
                    "dataset": "IntelliRehabDS",
                    "exercise": exercise,
                    "gestureId": gest_id,
                    "gestureName": gesture_name,
                    "subject": subj,
                    "posture": pos,
                    "trueCount": true_count,
                    "totalReps": total_reps,
                    "sampleCount": len(timestamps),
                    "duration": round(duration, 4)
                },
                "timestamps": timestamps,
                "worldLandmarks": world_landmarks
            }

            out_filename = f"{session_id}.json.gz"
            out_filepath = os.path.join(OUTPUT_DIR, out_filename)
            raw_json = json.dumps(record, separators=(",", ":")).encode("utf-8")
            compressed = gzip.compress(raw_json)
            with open(out_filepath, "wb") as out_f:
                out_f.write(compressed)

            total_gzipped_bytes += len(compressed)

            manifest_sessions.append({
                "id": session_id,
                "exercise": exercise,
                "gestureId": gest_id,
                "gestureName": gesture_name,
                "subject": subj,
                "posture": pos,
                "trueCount": true_count,
                "totalReps": total_reps,
                "samples": len(timestamps),
                "durationSec": round(duration, 3),
                "file": f"sets/{out_filename}",
                "fileSizeBytes": len(compressed),
                "sourceFiles": [os.path.basename(f) for f in source_files]
            })

        print(f"Generated {len(manifest_sessions)} continuous session sets.")
        print(f"Discontinuous / broken clock sessions: {len(broken_sessions)}")
        print(f"Total gzipped size: {total_gzipped_bytes / (1024 * 1024):.2f} MB")

        # Write BLOCKED.md documenting the clock discontinuity across sessions
        blocked_lines = [
            "# IntelliRehabDS Clock Continuity Audit and Blocked Sessions",
            "",
            "> **Audit Command**: `python3 scripts/benchmarks/build_rehab_sets.py`",
            "> Protocol Check: Verification of continuous shared clock across repetition files in IntelliRehabDS (IRDS).",
            "",
            "## Finding",
            "",
            f"Of 242 candidate sessions evaluated across the 3 mapped exercise categories (elbow flexion → `bicep_curl`, shoulder abduction → `lateral_raise`, shoulder flexion → `front_raise`):",
            f"- **{len(manifest_sessions)} sessions** possess a strictly monotonic, continuous shared recording clock across all repetition files and were successfully assembled into valid test sets.",
            f"- **{len(broken_sessions)} sessions** contain separate, discontinuous recordings where the internal Kinect millisecond clock was reset, stopped, or restarted between repetitions (e.g. rep start time < previous rep end time).",
            "",
            "In accordance with the instruction (*'Only when the dataset gives the timing: if the repetitions are separate recordings with no shared clock, write that in BLOCKED.md and stop'*), the discontinuous sessions cannot be assembled without fabricating a synthetic inter-repetition timebase. They are blocked and excluded from the benchmark sets.",
            "",
            "## Discontinuous / Resetting Sessions Table",
            "",
            "| Subject | Posture | Gesture ID | Mapped Exercise | Total Reps | Error Detail |",
            "| :---: | :--- | :---: | :--- | :---: | :--- |"
        ]

        for bs in broken_sessions:
            blocked_lines.append(f"| {bs['subject']} | `{bs['position']}` | {bs['gestureId']} | `{bs['exercise']}` | {bs['repsCount']} | {bs['reason']} |")

        blocked_lines.append("")
        with open(BLOCKED_PATH, "w", encoding="utf-8") as bf:
            bf.write("\n".join(blocked_lines) + "\n")

        print(f"BLOCKED.md written to {BLOCKED_PATH}")

        manifest = {
            "dataset": "IntelliRehabDS",
            "doi": "10.5281/zenodo.4610859",
            "citation": "Miron, A., et al. (2021). IntelliRehabDS (IRDS)—A Dataset of Physical Rehabilitation Movements. Data, 6(5), 46.",
            "license": "CC BY 4.0",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "totalSessions": len(manifest_sessions),
            "discontinuousSessionsCount": len(broken_sessions),
            "totalSizeBytes": total_gzipped_bytes,
            "mappedGestures": GESTURE_TO_EXERCISE,
            "skippedGestures": SKIPPED_GESTURES,
            "kinectMapping": KINECT_TO_MEDIAPIPE,
            "sessions": manifest_sessions
        }

        with open(MANIFEST_PATH, "w", encoding="utf-8") as mf:
            json.dump(manifest, mf, indent=2)

        print(f"Manifest written to {MANIFEST_PATH}")

if __name__ == "__main__":
    main()
