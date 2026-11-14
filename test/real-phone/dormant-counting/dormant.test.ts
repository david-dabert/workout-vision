// Card 026: Reproducible benchmark of the four dormant counting and pose-preprocessing modules flagged in
// docs/AUDIT-2026-11.md lines 91 and 98 (recurrenceSegmenter.ts, kinematicOcclusionInpainter.ts,
// perspectiveInvariance.js, groundPlaneCorrection.ts).
//
// Full corpus evaluation (writes test/real-phone/dormant-counting/dormant.txt):
//   DORMANT=1 npx vitest run --no-cache test/real-phone/dormant-counting/dormant.test.ts
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { runUniversalRecurrenceSegmenter } from '../../../src/lib/counting/recurrenceSegmenter';
import { KinematicOcclusionInpainter } from '../../../src/lib/kinematicOcclusionInpainter';
import { rectifySequence } from '../../../src/lib/perspectiveInvariance.js';
import { GroundPlanePitchCorrector } from '../../../src/lib/groundPlaneCorrection';
import { countInWindow, labelledSets, publicSets, videoSets } from '../accuracy/sets';

const gz = (f: string) => JSON.parse(gunzipSync(readFileSync(f)).toString());
const half = (name: string) =>
  parseInt(createHash('sha256').update('variant:' + name.split('/').pop()!.slice(0, 11)).digest('hex')[0], 16) < 8
    ? 'publicA'
    : 'publicB';

type Row = { count: number | 'refused'; label: number };

function tally(rows: Row[]) {
  let n = 0;
  let exact = 0;
  let near = 0;
  let bad = 0;
  let refused = 0;
  for (const r of rows) {
    n++;
    if (r.count === 'refused') {
      refused++;
      bad++;
      continue;
    }
    const d = Math.abs(r.count - r.label);
    if (d === 0) exact++;
    else if (d <= 2) near++;
    else bad++;
  }
  return { n, exact, near, bad, refused };
}

function getCount(res: any, win?: [number, number]): number | 'refused' {
  if (res.refused) return 'refused';
  return win ? countInWindow(res.reps, win) : res.count;
}

function fmtTally(name: string, t: ReturnType<typeof tally>) {
  const pct = t.n ? Math.round((1000 * t.exact) / t.n) / 10 : 0;
  return `  ${name.padEnd(14)} exact ${String(t.exact).padStart(4)}/${String(t.n).padEnd(4)} (${String(pct).padStart(5)}%) | near ${String(t.near).padStart(3)} | 3+ or refused ${String(t.bad).padStart(3)} (refused ${t.refused})`;
}

describe('Card 026: dormant counting and pose modules benchmark', () => {
  it.skipIf(!process.env.DORMANT)('evaluates all four dormant modules across suites and writes dormant.txt', () => {
    const sets: { name: string; suite: string; lift: string; wl: any[]; ts: number[]; label: number; win?: [number, number] }[] = [];
    for (const s of labelledSets().sets as any[]) {
      sets.push({ name: s.name, suite: 'david', lift: s.lift, wl: s.wl, ts: s.ts, label: s.label });
    }
    for (const s of videoSets().sets as any[]) {
      if (!s.appRefused) sets.push({ name: s.name, suite: 'video', lift: s.lift, wl: s.wl, ts: s.ts, label: s.label });
    }
    for (const [suite, dir] of [['synthetic', '../synth/sets'], ['occlusion', '../occlusion/sets']] as const) {
      const D = resolve(__dirname, dir);
      for (const f of readdirSync(D).filter(x => x.endsWith('.json.gz')).sort()) {
        const r = gz(resolve(D, f));
        const lift = suite === 'synthetic' ? r.params?.exercise ?? r.lift : r.params.lift ?? r.params.exercise;
        sets.push({ name: `${suite}/${f}`, suite, lift, wl: r.worldLandmarks, ts: r.timestamps, label: r.reps.length });
      }
    }
    for (const s of publicSets('build').sets as any[]) {
      sets.push({ name: s.name, suite: half(s.name), lift: s.lift, wl: s.wl, ts: s.ts, label: s.label, win: s.window });
    }

    const lines: string[] = [
      '# Card 026: Dormant counting and pose-preprocessing modules against labelled sets',
      '# Modules (unmodified exports): recurrenceSegmenter, kinematicOcclusionInpainter, perspectiveInvariance, groundPlaneCorrection',
      '# Suites: david (20), video (16 counted), synthetic (96), occlusion (68), publicA (546), publicB (518); zero parameter tuning.',
      '',
    ];

    const suites = ['david', 'video', 'synthetic', 'occlusion', 'publicA', 'publicB'];
    const totals: Record<string, Row[]> = { base: [], rec: [], inp: [], persp: [], gp: [] };

    for (const suite of suites) {
      const sub = sets.filter(s => s.suite === suite);
      const baseRows: Row[] = [];
      const recRows: Row[] = [];
      const inpRows: Row[] = [];
      const perspRows: Row[] = [];
      const gpRows: Row[] = [];

      for (const s of sub) {
        baseRows.push({ count: getCount(summarizeCount(s.wl, s.ts, s.lift), s.win), label: s.label });

        try {
          const validWl = s.wl.filter((f: any) => Array.isArray(f) && f.length >= 33);
          if (validWl.length < 15) {
            recRows.push({ count: 'refused', label: s.label });
          } else {
            const rr = runUniversalRecurrenceSegmenter(s.wl, s.ts);
            const cnt = s.win
              ? rr.reps.filter((r: any) => r.endTime >= s.win![0] && r.startTime <= s.win![1]).length
              : rr.reps.length;
            recRows.push({ count: cnt, label: s.label });
          }
        } catch {
          recRows.push({ count: 'refused', label: s.label });
        }

        const inp = new KinematicOcclusionInpainter();
        const validFrames = s.wl.filter((f: any) => Array.isArray(f) && f.length >= 33);
        const cal = inp.calibrateFromStanding(validFrames);
        let wlInp = s.wl;
        if (cal) {
          wlInp = s.wl.map((f: any, idx: number) =>
            f && f.length >= 33 ? inp.processFrame(f, (s.ts[idx] ?? idx / 15) * 1000).landmarks : f
          );
        }
        inpRows.push({ count: getCount(summarizeCount(wlInp, s.ts, s.lift), s.win), label: s.label });

        const wlPersp = rectifySequence(s.wl)?.rectifiedSequence ?? s.wl;
        perspRows.push({ count: getCount(summarizeCount(wlPersp, s.ts, s.lift), s.win), label: s.label });

        const gp = new GroundPlanePitchCorrector();
        const wlGp = s.wl.map((f: any) => {
          if (!f || f.length < 33) return f;
          gp.updateFromPose(f);
          return gp.rectify(f);
        });
        gpRows.push({ count: getCount(summarizeCount(wlGp, s.ts, s.lift), s.win), label: s.label });
      }

      if (suite === 'publicA' || suite === 'publicB') {
        totals.base.push(...baseRows);
        totals.rec.push(...recRows);
        totals.inp.push(...inpRows);
        totals.persp.push(...perspRows);
        totals.gp.push(...gpRows);
      }

      lines.push(`Suite: ${suite} (${sub.length} sets)`);
      lines.push(fmtTally('baseline', tally(baseRows)));
      lines.push(fmtTally('recurrence', tally(recRows)));
      lines.push(fmtTally('inpainter', tally(inpRows)));
      lines.push(fmtTally('perspective', tally(perspRows)));
      lines.push(fmtTally('groundPlane', tally(gpRows)));
      lines.push('');
    }

    lines.push(`Combined public build half (${totals.base.length} sets)`);
    lines.push(fmtTally('baseline', tally(totals.base)));
    lines.push(fmtTally('recurrence', tally(totals.rec)));
    lines.push(fmtTally('inpainter', tally(totals.inp)));
    lines.push(fmtTally('perspective', tally(totals.persp)));
    lines.push(fmtTally('groundPlane', tally(totals.gp)));
    lines.push('');

    writeFileSync(resolve(__dirname, 'dormant.txt'), lines.join('\n'));
    expect(totals.base.length).toBe(1064);
  }, 120_000);

  it('runs all four dormant modules cleanly on a real-phone fixture and verifies dormant.txt exists', () => {
    const fixture = gz(resolve(__dirname, '../landmarks/bicep_curl_7_side_mufhf3wy.json.gz'));
    const base = summarizeCount(fixture.worldLandmarks, fixture.timestamps, 'bicep_curl');
    const rec = runUniversalRecurrenceSegmenter(fixture.worldLandmarks, fixture.timestamps);
    const inp = new KinematicOcclusionInpainter();
    const valid = fixture.worldLandmarks.filter((f: any) => Array.isArray(f) && f.length >= 33);
    inp.calibrateFromStanding(valid);
    const wlInp = fixture.worldLandmarks.map((f: any, idx: number) =>
      f && f.length >= 33 ? inp.processFrame(f, (fixture.timestamps[idx] ?? idx / 15) * 1000).landmarks : f
    );
    const persp = rectifySequence(fixture.worldLandmarks)?.rectifiedSequence ?? fixture.worldLandmarks;
    const gp = new GroundPlanePitchCorrector();
    const wlGp = fixture.worldLandmarks.map((f: any) => {
      if (!f || f.length < 33) return f;
      gp.updateFromPose(f);
      return gp.rectify(f);
    });

    expect(base.count).toBe(7);
    expect(rec.reps.length).toBeGreaterThanOrEqual(6);
    expect(summarizeCount(wlInp, fixture.timestamps, 'bicep_curl').count).toBe(7);
    expect(summarizeCount(persp, fixture.timestamps, 'bicep_curl').count).toBe(7);
    expect(summarizeCount(wlGp, fixture.timestamps, 'bicep_curl').count).toBe(7);

    const record = readFileSync(resolve(__dirname, 'dormant.txt'), 'utf8');
    expect(record).toContain('Card 026');
    expect(record).toContain('recurrenceSegmenter');
    expect(record).toContain('kinematicOcclusionInpainter');
    expect(record).toContain('perspectiveInvariance');
    expect(record).toContain('groundPlaneCorrection');
  });
});
