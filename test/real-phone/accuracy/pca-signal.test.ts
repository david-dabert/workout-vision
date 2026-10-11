import { expect, it } from 'vitest';
import { pcaSignal } from './pca-signal';

it('moves with the joint angle even where the angle is missing on part of the frames', () => {
  const n = 60, wave = (i: number) => Math.sin((2 * Math.PI * i) / 20);
  const wl = Array.from({ length: n }, (_, i) => Array.from({ length: 33 }, (_, j) => ({ x: (j === 23 || j === 24 ? 0 : wave(i)) + j * 0.01, y: j === 11 || j === 12 ? 1 : j * 0.01, z: 0, visibility: 1 })));
  const angle = Array.from({ length: n }, (_, i) => (wave(i) > 0 ? null : 150 + 20 * wave(i)));
  const s = pcaSignal(wl, angle);
  const pairs = angle.map((a, i) => [a, s[i]] as const).filter((p): p is readonly [number, number] => p[0] !== null && p[1] !== null);
  const ma = pairs.reduce((t, p) => t + p[0], 0) / pairs.length;
  expect(pairs.reduce((t, [a, x]) => t + x * (a - ma), 0)).toBeGreaterThan(0);
});
