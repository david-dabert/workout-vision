// npx vitest run test/real-phone/public-full-sets/full-sets.test.ts
// Implements the pre-registered selection rule in test/real-phone/public-full-sets/selection-rule.md
// (committed in b2d072e1 before any figures were read, HANDOFF.md Task T2).
import { expect, test } from 'vitest';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { summarizeCount, withBodyCheck } from '../../../src/lib/coreAnalysis';
import { liftDefinition, type WorldLandmarkFrame } from '../../../src/lib/counting/core';
import { facing } from '../../../src/lib/counting/symmetry';
import families from '../../../src/lib/counting/guide-families.json';
import { decides, PRESS_DECIDES_NOTHING, PUBLIC } from '../accuracy/sets';
import { sureLine, sureRow, type SureRow } from '../accuracy/sure';

interface LoadedPublicSet {
  dataset: 'mmfit' | 'repcount' | 'cfrep';
  id: string;
  file: string;
  split: string;
  lift: string | null;
  label: number;
  reps: [number, number][];
  visibleShare: number;
  admitted: boolean;
  wl: WorldLandmarkFrame[];
  ts: number[];
  imageXY: number[][] | null;
}

function loadDatasetBuild(dataset: 'mmfit' | 'repcount' | 'cfrep'): LoadedPublicSet[] {
  const dir = resolve(PUBLIC, dataset, 'build');
  const files = readdirSync(dir).filter(f => f.endsWith('.json.gz')).sort();
  return files.map(file => {
    const raw = JSON.parse(gunzipSync(readFileSync(resolve(dir, file))).toString('utf8'));
    return {
      dataset,
      id: raw.id ?? file.replace(/\.json\.gz$/, ''),
      file: `${dataset}/build/${file}`,
      split: raw.split ?? 'build',
      lift: raw.lift ?? null,
      label: Number(raw.count),
      reps: Array.isArray(raw.reps) ? raw.reps : [],
      visibleShare: typeof raw.visibleShare === 'number' ? raw.visibleShare : 0,
      admitted: raw.admitted !== false,
      wl: raw.worldLandmarks ?? [],
      ts: raw.timestamps ?? [],
      imageXY: Array.isArray(raw.imageXY) ? raw.imageXY : null,
    };
  });
}

// S1: build split, admitted, mapped to a lift with a live counter.
function passesS1(s: LoadedPublicSet): boolean {
  return s.split === 'build' && s.admitted && !!s.lift && !!liftDefinition(s.lift) && Number.isInteger(s.label);
}

// S2: whole set of 8 reps or more.
function passesS2(s: LoadedPublicSet): boolean {
  return s.label >= 8;
}

// S3: single continuous whole set (selection-rule.md section 2).
function passesS3(s: LoadedPublicSet): boolean {
  if (!s.ts.length) return false;
  if (s.dataset === 'mmfit') {
    // MM-Fit sets are cut from start - 30 frames to end + 30 frames around a single continuous set.
    return true;
  }
  // RepCount-A and CFRep carry per-rep [startSec, endSec] in s.reps.
  if (s.reps.length !== s.label || s.reps.length < 8) return false;
  const t0 = s.ts[0], tEnd = s.ts[s.ts.length - 1];
  if (s.reps[0][0] < t0 || s.reps[s.reps.length - 1][1] > tEnd) return false;
  for (let i = 1; i < s.reps.length; i++) {
    const gap = s.reps[i][0] - s.reps[i - 1][1];
    if (gap > 10.0) return false;
  }
  return true;
}

// S4a: whole body visible on >= 70% of frames (matching MIN_VALID_RATIO = 0.70 in core.ts).
function passesS4a(s: LoadedPublicSet): boolean {
  return s.visibleShare >= 0.70;
}

// S4b: camera view matches guide-families.json recommended view ("front" vs "side").
function passesS4b(s: LoadedPublicSet): boolean {
  if (!passesS4a(s) || !s.lift) return false;
  const fam = (families as Record<string, { view?: string }>)[s.lift];
  const wanted = fam?.view;
  if (!wanted) return true;
  const f = facing(s.wl);
  if (wanted === 'front') return f.shoulderDeg <= 30 && f.hipDeg <= 30 && f.facingShare >= 0.5;
  if (wanted === 'side') return f.shoulderDeg > 20 || f.hipDeg > 20;
  return true;
}

interface EvalRow {
  set: LoadedPublicSet;
  count: number | 'refused';
  err: number;
  sure: SureRow;
}

function evaluateSet(s: LoadedPublicSet): EvalRow {
  const lift = s.lift!;
  const r: any = summarizeCount(s.wl, s.ts, lift);
  const count: number | 'refused' = r.refused ? 'refused' : r.count;
  const err = r.refused ? Infinity : Math.abs(r.count - s.label);
  const checked = withBodyCheck({ ...r, worldLandmarks: s.wl, timestamps: s.ts, imageLandmarks: null, imageXY: s.imageXY }, lift);
  const sure = sureRow(checked, lift, s.label);
  return { set: s, count, err, sure };
}

function pct(k: number, n: number): string {
  return n ? `${Math.round((100 * k) / n)}%` : '0%';
}

function summarizeTable(title: string, rows: EvalRow[]): string[] {
  const deciding = rows.filter(r => decides(r.set.lift!));
  const dExact = deciding.filter(r => r.err === 0).length;
  const dOne = deciding.filter(r => r.err === 1).length;
  const dTwo = deciding.filter(r => r.err === 2).length;
  const dBad = deciding.filter(r => r.err >= 3 && r.count !== 'refused').length;
  const dRef = deciding.filter(r => r.count === 'refused').length;

  const lines: string[] = [
    `## ${title}`,
    `Deciding sets (non-press): ${deciding.length} sets — ${dExact} exact (${pct(dExact, deciding.length)}), ${dOne} off by 1, ${dTwo} off by 2, ${dBad} off by 3+ (counted), ${dRef} refused.`,
    sureLine(deciding.map(r => r.sure)),
    '',
    '| Dataset | Exercise | Guide view | Sets | Exact | Exact % | Off 1 | Off 2 | Off 3+ | Refused | Sure (shipped) | Exact when sure | Sure off 3+ | Asked to confirm |',
    '|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  ];

  const byKey = new Map<string, EvalRow[]>();
  for (const r of rows) {
    const k = `${r.set.dataset}::${r.set.lift}`;
    const list = byKey.get(k) ?? [];
    list.push(r);
    byKey.set(k, list);
  }

  for (const [key, g] of [...byKey.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const [ds, lift] = key.split('::');
    const view = (families as Record<string, { view?: string }>)[lift]?.view ?? '-';
    const n = g.length;
    const ex = g.filter(r => r.err === 0).length;
    const o1 = g.filter(r => r.err === 1).length;
    const o2 = g.filter(r => r.err === 2).length;
    const o3 = g.filter(r => r.err >= 3 && r.count !== 'refused').length;
    const ref = g.filter(r => r.count === 'refused').length;
    const countedSure = g.map(r => r.sure).filter(sr => sr.err !== null);
    const shippedSure = countedSure.filter(sr => !sr.flagged && !sr.moved);
    const sureEx = shippedSure.filter(sr => sr.err === 0).length;
    const sureBad = shippedSure.filter(sr => (sr.err ?? 0) >= 3).length;
    const asked = countedSure.filter(sr => sr.flagged || sr.moved).length;
    const labelLift = decides(lift) ? lift : `${lift} ${PRESS_DECIDES_NOTHING}`;
    lines.push(
      `| ${ds} | ${labelLift} | ${view} | ${n} | ${ex} | ${pct(ex, n)} | ${o1} | ${o2} | ${o3} | ${ref} | ${shippedSure.length} | ${sureEx}/${shippedSure.length} (${pct(sureEx, shippedSure.length)}) | ${sureBad} | ${asked} |`
    );
  }

  // Also aggregate by exercise across datasets
  lines.push(
    '',
    '### By exercise (RepCount-A + MM-Fit combined where applicable)',
    '| Exercise | Guide view | Sets | Exact | Exact % | Off 1 | Off 2 | Off 3+ | Refused | Sure (shipped) | Exact when sure | Sure off 3+ | Asked to confirm |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  );
  const byLift = new Map<string, EvalRow[]>();
  for (const r of rows) {
    const lift = r.set.lift!;
    const list = byLift.get(lift) ?? [];
    list.push(r);
    byLift.set(lift, list);
  }
  for (const [lift, g] of [...byLift.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const view = (families as Record<string, { view?: string }>)[lift]?.view ?? '-';
    const n = g.length;
    const ex = g.filter(r => r.err === 0).length;
    const o1 = g.filter(r => r.err === 1).length;
    const o2 = g.filter(r => r.err === 2).length;
    const o3 = g.filter(r => r.err >= 3 && r.count !== 'refused').length;
    const ref = g.filter(r => r.count === 'refused').length;
    const countedSure = g.map(r => r.sure).filter(sr => sr.err !== null);
    const shippedSure = countedSure.filter(sr => !sr.flagged && !sr.moved);
    const sureEx = shippedSure.filter(sr => sr.err === 0).length;
    const sureBad = shippedSure.filter(sr => (sr.err ?? 0) >= 3).length;
    const asked = countedSure.filter(sr => sr.flagged || sr.moved).length;
    const labelLift = decides(lift) ? lift : `${lift} ${PRESS_DECIDES_NOTHING}`;
    lines.push(
      `| ${labelLift} | ${view} | ${n} | ${ex} | ${pct(ex, n)} | ${o1} | ${o2} | ${o3} | ${ref} | ${shippedSure.length} | ${sureEx}/${shippedSure.length} (${pct(sureEx, shippedSure.length)}) | ${sureBad} | ${asked} |`
    );
  }
  lines.push('');
  return lines;
}

test('public full sets (>= 8 reps) gate, RepCount-A and MM-Fit build halves', () => {
  const repcountAll = loadDatasetBuild('repcount');
  const mmfitAll = loadDatasetBuild('mmfit');
  const cfrepAll = loadDatasetBuild('cfrep');

  const primaryPool = [...repcountAll, ...mmfitAll];
  const s1Pool = primaryPool.filter(passesS1);
  const s2Pool = s1Pool.filter(passesS2);
  const s3Pool = s2Pool.filter(passesS3);
  const s4aPool = s3Pool.filter(passesS4a);
  const s4bPool = s3Pool.filter(passesS4b);

  const evalS1 = s1Pool.map(evaluateSet);
  const s3Set = new Set(s3Pool);
  const s4aSet = new Set(s4aPool);
  const s4bSet = new Set(s4bPool);
  const evalS3 = evalS1.filter(r => s3Set.has(r.set));
  const evalS4a = evalS1.filter(r => s4aSet.has(r.set));
  const evalS4b = evalS1.filter(r => s4bSet.has(r.set));

  const cfrepS4a = cfrepAll.filter(s => passesS1(s) && passesS2(s) && passesS3(s) && passesS4a(s)).map(evaluateSet);

  const funnel = [
    '# Public Gate of Whole Sets of 8 Reps or More (HANDOFF.md Task T2, 25 October 2026)',
    '',
    'Selection rule fixed before reading figures: `test/real-phone/public-full-sets/selection-rule.md` (commit `b2d072e1`).',
    '',
    '## Selection Funnel (RepCount-A + MM-Fit build halves)',
    `- Total build files on disk: ${primaryPool.length} (RepCount-A: ${repcountAll.length}, MM-Fit: ${mmfitAll.length})`,
    `- S1 (admitted & mapped to a lift with a live counter): ${s1Pool.length} (RepCount-A: ${s1Pool.filter(s => s.dataset === 'repcount').length}, MM-Fit: ${s1Pool.filter(s => s.dataset === 'mmfit').length}; non-press deciding: ${s1Pool.filter(s => decides(s.lift!)).length})`,
    `- S1 + S2 (label >= 8 reps): ${s2Pool.length} (RepCount-A: ${s2Pool.filter(s => s.dataset === 'repcount').length}, MM-Fit: ${s2Pool.filter(s => s.dataset === 'mmfit').length}; non-press deciding: ${s2Pool.filter(s => decides(s.lift!)).length})`,
    `- S1 + S2 + S3 (whole single continuous set >= 8 reps): ${s3Pool.length} (RepCount-A: ${s3Pool.filter(s => s.dataset === 'repcount').length}, MM-Fit: ${s3Pool.filter(s => s.dataset === 'mmfit').length}; non-press deciding: ${s3Pool.filter(s => decides(s.lift!)).length})`,
    `- S1 + S2 + S3 + S4a (whole body visible >= 70% of frames, primary T2 subset): ${s4aPool.length} (RepCount-A: ${s4aPool.filter(s => s.dataset === 'repcount').length}, MM-Fit: ${s4aPool.filter(s => s.dataset === 'mmfit').length}; non-press deciding: ${s4aPool.filter(s => decides(s.lift!)).length})`,
    `- S1 + S2 + S3 + S4b (also matching guide-families.json front/side camera orientation): ${s4bPool.length} (RepCount-A: ${s4bPool.filter(s => s.dataset === 'repcount').length}, MM-Fit: ${s4bPool.filter(s => s.dataset === 'mmfit').length}; non-press deciding: ${s4bPool.filter(s => decides(s.lift!)).length})`,
    '',
    ...summarizeTable('Primary T2 Subset (S1–S4a: Whole Sets >= 8 Reps, Whole Body Visible >= 70%)', evalS4a),
    ...summarizeTable('All Whole Sets >= 8 Reps Before 70% Whole-Body Visibility Filter (S1–S3)', evalS3),
    ...summarizeTable('Strict Guide View Match Subset (S1–S4b: Whole Sets >= 8 Reps + Guide Front/Side Orientation)', evalS4b),
    ...summarizeTable('Reference: All Countable Build Sets of Any Length in RepCount-A + MM-Fit (S1)', evalS1),
    ...summarizeTable('Supplement: CFRep Whole Sets >= 8 Reps with Whole Body Visible >= 70% (S1–S4a)', cfrepS4a),
  ];

  writeFileSync(resolve(__dirname, 'full-sets.txt'), funnel.join('\n') + '\n');
  expect(s4aPool.length).toBeGreaterThan(0);
}, 60_000);
