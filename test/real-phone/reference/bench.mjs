// Bench: each reference video against itself, against itself replayed slower with extra still footage, against
// itself seen in a mirror, against every other reference, and against faulty versions of itself. Reads landmark files (.json.gz, the harness's
// output) from a local folder: the videos and their landmarks are a third party's and stay out of this public
// repository. Run: REFERENCE_LANDMARKS=/path/to/folder node test/real-phone/reference/bench.mjs (prints the tables).
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildReference, compareAttempt, compareCurves, curves, mirrorLandmarks } from '../../../src/lib/reference/compare.js';
import { LIBRARY } from '../../../src/lib/kine/library.js';

const dir = (process.env.REFERENCE_LANDMARKS || '').replace(/\/?$/, '/');
if (dir === '/') throw new Error('Set REFERENCE_LANDMARKS to the folder holding the landmark files.');
const names = fs.readdirSync(dir).filter(f => f.endsWith('.json.gz')).sort();
const load = f => JSON.parse(gunzipSync(fs.readFileSync(dir + f)));
const videos = Object.fromEntries(names.map(f => [f.replace('.json.gz', ''), load(f)]));
// Picture-plane angles (compare.js): each video's image landmarks and its own width over height, and the measures the
// library sets for that exercise (a landmark file "olivier-2-..." is the library's exercise "olivier-2-...").
const exerciseOf = name => LIBRARY.find(e => e.file.split('-').slice(0, 2).join('-') === name.split('-').slice(0, 2).join('-'));
const measuresOf = name => exerciseOf(name)?.measures;
const opts = (v, name) => ({ ...measuresOf(name), aspect: v.metadata.extractedWidth / v.metadata.extractedHeight });

// The same movement 1.3 times slower, with 3 s of the first pose before and 3 s of the last after.
function slower(v, factor = 1.3, pad = 3) {
  const ts = [], wl = [];
  const dt = v.timestamps[1] - v.timestamps[0];
  for (let t = 0; t < pad; t += dt) { ts.push(t); wl.push(v.imageLandmarks[0]); }
  v.timestamps.forEach((t, i) => { ts.push(pad + t * factor); wl.push(v.imageLandmarks[i]); });
  const last = ts.at(-1);
  for (let t = dt; t < pad; t += dt) { ts.push(last + t); wl.push(v.imageLandmarks.at(-1)); }
  return { timestamps: ts, imageLandmarks: wl, metadata: v.metadata };
}

const f1 = x => (x == null ? '-' : x.toFixed(1));
const f2 = x => (x == null ? '-' : x.toFixed(2));
const lines = ['# Reference comparison bench', '', `Engine: src/lib/reference/compare.js. Videos: ${names.length}, landmarks only.`, ''];
for (const [name, v] of Object.entries(videos)) {
  const ref = buildReference(v.imageLandmarks, v.timestamps, opts(v, name));
  lines.push(`## Reference ${name}`, '', `Joints used: ${ref.joints.map(j => `${j.name} (${j.kind}, range ${f1(j.range)} deg)`).join(', ') || 'none'}.`,
    `Joints not used (seen under 80 %): ${ref.unused.map(u => `${u.name} ${f2(u.seenShare)}`).join(', ') || 'none'}.`, '',
    '| Attempt | Verdict | Reasons | Tempo | Joints: within tolerance / p90 gap / range reached |', '|---|---|---|---|---|');
  const attempts = [[`${name} (itself)`, v], [`${name} slower x1.3, padded`, slower(v)],
    [`${name} seen in a mirror`, { ...v, imageLandmarks: mirrorLandmarks(v.imageLandmarks), mirrorOf: name }],
    ...Object.entries(videos).filter(([o]) => o !== name)];
  for (const [label, a] of attempts) {
    // Seen in a mirror: a one-arm exercise is read on the side the physiotherapist sets (the other one); the others
    // are read as in a mirror only when the plain reading gives no verdict.
    const mirror = a.mirrorOf === name && !!exerciseOf(name)?.side;
    const r = compareAttempt(ref, a.imageLandmarks, a.timestamps, { ...opts(a, name), mirror });
    const js = r.joints.map(j => `${j.name} ${f2(j.within)} / ${f1(j.gapP90)} / ${f2(j.rangeShare)}`).join('; ');
    lines.push(`| ${label} | ${r.verdict} | ${r.reasons.join(', ') || '-'} | ${f2(r.tempo)} | ${js || '-'} |`);
  }
  // Faulty attempts made from the reference's own curves: the first moving joint stopped at 70 % of its range,
  // then the elbows held 30 degrees more bent throughout.
  const own = curves(v.imageLandmarks, v.timestamps, opts(v, name));
  const moving = ref.joints.find(j => j.kind === 'moving');
  if (moving) {
    const lo = Math.min(...moving.curve), hi = Math.max(...moving.curve);
    // A direction has no "start" end: the range is cut from either end.
    const short = { ...own, [moving.name]: own[moving.name].map(x => (x == null ? null : lo + (x - lo) * 0.7)) };
    const shortTop = { ...own, [moving.name]: own[moving.name].map(x => (x == null ? null : hi - (hi - x) * 0.7)) };
    const bent = Object.fromEntries(Object.entries(own).map(([k, c]) => [k, k.endsWith('Elbow') ? c.map(x => (x == null ? null : x - 30)) : c]));
    const off = { ...own, [moving.name]: own[moving.name].map(x => (x == null ? null : x + 25)) };
    const faults = [[`${name}, ${moving.name} to 70 % of its range`, short], [`${name}, ${moving.name} to 70 % of its range, from the other end`, shortTop],
      [`${name}, ${moving.name} 25 deg off throughout`, off]];
    if (Object.keys(own).some(k => k.endsWith('Elbow'))) faults.push([`${name}, elbows 30 deg more bent`, bent]);
    for (const [label, c] of faults) {
      const r = compareCurves(ref, c);
      const js = r.joints.map(j => `${j.name} ${f2(j.within)} / ${f1(j.gapP90)} / ${f2(j.rangeShare)}`).join('; ');
      lines.push(`| ${label} | ${r.verdict} | ${r.reasons.join(', ') || '-'} | ${f2(r.tempo)} | ${js || '-'} |`);
    }
  }
  lines.push('');
}
console.log(lines.join('\n'));
