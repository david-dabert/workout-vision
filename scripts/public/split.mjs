/**
 * Each public video is put once, by its group (the video every set of it comes from), in the build half or
 * the held-out half, so no video has sets in both: the first hex digit of the SHA-256 of the group, 0 to 7 build, 8 to f held out. The scoreboard and the diagnoses read
 * the build half only; the held-out half is read once, by its own script, when a change is ready.
 */
import { createHash } from 'node:crypto';

export const splitOf = id => (parseInt(createHash('sha256').update(id).digest('hex')[0], 16) < 8 ? 'build' : 'holdout');
