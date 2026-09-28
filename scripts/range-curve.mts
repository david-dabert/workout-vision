/**
 * Which cycles each counting core counts, by their true range (28 September 2026).
 *
 * A rep counts only if it covers MIN_ROM_DEGREES (20°). This script measures how close each core
 * comes to that rule on synthetic sets whose every cycle has a known range, so that a change to how
 * the range is measured can be judged on the whole curve, not on a few sets.
 *
 * Each set: 6 to 12 reps whose true range (rest to working end, before noise) is drawn within 15 %
 * of the set's range (14° to 45°), each followed by a pause of 0.2 s to 2 s at rest, or, one time
 * in four, by none; in 35 % of sets, one to three partials of 4° to 19° mixed in;
 * Gaussian noise of 0.3° to 2.5° on every sample; 15 samples per second, as the app analyses; a curl
 * (rests high) or a lateral raise (rests low). Each set has one shape of turn:
 *   sharp   straight moves that turn within one sample;
 *   smooth  moves along the minimum-jerk profile, which eases out of one end and into the other as a
 *           joint does (Flash and Hogan 1985, J Neurosci 5:1688; status: literature);
 *   held    minimum-jerk moves with 0.2 s to 1.5 s held at the working end.
 * A cycle of 21° or more must count and one under 19° must not; one in between may. A core is right
 * on a set when its count lies in that band. A counted rep is matched to the cycle whose working end
 * falls within it, the nearest to its middle; one that covers none is counted with no cycle.
 *
 * Synthetic build evidence only; no parameter is chosen from it. Seeded, so every run prints the same.
 * Run: node scripts/range-curve.mts core-a.ts core-b.ts ...   (Node 22.18 or later strips the types)
 * The first core is the reference for "further from the truth" and "closer". An earlier commit's core:
 *   git show bf50199:src/lib/counting/core.ts > /tmp/core-bf50199.ts
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { jointFrame, seeded, gaussian, timestamps } from '../src/lib/counting/__tests__/synthetic.ts';

const paths = process.argv.slice(2);
if (!paths.length) paths.push('src/lib/counting/core.ts');
const cores = await Promise.all(paths.map(p => import(pathToFileURL(resolve(p)).href)));
const names = paths.map(p => p.split('/').pop()!.replace(/\.ts$/, ''));
const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');

const N = 6000, SPS = 15;
const SHAPES = ['sharp', 'smooth', 'held'] as const;
type Shape = (typeof SHAPES)[number];
const BINS: [number, number][] = [[0, 15], [15, 17], [17, 18], [18, 19], [19, 20], [20, 21], [21, 22], [22, 23], [23, 25], [25, 30], [30, Infinity]];
const binOf = (d: number) => BINS.findIndex(([lo, hi]) => d >= lo && d < hi);

type Seg = { hold: number; sec: number } | { to: number; sec: number };
function render(path: Seg[], start: number, shape: Shape): number[] {
  const out: number[] = [];
  let angle = start;
  for (const seg of path) {
    const n = Math.max(1, Math.round(seg.sec * SPS));
    if ('hold' in seg) { angle = seg.hold; for (let i = 0; i < n; i++) out.push(angle); continue; }
    const from = angle;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      out.push(from + (seg.to - from) * (shape === 'sharp' ? t : t * t * t * (10 - 15 * t + 6 * t * t)));
    }
    angle = seg.to;
  }
  return out;
}

const sets = names.map(() => ({ right: 0, under: 0, missing: 0, over: 0, extra: 0, off3: 0, further: 0, closer: 0, shownUnder: 0 }));
const counted = names.map(() => Object.fromEntries(SHAPES.map(s => [s, BINS.map(() => 0)])) as Record<Shape, number[]>);
const noCycle = names.map(() => 0);
const cycles = Object.fromEntries(SHAPES.map(s => [s, BINS.map(() => 0)])) as Record<Shape, number[]>;

for (let seed = 1; seed <= N; seed++) {
  const rng = seeded(seed);
  const u = (a: number, b: number) => a + (b - a) * rng();
  const restsLow = seed % 2 === 0;
  const lift = restsLow ? 'lateral_raise' : 'bicep_curl', joint = restsLow ? 'shoulder' : 'elbow';
  const shape = SHAPES[Math.floor(rng() * 3)];
  const R = u(14, 45), rest = restsLow ? u(15, 30) : u(150, 170), dir = restsLow ? 1 : -1, noise = u(0.3, 2.5);
  const depths = Array.from({ length: 6 + Math.floor(rng() * 7) }, () => R * u(0.85, 1.15));
  if (rng() < 0.35) {
    const k = 1 + Math.floor(rng() * 3);
    for (let j = 0; j < k; j++) depths.splice(Math.floor(rng() * (depths.length + 1)), 0, u(4, 19));
  }
  const path: Seg[] = [];
  let clock = 0;
  const add = (s: Seg) => { path.push(s); clock += Math.max(1, Math.round(s.sec * SPS)) / SPS; };
  add({ hold: rest, sec: u(0.5, 2) });
  const ends: number[] = []; // when each cycle is at its working end
  for (const d of depths) {
    const top = rest + dir * d;
    add({ to: top, sec: u(0.5, 1.5) });
    if (shape === 'held') { const h = u(0.2, 1.5); ends.push(clock + h / 2); add({ hold: top, sec: h }); } else ends.push(clock);
    add({ to: rest, sec: u(0.5, 1.8) });
    const pause = rng() < 0.25 ? 0 : u(0.2, 2);
    if (pause) add({ hold: rest, sec: pause });
  }
  const must = depths.filter(d => d >= 21).length, may = depths.filter(d => d >= 19 && d < 21).length;
  depths.forEach(d => cycles[shape][binOf(d)]++);
  const angles = render(path, rest, shape).map(a => a + gaussian(rng, noise));
  const frames = angles.map(a => jointFrame(joint, { left: a })), ts = timestamps(angles.length, SPS);
  const results = cores.map(m => m.countReps(frames, ts, lift));
  const off = results.map(r => Math.max(0, must - r.count, r.count - (must + may)));
  results.forEach((r, k) => {
    const t = sets[k];
    if (off[k] === 0) t.right++;
    if (r.count < must) { t.under++; t.missing += must - r.count; }
    if (r.count > must + may) { t.over++; t.extra += r.count - must - may; }
    if (off[k] >= 3) t.off3++;
    if (off[k] > off[0]) t.further++;
    if (off[k] < off[0]) t.closer++;
    t.shownUnder += r.reps.filter((x: { romDegrees: number }) => x.romDegrees < 20).length;
    const hit = depths.map(() => false);
    for (const x of r.reps) {
      const middle = (x.startTime + x.endTime) / 2;
      let j = -1;
      ends.forEach((e, q) => {
        if (e >= x.startTime - 1e-9 && e <= x.endTime + 1e-9 && (j < 0 || Math.abs(e - middle) < Math.abs(ends[j] - middle))) j = q;
      });
      if (j < 0) noCycle[k]++; else hit[j] = true;
    }
    depths.forEach((d, q) => { if (hit[q]) counted[k][shape][binOf(d)]++; });
  });
}

const pct = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(1) : '-').padStart(7);
console.log(`${N} synthetic sets, ${SPS} samples per second. A cycle of 21° or more must count, one under 19° must not.`);
paths.forEach((p, k) => console.log(`${names[k]}: sha256 ${sha(p)}`));
console.log(`Reference for further and closer: ${names[0]}.\n`);
console.log('core'.padEnd(16) + 'right'.padStart(7) + '  under (reps)' + '  over (reps)' + '  off by 3+' + '  further' + '  closer' + '  counted reps shown under 20°');
names.forEach((n, k) => {
  const t = sets[k];
  console.log(n.padEnd(16) + String(t.right).padStart(7) + `  ${t.under} (-${t.missing})`.padEnd(15) + `  ${t.over} (+${t.extra})`.padEnd(14)
    + String(t.off3).padStart(10) + String(t.further).padStart(9) + String(t.closer).padStart(8) + String(t.shownUnder).padStart(8));
});
console.log('\nShare of cycles counted, in %, by true range in degrees');
console.log(''.padEnd(24) + BINS.map(([lo, hi]) => (hi === Infinity ? `${lo}+` : `${lo}-${hi}`).padStart(7)).join('') + '  counted with no cycle');
names.forEach((n, k) => {
  const all = BINS.map((_, b) => pct(SHAPES.reduce((s, sh) => s + counted[k][sh][b], 0), SHAPES.reduce((s, sh) => s + cycles[sh][b], 0)));
  console.log(`${n} all`.padEnd(24) + all.join('') + String(noCycle[k]).padStart(8));
  for (const sh of SHAPES) console.log(`${n} ${sh}`.padEnd(24) + BINS.map((_, b) => pct(counted[k][sh][b], cycles[sh][b])).join(''));
});
console.log('cycles'.padEnd(24) + BINS.map((_, b) => String(SHAPES.reduce((s, sh) => s + cycles[sh][b], 0)).padStart(7)).join(''));
