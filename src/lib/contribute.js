// "Aider à améliorer le comptage" (David, 2 October 2026: every Yes and No on a count is how the counter
// learns, and old and new phones may count differently). Opt-in, asked openly, revocable: with it on, each
// saved set keeps on the phone a contribution: what the app counted and what the person kept, the pose the
// count was made from (joint positions per sample, never the video), the decoder and the phone's kind. The
// person sends them when and where they choose, through the share sheet; turning it off erases the waiting
// ones. The file keeps the batch collector's fields (collector.js), so the measuring tools read it.
import localforage from 'localforage';
import { TARGET_FPS, MAX_LONG_SIDE } from './extractionConfig';

export const CONTRIBUTION_KIND = 'workout-vision-contribution';
// Version 2 (2 October 2026): every record says how its count was given (labelKind).
export const CONTRIBUTION_VERSION = 2;
/**
 * How a contribution's count was given. 'after-app': the person kept or corrected the count after the app showed
 * its own, so the count leans toward the app's answer and is weaker truth than a count made without seeing it
 * (audit FINDING-008). Such a count never enters a scoreboard, an exam or a training set as ground truth (R1);
 * only a record marked 'blind' could, and the app makes none.
 */
export const isBlindLabel = rec => rec?.labelKind === 'blind';
const CHOICE_KEY = 'wv_contribute';
const store = localforage.createInstance({ name: 'workoutVision', storeName: 'contributions' });

/** 'yes', 'no', or null when the person has not been asked. */
export function readChoice() {
  try { const v = localStorage.getItem(CHOICE_KEY); return v === 'yes' || v === 'no' ? v : null; } catch { return null; }
}
export function writeChoice(v) {
  try { localStorage.setItem(CHOICE_KEY, v); return true; } catch { return false; }
}
/**
 * The choice saved, and read back: true only when the phone now holds it (audit FINDING-016: a stop the phone
 * could not save showed as stopped, and the stored yes went on collecting). A no that cannot be written still
 * holds if the yes can be removed, since only a stored yes collects.
 */
export function persistChoice(v) {
  writeChoice(v);
  if (v === 'no' && readChoice() === 'yes') { try { localStorage.removeItem(CHOICE_KEY); } catch { /* checked below */ } }
  return v === 'yes' ? readChoice() === 'yes' : readChoice() !== 'yes';
}
// The question is shown once, answered or not, as the level question is (level.js).
const ASKED_KEY = 'wv_contribute_asked';
export function contributeAsked() { try { return localStorage.getItem(ASKED_KEY) === 'true'; } catch { return true; } }
export function markContributeAsked() { try { localStorage.setItem(ASKED_KEY, 'true'); } catch { /* asked again next time */ } }

// Landmarks rounded to five decimals (a hundredth of a millimetre in the world frame, a hundred-thousandth of
// the image): the file is about half the size and no count changes at that precision.
const r5 = v => (typeof v === 'number' ? Math.round(v * 1e5) / 1e5 : v);
const roundFrames = frames => (frames || []).map(f => (f ? f.map(p => (p ? { x: r5(p.x), y: r5(p.y), z: r5(p.z), visibility: r5(p.visibility) } : p)) : f));

/** The phone's kind, as the browser states it: no name, no account, no location, no identifier. */
export function deviceInfo(nav = globalThis.navigator, scr = globalThis.screen, win = globalThis) {
  return {
    userAgent: nav?.userAgent ?? null,
    platform: nav?.platform ?? null,
    cores: nav?.hardwareConcurrency ?? null,
    memoryGb: nav?.deviceMemory ?? null,
    touchPoints: nav?.maxTouchPoints ?? null,
    screen: scr ? { width: scr.width, height: scr.height, pixelRatio: win?.devicePixelRatio ?? null } : null,
  };
}

/** One saved set as a contribution: the collector's fields, then what the app counted and what was kept. */
export function contribution({ result, lift, kept, setId, appVersion, device = deviceInfo(), now = new Date() }) {
  const m = result?.metadata || {};
  return {
    kind: CONTRIBUTION_KIND,
    contributionVersion: CONTRIBUTION_VERSION,
    setId,
    savedAt: now.toISOString(),
    lift,
    count: kept,
    labelKind: 'after-app',
    appCount: result?.count ?? null,
    corrected: kept !== result?.count,
    arm: result?.arm ?? null,
    worldLandmarks: roundFrames(result?.worldLandmarks),
    imageLandmarks: roundFrames(result?.imageLandmarks),
    timestamps: result?.timestamps ?? [],
    frame: { width: m.width ?? null, height: m.height ?? null },
    extraction: { fps: TARGET_FPS, maxLongSide: MAX_LONG_SIDE },
    metadata: { extractionMethod: m.method ?? null, duration: m.duration ?? null, sampleCount: result?.timestamps?.length ?? null, rotationDecision: m.rotationDecision ?? null },
    device,
    version: appVersion,
  };
}

export async function keepContribution(c) { await store.setItem(c.setId, c); }
export async function contributions() {
  const out = [];
  await store.iterate(v => { out.push(v); });
  return out.sort((a, b) => String(a.savedAt).localeCompare(String(b.savedAt)));
}
export async function eraseContributions() { await store.clear(); }
export async function forgetContributions(ids) { for (const id of ids) await store.removeItem(id); }

/**
 * The waiting contributions as one file: gzip where the browser can compress, plain JSON otherwise. The phone's
 * own keys (setId, which holds the time of saving) and the time of each set stay on the phone: the file holds
 * what the person was told it holds.
 */
export async function contributionsFile(list, now = new Date(), CS = globalThis.CompressionStream) {
  const sets = list.map(({ setId: _id, savedAt: _at, ...c }) => c);
  const text = JSON.stringify({ kind: `${CONTRIBUTION_KIND}s`, contributionVersion: CONTRIBUTION_VERSION, sets });
  // The phone's own date: a file made at 00:30 in Paris carries that day, not the UTC one before it.
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const base = `workout-vision-contributions-${day}-${list.length}`;
  if (typeof CS === 'function') {
    const gz = await new Response(new Blob([text]).stream().pipeThrough(new CS('gzip'))).blob();
    return new File([gz], `${base}.json.gz`, { type: 'application/gzip' });
  }
  return new File([text], `${base}.json`, { type: 'application/json' });
}
