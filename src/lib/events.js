// Usage counts (analytics, 3 October 2026), so David knows how many people use the app and how far they get.
//
// Since 16 November 2026 (David: "Yes to the tracking, build it"): a random id of this phone (wv_aid: 128 random bits
// and the day it was made, replaced 13 months later and never extended by a visit), the visit's number (wv_sess) and
// each event's step in the visit (seq) go with the events, so returns, retention and the point where people stop can be
// read. The worker keeps the id only as a keyed hash (feedback-worker/usage.js). The kiné path (AGGREGATE_ONLY) is sent
// alone, without the id. Within the CNIL's audience-measurement exemption (docs/privacy/cnil-audience-grid.md). Under
// Global Privacy Control, Do Not Track or the opt-out, no id is made, and turning the counting off deletes it.
// The paragraph below described the counts before that day; its "no identifier" no longer holds.
//
// What leaves the phone, and only when the build names a server (VITE_EVENTS_URL): an event's name from the list in
// feedback-worker/usage-schema.js, the lift and its tier where the event carries them, a visit's length in one of four
// buckets, the app's version and the language. No identifier of any kind (nothing is stored to tell this phone from
// another: no cookie, no id, no timestamp), no video, no pose, no count of reps. The server keeps only daily totals.
//
// Nothing is sent, the first opening included, when no server is named, when the browser asks sites not to track
// (Global Privacy Control, Do Not Track), or after the person turns the counting off on the choice screen or in the
// notice (Choice.jsx, UsageNotice.jsx): that choice is the one thing written on the phone, and it holds no identifier.
import { USAGE_EVENTS, MAX_BATCH, AGGREGATE_ONLY, AID_RE, durationBucket, validEvent } from '../../feedback-worker/usage-schema.js';
import { appVersion } from './reportLinks';
import { tierOf } from './offer';

const ENDPOINT = import.meta.env.VITE_EVENTS_URL || '';
const OFF_KEY = 'wv_count_off';
const AID_KEY = 'wv_aid';
const SESS_KEY = 'wv_sess';
// The id's life: 13 months, the CNIL's longest for an audience-measurement tracker, counted from the day it was made
// and never extended. 13 x 30.4 days, rounded down. Status: literature (CNIL, audience measurement; check at cnil.fr).
export const AID_LIFE_DAYS = 395;
// Events wait this long to leave together, so a visit makes a few requests, not one per tap. Status: convention.
const FLUSH_MS = 4000;
// A page that sends more than this has a bug looping: it stops sending. A visit sends about fifteen. Status: convention.
const MAX_PER_PAGE = 200;

let queue = [];
let timer = 0;
let sent = 0;

/** True when the build names a server for the counts. */
export const eventsConfigured = () => !!ENDPOINT;

/** The host the counts go to, as the notice names it (UsageNotice.jsx), or '' when the build names none. */
export function eventsHost(url = ENDPOINT) {
  try { return url ? new URL(url).host : ''; } catch { return ''; }
}

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
  if (off) {
    queue = []; clearTimeout(timer); timer = 0; offThisVisit = true; openPending = false;
    try { globalThis.localStorage?.removeItem(AID_KEY); globalThis.localStorage?.removeItem(SESS_KEY); } catch { /* nothing kept */ }
    aid = null; sess = 0;
  } else offThisVisit = false;
}
let offThisVisit = false;

// This page's phone id and visit number, set by startEvents; null and 0 when none was made (counting off, storage
// refused): the events then go without them, counted in the daily totals only.
let aid = null;
let sess = 0;
let seq = 0;
const today = () => new Date().toISOString().slice(0, 10);
const ageDays = day => (Date.parse(today()) - Date.parse(day)) / 86400000;

/** This phone's id, made on the first visit and replaced once AID_LIFE_DAYS old; null when storage refuses it. */
export function phoneId() {
  try {
    const kept = JSON.parse(globalThis.localStorage?.getItem(AID_KEY) || 'null');
    if (kept && AID_RE.test(kept.id) && /^\d{4}-\d{2}-\d{2}$/.test(kept.born) && ageDays(kept.born) >= 0 && ageDays(kept.born) < AID_LIFE_DAYS) return kept.id;
    const b = new Uint8Array(16);
    globalThis.crypto.getRandomValues(b);
    const id = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
    globalThis.localStorage.setItem(AID_KEY, JSON.stringify({ id, born: today() }));
    return JSON.parse(globalThis.localStorage.getItem(AID_KEY)).id === id ? id : null;
  } catch { return null; }
}

/** The next visit's number on this phone (1, 2, …); 0 when storage refuses it. */
function nextVisit() {
  try {
    const n = (Number.parseInt(globalThis.localStorage?.getItem(SESS_KEY) || '0', 10) || 0) + 1;
    globalThis.localStorage.setItem(SESS_KEY, String(n));
    return n;
  } catch { return 0; }
}

/** True when an event would be sent now. */
export const eventsActive = () => eventsConfigured() && !browserRefuses() && !offThisVisit && !countingOff();

// The language the app shows, from React state (LanguageContext.jsx, through setEventsLang in App.jsx), never read
// from storage here (PRIV-4, docs/SPEC-production.md). Until the app has rendered once it is unknown, and nothing is
// counted: the opening waits for it (startEvents).
let uiLang = null;
let openPending = false;

/** The language the app shows, set on every render of the app; the opening, if it waits, is counted then. */
export function setEventsLang(lang) {
  if (lang !== 'fr' && lang !== 'en') return;
  uiLang = lang;
  if (openPending) { openPending = false; track('open'); }
}

/**
 * Counts one event: its name from the list, and of `props` only the fields that event carries (lift, durationBucket).
 * The tier is the lift's own (offer.js). Any other field is dropped. Returns true when the event was queued.
 */
export function track(event, props = {}) {
  if (!eventsActive() || !uiLang || !Object.prototype.hasOwnProperty.call(USAGE_EVENTS, event)) return false;
  const allowed = USAGE_EVENTS[event];
  const e = { event };
  if (allowed.includes('lift') && typeof props?.lift === 'string' && props.lift) {
    e.lift = props.lift;
    const tier = tierOf(props.lift);
    if (tier === 'beta' || tier === 'experimental') e.tier = tier;
  }
  if (allowed.includes('durationBucket') && props?.durationBucket) e.durationBucket = props.durationBucket;
  e.appVersion = appVersion() || '0.0.0';
  e.lang = uiLang;
  const alone = AGGREGATE_ONLY.includes(event);
  if (!alone && aid) e.seq = seq;
  if (!validEvent(e) || sent >= MAX_PER_PAGE) return false;
  sent += 1;
  // The kiné path leaves at once, alone, with no id, visit or step: it is counted in the daily totals only.
  if (alone) { post(JSON.stringify({ events: [e] })); return true; }
  if (aid) seq += 1;
  queue.push(e);
  if (queue.length >= MAX_BATCH) flushEvents();
  else if (!timer) timer = setTimeout(flushEvents, FLUSH_MS);
  return true;
}

/** Sends the events waiting, now. */
export function flushEvents() {
  clearTimeout(timer);
  timer = 0;
  while (queue.length) post(JSON.stringify({ events: queue.splice(0, MAX_BATCH), ...(aid && sess ? { aid, sess } : {}) }));
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
 * Counts the app's opening, once the app shows its language, and at the end of the visit its length, in a bucket.
 * The start is kept in memory only. Waiting events leave whenever the page is hidden, as a page in the background may
 * never come back. Under Global Privacy Control, Do Not Track or the person's opt-out, nothing at all is set up: no
 * opening, no listener (PRIV-4). A count turned back on during the visit counts from the next tap, not this opening.
 */
export function startEvents(now = () => globalThis.performance?.now?.() ?? Date.now()) {
  if (started || !eventsActive()) return;
  started = true;
  const t0 = now();
  aid = phoneId();
  sess = aid ? nextVisit() : 0;
  if (!sess) aid = null;
  seq = 0;
  if (uiLang) track('open'); else openPending = true;
  let ended = false;
  globalThis.addEventListener?.('pagehide', () => {
    if (!ended) { ended = true; track('session_end', { durationBucket: durationBucket(now() - t0) }); }
    flushEvents();
  });
  globalThis.document?.addEventListener?.('visibilitychange', () => { if (globalThis.document.visibilityState === 'hidden') flushEvents(); });
}
