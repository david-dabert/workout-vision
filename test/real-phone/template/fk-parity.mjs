#!/usr/bin/env node
// node test/real-phone/template/fk-parity.mjs <checks.json> [...] [--worst N] [--fail-above DEG]
// fk.js against synth.js (8 October 2026, bench only): for every spec of the checks.json files that preview.mjs wrote
// (motions/preview.mjs: the skeleton's angles per still), the angles fk.js gives at the same progress (u = 0, 0.5, 1, the
// same side moving: one side for a one-sided or alternating spec, the mirrored pose for PREVIEW_SIDE=right) against the
// rendered skeleton's: the four counter angles of each side (elbow, shoulder, hip, knee; core.ts JOINT_POINTS) and the
// trunk's angle to the vertical (psc.js trunk). The two bodies differ in proportions only (fk.js: rounded adult segment
// lengths; the rig: its own), so a few degrees apart is agreement, and a gap above 8 degrees means the two kinematics
// disagree (a rotation's order or sign). Prints each spec's largest gap, the worst comparisons and the summary.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { specLandmarks } from './fk.js';

const HERE = dirname(fileURLToPath(import.meta.url)), MOTIONS = resolve(HERE, '../synth/motions');
const argv = process.argv.slice(2), opt = (k, d) => (argv.includes(k) ? Number(argv.splice(argv.indexOf(k), 2)[1]) : d);
const WORST = opt('--worst', 15), FAIL = opt('--fail-above', Infinity);
if (!argv.length) throw new Error('usage: node fk-parity.mjs <checks.json> [...] [--worst N] [--fail-above DEG]');
const JP = { elbow: { left: [11, 13, 15], right: [12, 14, 16] }, shoulder: { left: [23, 11, 13], right: [24, 12, 14] },
  hip: { left: [11, 23, 25], right: [12, 24, 26] }, knee: { left: [23, 25, 27], right: [24, 26, 28] } };
const sub = (a, b) => [a.x - b.x, a.y - b.y, a.z - b.z];
const angle = (u, v) => { const d = u[0] * v[0] + u[1] * v[1] + u[2] * v[2], n = Math.hypot(...u) * Math.hypot(...v); return (Math.acos(Math.max(-1, Math.min(1, d / n))) * 180) / Math.PI; };
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
/** The counter's angles and the trunk's (MediaPipe y down: the vertical is -y) from 33 landmarks. */
function angles(P) {
  const out = { trunk: angle(sub(mid(P[11], P[12]), mid(P[23], P[24])), [0, -1, 0]) };
  for (const [j, s] of Object.entries(JP)) out[j] = Object.fromEntries(Object.entries(s).map(([side, [a, b, c]]) => [side, angle(sub(P[a], P[b]), sub(P[c], P[b]))]));
  return out;
}
/** Each side's progress and the swap, as synth.js poses a preview still (specSides with preview.mjs's previewBusy). */
function drive(spec, u, busy) {
  if (spec.alternate === 'mirror') return [u, u, busy === 'right'];
  if (spec.alternate === true) return busy === 'right' ? [0, u, false] : [u, 0, false];
  return [spec.side === 'right' ? 0 : u, spec.side === 'left' ? 0 : u, false];
}

const rows = [], perSpec = [];
for (const file of argv) {
  const checks = JSON.parse(readFileSync(file, 'utf8'));
  for (const res of Object.values(checks)) {
    const path = res.file && existsSync(res.file) ? res.file : resolve(MOTIONS, `${res.key}.json`);
    const spec = JSON.parse(readFileSync(path, 'utf8'));
    const view = Object.values(res.views).find(v => v.skeleton);
    if (!view) { console.log(`${res.key}: no skeleton angles in ${file} (an older preview.mjs)`); continue; }
    let worst = { d: 0 };
    [0, 0.5, 1].forEach((u, i) => {
      const [uL, uR, swap] = drive(spec, u, res.busy), fk = angles(specLandmarks(spec, uL, uR, swap)), sk = view.skeleton[i];
      const add = (what, a, b) => { const r = { key: res.key, u, what, fk: a, synth: b, d: Math.abs(a - b) }; rows.push(r); if (r.d > worst.d) worst = r; };
      add('trunk', fk.trunk, sk.trunk);
      for (const j of Object.keys(JP)) for (const side of ['left', 'right']) add(`${j} ${side}`, fk[j][side], sk[j][side]);
    });
    perSpec.push(worst);
  }
}
const f = x => x.toFixed(1);
console.log('Largest gap per spec (degrees; fk.js / synth.js skeleton):');
for (const w of perSpec.sort((a, b) => b.d - a.d)) console.log(`  ${w.key.padEnd(34)} ${f(w.d).padStart(5)}  ${w.what} at u = ${w.u}: ${f(w.fk)} / ${f(w.synth)}`);
console.log(`Worst ${WORST} comparisons:`);
for (const r of [...rows].sort((a, b) => b.d - a.d).slice(0, WORST)) console.log(`  ${r.key.padEnd(34)} ${r.what.padEnd(14)} u = ${String(r.u).padEnd(3)} ${f(r.fk).padStart(6)} / ${f(r.synth).padStart(6)}  gap ${f(r.d)}`);
const ds = rows.map(r => r.d).sort((a, b) => a - b), q = p => ds[Math.min(ds.length - 1, Math.floor(p * ds.length))];
const byKind = k => { const x = rows.filter(r => r.what.startsWith(k)).map(r => r.d); return `${k} max ${f(Math.max(...x))} mean ${f(x.reduce((a, b) => a + b, 0) / x.length)}`; };
console.log(`${perSpec.length} specs, ${rows.length} comparisons: max ${f(ds.at(-1))}, median ${f(q(0.5))}, 95th percentile ${f(q(0.95))}, above 8: ${ds.filter(d => d > 8).length}`);
console.log(['trunk', 'elbow', 'shoulder', 'hip', 'knee'].map(byKind).join('; '));
if (ds.at(-1) > FAIL) { console.log(`FAIL: a gap above ${FAIL} degrees`); process.exit(1); }
