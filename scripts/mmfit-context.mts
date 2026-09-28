/**
 * MM-Fit with the moments around each set (28 September 2026).
 *
 * The app films "one set, then stop recording", so a phone clip also holds walking in, picking the
 * weights up and putting them down. MM-Fit's labelled segments start and end on the set itself. This
 * script replays the counter on each admitted set four ways:
 *   mediapipe_cut  the saved MediaPipe landmarks of the labelled segment (scripts/run-mmfit.mjs);
 *   own_cut        MM-Fit's own 3D pose (OpenPose + Martinez lifting, Human3.6M joints) on the segment;
 *   own_3s, own_6s MM-Fit's own 3D pose with 3 s or 6 s either side, never past a neighbouring
 *                  labelled set.
 * MM-Fit's pose is not the app's pose model, so own_* measure the mechanism, not the app's exact
 * numbers; the app's own pipeline on clips with context is scripts/run-mmfit.mjs's job.
 *
 * Supplementary build data only, never exam data (PLAN.md). No parameter is chosen from it.
 * Credit: David Strömbäck, Sangxia Huang and Valentin Radu, MM-Fit Dataset,
 * https://zenodo.org/records/7672767, CC BY 4.0. Poses and landmarks stay on the Mac; only counts
 * are written.
 *
 * Run on the Mac: node scripts/mmfit-context.mts [core.ts ...]
 * (Node 22.18 or later strips the types. MMFIT_ROOT defaults to ~/Datasets/MM-Fit. With no core
 * given, the repository's src/lib/counting/core.ts.)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.env.MMFIT_ROOT || join(homedir(), 'Datasets/MM-Fit');
const out = resolve('test/real-phone/mmfit-context');
const cores = process.argv.slice(2).length ? process.argv.slice(2) : ['src/lib/counting/core.ts'];
const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

// MediaPipe landmark index <- Human3.6M joint (MM-Fit pose columns: 0 is the frame number, then joints 0-16)
const H36M: Record<number, number> = { 11: 11, 12: 14, 13: 12, 14: 15, 15: 13, 16: 16, 23: 4, 24: 1, 25: 5, 26: 2, 27: 6, 28: 3 };
const LEFT = new Set([11, 13, 15, 23, 25, 27]);

function npy(path: string) {
  const b = readFileSync(path);
  const v = b[6], hlen = v === 1 ? b.readUInt16LE(8) : b.readUInt32LE(8), hs = v === 1 ? 10 : 12;
  const header = b.subarray(hs, hs + hlen).toString();
  if (!/'descr': '<f8'/.test(header) || /'fortran_order': True/.test(header)) throw new Error(`Unexpected array layout in ${path}`);
  const shape = header.match(/'shape': \(([^)]*)\)/)![1].split(',').filter(s => s.trim()).map(Number);
  return { shape, data: new Float64Array(b.buffer.slice(b.byteOffset + hs + hlen, b.byteOffset + b.length)) };
}

const results = JSON.parse(readFileSync('test/real-phone/mmfit/results.json', 'utf8'));
const admitted = results.rows.filter((r: any) => r.lift && r.admitted);
const modules = await Promise.all(cores.map(c => import(pathToFileURL(resolve(c)).href)));

type Pose = { N: number; J: number; data: Float64Array; byFrame: Map<number, number>; labels: { s: number; e: number }[] };
let current: { w: string; pose: Pose } | null = null;
function pose(w: string): Pose {
  if (current?.w === w) return current.pose;
  const { shape, data } = npy(join(root, 'labels/mm-fit', w, `${w}_pose_3d.npy`));
  const [, N, J] = shape;
  const byFrame = new Map<number, number>();
  for (let f = 0; f < N; f++) byFrame.set(data[f * J], f);
  const labels = readFileSync(join(root, 'labels/mm-fit', w, `${w}_labels.csv`), 'utf8').trim().split(/\r?\n/).map(l => l.split(',')).map(([s, e]) => ({ s: +s, e: +e }));
  current = { w, pose: { N, J, data, byFrame, labels } };
  return current.pose;
}

// MM-Fit's frame has z up; MediaPipe's world y points down. A rotation about x keeps every angle.
function ownWindow(p: Pose, s: number, e: number, margin: number, arm: string, both: boolean) {
  const others = p.labels.filter(l => !(l.s === s && l.e === e));
  const from = Math.max(s - margin, ...others.filter(l => l.e <= s).map(l => l.e));
  const to = Math.min(e + margin, ...others.filter(l => l.s >= e).map(l => l.s));
  const worldLandmarks: any[] = [], timestamps: number[] = [];
  for (let fr = from; fr < to; fr += 2) { // every second frame: 15 per second, as the app samples
    timestamps.push((fr - from) / 30);
    const f = p.byFrame.get(fr);
    if (f === undefined) { worldLandmarks.push(null); continue; }
    const frame: any[] = new Array(33);
    let ok = true;
    for (const [mp, h] of Object.entries(H36M)) {
      const at = (c: number) => p.data[(c * p.N + f) * p.J + h + 1];
      const [x, y, z] = [at(0), at(1), at(2)];
      if (![x, y, z].every(Number.isFinite)) { ok = false; break; }
      const side = LEFT.has(+mp) ? 'left' : 'right';
      frame[+mp] = { x, y: -z, z: y, visibility: both || side === arm ? 1 : 0.9 };
    }
    worldLandmarks.push(ok ? frame : null);
  }
  return { worldLandmarks, timestamps, margins: [(s - from) / 30, (to - e) / 30] };
}

const rows: any[] = [];
for (const r of admitted) {
  const [w, , s0, e0] = r.id.split('-');
  const s = +s0, e = +e0;
  const mp = JSON.parse(gunzipSync(readFileSync(join(root, 'all-sets-final/landmarks', `${r.id}.json.gz`))).toString());
  const row: any = { id: r.id, lift: r.lift, expected: r.expected, counts: [] };
  const p = pose(w);
  for (const m of modules) {
    const mpResult = m.countReps(mp.worldLandmarks, mp.timestamps, r.lift);
    // MM-Fit's pose has no visibility: the arm the counter tracks on the MediaPipe landmarks is kept.
    const arm = mpResult.arm;
    const both = arm === 'both';
    const c: any = { mediapipe_cut: mpResult.count };
    for (const [name, margin] of [['own_cut', 0], ['own_3s', 90], ['own_6s', 180]] as const) {
      const win = ownWindow(p, s, e, margin, arm, both);
      c[name] = m.countReps(win.worldLandmarks, win.timestamps, r.lift).count;
      if (name === 'own_6s') row.margins6 = win.margins;
    }
    row.counts.push(c);
  }
  rows.push(row);
}

const columns = ['mediapipe_cut', 'own_cut', 'own_3s', 'own_6s'];
const lifts = [...new Set(rows.map(r => r.lift))].sort();
const table: string[] = [];
cores.forEach((core, k) => {
  table.push(`### ${core} (sha256 ${sha(core).slice(0, 12)})`, '', '| Lift | Sets | ' + columns.join(' | ') + ' |', '|---|---:|' + columns.map(() => '---:').join('|') + '|');
  for (const lift of [...lifts, 'all']) {
    const rs = rows.filter(r => lift === 'all' || r.lift === lift);
    const cell = (col: string) => { const right = rs.filter(r => r.counts[k][col] === r.expected).length, over = rs.filter(r => r.counts[k][col] > r.expected).length; return `${right} (${over} over, ${rs.length - right - over} under)`; };
    table.push(`| ${lift} | ${rs.length} | ` + columns.map(cell).join(' | ') + ' |');
  }
  table.push('');
});
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'results.json'), JSON.stringify({ cores: cores.map(c => ({ path: c, sha256: sha(c) })), columns, admittedFrom: 'test/real-phone/mmfit/results.json', rows }, null, 1) + '\n');
writeFileSync(join(out, 'table.md'), '# MM-Fit admitted sets, exact counts\n\nEach cell: sets counted exactly (sets over, sets under). Supplementary build data, never exam data.\n\n' + table.join('\n'));
console.log(table.join('\n'));
