/**
 * Set collector utilities.
 *
 * The collector page (collect.html) extracts pose landmarks from a video
 * exactly as the app does, packages them with the user's count and view,
 * and saves a .json.gz file. The user then attaches it to a GitHub issue
 * the page opens. No video leaves the phone; no token is stored.
 */

import { TARGET_FPS, MAX_LONG_SIDE } from './extractionConfig';

const REPO = 'https://github.com/david-dabert/workout-vision';

/**
 * The file name for a collected set: lift_reps_view_id.json.gz
 * where id is the first 8 characters of the video's SHA-256.
 */
export function setFileName(lift, count, view, sha256) {
  return `${lift}_${count}_${view}_${sha256.slice(0, 8)}.json.gz`;
}

/**
 * A GitHub new-issue URL, prefilled with lift, count, view and SHA-256,
 * under the label "set". The user attaches the .json.gz file themselves.
 */
export function issueUrl({ lift, count, view, sha256 }) {
  const body = [
    `Lift: ${lift}`,
    `Count: ${count}`,
    `View: ${view}`,
    `SHA-256: ${sha256}`,
    '',
    'Attach the .json.gz file from the collector.',
  ].join('\n');
  const title = `Set: ${lift}, ${count} reps, ${view}`;
  const q = new URLSearchParams({ title, body, labels: 'set' });
  return `${REPO}/issues/new?${q}`;
}

/**
 * The JSON payload saved inside the .json.gz file.
 * No app count is included: the page shows no count.
 */
export function setPayload({ worldLandmarks, timestamps, lift, count, view, sha256, frameWidth, frameHeight, version }) {
  return {
    lift,
    count,
    view,
    videoSha256: sha256,
    worldLandmarks,
    timestamps,
    frame: { width: frameWidth, height: frameHeight },
    extraction: { fps: TARGET_FPS, maxLongSide: MAX_LONG_SIDE },
    version,
  };
}

/**
 * SHA-256 hex digest of the full video file content.
 * Unlike hashFile() in frameExtractor.js (which hashes metadata for cache keying),
 * this hashes the actual bytes so two different videos never collide.
 */
export async function hashVideoContent(file) {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Gzip a string using the Compression Streams API (Safari 16.4+, Chrome 80+).
 * Returns a Blob of the compressed data.
 */
export async function gzipBlob(jsonString) {
  const stream = new Blob([jsonString]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
}
