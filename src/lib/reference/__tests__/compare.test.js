import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import { SAMPLE_HZ, align, buildReference, compareAttempt, compareCurves, dropJumps, fillGaps, jointAngles, mirrorLandmarks, referenceFromCurves, unwrapAround } from '../compare.js';

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
    hidden.rightElbow = hidden.rightElbow.map((v, i) => (i % 5 < 3 ? null : v));
    expect(compareCurves(ref, hidden)).toMatchObject({ verdict: 'refused', reasons: ['unseen:rightElbow'] });
  });

  it('judges only the moments the attempt shows, and none of its filled line (R8, filmed on the floor)', () => {
    // Lost 0.8 s in every 2 s, as an arm lying on the other one is: what the attempt shows is the reference's movement.
    const lost = staged();
    for (const name of Object.keys(lost)) lost[name] = lost[name].map((v, i) => (i % 20 >= 12 ? null : v));
    const r = compareCurves(ref, lost);
    expect(r.verdict).toBe('match');
    const sh = r.joints.find(j => j.name === 'rightShoulder');
    expect(sh.within).toBeGreaterThan(0.95);
    expect(sh.shown).toBeLessThan(0.75);
    expect(sh.rangeShare).toBeGreaterThan(0.95);
  });

  it('still asks to revise a short raise filmed with the same losses', () => {
    const lost = staged();
    lost.rightShoulder = lost.rightShoulder.map(v => Math.min(v, 130));
    for (const name of Object.keys(lost)) lost[name] = lost[name].map((v, i) => (i % 20 >= 12 ? null : v));
    expect(compareCurves(ref, lost).reasons).toContain('range:rightShoulder');
  });

  it('never accepts an attempt lost after the first fifth of its movement', () => {
    // Seen on over half the samples, most of them still footage before the movement: refused or asked to revise,
    // never matched on the line filled across what it does not show.
    const lost = pad(staged(), 100, 0);
    const cut = 100 + Math.round(staged().rightShoulder.length * 0.2);
    for (const name of Object.keys(lost)) lost[name] = lost[name].map((v, i) => (i >= cut ? null : v));
    expect(compareCurves(ref, lost).verdict).not.toBe('match');
  });

  it('gives no verdict when the attempt shows the measure on under half of its samples', () => {
    const lost = staged();
    for (const name of Object.keys(lost)) lost[name] = lost[name].map((v, i) => (i % 20 >= 9 ? null : v));
    expect(compareCurves(ref, lost)).toMatchObject({ verdict: 'refused', reasons: ['unseen:rightShoulder', 'unseen:rightElbow'] });
  });

  it('does not judge a hold the attempt does not show', () => {
    const lost = staged();
    // Lost from the middle of the top hold (170 degrees, 8 to 11 s) to the end.
    for (const name of Object.keys(lost)) lost[name] = lost[name].map((v, i) => (i >= 95 ? null : v));
    const r = compareCurves(ref, lost);
    expect(r.holds.some(h => h.refAngle > 160)).toBe(false);
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

// A person lying with the shoulders stacked (left above right), the left arm swinging from straight up to pointing
// right, as in Olivier's video 3 filmed from the head end. Image landmarks, picture 1 wide by 1 high.
function swing(seconds = 10, hz = 15, { tilt = 0, mirror = false, otherArmSeen = 0.99 } = {}) {
  const ts = [], lms = [];
  const rot = (x, y) => {
    const c = Math.cos(tilt), s = Math.sin(tilt), dx = x - 0.5, dy = y - 0.5;
    return [0.5 + dx * c - dy * s, 0.5 + dx * s + dy * c];
  };
  for (let i = 0; i <= seconds * hz; i++) {
    const t = i / hz, a = (Math.PI / 2) * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / seconds)); // 0 up, pi/2 right
    const pts = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.1 }));
    const set = (k, x, y) => { const [u, v] = rot(x, y); pts[k] = { x: mirror ? 1 - u : u, y: v, visibility: 0.99 }; };
    set(11, 0.4, 0.45); set(12, 0.4, 0.6);
    set(13, 0.4 + 0.12 * Math.sin(a), 0.45 - 0.12 * Math.cos(a));
    set(15, 0.4 + 0.24 * Math.sin(a), 0.45 - 0.24 * Math.cos(a));
    set(14, 0.55, 0.62); set(16, 0.7, 0.64);
    pts[14].visibility = pts[16].visibility = otherArmSeen;
    if (mirror) { // the model names the mirrored person's arms the other way round
      for (const [l, r] of [[11, 12], [13, 14], [15, 16]]) [pts[l], pts[r]] = [pts[r], pts[l]];
    }
    ts.push(t); lms.push(pts);
  }
  return { ts, lms };
}

describe('segment directions', () => {
  const options = { joints: {}, directions: { leftArm: { from: 11, to: 15, apartFrom: 16 } }, aspect: 1 };
  const plain = swing();
  const ref = buildReference(plain.lms, plain.ts, options);

  it('reads where the arm points against the body line, through a 90 degree swing', () => {
    expect(ref.joints).toHaveLength(1);
    expect(ref.joints[0]).toMatchObject({ name: 'leftArm', kind: 'moving', direction: true });
    expect(ref.joints[0].range).toBeGreaterThan(80);
  });

  it('reads the same with the phone propped 12 degrees askew', () => {
    const tilted = swing(10, 15, { tilt: (12 * Math.PI) / 180 });
    const r = compareAttempt(ref, tilted.lms, tilted.ts, options);
    expect(r.verdict).toBe('match');
    expect(r.joints[0].gapP90).toBeLessThan(2);
  });

  it('reads a patient lying the other way round as in a mirror, and names the patient\'s side', () => {
    // The arm under the body is not seen: the plain reading gives no verdict, the mirrored one does.
    const m = swing(13, 15, { mirror: true, otherArmSeen: 0.1 });
    const r = compareAttempt(ref, m.lms, m.ts, options);
    expect(r).toMatchObject({ verdict: 'match', mirrored: true });
    expect(r.joints[0]).toMatchObject({ name: 'rightArm', measure: 'leftArm' });
  });

  it('reads only as in a mirror when the physiotherapist set the other side', () => {
    // Both arms seen: without the side, the plain reading would judge the arm that does not move.
    const m = swing(13, 15, { mirror: true });
    expect(compareAttempt(ref, m.lms, m.ts, options).mirrored).toBe(false);
    expect(compareAttempt(ref, m.lms, m.ts, { ...options, mirror: true })).toMatchObject({ verdict: 'match', mirrored: true });
  });

  it('asks to revise a swing that stops at two thirds', () => {
    const short = swing();
    short.lms.forEach(lm => {
      const s = lm[11], w = lm[15], dx = w.x - s.x, dy = w.y - s.y;
      const a = Math.min(Math.atan2(dx, -dy), Math.PI / 3), len = Math.hypot(dx, dy);
      lm[15] = { ...w, x: s.x + len * Math.sin(a), y: s.y - len * Math.cos(a) };
    });
    expect(compareAttempt(ref, short.lms, short.ts, options).verdict).toBe('revise');
  });

  it('drops the samples where the wrist lies on the other one', () => {
    const lm = plain.lms[0].map(p => ({ ...p }));
    lm[15] = { ...lm[16] };
    expect(jointAngles([lm], options).leftArm).toEqual([null]);
  });

  it('keeps a direction on one side of the circle, and drops a one-sample jump', () => {
    expect(unwrapAround([170, -175, 178], 175)).toEqual([170, 185, 178]);
    expect(dropJumps([10, 11, 12, 80, 13, 14, 15])).toEqual([10, 11, 12, null, 13, 14, 15]);
  });

  it('keeps a steady move that runs into a gap or an end', () => {
    expect(dropJumps([0, 9, 18, 27, 36, 45, 54, null, null])).toEqual([0, 9, 18, 27, 36, 45, 54, null, null]);
  });

  it('mirrors landmarks: x turned over, left and right exchanged', () => {
    const lm = Array.from({ length: 33 }, (_, i) => ({ x: i / 100, y: 0, visibility: 1 }));
    const m = mirrorLandmarks([lm])[0];
    expect(m[11].x).toBeCloseTo(1 - 0.12);
    expect(m[0].x).toBeCloseTo(1);
  });
});

describe('the mirror reading', () => {
  // Side-on, as video 4: the near (right) arm is the reference's; the far arm is the pose model's guess.
  function sideOn(top, farTop, farSeen) {
    const ts = [], lms = [];
    for (let i = 0; i <= 150; i++) {
      const t = i / 15, a = (Math.PI / 180) * (10 + (top - 10) * Math.sin((Math.PI * t) / 10));
      const b = (Math.PI / 180) * (10 + (farTop - 10) * Math.sin((Math.PI * t) / 10));
      const pts = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.1 }));
      const arm = (s, e, w, h, ang, vis) => {
        pts[h] = { x: 0.3, y: 0.5, z: 0, visibility: vis }; pts[s] = { x: 0.6, y: 0.5, z: 0, visibility: vis };
        pts[e] = { x: 0.6 - 0.12 * Math.cos(ang), y: 0.5 - 0.12 * Math.sin(ang), z: 0, visibility: vis };
        pts[w] = { x: 0.6 - 0.24 * Math.cos(ang), y: 0.5 - 0.24 * Math.sin(ang), z: 0, visibility: vis };
      };
      arm(12, 14, 16, 24, a, 0.99); arm(11, 13, 15, 23, b, farSeen);
      ts.push(t); lms.push(pts);
    }
    return { ts, lms };
  }

  it('does not judge the far arm when the near one is seen (R8)', () => {
    const r0 = sideOn(170, 170, 0.3);
    const ref = buildReference(r0.lms, r0.ts, { aspect: 1 });
    expect(ref.joints.map(j => j.name)).toEqual(['rightShoulder', 'rightElbow']);
    const att = sideOn(90, 170, 0.9);
    expect(compareAttempt(ref, att.lms, att.ts, { aspect: 1 })).toMatchObject({ verdict: 'revise', mirrored: false });
  });
});

describe('moments the reference does not show', () => {
  it('judges an attempt only where the reference was seen (R8)', () => {
    const c = staged();
    // The reference's pose lost over its top hold: those moments are filled, not Olivier's movement.
    const lost = { ...c, rightShoulder: c.rightShoulder.map((v, i) => (i >= 82 && i < 106 ? null : v)) };
    const r = referenceFromCurves(lost);
    const att = staged();
    att.rightShoulder = att.rightShoulder.map((v, i) => (i >= 82 && i < 106 ? 120 : v));
    const out = compareCurves(r, att);
    expect(out.verdict).toBe('match');
    expect(out.joints[0].shown).toBeLessThan(0.85);
    expect(out.holds.some(h => h.refAngle > 160)).toBe(false);
    expect(out.seen[0].slice(82, 106).every(x => !x)).toBe(true);
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
