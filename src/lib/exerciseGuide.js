// Canonical catalogue from @bryllim/workout-guide 1.0.0; artwork generated locally by scripts/copy-guide.js.
import catalogue from './guide-catalog.json';
const byKey = new Map(catalogue.map(e => [e.key, e]));
const aliases = { bicep_curl: 'dumbbell_curl', lateral_raise: 'lateral_raise', squat: 'squat', lunge: 'forward_lunge', leg_raise: 'lying_leg_raise', tricep_extension: 'overhead_tricep_extension', dumbbell_shoulder_press: 'seated_dumbbell_press', cable_tricep_pushdown: 'tricep_pushdown' };
export function getFrameUrl(slug, frame) { return `${import.meta.env.BASE_URL}guide/${slug}/frame-${frame}.webp`; }
export function getGuideExercise(key) {
  const entry = byKey.get(key) || byKey.get(aliases[key]);
  return entry ? { ...entry, frames: [1, 2, 3].map(i => getFrameUrl(entry.slug, i)) } : null;
}
export function getExerciseFrames(key) { return getGuideExercise(key); }
export function hasExerciseGuide(key) { return !!getGuideExercise(key); }
export function getSlug(key) { return getGuideExercise(key)?.slug || null; }
export function getMappedKeys() { return catalogue.map(e => e.key); }
export function getAllGuideExercises() { return catalogue.map(e => getGuideExercise(e.key)); }
