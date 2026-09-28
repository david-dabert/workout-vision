/**
 * Where each counting core takes the rest a rep left (28 September 2026).
 *
 * range-curve.mts rests every set at one level, so it cannot tell rules for the rest apart. This
 * script puts them where they differ, on synthetic sets with Gaussian noise, 15 samples per
 * second, a curl (rests high) and a lateral raise (rests low):
 *   1. The fifth review's set (28 September): six 25° reps, then four partials of 18° held 1.5 s
 *      at the top, the last after 2 s held 3.5°, 5° or 8° fuller than the rest and 0.5 s back at
 *      it; the same set with no pause. Noise 1° to 1.5°, 200 seeds. Right: 6.
 *   2. Pauses at another level over timings: the same set with every move along the minimum-jerk
 *      profile (Flash and Hogan 1985, J Neurosci 5:1688; status: literature), the pause 3.5°, 5°
 *      or 8° fuller or less full, the lifter back at the rest 0.3 to 1.2 s before the fourth test
 *      rep, and every move taking 0.8, 1.5 or 2.5 s. After a fuller pause the test reps are 18°
 *      partials (right: 6); after a less full one, 23° reps (right: 10). Noise 1° to 1.5°, 100
 *      seeds per case.
 *   3. Slow reps: eight reps within 3 % of 21.5°, 22.5°, 24° or 26°, every move taking 2 to 4 s
 *      along the minimum-jerk profile, pauses of 0 to 0.3 s or 0 to 1.5 s, noise 0.5° to 2°,
 *      200 seeds. Right: 8. A rep of 21° or more must count (range-curve.mts).
 * Each cell: sets counted wrong. Synthetic build evidence only: it compares rules; the bounds of
 * REST_BEFORE_SEC come from the tests of min-range.test.ts, and no constant is tuned on it.
 * Run: node scripts/rest-level.mts core-a.ts core-b.ts ...   (Node 22.18 or later strips the types)
 * An earlier commit's core: git show bf50199:src/lib/counting/core.ts > /tmp/core-bf50199.ts
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { jointFrame, sample, timestamps, seeded, gaussian, type Segment } from '../src/lib/counting/__tests__/synthetic.ts';

const paths = process.argv.slice(2);
if (!paths.length) paths.push('src/lib/counting/core.ts');
const cores = await Promise.all(paths.map(p => import(pathToFileURL(resolve(p)).href)));
const names = paths.map(p => p.split('/').pop()!.replace(/\.ts$/, ''));
const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
const SPS = 15;

const mj = (t: number) => t * t * t * (10 - 15 * t + 6 * t * t);
function smooth(path: Segment[], start: number): number[] {
  const out: number[] = [];
  let angle = start;
  for (const seg of path) {
    const n = Math.max(1, Math.round(seg.sec * SPS));
    if ('hold' in seg) { angle = seg.hold; for (let i = 0; i < n; i++) out.push(angle); continue; }
    const from = angle;
    for (let i = 1; i <= n; i++) out.push(from + (seg.to - from) * mj(i / n));
    angle = seg.to;
  }
  return out;
}
const counts = (a: number[], restsLow: boolean) => {
  const frames = a.map(x => jointFrame(restsLow ? 'shoulder' : 'elbow', { left: x })), ts = timestamps(a.length, SPS);
  return cores.map(m => m.countReps(frames, ts, restsLow ? 'lateral_raise' : 'bicep_curl').count as number);
};
const noisy = (a: number[], seed: number, lo: number, hi: number) => {
  const rng = seeded(seed);
  const n = lo + (hi - lo) * rng();
  return a.map(x => x + gaussian(rng, n));
};
const row = (label: string, cells: number[]) => console.log(label.padEnd(44) + cells.map(c => String(c).padStart(14)).join(''));

console.log(`Sets counted wrong, 15 samples per second, a curl and a lateral raise each.`);
paths.forEach((p, k) => console.log(`${names[k]}: sha256 ${sha(p)}`));
const head = (title: string) => { console.log(`\n${title}`); row('', names.map(n => n.slice(0, 13))); };

// 1. The fifth review's set.
head('1. Four 18° partials, the last after 2 s held fuller and 0.5 s back at the rest (200 seeds each)');
const fifth = (restsLow: boolean, out: number) => {
  const rest = restsLow ? 20 : 160, dir = restsLow ? 1 : -1;
  const p: Segment[] = [{ hold: rest, sec: 1 }];
  for (let r = 0; r < 6; r++) p.push({ to: rest + dir * 25, sec: 1 }, { hold: rest + dir * 25, sec: 0.3 }, { to: rest, sec: 1 }, { hold: rest, sec: 1 });
  for (let r = 0; r < 4; r++) {
    if (r === 3 && out) p.push({ to: rest - dir * out, sec: 0.5 }, { hold: rest - dir * out, sec: 2 }, { to: rest, sec: 0.5 }, { hold: rest, sec: 0.5 });
    p.push({ to: rest + dir * 18, sec: 0.8 }, { hold: rest + dir * 18, sec: 1.5 }, { to: rest, sec: 0.8 }, { hold: rest, sec: 1 });
  }
  return sample(p, rest, SPS);
};
for (const out of [0, 3.5, 5, 8]) for (const restsLow of [false, true]) {
  const clean = fifth(restsLow, out), wrong = cores.map(() => 0);
  for (let s = 1; s <= 200; s++) counts(noisy(clean, s, 1, 1.5), restsLow).forEach((c, k) => { if (c !== 6) wrong[k]++; });
  row(`${out ? `${out}° fuller` : 'no pause'}, ${restsLow ? 'raise' : 'curl'}`, wrong);
}

// 2. Pauses at another level over timings.
head('2. A pause at another level before the fourth test rep, over timings (100 seeds per case)');
const family = (restsLow: boolean, offset: number, back: number, move: number) => {
  const rest = restsLow ? 20 : 160, dir = restsLow ? 1 : -1, fuller = offset < 0;
  const p: Segment[] = [{ hold: rest, sec: 1 }];
  for (let r = 0; r < 6; r++) p.push({ to: rest + dir * 25, sec: move }, { hold: rest + dir * 25, sec: 0.3 }, { to: rest, sec: move }, { hold: rest, sec: 1 });
  for (let r = 0; r < 4; r++) {
    if (r === 3) p.push({ to: rest + dir * offset, sec: 0.5 }, { hold: rest + dir * offset, sec: 2 }, { to: rest, sec: 0.5 }, { hold: rest, sec: back });
    const depth = fuller ? 18 : 23;
    p.push({ to: rest + dir * depth, sec: move }, { hold: rest + dir * depth, sec: fuller ? 1.5 : 0.3 }, { to: rest, sec: move }, { hold: rest, sec: 1 });
  }
  return { angles: smooth(p, rest), right: fuller ? 6 : 10 };
};
const byOffset = new Map<string, number[]>(), byBack = new Map<string, number[]>(), byMove = new Map<string, number[]>();
const total = cores.map(() => 0), cases = { n: 0 };
const add = (m: Map<string, number[]>, key: string, wrong: number[]) => { const v = m.get(key) ?? cores.map(() => 0); wrong.forEach((w, k) => (v[k] += w)); m.set(key, v); };
for (const offset of [-3.5, -5, -8, 3.5, 5, 8]) for (const back of [0.3, 0.5, 0.8, 1.2]) for (const move of [0.8, 1.5, 2.5]) for (const restsLow of [false, true]) {
  const { angles, right } = family(restsLow, offset, back, move), wrong = cores.map(() => 0);
  for (let s = 1; s <= 100; s++) counts(noisy(angles, s, 1, 1.5), restsLow).forEach((c, k) => { if (c !== right) wrong[k]++; });
  add(byOffset, `${offset < 0 ? 'fuller' : 'less full'} by ${Math.abs(offset)}°`, wrong);
  add(byBack, `back at the rest ${back} s`, wrong);
  add(byMove, `moves of ${move} s`, wrong);
  wrong.forEach((w, k) => (total[k] += w));
  cases.n += 100;
}
for (const m of [byOffset, byBack, byMove]) for (const [key, v] of m) row(key, v);
row(`all ${cases.n} sets`, total);

// 3. Slow reps.
head('3. Eight slow reps, 2 to 4 s per move (200 seeds per lift)');
for (const pauseMax of [0.3, 1.5]) for (const depth of [21.5, 22.5, 24, 26]) {
  const wrong = cores.map(() => 0);
  for (const restsLow of [false, true]) for (let seed = 1; seed <= 200; seed++) {
    const rng = seeded(seed);
    const u = (a: number, b: number) => a + (b - a) * rng();
    const rest = restsLow ? u(15, 30) : u(150, 170), dir = restsLow ? 1 : -1, noise = u(0.5, 2);
    const p: Segment[] = [{ hold: rest, sec: u(0.5, 2) }];
    for (let r = 0; r < 8; r++) {
      const top = rest + dir * depth * u(0.97, 1.03);
      p.push({ to: top, sec: u(2, 4) }, { hold: top, sec: u(0, 0.5) }, { to: rest, sec: u(2, 4) }, { hold: rest, sec: u(0, pauseMax) });
    }
    counts(smooth(p, rest).map(x => x + gaussian(rng, noise)), restsLow).forEach((c, k) => { if (c !== 8) wrong[k]++; });
  }
  row(`${depth}°, pauses of 0 to ${pauseMax} s (400 sets)`, wrong);
}
