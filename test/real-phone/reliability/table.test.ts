// RELIABILITY=1 npx vitest run test/real-phone/reliability/table.test.ts   (npm run reliability)
// Card 064: one row per exercise, how reliably the live core counts it on human-labelled sets (R1), with the status
// rule fixed in cards/064-per-exercise-reliability.md before the first run. Writes reliability.md beside this file.
// Measured, decides nothing: no gate, no tier, no count reads it. Sealed sets and held-out halves are never read.
import { expect, test } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { summarizeCount, withBodyCheck, withProposal } from '../../../src/lib/coreAnalysis';
import { countReps } from '../../../src/lib/counting/core';
import { OFFERED, tierOf } from '../../../src/lib/offer.js';
import { FITNESS_TESTS } from '../../../src/lib/fitness-tests.js';
import { countInWindow, decides, labelledSets, publicSets, videoSets, writeScoreboard } from '../accuracy/sets';
import { appOutcome } from '../accuracy/outcome.mjs';
import { sureRow } from '../accuracy/sure';

// Status rule (card 064; the thresholds of Phase 1's gate, PLAN.md, 15 November 2026). Status: convention, UNSOURCED
// as a published bar.
export const MIN_SETS = 20;
export const SURE_EXACT_SHARE = 0.9;

type Outcome = number | 'refused';
type Bad = { name: string; label: number; count: number };
type Row = { badSets: Bad[]; n: number; exact: number; bad: number; refused: number; sure: number; sureExact: number; sureBad: number; synth: number; synthExact: number; sources: Set<string> };
const blank = (): Row => ({ badSets: [], n: 0, exact: 0, bad: 0, refused: 0, sure: 0, sureExact: 0, sureBad: 0, synth: 0, synthExact: 0, sources: new Set() });

/** 95 % Wilson score interval for k of n (Wilson 1927), as whole percentages. */
export function wilson(k: number, n: number): [number, number] {
  if (!n) return [0, 0];
  const z = 1.96, p = k / n, d = 1 + (z * z) / n, c = p + (z * z) / (2 * n), h = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.round((100 * (c - h)) / d), Math.round((100 * (c + h)) / d)];
}

/** The row's status under card 064's rule. */
export function status(r: Pick<Row, 'n' | 'sure' | 'sureExact' | 'sureBad'>, decidesAnything: boolean): string {
  if (!r.n) return 'not measured';
  if (!decidesAnything) return 'press: measured, decides nothing';
  if (r.n < MIN_SETS) return 'too few';
  if (r.sureBad > 0 || !r.sure || r.sureExact / r.sure < SURE_EXACT_SHARE) return 'fails';
  return 'passes on tuning data, exam pending';
}

// The app's path on a set, as the scoreboard runs it (count, proposal on a refused set, body check).
const appPath = (lift: string, wl: any[], ts: number[], il: any[] | null) => {
  const c: any = summarizeCount(wl, ts, lift, undefined, il ?? undefined);
  return withBodyCheck(withProposal({ ...c, worldLandmarks: wl, timestamps: ts, imageLandmarks: il }, lift), lift);
};

test.skipIf(!process.env.RELIABILITY)('reliability per exercise', () => {
  const rows = new Map<string, Row>();
  const add = (lift: string, source: string, label: number, now: Outcome, sure?: { err: number | null; flagged: boolean } | null, name = '') => {
    const r = rows.get(lift) ?? blank();
    r.n++; r.sources.add(source);
    if (now === 'refused') r.refused++;
    else { const e = Math.abs(now - label); if (e === 0) r.exact++; if (e >= 3) r.bad++; }
    if (sure && sure.err !== null && !sure.flagged) { r.sure++; if (sure.err === 0) r.sureExact++; if (sure.err >= 3) { r.sureBad++; r.badSets.push({ name: `${source}: ${name}`, label, count: now as number }); } }
    rows.set(lift, r);
  };

  // David's stored sets (the scoreboard's first section).
  const stored = labelledSets().sets;
  for (const s of stored) {
    const res: any = appPath(s.lift, s.wl, s.ts, s.il ?? null);
    add(s.lift, 'David', s.label, res.refused ? 'refused' : res.count, sureRow(res, s.lift, s.label), s.name);
  }
  // David's videos read whole by the built app (IMAGE mode, as the app reads).
  const video = videoSets().sets;
  for (const s of video) {
    const o = appOutcome(s) as { now: Outcome };
    // The sure flags come from the app's path on the stored landmarks; the error is the built app's own count (o.now).
    const sure = s.appRefused || o.now === 'refused' ? null : sureRow(appPath(s.lift, s.wl, s.ts, s.il), s.lift, s.label, () => o.now as number);
    add(s.lift, 'David video', s.label, o.now, sure, s.name);
  }
  // David's phone files: the count his iPhone showed, against his label (no sure flag is stored in the file's line).
  const phoneDir = resolve(__dirname, '../phone-poses');
  const phone: Record<string, { lift: string; label: number; phoneCount: Outcome }> = existsSync(resolve(phoneDir, 'sets.json')) ? JSON.parse(readFileSync(resolve(phoneDir, 'sets.json'), 'utf8')).sets : {};
  for (const e of Object.values(phone)) add(e.lift, 'David phone', e.label, e.phoneCount, null);
  // Public build halves. Countix is read once, cut to its labelled window (countix-whole reads the same clips again).
  const pub = publicSets('build').sets.filter(s => s.dataset !== 'countix-whole');
  for (const s of pub) {
    const r: any = summarizeCount(s.wl, s.ts, s.lift, undefined, s.il ?? undefined);
    const now: Outcome = r.refused ? 'refused' : countInWindow(r.reps, s.window);
    const sure = r.refused ? null : sureRow(withBodyCheck({ ...r, worldLandmarks: s.wl, timestamps: s.ts, imageLandmarks: s.il ?? null }, s.lift), s.lift, s.label, x => countInWindow(x.reps, s.window));
    add(s.lift, s.dataset, s.label, now, sure, s.name);
  }
  // Synthetic sets against their rendered truth: shown beside, decide nothing.
  const synthDir = resolve(__dirname, '../synth/sets');
  for (const f of existsSync(synthDir) ? readdirSync(synthDir).filter(f => f.endsWith('.json.gz')) : []) {
    const d = JSON.parse(gunzipSync(readFileSync(resolve(synthDir, f))).toString());
    const lift = d.params.exercise, r = rows.get(lift) ?? blank();
    r.synth++; if (countReps(d.worldLandmarks, d.timestamps, lift).count === d.reps.length) r.synthExact++;
    rows.set(lift, r);
  }

  // The two fitness tests (chair stand, arm curl) are scored over 30 s, not counted per set: left out of the offered.
  const offered = new Set<string>((OFFERED as string[]).filter(k => !(k in FITNESS_TESTS)));
  const keys = [...rows.keys()].sort((a, b) => rows.get(b)!.n - rows.get(a)!.n || a.localeCompare(b));
  const pct = (k: number, n: number) => (n ? `${Math.round((100 * k) / n)} %` : '-');
  const table = keys.map(k => {
    const r = rows.get(k)!, [lo, hi] = wilson(r.exact, r.n);
    return `| ${k} | ${tierOf(k) ?? 'not offered (a dataset key)'} | ${r.n} | ${r.exact} | ${r.bad} | ${r.refused} | ${r.n ? `${pct(r.exact, r.n)} [${lo}, ${hi}]` : '-'} | ${r.sure} | ${r.sureExact} | ${r.sureBad} | ${r.synth ? `${r.synthExact}/${r.synth}` : '-'} | ${[...r.sources].sort().join(', ') || '-'} | ${status(r, decides(k))} |`;
  });
  const measured = [...offered].filter(k => (rows.get(k)?.n ?? 0) > 0);
  const passing = keys.filter(k => status(rows.get(k)!, decides(k)).startsWith('passes'));
  const counts = (st: string) => keys.filter(k => status(rows.get(k)!, decides(k)) === st).length;
  const today = new Date().toISOString().slice(0, 10);
  const text = [
    `# Reliability per exercise ${today}`,
    '',
    'Written by `npm run reliability` (card 064, test/real-phone/reliability/table.test.ts). Measured, decides nothing. Labels are human (R1); every set read here is tuning data (PLAN.md, THE DATA), so no row reads "reliable": that takes the exam of sealed sets.',
    `Status rule (card 064, fixed before the first run): not measured (no labelled set); too few (under ${MIN_SETS} labelled sets that decide); fails (among the sets shown as sure, under ${SURE_EXACT_SHARE * 100} % exact, or any off by 3 or more); passes on tuning data, exam pending (otherwise). A press set decides nothing (PLAN.md).`,
    `Sources: David (stored sets), David video (whole videos read by the built app), David phone (the count his iPhone showed), and the public build halves (Countix cut to its labelled window, CFRep, MM-Fit). Synthetic: rendered sets against their exact truth, shown beside, deciding nothing.`,
    '',
    `Summary: ${offered.size} exercises offered (src/lib/offer.js, OFFERED, without the two fitness tests; variants are counted as their base exercise and not listed apart); ${measured.length} of them have at least one labelled set and ${offered.size - measured.length} are not measured. Of the ${keys.length} rows below (${keys.filter(k => !offered.has(k)).length} of them a dataset's own key outside OFFERED): ${passing.length} pass on tuning data; ${counts('fails')} fail; ${counts('too few')} have too few sets; ${counts('press: measured, decides nothing')} are presses, measured, deciding nothing.`,
    '',
    '| Exercise | Tier in the app | Labelled sets | Exact | Off by 3+ | Refused | Exact share [95 % Wilson] | Shown as sure | Sure, exact | Sure, off by 3+ | Synthetic exact | Sources | Status |',
    '|---|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---|---|',
    ...table,
    '',
    `Shown as sure and off by 3 or more (R16: the app is right whenever it says it is sure): ${keys.reduce((a, k) => a + rows.get(k)!.badSets.length, 0)} sets.`,
    '',
    ...keys.flatMap(k => rows.get(k)!.badSets.map(b => `- ${k}: ${b.name}, label ${b.label}, counted ${b.count}`)),
    '',
  ].join('\n');
  writeScoreboard(resolve(__dirname, 'reliability.md'), text);
  console.log(text);
  expect(rows.size).toBeGreaterThan(0);
}, 120_000);
