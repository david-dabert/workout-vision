// LIFT_DIR=<run.mjs output of library.mjs's matrix for prone_y_raise> npx vitest run --no-cache test/real-phone/synth/motions/lift-angle.test.ts
// The prone Y raise counted on the shoulder read as the arm's lift against gravity (core.ts, LiftDefinition.lift; 8
// October 2026), on rendered sets whose reps are known exactly: per set, the samples the pose model found; for each
// side, three signals with their range (10th to 90th percentile, degrees) and their correlation with the rendered
// progress through the reps: the shoulder's angle in the image plane signed from the trunk's line (the first form,
// dropped), the lift to the elbow, the lift to the wrist (the app's), the three-point angle in space; and the app's result (coreAnalysis.js:
// summarizeCount, then withProposal on a refusal) against the reps rendered. Bench only: no gate.
import { expect, test } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { summarizeCount, withBodyCheck, withProposal } from '../../../../src/lib/coreAnalysis';
import { liftDefinition, sideAngles } from '../../../../src/lib/counting/core';

const DIR = process.env.LIFT_DIR, KEY = process.env.LIFT_KEY ?? 'prone_y_raise';
// The rendered progress through each rep (0 at rest, 1 at the working end), from the set's rep times: rising from
// start to top, held to hold, back to 0 at end.
const progress = (reps: { start: number; top: number; hold: number; end: number }[], ts: number[]) => ts.map(t => {
  const r = reps.find(x => t >= x.start && t <= x.end);
  if (!r) return 0;
  return t <= r.top ? (t - r.start) / (r.top - r.start) : t <= r.hold ? 1 : 1 - (t - r.hold) / (r.end - r.hold);
});
const corr = (a: (number | null)[], b: number[]) => {
  const xs: number[] = [], ys: number[] = [];
  a.forEach((x, i) => { if (x !== null && Number.isFinite(x)) { xs.push(x); ys.push(b[i]); } });
  if (xs.length < 10) return NaN;
  const mx = xs.reduce((s, v) => s + v, 0) / xs.length, my = ys.reduce((s, v) => s + v, 0) / ys.length;
  let sxy = 0, sxx = 0, syy = 0;
  xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; syy += (ys[i] - my) ** 2; });
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
};
// A segment's lift against gravity, in degrees: the line from the shoulder above the horizontal (world y down).
const VIS = 0.5;
const elevation = (wl: any[] | null, sh: number, wr: number) => {
  if (!wl || (wl[sh]?.visibility ?? 0) < VIS || (wl[wr]?.visibility ?? 0) < VIS) return null;
  const ex = wl[wr].x - wl[sh].x, ey = wl[wr].y - wl[sh].y, ez = wl[wr].z - wl[sh].z;
  return Math.atan2(-ey, Math.hypot(ex, ez)) * 180 / Math.PI;
};
// The first form, dropped: the shoulder in the image plane (x, y), 180 plus the angle from the trunk's line, extended
// past the shoulder, to the upper arm, positive above that line.
const signedSide = (wl: any[] | null, hip: number, sh: number, el: number) => {
  if (!wl || [hip, sh, el].some(i => (wl[i]?.visibility ?? 0) < VIS)) return null;
  const dx = wl[sh].x - wl[hip].x, dy = wl[sh].y - wl[hip].y, ex = wl[el].x - wl[sh].x, ey = wl[el].y - wl[sh].y;
  const [nx, ny] = dx > 0 ? [dy, -dx] : [-dy, dx];
  return 180 + Math.atan2(ex * nx + ey * ny, ex * dx + ey * dy) * 180 / Math.PI;
};
const range = (xs: (number | null)[]) => {
  const v = xs.filter((a): a is number => a !== null).sort((a, b) => a - b);
  return v.length < 3 ? NaN : v[Math.floor(v.length * 0.9)] - v[Math.floor(v.length * 0.1)];
};

test.skipIf(!DIR)('the shoulder read as the arm\'s lift on rendered prone Y raises', () => {
  const def = liftDefinition(KEY)!;
  expect(def.lift).toBe(true);
  const files = readdirSync(DIR!).filter(f => f.endsWith('.json.gz')).sort();
  const rows: string[] = [];
  let exact = 0, within1 = 0, off3 = 0, seen = 0, shownWrong = 0;
  for (const f of files) {
    const r = JSON.parse(gunzipSync(readFileSync(resolve(DIR!, f))).toString());
    const truth: number = r.reps.length, n = r.worldLandmarks.length, found = r.worldLandmarks.filter(Boolean).length;
    // As the app reads a recorded set (coreAnalysis.js analyzeCoreVideo): the body check after the proposal.
    const res = withBodyCheck(withProposal({ ...summarizeCount(r.worldLandmarks, r.timestamps, KEY), worldLandmarks: r.worldLandmarks, timestamps: r.timestamps }, KEY), KEY);
    const asked = !res.refused && (res.count === 0 || res.bodyCheck?.flagged === true);
    const u = progress(r.reps, r.timestamps);
    const ranges = (['left', 'right'] as const).map(arm => {
      const [hip, sh, el] = arm === 'left' ? [23, 11, 13] : [24, 12, 14];
      const signed = r.worldLandmarks.map((wl: any[] | null) => signedSide(wl, hip, sh, el));
      const lift = sideAngles(r.worldLandmarks, r.timestamps, def, arm).smoothed;
      const elbow = r.worldLandmarks.map((wl: any[] | null) => elevation(wl, sh, el));
      const space = sideAngles(r.worldLandmarks, r.timestamps, { ...def, lift: false }, arm).smoothed;
      const cell = (x: (number | null)[]) => `${range(x).toFixed(0)} (${corr(x, u).toFixed(2)})`;
      return `${arm[0].toUpperCase()} ${cell(signed)} / ${cell(elbow)} / ${cell(lift)} / ${cell(space)}`;
    });
    const count = res.refused ? null : res.count;
    if (found > n / 2) seen++;
    if (count === truth) exact++;
    if (count !== null && Math.abs(count - truth) <= 1) within1++;
    if (count === null || Math.abs(count - truth) >= 3) off3++;
    // A count shown as the app's own (Result.jsx: neither refused, nor 0, nor flagged by the body check) and off by 3 or more.
    if (count !== null && !asked && Math.abs(count - truth) >= 3) shownWrong++;
    rows.push(`| ${f.replace('.json.gz', '')} | ${r.params.model}${r.params.landscape ? ', landscape' : ''} | ${r.params.view} | ${found}/${n} | ${ranges.join(', ')} | ${truth} | ${count === null ? `refused${res.proposal ? ` (PSC ${res.proposal.count})` : ''}` : `${count}${asked ? ', to confirm' : ''}`}${res.bodyCheck ? ` (body check ${res.bodyCheck.agreement?.toFixed?.(2) ?? '?'})` : ''} |`);
  }
  const lines = [
    `${KEY}, shoulder read as the arm's lift: ${files.length} rendered sets, ${seen} seen on over half their frames; exact ${exact}, within 1 ${within1}, off by 3 or more or refused ${off3}; shown as the app's count and off by 3 or more: ${shownWrong}.`,
    '',
    '| Set | Body | View | Pose found | Range in degrees (10th-90th) and correlation with the rendered rep: signed from the trunk / lift to the elbow / lift to the wrist (the app, smoothed) / in space | Reps | App |',
    '|---|---|---:|---:|---|---:|---|',
    ...rows,
  ];
  process.stdout.write(lines.join('\n') + '\n');
  expect(files.length).toBeGreaterThan(0);
}, 600_000);
