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

// A refused set has no count (counted: null), and its user has not given one (userCount: null):
// the line is left for them to fill in.
const refusedLine = fr => (fr ? 'rien, la série a été refusée' : 'none, the set was refused');

function reportLines({ lift, liftName, counted, userCount, version, fr }) {
  const c = fr ? `${NBSP}: ` : ': ';
  return [
    `${fr ? 'Exercice' : 'Lift'}${c}${liftName} (${lift})`,
    `${fr ? 'Compté par l’app' : 'Counted by the app'}${c}${counted == null ? refusedLine(fr) : counted}`,
    `${fr ? 'Votre compte' : 'Your count'}${c}${userCount ?? ''}`,
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
  const subject = counted == null
    ? (fr ? `Workout Vision${NBSP}: ${liftName}, série non comptée` : `Workout Vision: ${liftName}, set not counted`)
    : fr
      ? `Workout Vision${NBSP}: ${liftName}, compté ${counted}, vous ${userCount}`
      : `Workout Vision: ${liftName}, counted ${counted}, you ${userCount}`;
  const body = reportLines({ lift, liftName, counted, userCount, version, fr }).join('\r\n');
  return `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** The same report as a new GitHub issue, in English, for users who have an account. */
export function reportIssueUrl({ lift, liftName = lift, counted, userCount, version = '' }) {
  const body = reportLines({ lift, liftName, counted, userCount, version, fr: false }).join('\n');
  const title = counted == null ? `Count report: ${lift}, set refused` : `Count report: ${lift}, app ${counted}, user ${userCount}`;
  const q = new URLSearchParams({ title, body });
  return `${REPO}/issues/new?${q}`;
}

/**
 * What the share sheet carries for a challenge: the result and a link to the app. It says the app
 * counted the reps when the user kept the app's count. After a correction it gives both numbers:
 * the app neither filmed (the video may come from the library) nor counted the corrected reps
 * (reviews of 29 September 2026).
 */
export function challengeShare({ liftName, count, counted = count, fr, url }) {
  const reps = fr ? (count <= 1 ? 'répétition' : 'répétitions') : (count === 1 ? 'rep' : 'reps');
  const e = count <= 1 ? 'e' : 'es';
  const what = counted === count
    ? (fr ? `${count} ${reps}, compté${e} par Workout Vision sur mon téléphone` : `${count} ${reps}, counted by Workout Vision on my phone`)
    : (fr ? `${count} ${reps} (Workout Vision en a compté ${counted} sur mon téléphone)` : `${count} ${reps} (Workout Vision counted ${counted} on my phone)`);
  const text = fr
    ? `${liftName}${NBSP}: ${what}. Vous relevez le défi${NBSP}?`
    : `${liftName}: ${what}. Can you beat it?`;
  return { title: 'Workout Vision', text, url };
}

/**
 * The report a result offers, or null: a refused result offers the report of a set not counted; a
 * counted one offers the report of its count once it is saved, or when its save failed, so that
 * every result has one (PLAN.md, GROWTH, step 1).
 */
export function reportFor({ lift, liftName, count, trueN, version, fr, refused = false, step, saveError = '' }) {
  if (refused) return { lift, liftName, counted: null, userCount: null, version, fr };
  if (step !== 'saved' && !saveError) return null;
  return { lift, liftName, counted: count, userCount: trueN, version, fr };
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
