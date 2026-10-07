/**
 * Shared extraction settings — single source of truth.
 *
 * Both the app (analyzeVideo.js) and the test harness use these values.
 * No platform-specific overrides; every device runs the same path.
 */

/** Samples per second of video. */
export const TARGET_FPS = 15;

/** Maximum pixels on the long side (width or height). */
export const MAX_LONG_SIDE = 640;

/**
 * No artificial sample cap: the video's duration is the only limit.
 * What stays bounded is the decoded pictures: the extractor closes every frame it will not sample as it arrives and
 * holds at most a few at once (frameExtractor.js, extractFramesWebCodecs). What it does not bound is the result: the
 * landmarks of every sample are kept, so a longer video holds more of them (6.7 kB of JSON per sample measured on a
 * 360p clip, 7 October), and nothing here stops a very long video (crash investigation, 7 October, cause 4: not addressed yet).
 */
export const MAX_FRAMES = Infinity;
