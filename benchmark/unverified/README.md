# Unverified benchmark clips

These 72 clips were moved here from `benchmark/staging/` on 2026-09-24.

## Why they are unverified

Per DIRECTIVES.md R1 (Ground truth is sacred):

> Never set or adjust a label from the app's output, a video title,
> a thumbnail or a guess. Labels come only from David, or from
> human-annotated public datasets (Countix).

These clips were downloaded from YouTube by `benchmark/expand-benchmark.py`
and `benchmark/extract-landmarks.mjs --batch`. Their rep counts were taken
from video titles or visual inspection of thumbnails, not from a
human-annotated dataset. The exercise labels were assigned by the person
who wrote the batch manifest, not verified by David.

Until David watches each clip and confirms the label and count, they
cannot be used in the scored benchmark. They remain available here for
exploratory testing.

## How to promote a clip

1. David watches the clip and confirms exercise and rep count.
2. Add a row to `test/real-phone/manifest.json` (or the Countix manifest)
   with `"source": "youtube-verified"`.
3. Move the `.mp4` to the appropriate benchmark directory.
4. Run `npm run scoreboard` to confirm no regression.

## Clip inventory

72 clips across 30 exercise types. See filenames for exercise/count encoding.
