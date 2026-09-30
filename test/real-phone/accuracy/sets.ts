// Every labelled build set on disk, read one way for the scoreboard and the diagnoses: each folder
// test/real-phone/sets-*/ (David's collected sets, one folder per session) and the build clips in
// landmarks/. A set is never dropped quietly: a file whose lift or count cannot be read is returned in
// `unreadable`, and the scoreboard fails on it (reviews, 30 September).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';

export const ROOT = resolve(__dirname, '..');
export type LabelledSet = { name: string; lift: string; label: number; wl: any[]; ts: number[] };

export function labelledSets() {
  const sets: LabelledSet[] = [], unreadable: string[] = [];
  const dirs = readdirSync(ROOT).filter(d => /^sets-/.test(d) && statSync(resolve(ROOT, d)).isDirectory()).sort();
  for (const dir of [...dirs, 'landmarks']) {
    for (const f of readdirSync(resolve(ROOT, dir)).filter(f => f.endsWith('.json.gz')).sort()) {
      const name = `${dir}/${f}`;
      let d: any;
      try { d = JSON.parse(gunzipSync(readFileSync(resolve(ROOT, dir, f))).toString()); }
      catch { unreadable.push(name); continue; }
      // A collector's file carries its lift and count; the oldest build clips carry them in their name only
      // (a batch file's name is led by its set number: set07_squat_8_side_…).
      const m = f.match(/^(?:set\d+_)?(.+?)_(\d+)_/);
      const lift = d.lift ?? m?.[1], label = d.count ?? (m ? Number(m[2]) : undefined);
      if (!lift || !Number.isInteger(label) || !Array.isArray(d.worldLandmarks)) { unreadable.push(name); continue; }
      sets.push({ name, lift, label, wl: d.worldLandmarks, ts: d.timestamps });
    }
  }
  return { sets, unreadable };
}
