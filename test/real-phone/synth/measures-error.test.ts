// Card 019 (cards/019-range-and-tempo-against-a-reference.md; docs/FLAWS-2026-11.md #13): the range and tempo the
// screens show under « Expérimental » held against a known truth, the 96 synthetic sets whose angles and phases are
// known because they are rendered (synth.txt, written by analyse.test.ts and checked by CI on every push). Per set,
// synth.txt gives the range error in degrees and the lifting and lowering time errors in seconds; this test reads them
// at the view the filming guide asks for and over all views, writes the median and 90th percentile of each to
// measures-error.txt, and fails unless measures.js states the guided-view figures beside MEASURES_SHOWN.
// Rendered bodies are not people: these figures bound the error in clean conditions; they validate nothing (R16).
import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const here = resolve(__dirname);
const synth = readFileSync(resolve(here, 'synth.txt'), 'utf8');
const measures = readFileSync(resolve(here, '../../../src/components/experience/measures.js'), 'utf8');
// The view the filming guide asks for (analyse.test.ts REC): front for the lateral raise and the press, side for the curl and the squat.
const GUIDED: Record<string, number> = { lateral_raise: 0, overhead_press: 0, bicep_curl: 90, squat: 90 };

type Row = { lift: string; view: number; rangeDeg: number; concSec: number; eccSec: number };
const rows: Row[] = [];
// Every set line of synth.txt; a set the app counted 0 has no measure ('-') and is listed apart.
const setLines = synth.split('\n').filter(l => /^\s+(michelle|soldier)-[a-z_]+-v\d+-a-?\d+\s/.test(l));
for (const line of setLines) {
  const m = line.match(/^\s+(michelle|soldier)-([a-z_]+)-v(\d+)-a-?\d+\s+\d+\s+\S+\s+(-?\d+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s/);
  if (m) rows.push({ lift: m[2], view: +m[3], rangeDeg: +m[4], concSec: +m[5], eccSec: +m[6] });
}
const q = (xs: number[], p: number) => { const a = [...xs].sort((x, y) => x - y); const i = (a.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return a[lo] + (a[hi] - a[lo]) * (i - lo); };
const stat = (xs: number[]) => ({ median: q(xs, 0.5), p90: q(xs, 0.9) });
const abs = (xs: number[]) => xs.map(Math.abs);
const guided = rows.filter(r => r.view === GUIDED[r.lift]);
const f = (x: number, d = 0) => x.toFixed(d);
export const FIGURES = {
  guided: { n: guided.length, range: stat(abs(guided.map(r => r.rangeDeg))), conc: stat(abs(guided.map(r => r.concSec))), ecc: stat(abs(guided.map(r => r.eccSec))) },
  all: { n: rows.length, range: stat(abs(rows.map(r => r.rangeDeg))), conc: stat(abs(rows.map(r => r.concSec))), ecc: stat(abs(rows.map(r => r.eccSec))) },
  signedGuided: { range: stat(guided.map(r => r.rangeDeg)), conc: stat(guided.map(r => r.concSec)), ecc: stat(guided.map(r => r.eccSec)) },
};
const G = FIGURES.guided;
// The sentence measures.js must hold: the guided-view median and 90th percentile of the absolute error.
export const STATED = `range ${f(G.range.median)} degrees at the median and ${f(G.range.p90)} at the 90th percentile; lifting time ${f(G.conc.median, 1)} s and ${f(G.conc.p90, 1)} s; lowering time ${f(G.ecc.median, 1)} s and ${f(G.ecc.p90, 1)} s`;

describe('card 019: range and tempo against the synthetic truth', () => {
  it('reads the 96 sets: 90 with a measure, all 24 at the guided view', () => {
    expect(setLines).toHaveLength(96);
    expect(rows).toHaveLength(90);
    expect(guided).toHaveLength(24);
    const A = FIGURES.all, S = FIGURES.signedGuided;
    writeFileSync(resolve(here, 'measures-error.txt'), [
      '# Card 019: absolute error of the shown measures against the rendered truth (measures-error.test.ts, from synth.txt)',
      `guided view, ${G.n} sets: ${STATED}`,
      `all views, ${A.n} sets with a measure (6 of 96 counted 0, none at the guided view): range ${f(A.range.median)} and ${f(A.range.p90)} degrees; lifting ${f(A.conc.median, 1)} and ${f(A.conc.p90, 1)} s; lowering ${f(A.ecc.median, 1)} and ${f(A.ecc.p90, 1)} s (median and 90th percentile)`,
      `guided view, signed medians: range ${f(S.range.median)} degrees, lifting ${f(S.conc.median, 1)} s, lowering ${f(S.ecc.median, 1)} s (negative: the app reads less than the truth)`,
      '',
    ].join('\n'));
  });

  it('measures.js states the guided-view error beside MEASURES_SHOWN', () => {
    expect(measures).toContain(STATED);
  });
});
