import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import { SAMPLE_HZ, align, buildReference, compareAttempt, compareCurves, fillGaps, referenceFromCurves } from '../compare.js';

// A staged raise like Olivier's video 4: shoulder 10 -> 90 -> hold -> 170 -> hold -> 10, elbow held straight.
function staged(speed = 1) {
  const keys = [[0, 10], [3, 90], [5, 90], [8, 170], [11, 170], [14, 10]];
  const n = Math.round((14 / speed) * SAMPLE_HZ) + 1;
  const shoulder = Array.from({ length: n }, (_, i) => {
    const t = (i / SAMPLE_HZ) * speed;
    const k = keys.findIndex(([kt]) => kt >= t);
    if (k <= 0) return keys[0][1];
    const [t0, v0] = keys[k - 1], [t1, v1] = keys[k];
    return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
  });
  return { rightShoulder: shoulder, rightElbow: shoulder.map(() => 172) };
}

const pad = (c, before, after) => Object.fromEntries(Object.entries(c).map(([k, v]) =>
  [k, [...Array(before).fill(v[0]), ...v, ...Array(after).fill(v.at(-1))]]));

describe('reference comparison', () => {
  const ref = referenceFromCurves(staged());

  it('reads the moving and held joints of the reference', () => {
    expect(ref.joints.map(j => [j.name, j.kind])).toEqual([['rightShoulder', 'moving'], ['rightElbow', 'held']]);
  });

  it('matches the same movement, slower, with footage before and after', () => {
    const r = compareCurves(ref, pad(staged(0.7), 30, 40));
    expect(r.verdict).toBe('match');
    expect(r.start).toBeCloseTo(3, 0);
    expect(r.tempo).toBeGreaterThan(1.3);
  });

  it('asks to revise a raise that stops short, and names the joint', () => {
    const short = staged();
    short.rightShoulder = short.rightShoulder.map(v => Math.min(v, 130));
    const r = compareCurves(ref, short);
    expect(r.verdict).toBe('revise');
    expect(r.reasons).toContain('range:rightShoulder');
    expect(r.reasons.some(x => x.endsWith('Elbow'))).toBe(false);
    const worst = r.joints.find(j => j.name === 'rightShoulder').worst;
    expect(worst.reference - worst.attempt).toBeGreaterThan(30);
  });

  it('asks to revise a bent elbow the reference keeps straight', () => {
    const bent = staged();
    bent.rightElbow = bent.rightElbow.map(v => v - 35);
    const r = compareCurves(ref, bent);
    expect(r.verdict).toBe('revise');
    expect(r.reasons).toEqual(['off:rightElbow']);
  });

  it('gives no verdict when the attempt does not show a joint (R8)', () => {
    const hidden = staged();
    hidden.rightElbow = hidden.rightElbow.map((v, i) => (i % 2 ? null : v));
    expect(compareCurves(ref, hidden)).toMatchObject({ verdict: 'refused', reasons: ['unseen:rightElbow'] });
  });

  it('leaves out a reference joint seen on under 80 % of the video', () => {
    const c = staged();
    c.leftShoulder = c.rightShoulder.map((v, i) => (i % 3 ? v : null));
    expect(referenceFromCurves(c).unused.map(u => u.name)).toEqual(['leftShoulder']);
  });

  it('lists the positions the reference holds, with the attempt\'s angle and time at each', () => {
    const r = compareCurves(ref, staged(0.5));
    const held = r.holds.filter(h => h.refAngle > 50).map(h => [Math.round(h.refAngle), Math.round(h.attAngle)]);
    expect(held).toEqual([[90, 90], [170, 170]]);
    const top = r.holds.find(h => h.refAngle > 160);
    expect(top.attSec / top.refSec).toBeGreaterThan(1.6);
  });

  it('aligns a stretch of the attempt to the whole reference', () => {
    const path = align([[0, 10, 20, 10, 0]], [[5, 5, 0, 10, 20, 10, 0, 5]]);
    expect(path[0]).toEqual([0, 2]);
    expect(path.at(-1)).toEqual([4, 6]);
  });

  it('fills unseen samples between seen ones', () => {
    expect(fillGaps([null, 2, null, null, 8, null])).toEqual([2, 2, 4, 6, 8, 8]);
  });
});

// Olivier's landmarks are a third party's and stay out of this public repository: these run where they are present
// (REFERENCE_LANDMARKS, the folder of test/real-phone/reference/README.md).
const local = process.env.REFERENCE_LANDMARKS;
const read = name => JSON.parse(gunzipSync(fs.readFileSync(`${local}/${name}.json.gz`)));
const opts = v => ({ aspect: v.metadata.extractedWidth / v.metadata.extractedHeight });
describe.skipIf(!local || !fs.existsSync(`${local}/olivier-4-supine-staged-raise.json.gz`))('Olivier video 4 (local landmarks)', () => {
  let v, ref;
  beforeAll(() => {
    v = read('olivier-4-supine-staged-raise');
    ref = buildReference(v.imageLandmarks, v.timestamps, opts(v));
  });

  it('uses the arm nearest the camera', () => {
    expect(ref.joints.map(j => j.name)).toEqual(['rightShoulder', 'rightElbow']);
  });

  it('matches the reference replayed 1.3 times slower', () => {
    const r = compareAttempt(ref, v.imageLandmarks, v.timestamps.map(t => t * 1.3), opts(v));
    expect(r.verdict).toBe('match');
  });

  it('does not match another exercise (video 1)', () => {
    const other = read('olivier-1-supine-clasped');
    expect(compareAttempt(ref, other.imageLandmarks, other.timestamps, opts(other)).verdict).toBe('revise');
  });
});
