import { describe, expect, it } from 'vitest';
import { ghostPoints, nearestIndex, pathMaps, refTimeFor } from '../overlay.js';

const body = (dx = 0, dy = 0, s = 1) => {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
  const put = (i, x, y) => { lm[i] = { x: dx + x * s, y: dy + y * s, visibility: 1 }; };
  put(11, 0.4, 0.3); put(12, 0.6, 0.3); put(23, 0.42, 0.6); put(24, 0.58, 0.6);
  put(13, 0.3, 0.45); put(14, 0.75, 0.2); put(15, 0.25, 0.6); put(16, 0.85, 0.1);
  return lm;
};

describe('comparison overlay', () => {
  it('finds the sample nearest a time', () => {
    expect(nearestIndex([0, 0.1, 0.2, 0.3], 0.16)).toBe(2);
    expect(nearestIndex([0, 0.1, 0.2, 0.3], -1)).toBe(0);
    expect(nearestIndex([0, 0.1, 0.2, 0.3], 9)).toBe(3);
  });

  it('maps every attempt moment to a reference moment, the footage outside the match to its ends', () => {
    const path = [[0, 2], [1, 3], [1, 4], [2, 5]];
    const { refOfAtt, attOfRef } = pathMaps(path, 8);
    expect(refOfAtt).toEqual([0, 0, 0, 1, 1, 2, 2, 2]);
    expect(attOfRef).toEqual([2, 3, 5]);
    expect(refTimeFor(0.45, { attT0: 0, refT0: 1, refOfAtt })).toBeCloseTo(1.2);
  });

  it('lays the reference on the patient\'s trunk, moved and scaled', () => {
    const g = ghostPoints(body(), { w: 100, h: 100 }, body(0.1, 0.05, 0.5), { w: 100, h: 100 });
    // The patient's body is the reference's at half size, moved: the ghost falls exactly on it.
    expect(g[16].x).toBeCloseTo((0.1 + 0.85 * 0.5) * 100, 3);
    expect(g[16].y).toBeCloseTo((0.05 + 0.1 * 0.5) * 100, 3);
  });

  it('mirrors the reference for a patient filmed from the other side', () => {
    const mirrored = body().map(p => ({ ...p, x: 1 - p.x }));
    // Swap sides so the left landmarks are on the left of the mirrored picture, as MediaPipe would name them.
    const g = ghostPoints(body(), { w: 100, h: 100 }, mirrored, { w: 100, h: 100 });
    expect(g[11].x).toBeCloseTo(60, 3);
    expect(g[12].x).toBeCloseTo(40, 3);
  });

  it('draws no ghost when a trunk is not seen', () => {
    const hidden = body();
    hidden[23] = { ...hidden[23], visibility: 0.1 };
    expect(ghostPoints(hidden, { w: 1, h: 1 }, body(), { w: 1, h: 1 })).toBeNull();
  });
});
