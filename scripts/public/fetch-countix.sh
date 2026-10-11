#!/usr/bin/env bash
# bash scripts/public/fetch-countix.sh [data folder, default ~/wv-datasets]
# Countix's labels and, for the classes the app counts, their Kinetics-700-2020 clips from the CVDF mirror
# on S3 (scripts/public/countix.mjs). Each class's tar is streamed and only the labelled clips are kept;
# no tar is stored. Then the manifest, the landmark files (run-public.mjs) and the scores.
set -euo pipefail
DATA="${1:-$HOME/wv-datasets}/countix"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
mkdir -p "$DATA/videos"
# Each download leaves a mark only once curl and tar have both finished, so a cut download is fetched again.
if [ ! -f "$DATA/.labels-done" ]; then
  curl -sf https://s3.amazonaws.com/kinetics/700_2020/annotations/countix.tar.gz | tar xzf - -C "$DATA" && touch "$DATA/.labels-done"
fi
[ -f "$DATA/k700_val.csv" ] || curl -sf -o "$DATA/k700_val.csv" https://s3.amazonaws.com/kinetics/700_2020/annotations/val.csv
python3 -c 'import imageio_ffmpeg' 2>/dev/null || pip install -q imageio-ffmpeg
# The CVDF tars are one per class, numbered in the classes' alphabetical order.
python3 - "$DATA" <<'PY' > "$DATA/classes.txt"
import csv, sys
labels = sorted({r['label'] for r in csv.DictReader(open(f'{sys.argv[1]}/k700_val.csv'))})
for c in ['front raises', 'rope pushdown', 'lunge', 'push up', 'pull ups', 'squat', 'bench pressing']:
    print(f'{labels.index(c) + 1:03d}\t{c}')
PY
while IFS=$'\t' read -r idx cls; do
  for s in val train; do
    list="$DATA/want-$s-$idx.txt"
    python3 - "$DATA" "$cls" "$s" > "$list" <<'PY'
import csv, sys
d, cls, s = sys.argv[1:]
for r in csv.DictReader(open(f'{d}/countix/countix_{s}.csv')):
    if r['class'] == cls:
        print(f"{cls}/{r['video_id']}_{int(r['kinetics_start']):06d}_{int(r['kinetics_end']):06d}.mp4")
PY
    [ -s "$list" ] || continue
    [ -f "$DATA/.done-$s-$idx" ] && continue
    # tar reports a clip missing from the mirror and exits non-zero for it: only curl's own status says
    # whether the tar came whole. A clip missing from the mirror is later recorded as left out, with its reason.
    set +e
    curl -sf --retry 5 "https://s3.amazonaws.com/kinetics/700_2020/$s/k700_${s}_$idx.tar.gz" | tar xzf - -C "$DATA/videos" -T "$list" 2>>"$DATA/tar-missing.txt"
    got=${PIPESTATUS[0]}
    set -e
    [ "$got" -eq 0 ] && touch "$DATA/.done-$s-$idx" || { echo "the $cls $s tar did not come whole (curl $got): run again"; exit 1; }
  done
done < "$DATA/classes.txt"
cd "$REPO"
node scripts/public/manifest.mjs countix "$DATA/countix/countix_train.csv,$DATA/countix/countix_val.csv" "$DATA/videos" > "$DATA/manifest.json"
node scripts/public/run-public.mjs "$DATA/manifest.json" --workers 4 || echo "some sets failed: see test/real-phone/public/countix/sets.json"
SCOREBOARD=1 npx vitest run --no-cache test/real-phone/accuracy/public-scoreboard.test.ts
ACCURACY=1 npx vitest run --no-cache test/real-phone/accuracy/public-boundaries.test.ts
