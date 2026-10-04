// The sets saved on this phone, newest first, read once and kept until one is
// saved or deleted. Old versions of the app saved sets too; they are listed alike.
import { useEffect, useState } from 'react';
import { getWorkouts, deleteWorkout } from '../../lib/storage';

let pending = null, known = null;

// Two tabs of the app share one storage: a change in one tells the others to read the sets again, so a backup
// or an export made in either holds them all (second audit, 3 October). A screen already open hears it too
// (onSetsChanged): the history reads its list again, since its backup and export are built inside the tap from
// the list it shows (third audit C19, 3 October). Where the browser has no channel, each tab keeps reading on
// its own, as before.
let channel = null;
const listeners = new Set();
try { channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('wv-sets') : null; } catch { channel = null; }
if (channel) channel.onmessage = e => {
  if (e.data !== 'changed') return;
  pending = null; known = null;
  for (const cb of [...listeners]) { try { cb(); } catch { /* one screen's failure leaves the others told */ } }
};
/** Calls cb when another tab changes the sets; returns the function that stops it. */
export function onSetsChanged(cb) { listeners.add(cb); return () => { listeners.delete(cb); }; }
const tellOthers = () => { try { channel?.postMessage('changed'); } catch { /* the other tabs read on their own */ } };

export function loadSets() {
  if (!pending) {
    const mine = pending = getWorkouts({ limit: Number.MAX_SAFE_INTEGER })
      .then(list => list.filter(w => (w.exercise || w.exerciseKey) && Number.isFinite(w.reps) && Number.isFinite(setTime(w))))
      .then(list => { if (pending === mine) known = list; return list; }, e => { if (pending === mine) pending = null; throw e; });
  }
  return pending;
}

/** After a set is saved: read the sets again now, so the next screen has them at once. */
export function refreshSets() {
  pending = null; known = null;
  tellOthers();
  loadSets().catch(() => {});
}

/** The sets, if already read: a screen can show them from its first frame. */
export const knownSets = () => known;

export async function removeSet(id) {
  await deleteWorkout(id);
  tellOthers();
  if (known) { known = known.filter(w => w.id !== id); pending = Promise.resolve(known); }
  else pending = null;
}

export const setTime = w => new Date(w.createdAt ?? w.date).getTime();

/**
 * The set a report compares with: the last saved set of the same lift strictly before this one, whose
 * reps were measured with step 3c's boundaries; never the set itself (just saved, it is the newest)
 * nor a later one (a set opened from the history). self: { id, at } of the set reported.
 */
export function previousSet(all, lift, self) {
  const prev = (all || []).filter(w => (w.exercise || w.exerciseKey) === lift && w.id !== self.id && setTime(w) < self.at
    && w.repDetails?.length && w.repDetailsVersion >= 2)
    .sort((a, b) => setTime(b) - setTime(a))[0];
  return prev ?? null;
}

// What the app itself counted: kept apart since this version, and derivable
// from the counted reps (or the old app's own field) for sets saved before.
/** The lifts of the newest sets, each once, newest first, at most n: the "Récents" of the choice (WP1.5). */
export function recentLifts(all, n = 3) {
  const out = [];
  for (const w of all || []) {
    const k = w.exercise || w.exerciseKey;
    if (k && !out.includes(k)) out.push(k);
    if (out.length === n) break;
  }
  return out;
}

// A set typed by hand (ManualLog.jsx's, or one the app refused, WP1.6) has no count of the app: null.
export function countedBy(w) {
  if (w.source === 'manual') return null;
  if (w.correctedResult && Number.isFinite(w.machineResult?.reps)) return w.machineResult.reps;
  if (w.corrected && Array.isArray(w.repDetails)) return w.repDetails.length;
  if (w.repsOverridden && Number.isFinite(w.machineReps)) return w.machineReps;
  return w.reps;
}

/**
 * Show the choice after at most `wait` ms, then publish any late storage result
 * so a slow first read cannot hide access to the visitor's saved sets.
 * undefined while waiting, null when storage has not answered or failed.
 */
export function useSets(wait = 300) {
  const [sets, setSets] = useState(known ?? undefined);
  useEffect(() => {
    if (known) return undefined;
    let live = true;
    const late = setTimeout(() => { if (live) setSets(s => (s === undefined ? null : s)); }, wait);
    loadSets().then(list => { if (live) setSets(list); }, () => { if (live) setSets(null); });
    return () => { live = false; clearTimeout(late); };
  }, [wait]);
  return sets;
}
