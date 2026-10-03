/**
 * Frozen-read incident, 3 October 2026. At a demo on David's iPhone a machine lateral raise counted 0, twice, not
 * refused; the same video read through WebCodecs (collect.html) gave 460 samples, no two skeletons alike, and 8 of 9.
 * A read that hands on the same picture again and again is now a read failure (frozenRead.js), at the pictures
 * (frameExtractor.js) and at the skeletons (coreAnalysis.js, analyzeCoreVideo).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { FROZEN_MIN_SAMPLES, FROZEN_SHARE, frameFingerprint, isFrozenRead, repeatCounter } from '../frozenRead';
import { repeatedSkeletons, summarizeCount } from '../coreAnalysis';

const pixels = (seed, n = 360 * 640) => { const d = new Uint8ClampedArray(n * 4); for (let i = 0; i < d.length; i++) d[i] = (i * 31 + seed * 7) & 255; return d; };

describe('the fingerprint of a sample', () => {
  it('is the same for the same picture and differs when the picture changes', () => {
    expect(frameFingerprint(pixels(1))).toBe(frameFingerprint(pixels(1)));
    expect(frameFingerprint(pixels(1))).not.toBe(frameFingerprint(pixels(2)));
  });
  it('sees a change of one pixel it reads, and ignores the alpha channel', () => {
    const a = pixels(3), b = pixels(3), c = pixels(3);
    b[7 * 4 * 1000] ^= 1;  // the red of the 7000th pixel, one of every seventh
    c[3] ^= 1;  // an alpha
    expect(frameFingerprint(b)).not.toBe(frameFingerprint(a));
    expect(frameFingerprint(c)).toBe(frameFingerprint(a));
  });
});

describe('the frozen-share rule', () => {
  it('passes the healthy read of the incident video: 0 repeats in 460', () => {
    expect(isFrozenRead({ samples: 460, repeats: 0 })).toBe(false);
  });
  it(`calls a read frozen above ${FROZEN_SHARE * 100} % of repeats, not at or under it`, () => {
    expect(isFrozenRead({ samples: 461, repeats: 230 })).toBe(false);  // 230 of 460, exactly half
    expect(isFrozenRead({ samples: 461, repeats: 231 })).toBe(true);
    expect(isFrozenRead({ samples: 460, repeats: 459 })).toBe(true);
    // The most measured on anything filmed or rendered: 8 of 150 (public), 27 % (synthetic renders at rest).
    expect(isFrozenRead({ samples: 150, repeats: 8 })).toBe(false);
    expect(isFrozenRead({ samples: 251, repeats: 67 })).toBe(false);
  });
  it(`never decides on fewer than ${FROZEN_MIN_SAMPLES} samples`, () => {
    expect(isFrozenRead({ samples: FROZEN_MIN_SAMPLES - 1, repeats: FROZEN_MIN_SAMPLES - 2 })).toBe(false);
    expect(isFrozenRead({ samples: FROZEN_MIN_SAMPLES, repeats: FROZEN_MIN_SAMPLES - 1 })).toBe(true);
  });
  it('counts a sample equal to the one before, and never an unreadable one (null)', () => {
    const c = repeatCounter();
    for (const p of [1, 1, 2, null, null, 2, 3, 3, 3]) c.add(p);
    expect(c.read).toEqual({ samples: 9, repeats: 3 });
  });
});

// The healthy read itself: David's machine lateral raise of 29 September, 460 samples through WebCodecs, label 9.
const set = JSON.parse(gunzipSync(readFileSync(resolve(__dirname, '../../../test/real-phone/sets-29sep/lateral_raise_9_front_43e71b40.json.gz'))).toString());

describe('frozen skeletons (analyzeCoreVideo, defence in depth)', () => {
  it('the healthy read repeats no skeleton and counts 8 as before', () => {
    expect(repeatedSkeletons(set.worldLandmarks)).toEqual({ samples: 460, repeats: 0 });
    expect(isFrozenRead(repeatedSkeletons(set.worldLandmarks))).toBe(false);
    const r = summarizeCount(set.worldLandmarks, set.timestamps, 'lateral_raise');
    expect(r.refused).toBe(false);
    expect(r.count).toBe(8);
  });
  it('the same video read frozen on its first frame is frozen: 459 of 460 repeats', () => {
    const wl = set.worldLandmarks.map(() => set.worldLandmarks[0]);
    expect(repeatedSkeletons(wl)).toEqual({ samples: 460, repeats: 459 });
    expect(isFrozenRead(repeatedSkeletons(wl))).toBe(true);
  });
  it('a read whose picture changes only every third sample is frozen: 306 of 460 repeat', () => {
    const wl = set.worldLandmarks.map((f, i) => (i % 3 !== 0 ? set.worldLandmarks[i - (i % 3)] : f));
    expect(repeatedSkeletons(wl).repeats).toBe(306);
    expect(isFrozenRead(repeatedSkeletons(wl))).toBe(true);
  });
  it('5 % repeats, the most measured on a public set (8 of 150), is not frozen', () => {
    const wl = set.worldLandmarks.map((f, i) => (i % 20 === 19 ? set.worldLandmarks[i - 1] : f));
    expect(isFrozenRead(repeatedSkeletons(wl))).toBe(false);
  });
  it('never takes frames without a person for repeats', () => {
    expect(repeatedSkeletons([null, null, null, set.worldLandmarks[0]])).toEqual({ samples: 4, repeats: 0 });
  });
});
