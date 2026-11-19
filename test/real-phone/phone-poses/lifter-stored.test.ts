// LIFTER_STORED=1 npx vitest run --no-cache test/real-phone/phone-poses/lifter-stored.test.ts
// Card B (19 November 2026): the lifter chosen over the whole set by motion (src/lib/lifterTrack.js), measured on the
// stored reads before any count reads it (R2). Each stored read holds one pose per sample (the first the model gave),
// so here the selection can only drop samples whose pose sits apart from the lifter's place over the set (a bystander
// who took the single pose, or the lifter's own skeleton thrown far). Every labelled section the scoreboard reads,
// set by set, the app's outcome on the stored read against the outcome on the lifter's samples alone; and the occlusion
// bench (synthetic, a still bystander), where `onTarget` says which samples were the lifter's. Printed, decides
// nothing; written to lifter-stored.txt beside this file.
import { expect, test } from 'vitest';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { chooseLifter } from '../../../src/lib/lifterTrack.js';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { blindSets, decides, labelledSets, testerBlindSets, videoSets } from '../accuracy/sets';
import { appOutcome } from '../accuracy/outcome.mjs';

type S = { name: string; lift: string; label: number; wl: any[]; ts: number[]; il?: any[] | null; appRefused?: boolean };

const verdict = (c: number | string, label: number) => (c === 'refused' ? 'refused' : c === label ? 'exact' : Math.abs((c as number) - label) >= 3 ? 'off3+' : 'near');

function select(s: S) {
  const frames = s.ts.map((t, i) => ({ t, poses: s.wl[i] ? [{ image: s.il?.[i] ?? null, world: s.wl[i] }] : [] }));
  const r = chooseLifter(frames, s.lift);
  const dropped = s.wl.filter((w, i) => w && !r.world[i]).length;
  // A sample dropped loses its picture points too; the rest stay the stored objects.
  return { wl: r.world, il: s.il ? s.il.map((p, i) => (r.world[i] ? p : null)) : s.il, dropped, people: r.people.length };
}

function section(title: string, sets: S[], out: string[]) {
  let exactBefore = 0, exactNow = 0, newlyOff3 = 0, newlyRefused = 0, moved = 0, withIl = 0;
  const rows: string[] = [];
  for (const s of sets) {
    if (s.il) withIl++;
    const before = appOutcome(s).now;
    const sel = select(s);
    const now = appOutcome({ ...s, wl: sel.wl, il: sel.il }).now;
    if (!decides(s.lift)) continue;
    const vb = verdict(before, s.label), vn = verdict(now, s.label);
    if (vb === 'exact') exactBefore++;
    if (vn === 'exact') exactNow++;
    if (vn === 'off3+' && vb !== 'off3+') newlyOff3++;
    if (vn === 'refused' && vb !== 'refused') newlyRefused++;
    if (now !== before || sel.dropped) {
      if (now !== before) moved++;
      rows.push(`${now !== before ? '->' : '  '} ${s.name}  label ${s.label}  before ${before} (${vb})  now ${now} (${vn})  dropped ${sel.dropped} of ${s.wl.filter(Boolean).length}  people ${sel.people}`);
    }
  }
  out.push(`${title}: ${sets.length} sets (${withIl} with picture points; without them every pose stands at the hips' origin and nothing is dropped); exact ${exactBefore} -> ${exactNow}; counts moved ${moved}; newly off by 3+ ${newlyOff3}; newly refused ${newlyRefused}.`);
  out.push(...rows, '');
  return { exactBefore, exactNow, newlyOff3, newlyRefused };
}

test.skipIf(!process.env.LIFTER_STORED)('the lifter chosen by motion, on the stored reads', () => {
  const out: string[] = [`Card B, the lifter chosen over the whole set by motion (src/lib/lifterTrack.js), on the stored reads, ${new Date().toISOString().slice(0, 10)}.`, ''];
  const r1 = section("David's stored sets (scoreboard, first section)", labelledSets().sets, out);
  const r2 = section("David's whole videos, IMAGE mode (scoreboard, real video)", videoSets().sets, out);
  const r3 = section("David's blind counts", blindSets().sets.map(s => ({ ...s, appRefused: false })), out);
  const r4 = section("Testers' blind counts", testerBlindSets().sets.map(s => ({ ...s, appRefused: false })), out);

  // The occlusion bench: a box per sample stands for the picture points (its centre, a third of its height).
  const DIR = resolve(__dirname, '../occlusion/sets');
  out.push('Occlusion bench (synthetic, test/real-phone/occlusion/sets): count before -> now against the truth; for the sets with a bystander, samples on him before -> after, lifter samples dropped.');
  for (const f of readdirSync(DIR).filter(f => f.endsWith('.json.gz')).sort()) {
    const d = JSON.parse(gunzipSync(readFileSync(resolve(DIR, f))).toString());
    const lift = d.params.lift ?? d.params.exercise, truth = d.reps.length, boxes = d.occlusion.boxes;
    const frames = d.timestamps.map((t: number, i: number) => ({ t, poses: d.worldLandmarks[i] && boxes[i] ? [{ world: d.worldLandmarks[i], box: boxes[i] }] : [] }));
    const locate = (p: any) => (p.box ? { x: (p.box[0] + p.box[2]) / 2, y: (p.box[1] + p.box[3]) / 2, length: (p.box[3] - p.box[1]) / 3 } : null);
    const sel = chooseLifter(frames, lift, { locate });
    const c0 = summarizeCount(d.worldLandmarks, d.timestamps, lift), c1 = summarizeCount(sel.world, d.timestamps, lift);
    const n0 = c0.refused ? 'refused' : c0.count, n1 = c1.refused ? 'refused' : c1.count;
    const on = d.occlusion.onTarget as (boolean | null)[] | undefined;
    const kept = (i: number) => !!sel.world[i];
    const tail = on ? `  bystander samples ${on.filter(x => x === false).length} -> ${on.filter((x, i) => x === false && kept(i)).length}, lifter samples dropped ${on.filter((x, i) => x === true && !kept(i)).length}` : '';
    if (n0 !== n1 || on) out.push(`${n0 !== n1 ? '->' : '  '} ${f.replace(/\.json\.gz$/, '')}  truth ${truth}  before ${n0}  now ${n1}  people ${sel.people.length}${tail}`);
  }
  const text = out.join('\n');
  writeFileSync(resolve(__dirname, 'lifter-stored.txt'), text + '\n');
  console.log(text);
  expect(r1.exactBefore + r2.exactBefore + r3.exactBefore + r4.exactBefore).toBeGreaterThan(0);
});
