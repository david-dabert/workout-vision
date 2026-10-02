import { describe, expect, it } from 'vitest';
import { countReps } from '../core';
import { compareSides, facing } from '../symmetry';

// A synthetic lifter doing lateral raises: each arm rises in the frontal plane from 15° to its own peak,
// 5 reps at 30 fps. side: the body turned a quarter (shoulder line along depth); back: seen from behind.
function raises({ leftPeak = 90, rightPeak = 90, side = false, back = false, reps = 5, turn = 0 } = {}) {
  const fps = 30, per = 2 * fps, frames: any[] = [], ts: number[] = [];
  for (let i = 0; i < reps * per + fps; i++) {
    const phase = i < fps / 2 || i >= reps * per + fps / 2 ? 0 : (1 - Math.cos((2 * Math.PI * (i - fps / 2)) / per)) / 2;
    const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
    const sx = (s: number) => (back ? -s : s);
    // A point s across the body (person's left positive) and y down: across x when square on, along z when turned.
    // turn: the body rotated by that many degrees about the vertical.
    const c = Math.cos((turn * Math.PI) / 180), sn = Math.sin((turn * Math.PI) / 180);
    const at = (s: number, y: number) => (side ? { x: 0, y, z: s, visibility: 1 } : { x: sx(s) * c, y, z: s * sn, visibility: 1 });
    lm[11] = at(0.2, -0.5); lm[12] = at(-0.2, -0.5); lm[23] = at(0.15, 0); lm[24] = at(-0.15, 0);
    for (const [s, peak, e, w] of [[1, leftPeak, 13, 15], [-1, rightPeak, 14, 16]] as const) {
      const a = ((15 + (peak - 15) * phase) * Math.PI) / 180;
      lm[e] = at(s * (0.2 + 0.3 * Math.sin(a)), -0.5 + 0.3 * Math.cos(a));
      lm[w] = at(s * (0.2 + 0.55 * Math.sin(a)), -0.5 + 0.55 * Math.cos(a));
    }
    frames.push(lm); ts.push(i / fps);
  }
  return { frames, ts };
}
const run = (o: Parameters<typeof raises>[0], lift = 'lateral_raise') => {
  const { frames, ts } = raises(o);
  return compareSides(frames, ts, lift, countReps(frames, ts, lift).reps);
};

describe('front-view left/right comparison', () => {
  it('measures each side of a lateral raise filmed square on', () => {
    const { frames, ts } = raises({ leftPeak: 100, rightPeak: 80 });
    expect(facing(frames).front).toBe(true);
    const r = compareSides(frames, ts, 'lateral_raise', countReps(frames, ts, 'lateral_raise').reps);
    expect(r.status).toBe('measured');
    if (r.status !== 'measured') return;
    expect(r.comparison.left).toBeGreaterThan(r.comparison.right);
    // Ranges near 85° and 65°: SI near (65 - 85) / 75 = -27 %, and it agrees with the two ranges shown.
    const { left, right, si } = r.comparison;
    expect(si).toBeGreaterThan(-33);
    expect(si).toBeLessThan(-21);
    expect(si).toBeCloseTo(((right - left) / ((left + right) / 2)) * 100, 6);
  });
  it('reads equal sides as near zero', () => {
    const r = run({});
    expect(r.status === 'measured' && Math.abs(r.comparison.si)).toBeLessThan(2);
  });
  it('refuses a body turned 15° (the 8° gate; a 20° gate would let it in)', () => {
    expect(run({ turn: 15 }).status).toBe('not-front');
    expect(run({ turn: 5 }).status).toBe('measured');
  });
  it('refuses a set filmed from the side or from behind', () => {
    expect(run({ side: true }).status).toBe('not-front');
    expect(run({ back: true }).status).toBe('not-front');
  });
  it('compares only the exercises whose gap reads reliably (lateral raise), not curls, presses, squats or alternating lifts', () => {
    for (const lift of ['bicep_curl', 'overhead_press', 'squat', 'bicep_curl_alternating', 'concentration_curl']) {
      expect(run({}, lift).status).not.toBe('measured');
    }
  });
  it('refuses a set where one side barely moves', () => {
    expect(run({ rightPeak: 25 }).status).toBe('one-side-still');
  });
  it('refuses fewer than 3 reps and unknown lifts', () => {
    const { frames, ts } = raises();
    expect(compareSides(frames, ts, 'lateral_raise', countReps(frames, ts, 'lateral_raise').reps.slice(0, 2)).status).toBe('too-few-reps');
    expect(compareSides(frames, ts, 'no_such_lift', []).status).toBe('no-lift');
  });
});

describe('per-rep comparison', () => {
  it('maps each compared rep to its position and skips a rep the recording cuts', () => {
    const { frames, ts } = raises();
    const reps = countReps(frames, ts, 'lateral_raise').reps.map((r, i) => (i === 1 ? { ...r, clipped: true } : r));
    const r = compareSides(frames, ts, 'lateral_raise', reps);
    expect(r.status).toBe('measured');
    if (r.status !== 'measured') return;
    expect(r.comparison.perRep.map(p => p.at)).toEqual(reps.map((_, i) => i).filter(i => i !== 1));
  });
});
