// R1 guard of the set loader (sets.ts; 9 October 2026, pillar 1): a collected file whose count was given after the app
// showed its own (labelKind 'after-app') never counts as a label; a file that also carries David's blind count is read
// as a blind set, in its own section. Run on a scratch folder shaped like test/real-phone/, so no real set is touched.
import { afterAll, describe, expect, test } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { blindSets, labelledSets } from './sets';

const root = mkdtempSync(join(tmpdir(), 'wv-sets-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const pose = { worldLandmarks: [[{ x: 0, y: 0, z: 0, visibility: 1 }], null], timestamps: [0, 67] };
const put = (dir: string, name: string, d: object) => {
  mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, dir, name), gzipSync(JSON.stringify(d)));
};
// The collector's file, labelled by David from the video: no labelKind.
put('sets-01jan', 'bicep_curl_8_side_aaaaaaaa.json.gz', { lift: 'bicep_curl', count: 8, ...pose });
// The result screen's file (phoneCollect.js): counted after the app's, with and without the blind count.
put('sets-01jan', 'bicep_curl_9_side_bbbbbbbb.json.gz', { lift: 'bicep_curl', count: 9, labelKind: 'after-app', appCount: 9, ...pose });
put('sets-01jan', 'squat_7_side_cccccccc.json.gz', { lift: 'squat', count: 7, labelKind: 'after-app', appCount: 8, blind: { count: 7, p: 1 }, ...pose });
put('sets-01jan', 'squat_6_side_dddddddd.json.gz', { lift: 'squat', count: 6, labelKind: 'after-app', appCount: 0, appRefused: true, proposal: 5, blind: { count: 6, p: 1 }, ...pose });
put('sets-01jan', 'squat_5_side_eeeeeeee.json.gz', { lift: 'squat', count: 5, labelKind: 'after-app', appCount: 5, blind: { count: null, p: 1 }, ...pose });
// A whole-video folder is read by videoSets, never here.
put('sets-01jan-video', 'squat_9.json.gz', { lift: 'squat', count: 9, ...pose });

describe('labelledSets', () => {
  const { sets, unreadable, held } = labelledSets(root);
  test('keeps the files labelled from the video', () => {
    expect(sets.map(s => s.name)).toEqual(['sets-01jan/bicep_curl_8_side_aaaaaaaa.json.gz']);
    expect(sets[0].label).toBe(8);
    expect(unreadable).toEqual([]);
  });
  test('holds out every file counted after the app, blind count or not, by name and kind', () => {
    expect(held).toEqual([
      { name: 'sets-01jan/bicep_curl_9_side_bbbbbbbb.json.gz', labelKind: 'after-app' },
      { name: 'sets-01jan/squat_5_side_eeeeeeee.json.gz', labelKind: 'after-app' },
      { name: 'sets-01jan/squat_6_side_dddddddd.json.gz', labelKind: 'after-app' },
      { name: 'sets-01jan/squat_7_side_cccccccc.json.gz', labelKind: 'after-app' },
    ]);
  });
});

describe('blindSets', () => {
  const { sets, unreadable, unsure } = blindSets(root);
  test('reads the blind count as the label, the kept count and the app\'s beside it', () => {
    expect(sets.map(s => [s.name, s.label, s.kept, s.appCount, s.appRefused, s.proposal])).toEqual([
      ['sets-01jan/squat_6_side_dddddddd.json.gz', 6, 6, 0, true, 5],
      ['sets-01jan/squat_7_side_cccccccc.json.gz', 7, 7, 8, false, null],
    ]);
    expect(unreadable).toEqual([]);
  });
  test('lists "Je ne sais pas" apart, with no label', () => {
    expect(unsure).toEqual(['sets-01jan/squat_5_side_eeeeeeee.json.gz']);
  });
});
