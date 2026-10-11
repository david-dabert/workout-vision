// Every labelled build set on disk, read one way for the scoreboard and the diagnoses: each folder
// test/real-phone/sets-*/ (David's collected sets, one folder per session) and the build clips in
// landmarks/. A set is never dropped quietly: a file whose lift or count cannot be read is returned in
// `unreadable`, and the scoreboard fails on it (reviews, 30 September).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
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

// A set's name with its count taken out: sets-29sep/leg_press_13_side_1ee0ae47.json.gz reads
// sets-29sep/leg_press side 1ee0ae47.
export const blind = (name: string) => name.replace(/\.json\.gz$/, '').replace(/^(.*\/)?(?:set\d+_)?(.+?)_\d+_([a-z]+)_([0-9a-z]+)$/, '$1$2 $3 $4');

// Public labelled sets (scripts/public/run-public.mjs): test/real-phone/public/<dataset>/<build|holdout>/.
// The scoreboard and the diagnoses read the build half; the held-out half is read only by its own script,
// run with HOLDOUT=1 (scripts/public/split.mjs).
export type PublicSet = LabelledSet & { dataset: string; reps: [number, number][]; visibleShare: number; window?: [number, number] };

// A set kept whole with its labelled window beside it (countix-whole): only the counted reps whose middle
// falls inside the window are its count, as the label counts only the reps inside it.
export function countInWindow(reps: { startTime: number; endTime: number }[], window?: [number, number]) {
  if (!window) return reps.length;
  return reps.filter(r => { const m = (r.startTime + r.endTime) / 2; return m >= window[0] && m <= window[1]; }).length;
}
export const PUBLIC = resolve(ROOT, 'public');

// Each dataset's record (<dataset>/sets.json, written by run-public.mjs) names every set of its manifest:
// a set recorded as written with no file is missing and fails the gate; a set that failed or was left out
// is listed with its reason; a written set outside the admission rule (scripts/public/admission.mjs) is
// listed, not scored.
export function publicSets(split: 'build' | 'holdout' = 'build') {
  if (split === 'holdout' && !process.env.HOLDOUT) throw new Error('The held-out half is read only by its own run (HOLDOUT=1).');
  const sets: PublicSet[] = [], unreadable: string[] = [], missing: string[] = [], notScored: string[] = [];
  let datasets: string[] = [];
  try { datasets = readdirSync(PUBLIC).filter(d => statSync(resolve(PUBLIC, d)).isDirectory()).sort(); } catch { return { sets, unreadable, missing, notScored }; }
  for (const ds of datasets) {
    let record: Record<string, { split?: string; status: string; reason?: string }> = {};
    try { record = JSON.parse(readFileSync(resolve(PUBLIC, ds, 'sets.json'), 'utf8')); } catch { unreadable.push(`public/${ds}/sets.json`); }
    for (const [id, r] of Object.entries(record)) {
      if (r.status !== 'written') { if (!r.split || r.split === split) notScored.push(`public/${ds}/${id}: ${r.status}: ${r.reason}`); continue; }
      if (r.split === split && !existsSync(resolve(PUBLIC, ds, split, `${id}.json.gz`))) missing.push(`public/${ds}/${split}/${id}.json.gz`);
    }
    const dir = resolve(PUBLIC, ds, split);
    let files: string[] = [];
    try { files = readdirSync(dir).filter(f => f.endsWith('.json.gz')).sort(); } catch { continue; }
    for (const f of files) {
      const name = `public/${ds}/${split}/${f}`;
      let d: any;
      try { d = JSON.parse(gunzipSync(readFileSync(resolve(dir, f))).toString()); }
      catch { unreadable.push(name); continue; }
      if (!d.lift || !Number.isInteger(d.count) || !Array.isArray(d.worldLandmarks) || !Array.isArray(d.reps) || d.split !== split) { unreadable.push(name); continue; }
      // A whole clip is scored inside its labelled window: without one, it would be scored on the whole clip.
      if (ds.endsWith('-whole') && !(Array.isArray(d.window) && d.window.length === 2)) { unreadable.push(name); continue; }
      if (d.admitted === false) { notScored.push(`${name}: not admitted: wrists and ankles seen together in ${Math.round(100 * d.visibleShare)}% of samples`); continue; }
      sets.push({ name, dataset: ds, lift: d.lift, label: d.count, wl: d.worldLandmarks, ts: d.timestamps, reps: d.reps, visibleShare: d.visibleShare, ...(d.window ? { window: d.window } : {}) });
    }
  }
  return { sets, unreadable, missing, notScored };
}
