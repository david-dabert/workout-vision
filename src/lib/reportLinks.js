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
// the line is left for them to fill in. The lines are the user's own words to David.
const refusedLine = fr => (fr ? 'rien, la série a été refusée' : 'none, the set was refused');

// A set the phone read in part is not counted (coreAnalysis.js, unreadSamples).
const partialLine = fr => (fr ? 'rien, la vidéo n’a pas été lue en entier' : 'none, the video was not read in full');

// What the phone read: the decoder and the samples read out of the video's (29 September, David's order).
function readLines({ decoder, read, fr, c }) {
  const out = [];
  if (decoder) out.push(`${fr ? 'Décodeur' : 'Decoder'}${c}${decoder}`);
  if (read && Number.isFinite(read.read)) {
    // A share only when it is one: more samples than the video holds is a read made twice, not 110 %.
    const pct = read.expected && read.read <= read.expected ? Math.round((read.read / read.expected) * 100) : null;
    const of = read.expected ? (fr ? ` sur ${read.expected}` : ` of ${read.expected}`) : '';
    const share = pct === null ? '' : (fr ? ` (${pct}${NBSP}%)` : ` (${pct}%)`);
    out.push(fr ? `Vidéo lue${c}${read.read} échantillons${of}${share}` : `Video read${c}${read.read}${of} samples${share}`);
  }
  return out;
}

function reportLines({ lift, liftName, counted, userCount, version, fr, partial = false, decoder = '', read = null }) {
  const c = fr ? `${NBSP}: ` : ': ';
  return [
    `${fr ? 'Exercice' : 'Lift'}${c}${liftName} (${lift})`,
    `${fr ? 'Compté par l’app' : 'Counted by the app'}${c}${counted == null ? (partial ? partialLine(fr) : refusedLine(fr)) : counted}`,
    `${fr ? 'Compté par moi' : 'Counted by me'}${c}${userCount ?? ''}`,
    ...(version ? [`${fr ? 'Version de l’app' : 'App version'}${c}${version}`] : []),
    ...readLines({ decoder, read, fr, c }),
    '',
    fr ? 'Ce message ne contient ni vidéo ni image.' : 'This message contains no video and no image.',
    '',
    fr ? `Mon message${c}` : 'My message:',
    '',
  ];
}

/**
 * A mailto: link to pr.dabertdavid@gmail.com. Every reserved character is percent-encoded and
 * lines end in CR LF (RFC 6068), so the mail app shows the message as written.
 */
export function reportEmailUrl({ lift, liftName = lift, counted, userCount, version = '', fr = false, partial = false, decoder = '', read = null }) {
  // Written by the user to David, in the first person (David's copy, 29 September 2026). A refused
  // set has no count of the app's, and the user's is theirs to write.
  const app = counted == null ? (fr ? 'rien' : 'none') : counted, me = userCount ?? (fr ? `${NBSP}?` : '?');
  const subject = fr
    ? `Workout Vision${NBSP}: ${liftName}, l’app ${app}, moi${userCount == null ? me : ` ${me}`}`
    : `Workout Vision: ${liftName}, the app ${app}, me${userCount == null ? me : ` ${me}`}`;
  const body = reportLines({ lift, liftName, counted, userCount, version, fr, partial, decoder, read }).join('\r\n');
  return `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** The same report as a new GitHub issue, in English, for users who have an account. */
export function reportIssueUrl({ lift, liftName = lift, counted, userCount, version = '', partial = false, decoder = '', read = null }) {
  const body = reportLines({ lift, liftName, counted, userCount, version, fr: false, partial, decoder, read }).join('\n');
  const title = counted == null ? `Count report: ${lift}, ${partial ? 'video not read in full' : 'set refused'}` : `Count report: ${lift}, app ${counted}, user ${userCount}`;
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
export function reportFor({ lift, liftName, count, trueN, version, fr, refused = false, step, saveError = '', decoder = '', read = null }) {
  const how = { ...(decoder ? { decoder } : {}), ...(read ? { read } : {}) };
  if (refused) return { lift, liftName, counted: null, userCount: null, version, fr, ...how };
  if (step !== 'saved' && !saveError) return null;
  return { lift, liftName, counted: count, userCount: trueN, version, fr, ...how };
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
