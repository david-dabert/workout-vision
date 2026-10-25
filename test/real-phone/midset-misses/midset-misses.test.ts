// npx vitest run test/real-phone/midset-misses/midset-misses.test.ts
// Task T3 (HANDOFF.md): Why the core misses mid-set reps on RepCount-A and MM-Fit build halves.
// For each labelled rep the core misses:
// 1. Visibility of the counted joint during the rep,
// 2. The counted joint's angle over that rep (excursion vs found-rep median, and whether it failed at the working
//    threshold or failed to return across the rest threshold between reps, merging two reps into one),
// 3. Whether the rep shows on the other side (opposite limb),
// 4. Comparison against the other joints of the signal bank (src/lib/counting/psc.js signalBank) and signalProfile.
import { expect, test } from 'vitest';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { countReps, liftDefinition, sideAngles, type WorldLandmarkFrame } from '../../../src/lib/counting/core';
import { signalBank } from '../../../src/lib/counting/psc.js';
import { flatImage, signalProfile } from '../../../src/lib/counting/bodyCheck.js';
import { decides, PUBLIC } from '../accuracy/sets';
import type { Span } from '../accuracy/match-reps';

const JOINT_LANDMARKS: Record<string, { left: [number, number, number]; right: [number, number, number] }> = {
  elbow: { left: [11, 13, 15], right: [12, 14, 16] },
  shoulder: { left: [23, 11, 13], right: [24, 12, 14] },
  hip: { left: [11, 23, 25], right: [12, 24, 26] },
  knee: { left: [23, 25, 27], right: [24, 26, 28] },
};

const ANGLE_JOINTS = new Set(['elbow', 'shoulder', 'hip', 'knee', 'ankle', 'trunk']);

const overlap = ([a, b]: Span, [c, d]: Span) => Math.max(0, Math.min(b, d) - Math.max(a, c));

function median(xs: number[]): number {
  const f = xs.filter(Number.isFinite).sort((a, b) => a - b);
  if (!f.length) return NaN;
  const m = f.length >> 1;
  return f.length % 2 ? f[m] : (f[m - 1] + f[m]) / 2;
}

function spanInWindow(series: (number | null | undefined)[] | Float64Array, ts: number[], [t0, t1]: Span): number {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < ts.length; i++) {
    if (ts[i] < t0 - 1e-6 || ts[i] > t1 + 1e-6) continue;
    const v = series[i];
    if (typeof v === 'number' && Number.isFinite(v)) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  return hi > lo ? hi - lo : 0;
}

function jointVisibilityInWindow(wl: WorldLandmarkFrame[], ts: number[], joint: string, side: 'left' | 'right', [t0, t1]: Span) {
  const pts = JOINT_LANDMARKS[joint]?.[side] ?? [11, 13, 15];
  let frames = 0, validFrames = 0, visSum = 0;
  for (let i = 0; i < ts.length; i++) {
    if (ts[i] < t0 - 1e-6 || ts[i] > t1 + 1e-6) continue;
    frames++;
    const f = wl[i];
    if (!f) continue;
    const vs = pts.map(idx => f[idx]?.visibility ?? 0);
    const minV = Math.min(...vs);
    visSum += (vs[0] + vs[1] + vs[2]) / 3;
    if (minV >= 0.5) validFrames++;
  }
  return {
    frames,
    visShare: frames > 0 ? validFrames / frames : 0,
    meanVis: frames > 0 ? visSum / frames : 0,
  };
}

interface MissedRepRecord {
  dataset: string;
  id: string;
  lift: string;
  deciding: boolean;
  setRefused: boolean;
  repIndex: number; // 1-based
  totalReps: number;
  position: 'first' | 'middle' | 'last';
  window: Span;
  durationSec: number;
  relDuration: number; // relative to set's median labelled rep duration
  countedSide: 'left' | 'right';
  visShare: number;
  meanVis: number;
  otherVisShare: number;
  countedSpanDeg: number;
  medianFoundSpanDeg: number;
  relCountedSpan: number; // countedSpanDeg / medianFoundSpanDeg
  requiredWorkSpanDeg: number;
  reachedWork: boolean;
  restBeforeWork: boolean;
  restAfterWork: boolean;
  coveredByMergedRep: boolean;
  cause:
    | 'unseen_dropout'
    | 'merged_no_rest_return'
    | 'shallow_below_work_threshold'
    | 'flat_no_excursion'
    | 'duration_or_boundary_shift';
  otherSideSpanDeg: number;
  relOtherSideSpan: number;
  otherSideShowsRep: boolean;
  otherSideCountedRep: boolean;
  bestAngleJointName: string;
  bestAngleJointRelSpan: number;
  bestAngleJointZSpan: number;
  otherAngleJointShowsRep: boolean;
  bestBankJointName: string;
  bestBankJointRelSpan: number;
  bestBankJointZSpan: number;
  bankOtherJointShowsRep: boolean;
  bestProfileSignalName: string;
  bestProfileSignalRelSpan: number;
  profileSignalShowsRep: boolean;
}

function analyzePerRepDataset(dataset: 'repcount' | 'cfrep'): {
  setsCount: number;
  countedSetsCount: number;
  totalLabelledReps: number;
  foundReps: number;
  missedAll: MissedRepRecord[];
} {
  const dir = resolve(PUBLIC, dataset, 'build');
  const files = readdirSync(dir).filter(f => f.endsWith('.json.gz')).sort();
  let setsCount = 0, countedSetsCount = 0, totalLabelledReps = 0, foundReps = 0;
  const missedAll: MissedRepRecord[] = [];

  for (const file of files) {
    const raw = JSON.parse(gunzipSync(readFileSync(resolve(dir, file))).toString('utf8'));
    const lift: string | null = raw.lift ?? null;
    if (!lift || !liftDefinition(lift) || raw.admitted === false) continue;
    const def = liftDefinition(lift)!;
    const labelled: Span[] = Array.isArray(raw.reps) ? raw.reps : [];
    if (!labelled.length) continue;
    setsCount++;
    totalLabelledReps += labelled.length;

    const wl: WorldLandmarkFrame[] = raw.worldLandmarks ?? [];
    const ts: number[] = raw.timestamps ?? [];
    const sum = summarizeCount(wl, ts, lift);
    const setRefused = !!sum.refused;
    if (!setRefused) countedSetsCount++;

    const r = countReps(wl, ts, lift);
    const countedSpans: Span[] = setRefused ? [] : r.reps.map(p => [p.startTime, p.endTime]);

    // Match reps (match-reps.ts)
    const taken = new Set<number>();
    const found: boolean[] = labelled.map(() => false);
    const pairs = labelled
      .flatMap((l, i) => countedSpans.map((c, j) => ({ i, j, o: overlap(l, c) })))
      .filter(p => p.o >= 0.5 * (labelled[p.i][1] - labelled[p.i][0]))
      .sort((a, b) => b.o - a.o);
    for (const { i, j } of pairs) {
      if (!found[i] && !taken.has(j)) {
        found[i] = true;
        taken.add(j);
      }
    }
    foundReps += found.filter(Boolean).length;
    if (found.every(Boolean)) continue;

    const countedSide: 'left' | 'right' = r.arm === 'right' ? 'right' : 'left';
    const otherSide: 'left' | 'right' = countedSide === 'left' ? 'right' : 'left';
    const countedAngles = r.smoothedAngles;
    const otherAngles = sideAngles(wl, ts, def, otherSide).smoothed;
    const otherCountedSpans: Span[] = countReps(wl, ts, lift).sides?.[otherSide]?.reps.map(p => [p.startTime, p.endTime]) ?? [];

    const medLabelDur = median(labelled.map(([a, b]) => b - a));
    const foundSpans = labelled.filter((_, i) => found[i]);
    const refSpans = foundSpans.length ? foundSpans : labelled;
    const medianFoundSpanDeg = median(refSpans.map(sp => spanInWindow(countedAngles, ts, sp))) || 1;
    const medianOtherRefSpanDeg = median(refSpans.map(sp => spanInWindow(otherAngles, ts, sp))) || medianFoundSpanDeg;

    // Signal bank from src/lib/counting/psc.js
    const bank = signalBank(wl, ts, flatImage({ worldLandmarks: wl, imageXY: raw.imageXY ?? null }));
    const bankRefMedians = new Map<string, number>();
    for (const s of bank.sigs) {
      bankRefMedians.set(s.name, median(refSpans.map(sp => spanInWindow(s.z, bank.grid, sp))) || 1);
    }
    const prof = signalProfile(lift);
    const profNames = new Set<string>();
    if (prof) {
      for (const p of prof.signals) {
        if (p.name.replace(/[LR]$/, '') === def.joint) continue;
        profNames.add(`w.${p.name}`);
        profNames.add(`i.${p.name}`);
      }
    }

    const lo = r.lowThreshold, hi = r.highThreshold;
    const restsLow = def.rest === 'low';
    const atRest = (x: number) => (restsLow ? x < lo : x > hi);
    const atWork = (x: number) => (restsLow ? x >= hi : x <= lo);

    for (let i = 0; i < labelled.length; i++) {
      if (found[i]) continue;
      const win = labelled[i];
      const position: 'first' | 'middle' | 'last' =
        i === 0 ? 'first' : i === labelled.length - 1 ? 'last' : 'middle';

      const vis = jointVisibilityInWindow(wl, ts, def.joint, countedSide, win);
      const otherVis = jointVisibilityInWindow(wl, ts, def.joint, otherSide, win);
      const countedSpanDeg = spanInWindow(countedAngles, ts, win);
      const relCountedSpan = countedSpanDeg / medianFoundSpanDeg;
      const otherSideSpanDeg = spanInWindow(otherAngles, ts, win);
      const relOtherSideSpan = otherSideSpanDeg / Math.max(medianFoundSpanDeg, medianOtherRefSpanDeg, 15);

      // Find the working extreme time inside [win[0], win[1]]
      let extremeIdx = -1;
      let extremeVal = restsLow ? -Infinity : Infinity;
      let reachedWork = false;
      for (let t = 0; t < ts.length; t++) {
        if (ts[t] < win[0] - 0.1 || ts[t] > win[1] + 0.1) continue;
        const x = countedAngles[t];
        if (x === null || x === undefined) continue;
        if (atWork(x)) reachedWork = true;
        if ((restsLow && x > extremeVal) || (!restsLow && x < extremeVal)) {
          extremeVal = x;
          extremeIdx = t;
        }
      }
      const tPeak = extremeIdx >= 0 ? ts[extremeIdx] : (win[0] + win[1]) / 2;
      const prevPeakBoundary = i > 0 ? (labelled[i - 1][0] + labelled[i - 1][1]) / 2 : ts[0];
      const nextPeakBoundary = i + 1 < labelled.length ? (labelled[i + 1][0] + labelled[i + 1][1]) / 2 : ts.at(-1)!;

      let restBeforeWork = false;
      let restAfterWork = false;
      for (let t = 0; t < ts.length; t++) {
        const x = countedAngles[t];
        if (x === null || x === undefined) continue;
        if (ts[t] >= prevPeakBoundary && ts[t] <= tPeak && atRest(x)) restBeforeWork = true;
        if (ts[t] >= tPeak && ts[t] <= nextPeakBoundary && atRest(x)) restAfterWork = true;
      }

      // Check if an existing counted rep spans across this rep (merged with an adjacent rep that claimed it in matchReps)
      const coveredByMergedRep = countedSpans.some(c => overlap(win, c) >= 0.35 * (win[1] - win[0]));

      let cause: MissedRepRecord['cause'];
      if (vis.visShare < 0.5) {
        cause = 'unseen_dropout';
      } else if (countedSpanDeg < 15 || relCountedSpan < 0.35) {
        cause = 'flat_no_excursion';
      } else if (!reachedWork) {
        cause = 'shallow_below_work_threshold';
      } else if (!restBeforeWork || !restAfterWork || coveredByMergedRep) {
        cause = 'merged_no_rest_return';
      } else {
        cause = 'duration_or_boundary_shift';
      }

      // Check non-counted joints in signalBank (both pure angle joints and all signals)
      let bestAngleJointName = 'none';
      let bestAngleJointRelSpan = 0;
      let bestAngleJointZSpan = 0;
      let bestBankJointName = 'none';
      let bestBankJointRelSpan = 0;
      let bestBankJointZSpan = 0;
      let bestProfileSignalName = 'none';
      let bestProfileSignalRelSpan = 0;

      for (const s of bank.sigs) {
        const baseName = s.name.replace(/^[wi]\./, '').replace(/[LR]$/, '');
        if (baseName === def.joint) continue;
        const zSpan = spanInWindow(s.z, bank.grid, win);
        const refMed = bankRefMedians.get(s.name) || 1;
        const rel = zSpan / refMed;
        if (ANGLE_JOINTS.has(baseName) && zSpan >= 1.5 && rel > bestAngleJointRelSpan) {
          bestAngleJointRelSpan = rel;
          bestAngleJointZSpan = zSpan;
          bestAngleJointName = s.name;
        }
        if (zSpan >= 1.5 && rel > bestBankJointRelSpan) {
          bestBankJointRelSpan = rel;
          bestBankJointZSpan = zSpan;
          bestBankJointName = s.name;
        }
        if (profNames.has(s.name) && zSpan >= 1.5 && rel > bestProfileSignalRelSpan) {
          bestProfileSignalRelSpan = rel;
          bestProfileSignalName = s.name;
        }
      }

      missedAll.push({
        dataset,
        id: raw.id ?? file.replace(/\.json\.gz$/, ''),
        lift,
        deciding: decides(lift),
        setRefused,
        repIndex: i + 1,
        totalReps: labelled.length,
        position,
        window: win,
        durationSec: win[1] - win[0],
        relDuration: medLabelDur > 0 ? (win[1] - win[0]) / medLabelDur : 1,
        countedSide,
        visShare: vis.visShare,
        meanVis: vis.meanVis,
        otherVisShare: otherVis.visShare,
        countedSpanDeg,
        medianFoundSpanDeg,
        relCountedSpan,
        requiredWorkSpanDeg: Math.abs(hi - lo),
        reachedWork,
        restBeforeWork,
        restAfterWork,
        coveredByMergedRep,
        cause,
        otherSideSpanDeg,
        relOtherSideSpan,
        otherSideShowsRep: otherVis.visShare >= 0.5 && relOtherSideSpan >= 0.70 && otherSideSpanDeg >= 15,
        otherSideCountedRep: otherCountedSpans.some(c => overlap(win, c) >= 0.5 * (win[1] - win[0])),
        bestAngleJointName,
        bestAngleJointRelSpan,
        bestAngleJointZSpan,
        otherAngleJointShowsRep: bestAngleJointRelSpan >= 0.70 && bestAngleJointZSpan >= 1.5,
        bestBankJointName,
        bestBankJointRelSpan,
        bestBankJointZSpan,
        bankOtherJointShowsRep: bestBankJointRelSpan >= 0.70 && bestBankJointZSpan >= 1.5,
        bestProfileSignalName,
        bestProfileSignalRelSpan,
        profileSignalShowsRep: bestProfileSignalRelSpan >= 0.70,
      });
    }
  }

  return { setsCount, countedSetsCount, totalLabelledReps, foundReps, missedAll };
}

interface MmfitGapRecord {
  id: string;
  lift: string;
  label: number;
  counted: number;
  gapKind: 'mid_set_gap' | 'overlong_merged_rep' | 'edge_shortfall';
  window: Span;
  visShare: number;
  countedSpanDeg: number;
  relCountedSpan: number;
  cause: string;
  otherSideShowsRep: boolean;
  otherAngleJointShowsRep: boolean;
  bankOtherJointShowsRep: boolean;
  bestAngleJointName: string;
}

function analyzeMmfitUndercounts() {
  const dir = resolve(PUBLIC, 'mmfit', 'build');
  const files = readdirSync(dir).filter(f => f.endsWith('.json.gz')).sort();
  let totalSets = 0, undercountedSets = 0, totalMissingReps = 0;
  const gaps: MmfitGapRecord[] = [];

  for (const file of files) {
    const raw = JSON.parse(gunzipSync(readFileSync(resolve(dir, file))).toString('utf8'));
    const lift: string | null = raw.lift ?? null;
    if (!lift || !liftDefinition(lift) || raw.admitted === false) continue;
    totalSets++;
    const def = liftDefinition(lift)!;
    const wl: WorldLandmarkFrame[] = raw.worldLandmarks ?? [];
    const ts: number[] = raw.timestamps ?? [];
    const label = Number(raw.count);
    const r = countReps(wl, ts, lift);
    if (r.count >= label) continue;
    undercountedSets++;
    const missing = label - r.count;
    totalMissingReps += missing;

    const countedSide: 'left' | 'right' = r.arm === 'right' ? 'right' : 'left';
    const otherSide: 'left' | 'right' = countedSide === 'left' ? 'right' : 'left';
    const countedAngles = r.smoothedAngles;
    const otherAngles = sideAngles(wl, ts, def, otherSide).smoothed;
    const foundSpans: Span[] = r.reps.map(p => [p.startTime, p.endTime]);
    const medDur = median(foundSpans.map(([a, b]) => b - a)) || 2.0;
    const medSpanDeg = median(foundSpans.map(sp => spanInWindow(countedAngles, ts, sp))) || 20;

    const bank = signalBank(wl, ts, null);
    const bankRefMedians = new Map<string, number>();
    for (const s of bank.sigs) {
      bankRefMedians.set(s.name, median(foundSpans.map(sp => spanInWindow(s.z, bank.grid, sp))) || 1);
    }

    const lo = r.lowThreshold, hi = r.highThreshold;
    const restsLow = def.rest === 'low';
    const atWork = (x: number) => (restsLow ? x >= hi : x <= lo);

    const inspectBank = (win: Span) => {
      let bestAngleName = 'none', bestAngleRel = 0, bestAllRel = 0;
      for (const s of bank.sigs) {
        const baseName = s.name.replace(/^[wi]\./, '').replace(/[LR]$/, '');
        if (baseName === def.joint) continue;
        const zSpan = spanInWindow(s.z, bank.grid, win);
        const rel = zSpan / (bankRefMedians.get(s.name) || 1);
        if (zSpan >= 1.5 && rel > bestAllRel) bestAllRel = rel;
        if (ANGLE_JOINTS.has(baseName) && zSpan >= 1.5 && rel > bestAngleRel) {
          bestAngleRel = rel;
          bestAngleName = s.name;
        }
      }
      return { bestAngleName, bestAngleRel, bestAllRel };
    };

    let foundMidEvent = false;
    for (let k = 0; k < r.reps.length; k++) {
      const cur = r.reps[k];
      if (cur.endTime - cur.startTime >= 1.65 * medDur) {
        foundMidEvent = true;
        const win: Span = [cur.startTime, cur.endTime];
        const vis = jointVisibilityInWindow(wl, ts, def.joint, countedSide, win);
        const bk = inspectBank(win);
        gaps.push({
          id: raw.id ?? file.replace(/\.json\.gz$/, ''),
          lift,
          label,
          counted: r.count,
          gapKind: 'overlong_merged_rep',
          window: win,
          visShare: vis.visShare,
          countedSpanDeg: cur.romDegrees,
          relCountedSpan: cur.romDegrees / medSpanDeg,
          cause: 'merged_no_rest_return',
          otherSideShowsRep: spanInWindow(otherAngles, ts, win) >= 0.7 * medSpanDeg,
          otherAngleJointShowsRep: bk.bestAngleRel >= 0.7,
          bankOtherJointShowsRep: bk.bestAllRel >= 0.7,
          bestAngleJointName: bk.bestAngleName,
        });
      }
      if (k + 1 < r.reps.length) {
        const next = r.reps[k + 1];
        const gapSec = next.startTime - cur.endTime;
        if (gapSec >= 0.85 * medDur) {
          foundMidEvent = true;
          const win: Span = [cur.endTime, next.startTime];
          const vis = jointVisibilityInWindow(wl, ts, def.joint, countedSide, win);
          const cSpan = spanInWindow(countedAngles, ts, win);
          const oSpan = spanInWindow(otherAngles, ts, win);
          let hitWork = false;
          for (let t = 0; t < ts.length; t++) {
            if (ts[t] >= win[0] && ts[t] <= win[1] && countedAngles[t] !== null && atWork(countedAngles[t]!)) hitWork = true;
          }
          const bk = inspectBank(win);
          gaps.push({
            id: raw.id ?? file.replace(/\.json\.gz$/, ''),
            lift,
            label,
            counted: r.count,
            gapKind: 'mid_set_gap',
            window: win,
            visShare: vis.visShare,
            countedSpanDeg: cSpan,
            relCountedSpan: cSpan / medSpanDeg,
            cause: vis.visShare < 0.5 ? 'unseen_dropout' : cSpan < 15 ? 'flat_no_excursion' : !hitWork ? 'shallow_below_work_threshold' : 'merged_no_rest_return',
            otherSideShowsRep: oSpan >= 0.7 * medSpanDeg,
            otherAngleJointShowsRep: bk.bestAngleRel >= 0.7,
            bankOtherJointShowsRep: bk.bestAllRel >= 0.7,
            bestAngleJointName: bk.bestAngleName,
          });
        }
      }
    }
    if (!foundMidEvent) {
      const firstEnd = r.reps[0]?.startTime ?? ts[Math.floor(ts.length / 2)];
      const lastStart = r.reps.at(-1)?.endTime ?? ts[Math.floor(ts.length / 2)];
      const win: Span = firstEnd - ts[0] >= ts.at(-1)! - lastStart ? [ts[0], firstEnd] : [lastStart, ts.at(-1)!];
      const vis = jointVisibilityInWindow(wl, ts, def.joint, countedSide, win);
      const cSpan = spanInWindow(countedAngles, ts, win);
      const oSpan = spanInWindow(otherAngles, ts, win);
      let hitWork = false;
      for (let t = 0; t < ts.length; t++) {
        if (ts[t] >= win[0] && ts[t] <= win[1] && countedAngles[t] !== null && atWork(countedAngles[t]!)) hitWork = true;
      }
      const bk = inspectBank(win);
      gaps.push({
        id: raw.id ?? file.replace(/\.json\.gz$/, ''),
        lift,
        label,
        counted: r.count,
        gapKind: 'edge_shortfall',
        window: win,
        visShare: vis.visShare,
        countedSpanDeg: cSpan,
        relCountedSpan: cSpan / medSpanDeg,
        cause: vis.visShare < 0.5 ? 'unseen_dropout' : cSpan < 15 ? 'flat_no_excursion' : !hitWork ? 'shallow_below_work_threshold' : 'merged_no_rest_return',
        otherSideShowsRep: oSpan >= 0.7 * medSpanDeg,
        otherAngleJointShowsRep: bk.bestAngleRel >= 0.7,
        bankOtherJointShowsRep: bk.bestAllRel >= 0.7,
        bestAngleJointName: bk.bestAngleName,
      });
    }
  }

  return { totalSets, undercountedSets, totalMissingReps, gaps };
}

const pct = (k: number, n: number) => (n ? `${Math.round((100 * k) / n)}%` : '0%');

test('diagnose why the core misses mid-set reps on RepCount-A and MM-Fit (Task T3)', () => {
  const rc = analyzePerRepDataset('repcount');
  const cf = analyzePerRepDataset('cfrep');
  const mm = analyzeMmfitUndercounts();

  // Non-refused sets (where the core produces a count rather than refusing) and deciding (non-press) sets
  const rcCountedDeciding = rc.missedAll.filter(m => !m.setRefused && m.deciding);
  const rcCountedDecidingMid = rcCountedDeciding.filter(m => m.position === 'middle');
  const rcMid = rc.missedAll.filter(m => m.position === 'middle');

  const countBy = <T>(arr: T[], fn: (x: T) => string) => {
    const m = new Map<string, number>();
    for (const x of arr) m.set(fn(x), (m.get(fn(x)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  const summarizeRepCountGroup = (title: string, list: MissedRepRecord[]) => {
    const n = list.length;
    const visHigh = list.filter(m => m.visShare >= 0.8).length;
    const visHalf = list.filter(m => m.visShare >= 0.5).length;
    const normalDur = list.filter(m => m.relDuration >= 0.6 && m.relDuration <= 1.6).length;
    const countedHasExcursion = list.filter(m => m.relCountedSpan >= 0.7).length;
    const otherSideHas = list.filter(m => m.otherSideShowsRep).length;
    const rescuesWhenCountedWeak = list.filter(m => m.relCountedSpan < 0.7 && m.otherSideShowsRep).length;
    const angleJointHas = list.filter(m => m.otherAngleJointShowsRep).length;
    const angleJointRescues = list.filter(m => m.relCountedSpan < 0.7 && m.otherAngleJointShowsRep).length;
    const bankHas = list.filter(m => m.bankOtherJointShowsRep).length;
    const bankRescuesWhenCountedWeak = list.filter(m => m.relCountedSpan < 0.7 && m.bankOtherJointShowsRep).length;
    const profileHas = list.filter(m => m.profileSignalShowsRep).length;
    const causes = countBy(list, m => m.cause);

    return [
      `### ${title} (n = ${n})`,
      `- Normal duration (0.6x to 1.6x set median): ${normalDur} of ${n} (${pct(normalDur, n)})`,
      `- Counted joint visibility >= 80% of rep frames: ${visHigh} of ${n} (${pct(visHigh, n)}); >= 50% of rep frames: ${visHalf} of ${n} (${pct(visHalf, n)})`,
      `- Counted joint span >= 70% of found-rep median: ${countedHasExcursion} of ${n} (${pct(countedHasExcursion, n)})`,
      `- Opposite side shows rep (span >= 70% of found median & vis >= 50%): ${otherSideHas} of ${n} (${pct(otherSideHas, n)}); when counted joint < 70%: ${rescuesWhenCountedWeak} of ${n - countedHasExcursion}`,
      `- Another angle joint in signalBank (elbow/shoulder/hip/knee/ankle/trunk) shows rep (relSpan >= 70% & zSpan >= 1.5): ${angleJointHas} of ${n} (${pct(angleJointHas, n)}); when counted joint < 70%: ${angleJointRescues} of ${n - countedHasExcursion}`,
      `- Any other signal in signalBank (psc.js, including wrist/hip/nose coords) shows rep (relSpan >= 70% & zSpan >= 1.5): ${bankHas} of ${n} (${pct(bankHas, n)}); when counted joint < 70%: ${bankRescuesWhenCountedWeak} of ${n - countedHasExcursion}`,
      `- Another signal in exercise signalProfile (bodyCheck.js) shows rep (relSpan >= 70%): ${profileHas} of ${n} (${pct(profileHas, n)})`,
      `- Failure mechanism on the counted joint:`,
      ...causes.map(([c, k]) => `  - \`${c}\`: ${k} of ${n} (${pct(k, n)})`),
      '',
    ];
  };

  const byLiftRows: string[] = [
    '| Exercise | Missed (all) | Missed (middle) | Vis >= 80% (mid) | Merged / no rest return (mid) | Shallow < work (mid) | Unseen < 50% (mid) | Flat < 35% (mid) | Dur/shift (mid) | Other side shows (mid) | Other angle joint shows (mid) |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  ];
  for (const lift of [...new Set(rc.missedAll.map(m => m.lift))].sort()) {
    const allL = rc.missedAll.filter(m => m.lift === lift);
    const midL = rcMid.filter(m => m.lift === lift);
    const n = midL.length;
    byLiftRows.push(
      `| ${lift} | ${allL.length} | ${n} | ${midL.filter(m => m.visShare >= 0.8).length} | ${midL.filter(m => m.cause === 'merged_no_rest_return').length} | ${midL.filter(m => m.cause === 'shallow_below_work_threshold').length} | ${midL.filter(m => m.cause === 'unseen_dropout').length} | ${midL.filter(m => m.cause === 'flat_no_excursion').length} | ${midL.filter(m => m.cause === 'duration_or_boundary_shift').length} | ${midL.filter(m => m.otherSideShowsRep).length} | ${midL.filter(m => m.otherAngleJointShowsRep).length} |`
    );
  }

  const mmMid = mm.gaps.filter(g => g.gapKind !== 'edge_shortfall');
  const mmCauses = countBy(mm.gaps, g => `${g.gapKind}:${g.cause}`);

  const lines: string[] = [
    '# Diagnosis of Missed Mid-Set Reps on RepCount-A and MM-Fit (HANDOFF.md Task T3, 25 October 2026)',
    '',
    '## 1. RepCount-A Build Half (Human Per-Rep Timestamps)',
    `- Evaluated build sets with a live counter: ${rc.setsCount} sets (${rc.countedSetsCount} counted, ${rc.setsCount - rc.countedSetsCount} refused by \`summarizeCount\`), ${rc.totalLabelledReps} human-marked reps.`,
    `- On counted deciding (non-press) sets: ${rcCountedDeciding.length} missed reps (**${rcCountedDecidingMid.length} in the middle of the set**, ${rcCountedDeciding.filter(m => m.position === 'first').length} first, ${rcCountedDeciding.filter(m => m.position === 'last').length} last).`,
    `- Across all 77 build sets (press and refused sets included): ${rc.foundReps} found (${pct(rc.foundReps, rc.totalLabelledReps)}), ${rc.missedAll.length} missed (${rcMid.length} middle).`,
    '',
    ...summarizeRepCountGroup('RepCount-A Counted Deciding Sets — Middle Missed Reps', rcCountedDecidingMid),
    ...summarizeRepCountGroup('RepCount-A Counted Deciding Sets — All Missed Reps', rcCountedDeciding),
    ...summarizeRepCountGroup('RepCount-A All Build Sets (Including Press & Refused) — Middle Missed Reps', rcMid),
    '### RepCount-A Middle Misses by Exercise (All Build Sets)',
    ...byLiftRows,
    '',
    '## 2. MM-Fit Build Half (Whole-Set Labels; Undercount Windows Analyzed)',
    `- Evaluated build sets: ${mm.totalSets} sets; core undercounts on ${mm.undercountedSets} sets (missing ${mm.totalMissingReps} reps total).`,
    `- Located undercount windows: ${mm.gaps.length} (${mmMid.length} mid-set gaps or overlong merged reps, ${mm.gaps.length - mmMid.length} edge shortfalls).`,
    `- Visibility >= 80% during window: ${mm.gaps.filter(g => g.visShare >= 0.8).length} of ${mm.gaps.length} (${pct(mm.gaps.filter(g => g.visShare >= 0.8).length, mm.gaps.length)}).`,
    `- Opposite side shows rep (>= 70% of found median): ${mm.gaps.filter(g => g.otherSideShowsRep).length} of ${mm.gaps.length} (${pct(mm.gaps.filter(g => g.otherSideShowsRep).length, mm.gaps.length)}).`,
    `- Another angle joint in \`signalBank\` shows rep (>= 70% of found median & zSpan >= 1.5): ${mm.gaps.filter(g => g.otherAngleJointShowsRep).length} of ${mm.gaps.length} (${pct(mm.gaps.filter(g => g.otherAngleJointShowsRep).length, mm.gaps.length)}).`,
    `- Any other signal in \`signalBank\` shows rep: ${mm.gaps.filter(g => g.bankOtherJointShowsRep).length} of ${mm.gaps.length} (${pct(mm.gaps.filter(g => g.bankOtherJointShowsRep).length, mm.gaps.length)}).`,
    `- Breakdown by window kind and cause:`,
    ...mmCauses.map(([c, k]) => `  - \`${c}\`: ${k} of ${mm.gaps.length} (${pct(k, mm.gaps.length)})`),
    '',
    '| MM-Fit Exercise | Undercount windows | Mid-set gap / merged | Edge shortfall | Vis >= 80% | Shallow < work | Merged / no rest | Flat < 15 deg | Other side shows | Other angle joint shows |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...[...new Set(mm.gaps.map(g => g.lift))].sort().map(lift => {
      const gs = mm.gaps.filter(g => g.lift === lift);
      return `| ${lift} | ${gs.length} | ${gs.filter(g => g.gapKind !== 'edge_shortfall').length} | ${gs.filter(g => g.gapKind === 'edge_shortfall').length} | ${gs.filter(g => g.visShare >= 0.8).length} | ${gs.filter(g => g.cause === 'shallow_below_work_threshold').length} | ${gs.filter(g => g.cause === 'merged_no_rest_return').length} | ${gs.filter(g => g.cause === 'flat_no_excursion').length} | ${gs.filter(g => g.otherSideShowsRep).length} | ${gs.filter(g => g.otherAngleJointShowsRep).length} |`;
    }),
    '',
    '## 3. Supplement: CFRep Build Half (Human Per-Rep Timestamps)',
    `- Evaluated build sets: ${cf.setsCount} sets, ${cf.totalLabelledReps} marked reps, ${cf.foundReps} found, ${cf.missedAll.length} missed (${cf.missedAll.filter(m => m.position === 'middle').length} middle).`,
    ...summarizeRepCountGroup('CFRep All Missed Reps', cf.missedAll),
    '## 4. Per-Rep Detail: Every Middle Missed Rep on RepCount-A (Counted Deciding Sets First)',
    '| Set | Lift | Rep | Window (s) | Rel dur | Vis | Counted span / med | Cause | Other side rel | Best angle joint (rel, zSpan) | Best profile signal (rel) |',
    '|---|---|---|---|---:|---:|---|---|---:|---|---|',
    ...[...rcCountedDecidingMid, ...rcMid.filter(m => m.setRefused || !m.deciding)].map(m =>
      `| ${m.id}${m.setRefused ? ' (refused)' : ''} | ${m.lift} | ${m.repIndex}/${m.totalReps} | ${m.window[0].toFixed(1)}-${m.window[1].toFixed(1)} | ${m.relDuration.toFixed(2)}x | ${Math.round(m.visShare * 100)}% | ${m.countedSpanDeg.toFixed(0)}°/${m.medianFoundSpanDeg.toFixed(0)}° (${m.relCountedSpan.toFixed(2)}x) | \`${m.cause}\` | ${m.relOtherSideSpan.toFixed(2)}x${m.otherSideShowsRep ? ' (YES)' : ''} | ${m.bestAngleJointName} (${m.bestAngleJointRelSpan.toFixed(2)}x, ${m.bestAngleJointZSpan.toFixed(1)}z) | ${m.bestProfileSignalName} (${m.bestProfileSignalRelSpan.toFixed(2)}x) |`
    ),
  ];

  writeFileSync(resolve(__dirname, 'midset-misses.txt'), lines.join('\n') + '\n');
  expect(rc.setsCount).toBeGreaterThan(0);
}, 60_000);
