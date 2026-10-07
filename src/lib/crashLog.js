// A crash log kept on the phone, with no server (crash at the demo of 7 October: the app was killed on David's iPhone
// while it analysed a gallery video, and nothing said where). The app writes a few breadcrumbs as it goes (the screen,
// the analysis phase, the sample reached, the frame size, the decoder, the last error) into localStorage, and marks the
// session clean whenever the page is hidden or left (pagehide, visibilitychange). A page the system kills while it is
// on screen (out of memory) leaves its breadcrumbs unclean: the next launch finds them and keeps them as an incident,
// which the choice of lift shows in one line until dismissed (Choice.jsx, CrashNote), with its detail to copy.
// A reload by the service worker after a deploy (main.jsx) is a navigation: pagehide marks it clean, never an incident.
// Every storage access is guarded: a browser that refuses storage (private mode) keeps no log and shows nothing.
// Limit: two tabs open at once share the log, and the second can take the first, still open, for an incident.

const LOG_KEY = 'wv_crash_log';
const INCIDENT_KEY = 'wv_crash_incident';
const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

// An unclean log older than this is not reported: a page killed in the background long ago, or a phone switched off,
// says nothing useful about the app. Source: the crash investigation's sketch (7 October). Status: convention, UNSOURCED.
export const INCIDENT_MAX_AGE_MS = 30 * 60 * 1000;

const read = key => {
  try { const s = globalThis.localStorage?.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; }
};
const write = (key, value) => {
  try { globalThis.localStorage?.setItem(key, JSON.stringify(value)); } catch { /* storage refused: no log */ }
};
const remove = key => {
  try { globalThis.localStorage?.removeItem(key); } catch { /* storage refused */ }
};

/**
 * The incident a previous session left, or null: its log was not marked clean and its last breadcrumb is less than
 * INCIDENT_MAX_AGE_MS old (a log from the future, a clock put back, is not one either).
 */
export function detectIncident(previous, now) {
  if (!previous || typeof previous !== 'object' || previous.clean !== false) return null;
  const at = Number(previous.at);
  if (!Number.isFinite(at) || now < at || now - at >= INCIDENT_MAX_AGE_MS) return null;
  return { ...previous, detectedAt: now };
}

let current = null;
let started = false;

const save = () => { if (current) write(LOG_KEY, current); };
const hidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

/** Marks the session clean (the page is hidden or left) or running again (visible). */
function setClean(clean) {
  if (!current) return;
  current.clean = clean;
  current.at = Date.now();
  save();
}

/**
 * Reads the previous session's log (an unclean one becomes the incident, kept until dismissed) and starts this one.
 * Called once, before the app renders (main.jsx).
 */
export function startCrashLog({ now = Date.now() } = {}) {
  if (started) return;
  started = true;
  const incident = detectIncident(read(LOG_KEY), now);
  if (incident) write(INCIDENT_KEY, incident);
  current = {
    v: 1, version: VERSION, started: now, at: now, clean: hidden(),
    screen: null, phase: null, lift: null, sample: null, frame: null, decoder: null, file: null, error: null,
    memory: typeof navigator !== 'undefined' && navigator.deviceMemory ? navigator.deviceMemory : null,
  };
  save();
  if (typeof window === 'undefined') return;
  window.addEventListener('pagehide', () => setClean(true));
  document.addEventListener('visibilitychange', () => setClean(hidden()));
  window.addEventListener('error', e => noteError(e?.error || e?.message));
  window.addEventListener('unhandledrejection', e => noteError(e?.reason));
}

/** Adds breadcrumbs (screen, phase, lift, sample, frame, decoder, file...) to this session's log. */
export function markCrash(fields) {
  if (!current) return;
  Object.assign(current, fields, { at: Date.now() });
  if (!hidden()) current.clean = false;
  save();
}

/** The last error seen: its name and message, and the start of its stack. */
export function noteError(error, where = '') {
  if (!current || error == null) return;
  const e = typeof error === 'object' ? error : { message: String(error) };
  markCrash({ error: { name: e.name || 'Error', message: String(e.message ?? e).slice(0, 300), stack: String(e.stack || '').slice(0, 600), where, at: Date.now() } });
}

/** The incident kept from a session that did not end cleanly, or null. */
export const pendingIncident = () => {
  const incident = read(INCIDENT_KEY);
  return incident && typeof incident === 'object' ? incident : null;
};

/** The incident is dismissed: it is no longer shown nor kept. */
export const dismissIncident = () => remove(INCIDENT_KEY);

/** Test hook: forgets the module state, so a test can start a new session. */
export function resetCrashLogForTests() { current = null; started = false; }
