// Blind counts (David's order of 9 October 2026, pillar 1: "Build the test before the engine. On a sample of sets, ask
// 'how many did you do?' before showing the app's count; that answer is a blind label"). While the video is read, the
// person is asked their count; the app's count is held back until they answer, so nothing on the screen can lean their
// answer toward it (anchoring: Tversky and Kahneman 1974, Science 185:1124; status: literature). "Je ne sais pas" is
// always offered, and a set answered so carries no blind count.
//
// Who is asked, for now: David's phone only (the #collecte flag, phoneCollect.js), on every set read from a video. His
// collected files then carry his blind count beside the count he kept after seeing the app's (collectedPayload). A set
// counted live is never asked: the live screen shows the count during the set, so no answer given after it is blind.
// Asking other people waits on the contributions, paused in production (buildFlags.js, WP0.4), and on David's
// decisions (sampling rate, R1 amendment, notice).
//
// Whether a blind count is a label (R1): it is David's own count, so R1 allows it, but how well a count made in the gym
// right after the set matches his half-speed count of the video is not measured yet. Until he decides, the scoreboard
// shows his blind sets in their own section, which decides nothing (test/real-phone/accuracy/sets.ts, blindSets).

/** The share of sets asked on David's phone. Status: convention (David's order: every set he films there). */
export const BLIND_P_COLLECT = 1;
/** The highest count the question takes, as the result screen's own field (Result.jsx adjust: 0 to 99). */
export const BLIND_MAX = 99;

/**
 * Whether this set's count is asked before the app's is shown. collect: the phone carries the #collecte flag;
 * video: the set is read from a video (not counted live). Returns { ask, p }: p the share of such sets asked.
 */
export function blindPlan({ collect = false, video = true } = {}) {
  const p = collect && video ? BLIND_P_COLLECT : 0;
  return { ask: p > 0, p };
}

/** The digits typed, as a count: a whole number from 1 to BLIND_MAX, or null (empty, 0, or not a number). */
export function parseBlind(text) {
  const s = String(text ?? '').trim();
  if (!/^\d{1,2}$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= BLIND_MAX ? n : null;
}

/**
 * The answer as the set keeps it: { count, p }. count: the number given, or null for "Je ne sais pas". Kept with the
 * saved set (saved-set.js) and in David's collected file (phoneCollect.js).
 */
export function blindAnswer(count, p) {
  return { count: Number.isInteger(count) && count >= 1 && count <= BLIND_MAX ? count : null, p };
}

/**
 * Formats a blind count record adhering to the Phase 6 recording protocol (PLAN.md):
 * - videoSha256
 * - lift
 * - testerCount (ground truth label under R1 / R2)
 * - appCount (measured count by app, or null if refused)
 * - timestamp and anonymous session ID
 */
export function createBlindRecord({ videoSha256, lift, testerCount, appCount = null, appRefused = false, timestamp, sessionId, worldLandmarks, timestamps, imageLandmarks }) {
  if (!videoSha256 || typeof videoSha256 !== 'string') throw new Error('videoSha256 is required');
  if (!lift || typeof lift !== 'string') throw new Error('lift is required');
  if (!Number.isInteger(testerCount) || testerCount < 1) throw new Error('testerCount must be an integer >= 1');
  return {
    version: 1,
    videoSha256,
    lift,
    testerCount,
    appCount: Number.isInteger(appCount) ? appCount : null,
    appRefused: !!appRefused || appCount === null,
    timestamp: timestamp || new Date().toISOString(),
    sessionId: sessionId || 'anon-session',
    ...(Array.isArray(worldLandmarks) ? { worldLandmarks } : {}),
    ...(Array.isArray(timestamps) ? { timestamps } : {}),
    ...(Array.isArray(imageLandmarks) ? { imageLandmarks } : {}),
  };
}
