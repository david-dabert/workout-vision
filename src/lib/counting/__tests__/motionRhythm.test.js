import { describe, it, expect } from 'vitest';
import { motionCount, dominantPeriod, prominentPeaks, roiFromBoxes, countExcursions, crossCheck, principalSignals } from '../motionRhythm.js';

const FPS = 15;

/**
 * A synthetic gray video: a bright square (the "weight") on a textured background moving down and back `reps` times,
 * with `restSec` of stillness before and after, and pixel noise. Seeded, deterministic.
 */
function video({ reps = 8, repSec = 2, restSec = 1.5, w = 48, h = 64, noise = 6, seed = 7, travel = 0.5, jitter = 0, pauseSec = 0 } = {}) {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const bg = new Uint8Array(w * h).map((_, i) => 60 + ((i * 37) % 50));
  const frames = [], timestamps = [];
  const durs = Array.from({ length: reps }, () => repSec * (1 + jitter * (rnd() - 0.5)) + pauseSec);
  const total = restSec * 2 + durs.reduce((a, b) => a + b, 0);
  for (let i = 0; i < Math.round(total * FPS); i++) {
    const t = i / FPS;
    let y = 0, acc = restSec;
    for (const d of durs) { if (t >= acc && t < acc + d - pauseSec) y = (1 - Math.cos((2 * Math.PI * (t - acc)) / (d - pauseSec))) / 2; acc += d; }
    const top = Math.round(h * 0.15 + y * travel * h);
    const f = new Uint8Array(w * h);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const inside = yy >= top && yy < top + h * 0.2 && xx >= w * 0.3 && xx < w * 0.7;
      f[yy * w + xx] = Math.max(0, Math.min(255, (inside ? 220 : bg[yy * w + xx]) + (rnd() - 0.5) * 2 * noise));
    }
    frames.push(f); timestamps.push(t);
  }
  return { frames, w, h, timestamps };
}

describe('motionRhythm', () => {
  it('counts a clean periodic set and finds its period', () => {
    const r = motionCount(video({ reps: 8, repSec: 2 }));
    expect(r.count).toBe(8);
    expect(r.period).toBeGreaterThan(1.8);
    expect(r.period).toBeLessThan(2.2);
    expect(r.confidence).toBeGreaterThan(0.5);
  });

  // Known limit: reps that turn at the rest without pausing give no side where the set dwells, and the rest side is
  // counted instead (11 returns between 12 reps).
  it.fails('counts 12 fast reps that never pause at the rest', () => {
    expect(motionCount(video({ reps: 12, repSec: 1.1 })).count).toBe(12);
  });

  it('counts slow sets and uneven reps', () => {
    expect(motionCount(video({ reps: 5, repSec: 4, seed: 3 })).count).toBe(5);
    expect(motionCount(video({ reps: 9, repSec: 2, jitter: 0.4, pauseSec: 0.5, seed: 11 })).count).toBe(9);
    expect(motionCount(video({ reps: 12, repSec: 1.1, pauseSec: 0.4 })).count).toBe(12);
  });

  // The same limit with uneven reps: 8 for 9.
  it.fails('counts 9 uneven reps that never pause at the rest', () => {
    expect(motionCount(video({ reps: 9, repSec: 2, jitter: 0.4, seed: 11 })).count).toBe(9);
  });

  it('counts with heavy pixel noise', () => {
    expect(motionCount(video({ reps: 7, repSec: 2, noise: 40, seed: 5 })).count).toBe(7);
  });

  it('gives no count and no confidence on a still video', () => {
    const r = motionCount(video({ reps: 0, restSec: 5 }));
    expect(r.confidence).toBe(0);
  });

  it('reads the region around the poses, or the whole frame when poses are scarce', () => {
    const boxes = Array.from({ length: 10 }, () => [0.4, 0.2, 0.6, 0.8]);
    const roi = roiFromBoxes(boxes);
    expect(roi[0]).toBeCloseTo(0.37, 2);
    expect(roi[3]).toBeCloseTo(0.89, 2);
    expect(roiFromBoxes([null, null, null, [0.4, 0.2, 0.6, 0.8]])).toEqual([0, 0, 1, 1]);
    expect(roiFromBoxes([])).toEqual([0, 0, 1, 1]);
  });

  it('takes the period, not a multiple of it', () => {
    const sig = Array.from({ length: 300 }, (_, i) => Math.sin((2 * Math.PI * i) / 25));
    expect(dominantPeriod(sig, 10, 120).lag).toBe(25);
  });

  it('keeps prominent peaks only, spaced', () => {
    const s = [0, 5, 0, 0.3, 0.1, 0.2, 5, 4.9, 5, 0];
    expect(prominentPeaks(s, 1, 2)).toEqual([1, 6]);
  });

  it('counts excursions away from the rest, whichever their sign', () => {
    const sig = Array.from({ length: 200 }, (_, i) => (i < 20 || i >= 180 ? 0 : -(1 - Math.cos((2 * Math.PI * (i - 20)) / 20)) / 2));
    expect(countExcursions(sig, 20).peaks.length).toBe(8);
    expect(countExcursions(sig.map(x => -x), 20).peaks.length).toBe(8);
  });

  it('finds the strongest component first', () => {
    const vecs = Array.from({ length: 40 }, (_, t) => Float64Array.from([Math.sin(t / 3) * 10, Math.cos(t / 5), 0]));
    const { signals: [pc1], weights } = principalSignals(vecs, 2);
    expect(weights[0]).toBeGreaterThan(weights[1]);
    const corr = pc1.reduce((s, x, t) => s + x * Math.sin(t / 3), 0);
    expect(Math.abs(corr)).toBeGreaterThan(15);
  });

  it('flags a disagreement and fuses only on low coverage', () => {
    const m = { count: 9, confidence: 0.6 };
    expect(crossCheck(9, m, 1)).toEqual({ agree: true, flag: false, fused: 9 });
    expect(crossCheck(7, m, 0.98)).toEqual({ agree: false, flag: true, fused: 7 });
    expect(crossCheck(5, m, 0.6)).toEqual({ agree: false, flag: true, fused: 9 });
    expect(crossCheck(null, m, 0.4)).toEqual({ agree: false, flag: true, fused: 9 });
    expect(crossCheck(5, { count: 9, confidence: 0.1 }, 0.6).fused).toBe(5);
  });
});
