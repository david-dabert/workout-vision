// SURE_FEATURES=1 npx vitest run --no-cache test/real-phone/sure-model/features.test.ts
// Card 056: one calibrated check for "sure", from signals each measured alone and never used together (TRIED.md).
// This bench writes, for every labelled build set on disk that the app counts, the signals the check may read and the
// set's error against its label, to rows.json beside it; fit.mjs reads that file. Bench only: the app imports none of
// it, no count changes (R2). The held-out halves are not opened (sets.ts refuses them without HOLDOUT=1).
// Signals, each with where it was measured alone:
// - shipped: the result screen asks today (sure.ts sureRow: body check, sensitivity check, refused head rep, pose doubt);
// - tail: the open last rise (card 039, coreAnalysis.js tailOpen);
// - whole: the set is held from rest to rest (card 018, whole-set.test.ts);
// - spread: the sensitivity recounts' range (coreAnalysis.js SENSITIVITY_GRID), and whether one of them refused;
// - agree: the body check's agreement (counting/bodyCheck.js);
// - loop: the loop counter counts the same and holds its certificate (TRIED.md 24 October, test/real-phone/loop/);
// - psc: PSC counts the same (counting/psc.js), and whether it asks to confirm;
// - learned: the learned counter's out-of-fold sum (learned-cv.json; Countix clips only, else absent) minus the count.
import { test } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { summarizeCount, withBodyCheck, withProposal, withSensitivity } from '../../../src/lib/coreAnalysis';
import { liftDefinition } from '../../../src/lib/counting/core';
// @ts-expect-error: a JavaScript module without types
import { pscCount } from '../../../src/lib/counting/psc.js';
import { benchSets, countInWindow, decides, labelledSets, publicSets } from '../accuracy/sets';
import { sureRow } from '../accuracy/sure';
import { wholeSet } from '../accuracy/whole-set.test';
// @ts-expect-error: a JavaScript module without types
import { loopCount } from '../loop/loop.js';

// The public build halves as compare-variants and whole-set.test.ts read them.
const half = (name: string) => (parseInt(createHash('sha256').update('variant:' + name.split('/').pop()!.slice(0, 11)).digest('hex')[0], 16) < 8 ? 'publicA' : 'publicB');
// The video a set comes from, so cross-validation never splits one video across folds.
export function videoOf(name: string) {
  const f = name.split('/').pop()!;
  if (name.includes('/countix')) return 'countix:' + f.slice(0, 11);
  if (name.includes('/mmfit/')) return 'mmfit:' + f.split('-')[0];
  if (name.includes('/cfrep/')) return 'cfrep:' + f.replace(/_\d+\.json\.gz$/, '');
  return name;
}
const learnedCv: Record<string, number> = JSON.parse(readFileSync(resolve(__dirname, '../accuracy/learned-cv.json'), 'utf8'));
const learnedOf = (name: string) => learnedCv[`public/countix-whole/build/${name.split('/').pop()}`];

function row(name: string, suite: string, lift: string, label: number, wl: any[], ts: number[], il: any[] | null, image: any, window?: [number, number]) {
  const countOf = window ? (r: any) => countInWindow(r.reps ?? [], window) : (r: any) => r.count;
  const c: any = summarizeCount(wl, ts, lift, undefined, il ?? undefined);
  const app: any = withSensitivity(withBodyCheck(withProposal({ ...c, worldLandmarks: wl, timestamps: ts, imageLandmarks: il }, lift), lift), lift);
  const s = sureRow(app, lift, label, countOf);
  if (s.err === null) return null;
  const count = countOf(app);
  const rec = (app.sensitivity?.counts ?? []) as (number | null)[];
  const seen = rec.filter((x): x is number => x !== null);
  const l: any = loopCount(wl, ts, null);
  const loopN = l.refused ? null : window ? countInWindow(l.reps ?? [], window) : l.count;
  const p: any = pscCount({ wl, ts, image });
  const pscN = p.count === null ? null : window ? countInWindow(p.reps ?? [], window) : p.count;
  const learned = learnedOf(name);
  return {
    name, suite, video: videoOf(name), lift, label, count, err: s.err,
    shipped: s.flagged || s.moved, tail: s.tail === true, whole: wholeSet(app, ts, lift),
    spread: seen.length ? Math.max(...seen) - Math.min(...seen) : null, recountRefused: rec.some(x => x === null),
    agree: typeof app.bodyCheck?.agreement === 'number' ? app.bodyCheck.agreement : null,
    loopSame: loopN === count, loopSure: !l.refused && l.sure === true, loopRatio: Number.isFinite(l.minRatio) ? l.minRatio : null,
    pscSame: pscN === count, pscConfirm: p.confirm === true,
    learnedGap: typeof learned === 'number' ? learned - count : null,
  };
}

test.skipIf(!process.env.SURE_FEATURES)('card 056: the signals of every counted build set', () => {
  const rows: any[] = [];
  const add = (r: any) => { if (r) rows.push(r); };
  for (const s of labelledSets().sets as any[]) if (decides(s.lift)) add(row(s.name, 'david', s.lift, s.label, s.wl, s.ts, s.il ?? null, null));
  for (const s of publicSets('build').sets as any[]) if (decides(s.lift)) add(row(s.name, half(s.name), s.lift, s.label, s.wl, s.ts, null, null, s.window));
  for (const s of benchSets('repcount', 'build').sets as any[]) if (s.lift && liftDefinition(s.lift) && decides(s.lift)) add(row(s.name, 'repcount', s.lift, s.label, s.wl, s.ts, null, s.image));
  writeFileSync(resolve(__dirname, 'rows.json'), JSON.stringify(rows) + '\n');
  process.stdout.write(`rows: ${rows.length}\n`);
}, 7_200_000);
