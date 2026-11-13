// Card 001 (cards/001-kine-comparison-repeats.md): does the physiotherapist's comparison (src/lib/reference/compare.js)
// tell the same movement twice from two different movements? Public data first (METHOD.md, Data before David).
//
// Data: the MM-Fit build sets on disk (test/real-phone/public/mmfit/build). A file name starts with its workout (w00,
// w01, ...): one person's session, holding several sets of each exercise. Triplets inside one workout: an anchor set A
// made the reference, a positive P (another set of the same exercise), a negative N (a set of another exercise). The
// comparison passes a triplet when P is closer to A than N is.
// Distance: compareAttempt's per-joint 90th percentile gap in degrees (gapP90), averaged over the joints it judges.
// A refused comparison (the reference or the attempt does not show the joints) is counted apart, never as a pass.
// Threshold of the card: 90 % of the judged triplets.
// Difference from the app, stated: the app compares image landmarks (ComparisonView.jsx); the public sets hold world
// landmarks only, so the angles here are read from those. SCOREBOARD=1 rewrites kine-compare.txt.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { buildReference, compareAttempt } from '../../../src/lib/reference/compare';

const DIR = resolve(__dirname, '../public/mmfit/build');
const THRESHOLD = 0.9;
type Set = { id: string; workout: string; exercise: string; wl: any[]; ts: number[] };
const sets: Set[] = readdirSync(DIR).filter(f => f.endsWith('.json.gz')).map(f => {
  const d = JSON.parse(gunzipSync(readFileSync(resolve(DIR, f))).toString());
  const [workout, exercise] = d.id.split('-');
  return { id: d.id, workout, exercise, wl: d.worldLandmarks, ts: d.timestamps };
});

const distance = (ref: any, s: Set): number | null => {
  const r: any = compareAttempt(ref, s.wl, s.ts);
  if (!r || r.verdict === 'refused' || !r.joints?.length) return null;
  const gaps = r.joints.map((j: any) => j.gapP90).filter((g: any) => Number.isFinite(g));
  return gaps.length ? gaps.reduce((a: number, b: number) => a + b, 0) / gaps.length : null;
};

// A harder question, measured and not gated: the same exercise by the same person (same workout) against the same
// exercise by another person (another workout). Nearer to the card's own question (one side twice against the other
// side) than two different exercises are. Reported only: the card's threshold is set on the triplets above.
function runSameExercise() {
  let judged = 0, passed = 0, skipped = 0;
  for (const a of sets) {
    const positives = sets.filter(s => s !== a && s.workout === a.workout && s.exercise === a.exercise);
    const negatives = sets.filter(s => s.workout !== a.workout && s.exercise === a.exercise).slice(0, 6);
    if (!positives.length || !negatives.length) continue;
    const ref: any = buildReference(a.wl, a.ts);
    if (!ref.joints.length) { skipped += 1; continue; }
    const dn = negatives.map(n => distance(ref, n));
    for (const p of positives) {
      const dp = distance(ref, p);
      for (const d of dn) { if (dp === null || d === null) { skipped += 1; continue; } judged += 1; if (dp < d) passed += 1; }
    }
  }
  return { judged, passed, skipped };
}

function run() {
  const byWorkout = new Map<string, Set[]>();
  for (const s of sets) byWorkout.set(s.workout, [...(byWorkout.get(s.workout) ?? []), s]);
  let judged = 0, passed = 0, refusedRef = 0, refusedPair = 0;
  const perExercise = new Map<string, [number, number]>();
  const cache = new Map<string, number | null>();
  for (const group of byWorkout.values()) {
    for (const a of group) {
      const positives = group.filter(s => s !== a && s.exercise === a.exercise);
      const negatives = group.filter(s => s.exercise !== a.exercise);
      if (!positives.length || !negatives.length) continue;
      const ref: any = buildReference(a.wl, a.ts);
      if (!ref.joints.length) { refusedRef += 1; continue; }
      const d = (s: Set) => { const k = `${a.id}|${s.id}`; if (!cache.has(k)) cache.set(k, distance(ref, s)); return cache.get(k)!; };
      for (const p of positives) for (const n of negatives) {
        const dp = d(p), dn = d(n);
        if (dp === null || dn === null) { refusedPair += 1; continue; }
        judged += 1;
        const ok = dp < dn;
        if (ok) passed += 1;
        const e = perExercise.get(a.exercise) ?? [0, 0];
        perExercise.set(a.exercise, [e[0] + (ok ? 1 : 0), e[1] + 1]);
      }
    }
  }
  return { judged, passed, refusedRef, refusedPair, perExercise, workouts: byWorkout.size };
}

describe('card 001: the comparison tells the same movement twice from two movements', () => {
  const r = run();
  const share = r.judged ? r.passed / r.judged : 0;
  const h = runSameExercise();
  it('records what it measured', () => {
    const lines = [
      `# Card 001 on the MM-Fit build sets (kine-compare.test.ts; SCOREBOARD=1 rewrites this file)`,
      `sets ${sets.length}, workouts ${r.workouts}`,
      `triplets judged ${r.judged}, passed ${r.passed} (${(100 * share).toFixed(1)} %), threshold ${100 * THRESHOLD} %`,
      `references refused ${r.refusedRef}, triplets with a refused comparison ${r.refusedPair}`,
      ...[...r.perExercise.entries()].sort().map(([e, [p, n]]) => `  ${e}: ${p} of ${n} (${(100 * p / n).toFixed(1)} %)`),
      `harder, not gated: same exercise, same person against another person: ${h.passed} of ${h.judged} (${(100 * h.passed / Math.max(1, h.judged)).toFixed(1)} %), skipped ${h.skipped}`,
    ];
    if (process.env.SCOREBOARD) writeFileSync(resolve(__dirname, 'kine-compare.txt'), lines.join('\n') + '\n');
    console.log(lines.join('\n'));
    expect(r.judged).toBeGreaterThan(0);
  });
  it(`passes on ${100 * THRESHOLD} % of the judged triplets or more`, () => {
    expect(share).toBeGreaterThanOrEqual(THRESHOLD);
  });
});
