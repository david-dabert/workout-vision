import { describe, it, expect } from 'vitest';
import { OneEuroFilter1D, OneEuroFilter3D, OneEuroPoseFilter } from '../oneEuroFilter';

describe('Adaptive 1€ (One-Euro) Biomechanical Filter', () => {
  it('dampens high-frequency jitter when signal is stationary', () => {
    const filter = new OneEuroFilter1D({ minCutoff: 1.0, beta: 0.007 });
    const trueAngle = 90.0;
    const noisySamples: number[] = [];

    // Simulate 30 fps stationary pause at the bottom of a squat with +/- 2 deg sensor jitter
    let t = 0;
    const filteredSamples: number[] = [];
    for (let i = 0; i < 30; i++) {
      t += 1 / 30;
      const noise = (i % 2 === 0 ? 1 : -1) * 2.0;
      const raw = trueAngle + noise;
      noisySamples.push(raw);
      filteredSamples.push(filter.filter(raw, t));
    }

    // After initial convergence, filtered signal variance should be dramatically lower than raw noise
    const steadyFiltered = filteredSamples.slice(10);
    const maxFilteredDeviation = Math.max(...steadyFiltered.map(v => Math.abs(v - trueAngle)));
    expect(maxFilteredDeviation).toBeLessThan(0.8); // Jitter reduced from +/- 2.0 to < 0.8
  });

  it('tracks rapid velocity changes with near-zero phase lag', () => {
    const filter = new OneEuroFilter1D({ minCutoff: 1.0, beta: 0.05 }); // High beta = aggressive lag reduction

    // Simulate explosive concentric ascent: 90 deg -> 180 deg in 0.5s (180 deg/s)
    let t = 0;
    let maxLag = 0;
    for (let i = 0; i <= 15; i++) {
      t += 1 / 30;
      const trueVal = 90 + (90 * (i / 15));
      const filtered = filter.filter(trueVal, t);
      const lag = Math.abs(trueVal - filtered);
      if (i > 3 && lag > maxLag) maxLag = lag;
    }

    // During fast movement, lag should remain tightly bounded
    expect(maxLag).toBeLessThan(12.0);
  });

  it('filters 3D spatial landmark coordinates in real-time', () => {
    const filter3D = new OneEuroFilter3D({ minCutoff: 1.0, beta: 0.01 });

    const p1 = filter3D.filter({ x: 0.5, y: 0.5, z: 0.1, visibility: 0.95 }, 0.033);
    expect(p1.x).toBeCloseTo(0.5);
    expect(p1.y).toBeCloseTo(0.5);
    expect(p1.z).toBeCloseTo(0.1);
    expect(p1.visibility).toBe(0.95);

    // Minor jitter
    const p2 = filter3D.filter({ x: 0.52, y: 0.49, z: 0.09, visibility: 0.95 }, 0.066);
    expect(p2.x).toBeGreaterThan(0.5);
    expect(p2.x).toBeLessThan(0.52); // Smoothed
  });

  it('filters full 33-pose landmark skeleton streams', () => {
    const poseFilter = new OneEuroPoseFilter();
    const mockLandmarks = Array.from({ length: 33 }, (_, i) => ({
      x: 0.5 + i * 0.01,
      y: 0.4 + i * 0.01,
      visibility: 0.9,
    }));

    const out = poseFilter.filter(mockLandmarks, 0.033);
    expect(out.length).toBe(33);
    expect(out[0].x).toBeCloseTo(mockLandmarks[0].x);
  });
});
