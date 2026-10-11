// The overhead press figure on its choice card and filming screen, from the image landmarks
// of David's committed clip (test/real-phone/landmarks/overhead_press_10_front_mufhjkku.json.gz),
// as the curl, lateral raise and lat pulldown figures were made from theirs. The loop is one
// rep the counting core found; the rest pose is the start of that rep. Nothing is measured from it.
//   node --experimental-strip-types scripts/make-clip-pose.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { countReps } from '../src/lib/counting/core.ts';

const LIFT = 'overhead_press', CLIP = 'overhead_press_10_front_mufhjkku', REP = 3, FRAMES = 30, M = 40;
const FILE = new URL('../src/components/experience/lift-poses.json', import.meta.url);
const d = JSON.parse(gunzipSync(readFileSync(new URL(`../test/real-phone/landmarks/${CLIP}.json.gz`, import.meta.url))).toString());
const W = d.metadata.extractedWidth, H = d.metadata.extractedHeight;
const core = countReps(d.worldLandmarks, d.timestamps, LIFT);
const rep = core.reps[REP - 1];
const DIG = '0123456789abcdefghijklmnopqrstuvwxyz';
const px = lm => lm.flatMap(p => (p.visibility < 0.5 ? [NaN, NaN] : [p.x * W, p.y * H]));
// The sample nearest to time t that has landmarks.
const at = t => { let best = -1; for (let i = 0; i < d.timestamps.length; i++) if (d.imageLandmarks[i] && (best < 0 || Math.abs(d.timestamps[i] - t) < Math.abs(d.timestamps[best] - t))) best = i; return d.imageLandmarks[best]; };
const loop = Array.from({ length: FRAMES }, (_, i) => px(at(rep.startTime + (rep.endTime - rep.startTime) * i / FRAMES)));
let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
for (const P of loop) for (let i = 0; i < 66; i += 2) if (!Number.isNaN(P[i])) { x0 = Math.min(x0, P[i]); x1 = Math.max(x1, P[i]); y0 = Math.min(y0, P[i + 1]); y1 = Math.max(y1, P[i + 1]); }
const s = (1000 - 2 * M) / (y1 - y0), w = Math.round((x1 - x0) * s + 2 * M);
const enc = P => { let o = ''; for (let i = 0; i < 33; i++) { const x = P[i * 2], y = P[i * 2 + 1]; if (Number.isNaN(x)) { o += 'zzzz'; continue; } const X = Math.round((x - x0) * s + M), Y = Math.round((y - y0) * s + M); o += DIG[Math.floor(X / 36)] + DIG[X % 36] + DIG[Math.floor(Y / 36)] + DIG[Y % 36]; } return o; };
const flat = P => P.map(v => (Number.isNaN(v) ? -1 : Math.round(v * 10) / 10));
const poses = JSON.parse(readFileSync(FILE, 'utf8'));
poses[LIFT] = { view: 'front', arm: core.arm, loop: { vb: [w, 1000], f: loop.map(enc) }, rest: { vb: [W, H], p: flat(px(at(rep.startTime))) } };
writeFileSync(FILE, JSON.stringify(poses));
console.log(`${LIFT}: rep ${REP} of ${core.count}, ${rep.startTime.toFixed(2)}-${rep.endTime.toFixed(2)} s, loop box ${w}x1000, rest box ${W}x${H}, arm ${core.arm}`);
