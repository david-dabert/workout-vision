import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { countReps } from '../counting/core';
import { summarizeCount } from '../coreAnalysis';
import baseline from '../check-baseline.json';
import { rowVerdict } from '../check';

// The check page's "as before" is the live core's count on the committed landmarks, never a typed number.
describe('the check page baseline', () => {
  for (const c of baseline.clips) {
    it(`${c.lift}: ${c.before} on the committed landmarks, label ${c.label}, ${c.fileSize} bytes`, () => {
      const d = JSON.parse(gunzipSync(readFileSync(resolve(__dirname, '../../../test/real-phone/landmarks', c.file))).toString());
      expect(countReps(d.worldLandmarks, d.timestamps, c.lift).count).toBe(c.before);
      // What the app shows: a refused set shows no number (review 01 of the check page).
      expect(summarizeCount(d.worldLandmarks, d.timestamps, c.lift).refused).toBe(c.refused);
      expect(d.metadata.fileSize).toBe(c.fileSize);
      expect(c.file.startsWith(`${c.lift}_${c.label}_${c.view}_`)).toBe(true);
    });
  }
});

describe('a row of the check page', () => {
  const clip = { before: 10, fileSize: 93100828, refused: false };
  it('as before: whole read, same count, same file', () => {
    expect(rowVerdict(clip, { count: 10, refused: false, read: 439, expected: 439, size: 93100828 })).toEqual({ ok: true, why: [] });
  });
  it('not as before when the app now refuses, or no longer refuses, the set', () => {
    expect(rowVerdict(clip, { count: 10, refused: true, read: 439, expected: 439, size: 93100828 }).why).toEqual(['refused now, counted before']);
    expect(rowVerdict({ before: 3, fileSize: 1, refused: true }, { count: 3, refused: false, read: 331, expected: 331, size: 1 }).why).toEqual(['counted now, refused before']);
  });
  it('not as before: a partial read, a different count, another file', () => {
    expect(rowVerdict(clip, { count: 2, read: 181, expected: 439, size: 93100828 }).why).toEqual(['read 181 of 439 samples', 'counted 2, before 10']);
    expect(rowVerdict(clip, { count: 10, read: 439, expected: 439, size: 5 }).why).toEqual(['another file: 5 bytes, the clip has 93100828']);
    expect(rowVerdict(clip, { count: null, read: 181, expected: 439, size: 93100828 }).ok).toBe(false);
  });
});
