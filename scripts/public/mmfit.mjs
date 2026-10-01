/**
 * MM-Fit (Strömbäck, Huang and Radu, 2020; https://zenodo.org/records/7672767, CC BY 4.0): 21 workouts
 * filmed front on, each labelled by people with every set's first and last frame, its rep count and its
 * exercise, in labels/mm-fit/<wNN>/<wNN>_labels.csv as "start,end,count,activity" (the format
 * scripts/run-mmfit.mjs reads). It marks no single rep, so its sets carry no rep marks. All the sets of a
 * workout come from one video, so they share its group and fall in the same half (scripts/public/split.mjs).
 * Push-ups map to push_up, which the app now counts, where scripts/run-mmfit.mjs of 27 September used
 * bench_press.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// MM-Fit's activities, to the app's lift keys (src/lib/counting/core.ts LIFTS, guide-patterns.json);
// sit-ups and jumping jacks are not lifts the app counts.
export const MMFIT_LIFTS = {
  squats: 'squat', pushups: 'push_up', dumbbell_shoulder_press: 'overhead_press', lunges: 'lunge', dumbbell_rows: 'dumbbell_row',
  tricep_extensions: 'triceps_pushdown', bicep_curls: 'bicep_curl_alternating', lateral_shoulder_raises: 'lateral_raise',
};

export function parseMmfitLabels(text) {
  return text.trim().split(/\r?\n/).map(line => {
    const [start, end, count, activity] = line.split(',').map(s => s.trim());
    return { start: Number(start), end: Number(end), count: Number(count), activity };
  });
}

export function mmfitManifest(root) {
  const sets = [], skipped = [];
  const labelRoot = join(root, 'labels', 'mm-fit');
  for (const workout of readdirSync(labelRoot).sort()) {
    const file = join(labelRoot, workout, `${workout}_labels.csv`), video = join(root, `${workout}_rgb.mp4`);
    if (!existsSync(file)) continue;
    if (!existsSync(video)) { skipped.push(`${workout}: no video`); continue; }
    for (const l of parseMmfitLabels(readFileSync(file, 'utf8'))) {
      const id = `${workout}-${l.activity}-${l.start}-${l.end}`, lift = MMFIT_LIFTS[l.activity];
      if (!lift) { skipped.push(`${id}: ${l.activity} is not a lift the app counts`); continue; }
      if (![l.start, l.end, l.count].every(Number.isInteger) || l.end <= l.start) { skipped.push(`${id}: label not readable`); continue; }
      sets.push({ id, group: workout, dataset: 'mmfit', video, lift, count: l.count, repFrames: [], trimFrames: [l.start, l.end] });
    }
  }
  return { sets, skipped };
}
