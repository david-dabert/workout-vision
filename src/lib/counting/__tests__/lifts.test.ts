/**
 * The lifts beyond the first five: each one's joint, its side, and which phase
 * comes first. Ten cycles must count 10 at 15, 30, 60 and 120 samples per second,
 * with wobble of 10% of the range, and with the joint hidden for half a second
 * mid-set. The alternating curl counts both arms, one rep per arm.
 */
import { describe, it, expect } from 'vitest';
import { countReps, type Lift, type CountResult } from '../core';
import { jointFrame, cycles, sample, timestamps, seeded, wobble, type Joint, type Side } from './synthetic';

const SPS = [15, 30, 60, 120];

// joint, rest angle, working angle, and whether the first phase lifts the load
const LIFTS: { lift: Lift; joint: Joint; rest: number; work: number; first: 'concentric' | 'eccentric' }[] = [
  { lift: 'squat', joint: 'knee', rest: 175, work: 80, first: 'eccentric' },
  { lift: 'leg_press', joint: 'knee', rest: 170, work: 80, first: 'eccentric' },
  { lift: 'leg_extension', joint: 'knee', rest: 90, work: 170, first: 'concentric' },
  { lift: 'leg_curl', joint: 'knee', rest: 170, work: 70, first: 'concentric' },
  { lift: 'lunge', joint: 'knee', rest: 175, work: 90, first: 'eccentric' },
  { lift: 'seated_row', joint: 'elbow', rest: 170, work: 70, first: 'concentric' },
  { lift: 'dumbbell_row', joint: 'elbow', rest: 170, work: 70, first: 'concentric' },
  { lift: 'triceps_pushdown', joint: 'elbow', rest: 80, work: 170, first: 'concentric' },
  { lift: 'romanian_deadlift', joint: 'hip', rest: 175, work: 95, first: 'eccentric' },
  { lift: 'hip_thrust', joint: 'hip', rest: 100, work: 175, first: 'concentric' },
  { lift: 'bench_press', joint: 'elbow', rest: 170, work: 80, first: 'eccentric' },
  { lift: 'bicep_curl', joint: 'elbow', rest: 170, work: 50, first: 'concentric' },
  { lift: 'lateral_raise', joint: 'shoulder', rest: 15, work: 100, first: 'concentric' },
];

function frames(joint: Joint, angles: (number | null)[], side: Side = 'left') {
  return angles.map(a => (a === null ? null : jointFrame(joint, { [side]: a })));
}

function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

describe('Counting core — lifts by joint', () => {
  for (const { lift, joint, rest, work, first } of LIFTS) {
    for (const sps of SPS) {
      it(`${lift}: 10 cycles at ${sps} sps with 10% wobble`, () => {
        const rng = seeded(sps);
        const angles = wobble(sample(cycles({ rest, work }), rest, sps), Math.abs(rest - work) * 0.1, rng);
        const result = countReps(frames(joint, angles), timestamps(angles.length, sps), lift);
        expect(result.count).toBe(10);
      });
    }

    it(`${lift}: bridges half a second with the joint hidden`, () => {
      const sps = 15;
      const angles: (number | null)[] = sample(cycles({ rest, work }), rest, sps);
      const mid = Math.floor(angles.length / 2);
      for (let i = mid; i < mid + Math.round(0.5 * sps); i++) angles[i] = null;
      const result = countReps(frames(joint, angles), timestamps(angles.length, sps), lift);
      expect(result.count).toBe(10);
    });

    it(`${lift}: the ${first} phase comes first`, () => {
      // First phase 1.2 s, second 0.8 s: the phases are told apart by their length.
      const sps = 30;
      const angles = sample(cycles({ rest, work, firstSec: 1.2, secondSec: 0.8 }), rest, sps);
      const result = countReps(frames(joint, angles), timestamps(angles.length, sps), lift);
      expect(result.count).toBe(10);
      const firstPhase = median(result.reps.map(r => (first === 'concentric' ? r.concentricSec : r.eccentricSec)));
      const secondPhase = median(result.reps.map(r => (first === 'concentric' ? r.eccentricSec : r.concentricSec)));
      expect(firstPhase).toBeGreaterThan(secondPhase);
    });
  }

  it('a recording that starts inside a rep counts it and marks it as cut; a rep completed at the last frame is whole', () => {
    // Six curls; the video starts halfway down the first and stops as the last one ends.
    const sps = 30, full = sample(cycles({ rest: 170, work: 50, reps: 6 }), 170, sps);
    const angles = full.slice(Math.round(1.3 * sps), full.length - Math.round(0.8 * sps));
    const result = countReps(frames('elbow', angles), timestamps(angles.length, sps), 'bicep_curl');
    expect(result.count).toBe(6);
    expect(result.reps.map(r => !!r.clipped)).toEqual([true, false, false, false, false, false]);
  });

  it('squat: tracks the side whose hip, knee and ankle are visible', () => {
    const sps = 15;
    const angles = sample(cycles({ rest: 175, work: 80, reps: 6 }), 175, sps);
    const result = countReps(frames('knee', angles, 'right'), timestamps(angles.length, sps), 'squat');
    expect(result.arm).toBe('right');
    expect(result.count).toBe(6);
  });
});

// ─── Alternating curl: both arms, one rep per arm ───

/** Both arms over time: each rep is one arm's cycle, placed at its own time. */
function twoArms(reps: { side: Side | 'both'; at: number }[], { sps, repSec = 1.6, lag = 0, total }: { sps: number; repSec?: number; lag?: number; total: number }) {
  const n = Math.round(total * sps);
  const rest = 170, work = 50;
  const left = new Array<number>(n).fill(rest), right = new Array<number>(n).fill(rest);
  const put = (arm: number[], at: number) => {
    for (let i = 0; i < n; i++) {
      const u = (i / sps - at) / repSec; // 0 → 1 across the rep
      if (u < 0 || u > 1) continue;
      arm[i] = rest - (rest - work) * (u < 0.5 ? u * 2 : (1 - u) * 2);
    }
  };
  for (const r of reps) {
    if (r.side !== 'right') put(left, r.at);
    if (r.side !== 'left') put(right, r.at + (r.side === 'both' ? lag : 0));
  }
  return { left, right };
}

function countBoth(left: (number | null)[], right: (number | null)[], sps: number, hideRight = false): CountResult {
  const frames = left.map((l, i) => {
    const r = right[i];
    if (l === null && r === null) return null;
    const angles: Partial<Record<Side, number>> = {};
    if (l !== null) angles.left = l;
    if (r !== null && !hideRight) angles.right = r;
    return jointFrame('elbow', angles);
  });
  return countReps(frames, timestamps(left.length, sps), 'bicep_curl_alternating');
}

describe('Counting core — alternating curl', () => {
  for (const sps of SPS) {
    it(`strict alternation, 5 reps per arm, counts 10 at ${sps} sps`, () => {
      const reps = Array.from({ length: 10 }, (_, k) => ({ side: (k % 2 ? 'right' : 'left') as Side, at: 0.5 + k * 2.2 }));
      const { left, right } = twoArms(reps, { sps, total: 23 });
      const rng = seeded(sps);
      const result = countBoth(wobble(left, 12, rng), wobble(right, 12, rng), sps);
      expect(result.count).toBe(10);
      expect(result.arm).toBe('both');
    });
  }

  it('alternation where each arm starts halfway through the other arm\'s rep counts 10', () => {
    const sps = 30;
    const reps = Array.from({ length: 10 }, (_, k) => ({ side: (k % 2 ? 'right' : 'left') as Side, at: 0.5 + k * 0.8 }));
    const { left, right } = twoArms(reps, { sps, total: 10 });
    expect(countBoth(left, right, sps).count).toBe(10);
  });

  it('both arms together, the right a tenth of a second behind, counts one rep per lift: 10', () => {
    const sps = 30;
    const reps = Array.from({ length: 10 }, (_, k) => ({ side: 'both' as const, at: 0.5 + k * 2.2 }));
    const { left, right } = twoArms(reps, { sps, lag: 0.1, total: 23 });
    expect(countBoth(left, right, sps).count).toBe(10);
  });

  it('five reps with the left arm, then five with the right, counts 10', () => {
    const sps = 15;
    const reps = Array.from({ length: 10 }, (_, k) => ({ side: (k < 5 ? 'left' : 'right') as Side, at: 0.5 + k * 2.2 }));
    const { left, right } = twoArms(reps, { sps, total: 23 });
    expect(countBoth(left, right, sps).count).toBe(10);
  });

  it('one arm working while the other rests in view counts that arm: 7', () => {
    const sps = 15;
    const reps = Array.from({ length: 7 }, (_, k) => ({ side: 'right' as Side, at: 0.5 + k * 2.2 }));
    const { left, right } = twoArms(reps, { sps, total: 17 });
    expect(countBoth(left, right, sps).count).toBe(7);
  });

  it('bridges half a second with one arm hidden mid-set', () => {
    const sps = 15;
    const reps = Array.from({ length: 10 }, (_, k) => ({ side: (k % 2 ? 'right' : 'left') as Side, at: 0.5 + k * 2.2 }));
    const { left, right } = twoArms(reps, { sps, total: 23 });
    const l: (number | null)[] = [...left];
    const mid = Math.round(11 * sps);
    for (let i = mid; i < mid + Math.round(0.5 * sps); i++) l[i] = null;
    expect(countBoth(l, right, sps).count).toBe(10);
  });

  it('an arm hidden for the whole set leaves the count unsure: confidence under one half', () => {
    const sps = 15;
    const reps = Array.from({ length: 10 }, (_, k) => ({ side: (k % 2 ? 'right' : 'left') as Side, at: 0.5 + k * 2.2 }));
    const { left, right } = twoArms(reps, { sps, total: 23 });
    const result = countBoth(left, right, sps, true);
    expect(result.count).toBe(5);
    expect(result.confidence).toBeLessThan(0.5);
  });
});
