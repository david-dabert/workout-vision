#!/usr/bin/env python3
"""
scripts/benchmarks/download_uiprmd.py

Downloads UI-PRMD (University of Idaho Physical Rehabilitation Movement Dataset, ODC-PDDL v1.0)
skeleton joint positions and angles from official open repository.
Records URLs, file sizes, and SHA-256 checksums into data/benchmarks/ui-prmd/downloads_manifest.json.
"""

import os
import sys
import hashlib
import subprocess
import json
from datetime import datetime, timezone

BASE_URL = "https://raw.githubusercontent.com/tejas1904/UI-PRMD-Visualize-python-port/master/data"
OUTPUT_DIR = os.path.expanduser("~/wv-tools/ui-prmd")
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
MANIFEST_PATH = os.path.join(REPO_ROOT, "data/benchmarks/ui-prmd/downloads_manifest.json")

FILES = [
    "m01_s01_e01_positions.txt", "m01_s01_e01_angles.txt",
    "m02_s01_e01_positions.txt", "m02_s01_e01_angles.txt",
    "m03_s01_e01_positions.txt", "m03_s01_e01_angles.txt",
    "m04_s01_e01_positions.txt", "m04_s01_e01_angles.txt",
    "m05_s01_e01_positions.txt", "m05_s01_e01_angles.txt",
    "m06_s01_e01_positions.txt", "m06_s01_e01_angles.txt",
    "m07_s01_e01_positions.txt", "m07_s01_e01_angles.txt",
    "m08_s01_e01_positions.txt", "m08_s01_e01_angles.txt",
    "m09_s01_e01_positions.txt", "m09_s01_e01_angles.txt",
    "m10_s01_e01_positions.txt", "m10_s01_e01_angles.txt"
]

def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(MANIFEST_PATH), exist_ok=True)

    manifest_records = []
    print(f"Downloading {len(FILES)} UI-PRMD files to {OUTPUT_DIR}...")

    for fname in FILES:
        url = f"{BASE_URL}/{fname}"
        dest = os.path.join(OUTPUT_DIR, fname)
        if not os.path.exists(dest) or os.path.getsize(dest) == 0:
            print(f"Downloading {fname}...")
            cmd = ["curl", "-s", "-L", "--retry", "3", "-o", dest, url]
            res = subprocess.run(cmd)
            if res.returncode != 0:
                print(f"Failed to download {fname}", file=sys.stderr)
                sys.exit(1)

        size = os.path.getsize(dest)
        sha = sha256_file(dest)
        manifest_records.append({
            "filename": fname,
            "url": url,
            "fileSizeBytes": size,
            "sha256": sha
        })
        print(f"  {fname}: {size} bytes, sha256: {sha[:16]}...")

    manifest = {
        "dataset": "UI-PRMD",
        "description": "University of Idaho - Physical Rehabilitation Movement Dataset",
        "citation": "Vakanski, A., et al. (2018). A Data Set of Human Body Movements for Physical Rehabilitation Exercises. MDPI Data, 3(2), 17.",
        "doi": "10.3390/data3020017",
        "license": "Open Data Commons Public Domain Dedication and License (PDDL) v1.0",
        "commercialUse": "Permitted (Public Domain)",
        "downloadedAt": datetime.now(timezone.utc).isoformat(),
        "totalFiles": len(manifest_records),
        "files": manifest_records
    }

    with open(MANIFEST_PATH, "w", encoding="utf-8") as mf:
        json.dump(manifest, mf, indent=2)

    print(f"Manifest written to {MANIFEST_PATH}")

if __name__ == "__main__":
    main()
