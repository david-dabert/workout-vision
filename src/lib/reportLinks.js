// The report a user sends about a count, and the challenge a user sends to a friend (PLAN.md,
// GROWTH, step 1). Each opens only on the user's tap, in the user's own mail app, GitHub page or
// share sheet; the app sends nothing itself. No video, frame or landmark is ever included.

export const REPORT_EMAIL = 'pr.dabertdavid@gmail.com';
const REPO = 'https://github.com/david-dabert/workout-vision';
const NBSP = ' ';

/** The app's version as the build names it: "1.4.0 (366271a)". */
export function appVersion() {
  const v = typeof __APP_VERSION__ === 'undefined' ? '' : __APP_VERSION__;
  const h = typeof __GIT_HASH__ === 'undefined' ? '' : __GIT_HASH__;
  return [v, h && `(${h})`].filter(Boolean).join(' ');
}

function reportLines({ lift, liftName, counted, userCount, version, fr }) {
  const c = fr ? `${NBSP}: ` : ': ';
  return [
    `${fr ? 'Exercice' : 'Lift'}${c}${liftName} (${lift})`,
    `${fr ? 'Compté par l’app' : 'Counted by the app'}${c}${counted}`,
    `${fr ? 'Votre compte' : 'Your count'}${c}${userCount}`,
    ...(version ? [`${fr ? 'Version de l’app' : 'App version'}${c}${version}`] : []),
    '',
    fr ? 'Aucune vidéo, image ni point du corps n’est joint.' : 'No video, frame or landmark is attached.',
    '',
    fr ? `Votre message${c}` : 'Your message:',
    '',
  ];
}

/**
 * A mailto: link to pr.dabertdavid@gmail.com. Every reserved character is percent-encoded and
 * lines end in CR LF (RFC 6068), so the mail app shows the message as written.
 */
export function reportEmailUrl({ lift, liftName = lift, counted, userCount, version = '', fr = false }) {
  const subject = fr
    ? `Workout Vision${NBSP}: ${liftName}, compté ${counted}, vous ${userCount}`
    : `Workout Vision: ${liftName}, counted ${counted}, you ${userCount}`;
  const body = reportLines({ lift, liftName, counted, userCount, version, fr }).join('\r\n');
  return `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** The same report as a new GitHub issue, in English, for users who have an account. */
export function reportIssueUrl({ lift, liftName = lift, counted, userCount, version = '' }) {
  const body = reportLines({ lift, liftName, counted, userCount, version, fr: false }).join('\n');
  const q = new URLSearchParams({ title: `Count report: ${lift}, app ${counted}, user ${userCount}`, body });
  return `${REPO}/issues/new?${q}`;
}

/**
 * What the share sheet carries for a challenge: the result and a link to the app. It says the app
 * counted the reps only when the user kept the app's count; a corrected count was filmed with the
 * app, not counted by it (review of 29 September 2026).
 */
export function challengeShare({ liftName, count, counted = count, fr, url }) {
  const reps = fr ? (count <= 1 ? 'répétition' : 'répétitions') : (count === 1 ? 'rep' : 'reps');
  const kept = counted === count, e = count <= 1 ? 'e' : 'es';
  const how = fr
    ? (kept ? `compté${e} par Workout Vision sur mon téléphone` : `filmé${e} avec Workout Vision sur mon téléphone`)
    : (kept ? 'counted by Workout Vision on my phone' : 'filmed with Workout Vision on my phone');
  const text = fr
    ? `${liftName}${NBSP}: ${count} ${reps}, ${how}. Vous relevez le défi${NBSP}?`
    : `${liftName}: ${count} ${reps}, ${how}. Can you beat it?`;
  return { title: 'Workout Vision', text, url };
}

/**
 * Sends a challenge inside the tap: the share sheet when there is one; if the user cancels it,
 * nothing more; if it refuses the message, or there is none, the message is copied instead.
 * Returns 'shared', 'cancelled', 'copied' or 'unavailable'.
 */
export async function shareChallenge(data, { share, clipboard } = {}) {
  if (share) {
    try { await share(data); return 'shared'; } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
    }
  }
  if (!clipboard?.writeText) return 'unavailable';
  try { await clipboard.writeText(`${data.text} ${data.url}`); return 'copied'; } catch { return 'unavailable'; }
}
