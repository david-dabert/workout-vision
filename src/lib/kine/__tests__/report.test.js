import { describe, expect, it } from 'vitest';
import { SAMPLE_HZ, compareCurves, referenceFromCurves } from '../../reference/compare.js';
import { isReport, reportOf, withCommentary } from '../report.js';
import { attemptTimeAt, reportMoments } from '../../../components/reference/attempt-export.js';

// The report the patient keeps of an attempt (report.js), its PDF (pdf.js attemptPdf) and the moments its still
// frames show (attempt-export.js), on a staged raise like Olivier's video 4.
function staged(top = 170) {
  const keys = [[0, 10], [3, 90], [5, 90], [8, top], [11, top], [14, 10]];
  const n = 14 * SAMPLE_HZ + 1;
  const shoulder = Array.from({ length: n }, (_, i) => {
    const t = i / SAMPLE_HZ, k = keys.findIndex(([kt]) => kt >= t);
    if (k <= 0) return keys[0][1];
    const [t0, v0] = keys[k - 1], [t1, v1] = keys[k];
    return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
  });
  return { rightShoulder: shoulder, rightElbow: shoulder.map(() => 172) };
}
const ref = referenceFromCurves(staged());
const context = { id: 'elevation-paliers', patient: 'Christophe', kine: 'Olivier', date: '2026-10-17T09:05', prog: 'abc' };

describe('the report of an attempt', () => {
  it('keeps the verdict, its reasons and each measure\'s figures, as the screens show them', () => {
    const r = reportOf(compareCurves(ref, staged(130)), context);
    expect(isReport(r)).toBe(true);
    expect(r).toMatchObject({ id: 'elevation-paliers', patient: 'Christophe', kine: 'Olivier', verdict: 'revise' });
    expect(r.reasons).toContain('range:rightShoulder');
    const sh = r.joints.find(j => j.name === 'rightShoulder');
    expect(sh.range).toBeLessThan(0.85);
    expect(sh.worst.ref - sh.worst.att).toBeGreaterThan(30);
    expect(r.holds.length).toBeGreaterThan(0);
    expect(r.judged).toBe(1);
    // Small enough to keep every attempt on the phone: figures only.
    expect(JSON.stringify(r).length).toBeLessThan(2000);
  });

  it('says on what share of the movement the verdict rests when the attempt lost part of it (R8)', () => {
    const lost = staged();
    for (const name of Object.keys(lost)) lost[name] = lost[name].map((v, i) => (i % 20 >= 13 ? null : v));
    const r = reportOf(compareCurves(ref, lost), context);
    expect(r.judged).toBeGreaterThan(0.5);
    expect(r.judged).toBeLessThan(0.8);
  });

  it('counts as not judged the moments the reference itself does not show (R8, review of 17 October)', () => {
    // Olivier's pose lost on a seventh of his video; the attempt seen throughout: the verdict rests on six sevenths.
    const c = staged();
    const partRef = referenceFromCurves({ ...c, rightShoulder: c.rightShoulder.map((v, i) => (i % 7 === 0 ? null : v)) });
    const r = reportOf(compareCurves(partRef, staged()), context);
    expect(r.judged).toBeLessThan(0.9);
  });

  it('keeps a refused attempt with its reasons and no figures it did not measure', () => {
    const hidden = staged();
    hidden.rightShoulder = hidden.rightShoulder.map(() => null);
    const r = reportOf(compareCurves(ref, hidden), context);
    expect(r).toMatchObject({ verdict: 'refused', judged: null, tempo: null, joints: [] });
    expect(r.reasons).toContain('unseen:rightShoulder');
  });

  it('is not taken for a report when it is something else', () => {
    expect(isReport(null)).toBe(false);
    expect(isReport({ id: 'x', verdict: 'match' })).toBe(false);
    expect(isReport({ v: 1, id: 'x', verdict: 'maybe', joints: [], holds: [] })).toBe(false);
  });
});

describe('the still frames of the report', () => {
  it('shows the end of the movement and the largest gap, at distinct moments both videos show', () => {
    const result = compareCurves(ref, staged(140));
    const moments = reportMoments(result);
    expect(moments.length).toBeGreaterThan(0);
    expect(moments.length).toBeLessThanOrEqual(3);
    expect(moments.map(m => m.kind)).toContain('end');
    for (const m of moments) expect(result.seen[m.k][m.ri]).toBe(true);
    for (const a of moments) for (const b of moments) if (a !== b) expect(Math.abs(a.ri - b.ri)).toBeGreaterThanOrEqual(SAMPLE_HZ);
    // The end of the movement: the reference's furthest point, the top of the raise.
    const end = moments.find(m => m.kind === 'end');
    expect(result.reference[end.k][end.ri]).toBeGreaterThan(160);
  });

  it('shows none for a refused attempt', () => {
    expect(reportMoments({ verdict: 'refused', joints: [], seen: [], reference: [] })).toEqual([]);
  });

  it('finds the time of an attempt sample on its video\'s clock', () => {
    expect(attemptTimeAt(12, { attT0: 2 })).toBeCloseTo(2 + 12 / SAMPLE_HZ);
  });

  it('shows in each still a sample the attempt shows, captioned with its own value', () => {
    const lost = staged(150);
    for (const name of Object.keys(lost)) lost[name] = lost[name].map((v, i) => (i % 20 >= 13 ? null : v));
    const result = compareCurves(ref, lost);
    const moments = reportMoments(result);
    expect(moments.length).toBeGreaterThan(0);
    for (const m of moments) {
      expect(result.attSeen[m.k][m.ai]).toBe(true);
      expect(m.att).toBe(result.attempt[m.k][m.ai]);
    }
  });
});

describe('the report as a PDF', () => {
  it('prints the report with its still frames, and again later without them', async () => {
    const { attemptPdf } = await import('../pdf.js');
    const report = reportOf(compareCurves(ref, staged(130)), context);
    // A 2 x 2 grey JPEG.
    const jpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAACAAIBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const withStills = attemptPdf(report, { lang: 'fr', stills: [{ data: jpeg, w: 2, h: 2, caption: 'Fin du mouvement' }] });
    expect(withStills.getNumberOfPages()).toBeGreaterThan(0);
    expect(withStills.output()).toContain('/Subtype /Image');
    const later = attemptPdf(report, { lang: 'en' });
    expect(later.getNumberOfPages()).toBeGreaterThan(0);
    expect(later.output()).not.toContain('/Subtype /Image');
  });

  it('prints the AI commentary when the patient asked for it, and the report stays a report', async () => {
    const { attemptPdf } = await import('../pdf.js');
    const ai = { visible: true, sameExercise: 'yes', reps: 4, holds: [{ rep: 1, seconds: 4.5 }], compensations: ['Les épaules montent.'], setup: [], camera: [], advice: ['Gardez les épaules basses.'], summary: 'Quatre répétitions.' };
    const report = withCommentary(reportOf(compareCurves(ref, staged(130)), context), ai);
    expect(isReport(report)).toBe(true);
    const plain = attemptPdf(reportOf(compareCurves(ref, staged(130)), context), { lang: 'fr' });
    const with_ = attemptPdf(report, { lang: 'fr' });
    expect(with_.output().length).toBeGreaterThan(plain.output().length);
  });

  it('prints a refused attempt\'s report', async () => {
    const { attemptPdf } = await import('../pdf.js');
    const hidden = staged();
    hidden.rightShoulder = hidden.rightShoulder.map(() => null);
    expect(attemptPdf(reportOf(compareCurves(ref, hidden), context), { lang: 'fr' }).getNumberOfPages()).toBe(1);
  });
});
