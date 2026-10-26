// The replay's drawing (honesty audit of 14 October 2026, CORE-12): the skeleton, the lit joint with its ring and the lit
// limb's trail, and nothing the legend does not name: no 2D angle arc (it disagreed with the 3D angle in the chip), no
// "bar path" with speed colours and a halo, no "gravity plumb line".
import { describe, expect, it } from 'vitest';
import { drawSkeleton } from '../replay-draw';

function recorder() {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : (...a) => { calls.push([k, ...a]); }),
    set: (t, k, v) => { t[k] = v; calls.push(['set', k, v]); return true; },
  });
  return { ctx, calls };
}
const lm = Array.from({ length: 33 }, (_, i) => ({ x: 0.3 + (i % 5) * 0.1, y: 0.2 + Math.floor(i / 5) * 0.08, visibility: 0.95 }));
const box = { ox: 0, oy: 0, w: 360, h: 640 };

describe('drawSkeleton', () => {
  for (const joint of ['elbow', 'knee', 'hip', 'shoulder']) it(`draws no angle arc, plumb line or halo for a ${joint} lift`, () => {
    const { ctx, calls } = recorder();
    const trail = [{ x: 0.5, y: 0.5, age: 0.5 }, { x: 0.52, y: 0.48, age: 0 }];
    drawSkeleton(ctx, lm, box, ['left'], { joint }, 1, [trail]);
    const arcs = calls.filter(c => c[0] === 'arc');
    // Twelve body dots, then the lit joint's dot (4.5) and ring (9): every arc a full circle, none of radius 14 or 6.5.
    expect(arcs.map(c => c[3])).toEqual([...Array(12).fill(3), 4.5, 9]);
    expect(arcs.every(c => c[4] === 0 && Math.abs(c[5] - Math.PI * 2) < 1e-9)).toBe(true);
    expect(calls.some(c => c[0] === 'setLineDash')).toBe(false);
  });
  it('takes no trajectory argument any more', () => {
    expect(drawSkeleton.length).toBe(5);
  });

  it('draws volumetric Gaussian envelopes when volumetric option is enabled', () => {
    const { ctx, calls } = recorder();
    drawSkeleton(ctx, lm, box, ['left'], { joint: 'elbow' }, 1, null, { volumetric: true });
    // In recorder proxy, ctx.createRadialGradient is intercepted and fills are made
    const fills = calls.filter(c => c[0] === 'fill');
    expect(fills.length).toBeGreaterThan(12); // standard 12 dots + volumetric bones
  });
});
