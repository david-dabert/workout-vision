#!/usr/bin/env bash
# bash scripts/public/fetch-and-run.sh [data folder, default ~/wv-datasets]
# Downloads the public labelled datasets, turns each set into a landmark file through the app's own
# extraction (run-public.mjs), and scores the live core on their build half. Needs network access to
# drive.google.com, drive.usercontent.google.com (RepCount-A, as re-annotated by PoseRAC) and zenodo.org
# (MM-Fit). Resumable: each step skips what is already there. Videos stay in the data folder, outside
# the repository; only landmark files are written under test/real-phone/public/.
set -euo pipefail
DATA="${1:-$HOME/wv-datasets}"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
mkdir -p "$DATA"
python3 -c 'import gdown' 2>/dev/null || pip install -q gdown
python3 -c 'import imageio_ffmpeg' 2>/dev/null || pip install -q imageio-ffmpeg

# RepCount-A with PoseRAC's pose annotations (https://github.com/MiracleDance/PoseRAC, README "Download
# Videos and Pose-level Annotations"): videos and TransRAC's label files.
if [ ! -d "$DATA/repcount" ]; then
  python3 -m gdown --fuzzy 'https://drive.google.com/file/d/1k9LLzOsJVh6ACXSX8iKbGNxTY9-L6X_x/view' -O "$DATA/repcount.zip"
  python3 -c "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" "$DATA/repcount.zip" "$DATA/repcount"
fi

# MM-Fit (https://zenodo.org/records/7672767): every file of the record.
if [ ! -d "$DATA/mmfit" ]; then
  mkdir -p "$DATA/mmfit-dl"
  python3 - "$DATA/mmfit-dl" <<'PY'
import json, sys, urllib.request, os
out = sys.argv[1]
rec = json.load(urllib.request.urlopen('https://zenodo.org/api/records/7672767'))
for f in rec['files']:
    dest = os.path.join(out, f['key'])
    if not os.path.exists(dest):
        print('downloading', f['key'], f['size'], flush=True)
        urllib.request.urlretrieve(f['links']['self'], dest)
PY
  for z in "$DATA"/mmfit-dl/*.zip; do python3 -c "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" "$z" "$DATA/mmfit"; done
fi

cd "$REPO"
# RepCount's label files and videos, wherever the archive put them: each split's CSV and its video folder.
for csv in $(find "$DATA/repcount" -name '*.csv' -path '*annotation*' | sort); do
  split="$(basename "$csv" .csv)"
  videos="$(find "$DATA/repcount" -type d -name "$split" -path '*video*' | head -1)"
  [ -n "$videos" ] || { echo "no video folder for $csv"; continue; }
  node scripts/public/manifest.mjs repcount "$csv" "$videos" > "$DATA/repcount-$split.json"
  # A failed set is recorded with its reason (<dataset>/sets.json) and listed by the scoreboard.
  node scripts/public/run-public.mjs "$DATA/repcount-$split.json" --workers 4 || echo "some sets failed: see test/real-phone/public/repcount/sets.json"
done
root="$(dirname "$(find "$DATA/mmfit" -type d -name 'mm-fit' -path '*labels*' | head -1)")/.."
node scripts/public/manifest.mjs mmfit "$root" > "$DATA/mmfit.json"
node scripts/public/run-public.mjs "$DATA/mmfit.json" --workers 4 || echo "some sets failed: see test/real-phone/public/mmfit/sets.json"

SCOREBOARD=1 SCOREBOARD_UPDATE=1 npx vitest run --no-cache test/real-phone/accuracy/public-scoreboard.test.ts
ACCURACY=1 npx vitest run --no-cache test/real-phone/accuracy/public-boundaries.test.ts
