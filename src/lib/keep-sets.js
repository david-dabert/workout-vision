// Keeping the sets on the phone (David, 2 October 2026, for the kinésithérapeute who asked whether the app
// keeps a person's records). Three parts:
// - asking the browser to keep the app's storage (navigator.storage.persist), so it is not cleared first
//   when the phone runs short of space. Whether that also exempts the app from Safari's deletion of a site's
//   data after seven days of use without a visit is UNSOURCED, so the warning below does not rely on it;
// - a backup file holding every set the history lists (counts, corrections, rep details), written on the
//   phone and shared only where the person chooses;
// - restoring that file on any phone, adding only the sets it does not already hold.
// Safari's seven-day deletion of script-writable storage for sites not added to the home screen: WebKit,
// "Full Third-Party Cookie Blocking and More", 24 March 2020. Status: literature, not measured by us.
import { restoreWorkout } from './storage';

export const BACKUP_KIND = 'workout-vision-sets';
export const BACKUP_VERSION = 1;

/** Asks once that the app's storage be kept; resolves to whether it is (false where the browser cannot say). */
export async function askToKeep() {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch { return false; }
}

/** Whether this is an iPhone or iPad (iPadOS reports a Mac with a touch screen), where Safari's seven-day
 * deletion applies to a site not added to the home screen. */
export function onIOS(nav = navigator) {
  return /iPhone|iPad|iPod/.test(nav.userAgent || '') || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
}

/** Whether the app runs from the home screen (iOS standalone, or an installed web app). */
export function onHomeScreen() {
  try { return navigator.standalone === true || matchMedia('(display-mode: standalone)').matches; } catch { return false; }
}

const pad = n => String(n).padStart(2, '0');
/** The phone's own date, 2026-10-03: a file saved at 00:30 in Paris carries that day, not the UTC one before it. */
export const localDay = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The backup file's text and name: every set the history lists, with the file's own kind and version. */
export function backupFile(sets, now = new Date()) {
  const day = localDay(now);
  const text = JSON.stringify({ kind: BACKUP_KIND, version: BACKUP_VERSION, savedAt: now.toISOString(), sets }, null, 1);
  return { name: `workout-vision-series-${day}.json`, text };
}

/**
 * The sets a backup file holds, each checked: an id, an exercise, a whole number of reps, a date. A file of
 * another kind or a later version is refused as a whole; a set that fails the check is left out and counted.
 */
export function readBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch { return { error: 'unreadable' }; }
  if (!data || data.kind !== BACKUP_KIND || !Array.isArray(data.sets)) return { error: 'not-a-backup' };
  if (!(data.version <= BACKUP_VERSION)) return { error: 'newer-version' };
  const sets = [], skipped = [];
  for (const w of data.sets) {
    const ok = w && typeof w === 'object' && typeof w.id === 'string' && w.id
      && (typeof w.exercise === 'string' || typeof w.exerciseKey === 'string')
      && Number.isInteger(w.reps) && w.reps >= 0
      && Number.isFinite(new Date(w.createdAt ?? w.date).getTime());
    (ok ? sets : skipped).push(w);
  }
  return { sets, skipped: skipped.length };
}

/** Puts a backup's sets back on this phone; returns how many were added and how many were already here. */
export async function restoreBackup(sets, put = restoreWorkout) {
  // Written one by one: a write that fails part-way says how many went in and how many did not, so the person
  // is not told nothing was restored (audit of 2 October). A first write that fails fails the whole restore.
  let added = 0, present = 0;
  for (const [i, w] of sets.entries()) {
    try { if (await put(w)) added++; else present++; }
    catch (e) { if (i === 0) throw e; return { added, present, failed: sets.length - i }; }
  }
  return { added, present };
}
