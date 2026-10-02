import { describe, expect, it } from 'vitest';
import { countReps } from '../core';
import { compareSides, facing } from '../symmetry';

// A synthetic lifter doing curls: each elbow swings between 160° and its own lowest angle, 5 reps at 30 fps.
function curls({ leftLow = 50, rightLow = 50, side = false, back = false, reps = 5 } = {}) {
  const fps = 30, per = 2 * fps, frames = [], ts = [];
  for (let i = 0; i < reps * per + fps; i++) {
    const phase = i < fps / 2 || i >= reps * per + fps / 2 ? 0 : (1 - Math.cos((2 * Math.PI * (i - fps / 2)) / per)) / 2;
    const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
    // Front: the shoulder line along x; side: along z (depth).
    // Seen from behind, the person's left lies on -x.
    const sx = (s: number) => (back ? -s : s);
    const at = (k: number, s: number, y: number) => (lm[k] = side ? { x: 0, y, z: s, visibility: 1 } : { x: sx(s), y, z: 0, visibility: 1 });
    at(11, 0.2, -0.5); at(12, -0.2, -0.5); at(23, 0.15, 0); at(24, -0.15, 0);
    at(13, 0.2, -0.2); at(14, -0.2, -0.2);
    for (const [k, s, low] of [[15, 0.2, leftLow], [16, -0.2, rightLow]] as const) {
      const a = ((160 - (160 - low) * phase) * Math.PI) / 180;
      // Forearm at angle a from the upper arm, which points up from the elbow; it swings in depth.
      const f = side ? { x: 0.25 * Math.sin(a), y: -0.2 - 0.25 * Math.cos(a), z: s } : { x: sx(s), y: -0.2 - 0.25 * Math.cos(a), z: 0.25 * Math.sin(a) };
      lm[k] = { ...f, visibility: 1 };
    }
    frames.push(lm); ts.push(i / fps);
  }
  return { frames, ts };
}

describe('front-view left/right comparison', () => {
  it('measures each side on a set filmed from the front', () => {
    const { frames, ts } = curls({ leftLow: 50, rightLow: 70 });
    expect(facing(frames).front).toBe(true);
    const r = compareSides(frames, ts, 'bicep_curl', countReps(frames, ts, 'bicep_curl').reps);
    expect(r.status).toBe('measured');
    if (r.status !== 'measured') return;
    expect(r.comparison.left).toBeGreaterThan(r.comparison.right);
    // Ranges near 110° and 90°: SI near (90 - 110) / 100 = -20 %, and it agrees with the two ranges shown.
    expect(r.comparison.si).toBeGreaterThan(-26);
    expect(r.comparison.si).toBeLessThan(-14);
    const { left, right, si } = r.comparison;
    expect(si).toBeCloseTo(((right - left) / ((left + right) / 2)) * 100, 6);
  });
  it('reads equal sides as near zero', () => {
    const { frames, ts } = curls();
    const r = compareSides(frames, ts, 'bicep_curl', countReps(frames, ts, 'bicep_curl').reps);
    expect(r.status === 'measured' && Math.abs(r.comparison.si)).toBeLessThan(2);
  });
  it('refuses a set filmed from the side', () => {
    const { frames, ts } = curls({ side: true });
    expect(facing(frames).front).toBe(false);
    expect(compareSides(frames, ts, 'bicep_curl', countReps(frames, ts, 'bicep_curl').reps).status).toBe('not-front');
  });
  it('refuses a set seen from behind', () => {
    const { frames, ts } = curls({ back: true });
    expect(facing(frames).front).toBe(false);
  });
  it('refuses one-arm work: by exercise, and when one side barely moves', () => {
    const { frames, ts } = curls({ rightLow: 158 });
    for (const lift of ['concentration_curl', 'dumbbell_row', 'bicep_curl_alternating', 'lunge']) {
      expect(compareSides(frames, ts, lift, countReps(frames, ts, lift).reps).status).not.toBe('measured');
    }
    expect(compareSides(frames, ts, 'bicep_curl', countReps(frames, ts, 'bicep_curl').reps).status).toBe('one-side-still');
  });
  it('refuses fewer than 3 reps and unknown lifts', () => {
    const { frames, ts } = curls();
    expect(compareSides(frames, ts, 'bicep_curl', countReps(frames, ts, 'bicep_curl').reps.slice(0, 2)).status).toBe('too-few-reps');
    expect(compareSides(frames, ts, 'no_such_lift', []).status).toBe('no-lift');
  });
});

describe('per-rep comparison', () => {
  it('maps each compared rep to its position and skips a rep the recording cuts', () => {
    const { frames, ts } = (() => {
      // Same synthetic set as above, rebuilt here to keep this block standalone.
      const fps = 30, per = 60, out: any[] = [], t: number[] = [];
      for (let i = 0; i < 5 * per + fps; i++) {
        const phase = i < fps / 2 || i >= 5 * per + fps / 2 ? 0 : (1 - Math.cos((2 * Math.PI * (i - fps / 2)) / per)) / 2;
        const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
        lm[11] = { x: 0.2, y: -0.5, z: 0, visibility: 1 }; lm[12] = { x: -0.2, y: -0.5, z: 0, visibility: 1 };
        lm[23] = { x: 0.15, y: 0, z: 0, visibility: 1 }; lm[24] = { x: -0.15, y: 0, z: 0, visibility: 1 };
        lm[13] = { x: 0.2, y: -0.2, z: 0, visibility: 1 }; lm[14] = { x: -0.2, y: -0.2, z: 0, visibility: 1 };
        for (const [k, s] of [[15, 0.2], [16, -0.2]] as const) { const a = ((160 - 110 * phase) * Math.PI) / 180; lm[k] = { x: s, y: -0.2 - 0.25 * Math.cos(a), z: 0.25 * Math.sin(a), visibility: 1 }; }
        out.push(lm); t.push(i / fps);
      }
      return { frames: out, ts: t };
    })();
    const reps = countReps(frames, ts, 'bicep_curl').reps.map((r, i) => (i === 1 ? { ...r, clipped: true } : r));
    const r = compareSides(frames, ts, 'bicep_curl', reps);
    expect(r.status).toBe('measured');
    if (r.status !== 'measured') return;
    expect(r.comparison.perRep.map(p => p.at)).toEqual(reps.map((_, i) => i).filter(i => i !== 1));
  });
});
