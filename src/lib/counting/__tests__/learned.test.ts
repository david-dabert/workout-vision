/**
 * The app's inference of the learned counter (learned.ts) gives the sums its training computed
 * (scripts/ml/train.py fit writes them to test/real-phone/accuracy/learned-parity.json) from the same
 * weights, on David's sets: the features and the network are the same numbers in both.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { learnedCount, type LearnedWeights } from '../learned';

const ROOT = resolve(__dirname, '../../../../test/real-phone');
const PARITY = resolve(ROOT, 'accuracy/learned-parity.json');
const weights = JSON.parse(readFileSync(resolve(__dirname, '../learned-weights.json'), 'utf8')) as LearnedWeights;

describe.skipIf(!existsSync(PARITY))('the learned counter in the app', () => {
  const parity = existsSync(PARITY) ? (JSON.parse(readFileSync(PARITY, 'utf8')) as Record<string, number>) : {};
  for (const [file, sum] of Object.entries(parity)) {
    it(`${file}: the sum of its training, ${sum.toFixed(3)}`, () => {
      const d = JSON.parse(gunzipSync(readFileSync(resolve(ROOT, file))).toString());
      expect(learnedCount(d.worldLandmarks, weights).sum).toBeCloseTo(sum, 3);
    }, 60000);
  }
});
