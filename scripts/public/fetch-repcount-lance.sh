#!/usr/bin/env bash
# bash scripts/public/fetch-repcount-lance.sh <python with pylance> <temp folder> [splits, default "test validation"] [batch, default 12]
# RepCount-A from its Hugging Face Lance mirror to landmark files (test/real-phone/public/repcount/<build|holdout>/), a
# batch of videos at a time: stream the batch (repcount-lance.py), extract through the app's own pose path
# (run-public.mjs, with the image landmarks), delete the videos. Never more than one batch of video on disk. Resumable:
# a video already recorded in repcount/sets.json, written or failed, is not fetched again.
set -uo pipefail
PY="$1"; TMP="$2"; SPLITS="${3:-test validation}"; BATCH="${4:-12}"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
REC="$REPO/test/real-phone/public/repcount/sets.json"
cd "$REPO"
for split in $SPLITS; do
  while true; do
    rm -f "$TMP"/batch/*.mp4 "$TMP"/batch/*.avi "$TMP"/batch/*.mov "$TMP"/batch/*.webm "$TMP"/batch/*.mkv
    "$PY" -I scripts/public/repcount-lance.py "$split" "$TMP/batch" "$BATCH" "$REC" || exit 1
    n=$(python3 -c "import json,sys;print(len(json.load(open(sys.argv[1]))))" "$TMP/batch/rows.json")
    [ "$n" = 0 ] && break
    node scripts/public/manifest.mjs repcount-lance "$TMP/batch/rows.json" "$TMP/batch" > "$TMP/batch/manifest.json" 2>> "$TMP/manifest.log"
    WV_PUBLIC_RUNLOG="$TMP" WV_PUBLIC_IMAGE=1 node scripts/public/run-public.mjs "$TMP/batch/manifest.json" --workers 4 || true
    # A row left out by the manifest (count disagrees with its marks) is recorded by run-public as left out.
  done
done
rm -f "$TMP"/batch/*.mp4 "$TMP"/batch/*.avi "$TMP"/batch/*.mov "$TMP"/batch/*.webm "$TMP"/batch/*.mkv
