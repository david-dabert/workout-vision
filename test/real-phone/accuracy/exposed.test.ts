// Held-out sets already seen are never an exam's unseen sets (Astra's review of 5 October). Reads only
// public/exposed.json, never a held-out file.
import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isExposed, PUBLIC } from './sets';

test('CFRep held-out half is recorded as seen, whole', () => {
  const exposed = JSON.parse(readFileSync(resolve(PUBLIC, 'exposed.json'), 'utf8'));
  expect(isExposed(exposed, 'cfrep', 'squat_side_m1_12_0')).toBe(true);
  expect(exposed.cfrep.reason).toMatch(/pose-model bench/);
  expect(isExposed(exposed, 'countix', 'anything')).toBe(false);
});

test('a list of ids exposes only those sets', () => {
  const e = { mmfit: { sets: ['w03-squats-1-2'], reason: 'seen' } };
  expect(isExposed(e, 'mmfit', 'w03-squats-1-2')).toBe(true);
  expect(isExposed(e, 'mmfit', 'w03-squats-3-4')).toBe(false);
});
