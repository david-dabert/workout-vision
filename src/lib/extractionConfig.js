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
 * No artificial sample cap. Duration is the only limit.
 * Memory is bounded by closing frames inside the decoder, not by
 * cutting the set short.
 */
export const MAX_FRAMES = Infinity;
