// The label watch list (label-watch.txt) is blind: no line carries a count, in its own field or inside a
// file name (PLAN.md, 30 September; CLAUDE.md R1).
import { expect, test } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { blind } from './sets';

test('a set name read blind keeps its folder, lift, view and fingerprint, and loses its count', () => {
  expect(blind('sets-29sep/leg_press_13_side_1ee0ae47.json.gz')).toBe('sets-29sep/leg_press side 1ee0ae47');
  expect(blind('sets-01oct/set07_squat_8_side_abcd1234.json.gz')).toBe('sets-01oct/squat side abcd1234');
  expect(blind('landmarks/bench_press_7_angle_mufhcy60.json.gz')).toBe('landmarks/bench_press angle mufhcy60');
});

const LIST = resolve(__dirname, 'label-watch.txt');
test.skipIf(!existsSync(LIST))('the committed watch list names no count', () => {
  const lines = readFileSync(LIST, 'utf8').trim().split('\n').slice(1);
  expect(lines.length).toBeGreaterThan(0);
  for (const line of lines) expect(line.split('  ')[0], line).not.toMatch(/_\d+_|\blabel\b|\bapp\b/);
});
