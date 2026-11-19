// npx vitest run test/real-phone/phone-poses/phone-poses.test.ts (part of npm test)
// The data loop of docs/OPERATING-LOOP.md: every pose file David's iPhone saves with ?poses=1 (coreAnalysis.js,
// « Enregistrer les poses ») is stored in files/ with its line in sets.json: the lift he chose in the app, his count
// (the label, R1: from David only), and the count the phone showed. Two checks per file:
//   1. The first pose of each sample, counted as the app counts, gives the phone's own count: the file is the phone's
//      read, and the defect it shows is reproduced here, on stored data CI reads.
//   2. The lifter chosen over the whole set by motion (src/lib/lifterTrack.js, card B) is counted, printed, and held
//      to its pinned count where sets.json records one (lifterCount). It is no exam: these files are tuning data (docs/OPERATING-LOOP.md F12), and a file read to build
//      a fix proves nothing about it. A gain is claimed only on a file read once with the constants frozen.
// No file yet: the test checks only that sets.json and files/ agree.
import { expect, test } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { chooseLifter, framesFromPoseFile } from '../../../src/lib/lifterTrack.js';
import { summarizeCount } from '../../../src/lib/coreAnalysis';

const DIR = resolve(__dirname, 'files');
type Entry = { lift: string; label: number; labelSource: string; phoneCount: number | 'refused'; recorded: string; lifterCount?: number | 'refused' };
const sets: Record<string, Entry> = JSON.parse(readFileSync(resolve(__dirname, 'sets.json'), 'utf8')).sets;
const files = existsSync(DIR) ? readdirSync(DIR).filter(f => /\.json(\.gz)?$/.test(f)).sort() : [];
const read = (f: string) => JSON.parse((f.endsWith('.gz') ? gunzipSync(readFileSync(resolve(DIR, f))) : readFileSync(resolve(DIR, f))).toString());
const outcome = (c: any) => (c.refused ? 'refused' : c.count);
const verdict = (c: number | string, label: number) => (c === 'refused' ? 'refused' : c === label ? 'exact' : Math.abs((c as number) - label) >= 3 ? 'off3+' : 'near');

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
    const e = sets[f], file = read(f), frames = framesFromPoseFile(file);
    // A file saved since 19 November 2026 names its lift and the count its read gave: they must match its line.
    if (file.lift != null) expect(file.lift).toBe(e.lift);
    if (file.count != null) expect(file.count).toBe(e.phoneCount);
    const ts = frames.map(fr => fr.t);
    const first = summarizeCount(frames.map(fr => fr.poses[0]?.world ?? null), ts, e.lift, undefined, frames.map(fr => fr.poses[0]?.image ?? null));
    expect(outcome(first)).toBe(e.phoneCount);
    const sel = chooseLifter(frames, e.lift);
    const lifter = summarizeCount(sel.world, ts, e.lift, undefined, sel.image);
    // Pinned once read with frozen constants (sets.json lifterNote): a change to lifterTrack.js that moves it fails here.
    if (e.lifterCount !== undefined) expect(outcome(lifter)).toBe(e.lifterCount);
    console.log(`${f}  label ${e.label}  phone ${e.phoneCount}  first pose ${outcome(first)}  lifter by motion ${outcome(lifter)}  people ${sel.people.length}  samples ${frames.length}, with more than one pose ${frames.filter(fr => fr.poses.length > 1).length}`);
  });
}

// The default's decision (David, 19 November 2026: counting in crowded gyms, solved at the root). Over every stored
// file read with ?lifter=1&poses=1, the first pose (today's default) against the lifter by motion, under R2's rules:
// the lifter may become the default (coreAnalysis.js lifterAsked) only if no file loses its exact count, none becomes
// off by 3 or more, none becomes refused, and the exact total does not fall. Printed with its verdict; it fails nothing
// until a batch beyond IMG_4186 is stored, since one tuning set decides no default (F12).
test('the default decision: first pose against the lifter by motion, over every stored file (R2)', () => {
  let exact0 = 0, exact1 = 0, lost = 0, newOff3 = 0, newRefused = 0;
  const rows: string[] = [];
  for (const f of files) {
    const e = sets[f], frames = framesFromPoseFile(read(f)), ts = frames.map(fr => fr.t);
    const c0 = outcome(summarizeCount(frames.map(fr => fr.poses[0]?.world ?? null), ts, e.lift, undefined, frames.map(fr => fr.poses[0]?.image ?? null)));
    const sel = chooseLifter(frames, e.lift);
    const c1 = outcome(summarizeCount(sel.world, ts, e.lift, undefined, sel.image));
    const v0 = verdict(c0, e.label), v1 = verdict(c1, e.label);
    if (v0 === 'exact') exact0++;
    if (v1 === 'exact') exact1++;
    if (v0 === 'exact' && v1 !== 'exact') lost++;
    if (v1 === 'off3+' && v0 !== 'off3+') newOff3++;
    if (v1 === 'refused' && v0 !== 'refused') newRefused++;
    rows.push(`${c0 !== c1 ? '->' : '  '} ${f}  label ${e.label}  first pose ${c0} (${v0})  lifter ${c1} (${v1})`);
  }
  const holds = lost === 0 && newOff3 === 0 && newRefused === 0 && exact1 >= exact0;
  const enough = files.length >= 2;
  console.log([`Default decision over ${files.length} phone file(s): exact ${exact0} -> ${exact1}; exact lost ${lost}; newly off by 3+ ${newOff3}; newly refused ${newRefused}. R2 ${holds ? 'holds' : 'fails'}${enough ? '' : ' (one tuning set: decides nothing)'}.`, ...rows].join('\n'));
  if (enough) expect(holds).toBe(true);
});
