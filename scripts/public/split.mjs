/**
 * Each public video is put once, by its group (the video every set of it comes from), in the build half or
 * the held-out half, so no video has sets in both: the first hex digit of the SHA-256 of the group, 0 to 7 build, 8 to f held out. The scoreboard and the diagnoses read
 * the build half only; the held-out half is read once, by its own script, when a change is ready.
 * A Countix video of the earlier benchmark (benchmark/manifest.json) goes to the build half whatever its digit
 * (countix.mjs, manifest.mjs). Checked 2 October 2026 by file name only, nothing counted (Astra's audit): none of
 * the 436 held-out videos is named in benchmark/manifest.json, benchmark/landmark-cache or benchmark/staging;
 * 26 build videos are.
 */
import { createHash } from 'node:crypto';

export const splitOf = id => (parseInt(createHash('sha256').update(id).digest('hex')[0], 16) < 8 ? 'build' : 'holdout');
