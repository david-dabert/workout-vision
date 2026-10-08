#!/usr/bin/env python3
"""python3 -I scripts/public/repcount-lance.py <split> <out folder> <max videos> [<sets.json already recorded>] [build|holdout]

Streams RepCount-A from its Hugging Face Lance mirror (hf://datasets/lmms-lab-eval/repcounta-lance, needs pylance),
one video at a time (take_blobs), into <out folder>, skipping the videos already recorded in <sets.json>, and writes
<out folder>/rows.json: the label rows of the videos written (no blob). The caller extracts landmarks from them
(run-public.mjs) and deletes the videos (fetch-repcount-lance.sh). Split: test, validation or train. With build or holdout, only the videos of that half
(scripts/public/split.mjs: the first hex digit of the SHA-256 of the video id, 0 to 7 build).
WV_SHARD=k/n keeps only the videos whose SHA-256 (of the video id) modulo n is k, so n machines can fetch disjoint
shares in parallel (8 October 2026: the train split on several cloud sessions).
"""
import hashlib, json, os, sys
import lance

split, out, limit = sys.argv[1], sys.argv[2], int(sys.argv[3])
done = set(json.load(open(sys.argv[4]))) if len(sys.argv) > 4 and os.path.exists(sys.argv[4]) else set()
half = sys.argv[5] if len(sys.argv) > 5 else None
shard = os.environ.get("WV_SHARD")
sk, sn = (int(x) for x in shard.split("/")) if shard else (0, 1)
in_shard = lambda i: int(hashlib.sha256(i.encode()).hexdigest(), 16) % sn == sk
half_of = lambda i: "build" if int(hashlib.sha256(i.encode()).hexdigest()[0], 16) < 8 else "holdout"
ds = lance.dataset(f"hf://datasets/lmms-lab-eval/repcounta-lance/data/{split}.lance")
meta = ds.to_table(columns=["video_id", "source_name", "split", "action_type", "count", "cycle_bounds_json"], with_row_id=True).to_pylist()
os.makedirs(out, exist_ok=True)
rows = []
for r in meta:
    if len(rows) >= limit:
        break
    if r["video_id"] in done or not in_shard(r["video_id"]) or (half and half_of(r["video_id"]) != half):
        continue
    blob = ds.take_blobs("video_blob", ids=[r["_rowid"]])[0]
    with open(os.path.join(out, r["source_name"]), "wb") as f:
        while True:
            chunk = blob.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
    del r["_rowid"]
    rows.append(r)
json.dump(rows, open(os.path.join(out, "rows.json"), "w"))
print(f"{len(rows)} videos of {split} written; {sum(1 for r in meta if r['video_id'] not in done and in_shard(r['video_id']) and (not half or half_of(r['video_id']) == half)) - len(rows)} left")
