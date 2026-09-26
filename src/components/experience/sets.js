// The sets saved on this phone, newest first, read once and kept until one is
// saved or deleted. Old versions of the app saved sets too; they are listed alike.
import { useEffect, useState } from 'react';
import { getWorkouts, deleteWorkout } from '../../lib/storage';

let pending = null, known = null;

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
  loadSets().catch(() => {});
}

/** The sets, if already read: a screen can show them from its first frame. */
export const knownSets = () => known;

export async function removeSet(id) {
  await deleteWorkout(id);
  if (known) { known = known.filter(w => w.id !== id); pending = Promise.resolve(known); }
  else pending = null;
}

export const setTime = w => new Date(w.createdAt ?? w.date).getTime();

// What the app itself counted: kept apart since this version, and derivable
// from the counted reps (or the old app's own field) for sets saved before.
export function countedBy(w) {
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
