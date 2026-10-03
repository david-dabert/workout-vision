// The usage counts the app may send, and nothing else (analytics, 3 October 2026).
// One list for both sides: the app builds its events from it (src/lib/events.js) and the worker accepts only what it
// allows (worker.js). An event is a name from USAGE_EVENTS, the fields that event allows, and two fields every event
// carries: the app's version and its language. No identifier, no time finer than the day (the worker stamps the day),
// no video, no movement, no count of reps.

/** Each event and the fields it may carry beside appVersion and lang. Every field is optional except those two. */
export const USAGE_EVENTS = Object.freeze({
  open: [], //                 the app opened (one per page load)
  guide_open: [], //           the exercise guide opened from the choice of lift
  history_open: [], //         the saved sets opened
  choose_lift: ['lift', 'tier'], // a lift chosen on the choice screen or in the guide
  film_start: ['lift', 'tier'], //  a video filmed or chosen on the Film screen
  analysis_start: ['lift', 'tier'],
  analysis_done: ['lift', 'tier'], //        a count shown
  analysis_uncounted: ['lift', 'tier'], //   no rep found: the app asks for the count (R8)
  analysis_refused: ['lift', 'tier'], //     the set could not be counted (refusal.js)
  analysis_failed: ['lift', 'tier'], //      the analysis could not run
  analysis_partial: ['lift', 'tier'], //     the video was not read in full
  analysis_interrupted: ['lift', 'tier'], // the page was hidden during the analysis
  analysis_cancelled: ['lift', 'tier'], //   the user tapped Cancel
  result_kept: ['lift', 'tier'], //          the count saved as the app counted it
  result_corrected: ['lift', 'tier'], //     the count saved after the user corrected it
  report_open: ['lift', 'tier'],
  share: ['lift', 'tier'], //                a share sheet or a download, from the report, the replay or the challenge
  session_end: ['durationBucket'], //        the page hidden for good, with the visit's length in a coarse bucket
});

export const EVENT_NAMES = Object.freeze(Object.keys(USAGE_EVENTS));

/** A visit's length, in minutes, only ever sent as one of these four buckets. */
export const DURATION_BUCKETS = Object.freeze(['<1', '1-5', '5-15', '>15']);
export const TIERS = Object.freeze(['beta', 'experimental']);
export const LANGS = Object.freeze(['fr', 'en']);
export const COMMON_FIELDS = Object.freeze(['appVersion', 'lang']);
/** At most this many events in one request. */
export const MAX_BATCH = 20;

// A lift is a catalogue key (src/lib/offer.js): lower case, digits and underscores.
const LIFT_RE = /^[a-z][a-z0-9_]{0,47}$/;
// The version as the build names it (reportLinks.js appVersion): "1.4.0 (366271a)".
const VERSION_RE = /^[0-9A-Za-z.+() _-]{1,32}$/;

/** The bucket of a visit of `ms` milliseconds. */
export function durationBucket(ms) {
  const min = ms / 60000;
  if (!(min >= 0)) return null;
  return min < 1 ? '<1' : min < 5 ? '1-5' : min < 15 ? '5-15' : '>15';
}

/**
 * The event as it may be stored, or null when any part of it is not allowed: an unknown name, a field the event
 * does not carry, a value outside its list or form, or a missing version or language.
 */
export function validEvent(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
  const allowed = Object.prototype.hasOwnProperty.call(USAGE_EVENTS, e.event) ? USAGE_EVENTS[e.event] : null;
  if (!allowed) return null;
  for (const key of Object.keys(e)) {
    if (key !== 'event' && !COMMON_FIELDS.includes(key) && !allowed.includes(key)) return null;
  }
  if (typeof e.appVersion !== 'string' || !VERSION_RE.test(e.appVersion)) return null;
  if (!LANGS.includes(e.lang)) return null;
  const out = { event: e.event, lift: '', tier: '', durationBucket: '', appVersion: e.appVersion, lang: e.lang };
  if (e.lift !== undefined) {
    if (typeof e.lift !== 'string' || !LIFT_RE.test(e.lift)) return null;
    out.lift = e.lift;
  }
  if (e.tier !== undefined) {
    if (!TIERS.includes(e.tier) || !out.lift) return null;
    out.tier = e.tier;
  }
  if (e.durationBucket !== undefined) {
    if (!DURATION_BUCKETS.includes(e.durationBucket)) return null;
    out.durationBucket = e.durationBucket;
  }
  return out;
}
