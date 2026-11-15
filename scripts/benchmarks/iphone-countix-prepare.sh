#!/usr/bin/env bash
# bash scripts/benchmarks/iphone-countix-prepare.sh <lift> <sets>
# The phone path on labelled public clips (15 November 2026; David: "download videos and analyze as if you were using
# my phone"). Picks <sets> Countix clips of one lift from the build half already read in Chromium
# (test/real-phone/public/countix-whole/build; never the held-out half), filmed at 24 frames a second or more as a phone
# films (402 of the 447), evenly spaced in name order, fetches them from
# the CVDF mirror of Kinetics-700-2020 as scripts/public/fetch-countix.sh does, and stores each three ways in
# public/countix-iphone/ (kept out of git by .gitignore):
#   <id>.mp4             the file as Chromium read it;
#   <id>-iphone.mov      HEVC with B-frames (frames stored out of display order), one frame in seven dropped so the
#                        frame rate varies, in a .mov at a 600 timescale, as an iPhone stores a video; at x265 CRF 20,
#                        44.7 dB PSNR against the source on clip yv2kUJpGuNU_000054_0 (CRF 28: 39.3 dB), as an iPhone
#                        records at a high bit rate, so the codec and storage are measured and not a loss of detail;
#   <id>-iphone-rot.mov  that video coded sideways with a -90 degree display matrix, as an iPhone stores a portrait
#                        video, so WebKit's hand rotation (frameExtractor.js manualRotationNeeded) is read.
# The recipe of public/demo/iphone/ (commits f339eb1b and a715734b), at CRF 20. Writes public/countix-iphone/list.json (every
# file, for safari-readings.mjs --list) and repeat.json (the first five MP4s, read a second time to measure WebKit's
# run-to-run spread). No video leaves the runner: only landmarks are kept.
# COUNTIX_LOCAL=<folder with countix/ and videos/, as fetch-countix.sh leaves it> uses clips already on disk.
set -euo pipefail
LIFT="$1"; N="$2"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$REPO/public/countix-iphone"
WORK="${RUNNER_TEMP:-/tmp}/countix-$LIFT"
# Kinetics-700-2020 numbers its class tars in the classes' alphabetical order (fetch-countix.sh computes these from
# val.csv; written out here so the runner needs no extra download).
case "$LIFT" in
  bench_press) IDX=033; CLS='bench pressing' ;;
  front_raise) IDX=217; CLS='front raises' ;;
  lunge) IDX=306; CLS='lunge' ;;
  pull_up) IDX=454; CLS='pull ups' ;;
  push_up) IDX=461; CLS='push up' ;;
  squat) IDX=577; CLS='squat' ;;
  triceps_pushdown) IDX=497; CLS='rope pushdown' ;;
  *) echo "unknown lift $LIFT" >&2; exit 1 ;;
esac
mkdir -p "$WORK" "$OUT"
if [ -n "${COUNTIX_LOCAL:-}" ]; then LABELS="$COUNTIX_LOCAL/countix"; VIDEOS="$COUNTIX_LOCAL/videos"; else
  LABELS="$WORK/countix"; VIDEOS="$WORK/videos"; mkdir -p "$VIDEOS"
  [ -f "$LABELS/countix_train.csv" ] || curl -sf --retry 5 https://s3.amazonaws.com/kinetics/700_2020/annotations/countix.tar.gz | tar xzf - -C "$WORK"
fi
python3 - "$REPO" "$LABELS" "$WORK" "$LIFT" "$CLS" "$N" <<'PY'
import csv, gzip, json, os, sys
repo, labels, work, lift, cls, n = sys.argv[1:]; n = int(n)
build = os.path.join(repo, 'test/real-phone/public/countix-whole/build')
sets = []
for f in sorted(os.listdir(build)):
    d = json.loads(gzip.open(os.path.join(build, f)).read())
    if d['lift'] == lift and d['fps'] >= 24: sets.append(d)
pick = [sets[round(i * (len(sets) - 1) / (n - 1))] for i in range(n)] if n > 1 and len(sets) > n else sets[:n]
rows = {}
for split in ('train', 'val'):
    for r in csv.DictReader(open(os.path.join(labels, f'countix_{split}.csv'))):
        if r['class'] == cls: rows[(r['video_id'], int(r['kinetics_start']))] = (split, r)
want = {'train': [], 'val': []}; picked = []
for d in pick:
    vid, ks, _ = d['id'].rsplit('_', 2)
    split, r = rows[(vid, int(ks))]
    file = f"{cls}/{vid}_{int(r['kinetics_start']):06d}_{int(r['kinetics_end']):06d}.mp4"
    want[split].append(file)
    picked.append({'id': d['id'], 'file': file, 'lift': lift, 'label': d['count'], 'window': d['window']})
for s, files in want.items(): open(os.path.join(work, f'want-{s}.txt'), 'w').write(''.join(x + '\n' for x in files))
json.dump(picked, open(os.path.join(work, 'picked.json'), 'w'))
print(f'{lift}: {len(picked)} of {len(sets)} build sets picked ({len(want["train"])} train, {len(want["val"])} val)')
PY
if [ -z "${COUNTIX_LOCAL:-}" ]; then
  for s in val train; do
    [ -s "$WORK/want-$s.txt" ] || continue
    # tar exits non-zero for a clip missing from the mirror; such a clip is left out below and named in the log.
    set +e
    curl -sf --retry 5 "https://s3.amazonaws.com/kinetics/700_2020/$s/k700_${s}_$IDX.tar.gz" | tar xzf - -C "$VIDEOS" -T "$WORK/want-$s.txt"
    got=${PIPESTATUS[0]}
    set -e
    [ "$got" -eq 0 ] || { echo "the $CLS $s tar did not come whole (curl $got)" >&2; exit 1; }
  done
fi
X265='-c:v libx265 -x265-params bframes=3:crf=20:log-level=error -tag:v hvc1 -video_track_timescale 600 -an'
python3 -c 'import json,sys; [print(p["id"] + "\t" + p["file"]) for p in json.load(open(sys.argv[1]))]' "$WORK/picked.json" |
while IFS=$'\t' read -r id file; do
  src="$VIDEOS/$file"
  if [ ! -f "$src" ]; then echo "left out $id: $file is not on the mirror"; continue; fi
  cp "$src" "$OUT/$id.mp4"
  # Even dimensions for 4:2:0 HEVC; frame 3 of every 7 dropped, the others keep their own times.
  ffmpeg -nostdin -v error -y -i "$src" -vf "select='not(eq(mod(n\,7)\,3))',scale=trunc(iw/2)*2:trunc(ih/2)*2" -fps_mode passthrough $X265 "$OUT/$id-iphone.mov"
  ffmpeg -nostdin -v error -y -i "$OUT/$id-iphone.mov" -vf transpose=2 -fps_mode passthrough $X265 "$WORK/land.mov"
  ffmpeg -nostdin -v error -y -display_rotation -90 -i "$WORK/land.mov" -c copy -tag:v hvc1 "$OUT/$id-iphone-rot.mov"
done
python3 - "$WORK/picked.json" "$OUT" <<'PY'
import json, os, sys
picked, out = json.load(open(sys.argv[1])), sys.argv[2]
rel = os.path.basename(out)
entries = []
for p in picked:
    for suffix, ext in (('', '.mp4'), ('-iphone', '.mov'), ('-iphone-rot', '.mov')):
        f = f"{p['id']}{suffix}{ext}"
        if os.path.exists(os.path.join(out, f)):
            entries.append({'clip': p['id'] + suffix, 'lift': p['lift'], 'label': p['label'], 'window': p['window'], 'path': f'{rel}/{f}'})
json.dump(entries, open(os.path.join(out, 'list.json'), 'w'), indent=1)
json.dump([e for e in entries if e['path'].endswith('.mp4')][:5], open(os.path.join(out, 'repeat.json'), 'w'), indent=1)
print(f'{len(entries)} files listed in {rel}/list.json')
PY
