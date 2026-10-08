#!/usr/bin/env python3
"""python3 -I scripts/public/merge-train-shards.py <repcount-train folder> <shard output folder>...

Merges the landmark files that fetch-repcount-train.sh wrote on several machines (each <shard>/build/*.json.gz,
<shard>/holdout/*.json.gz and <shard>/sets.json) into <repcount-train>/sets/ and <repcount-train>/sets.json, the
training record of the learned phase counter (test/real-phone/learned-phase/). A video written anywhere is recorded
written; a video only failed stays failed with its reason. Prints what it added.
"""
import json, os, shutil, sys

dest, shards = sys.argv[1], sys.argv[2:]
rec_path = os.path.join(dest, "sets.json")
rec = json.load(open(rec_path)) if os.path.exists(rec_path) else {}
os.makedirs(os.path.join(dest, "sets"), exist_ok=True)
added = failed = 0
for shard in shards:
    shard_rec_path = os.path.join(shard, "sets.json")
    if not os.path.exists(shard_rec_path):
        print(f"{shard}: no sets.json, skipped")
        continue
    for vid, entry in json.load(open(shard_rec_path)).items():
        if entry["status"] == "written":
            src = os.path.join(shard, entry["split"], f"{vid}.json.gz")
            if not os.path.exists(src):
                continue
            if rec.get(vid, {}).get("status") != "written":
                shutil.copyfile(src, os.path.join(dest, "sets", f"{vid}.json.gz"))
                rec[vid] = entry
                added += 1
        elif vid not in rec:
            rec[vid] = entry
            failed += 1
json.dump(rec, open(rec_path, "w"), indent=2)
open(rec_path, "a").write("\n")
written = sum(1 for e in rec.values() if e["status"] == "written")
print(f"{added} sets added, {failed} failures recorded; {written} written of {len(rec)} recorded")
