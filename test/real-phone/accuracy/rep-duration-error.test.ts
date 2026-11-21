// Card 051 (cards/051-measurement-references-lab.md): Eval (1) Rep duration against RepCount-A build boundaries.
// RepCount-A's build half holds human rep boundaries used only for diagnosis (match-reps.ts).
// This bench measures the rep duration error of the counter's matched reps against human-labelled rep boundaries.
// Thresholds written in card 051 before the run: proposed 0.15 s (median) and 0.3 s (90th percentile), UNSOURCED.
import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { countReps } from '../../../src/lib/counting/core';
import { benchSets } from './sets';

export type Span = [number, number];

const overlap = ([a, b]: Span, [c, d]: Span) => Math.max(0, Math.min(b, d) - Math.max(a, c));

export function matchRepDurations(labelled: Span[], counted: Span[]) {
  const taken = new Set<number>();
  const found = labelled.map(() => false);
  const pairs = labelled.flatMap((l, i) => counted.map((c, j) => ({ i, j, o: overlap(l, c) })))
    .filter(p => p.o >= 0.5 * (labelled[p.i][1] - labelled[p.i][0]))
    .sort((a, b) => b.o - a.o);

  const matched: { labelledSpan: Span; countedSpan: Span; lDur: number; cDur: number; absErr: number; signedErr: number }[] = [];

  for (const { i, j } of pairs) {
    if (!found[i] && !taken.has(j)) {
      found[i] = true;
      taken.add(j);
      const lDur = labelled[i][1] - labelled[i][0];
      const cDur = counted[j][1] - counted[j][0];
      matched.push({
        labelledSpan: labelled[i],
        countedSpan: counted[j],
        lDur,
        cDur,
        absErr: Math.abs(cDur - lDur),
        signedErr: cDur - lDur,
      });
    }
  }

  return {
    matched,
    totalLabelled: labelled.length,
    totalCounted: counted.length,
    foundCount: matched.length,
  };
}

const quantile = (xs: number[], p: number) => {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y);
  const i = (a.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return a[lo] + (a[hi] - a[lo]) * (i - lo);
};

export const PROPOSED_THRESHOLDS = {
  medianSec: 0.15,
  p90Sec: 0.30,
};

describe('Card 051: rep duration against RepCount-A build boundaries', () => {
  it('measures median and 90th percentile duration error across RepCount-A build sets', () => {
    const { sets } = benchSets('repcount', 'build');
    const mapped = sets.filter(s => s.lift !== null);

    const allMatched: { lift: string; lDur: number; cDur: number; absErr: number; signedErr: number }[] = [];
    const perLift = new Map<string, number[]>();

    for (const s of mapped) {
      if (!s.reps.length) continue;
      const r = countReps(s.wl, s.ts, s.lift!);
      const countedSpans = r.reps.map(p => [p.startTime, p.endTime] as Span);
      const { matched } = matchRepDurations(s.reps, countedSpans);

      for (const m of matched) {
        allMatched.push({ lift: s.lift!, ...m });
        const list = perLift.get(s.lift!) ?? [];
        list.push(m.absErr);
        perLift.set(s.lift!, list);
      }
    }

    expect(allMatched.length).toBeGreaterThan(0);

    const absErrors = allMatched.map(m => m.absErr);
    const signedErrors = allMatched.map(m => m.signedErr);

    const medianAbs = quantile(absErrors, 0.5);
    const p90Abs = quantile(absErrors, 0.9);
    const medianSigned = quantile(signedErrors, 0.5);

    const passMedian = medianAbs <= PROPOSED_THRESHOLDS.medianSec;
    const passP90 = p90Abs <= PROPOSED_THRESHOLDS.p90Sec;
    const verdict = passMedian && passP90 ? 'PASS' : 'FAIL';

    const lines: string[] = [
      '# Card 051: Rep duration against RepCount-A build boundaries',
      `Date: ${new Date().toISOString().slice(0, 10)}`,
      `Sets read: ${mapped.length} mapped build sets (of ${sets.length} RepCount-A build sets)`,
      `Matched reps: ${allMatched.length}`,
      '',
      '## Thresholds (proposed in Card 051, UNSOURCED)',
      `- Proposed median threshold: <= ${PROPOSED_THRESHOLDS.medianSec} s`,
      `- Proposed 90th percentile threshold: <= ${PROPOSED_THRESHOLDS.p90Sec} s`,
      '',
      '## Overall Results',
      `- Median absolute error: ${medianAbs.toFixed(3)} s (${passMedian ? 'PASS' : 'FAIL'})`,
      `- 90th percentile absolute error: ${p90Abs.toFixed(3)} s (${passP90 ? 'PASS' : 'FAIL'})`,
      `- Signed median error: ${medianSigned.toFixed(3)} s (${medianSigned < 0 ? 'app under-measures rep duration' : 'app over-measures rep duration'})`,
      `- Verdict against proposed thresholds: ${verdict}`,
      '',
      '## Breakdown per Exercise (Median & p90 absolute error)',
    ];

    for (const [lift, errs] of [...perLift.entries()].sort()) {
      const med = quantile(errs, 0.5);
      const p90 = quantile(errs, 0.9);
      lines.push(`- ${lift} (${errs.length} matched reps): median ${med.toFixed(3)} s, 90th percentile ${p90.toFixed(3)} s`);
    }

    lines.push('');
    const text = lines.join('\n');
    writeFileSync(resolve(__dirname, 'rep-duration-error.txt'), text);
    console.log(text);

    // Documented stop condition: "Stop: when both are measured, pass or fail."
    expect(Number.isFinite(medianAbs)).toBe(true);
    expect(Number.isFinite(p90Abs)).toBe(true);
  });
});
