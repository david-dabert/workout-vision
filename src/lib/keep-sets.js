// Keeping the sets on the phone (David, 2 October 2026, for the kinésithérapeute who asked whether the app
// keeps a person's records). Three parts:
// - asking the browser to keep the app's storage (navigator.storage.persist): Safari may otherwise delete a
//   site's stored data after seven days of Safari use without a visit, unless the app is on the home screen
//   (WebKit, "Full Third-Party Cookie Blocking and More", 24 March 2020). Status: literature (browser
//   documentation), not measured by us;
// - a backup file holding every set as saved (counts, corrections, rep details), on the phone, never sent;
// - restoring that file on any phone, adding only the sets it does not already hold.
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

/** Whether the app runs from the home screen (iOS standalone, or an installed web app). */
export function onHomeScreen() {
  try { return navigator.standalone === true || matchMedia('(display-mode: standalone)').matches; } catch { return false; }
}

/** The backup file's text and name: every set as stored, with the file's own kind and version. */
export function backupFile(sets, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
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
  let added = 0, present = 0;
  for (const w of sets) { if (await put(w)) added++; else present++; }
  return { added, present };
}
