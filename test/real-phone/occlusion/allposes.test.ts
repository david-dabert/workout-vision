// npx vitest run test/real-phone/occlusion/allposes.test.ts (part of npm test; ALLPOSES_DIR=<dir> reads another folder)
// Card B (19 November 2026): the 14 occlusion sets with a bystander, rendered again with every pose kept
// (run.mjs SYNTH_ALLPOSES=1; sets-allposes/), as the app's ?poses=1 records them on the phone. Per set: the count from
// the first pose of each sample (what the app counts today) and from the lifter chosen over the whole set by motion
// (src/lib/lifterTrack.js), against the rendered truth; the samples read on the bystander (onTarget false, the
// renderer's own rule) in each. Synthetic, a still bystander: it shows the module does what it says on the case it was
// written for, and proves nothing about gym video (TRIED.md, 19 November 2026). Written to allposes.txt; the one
// assertion: the lifter by motion never reads more samples on the bystander than the first pose does.
import { expect, test } from 'vitest';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { chooseLifter } from '../../../src/lib/lifterTrack.js';
import { summarizeCount } from '../../../src/lib/coreAnalysis';

const DIR = process.env.ALLPOSES_DIR || resolve(__dirname, 'sets-allposes');
const files = existsSync(DIR) ? readdirSync(DIR).filter(f => f.endsWith('.json.gz')).sort() : [];

test.skipIf(!files.length)('bystander sets with every pose kept: first pose against the lifter by motion', () => {
  const rows: string[] = [];
  let exactFirst = 0, exactLifter = 0;
  for (const f of files) {
    const d = JSON.parse(gunzipSync(readFileSync(resolve(DIR, f))).toString());
    const lift = d.params.lift ?? d.params.exercise, truth = d.reps.length, ts = d.timestamps as number[];
    const frames = ts.map((t, i) => ({ t, poses: (d.allPoses[i] ?? []) as any[] }));
    const firstW = frames.map(fr => fr.poses[0]?.world ?? null), firstI = frames.map(fr => fr.poses[0]?.image ?? null);
    const [w, h] = d.size;
    const sel = chooseLifter(frames, lift, { aspect: w / h });
    const c0 = summarizeCount(firstW, ts, lift, undefined, firstI), c1 = summarizeCount(sel.world, ts, lift, undefined, sel.image);
    const n0 = c0.refused ? 'refused' : c0.count, n1 = c1.refused ? 'refused' : c1.count;
    if (n0 === truth) exactFirst++;
    if (n1 === truth) exactLifter++;
    const onBy0 = frames.filter(fr => fr.poses[0]?.onTarget === false).length;
    const onBy1 = frames.filter((fr, i) => sel.world[i] && fr.poses.find(p => p.world === sel.world[i])?.onTarget === false).length;
    const lifterThere = frames.filter(fr => fr.poses.some(p => p.onTarget === true)).length;
    const lifterKept = frames.filter((fr, i) => sel.world[i] && fr.poses.find(p => p.world === sel.world[i])?.onTarget === true).length;
    const multi = frames.filter(fr => fr.poses.length > 1).length;
    rows.push(`${n0 !== n1 ? '->' : '  '} ${f.replace(/\.json\.gz$/, '')}  truth ${truth}  first pose ${n0}  lifter by motion ${n1}  bystander samples ${onBy0} -> ${onBy1}  lifter samples kept ${lifterKept} of ${lifterThere} found  samples with 2+ poses ${multi} of ${ts.length}  people ${sel.people.length}`);
    expect(onBy1, f).toBeLessThanOrEqual(onBy0);
  }
  const text = [`Occlusion sets with a bystander, every pose kept (${files.length} sets): exact ${exactFirst} on the first pose, ${exactLifter} on the lifter by motion.`, ...rows].join('\n');
  writeFileSync(resolve(__dirname, 'allposes.txt'), text + '\n');
  console.log(text);
});
