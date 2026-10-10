// Every labelled build set on disk, read one way for the scoreboard and the diagnoses: each folder
// test/real-phone/sets-*/ (David's collected sets, one folder per session) and the build clips in
// landmarks/. A set is never dropped quietly: a file whose lift or count cannot be read is returned in
// `unreadable`, and the scoreboard fails on it (reviews, 30 September).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';

export const ROOT = resolve(__dirname, '..');
export type LabelledSet = { name: string; lift: string; label: number; wl: any[]; ts: number[] };

// PLAN.md (30 September): "Bench press and overhead press sets are measured but decide nothing, since no counting
// work is done on either until David films new press sets." Both scoreboards keep these sets in their tables, rows
// and committed baselines, and leave them out of the pass/fail tallies (third audit, C37, 3 October). Leg press is
// another lift and decides. Status: convention (David's order, recorded in PLAN.md), not a threshold.
export const PRESS_DECIDES_NOTHING = '(press: measured, decides nothing, PLAN.md)';
export const decides = (lift: string) => lift !== 'bench_press' && lift !== 'overhead_press';

// R1 (9 October 2026, pillar 1): a file whose count was given after the app showed its own (labelKind 'after-app': the
// result screen's collection, phoneCollect.js, and the contributions, contribute.js) holds no label. Such a file in a
// sets-* folder is held out of the sets that decide, by name and kind (`held`), never counted; a file of David's phone
// that also carries his blind count (blind.count, blind.js) is read by blindSets below, in a section of its own. Files
// with no labelKind are the collector's and the build clips, labelled by David from the video (R1).
export type HeldSet = { name: string; labelKind: string };
// The folders of David's collected sets: sets-* without the whole-video reads (-video, -video-mode; videoSets below).
const setDirs = (root: string) => readdirSync(root).filter(d => /^sets-/.test(d) && !/-video(-mode)?$/.test(d) && statSync(resolve(root, d)).isDirectory()).sort();
const readSet = (root: string, dir: string, f: string) => JSON.parse(gunzipSync(readFileSync(resolve(root, dir, f))).toString());

export function labelledSets(root = ROOT) {
  const sets: LabelledSet[] = [], unreadable: string[] = [], held: HeldSet[] = [];
  // A sets-*-video folder (and a sets-*-video-mode one) holds whole real videos read through the built app (videoSets
  // below): its own section.
  const dirs = setDirs(root);
  for (const dir of [...dirs, 'landmarks']) {
    if (!existsSync(resolve(root, dir))) continue;
    for (const f of readdirSync(resolve(root, dir)).filter(f => f.endsWith('.json.gz')).sort()) {
      const name = `${dir}/${f}`;
      let d: any;
      try { d = readSet(root, dir, f); }
      catch { unreadable.push(name); continue; }
      if (d.labelKind !== undefined) { held.push({ name, labelKind: String(d.labelKind) }); continue; }
      // A collector's file carries its lift and count; the oldest build clips carry them in their name only
      // (a batch file's name is led by its set number: set07_squat_8_side_…).
      const m = f.match(/^(?:set\d+_)?(.+?)_(\d+)_/);
      const lift = d.lift ?? m?.[1], label = d.count ?? (m ? Number(m[2]) : undefined);
      if (!lift || !Number.isInteger(label) || !Array.isArray(d.worldLandmarks)) { unreadable.push(name); continue; }
      sets.push({ name, lift, label, wl: d.worldLandmarks, ts: d.timestamps });
    }
  }
  return { sets, unreadable, held };
}

// David's blind counts (blind.js, phoneCollect.js; 9 October 2026): his collected files whose count he gave in the app
// before it showed its own. The label is blind.count; `kept` is the count he saved after seeing the app's, `appCount`
// the app's own, `appRefused` a set the app refused (with its proposal). A file answered "Je ne sais pas" (blind.count
// null) has no label and is listed in `unsure`. Shown in their own scoreboard section, which decides nothing until David
// says his in-app blind counts are labels (R1: they are his, but their agreement with his half-speed video counts is
// not measured).
export type BlindSet = LabelledSet & { kept: number; appCount: number | null; appRefused: boolean; proposal: number | null; il: any[] | null };
export function blindSets(root = ROOT) {
  const sets: BlindSet[] = [], unreadable: string[] = [], unsure: string[] = [];
  for (const dir of setDirs(root)) {
    for (const f of readdirSync(resolve(root, dir)).filter(f => f.endsWith('.json.gz')).sort()) {
      const name = `${dir}/${f}`;
      let d: any;
      try { d = readSet(root, dir, f); }
      catch { continue; } // labelledSets names it
      if (!d.blind || typeof d.blind !== 'object') continue;
      if (d.blind.count === null) { unsure.push(name); continue; }
      if (!d.lift || !Number.isInteger(d.blind.count) || d.blind.count < 1 || !Array.isArray(d.worldLandmarks) || !Array.isArray(d.timestamps) || d.worldLandmarks.length !== d.timestamps.length) { unreadable.push(name); continue; }
      sets.push({ name, lift: d.lift, label: d.blind.count, wl: d.worldLandmarks, ts: d.timestamps, kept: d.count, appCount: d.appCount ?? null, appRefused: d.appRefused === true, proposal: Number.isInteger(d.proposal) ? d.proposal : null, il: d.imageLandmarks ?? null });
    }
  }
  return { sets, unreadable, unsure };
}

// David's real videos read whole through the built app (analyzeCoreVideo on check.html, test/real-phone/sets-*-video/,
// capture.mjs there): the app's landmarks, timestamps and metadata, his label (R1), and the motion frames of the pose
// region (24 x 24 gray, motionRhythm.js). `appRefused`: the app refused the read itself (a partial read): no count.
export type VideoSet = LabelledSet & { appRefused: boolean; motion: { grid: number; frames: string[] } | null; il: any[] | null };
// mode 'image': the reads of 7 October (sets-*-video/, MediaPipe in IMAGE mode, as the app reads); 'video': the same
// videos read in VIDEO mode (sets-*-video-mode/; shipped on the morning of 9 October 2026, withdrawn that evening).
export function videoSets({ mode = 'image' }: { mode?: 'image' | 'video' } = {}) {
  const sets: VideoSet[] = [], unreadable: string[] = [];
  const folder = mode === 'video' ? /^sets-.*-video-mode$/ : /^sets-.*-video$/;
  const dirs = readdirSync(ROOT).filter(d => folder.test(d) && statSync(resolve(ROOT, d)).isDirectory()).sort();
  for (const dir of dirs) {
    for (const f of readdirSync(resolve(ROOT, dir)).filter(f => f.endsWith('.json.gz')).sort()) {
      const name = `${dir}/${f}`;
      let d: any;
      try { d = JSON.parse(gunzipSync(readFileSync(resolve(ROOT, dir, f))).toString()); }
      catch { unreadable.push(name); continue; }
      if (!d.lift || !Number.isInteger(d.count) || !Array.isArray(d.worldLandmarks) || !Array.isArray(d.timestamps) || d.worldLandmarks.length !== d.timestamps.length) { unreadable.push(name); continue; }
      sets.push({ name, lift: d.lift, label: d.count, wl: d.worldLandmarks, ts: d.timestamps, appRefused: !!d.read?.partial, motion: d.motion ?? null, il: d.imageLandmarks ?? null });
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
export type Exposed = Record<string, { sets: string | string[]; reason: string }>;
/** Whether a held-out set is recorded as already seen (public/exposed.json): its whole dataset, or its id. */
export function isExposed(exposed: Exposed, ds: string, id: string) {
  const e = exposed[ds];
  return !!e && (e.sets === 'all' || (Array.isArray(e.sets) && e.sets.includes(id)));
}
// RepCount-A (scripts/public/repcount.mjs, fetch-repcount-lance.sh): every class, the ones the catalogue has no counter
// for with lift null. Its own section of the public scoreboard (repcount: per class); it moves no tally of the gate and
// enters no baseline, so a class-agnostic counter can be measured on it without changing what the gate compares.
export const BENCH_ONLY = ['repcount'];
export type BenchSet = { name: string; dataset: string; id: string; cls: string; lift: string | null; label: number; wl: any[]; ts: number[]; image: (number[] | null)[] | null; reps: [number, number][]; visibleShare: number; source: string };
/** The sets of a benchmark-only dataset (BENCH_ONLY), one half; with the record's failed and left-out sets. */
export function benchSets(ds: string, split: 'build' | 'holdout' = 'build') {
  if (split === 'holdout' && !process.env.HOLDOUT) throw new Error('The held-out half is read only by its own run (HOLDOUT=1).');
  const sets: BenchSet[] = [], unreadable: string[] = [], missing: string[] = [], notScored: string[] = [];
  let record: Record<string, { split?: string; status: string; reason?: string }> = {};
  try { record = JSON.parse(readFileSync(resolve(PUBLIC, ds, 'sets.json'), 'utf8')); } catch { return { sets, unreadable, missing, notScored, record }; }
  for (const [id, r] of Object.entries(record)) {
    if (r.status !== 'written') { if (!r.split || r.split === split) notScored.push(`public/${ds}/${id}: ${r.status}: ${r.reason}`); continue; }
    if (r.split !== split) continue;
    const f = resolve(PUBLIC, ds, split, `${id}.json.gz`), name = `public/${ds}/${split}/${id}.json.gz`;
    if (!existsSync(f)) { missing.push(name); continue; }
    let d: any;
    try { d = JSON.parse(gunzipSync(readFileSync(f)).toString()); } catch { unreadable.push(name); continue; }
    if (!d.class || !Number.isInteger(d.count) || !Array.isArray(d.worldLandmarks) || d.split !== split) { unreadable.push(name); continue; }
    sets.push({ name, dataset: ds, id, cls: d.class, lift: d.lift ?? null, label: d.count, wl: d.worldLandmarks, ts: d.timestamps, image: d.imageXY ?? null, reps: d.reps, visibleShare: d.visibleShare, source: d.source });
  }
  sets.sort((a, b) => a.name.localeCompare(b.name));
  return { sets, unreadable, missing, notScored, record };
}

export function publicSets(split: 'build' | 'holdout' = 'build') {
  if (split === 'holdout' && !process.env.HOLDOUT) throw new Error('The held-out half is read only by its own run (HOLDOUT=1).');
  const sets: PublicSet[] = [], unreadable: string[] = [], missing: string[] = [], notScored: string[] = [];
  let datasets: string[] = [];
  try { datasets = readdirSync(PUBLIC).filter(d => statSync(resolve(PUBLIC, d)).isDirectory()).sort(); } catch { return { sets, unreadable, missing, notScored }; }
  // Held-out sets already seen (public/exposed.json): listed with their reason, never scored as an unseen exam.
  let exposed: Exposed = {};
  try { exposed = JSON.parse(readFileSync(resolve(PUBLIC, 'exposed.json'), 'utf8')); } catch { /* none recorded */ }
  const seen = (ds: string, id: string) => split === 'holdout' && isExposed(exposed, ds, id);
  for (const ds of datasets) {
    // A benchmark-only dataset (BENCH_ONLY) has its own section and gates nothing: it is read by benchSets.
    if (BENCH_ONLY.includes(ds)) continue;
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
      if (seen(ds, f.replace(/\.json\.gz$/, ''))) { notScored.push(`${name}: exposed: ${exposed[ds].reason}`); continue; }
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

// The sets the app counted while not seeing the body (counting/doubt.js), against the others: printed by both
// scoreboards, deciding nothing. err is |count - label|, for counted sets only.
export function doubtLine(rows: { flagged: boolean; err: number }[]) {
  const part = (flagged: boolean) => {
    const g = rows.filter(r => r.flagged === flagged), n = g.length, pct = (k: number) => (n ? Math.round((100 * k) / n) : 0);
    const exact = g.filter(r => r.err === 0).length, bad = g.filter(r => r.err >= 3).length;
    return `${n} ${flagged ? 'flagged' : 'not flagged'}: ${exact} exact (${pct(exact)}%), ${bad} off by 3+ (${pct(bad)}%)`;
  };
  const bad = rows.filter(r => r.err >= 3);
  return `Pose doubt (counting/doubt.js, experimental, decides nothing): of ${rows.length} counted sets, ${part(true)}; ${part(false)}. Sets off by 3+ flagged: ${bad.filter(r => r.flagged).length} of ${bad.length}.`;
}
