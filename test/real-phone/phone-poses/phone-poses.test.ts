// npx vitest run test/real-phone/phone-poses/phone-poses.test.ts (part of npm test)
// The data loop of docs/OPERATING-LOOP.md: every pose file David's iPhone saves with ?poses=1 (coreAnalysis.js,
// « Enregistrer les poses ») is stored in files/ with its line in sets.json: the lift he chose in the app, his count
// (the label, R1: from David only), and the count the phone showed. Two checks per file:
//   1. The first pose of each sample, counted as the app counts, gives the phone's own count: the file is the phone's
//      read, and the defect it shows is reproduced here, on stored data CI reads.
//   2. The lifter chosen over the whole set by motion (src/lib/lifterTrack.js, card B) is counted and printed beside
//      it. It decides nothing yet: these files are tuning data (docs/OPERATING-LOOP.md F12), and a file read to build
//      a fix proves nothing about it. A gain is claimed only on a file read once with the constants frozen.
// No file yet: the test checks only that sets.json and files/ agree.
import { expect, test } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { chooseLifter, framesFromPoseFile } from '../../../src/lib/lifterTrack.js';
import { summarizeCount } from '../../../src/lib/coreAnalysis';

const DIR = resolve(__dirname, 'files');
type Entry = { lift: string; label: number; labelSource: string; phoneCount: number | 'refused'; recorded: string };
const sets: Record<string, Entry> = JSON.parse(readFileSync(resolve(__dirname, 'sets.json'), 'utf8')).sets;
const files = existsSync(DIR) ? readdirSync(DIR).filter(f => /\.json(\.gz)?$/.test(f)).sort() : [];
const read = (f: string) => JSON.parse((f.endsWith('.gz') ? gunzipSync(readFileSync(resolve(DIR, f))) : readFileSync(resolve(DIR, f))).toString());
const outcome = (c: any) => (c.refused ? 'refused' : c.count);

test('every stored pose file has its line in sets.json, and every line its file', () => {
  expect(files.sort()).toEqual(Object.keys(sets).sort());
  for (const [f, e] of Object.entries(sets)) {
    expect(Number.isInteger(e.label), f).toBe(true);
    expect(typeof e.lift, f).toBe('string');
    expect(e.labelSource, f).toMatch(/David/);
  }
});

for (const f of files) {
  test(`${f}: the first pose of each sample gives the phone's count; the lifter by motion is measured`, () => {
    const e = sets[f], frames = framesFromPoseFile(read(f));
    const ts = frames.map(fr => fr.t);
    const first = summarizeCount(frames.map(fr => fr.poses[0]?.world ?? null), ts, e.lift, undefined, frames.map(fr => fr.poses[0]?.image ?? null));
    expect(outcome(first)).toBe(e.phoneCount);
    const sel = chooseLifter(frames, e.lift);
    const lifter = summarizeCount(sel.world, ts, e.lift, undefined, sel.image);
    console.log(`${f}  label ${e.label}  phone ${e.phoneCount}  first pose ${outcome(first)}  lifter by motion ${outcome(lifter)}  people ${sel.people.length}  samples ${frames.length}, with more than one pose ${frames.filter(fr => fr.poses.length > 1).length}`);
  });
}
