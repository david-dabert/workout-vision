// Card 051 (cards/051-measurement-references-lab.md): Eval (2) 2D angle against synthetic truth at the guided view, per lift.
// Synthetic renderer stores landmarks against exact skeleton joint truth (truthAngles in synth.js).
// This bench measures the error between the projected 2D joint angle at the guided filming view and the true joint angle.
// Thresholds written in card 051 before the run: proposed 5 degrees (median) and 10 degrees (90th percentile), UNSOURCED.
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { JOINT_POINTS } from '../../../src/lib/counting/core';

const DIR = resolve(__dirname, 'sets');
const GUIDED: Record<string, number> = { lateral_raise: 0, overhead_press: 0, bicep_curl: 90, squat: 90 };
const JOINT: Record<string, 'shoulder' | 'elbow' | 'knee'> = {
  lateral_raise: 'shoulder',
  bicep_curl: 'elbow',
  overhead_press: 'elbow',
  squat: 'knee',
};

// 2D angle in plane (u, v): for front view (view 0), camera looks down +Z, so image plane is (X, Y).
// For side view (view 90), camera looks down +X, so image plane is (Z, Y).
function angle2D(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  c: { x: number; y: number; z: number },
  plane: 'xy' | 'zy'
): number {
  const [u1, v1] = plane === 'xy' ? [a.x - b.x, a.y - b.y] : [a.z - b.z, a.y - b.y];
  const [u2, v2] = plane === 'xy' ? [c.x - b.x, c.y - b.y] : [c.z - b.z, c.y - b.y];
  const d1 = Math.hypot(u1, v1), d2 = Math.hypot(u2, v2);
  if (d1 < 1e-6 || d2 < 1e-6) return 0;
  const dot = (u1 * u2 + v1 * v2) / (d1 * d2);
  return Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
}

const quantile = (xs: number[], p: number) => {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y);
  const i = (a.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return a[lo] + (a[hi] - a[lo]) * (i - lo);
};

export const PROPOSED_ANGLE_THRESHOLDS = {
  medianDeg: 5,
  p90Deg: 10,
};

describe('Card 051: 2D joint angle against synthetic truth at guided view', () => {
  it('measures 2D angle error against synthetic truth per lift at guided view', () => {
    expect(existsSync(DIR)).toBe(true);
    const files = readdirSync(DIR).filter(f => f.endsWith('.json.gz')).sort();

    const perLift: Record<string, { absErrors: number[]; signedErrors: number[]; setsCount: number; framesCount: number }> = {
      lateral_raise: { absErrors: [], signedErrors: [], setsCount: 0, framesCount: 0 },
      overhead_press: { absErrors: [], signedErrors: [], setsCount: 0, framesCount: 0 },
      bicep_curl: { absErrors: [], signedErrors: [], setsCount: 0, framesCount: 0 },
      squat: { absErrors: [], signedErrors: [], setsCount: 0, framesCount: 0 },
    };

    let totalGuidedSets = 0;

    for (const f of files) {
      const d = JSON.parse(gunzipSync(readFileSync(resolve(DIR, f))).toString());
      const lift = d.params.exercise;
      if (!GUIDED[lift] && GUIDED[lift] !== 0) continue;
      if (d.params.view !== GUIDED[lift]) continue;

      totalGuidedSets++;
      perLift[lift].setsCount++;

      const joint = JOINT[lift];
      const plane: 'xy' | 'zy' = GUIDED[lift] === 0 ? 'xy' : 'zy';
      // Side evaluated: for lateral raise and overhead press (front view), evaluate left arm;
      // for bicep curl and squat (view 90), the body left side faces camera.
      const side = 'left';
      const [ia, ib, ic] = JOINT_POINTS[joint][side];

      for (let i = 0; i < d.timestamps.length; i++) {
        const wl = d.worldLandmarks[i];
        if (!wl || !wl[ia] || !wl[ib] || !wl[ic]) continue;
        const a2d = angle2D(wl[ia], wl[ib], wl[ic], plane);
        const truthAng = d.truth[i]?.[joint]?.[side];
        if (typeof truthAng !== 'number') continue;

        const err = a2d - truthAng;
        perLift[lift].absErrors.push(Math.abs(err));
        perLift[lift].signedErrors.push(err);
        perLift[lift].framesCount++;
      }
    }

    expect(totalGuidedSets).toBe(24);

    const allAbsErrors = Object.values(perLift).flatMap(p => p.absErrors);
    const allSignedErrors = Object.values(perLift).flatMap(p => p.signedErrors);

    const overallMedian = quantile(allAbsErrors, 0.5);
    const overallP90 = quantile(allAbsErrors, 0.9);
    const overallSignedMedian = quantile(allSignedErrors, 0.5);

    const passMedian = overallMedian <= PROPOSED_ANGLE_THRESHOLDS.medianDeg;
    const passP90 = overallP90 <= PROPOSED_ANGLE_THRESHOLDS.p90Deg;
    const overallVerdict = passMedian && passP90 ? 'PASS' : 'FAIL';

    const lines: string[] = [
      '# Card 051: 2D joint angle against synthetic truth at guided view',
      `Date: ${new Date().toISOString().slice(0, 10)}`,
      `Sets read: ${totalGuidedSets} synthetic sets at guided filming views (24 sets: 6 per lift)`,
      `Total evaluated frames: ${allAbsErrors.length}`,
      '',
      '## Thresholds (proposed in Card 051, UNSOURCED)',
      `- Proposed median threshold: <= ${PROPOSED_ANGLE_THRESHOLDS.medianDeg} degrees`,
      `- Proposed 90th percentile threshold: <= ${PROPOSED_ANGLE_THRESHOLDS.p90Deg} degrees`,
      '',
      '## Overall Results across Guided Views',
      `- Median absolute error: ${overallMedian.toFixed(1)} degrees (${passMedian ? 'PASS' : 'FAIL'})`,
      `- 90th percentile absolute error: ${overallP90.toFixed(1)} degrees (${passP90 ? 'PASS' : 'FAIL'})`,
      `- Signed median error: ${overallSignedMedian.toFixed(1)} degrees`,
      `- Overall verdict against proposed thresholds: ${overallVerdict}`,
      '',
      '## Per-Lift Results at Guided View',
    ];

    for (const [lift, data] of Object.entries(perLift)) {
      const med = quantile(data.absErrors, 0.5);
      const p90 = quantile(data.absErrors, 0.9);
      const signedMed = quantile(data.signedErrors, 0.5);
      const liftPass = med <= PROPOSED_ANGLE_THRESHOLDS.medianDeg && p90 <= PROPOSED_ANGLE_THRESHOLDS.p90Deg;
      lines.push(
        `- ${lift} (view ${GUIDED[lift]}°, ${data.setsCount} sets, ${data.framesCount} frames): median ${med.toFixed(1)}°, p90 ${p90.toFixed(1)}°, signed median ${signedMed.toFixed(1)}° (${liftPass ? 'PASS' : 'FAIL'})`
      );
    }

    lines.push('');
    const text = lines.join('\n');
    writeFileSync(resolve(__dirname, 'angle-2d-error.txt'), text);
    console.log(text);

    // Stop condition: "Stop: when both are measured, pass or fail."
    expect(Number.isFinite(overallMedian)).toBe(true);
    expect(Number.isFinite(overallP90)).toBe(true);
  });
});
