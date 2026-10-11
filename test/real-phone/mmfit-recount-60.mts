/**
 * Re-run 60 MM-Fit sets through the current core.ts and compare counts.
 *
 * Selection rule (fixed, stated before the run):
 *   For each of the 10 MM-Fit classes, take the first 6 sets in
 *   alphabetical order by set ID from results.json that have a
 *   landmark file on disk. Classes without a lift mapping (situps,
 *   jumping_jacks) are included to confirm they remain unsupported.
 *
 * Each set's landmarks are loaded from ~/Datasets/MM-Fit/all-sets-final/landmarks/,
 * countReps is called with the current core.ts, and the count is compared
 * to the old count in results.json.
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { countReps } from '../../src/lib/counting/core.js';

const liftMap: Record<string, string | null> = {
  squats: 'squat',
  pushups: 'bench_press',
  dumbbell_shoulder_press: 'overhead_press',
  lunges: 'lunge',
  dumbbell_rows: 'dumbbell_row',
  situps: null,
  tricep_extensions: 'triceps_pushdown',
  bicep_curls: 'bicep_curl_alternating',
  lateral_shoulder_raises: 'lateral_raise',
  jumping_jacks: null,
};

const landmarksDir = join(homedir(), 'Datasets/MM-Fit/all-sets-final/landmarks');
const resultsPath = 'test/real-phone/mmfit/results.json';
const results = JSON.parse(readFileSync(resultsPath, 'utf8'));

// Group rows by activity class
const byClass = new Map<string, typeof results.rows>();
for (const row of results.rows) {
  const parts = row.id.split('-');
  const activity = parts.slice(1, -2).join('-');
  if (!byClass.has(activity)) byClass.set(activity, []);
  byClass.get(activity)!.push(row);
}

console.log('SELECTION RULE: For each of 10 MM-Fit classes, first 6 sets alphabetically by ID that have landmarks on disk.\n');

const selected: { id: string; activity: string; lift: string | null; oldCount: number | null; newCount: number | null; expected: number; match: boolean }[] = [];

for (const [activity, rows] of [...byClass.entries()].sort()) {
  const sorted = rows.sort((a: any, b: any) => a.id.localeCompare(b.id));
  let picked = 0;
  for (const row of sorted) {
    if (picked >= 6) break;
    const lmFile = join(landmarksDir, `${row.id}.json.gz`);
    let data;
    try {
      const gz = readFileSync(lmFile);
      data = JSON.parse(gunzipSync(gz).toString());
    } catch {
      continue; // no landmark file
    }

    const lift = liftMap[activity] ?? null;
    let newCount: number | null = null;
    if (lift) {
      const result = countReps(data.worldLandmarks, data.timestamps, lift as any);
      newCount = result.count;
    }

    selected.push({
      id: row.id,
      activity,
      lift,
      oldCount: row.count ?? null,
      newCount,
      expected: row.expected,
      match: row.count === newCount || (row.count == null && newCount == null),
    });
    picked++;
  }
}

// Print table
console.log('| Set | Class | Lift | Label | Old | New | Match |');
console.log('|---|---|---|---:|---:|---:|---|');
let anyDiff = false;
for (const s of selected) {
  const oldStr = s.oldCount != null ? String(s.oldCount) : '—';
  const newStr = s.newCount != null ? String(s.newCount) : '—';
  const matchStr = s.match ? '✓' : '✗ DIFF';
  if (!s.match) anyDiff = true;
  console.log(`| ${s.id} | ${s.activity} | ${s.lift ?? '—'} | ${s.expected} | ${oldStr} | ${newStr} | ${matchStr} |`);
}

console.log(`\nTotal: ${selected.length} sets. ${anyDiff ? 'SOME DIFFER — STOP' : 'ALL MATCH'}`);

if (anyDiff) {
  console.log('\nDifferences found:');
  for (const s of selected.filter(s => !s.match)) {
    console.log(`  ${s.id}: old=${s.oldCount}, new=${s.newCount} (label=${s.expected})`);
  }
  process.exit(1);
}
