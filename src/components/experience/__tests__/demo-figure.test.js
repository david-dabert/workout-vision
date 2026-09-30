import { afterEach, describe, expect, it, vi } from 'vitest';

// Review, 30 September: the example's particle body stays inside its canvas (its head rises above
// the landmarks' frame when the figure stands), and only the measured joint's three points are lit.
afterEach(() => vi.unstubAllGlobals());
const recorder = () => {
  const ys = [];
  const ctx = new Proxy({ drawImage: (img, x, y) => ys.push(y) }, { get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {} })), set: (t, k, v) => { t[k] = v; return true; } });
  return { ys, ctx };
};

describe('the example\'s figure', () => {
  it('keeps every grain of the standing body inside the canvas', async () => {
    const { ctx: sprite } = recorder();
    vi.stubGlobal('window', { devicePixelRatio: 1 });
    vi.stubGlobal('navigator', { hardwareConcurrency: 8 });
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => sprite }) });
    const { Body } = await import('../entry-scene');
    const { demoSet } = await import('../demo-set');
    const { fitFigure, figurePoints, grainSize } = await import('../demo-figure');
    const set = demoSet();
    const body = new Body(1300, 7), out = new Float32Array(66);
    for (const [w, h] of [[342, 300], [335, 96]]) {
      const box = fitFigure(set.vb, w, h);
      for (const lm of [set.image[0], set.image[set.image.length - 1]]) {
        figurePoints(lm, box, out);
        const { ys, ctx } = recorder();
        body.draw(ctx, out, { alpha: 0.85, size: grainSize(box, 1), time: 1.5, dpr: 1, stars: 1 }); // as Demo.jsx draws it
        expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it('lights only the measured joint\'s three points', async () => {
    const { litOnly } = await import('../demo-figure');
    const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
    const lit = litOnly(lm, 'knee', 'left').map((p, i) => (p.visibility > 0 ? i : null)).filter(i => i !== null);
    expect(lit).toEqual([23, 25, 27]);
  });
});
