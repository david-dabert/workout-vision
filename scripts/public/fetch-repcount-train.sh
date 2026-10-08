#!/usr/bin/env bash
# bash scripts/public/fetch-repcount-train.sh <python with pylance> <temp folder> <landmark output folder> [batch, default 8]
# RepCount-A train split to landmark files for the learned phase counter (test/real-phone/learned-phase/): the loop of
# fetch-repcount-lance.sh, with its output (WV_PUBLIC_OUT) and record kept apart from test/real-phone/public/, so the
# public scoreboard never sees training data. Writes <output>/repcount/<build|holdout>/<id>.json.gz (the halves are
# split.mjs's hash only: every set is train split) and <output>/repcount/sets.json; copy the files into
# test/real-phone/learned-phase/repcount-train/sets/. Resumable; stops when under 400 MB of disk is left.
set -uo pipefail
PY="$1"; TMP="$2"; OUT="$3"; BATCH="${4:-8}"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
REC="$OUT/repcount/sets.json"
export WV_PUBLIC_OUT="$OUT"
mkdir -p "$TMP/batch" "$OUT/repcount"
cd "$REPO"
while true; do
  rm -f "$TMP"/batch/*.mp4 "$TMP"/batch/*.avi "$TMP"/batch/*.mov "$TMP"/batch/*.webm "$TMP"/batch/*.mkv
  "$PY" -I scripts/public/repcount-lance.py train "$TMP/batch" "$BATCH" "$REC" || exit 1
  n=$(python3 -c "import json,sys;print(len(json.load(open(sys.argv[1]))))" "$TMP/batch/rows.json")
  [ "$n" = 0 ] && break
  node scripts/public/manifest.mjs repcount-lance "$TMP/batch/rows.json" "$TMP/batch" > "$TMP/batch/manifest.json" 2>> "$TMP/manifest.log"
  WV_PUBLIC_RUNLOG="$TMP" WV_PUBLIC_IMAGE=1 node scripts/public/run-public.mjs "$TMP/batch/manifest.json" --workers 4 || true
  # run-public.mjs leaves its VP9 copy in /tmp when Chromium crashes on a video (up to 200 MB each, seen 8 October)
  find /tmp -maxdepth 1 -name 'wv-public-*.webm' -mmin +20 -delete 2>/dev/null
  avail=$(df --output=avail / | tail -1); [ "$avail" -lt 400000 ] && { echo "under 400 MB of disk left: stopped" >&2; break; }
done
rm -f "$TMP"/batch/*.mp4 "$TMP"/batch/*.avi "$TMP"/batch/*.mov "$TMP"/batch/*.webm "$TMP"/batch/*.mkv
