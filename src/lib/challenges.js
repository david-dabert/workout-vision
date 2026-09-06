/**
 * Challenge link system for viral workout challenges.
 * All challenge data lives in the URL hash — no backend needed.
 *
 * Challenge URL format:
 * https://david-dabert.github.io/workout-vision/#challenge?ex=bench_press&reps=10&score=85&by=David&date=2026-09-04
 *
 * Response URL format (closes the viral loop):
 * https://david-dabert.github.io/workout-vision/#response?ex=bench_press&c_name=David&c_reps=10&c_score=85&r_name=Alex&r_reps=12&r_score=90
 */

const BASE_URL = 'https://david-dabert.github.io/workout-vision/';

/**
 * Create a challenge URL from a workout result and user profile.
 * @param {object} result - analysis result with exercise, reps, formScore
 * @param {object} profile - user profile with name
 * @returns {string} full challenge URL
 */
export function createChallengeURL(result, profile) {
  const params = new URLSearchParams();
  params.set('ex', result.exercise || '');
  params.set('reps', String(result.reps || 0));
  params.set('score', String(result.formScore || 0));
  params.set('by', profile?.name || 'Someone');
  params.set('date', new Date().toISOString().slice(0, 10));
  return `${BASE_URL}#challenge?${params.toString()}`;
}

/**
 * Create a response URL that encodes both the original challenge AND the responder's result.
 * This closes the viral loop: User A shares challenge, User B completes it,
 * User B sends this response URL back, User A sees the comparison.
 * @param {object} challenge - the original parsed challenge data
 * @param {object} result - responder's workout result
 * @param {object} profile - responder's profile
 * @returns {string} full response URL
 */
export function createResponseURL(challenge, result, profile) {
  const params = new URLSearchParams();
  params.set('ex', challenge.exercise || '');
  params.set('c_name', challenge.challengerName || 'Someone');
  params.set('c_reps', String(challenge.reps || 0));
  params.set('c_score', String(challenge.score || 0));
  params.set('r_name', profile?.name || 'Someone');
  params.set('r_reps', String(result.reps || 0));
  params.set('r_score', String(result.formScore || 0));
  return `${BASE_URL}#response?${params.toString()}`;
}

/**
 * Parse challenge parameters from the current URL hash.
 * Expects hash format: #challenge?ex=...&reps=...&score=...&by=...&date=...
 * @returns {object|null} parsed challenge data, or null if not a challenge URL
 */
export function parseChallengeFromURL() {
  const hash = window.location.hash;
  if (!hash.startsWith('#challenge?')) return null;

  const queryString = hash.slice('#challenge?'.length);
  const params = new URLSearchParams(queryString);

  const ex = params.get('ex');
  const reps = parseInt(params.get('reps'), 10);
  const score = parseInt(params.get('score'), 10);
  const by = params.get('by');
  const date = params.get('date');

  if (!ex || isNaN(reps) || isNaN(score)) return null;

  return {
    exercise: ex,
    reps,
    score,
    challengerName: decodeURIComponent(by || 'Someone'),
    date: date || new Date().toISOString().slice(0, 10),
  };
}

/**
 * Parse a challenge response URL.
 * Expects hash format: #response?ex=...&c_name=...&c_reps=...&c_score=...&r_name=...&r_reps=...&r_score=...
 * @returns {object|null} parsed response data, or null if not a response URL
 */
export function parseResponseFromURL() {
  const hash = window.location.hash;
  if (!hash.startsWith('#response?')) return null;

  const queryString = hash.slice('#response?'.length);
  const params = new URLSearchParams(queryString);

  const ex = params.get('ex');
  const cReps = parseInt(params.get('c_reps'), 10);
  const cScore = parseInt(params.get('c_score'), 10);
  const rReps = parseInt(params.get('r_reps'), 10);
  const rScore = parseInt(params.get('r_score'), 10);

  if (!ex || isNaN(cReps) || isNaN(cScore) || isNaN(rReps) || isNaN(rScore)) return null;

  return {
    exercise: ex,
    challengerName: decodeURIComponent(params.get('c_name') || 'Someone'),
    challengerReps: cReps,
    challengerScore: cScore,
    responderName: decodeURIComponent(params.get('r_name') || 'Someone'),
    responderReps: rReps,
    responderScore: rScore,
  };
}

/**
 * Check if the current URL contains a challenge.
 * @returns {boolean}
 */
export function isChallengeActive() {
  return window.location.hash.startsWith('#challenge?');
}

/**
 * Check if the current URL contains a challenge response.
 * @returns {boolean}
 */
export function isResponseActive() {
  return window.location.hash.startsWith('#response?');
}

/**
 * Compare user's result against a challenge.
 * @param {object} challenge - parsed challenge data
 * @param {object} result - user's workout result
 * @returns {object} comparison result with winner flag
 */
export function compareChallenge(challenge, result) {
  const userReps = result.reps || 0;
  const userScore = result.formScore || 0;
  const challengerReps = challenge.reps;
  const challengerScore = challenge.score;

  // Win if form score is higher, or if tied, more reps
  const userWins = userScore > challengerScore
    || (userScore === challengerScore && userReps > challengerReps);

  return {
    userReps,
    userScore,
    challengerReps,
    challengerScore,
    challengerName: challenge.challengerName,
    userWins,
    tie: userScore === challengerScore && userReps === challengerReps,
  };
}

/**
 * Clear the challenge from the URL (set hash back to empty).
 */
export function clearChallengeFromURL() {
  window.location.hash = '';
}

/**
 * Share a challenge via Web Share API or clipboard fallback.
 * @param {object} result - workout result
 * @param {object} profile - user profile
 * @returns {Promise<'shared'|'copied'|'failed'>}
 */
export async function shareChallenge(result, profile) {
  const url = createChallengeURL(result, profile);
  const exerciseName = result.exerciseName || result.exercise || 'an exercise';
  const text = `I just did ${exerciseName} with ${result.formScore}/100 form. Think you can beat it? ${url}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'WorkoutVision Challenge',
        text,
        url,
      });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'failed';
    }
  }

  // Clipboard fallback
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/**
 * Share a challenge response (User B sends their result back to User A).
 * @param {object} challenge - the original parsed challenge
 * @param {object} result - responder's workout result
 * @param {object} profile - responder's profile
 * @returns {Promise<'shared'|'copied'|'failed'>}
 */
export async function shareChallengeResponse(challenge, result, profile) {
  const url = createResponseURL(challenge, result, profile);
  const exerciseName = result.exerciseName || result.exercise || challenge.exercise;
  const text = `I responded to ${challenge.challengerName}'s ${exerciseName} challenge! My score: ${result.formScore}/100 form. See the comparison: ${url}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'WorkoutVision Challenge Response',
        text,
        url,
      });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'failed';
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
