// Anonymous usage counts (analytics, 3 October 2026), so David knows how many people use the app and how far they get.
//
// What leaves the phone, and only when the build names a server (VITE_EVENTS_URL): an event's name from the list in
// feedback-worker/usage-schema.js, the lift and its tier where the event carries them, a visit's length in one of four
// buckets, the app's version and the language. No identifier of any kind (nothing is stored to tell this phone from
// another: no cookie, no id, no timestamp), no video, no pose, no count of reps. The server keeps only daily totals.
//
// Nothing is sent when no server is named, when the browser asks sites not to track (Global Privacy Control, Do Not
// Track), or after the person turns the counting off on the choice screen (Choice.jsx): that choice is the one thing
// written on the phone, and it holds no identifier.
import { USAGE_EVENTS, MAX_BATCH, durationBucket, validEvent } from '../../feedback-worker/usage-schema.js';
import { appVersion } from './reportLinks';
import { tierOf } from './offer';

const ENDPOINT = import.meta.env.VITE_EVENTS_URL || '';
const OFF_KEY = 'wv_count_off';
// Events wait this long to leave together, so a visit makes a few requests, not one per tap. Status: convention.
const FLUSH_MS = 4000;
// A page that sends more than this has a bug looping: it stops sending. A visit sends about fifteen. Status: convention.
const MAX_PER_PAGE = 200;

let queue = [];
let timer = 0;
let sent = 0;

/** True when the build names a server for the counts. */
export const eventsConfigured = () => !!ENDPOINT;

/** The browser asks sites not to track: Global Privacy Control, or Do Not Track. */
export function browserRefuses(nav = globalThis.navigator) {
  try { return nav?.globalPrivacyControl === true || nav?.doNotTrack === '1' || globalThis.window?.doNotTrack === '1'; } catch { return false; }
}

/** The person turned the counting off on this phone. */
export function countingOff() {
  try { return globalThis.localStorage?.getItem(OFF_KEY) === '1'; } catch { return false; }
}

/** Turns the counting off (true) or back on (false) on this phone. Events waiting are dropped when it goes off. */
export function setCountingOff(off) {
  try { if (off) globalThis.localStorage?.setItem(OFF_KEY, '1'); else globalThis.localStorage?.removeItem(OFF_KEY); } catch { /* the choice holds for this visit */ }
  if (off) { queue = []; clearTimeout(timer); timer = 0; offThisVisit = true; } else offThisVisit = false;
}
let offThisVisit = false;

/** True when an event would be sent now. */
export const eventsActive = () => eventsConfigured() && !browserRefuses() && !offThisVisit && !countingOff();

// The language the app shows, read as LanguageContext.jsx reads it (detectLang), so the opening, counted before the
// page declares its language, is counted in it too.
function lang() {
  try {
    const saved = globalThis.localStorage?.getItem('wv_lang');
    if (saved === 'en' || saved === 'fr') return saved;
  } catch { /* no storage */ }
  try { return String(globalThis.navigator?.language || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en'; } catch { return 'en'; }
}

/**
 * Counts one event: its name from the list, and of `props` only the fields that event carries (lift, durationBucket).
 * The tier is the lift's own (offer.js). Any other field is dropped. Returns true when the event was queued.
 */
export function track(event, props = {}) {
  if (!eventsActive() || !Object.prototype.hasOwnProperty.call(USAGE_EVENTS, event)) return false;
  const allowed = USAGE_EVENTS[event];
  const e = { event };
  if (allowed.includes('lift') && typeof props?.lift === 'string' && props.lift) {
    e.lift = props.lift;
    const tier = tierOf(props.lift);
    if (tier === 'beta' || tier === 'experimental') e.tier = tier;
  }
  if (allowed.includes('durationBucket') && props?.durationBucket) e.durationBucket = props.durationBucket;
  e.appVersion = appVersion() || '0.0.0';
  e.lang = lang();
  if (!validEvent(e) || sent >= MAX_PER_PAGE) return false;
  sent += 1;
  queue.push(e);
  if (queue.length >= MAX_BATCH) flushEvents();
  else if (!timer) timer = setTimeout(flushEvents, FLUSH_MS);
  return true;
}

/** Sends the events waiting, now. */
export function flushEvents() {
  clearTimeout(timer);
  timer = 0;
  while (queue.length) post(JSON.stringify({ events: queue.splice(0, MAX_BATCH) }));
}

// Whether this browser's fetch can outlive the page (keepalive): Safari and Chrome for years, Firefox since 133.
const fetchKeepsAlive = () => {
  try { return typeof globalThis.fetch === 'function' && typeof globalThis.Request === 'function' && 'keepalive' in globalThis.Request.prototype; } catch { return false; }
};

// As text/plain, which the browser sends with no preflight; the worker reads the body as JSON (usage.js).
// First a keepalive fetch, which outlives the page as a beacon does, with credentials: 'omit', so no cookie of the
// worker's site ever goes with a count, and no referrer. sendBeacon always sends the browser's cookies for the
// worker's site (its credentials mode is "include", and it takes no option), so it is only the fallback, where fetch
// cannot keep the request alive or throws at once (review finding N7). The worker sets no cookie either way.
// A fetch that fails later is not sent again by beacon: it may have reached the worker, and a count must not double.
function post(body) {
  if (fetchKeepsAlive()) {
    try {
      globalThis.fetch(ENDPOINT, { method: 'POST', body, keepalive: true, credentials: 'omit', referrerPolicy: 'no-referrer', mode: 'cors', headers: { 'Content-Type': 'text/plain;charset=UTF-8' } })
        ?.catch?.(() => {});
      return;
    } catch { /* fall back to the beacon */ }
  }
  try { globalThis.navigator?.sendBeacon?.(ENDPOINT, body); } catch { /* a count lost is not an error */ }
}

let started = false;
/**
 * Counts the app's opening, and at the end of the visit its length, in a bucket. The start is kept in memory only.
 * Waiting events leave whenever the page is hidden, as a page in the background may never come back.
 */
export function startEvents(now = () => globalThis.performance?.now?.() ?? Date.now()) {
  if (started || !eventsConfigured()) return;
  started = true;
  const t0 = now();
  track('open');
  let ended = false;
  globalThis.addEventListener?.('pagehide', () => {
    if (!ended) { ended = true; track('session_end', { durationBucket: durationBucket(now() - t0) }); }
    flushEvents();
  });
  globalThis.document?.addEventListener?.('visibilitychange', () => { if (globalThis.document.visibilityState === 'hidden') flushEvents(); });
}
