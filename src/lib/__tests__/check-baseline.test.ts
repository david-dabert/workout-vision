import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { countReps } from '../counting/core';
import { summarizeCount } from '../coreAnalysis';
import baseline from '../check-baseline.json';
import { rowVerdict } from '../check';

// The check page's "before" is the live core's count and refusal on the committed landmarks of David's
// sets of 29 September, never a typed number; the video is known by the samples its collected read holds.
describe('the check page baseline', () => {
  for (const c of baseline.clips) {
    it(`${c.lift}: ${c.before} on the committed landmarks, David ${c.label}`, () => {
      const d = JSON.parse(gunzipSync(readFileSync(resolve(__dirname, '../../../test/real-phone/sets-29sep', c.file))).toString());
      expect(countReps(d.worldLandmarks, d.timestamps, c.lift).count).toBe(c.before);
      expect(summarizeCount(d.worldLandmarks, d.timestamps, c.lift).refused).toBe(c.refused);
      expect(d.videoSha256).toBe(c.sha256);
      expect(d.timestamps.length).toBe(c.samples);
      expect(c.duration).toBe(d.metadata.duration);
      expect(Math.floor(c.duration * 15)).toBe(c.samples);
      expect(d.count).toBe(c.label);
    });
  }
});

describe('a row of the check page', () => {
  const clip = { before: 10, samples: 439, duration: 29.3, refused: false };
  it('as before: whole read, same count, same video', () => {
    expect(rowVerdict(clip, { count: 10, refused: false, read: 439, expected: 439 })).toEqual({ ok: true, why: [] });
  });
  it('not as before: a partial read, a different count, another video', () => {
    expect(rowVerdict(clip, { count: 2, read: 181, expected: 439 }).why).toEqual(['read 181 of 439 samples', 'counted 2, before 10']);
    expect(rowVerdict(clip, { count: 10, read: 460, expected: 460, duration: 30.7 }).why).toEqual(['another video (30.70 s where the set lasts 29.30 s)']);
  });
  it('the same set whose reported length crosses a sample boundary by a few milliseconds (review 11)', () => {
    const rdl = baseline.clips.find(c => c.lift === 'romanian_deadlift')!;
    const d = rdl.duration + 0.002, e = Math.floor(d * 15);
    expect(e).toBe(rdl.samples + 1);
    expect(rowVerdict(rdl, { count: rdl.before, refused: false, read: e, expected: e, duration: d }).ok).toBe(true);
    expect(rowVerdict(clip, { count: null, read: 181, expected: 439 }).ok).toBe(false);
  });
  it('not as before when the app now refuses, or no longer refuses, the set', () => {
    expect(rowVerdict(clip, { count: 10, refused: true, read: 439, expected: 439 }).why).toEqual(['refused now, counted before']);
    expect(rowVerdict({ before: 3, samples: 331, duration: 22.07, refused: true }, { count: 3, refused: false, read: 331, expected: 331 }).why).toEqual(['counted now, refused before']);
  });
});
