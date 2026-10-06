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
 * `extractor` is what extractFramesStreaming returned; it is recorded under `metadata` with the
 * names the committed clips use (test/real-phone/landmarks), so each set says how it was decoded.
 */
export function setPayload({ worldLandmarks, imageLandmarks, timestamps, lift, count, view, sha256, frameWidth, frameHeight, version, extractor = {} }) {
  return {
    lift,
    count,
    view,
    videoSha256: sha256,
    worldLandmarks,
    imageLandmarks,
    timestamps,
    frame: { width: frameWidth, height: frameHeight },
    extraction: { fps: TARGET_FPS, maxLongSide: MAX_LONG_SIDE },
    metadata: {
      extractionMethod: extractor.method,
      extractedWidth: extractor.width,
      extractedHeight: extractor.height,
      duration: extractor.duration,
      sampleCount: extractor.frameCount,
      targetFps: TARGET_FPS,
      maxLongSide: MAX_LONG_SIDE,
      peakOpenFrames: extractor.peakOpenFrames,
      rotationDecision: extractor.rotationDecision,
    },
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

/**
 * The samples of one set, in the order the extractor gives them. When the decoder starts again
 * from the first frame (extractFramesStreaming falls back from WebCodecs to playback), what came
 * before is dropped, failures included, so no sample is kept twice. `fail(index)` records a
 * sample whose pose could not be read; since the third audit (C06) the extractor ends on that
 * error on both paths, so collectSet stops there, and a later successful read of the same index
 * clears it. `posed` counts the samples with a pose. The image
 * landmarks are kept beside the world landmarks, as the committed clips hold both.
 */
export function sampleSet() {
  let world = [], image = [], timestamps = [], failed = new Set();
  return {
    add(index, landmarks, timestamp, imageLandmarks = null) {
      if (index === 0) {
        if (world.length) { world = []; image = []; timestamps = []; }
        failed = new Set();
      }
      failed.delete(index);
      world.push(landmarks);
      image.push(imageLandmarks);
      timestamps.push(timestamp);
    },
    fail(index) { failed.add(index); },
    get world() { return world; },
    get image() { return image; },
    get timestamps() { return timestamps; },
    get failed() { return failed.size; },
    get posed() { return world.filter(w => w != null).length; },
  };
}

/**
 * True only when the samples cover the whole video: the extractor takes floor(duration x fps)
 * samples (frameExtractor.js, totalPossibleFrames), as the five committed clips show exactly.
 * A set that ended early, lost a sample, or was cut by the frame cap would carry the whole
 * set's count over part of it, so it is refused, and so is a set in which no sample has a pose.
 * Status: convention, from the extractor's own sampling rule; no tolerance is allowed. How many
 * samples without a pose a set may hold is David's decision (the committed bench_press_7_angle
 * clip has 151 of 331).
 */
/**
 * How many samples a read may fall short of floor(duration x fps) and still be whole: the larger of 2 samples
 * and 1 % of the video. On 6 October David's videos exported from the app read 1 or 2 samples short of 300 to 414
 * (the last frame or two before the end of the stream), and six of seven were refused. The failure the rule
 * guards against stays refused: 181 of 439 on 29 September. Source: UNSOURCED. Status: experimental.
 */
export const READ_SHORT_TOLERANCE = expected => Math.max(2, Math.floor(expected * 0.01));
export const readIsWhole = (samples, expected) => Number.isFinite(expected) && samples <= expected && expected - samples <= READ_SHORT_TOLERANCE(expected);

export function setIsWhole({ samples, posed = samples, duration, fps, maxFrames, failed }) {
  const expected = Math.floor(duration * fps);
  return failed === 0 && posed > 0 && expected > 0 && expected <= maxFrames && readIsWhole(samples, expected);
}


/**
 * Why no file is offered, or null when the set is whole (setIsWhole). Each clause states only
 * what is known (29 September 2026, David's decision and its review): "no body was found" only
 * when every sample was read and none has a pose; a sample the pose model could not read is
 * reported as unread. The extractor does not report whether it reached the end of the video (on
 * the playback path, captures can fall behind playback) and a failed first pass can leave its
 * samples behind, so the page gives the counts it holds and never names a cause.
 */
export function refusal({ samples, posed = samples, duration, fps, maxFrames, failed }) {
  if (setIsWhole({ samples, posed, duration, fps, maxFrames, failed })) return null;
  const expected = Math.floor(duration * fps);
  if (!Number.isFinite(expected) || expected <= 0) return 'the length of the video could not be read. No file is offered. Pick the video again.';
  if (expected > maxFrames) return `the video is longer than the ${maxFrames} samples the page can read. No file is offered. Film a shorter set.`;
  if (failed === 0 && readIsWhole(samples, expected)) {
    return 'no body was found in any frame of the video. No file is offered. Film the whole body in the frame.';
  }
  const parts = [samples > expected
    ? `${samples} samples were read where the video holds ${expected}`
    : `only ${samples} of the ${expected} samples of the video were read`];
  if (failed > 0) parts.push(`the pose model could not read ${failed} sample${failed === 1 ? '' : 's'}`);
  return `${parts.join('; ')}. No file is offered. Pick the video again.`;
}
