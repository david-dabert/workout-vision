// EquiVision's engine, held to honesty properties (audit of 14 October 2026, EQ-04 to EQ-09, EQ-23): a trace with no
// regular stride is refused, never read as symmetric; no limb or verdict exists in the report; the differences it
// reads on the simulated horse match what the simulation was written with; the stride's rate is read to 0.02 Hz.
import { describe, it, expect } from 'vitest';
import {
  analyzeEquineGait,
  calculateCircleLean,
  savitzkyGolay,
  type EquineFrame,
} from '../kinematics';
import { simulateTrot, FORE_LAMENESS_MM, HIND_LAMENESS_MM } from '../simulation';

/** Deterministic noise (Park-Miller), so a failure can be replayed. */
function noise(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

function noiseFrames(seed: number, n = 120, fps = 30, mm = 10): EquineFrame[] {
  const r = noise(seed);
  return Array.from({ length: n }, (_, i) => ({
    timestamp: (i * 1000) / fps,
    landmarks: { poll: { x: 0, y: (r() - 0.5) * mm }, sacrum: { x: 0, y: (r() - 0.5) * mm } },
  }));
}

describe('Savitzky-Golay smoothing', () => {
  it('keeps a quadratic as it is and leaves the three edge samples untouched', () => {
    const q = Array.from({ length: 12 }, (_, i) => 0.5 * i * i - 3 * i + 2);
    const s = savitzkyGolay(q, 7);
    for (let i = 0; i < q.length; i++) expect(s[i]).toBeCloseTo(q[i], 9);
  });

  it('refuses a window it does not implement rather than return wrong values', () => {
    expect(() => savitzkyGolay([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5)).toThrow(RangeError);
    expect(() => savitzkyGolay([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 9)).toThrow(RangeError);
  });
});

describe('refusals: nothing measurable is never "sound"', () => {
  it('refuses an empty input', () => {
    const r = analyzeEquineGait([]);
    expect(r.refused).toBe('too_few_frames');
    expect(r.strideFrequencyHz).toBeNull();
  });

  it('refuses a flat trace', () => {
    const frames = Array.from({ length: 120 }, (_, i) => ({ timestamp: i * 33.3, landmarks: { poll: { x: 0, y: 5 }, sacrum: { x: 0, y: 3 } } }));
    const r = analyzeEquineGait(frames);
    expect(r.refused).toBe('no_regular_stride');
    expect(r.totalStrides).toBe(0);
    expect(r.channels.poll?.meanMinDiff).toBeNull();
  });

  it('refuses too short a trace', () => {
    const r = analyzeEquineGait(simulateTrot('sound').frames.slice(0, 10));
    expect(r.refused).toBe('too_few_frames');
  });

  it('refuses white noise on 500 seeds', () => {
    const passed = [];
    for (let seed = 1; seed <= 500; seed++) if (analyzeEquineGait(noiseFrames(seed)).refused === null) passed.push(seed);
    expect(passed).toEqual([]);
  });

  it('refuses a trace with a missing point rather than invent the gap', () => {
    const { frames } = simulateTrot('sound');
    const holed = frames.map((f, i) => (i === 40 ? { ...f, landmarks: { sacrum: f.landmarks.sacrum } } : f));
    const r = analyzeEquineGait(holed);
    expect(r.channels.poll?.refused).toBe('no_trace');
    expect(r.channels.sacrum?.refused).toBeNull();
  });

  it('carries no verdict, no limb and no duty factor', () => {
    const r = analyzeEquineGait(simulateTrot('fore').frames) as unknown as Record<string, unknown>;
    for (const key of ['isClinicallySymmetric', 'suspectedLamenessLimb', 'meanDutyFactor', 'meanWithersAsymmetryPct', 'meanPelvicAsymmetryPct']) {
      expect(r).not.toHaveProperty(key);
    }
  });
});

describe('the simulated horse, read back', () => {
  for (const fps of [25, 30, 60]) {
    it(`reads the stride to 0.02 Hz at ${fps} images/s`, () => {
      const { frames, truth } = simulateTrot('sound', { fps });
      const r = analyzeEquineGait(frames);
      expect(r.refused).toBeNull();
      expect(Math.abs((r.strideFrequencyHz as number) - 1000 / truth.strideMs)).toBeLessThan(0.02);
      expect(r.totalStrides).toBeGreaterThanOrEqual(4);
    });
  }

  it('reads a regular trot as two equal dips, head and pelvis, within 0.1 mm', () => {
    const r = analyzeEquineGait(simulateTrot('sound').frames);
    expect(Math.abs(r.channels.poll?.meanMinDiff as number)).toBeLessThan(0.1);
    expect(Math.abs(r.channels.sacrum?.meanMinDiff as number)).toBeLessThan(0.1);
  });

  // The engine reads short of the programmed difference at low frame rates (smoothing over 7 samples flattens the
  // dips): 18.1 mm of 20 at 25 images/s, 18.8 at 30, 19.9 at 60 on 14 October 2026. These bounds hold that.
  const BOUNDS: Record<number, number> = { 25: 2.0, 30: 1.3, 60: 0.2 };
  for (const fps of [25, 30, 60]) {
    it(`finds the programmed head difference of a lame fore, and only on the head, at ${fps} images/s`, () => {
      const r = analyzeEquineGait(simulateTrot('fore', { fps }).frames);
      expect(Math.abs(Math.abs(r.channels.poll?.meanMinDiff as number) - FORE_LAMENESS_MM)).toBeLessThan(BOUNDS[fps] * FORE_LAMENESS_MM / 20);
      expect(Math.abs(r.channels.sacrum?.meanMinDiff as number)).toBeLessThan(0.1);
      expect(Math.abs(r.channels.poll?.meanMaxDiff as number)).toBeLessThan(0.1);
    });

    it(`finds the programmed pelvis difference of a lame hind, and only on the pelvis, at ${fps} images/s`, () => {
      const r = analyzeEquineGait(simulateTrot('hind', { fps }).frames);
      expect(Math.abs(Math.abs(r.channels.sacrum?.meanMinDiff as number) - HIND_LAMENESS_MM)).toBeLessThan(BOUNDS[fps] * HIND_LAMENESS_MM / 20);
      expect(Math.abs(r.channels.poll?.meanMinDiff as number)).toBeLessThan(0.1);
    });
  }

  it('reads the same size whatever frame the clip starts on; only the sign (dip A or B) follows the start', () => {
    const { frames } = simulateTrot('fore');
    const sizes = [], signs = new Set();
    for (const off of [0, 3, 6, 9, 11, 12, 15, 18]) {
      const d = analyzeEquineGait(frames.slice(off)).channels.poll?.meanMinDiff as number;
      sizes.push(Math.abs(d));
      signs.add(Math.sign(d));
    }
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThan(0.2);
    // Both signs occur: which dip comes first depends on where the clip starts, which is why no limb is ever named.
    expect(signs).toEqual(new Set([1, -1]));
  });

  it('places every dip on the smoothed curve it was found on (within half a frame and 2 mm of its sample)', () => {
    // The first engine drew its dots at a window's start time with another dip's value, up to 48 % of the chart off
    // the curve (audit, missed item on the trace). A dip is now its own sample, moved by the parabola between frames.
    const { frames } = simulateTrot('fore');
    const r = analyzeEquineGait(frames);
    const c = r.channels.poll!;
    for (const d of c.dips) {
      expect(Math.abs(d.time - frames[d.index].timestamp)).toBeLessThanOrEqual(1000 / 30 / 2 + 1e-9);
      expect(Math.abs(d.value - c.smoothed[d.index])).toBeLessThan(2);
      expect(d.value).toBeLessThanOrEqual(c.smoothed[d.index] + 1e-9);
    }
  });

  it('refuses an unknown scenario instead of falling back to a lameness', () => {
    // @ts-expect-error: the scenario is checked at run time too
    expect(() => simulateTrot('custom')).toThrow(RangeError);
  });
});

describe('circle lean calculator', () => {
  it('computes arctan(v^2 / gR) in degrees', () => {
    // 10 m at 3.5 m/s: arctan(12.25 / 98.0665) = 7.12 degrees.
    expect(calculateCircleLean(10, 3.5)).toBeCloseTo(7.12, 2);
    expect(calculateCircleLean(0, 3.5)).toBe(0);
  });
});
