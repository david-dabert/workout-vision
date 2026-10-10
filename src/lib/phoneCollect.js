// Collecting David's labelled sets from the result screen (BACKLOG, 6 October 2026: "collecting David's sets
// without the collector"). On David's phone only, switched on by opening the app at #collecte (or ?collecte=1) and off
// at #collecte-off (or ?collecte=0): no screen of the app shows the switch. With it on, each video set whose count he
// keeps or corrects on the result screen also keeps, on this phone, the landmark file the collector would have made
// (collector.js setPayload, setFileName, gzipBlob), with the kept count, so no video is read a second time. The files
// leave the phone only when he taps "Envoyer les séries collectées" in the history (CollectHistory.jsx), through the
// share sheet; nothing is sent by itself.
//
// The count in the file was given after the app showed its own: the file says so (labelKind 'after-app', as
// contribute.js marks it, audit FINDING-008) and carries the app's count beside it. Whether such a set enters a
// scoreboard is David's decision (R1, R13); a blind recount is kept for the sets the scoreboard publishes.
// Since 9 October 2026 (blind.js) the file also carries the count David gave before the app showed its own, as
// blind: { count, p } (count null for "Je ne sais pas"), and a refused set he counted blind is kept as well, marked
// appRefused, with the app's proposal when it made one. The scoreboard reads blind.count as his blind label in a
// section of its own, which decides nothing until he says so (test/real-phone/accuracy/sets.ts, blindSets).
import localforage from 'localforage';
import { setFileName, setPayload, hashVideoContent, gzipBlob } from './collector';

export const COLLECT_KEY = 'wv_collecte';
const store = localforage.createInstance({ name: 'workoutVision', storeName: 'collected' });

/** Whether this phone collects (the flag David's phone carries). Unreadable storage collects nothing. */
export function collectOn(storage = globalThis.localStorage) {
  try { return storage?.getItem(COLLECT_KEY) === '1'; } catch { return false; }
}

/**
 * What the address asks: 'on' for #collecte or ?collecte=1, 'off' for #collecte-off or ?collecte=0, else null.
 * Exact words only, so no other address of the app switches it.
 */
export function collectAsked(hash = '', search = '') {
  const h = String(hash).replace(/^#\/?/, '').toLowerCase();
  if (h === 'collecte') return 'on';
  if (h === 'collecte-off') return 'off';
  const q = new URLSearchParams(search).get('collecte');
  if (q === '1') return 'on';
  if (q === '0') return 'off';
  return null;
}

/**
 * Applies the switch the address asks for, then takes it out of the address (so a reload or a shared link does not
 * switch it again). Returns 'on' or 'off' when the phone now holds that state, 'failed' when the phone could not
 * store it, null when the address asked nothing.
 */
export function applyCollectSwitch(loc = globalThis.location, storage = globalThis.localStorage, hist = globalThis.history) {
  const asked = collectAsked(loc?.hash, loc?.search);
  if (!asked) return null;
  try {
    if (asked === 'on') storage.setItem(COLLECT_KEY, '1');
    else storage.removeItem(COLLECT_KEY);
  } catch { /* checked below */ }
  try {
    const params = new URLSearchParams(loc.search);
    params.delete('collecte');
    const q = params.toString();
    const hash = collectAsked(loc.hash, '') ? '' : loc.hash;
    hist?.replaceState?.(hist.state ?? null, '', `${loc.pathname}${q ? `?${q}` : ''}${hash}`);
  } catch { /* the address keeps the word: harmless, the switch is idempotent */ }
  return collectOn(storage) === (asked === 'on') ? asked : 'failed';
}

// The switch applied when the app's code loads, before the router reads the address, and again when only the address's
// hash changes (Safari opening #collecte in a tab already on the app does not reload it). Read by the choice screen
// for its one-line confirmation.
let switched = null;
const listeners = new Set();
/** Applies the address's switch once per page load and returns what it did (see applyCollectSwitch). */
export function collectSwitchAtLoad() {
  if (switched === null) {
    switched = (typeof window !== 'undefined' && applyCollectSwitch()) || '';
    if (typeof window !== 'undefined') {
      // Registered before the app mounts, so it runs before the router's own listener and the router reads the
      // address with the word taken out.
      window.addEventListener('hashchange', () => {
        const now = applyCollectSwitch();
        if (now) { switched = now; listeners.forEach(f => f(now)); }
      });
    }
  }
  return switched || null;
}
/** Calls fn with 'on', 'off' or 'failed' whenever the hash switches it later in this page load; returns the stop. */
export function onCollectSwitch(fn) { listeners.add(fn); return () => listeners.delete(fn); }
/** The confirmation was shown: a later visit to the choice in this page load shows none. */
export function collectSwitchSeen() { switched = ''; }

/** SHA-256 hex of the landmarks, for a set whose video could not be hashed. */
export async function landmarksSha256(worldLandmarks) {
  const bytes = new TextEncoder().encode(JSON.stringify(worldLandmarks ?? []));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * One kept set as the collector's file (collector.js setPayload), with the count kept on the result screen, marked
 * 'after-app', and the app's own count. hashOf says whether videoSha256 is the video's or, failing that, the
 * landmarks' hash. view is the view the app asks this lift to be filmed from (exercise-info.js filmView), since the
 * result screen does not ask it; viewSource says so.
 */
export function collectedPayload({ result, lift, kept, view, sha256, hashOf, version, blind = null, choice = null }) {
  const m = result?.metadata || {};
  return {
    ...setPayload({
      worldLandmarks: result?.worldLandmarks ?? [],
      imageLandmarks: result?.imageLandmarks ?? [],
      timestamps: result?.timestamps ?? [],
      lift, count: kept, view, sha256,
      frameWidth: m.width ?? m.extractedWidth ?? null,
      frameHeight: m.height ?? m.extractedHeight ?? null,
      version, extractor: m,
    }),
    labelKind: 'after-app',
    appCount: result?.count ?? null,
    corrected: kept !== result?.count,
    hashOf,
    viewSource: 'app-guide',
    source: 'result-screen',
    ...(blind ? { blind: { count: Number.isInteger(blind.count) ? blind.count : null, p: blind.p ?? null } } : {}),
    // The list offered in one tap and how the count was given (result-choices.js, saved-set.js choice).
    ...(choice ? { choice } : {}),
    // The sensitivity check's recounts (coreAnalysis.js withSensitivity), so a blind count can say whether it was right.
    ...(result?.sensitivity ? { sensitivity: { moved: !!result.sensitivity.moved, counts: result.sensitivity.counts } } : {}),
    ...(result?.refused ? { appRefused: true, proposal: Number.isInteger(result.proposal?.count) && result.proposal.count > 0 ? result.proposal.count : null } : {}),
  };
}

/**
 * Keeps this set's file on the phone when the flag is on; returns its name, or null when the flag is off (nothing is
 * read, hashed or stored then). videoFile: the video the count was made from (its SHA-256 names the file, as the
 * collector names it); without it, or when it cannot be read, the landmarks' hash does.
 */
export async function collectThisSet({ result, lift, kept, view, videoFile = null, version, blind = null, choice = null, storage = globalThis.localStorage, put = (k, v) => store.setItem(k, v) }) {
  if (!collectOn(storage)) return null;
  if (!result || !Array.isArray(result.worldLandmarks) || !result.worldLandmarks.length || !Number.isInteger(kept)) return null;
  let sha256 = null, hashOf = 'video';
  if (videoFile) { try { sha256 = await hashVideoContent(videoFile); } catch { sha256 = null; } }
  if (!sha256) { sha256 = await landmarksSha256(result.worldLandmarks); hashOf = 'landmarks'; }
  const payload = collectedPayload({ result, lift, kept, view, sha256, hashOf, version, blind, choice });
  const blob = await gzipBlob(JSON.stringify(payload));
  const name = setFileName(lift, kept, view, sha256);
  await put(name, { name, blob, savedAt: new Date().toISOString() });
  return name;
}

/** The files waiting on this phone, oldest first, as File objects ready for the share sheet. */
export async function collectedFiles() {
  const out = [];
  await store.iterate(v => { if (v?.name && v.blob) out.push(v); });
  return out.sort((a, b) => String(a.savedAt).localeCompare(String(b.savedAt)))
    .map(v => new File([v.blob], v.name, { type: 'application/gzip' }));
}
/** How many files wait. */
export const collectedCount = () => store.length();
/** Forgets the files named (after they were shared). */
export async function forgetCollected(names) { for (const n of names) await store.removeItem(n); }
