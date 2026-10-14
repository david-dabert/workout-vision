#!/usr/bin/env python3
"""
High-speed parallel chunk downloader for IntelliRehabDS SkeletonData.zip from Zenodo.
Uses HTTP Range requests across parallel curl processes.
"""

import os
import sys
import subprocess
from concurrent.futures import ThreadPoolExecutor

URL = "https://zenodo.org/api/records/4610859/files/SkeletonData.zip/content"
TOTAL_SIZE = 198985485
CHUNK_SIZE = 8 * 1024 * 1024  # 8 MB
OUTPUT_DIR = os.path.expanduser("~/wv-tools")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "SkeletonData.zip")
PARTS_DIR = os.path.join(OUTPUT_DIR, "parts_ird")

def download_part(idx, start, end, part_file):
    if os.path.exists(part_file) and os.path.getsize(part_file) == (end - start + 1):
        print(f"Part {idx:02d} already complete.")
        return True
    
    cmd = [
        "curl", "-s", "-L",
        "--retry", "5",
        "--retry-delay", "1",
        "-r", f"{start}-{end}",
        "-o", part_file,
        URL
    ]
    res = subprocess.run(cmd)
    if res.returncode != 0 or not os.path.exists(part_file) or os.path.getsize(part_file) != (end - start + 1):
        print(f"Error on part {idx:02d}: exit code {res.returncode}, size {os.path.getsize(part_file) if os.path.exists(part_file) else 0}", file=sys.stderr)
        return False
    print(f"Part {idx:02d} ({start}-{end}) downloaded successfully.")
    return True

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(PARTS_DIR, exist_ok=True)

    if os.path.exists(OUTPUT_FILE) and os.path.getsize(OUTPUT_FILE) == TOTAL_SIZE:
        print(f"SkeletonData.zip already exists and is {TOTAL_SIZE} bytes.")
        return

    chunks = []
    start = 0
    idx = 0
    while start < TOTAL_SIZE:
        end = min(start + CHUNK_SIZE - 1, TOTAL_SIZE - 1)
        part_file = os.path.join(PARTS_DIR, f"part_{idx:03d}.bin")
        chunks.append((idx, start, end, part_file))
        start = end + 1
        idx += 1

    print(f"Downloading {len(chunks)} chunks using 12 threads...")
    with ThreadPoolExecutor(max_workers=12) as pool:
        results = list(pool.map(lambda c: download_part(*c), chunks))

    if not all(results):
        print("Some parts failed to download.", file=sys.stderr)
        sys.exit(1)

    print(f"Assembling {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, "wb") as outfile:
        for idx, start, end, part_file in chunks:
            with open(part_file, "rb") as infile:
                outfile.write(infile.read())
            os.remove(part_file)

    try:
        os.rmdir(PARTS_DIR)
    except Exception:
        pass

    final_size = os.path.getsize(OUTPUT_FILE)
    print(f"Download complete: {OUTPUT_FILE} ({final_size} bytes).")
    if final_size != TOTAL_SIZE:
        print(f"Error: Size mismatch! Expected {TOTAL_SIZE}, got {final_size}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
