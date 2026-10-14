// The person's last set, as the coach finder and the messaging demo show it (honesty pass of 14 October 2026, FND-3,
// CHT-3): the exercise's own name, the count the person kept, the app's count when it differs, and the day. Nothing
// else: the "form score" was pose coverage under another name, the symmetry printed "[object Object] %", and fixed
// stand-ins (8 reps, 92 %, 96 %, 2 partials) filled what a set lacked. French awaiting David's approval (R10).
import { exerciseName } from '../experience/exercise-info';
import { setTime, countedBy } from '../experience/sets';

const NBSP = '\u00A0';

/** The latest set's line, or null when the phone holds none. */
export function lastSetLine(sets, lang) {
  const fr = lang === 'fr';
  const list = (Array.isArray(sets) ? sets : []).filter(w => w && Number.isFinite(w.reps) && (w.exercise || w.exerciseKey));
  if (!list.length) return null;
  const w = list.reduce((a, b) => (setTime(b) > setTime(a) ? b : a));
  const name = exerciseName(w.exercise || w.exerciseKey, lang);
  const n = w.reps, app = countedBy(w);
  const day = new Date(setTime(w)).toLocaleDateString(fr ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long' });
  const reps = fr ? `${n}${NBSP}répétition${n > 1 ? 's' : ''}` : `${n} rep${n === 1 ? '' : 's'}`;
  const differs = Number.isFinite(app) && app !== n ? (fr ? ` (l’appli en avait compté ${app})` : ` (the app counted ${app})`) : '';
  return fr ? `${name}, ${reps}${differs}, le ${day}` : `${name}, ${reps}${differs}, on ${day}`;
}
