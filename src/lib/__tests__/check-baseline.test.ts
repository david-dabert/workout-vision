import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { countReps } from '../counting/core';
import { summarizeCount } from '../coreAnalysis';
import baseline from '../check-baseline.json';
import { rowVerdict } from '../check';

// The check page's "before" is the live core's count and refusal on the committed landmarks of David's
// sets of 29 September, never a typed number; the video is known by the SHA-256 the collector recorded.
describe('the check page baseline', () => {
  for (const c of baseline.clips) {
    it(`${c.lift}: ${c.before} on the committed landmarks, David ${c.label}`, () => {
      const d = JSON.parse(gunzipSync(readFileSync(resolve(__dirname, '../../../test/real-phone/sets-29sep', c.file))).toString());
      expect(countReps(d.worldLandmarks, d.timestamps, c.lift).count).toBe(c.before);
      expect(summarizeCount(d.worldLandmarks, d.timestamps, c.lift).refused).toBe(c.refused);
      expect(d.videoSha256).toBe(c.sha256);
      expect(d.count).toBe(c.label);
    });
  }
});

describe('a row of the check page', () => {
  const clip = { before: 10, sha256: 'abc', refused: false };
  it('as before: whole read, same count, same video', () => {
    expect(rowVerdict(clip, { count: 10, refused: false, read: 439, expected: 439, sha256: 'abc' })).toEqual({ ok: true, why: [] });
  });
  it('not as before: a partial read, a different count, another video', () => {
    expect(rowVerdict(clip, { count: 2, read: 181, expected: 439, sha256: 'abc' }).why).toEqual(['read 181 of 439 samples', 'counted 2, before 10']);
    expect(rowVerdict(clip, { count: 10, read: 439, expected: 439, sha256: 'def' }).why).toEqual(['another video (its fingerprint differs)']);
    expect(rowVerdict(clip, { count: null, read: 181, expected: 439, sha256: 'abc' }).ok).toBe(false);
  });
  it('not as before when the app now refuses, or no longer refuses, the set', () => {
    expect(rowVerdict(clip, { count: 10, refused: true, read: 439, expected: 439, sha256: 'abc' }).why).toEqual(['refused now, counted before']);
    expect(rowVerdict({ before: 3, sha256: 'x', refused: true }, { count: 3, refused: false, read: 331, expected: 331, sha256: 'x' }).why).toEqual(['counted now, refused before']);
  });
});
