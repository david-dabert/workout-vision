import os
import sys
import ssl
import urllib.request
from concurrent.futures import ThreadPoolExecutor

URL = "https://zenodo.org/api/records/4610859/files/SkeletonData.zip/content"
TOTAL_SIZE = 198985485
CHUNK_SIZE = 10 * 1024 * 1024  # 10 MB per chunk
OUTPUT_FILE = "/tmp/ird_scratch/SkeletonData.zip"

ctx = ssl._create_unverified_context()

def download_chunk(start, end, part_file):
    req = urllib.request.Request(URL, headers={"Range": f"bytes={start}-{end}"})
    with urllib.request.urlopen(req, context=ctx, timeout=60) as resp:
        with open(part_file, "wb") as f:
            f.write(resp.read())
    print(f"Downloaded chunk {start}-{end}")

def main():
    os.makedirs("/tmp/ird_scratch/parts", exist_ok=True)
    chunks = []
    start = 0
    idx = 0
    while start < TOTAL_SIZE:
        end = min(start + CHUNK_SIZE - 1, TOTAL_SIZE - 1)
        part_file = f"/tmp/ird_scratch/parts/part_{idx:03d}.bin"
        chunks.append((start, end, part_file))
        start = end + 1
        idx += 1

    print(f"Downloading {len(chunks)} chunks using 16 threads...")
    with ThreadPoolExecutor(max_workers=16) as executor:
        futures = [executor.submit(download_chunk, s, e, p) for s, e, p in chunks]
        for f in futures:
            f.result()

    print("Assembling final file...")
    with open(OUTPUT_FILE, "wb") as outfile:
        for _, _, p in chunks:
            with open(p, "rb") as infile:
                outfile.write(infile.read())
            os.remove(p)
    print(f"Done! Final file size: {os.path.getsize(OUTPUT_FILE)} bytes.")

if __name__ == "__main__":
    main()
